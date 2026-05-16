/**
 * SG Datalytics — Neon Writer Utility  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helper used by all collectors to insert data directly into Neon.
 *
 * Exports:
 *   getMondayDate()                            → ISO "YYYY-MM-DD" for this week's Monday
 *   insertRows(table, rows [, overrideDate])   → batched upsert, returns { inserted, errors }
 *   writeFallbackExcel(dataset, rows, headers) → FALLBACK_[dataset]_[date].xlsx
 *   closeAllPools()                            → call when the process is done
 *
 * Table → Neon project mapping:
 *   market_prices         → NEON_MARKET_PRICES
 *   airbnb_prices         → NEON_ACCOMMODATION
 *   hotel_prices          → NEON_ACCOMMODATION
 *   property_prices       → NEON_PROPERTY
 *   economic_indicators   → NEON_ECONOMIC
 *   exchange_rates        → NEON_ECONOMIC
 *   commodity_prices      → NEON_COMMODITIES
 *   fuel_prices           → NEON_COMMODITIES
 *   gse_indices           → NEON_FINANCIALS
 *   stock_prices          → NEON_FINANCIALS
 */
require('dotenv').config();
const { Pool } = require('pg');
const path     = require('path');

const BATCH_SIZE = 100;
const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── Monday date (collected_date for all Neon rows) ────────────
function getMondayDate() {
  const today  = new Date();
  const day    = today.getDay();           // 0 = Sun, 1 = Mon … 6 = Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().split('T')[0];
}

// ── Connection pool cache (one per connection string) ─────────
const _pools = {};
function getPool(connStr) {
  if (!_pools[connStr]) {
    _pools[connStr] = new Pool({
      connectionString:        connStr,
      ssl:                     { rejectUnauthorized: false },
      max:                     3,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis:       30000,
    });
  }
  return _pools[connStr];
}

async function closeAllPools() {
  for (const [key, pool] of Object.entries(_pools)) {
    await pool.end().catch(() => {});
    delete _pools[key];   // ← remove from cache so next getPool() creates a fresh connection
  }
}

// ── Per-table config ──────────────────────────────────────────
// collected_date is ALWAYS the first column and is set to getMondayDate().
// dbCols / csvKeys are parallel arrays: csvKeys[i] from the row object maps
// to dbCols[i] in the INSERT statement.
const TABLE_CONFIG = {

  // ── NEON_MARKET_PRICES ──────────────────────────────────────
  market_prices: {
    envKey:       'NEON_MARKET_PRICES',
    conflictCols: ['source', 'listing_url'],
    dbCols:  ['week_number', 'year', 'source', 'product_category', 'search_label',
               'title', 'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
               'item_type', 'brand', 'model', 'storage', 'normalized_name'],
    csvKeys: ['week_number', 'year', 'source', 'product_category', 'search_label',
               'title', 'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
               'item_type', 'brand', 'model', 'storage', 'normalized_name'],
  },

  // ── NEON_ACCOMMODATION ──────────────────────────────────────
  airbnb_prices: {
    envKey:       'NEON_ACCOMMODATION',
    conflictCols: ['source', 'listing_id', 'week_number', 'year'],
    dbCols:  ['week_number', 'year', 'source', 'city', 'listing_id', 'listing_name',
               'room_type', 'price_raw', 'price_ghs', 'rating', 'review_count', 'listing_url'],
    csvKeys: ['week_number', 'year', 'source', 'city', 'listing_id', 'listing_name',
               'room_type', 'price_raw', 'price_ghs', 'rating', 'review_count', 'listing_url'],
  },

  hotel_prices: {
    envKey:       'NEON_ACCOMMODATION',
    // source_platform distinguishes booking.com vs hotels.com rows
    conflictCols: ['source_platform', 'city', 'hotel_name', 'week_number', 'year'],
    dbCols:  ['week_number', 'year', 'source', 'source_platform', 'city',
               'hotel_name', 'star_rating', 'stars',
               'review_score', 'review_count', 'price_raw', 'price_per_night_usd', 'hotel_url'],
    csvKeys: ['week_number', 'year', 'source', 'source_platform', 'city',
               'hotel_name', 'star_rating', 'stars',
               'review_score', 'review_count', 'price_raw', 'price_per_night_usd', 'hotel_url'],
  },

  // ── NEON_PROPERTY ───────────────────────────────────────────
  property_prices: {
    envKey:       'NEON_PROPERTY',
    conflictCols: ['source', 'listing_url', 'week_number', 'year'],
    dbCols:  ['week_number', 'year', 'source', 'property_type', 'listing_type',
               'title', 'price_raw', 'price_ghs', 'location',
               'bedrooms', 'bathrooms', 'size_sqm', 'listing_url'],
    csvKeys: ['week_number', 'year', 'source', 'property_type', 'listing_type',
               'title', 'price_raw', 'price_ghs', 'location',
               'bedrooms', 'bathrooms', 'size_sqm', 'listing_url'],
  },

  // ── NEON_ECONOMIC ───────────────────────────────────────────
  economic_indicators: {
    envKey:       'NEON_ECONOMIC',
    conflictCols: ['indicator_code', 'year', 'month'],
    dbCols:  ['year', 'month', 'indicator_code', 'indicator_name', 'sector', 'value', 'unit', 'source'],
    csvKeys: ['year', 'month', 'indicator_code', 'indicator_name', 'sector', 'value', 'unit', 'source'],
  },

  exchange_rates: {
    envKey:       'NEON_ECONOMIC',
    conflictCols: ['currency_pair', 'collected_date'],
    dbCols:  ['currency_pair', 'rate_ghs', 'source'],
    csvKeys: ['currency_pair', 'rate_ghs', 'source'],
  },

  // ── NEON_COMMODITIES ────────────────────────────────────────
  commodity_prices: {
    envKey:       'NEON_COMMODITIES',
    conflictCols: ['commodity_code', 'market', 'collected_date'],
    dbCols:  ['week_number', 'year', 'commodity_code', 'commodity_name',
               'market', 'region', 'price_ghs', 'unit', 'source'],
    csvKeys: ['week_number', 'year', 'commodity_code', 'commodity_name',
               'market', 'region', 'price_ghs', 'unit', 'source'],
  },

  fuel_prices: {
    envKey:       'NEON_COMMODITIES',
    conflictCols: ['fuel_type', 'collected_date'],
    dbCols:  ['week_number', 'year', 'fuel_type', 'price_ghs_per_litre', 'currency', 'source'],
    csvKeys: ['week_number', 'year', 'fuel_type', 'price_ghs_per_litre', 'currency', 'source'],
  },

  // ── NEON_FINANCIALS ─────────────────────────────────────────
  gse_indices: {
    envKey:       'NEON_FINANCIALS',
    conflictCols: ['index_name', 'collected_date'],
    dbCols:  ['week_number', 'year', 'index_name', 'value', 'change_points', 'change_pct', 'source'],
    csvKeys: ['week_number', 'year', 'index_name', 'value', 'change_points', 'change_pct', 'source'],
  },

  stock_prices: {
    envKey:       'NEON_FINANCIALS',
    conflictCols: ['symbol', 'collected_date'],
    dbCols:  ['week_number', 'year', 'symbol', 'company_name',
               'opening_price_ghs', 'closing_price_ghs', 'change_ghs', 'change_pct',
               'volume', 'value_ghs', 'year_high', 'year_low', 'source'],
    csvKeys: ['week_number', 'year', 'symbol', 'company_name',
               'opening_price_ghs', 'closing_price_ghs', 'change_ghs', 'change_pct',
               'volume', 'value_ghs', 'year_high', 'year_low', 'source'],
  },
};

