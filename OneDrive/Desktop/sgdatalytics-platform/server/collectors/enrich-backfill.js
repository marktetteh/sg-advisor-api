/**
 * SG Datalytics — Enrichment Backfill
 * Targets rows in market_prices where normalized_name is blank,
 * runs them through Gemini enrichment, and updates Neon in place.
 *
 * Run after Gemini recovers:
 *   node collectors/enrich-backfill.js
 *
 * Optional filters (env vars):
 *   SOURCE=jiji.com.gh          — only backfill rows from one source
 *   WEEK_NUMBER=26              — only backfill a specific week
 *   LIMIT=5000                  — cap how many rows to process (default: all)
 *   DRY_RUN=1                   — show what would be updated, but don't write
 */
require('dotenv').config();
const { Pool } = require('pg');
const { enrichListings } = require('./enricher');

const CONN      = process.env.NEON_MARKET_PRICES;
const SOURCE    = process.env.SOURCE    || null;
const WEEK      = process.env.WEEK_NUMBER ? parseInt(process.env.WEEK_NUMBER) : null;
const LIMIT     = process.env.LIMIT     ? parseInt(process.env.LIMIT) : 999999;
const DRY_RUN   = process.env.DRY_RUN === '1';
const CHUNK     = 200;  // fetch and enrich N rows at a time to avoid memory issues

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// Retry wrapper — survives brief network drops on DB calls
async function withRetry(label, fn, retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      const isNetwork = /ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(err.message);
      if (!isNetwork || i === retries) throw err;
      const wait = i * 15000;
      log(`${label} — network drop, retrying in ${wait / 1000}s (${i}/${retries})…`, '⚠');
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function run() {
  if (!CONN) { console.error('NEON_MARKET_PRICES not set in .env'); process.exit(1); }
  log('DB: ' + CONN.replace(/:([^@]+)@/, ':***@'), '🔗');

  const pool = new Pool({ connectionString: CONN });
  // Prevent unhandled 'error' events from idle connections crashing the process
  pool.on('error', (err) => log(`Pool idle client error: ${err.message}`, '⚠'));

  // Sanity check — total rows in table
  const { rows: [{ total_rows }] } = await withRetry('initial count', () =>
    pool.query('SELECT COUNT(*) AS total_rows FROM market_prices')
  );
  log(`market_prices total rows: ${total_rows}`, '📊');

  // Count how many rows need backfill
  let whereClause = `WHERE (normalized_name IS NULL OR normalized_name = '')`;
  const params = [];
  if (SOURCE) { params.push(SOURCE); whereClause += ` AND collection_method = $${params.length}`; }
  if (WEEK)   { params.push(WEEK);   whereClause += ` AND week_number = $${params.length}`; }

  log(`Query: SELECT COUNT(*) FROM market_prices ${whereClause}`, '🔍');
  const { rows: [{ count }] } = await withRetry('row count', () =>
    pool.query(`SELECT COUNT(*) FROM market_prices ${whereClause}`, params)
  );
  log(`Raw count result: ${count}`, '🔍');
  const total = Math.min(parseInt(count), LIMIT);
  log(`Found ${count} rows needing enrichment — processing ${total}`, '🔍');
  if (DRY_RUN) log('DRY_RUN=1 — no writes will happen', '⚠');
  if (total === 0) { await pool.end(); return; }

  let offset  = 0;
  let updated = 0;
  let failed  = 0;

  while (offset < total) {
    const fetchParams = [...params, CHUNK, offset];

    // Fetch chunk — retry on network drop
    let rows;
    try {
      ({ rows } = await withRetry(`fetch offset ${offset}`, () =>
        pool.query(
          `SELECT id, title, brand, model, condition
           FROM market_prices ${whereClause}
           ORDER BY id
           LIMIT $${fetchParams.length - 1} OFFSET $${fetchParams.length}`,
          fetchParams
        )
      ));
    } catch (err) {
      log(`Fetch failed after retries: ${err.message} — stopping`, '✖');
      break;
    }
    if (!rows.length) break;

    log(`Enriching rows ${offset + 1}–${offset + rows.length} of ${total}…`, '⚙');

    // Map to enricher's expected shape
    const mapped = rows.map(r => ({
      _id:            r.id,
      title:          r.title         || '',
      brand:          r.brand         || '',
      model:          r.model         || '',
      storage:        '',
      normalized_name:'',
      condition:      r.condition     || '',
    }));

    const enriched = await enrichListings(mapped);

    if (!DRY_RUN) {
      // Batch UPDATE — retry on network drop
      try {
        await withRetry(`update offset ${offset}`, async () => {
          const client = await pool.connect();
          // Silence error events on active clients — the next awaited query will
          // throw a rejected promise which is caught by the try/catch below.
          client.on('error', err => log(`DB client error: ${err.message}`, '⚠'));
          try {
            await client.query('BEGIN');
            for (const row of enriched) {
              if (!row.normalized_name && !row.brand) { failed++; continue; }
              await client.query(
                `UPDATE market_prices
                 SET normalized_name = $1,
                     brand           = $2,
                     model           = $3,
                     storage         = $4,
                     condition       = CASE WHEN (condition IS NULL OR condition = '') THEN $5 ELSE condition END
                 WHERE id = $6`,
                [
                  row.normalized_name || '',
                  row.brand           || '',
                  row.model           || '',
                  row.storage         || '',
                  row.condition       || '',
                  row._id,
                ]
              );
              updated++;
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        });
        log(`Updated ${updated} rows so far`, '🐘');
      } catch (err) {
        log(`Batch update failed after retries: ${err.message} — skipping chunk`, '⚠');
        failed += rows.length;
      }
    } else {
      const enrichedCount = enriched.filter(r => r.normalized_name).length;
      log(`[DRY RUN] Would update ${enrichedCount}/${rows.length} rows in this chunk`, '📋');
      updated += enrichedCount;
    }

    offset += rows.length;
  }

  await pool.end();
  log(`Backfill complete — ${updated} updated · ${failed} skipped`, '✅');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
