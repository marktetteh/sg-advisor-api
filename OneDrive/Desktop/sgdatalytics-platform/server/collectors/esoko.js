/**
 * SG Datalytics — Esoko Marketplace Commodity Price Collector
 * Fetches live agricultural commodity prices from the Esoko Ghana marketplace API.
 *
 * API:  https://digimakt-api.esoko.com/api/v1/products
 * Site: https://marketplace.esoko.com
 *
 * Run: node collectors/esoko.js
 */
require('dotenv').config();
const axios = require('axios');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const API_BASE = 'https://digimakt-api.esoko.com/api/v1';
const HEADERS  = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Origin':     'https://marketplace.esoko.com',
  'Referer':    'https://marketplace.esoko.com/',
  'Accept':     'application/json',
};

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const COMMODITY_HEADERS = [
  'scraped_date', 'week_number', 'year',
  'commodity_code', 'commodity_name', 'category',
  'market', 'region', 'price_ghs', 'unit', 'source',
];

// ── Derive a clean commodity code from product name ──────────
function toCommodityCode(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ── Fetch all products with valid prices ──────────────────────
async function fetchProducts() {
  let page = 1;
  const allProducts = [];

  while (true) {
    const { data } = await axios.get(`${API_BASE}/products`, {
      params:  { page, pageSize: 100 },
      headers: HEADERS,
      timeout: 20000,
    });

    const products = data?.data || [];
    if (!products.length) break;

    allProducts.push(...products);

    // Stop if no more pages
    if (!data?.pagination?.hasNextPage) break;
    page++;
  }

  // Filter out inactive products and zero-price entries
  return allProducts.filter(p =>
    p.isActive &&
    p.price &&
    parseFloat(p.price) > 0 &&
    p.name?.trim()
  );
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Esoko Commodity Price Collector            ║');
  console.log('  ║   Source: marketplace.esoko.com              ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today                  = getDateStr();
  const { week_number, year }  = getWeekAndYear();
  const weekStr                = getWeekStr(week_number, year);
  const rawFile                = getRawPath('commodities', `esoko_${weekStr}_${today}.csv`);
  const masterFile             = getMasterPath('commodity_prices.csv');

  log('Fetching products from Esoko API…', '▶');
  let products = [];
  try {
    products = await fetchProducts();
    log(`Retrieved ${products.length} products with valid prices`, '✓');
  } catch (err) {
    log(`Esoko API error: ${err.message}`, '❌');
    return { total: 0, saved: 0, neon: 0 };
  }

  // Build rows matching commodity_prices schema
  const rows = products.map(p => ({
    scraped_date:     today,
    week_number,
    year,
    commodity_code:   toCommodityCode(p.name),
    commodity_name:   p.name.trim(),
    category:         p.category || '',
    market:           p.location?.trim() || 'Esoko Marketplace',
    region:           p.location?.trim() || 'Ghana',
    price_ghs:        parseFloat(p.price),
    unit:             p.unit?.trim() || '',
    source:           'SG Datalytics Commodity Survey',
    collection_method:'esoko.com',
  }));

  // Log sample
  rows.slice(0, 5).forEach(r =>
    log(`${r.commodity_name.padEnd(30)} ${String(r.price_ghs).padEnd(10)} GHS / ${r.unit}`, '  ')
  );

  // Save raw snapshot
  appendCsv(rawFile, COMMODITY_HEADERS, rows);
  log(`Raw → ${rawFile} (${rows.length} rows)`, '💾');

  // Append new rows to master — deduplicate by commodity_code + market + week + year
  const masterSaved = appendNewToMaster(
    masterFile, COMMODITY_HEADERS, rows,
    ['commodity_code', 'market', 'week_number', 'year']
  );
  log(`Master commodity_prices.csv → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('commodity_prices', rows);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon commodity_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — writing fallback Excel`, '⚠');
    await writeFallbackExcel('commodity_prices', rows, COMMODITY_HEADERS);
  }
  await closeAllPools();

  log(`Esoko done — ${rows.length} prices · ${masterSaved} CSV · ${neonInserted} Neon`, '🌾');
  return { total: rows.length, saved: masterSaved, neon: neonInserted };
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
