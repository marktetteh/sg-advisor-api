/**
 * SG Datalytics — Neon PostgreSQL Migration  (Phase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads all 10 master CSV files and inserts into the correct Neon tables.
 * Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
 *
 * Run:
 *   node db/migrate.js
 *
 * Source files (from DATA_DIR/master/):
 *   airbnb_prices.csv       → NEON_ACCOMMODATION  → airbnb_prices
 *   commodity_prices.csv    → NEON_COMMODITIES    → commodity_prices
 *   economic_indicators.csv → NEON_ECONOMIC       → economic_indicators
 *   exchange_rates.csv      → NEON_ECONOMIC       → exchange_rates
 *   fuel_prices.csv         → NEON_COMMODITIES    → fuel_prices
 *   gse_indices.csv         → NEON_FINANCIALS     → gse_indices
 *   hotel_prices.csv        → NEON_ACCOMMODATION  → hotel_prices
 *   market_prices.csv       → NEON_MARKET_PRICES  → market_prices
 *   property_prices.csv     → NEON_PROPERTY       → property_prices
 *   stock_prices.csv        → NEON_FINANCIALS     → stock_prices
 */
require('dotenv').config();
const { Pool }       = require('pg');
const { readCsv, getMasterPath } = require('../collectors/csv-utils');

const COLLECTED_DATE = '2026-05-05';   // fixed migration date applied to all rows
const BATCH_SIZE     = 100;            // rows per INSERT statement

const log  = (msg, sym = '→') => console.log(`  ${sym} ${msg}`);
const pad  = (n, w = 6)       => String(n).padStart(w);

// ── Data cleaners ─────────────────────────────────────────────

// Extract leading float from strings like "5.0 out of 5 average rating..."
// Returns null for non-numeric text ("New place to stay", empty, etc.)
function parseLeadingFloat(str) {
  if (!str) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// Extract review count from Airbnb rating string:
// "5.0 out of 5 average rating,  15 reviews5.0 (15)" → 15
// Falls back to the review_count column if already numeric
function parseReviewCount(ratingStr, reviewCountStr) {
  if (reviewCountStr && !isNaN(parseInt(reviewCountStr))) return parseInt(reviewCountStr);
  if (!ratingStr) return null;
  const m = ratingStr.match(/(\d+)\s+review/i);
  return m ? parseInt(m[1]) : null;
}

// Coerce hotel review_score: accept numbers, reject label strings
// "Good", "Very good", "Review score", "" → null
// "8.5", "9.0" → 8.5 / 9.0
function parseReviewScore(str) {
  if (!str) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// ── Pool factory ──────────────────────────────────────────────
function makePool(envKey) {
  const cs = process.env[envKey];
  if (!cs) throw new Error(`${envKey} not set in .env`);
  return new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15000,
  });
}

// ── Generic batched INSERT ────────────────────────────────────
// cols:         ordered DB column names (must match keys in each row object)
// conflictCols: columns that form the UNIQUE constraint (for DO NOTHING)
async function batchInsert(client, table, cols, rows, conflictCols) {
  if (!rows.length) return 0;

  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch  = rows.slice(i, i + BATCH_SIZE);
    const nCols  = cols.length;

    // Build ($1,$2,...), ($n+1,...) placeholder groups
    const valuePlaceholders = batch.map((_, bi) =>
      '(' + cols.map((_, ci) => `$${bi * nCols + ci + 1}`).join(', ') + ')'
    ).join(', ');

    // Flatten values in column order
    const values = batch.flatMap(row => cols.map(col => {
      const v = row[col];
      return (v === '' || v === undefined) ? null : v;
    }));

    const sql = `
      INSERT INTO ${table} (${cols.join(', ')})
      VALUES ${valuePlaceholders}
      ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING
    `;

    const result = await client.query(sql, values);
    inserted += result.rowCount;
  }

  return inserted;
}

// ── Column maps — CSV key → DB column name ────────────────────
// Each entry: { dbCol, csvCol }
// csvCol defaults to dbCol when omitted (most columns match exactly).
// All tables receive `collected_date` set to COLLECTED_DATE (not from CSV).

function buildRows(csvRows, colMap) {
  return csvRows.map(r => {
    const obj = { collected_date: COLLECTED_DATE };
    for (const { dbCol, csvCol } of colMap) {
      obj[dbCol] = r[csvCol ?? dbCol] ?? null;
    }
    return obj;
  });
}