// ── Core insert function ──────────────────────────────────────
/**
 * Batched INSERT … ON CONFLICT DO NOTHING into a Neon table.
 *
 * @param  {string}   table          One of the keys in TABLE_CONFIG above
 * @param  {object[]} rows           Plain row objects (CSV key names)
 * @param  {string}   [overrideDate] ISO date to use as collected_date (default: this Monday)
 * @returns {{ inserted: number, errors: string[] }}
 */
async function insertRows(table, rows, overrideDate) {
  const config = TABLE_CONFIG[table];
  if (!config) throw new Error(`neon-writer: unknown table "${table}"`);

  const connStr = process.env[config.envKey];
  if (!connStr) {
    log(`${config.envKey} not set in .env — skipping Neon insert for ${table}`, '⚠');
    return { inserted: 0, errors: [`${config.envKey} not configured`] };
  }
  if (!rows.length) return { inserted: 0, errors: [] };

  const monday            = overrideDate || getMondayDate();
  const { dbCols, csvKeys, conflictCols } = config;
  const allDbCols         = ['collected_date', ...dbCols];
  const colList           = allDbCols.join(', ');
  const conflictClause    = `ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`;
  const pool              = getPool(connStr);

  let inserted = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch  = rows.slice(i, i + BATCH_SIZE);
    const values = [];

    const placeholders = batch.map((row, ri) => {
      const offset = ri * allDbCols.length;
      values.push(monday);                         // collected_date
      for (const key of csvKeys) {
        const v = row[key];
        values.push((v === '' || v === undefined) ? null : v);
      }
      return `(${allDbCols.map((_, ci) => `$${offset + ci + 1}`).join(', ')})`;
    });

    const sql = [
      `INSERT INTO ${table} (${colList})`,
      `VALUES ${placeholders.join(', ')}`,
      conflictClause,
    ].join(' ');

    try {
      const res = await pool.query(sql, values);
      inserted += res.rowCount;
    } catch (err) {
      errors.push(`batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message.split('\n')[0]}`);
    }
  }

  return { inserted, errors };
}

// ── Fallback Excel writer ─────────────────────────────────────
/**
 * Writes a fallback Excel file when Neon insert fails.
 * Filename: FALLBACK_[dataset]_[YYYY-MM-DD].xlsx  (in DATA_DIR root)
 *
 * @param {string}   dataset  Short name, e.g. "market_prices"
 * @param {object[]} rows     Array of row objects
 * @param {string[]} headers  CSV-style header array (column order)
 * @returns {string|null}     Absolute path of written file, or null on error
 */
async function writeFallbackExcel(dataset, rows, headers) {
  try {
    const XLSX = require('xlsx');  // loaded on-demand so non-xlsx runs aren't impacted
    const date  = new Date().toISOString().split('T')[0];
    const fname = `FALLBACK_${dataset}_${date}.xlsx`;

    const dataDir = process.env.DATA_DIR ||
      path.join('C:', 'Users', process.env.USERNAME || 'markt',
                'OneDrive', 'Desktop', 'sgdatalytics-data');

    const fpath  = path.join(dataDir, fname);
    const wsData = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
    const ws     = XLSX.utils.aoa_to_sheet(wsData);
    const wb     = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dataset.substring(0, 31));
    XLSX.writeFile(wb, fpath);

    log(`Fallback Excel saved → ${fpath} (${rows.length} rows)`, '📊');
    return fpath;
  } catch (err) {
    log(`Fallback Excel write failed: ${err.message}`, '❌');
    return null;
  }
}

module.exports = { getMondayDate, insertRows, writeFallbackExcel, closeAllPools };
