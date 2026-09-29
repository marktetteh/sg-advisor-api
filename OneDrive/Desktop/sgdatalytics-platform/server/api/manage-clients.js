#!/usr/bin/env node
/**
 * SG Datalytics — API Client Manager (CLI)
 *
 * Usage:
 *   node server/api/manage-clients.js create  --name "Stanbic Bank" --email bank@stanbic.com.gh --tier pro --categories "Electronics,Vehicles"
 *   node server/api/manage-clients.js list
 *   node server/api/manage-clients.js revoke  --email bank@stanbic.com.gh
 *   node server/api/manage-clients.js usage   --email bank@stanbic.com.gh
 *
 * The raw API key is printed ONCE on creation — it is NOT stored in the DB.
 * Share it with the client securely (email, WhatsApp, etc).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
});

const TIERS = {
  trial:      { row_limit_monthly: 100,   label: 'Trial (100 rows/month)' },
  starter:    { row_limit_monthly: 1000,  label: 'Starter (1,000 rows/month)' },
  pro:        { row_limit_monthly: 20000, label: 'Pro (20,000 rows/month)' },
  enterprise: { row_limit_monthly: -1,    label: 'Enterprise (unlimited)' },
};

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateKey() {
  return 'sgd_' + crypto.randomBytes(24).toString('hex');
}

function parseArgs() {
  const args  = process.argv.slice(2);
  const cmd   = args[0];
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return { cmd, flags };
}

// ── CREATE ────────────────────────────────────────────────────
async function createClient({ name, email, tier = 'starter', categories = '', notes = '', limit }) {
  if (!name || !email) {
    console.error('ERROR: --name and --email are required');
    process.exit(1);
  }

  const tierConfig = TIERS[tier];
  if (!tierConfig) {
    console.error(`ERROR: invalid tier "${tier}". Must be: ${Object.keys(TIERS).join(', ')}`);
    process.exit(1);
  }

  const rawKey   = generateKey();
  const keyHash  = hashKey(rawKey);
  const cats     = categories ? categories.split(',').map(c => c.trim()).filter(Boolean) : [];
  const rowLimit = limit ? parseInt(limit) : tierConfig.row_limit_monthly;

  try {
    const res = await pool.query(`
      INSERT INTO api_clients (name, email, api_key_hash, tier, allowed_categories, row_limit_monthly, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, tier, allowed_categories, row_limit_monthly, created_at
    `, [name, email, keyHash, tier, cats, rowLimit, notes || null]);

    const client = res.rows[0];

    console.log('\n  ✅ Client created successfully\n');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log(`  │  Name:       ${client.name}`);
    console.log(`  │  Email:      ${client.email}`);
    console.log(`  │  ID:         ${client.id}`);
    console.log(`  │  Tier:       ${client.tier} — ${tierConfig.label}`);
    console.log(`  │  Categories: ${client.allowed_categories.length ? client.allowed_categories.join(', ') : 'ALL'}`);
    console.log(`  │  Row limit:  ${rowLimit === -1 ? 'Unlimited' : rowLimit.toLocaleString() + '/month'}`);
    console.log(`  │  Created:    ${new Date(client.created_at).toLocaleDateString()}`);
    console.log('  │');
    console.log(`  │  🔑 API KEY (share this with the client — shown once only):`);
    console.log(`  │  ${rawKey}`);
    console.log('  └─────────────────────────────────────────────────────────┘\n');
    console.log('  ⚠  This key will NOT be shown again. Copy it now.\n');
    console.log('  Usage example:');
    console.log(`  curl -H "X-API-Key: ${rawKey}" https://your-domain.com/data/categories\n`);

  } catch (err) {
    if (err.code === '23505') {
      console.error(`ERROR: A client with email "${email}" already exists.`);
    } else {
      console.error('ERROR:', err.message);
    }
    process.exit(1);
  }
}

// ── LIST ──────────────────────────────────────────────────────
async function listClients() {
  const res = await pool.query(`
    SELECT
      c.id, c.name, c.email, c.tier, c.is_active,
      c.row_limit_monthly,
      c.allowed_categories,
      c.created_at,
      COALESCE(SUM(u.rows_returned) FILTER (
        WHERE date_trunc('month', u.queried_at) = date_trunc('month', NOW())
      ), 0) AS rows_used_this_month,
      COUNT(u.id) FILTER (
        WHERE date_trunc('month', u.queried_at) = date_trunc('month', NOW())
      ) AS requests_this_month,
      MAX(u.queried_at) AS last_active
    FROM api_clients c
    LEFT JOIN api_usage_log u ON u.client_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);

  if (!res.rows.length) {
    console.log('\n  No clients yet.\n');
    return;
  }

  console.log(`\n  SG Datalytics API Clients (${res.rows.length} total)\n`);
  for (const c of res.rows) {
    const limit    = c.row_limit_monthly === -1 ? '∞' : c.row_limit_monthly.toLocaleString();
    const used     = parseInt(c.rows_used_this_month).toLocaleString();
    const cats     = c.allowed_categories.length ? c.allowed_categories.join(', ') : 'ALL';
    const status   = c.is_active ? '✅ Active' : '❌ Revoked';
    const lastSeen = c.last_active ? new Date(c.last_active).toLocaleDateString() : 'Never';
    console.log(`  [${c.id}] ${c.name} <${c.email}>`);
    console.log(`       ${status} · ${c.tier} · ${used}/${limit} rows this month · ${c.requests_this_month} requests`);
    console.log(`       Categories: ${cats}`);
    console.log(`       Last active: ${lastSeen} · Created: ${new Date(c.created_at).toLocaleDateString()}\n`);
  }
}

// ── REVOKE ────────────────────────────────────────────────────
async function revokeClient({ email }) {
  if (!email) { console.error('ERROR: --email required'); process.exit(1); }

  const res = await pool.query(
    'UPDATE api_clients SET is_active = FALSE WHERE email = $1 RETURNING name, email',
    [email]
  );

  if (!res.rows.length) {
    console.error(`ERROR: No client found with email "${email}"`);
    process.exit(1);
  }

  console.log(`\n  ✅ Revoked access for ${res.rows[0].name} (${email})\n`);
  console.log('  Their API key will now return 401 Unauthorized.\n');
}

// ── USAGE ─────────────────────────────────────────────────────
async function clientUsage({ email }) {
  if (!email) { console.error('ERROR: --email required'); process.exit(1); }

  const res = await pool.query(`
    SELECT
      c.name, c.email, c.tier, c.row_limit_monthly,
      COALESCE(SUM(u.rows_returned), 0) AS total_rows,
      COUNT(u.id)                        AS total_requests,
      MIN(u.queried_at)                  AS first_request,
      MAX(u.queried_at)                  AS last_request
    FROM api_clients c
    LEFT JOIN api_usage_log u ON u.client_id = c.id
    WHERE c.email = $1
    GROUP BY c.id
  `, [email]);

  if (!res.rows.length) { console.error(`No client found: ${email}`); process.exit(1); }

  const c = res.rows[0];
  console.log(`\n  Usage for ${c.name} (${c.email})`);
  console.log(`  Tier: ${c.tier} · Limit: ${c.row_limit_monthly === -1 ? 'Unlimited' : c.row_limit_monthly + '/month'}`);
  console.log(`  Total rows fetched (all time): ${parseInt(c.total_rows).toLocaleString()}`);
  console.log(`  Total requests (all time):     ${parseInt(c.total_requests).toLocaleString()}`);
  console.log(`  First request: ${c.first_request ? new Date(c.first_request).toLocaleString() : 'N/A'}`);
  console.log(`  Last request:  ${c.last_request  ? new Date(c.last_request).toLocaleString()  : 'N/A'}\n`);
}

// ── UPDATE ────────────────────────────────────────────────────
// Change a client's tier, row limit, or allowed categories.
// Only pass the flags you want to change — others stay the same.
//
//   node manage-clients.js update --email x@y.com --tier pro
//   node manage-clients.js update --email x@y.com --categories "Electronics,Vehicles,Real Estate"
//   node manage-clients.js update --email x@y.com --limit 5000
async function updateClient({ email, tier, categories, limit, notes }) {
  if (!email) { console.error('ERROR: --email required'); process.exit(1); }

  // Fetch current record first
  const cur = await pool.query('SELECT * FROM api_clients WHERE email = $1', [email]);
  if (!cur.rows.length) { console.error(`ERROR: No client found: ${email}`); process.exit(1); }
  const existing = cur.rows[0];

  const updates = [];
  const params  = [];
  let   p       = 1;

  if (tier) {
    if (!TIERS[tier]) { console.error(`ERROR: invalid tier "${tier}". Options: ${Object.keys(TIERS).join(', ')}`); process.exit(1); }
    updates.push(`tier = $${p++}`);
    params.push(tier);
    // Auto-update row limit to match tier unless --limit also provided
    if (!limit) {
      updates.push(`row_limit_monthly = $${p++}`);
      params.push(TIERS[tier].row_limit_monthly);
    }
  }
  if (categories !== undefined) {
    const cats = categories ? categories.split(',').map(c => c.trim()).filter(Boolean) : [];
    updates.push(`allowed_categories = $${p++}`);
    params.push(cats);
  }
  if (limit !== undefined) {
    updates.push(`row_limit_monthly = $${p++}`);
    params.push(parseInt(limit));
  }
  if (notes !== undefined) {
    updates.push(`notes = $${p++}`);
    params.push(notes);
  }

  if (!updates.length) {
    console.log('  Nothing to update — pass at least one of: --tier --categories --limit --notes');
    return;
  }

  params.push(email);
  const res = await pool.query(
    `UPDATE api_clients SET ${updates.join(', ')} WHERE email = $${p} RETURNING *`,
    params
  );

  const c = res.rows[0];
  console.log(`\n  ✅ Updated ${c.name} (${c.email})`);
  console.log(`     Tier:       ${existing.tier} → ${c.tier}`);
  console.log(`     Row limit:  ${existing.row_limit_monthly === -1 ? '∞' : existing.row_limit_monthly} → ${c.row_limit_monthly === -1 ? '∞ (unlimited)' : c.row_limit_monthly + '/month'}`);
  console.log(`     Categories: ${c.allowed_categories.length ? c.allowed_categories.join(', ') : 'ALL'}\n`);
}

// ── REACTIVATE ────────────────────────────────────────────────
async function reactivateClient({ email }) {
  if (!email) { console.error('ERROR: --email required'); process.exit(1); }
  const res = await pool.query(
    'UPDATE api_clients SET is_active = TRUE WHERE email = $1 RETURNING name, email',
    [email]
  );
  if (!res.rows.length) { console.error(`ERROR: No client found: ${email}`); process.exit(1); }
  console.log(`\n  ✅ Reactivated ${res.rows[0].name} (${email}) — their API key works again.\n`);
}

// ── REPORT ────────────────────────────────────────────────────
// Internal analytics for Mark — client health at a glance.
async function report() {
  const res = await pool.query(`
    WITH monthly AS (
      SELECT
        client_id,
        COALESCE(SUM(rows_returned), 0)  AS rows_this_month,
        COUNT(*)                          AS requests_this_month,
        MAX(queried_at)                   AS last_active
      FROM api_usage_log
      WHERE date_trunc('month', queried_at) = date_trunc('month', NOW())
      GROUP BY client_id
    ),
    daily_trend AS (
      SELECT
        client_id,
        date_trunc('day', queried_at) AS day,
        COUNT(*)                       AS reqs
      FROM api_usage_log
      WHERE queried_at >= NOW() - INTERVAL '7 days'
      GROUP BY client_id, day
    )
    SELECT
      c.id, c.name, c.email, c.tier, c.is_active,
      c.row_limit_monthly,
      COALESCE(m.rows_this_month, 0)     AS rows_this_month,
      COALESCE(m.requests_this_month, 0) AS requests_this_month,
      m.last_active
    FROM api_clients c
    LEFT JOIN monthly m ON m.client_id = c.id
    ORDER BY rows_this_month DESC
  `);

  const now      = new Date();
  const monthStr = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║   SG Datalytics — API Usage Report · ${monthStr.padEnd(14)}║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝\n`);

  const active   = res.rows.filter(r => r.is_active);
  const inactive = res.rows.filter(r => !r.is_active);
  const totalRows = active.reduce((s, r) => s + parseInt(r.rows_this_month), 0);

  console.log(`  Active clients: ${active.length}  |  Revoked: ${inactive.length}  |  Total rows served this month: ${totalRows.toLocaleString()}\n`);

  // Clients approaching quota (>80%)
  const warning = active.filter(r => {
    const limit = r.row_limit_monthly;
    return limit !== -1 && parseInt(r.rows_this_month) / limit >= 0.8;
  });
  if (warning.length) {
    console.log(`  ⚠  QUOTA WARNINGS (>80% used):`);
    for (const c of warning) {
      const pct = Math.round(parseInt(c.rows_this_month) / c.row_limit_monthly * 100);
      console.log(`     · ${c.name} — ${pct}% used (${parseInt(c.rows_this_month).toLocaleString()}/${c.row_limit_monthly.toLocaleString()} rows)`);
    }
    console.log();
  }

  // Per-client breakdown
  console.log('  ── Client Activity ───────────────────────────────────────');
  for (const c of active) {
    const limit     = c.row_limit_monthly === -1 ? '∞' : c.row_limit_monthly.toLocaleString();
    const used      = parseInt(c.rows_this_month).toLocaleString();
    const reqs      = parseInt(c.requests_this_month).toLocaleString();
    const lastSeen  = c.last_active ? new Date(c.last_active).toLocaleDateString() : 'Never';
    const pctBar    = c.row_limit_monthly === -1 ? '' : (() => {
      const pct   = Math.min(1, parseInt(c.rows_this_month) / c.row_limit_monthly);
      const filled = Math.round(pct * 10);
      return ' [' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(pct * 100)}%]`;
    })();
    console.log(`\n  ${c.name} <${c.email}>`);
    console.log(`  ${c.tier.padEnd(12)} ${used} / ${limit} rows${pctBar}`);
    console.log(`  ${reqs} requests · Last active: ${lastSeen}`);
  }

  if (inactive.length) {
    console.log(`\n  ── Revoked Clients ───────────────────────────────────────`);
    for (const c of inactive) {
      console.log(`  · ${c.name} <${c.email}> (${c.tier})`);
    }
  }
  console.log();
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  const { cmd, flags } = parseArgs();

  switch (cmd) {
    case 'create':     await createClient(flags);     break;
    case 'list':       await listClients();            break;
    case 'revoke':     await revokeClient(flags);      break;
    case 'reactivate': await reactivateClient(flags);  break;
    case 'update':     await updateClient(flags);      break;
    case 'usage':      await clientUsage(flags);       break;
    case 'report':     await report();                 break;
    default:
      console.log('\n  SG Datalytics — API Client Manager\n');
      console.log('  Commands:');
      console.log('    create     --name "Name" --email x@y.com --tier trial|starter|pro|enterprise --categories "Cat1,Cat2"');
      console.log('    list');
      console.log('    update     --email x@y.com [--tier pro] [--categories "Cat1,Cat2"] [--limit 5000]');
      console.log('    revoke     --email x@y.com');
      console.log('    reactivate --email x@y.com');
      console.log('    usage      --email x@y.com');
      console.log('    report     (all clients — monthly overview)\n');
  }

  await pool.end();
}

main().catch(err => { console.error(err.message); process.exit(1); });