// ── TABLE DEFINITIONS ─────────────────────────────────────────

const TABLES = {

  // ── airbnb_prices ────────────────────────────────────────────
  airbnb_prices: {
    envKey:  'NEON_ACCOMMODATION',
    csvFile: 'airbnb_prices.csv',
    // CSV: scraped_date, week_number, year, source, city, listing_id,
    //      listing_name, room_type, price_raw, price_ghs, rating, review_count, listing_url
    // listing_id is extracted from listing_url in the ROW_CLEANER below
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'source' },
      { dbCol: 'city' },
      { dbCol: 'listing_id' },
      { dbCol: 'listing_name' },
      { dbCol: 'room_type' },
      { dbCol: 'price_raw' },
      { dbCol: 'price_ghs' },
      { dbCol: 'rating' },
      { dbCol: 'review_count' },
      { dbCol: 'listing_url' },
    ],
    conflict: ['source', 'listing_id', 'week_number', 'year'],
  },

  // ── hotel_prices ─────────────────────────────────────────────
  hotel_prices: {
    envKey:  'NEON_ACCOMMODATION',
    csvFile: 'hotel_prices.csv',
    // CSV: scraped_date, week_number, year, source, city, hotel_name,
    //      stars, review_score, review_count, price_raw, price_per_night_usd, hotel_url
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'source' },
      { dbCol: 'city' },
      { dbCol: 'hotel_name' },
      { dbCol: 'stars' },
      { dbCol: 'review_score' },
      { dbCol: 'review_count' },
      { dbCol: 'price_raw' },
      { dbCol: 'price_per_night_usd' },
      { dbCol: 'hotel_url' },
    ],
    conflict: ['source', 'city', 'hotel_name', 'week_number', 'year'],
  },

  // ── commodity_prices ─────────────────────────────────────────
  commodity_prices: {
    envKey:  'NEON_COMMODITIES',
    csvFile: 'commodity_prices.csv',
    // CSV: date, week_number, year, commodity_code, commodity_name,
    //      market, region, price_ghs, unit, source
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'commodity_code' },
      { dbCol: 'commodity_name' },
      { dbCol: 'market' },
      { dbCol: 'region' },
      { dbCol: 'price_ghs' },
      { dbCol: 'unit' },
      { dbCol: 'source' },
    ],
    conflict: ['commodity_code', 'market', 'collected_date'],
  },

  // ── fuel_prices ───────────────────────────────────────────────
  fuel_prices: {
    envKey:  'NEON_COMMODITIES',
    csvFile: 'fuel_prices.csv',
    // CSV: date, week_number, year, fuel_type, price_ghs_per_litre, currency, source
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'fuel_type' },
      { dbCol: 'price_ghs_per_litre' },
      { dbCol: 'currency' },
      { dbCol: 'source' },
    ],
    conflict: ['fuel_type', 'collected_date'],
  },

  // ── economic_indicators ───────────────────────────────────────
  economic_indicators: {
    envKey:  'NEON_ECONOMIC',
    csvFile: 'economic_indicators.csv',
    // CSV: fetched_date, year, month, indicator_code, indicator_name,
    //      sector, value, unit, source
    colMap: [
      { dbCol: 'year' },
      { dbCol: 'month' },
      { dbCol: 'indicator_code' },
      { dbCol: 'indicator_name' },
      { dbCol: 'sector' },
      { dbCol: 'value' },
      { dbCol: 'unit' },
      { dbCol: 'source' },
    ],
    conflict: ['indicator_code', 'year', 'month'],
  },

  // ── exchange_rates ────────────────────────────────────────────
  exchange_rates: {
    envKey:  'NEON_ECONOMIC',
    csvFile: 'exchange_rates.csv',
    // CSV: date, currency_pair, rate_ghs, source
    colMap: [
      { dbCol: 'currency_pair' },
      { dbCol: 'rate_ghs' },
      { dbCol: 'source' },
    ],
    conflict: ['currency_pair', 'collected_date'],
  },

  // ── gse_indices ───────────────────────────────────────────────
  gse_indices: {
    envKey:  'NEON_FINANCIALS',
    csvFile: 'gse_indices.csv',
    // CSV: date, week_number, year, index_name, value,
    //      change_points, change_pct, source
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'index_name' },
      { dbCol: 'value' },
      { dbCol: 'change_points' },
      { dbCol: 'change_pct' },
      { dbCol: 'source' },
    ],
    conflict: ['index_name', 'collected_date'],
  },

  // ── stock_prices ──────────────────────────────────────────────
  stock_prices: {
    envKey:  'NEON_FINANCIALS',
    csvFile: 'stock_prices.csv',
    // CSV: date, week_number, year, symbol, company_name,
    //      opening_price_ghs, closing_price_ghs, change_ghs, change_pct,
    //      volume, value_ghs, year_high, year_low, source
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'symbol' },
      { dbCol: 'company_name' },
      { dbCol: 'opening_price_ghs' },
      { dbCol: 'closing_price_ghs' },
      { dbCol: 'change_ghs' },
      { dbCol: 'change_pct' },
      { dbCol: 'volume' },
      { dbCol: 'value_ghs' },
      { dbCol: 'year_high' },
      { dbCol: 'year_low' },
      { dbCol: 'source' },
    ],
    conflict: ['symbol', 'collected_date'],
  },

  // ── market_prices ─────────────────────────────────────────────
  market_prices: {
    envKey:  'NEON_MARKET_PRICES',
    csvFile: 'market_prices.csv',
    // CSV: scraped_date, week_number, year, source, product_category,
    //      search_label, title, price_raw, price_ghs, location, condition, listing_url
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'source' },
      { dbCol: 'product_category' },
      { dbCol: 'search_label' },
      { dbCol: 'title' },
      { dbCol: 'price_raw' },
      { dbCol: 'price_ghs' },
      { dbCol: 'location' },
      { dbCol: 'condition' },
      { dbCol: 'listing_url' },
    ],
    conflict: ['source', 'listing_url'],
  },

  // ── property_prices ───────────────────────────────────────────
  property_prices: {
    envKey:  'NEON_PROPERTY',
    csvFile: 'property_prices.csv',
    // CSV: scraped_date, week_number, year, source, property_type,
    //      listing_type, title, price_raw, price_ghs, location,
    //      bedrooms, bathrooms, size_sqm, listing_url
    colMap: [
      { dbCol: 'week_number' },
      { dbCol: 'year' },
      { dbCol: 'source' },
      { dbCol: 'property_type' },
      { dbCol: 'listing_type' },
      { dbCol: 'title' },
      { dbCol: 'price_raw' },
      { dbCol: 'price_ghs' },
      { dbCol: 'location' },
      { dbCol: 'bedrooms' },
      { dbCol: 'bathrooms' },
      { dbCol: 'size_sqm' },
      { dbCol: 'listing_url' },
    ],
    conflict: ['source', 'listing_url', 'week_number', 'year'],
  },
};

