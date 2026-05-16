/**
 * SG Datalytics — Enrichment Backfill
 * Enriches existing market_prices rows that have no normalized_name yet.
 *
 * Fetches rows in pages of FETCH_BATCH, runs AI enrichment, then issues
 * a single UPDATE per row.  Processes up to MAX_ROWS rows per run
 * (default: unlimited — set MAX_ROWS env var to cap it during testing).
 *
 * Run:
 *   node server/db/backfill-enrichment.js
 *   MAX_ROWS=300 node server/db/backfill-enrichment.js   # test run
 *
 * Env: DATABASE_URL_MARKET_PRICES, GEMINI_API_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool }          = require('pg');
const { enrichListings } = require('../collectors/enricher');

const FETCH_BATCH = 200;                                       // rows per DB fetch
const MAX_ROWS    = parseInt(process.env.MAX_ROWS || '0');    // 0 = unlimited
const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const DB_URL = process.env.NEON_MARKET_PRICES || process.env.DATABASE_URL_MARKET_PRICES;
if (!DB_URL) {
  console.error('Fatal: NEON_MARKET_PRICES is not set. Check server/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Fetch a page of un-enriched rows ─────────────────────────────────────────
async function fetchBatch(offset) {
  const limit = MAX_ROWS > 0
    ? Math.min(FETCH_BATCH, MAX_ROWS - offset)
    : FETCH_BATCH;

  const { rows } = await pool.query(
    `SELECT id, title, brand, model
       FROM market_prices
      WHERE (normalized_name IS NULL OR normalized_name = '')
        AND title IS NOT NULL AND title <> ''
      ORDER BY id
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

// ── Write enriched values back to Neon ───────────────────────────────────────
async function updateRow(id, brand, model, storage, normalized_name) {
  await pool.query(
    `UPDATE market_prices
        SET brand           = $1,
            model           = $2,
            storage         = $3,
            normalized_name = $4
      WHERE id = $5`,
    [brand || '', model || '', storage || '', normalized_name || '', id]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  log('Enrichment backfill starting…', '✨');

  if (!process.env.GEMINI_API_KEY) {
    log('GEMINI_API_KEY is not set — backfill will run with classifier fallback only', '⚠');
  }

  let offset       = 0;
  let totalFetched = 0;
  let totalUpdated = 0;

  while (true) {
    const dbRows = await fetchBatch(offset);
    if (!dbRows.length) break;

    log(`Fetched ${dbRows.length} rows (offset ${offset}) — enriching…`, '📥');

    // enrichListings mutates the array in-place and returns it
    const enriched = await enrichListings(dbRows);

    let batchUpdated = 0;
    for (const row of enriched) {
      if (row.normalized_name) {
        await updateRow(row.id, row.brand, row.model, row.storage, row.normalized_name);
        batchUpdated++;
      }
    }

    log(`Batch updated ${batchUpdated}/${dbRows.length} rows in Neon`, '🐘');

    totalFetched += dbRows.length;
    totalUpdated += batchUpdated;
    offset       += dbRows.length;

    // Stop if we've hit MAX_ROWS cap
    if (MAX_ROWS > 0 && totalFetched >= MAX_ROWS) {
      log(`MAX_ROWS (${MAX_ROWS}) reached — stopping`, '🛑');
      break;
    }

    // Small pause between pages (be kind to Neon + Gemini rate limits)
    if (dbRows.length === FETCH_BATCH) {
      await new Promise(r => setTimeout(r, 500));
    } else {
      break; // last page was smaller than FETCH_BATCH — we're done
    }
  }

  await pool.end();
  log(`Backfill complete — ${totalFetched} rows processed, ${totalUpdated} updated`, '✅');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
