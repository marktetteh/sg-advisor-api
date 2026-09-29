/**
 * SG Datalytics — Distribution API Auth Middleware
 *
 * Validates the X-API-Key header on every /data/* request.
 * Enforces:
 *   1. Key validity (hashed lookup in api_clients)
 *   2. Per-minute request rate limit (in-memory, per key)
 *   3. Monthly row quota (from api_usage_log)
 *
 * Also injects quota headers into every response so clients
 * can self-monitor without polling /data/usage.
 *
 * Usage:
 *   const { requireApiKey } = require('../api/auth');
 *   router.use(requireApiKey);
 */
const crypto   = require('crypto');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ── Rate limit config per tier ────────────────────────────────
// Max requests per 60-second sliding window
const RATE_LIMITS = {
  trial:      30,
  starter:    60,
  pro:        200,
  enterprise: 600,
};

// In-memory rate limit store: { keyHash: { count, windowStart } }
// Automatically clears stale windows — no external dependency needed.
const rateLimitStore = new Map();
const WINDOW_MS      = 60 * 1000; // 1 minute

function checkRateLimit(keyHash, tier) {
  const limit = RATE_LIMITS[tier] || 60;
  const now   = Date.now();
  const entry = rateLimitStore.get(keyHash);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // New window
    rateLimitStore.set(keyHash, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS, limit };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + WINDOW_MS, limit };
  }
  return { allowed: true, remaining, resetAt: entry.windowStart + WINDOW_MS, limit };
}

// Periodically clean up stale entries (every 5 min) to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of rateLimitStore) {
    if (entry.windowStart < cutoff) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// ── Monthly usage count for a client ─────────────────────────
async function getMonthlyUsage(clientId) {
  const res = await pool.query(`
    SELECT COALESCE(SUM(rows_returned), 0) AS rows_used
    FROM api_usage_log
    WHERE client_id = $1
      AND date_trunc('month', queried_at) = date_trunc('month', NOW())
  `, [clientId]);
  return parseInt(res.rows[0].rows_used, 10);
}

function getQuotaResetDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ── Quota response headers ────────────────────────────────────
// Injected on every successful authenticated response so clients
// can track usage without a separate /data/usage call.
function setQuotaHeaders(res, client, rowsUsed) {
  const limit     = client.row_limit_monthly;
  const unlimited = limit === -1;
  res.setHeader('X-Quota-Limit',     unlimited ? 'unlimited' : limit);
  res.setHeader('X-Quota-Used',      rowsUsed);
  res.setHeader('X-Quota-Remaining', unlimited ? 'unlimited' : Math.max(0, limit - rowsUsed));
  res.setHeader('X-Quota-Reset',     getQuotaResetDate());
  res.setHeader('X-Client-Tier',     client.tier);

  // Warn when >80% consumed (for non-unlimited tiers)
  if (!unlimited && rowsUsed / limit >= 0.8) {
    res.setHeader('X-Quota-Warning', 'You have used over 80% of your monthly row quota. Contact mark@sgdatalytics.com to upgrade.');
  }
}

// ── Main middleware ───────────────────────────────────────────
async function requireApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key'] || req.query.api_key;

  if (!rawKey) {
    return res.status(401).json({
      error: 'Missing API key. Pass it as the X-API-Key header.',
      docs:  'Contact mark@sgdatalytics.com to get an API key.',
    });
  }

  const hash = hashKey(rawKey);

  // ── 1. Rate limit check (fast, in-memory, no DB) ─────────
  // We do a preliminary check with 'starter' defaults before we know the tier.
  // Real tier-aware check happens after DB lookup below.
  const prelimCheck = checkRateLimit(hash, 'starter');
  res.setHeader('X-RateLimit-Limit',     prelimCheck.limit);
  res.setHeader('X-RateLimit-Remaining', prelimCheck.remaining);
  res.setHeader('X-RateLimit-Reset',     Math.ceil(prelimCheck.resetAt / 1000));

  try {
    const result = await pool.query(
      'SELECT * FROM api_clients WHERE api_key_hash = $1 AND is_active = TRUE',
      [hash]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid or revoked API key.' });
    }

    const client = result.rows[0];

    // ── 2. Tier-aware rate limit (re-check with actual tier) ──
    // Undo the preliminary increment and do a proper check
    const rateCheck = checkRateLimit(hash, client.tier);
    res.setHeader('X-RateLimit-Limit',     rateCheck.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateCheck.remaining));
    res.setHeader('X-RateLimit-Reset',     Math.ceil(rateCheck.resetAt / 1000));

    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error:       `Rate limit exceeded. Max ${rateCheck.limit} requests/minute on the ${client.tier} plan.`,
        retry_after: `${retryAfter} seconds`,
        upgrade:     client.tier !== 'enterprise' ? 'Contact mark@sgdatalytics.com to upgrade your plan.' : undefined,
      });
    }

    // ── 3. Monthly row quota check ────────────────────────────
    const rowsUsed = client.row_limit_monthly !== -1
      ? await getMonthlyUsage(client.id)
      : 0;

    if (client.row_limit_monthly !== -1 && rowsUsed >= client.row_limit_monthly) {
      setQuotaHeaders(res, client, rowsUsed);
      return res.status(429).json({
        error:     'Monthly row quota exceeded.',
        rows_used:  rowsUsed,
        row_limit:  client.row_limit_monthly,
        resets_at:  getQuotaResetDate(),
        upgrade:    'Contact mark@sgdatalytics.com to upgrade your plan.',
      });
    }

    // Attach quota info for downstream use
    client._rows_used_this_month = rowsUsed;
    setQuotaHeaders(res, client, rowsUsed);

    req.client = client;
    next();

  } catch (err) {
    console.error('[auth] DB error:', err.message);
    res.status(500).json({ error: 'Authentication service unavailable. Try again shortly.' });
  }
}

// ── Log a completed request ───────────────────────────────────
async function logUsage({ clientId, endpoint, filters, rowsReturned, responseMs }) {
  try {
    await pool.query(`
      INSERT INTO api_usage_log (client_id, endpoint, filters, rows_returned, response_ms)
      VALUES ($1, $2, $3, $4, $5)
    `, [clientId, endpoint, JSON.stringify(filters || {}), rowsReturned, responseMs]);
  } catch (err) {
    // Non-fatal — don't break the response if logging fails
    console.error('[auth] Usage log error:', err.message);
  }
}

module.exports = { requireApiKey, logUsage, hashKey, pool };