// ── Per-table row cleaners ────────────────────────────────────
// Applied AFTER buildRows — receives the mapped DB row object, returns it cleaned.
// Return null to drop the row entirely.

const ROW_CLEANERS = {

  // airbnb: parse rating float + review count from long label strings,
  //         and backfill listing_id from listing_url for pre-existing CSV rows.
  // rating CSV value: "5.0 out of 5 average rating,  15 reviews5.0 (15)"
  airbnb_prices: (row) => {
    // Backfill listing_id from URL if the CSV column is missing/empty
    if (!row.listing_id && row.listing_url) {
      const m = row.listing_url.match(/\/rooms\/(\d+)/);
      row.listing_id = m ? m[1] : null;
    }
    // Drop rows with no usable listing_id (no URL or non-/rooms/ URL)
    if (!row.listing_id) return null;

    const rawRating  = row.rating;
    row.rating       = parseLeadingFloat(rawRating);
    row.review_count = parseReviewCount(rawRating, row.review_count);
    return row;
  },

  // hotel: coerce text review_score labels to null
  hotel_prices: (row) => {
    row.review_score = parseReviewScore(row.review_score);
    row.stars        = parseLeadingFloat(row.stars);
    return row;
  },

  // market: drop rows where week_number is corrupted (non-integer due to CSV misalignment)
  // Use Number() not parseInt() — parseInt("700gh,...") returns 700, Number() returns NaN
  market_prices: (row) => {
    if (!row.week_number || isNaN(Number(row.week_number))) return null;
    if (!row.year        || isNaN(Number(row.year)))        return null;
    return row;
  },
};

// ── Migrate one table ─────────────────────────────────────────
async function migrateTable(tableName, def) {
  const csvPath = getMasterPath(def.csvFile);
  const csvRows = readCsv(csvPath);

  if (!csvRows.length) {
    log(`${tableName.padEnd(22)} — CSV empty, skipping`, '⚠');
    return { table: tableName, csvRows: 0, inserted: 0, skipped: 0 };
  }

  // Map CSV rows → DB rows (with collected_date added)
  let dbRows = buildRows(csvRows, def.colMap);
  const dbCols = ['collected_date', ...def.colMap.map(c => c.dbCol)];

  // Apply per-table cleaner (filter + transform)
  const cleaner = ROW_CLEANERS[tableName];
  if (cleaner) {
    const before = dbRows.length;
    dbRows = dbRows.map(cleaner).filter(Boolean);
    const dropped = before - dbRows.length;
    if (dropped > 0) log(`${tableName.padEnd(22)} — dropped ${dropped} malformed rows`, '⚠');
  }

  const pool   = makePool(def.envKey);
  const client = await pool.connect();

  try {
    log(`${tableName.padEnd(22)} — ${pad(csvRows.length)} CSV rows → inserting…`, '▶');

    const inserted = await batchInsert(client, tableName, dbCols, dbRows, def.conflict);
    const skipped  = csvRows.length - inserted;

    log(
      `${tableName.padEnd(22)} — ${pad(inserted)} inserted, ${pad(skipped)} skipped (duplicates)`,
      inserted > 0 ? '✓' : '–'
    );

    return { table: tableName, csvRows: csvRows.length, inserted, skipped };

  } catch (err) {
    log(`${tableName.padEnd(22)} — ERROR: ${err.message}`, '❌');
    return { table: tableName, csvRows: csvRows.length, inserted: 0, skipped: 0, error: err.message };
  } finally {
    client.release();
    await pool.end();
  }
}

// ── MAIN ─────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Neon Migration (Phase 2)           ║');
  console.log(`  ║   collected_date = ${COLLECTED_DATE}  ·  batch = ${BATCH_SIZE} rows       ║`);
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  10 CSV files  →  6 Neon databases  →  10 tables     ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  const results = [];
  const start   = Date.now();

  // Run in the order that groups same-DB tables together
  // (avoids opening/closing the same pool repeatedly for ACCOMMODATION, etc.)
  const order = [
    'airbnb_prices',
    'hotel_prices',
    'commodity_prices',
    'fuel_prices',
    'economic_indicators',
    'exchange_rates',
    'gse_indices',
    'stock_prices',
    'property_prices',
    'market_prices',     // largest — last
  ];

  for (const table of order) {
    const result = await migrateTable(table, TABLES[table]);
    results.push(result);
    console.log();
  }

  // ── Summary ───────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   Migration Summary                                  ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');

  let totalCsv = 0, totalIns = 0, totalSkip = 0, hasErrors = false;

  for (const r of results) {
    totalCsv  += r.csvRows;
    totalIns  += r.inserted;
    totalSkip += r.skipped;
    if (r.error) hasErrors = true;

    const status = r.error ? '❌' : (r.inserted > 0 ? '✓' : '–');
    const detail = r.error
      ? r.error.slice(0, 28)
      : `${pad(r.inserted,5)} ins  ${pad(r.skipped,5)} skip`;

    console.log(`  ║  ${status} ${r.table.padEnd(22)} ${detail.padEnd(25)} ║`);
  }

  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Total CSV rows : ${pad(totalCsv, 6)}`.padEnd(55) + '║');
  console.log(`  ║  Inserted       : ${pad(totalIns, 6)}`.padEnd(55) + '║');
  console.log(`  ║  Skipped (dups) : ${pad(totalSkip, 6)}`.padEnd(55) + '║');
  console.log(`  ║  Time           : ${elapsed}s`.padEnd(55) + '║');
  console.log('  ╚══════════════════════════════════════════════════════╝');

  if (!hasErrors) {
    console.log('\n  ✅  Phase 2 complete — all data migrated to Neon.\n');
    console.log('  Next step:');
    console.log('    Phase 3 — Update collectors to write directly to Neon\n');
  } else {
    console.log('\n  ⚠   Migration finished with errors. Check output above.\n');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exit(1);
});
