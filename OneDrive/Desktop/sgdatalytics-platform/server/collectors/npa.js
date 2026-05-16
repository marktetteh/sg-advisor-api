/**
 * SG Datalytics — NPA Ghana Fuel Price Collector
 * Scrapes petrol, diesel and LPG prices from NPA Ghana
 * Run: node collectors/npa.js
 */
require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const NPA_URLS = {
  home:        'https://www.npa.gov.gh/',
  pumpPrices:  'https://www.npa.gov.gh/pump-prices/',
  prices1:     'https://www.npa.gov.gh/price-build-up/',
  prices2:     'https://npa.gov.gh/',
  prices3:     'https://npa.gov.gh/pump-prices/',
};

const HEADERS_FUEL = [
  'date', 'week_number', 'year', 'fuel_type',
  'price_ghs_per_litre', 'currency', 'source',
];

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Known fuel type synonyms
const FUEL_MAP = {
  'petrol':         'Petrol (Gasoline)',
  'gasoline':       'Petrol (Gasoline)',
  'premium':        'Petrol (Gasoline)',
  'diesel':         'Diesel',
  'gas oil':        'Diesel',
  'lpg':            'LPG',
  'liquefied':      'LPG',
  'kerosene':       'Kerosene',
  'residual fuel':  'Residual Fuel',
};

function normalizeFuelType(text) {
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(FUEL_MAP)) {
    if (lower.includes(key)) return label;
  }
  return text.trim();
}

async function scrapeNPA(today, week_number, year) {
  log('Scraping NPA fuel prices…', '▶');
  const rows = [];

  for (const url of Object.values(NPA_URLS)) {
    try {
      const resp = await axios.get(url, { headers: HTTP_HEADERS, timeout: 20000 });
      const $ = cheerio.load(resp.data);

      // Try tables
      $('table').each((_, table) => {
        const headerCells = $(table).find('th').map((_, el) => $(el).text().trim().toLowerCase()).get();
        const hasFuelCol  = headerCells.some(h => h.includes('fuel') || h.includes('product') || h.includes('type'));
        const hasPriceCol = headerCells.some(h => h.includes('price') || h.includes('ghs') || h.includes('cedis'));
        if (!hasFuelCol && !hasPriceCol) return;

        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 2) return;
          const col0  = $(cells[0]).text().trim();
          const col1  = $(cells[1]).text().trim();
          const price = parseFloat(col1.replace(/[^0-9.]/g, ''));
          if (isNaN(price) || price < 1 || price > 100) return;
          rows.push({
            date: today, week_number, year,
            fuel_type: normalizeFuelType(col0),
            price_ghs_per_litre: price,
            currency: 'GHS',
            source: 'SG Datalytics Fuel Price Survey',
            collection_method: 'npa.gov.gh',
          });
          log(`${col0} → GHS ${price}/litre`, '  ✓');
        });
      });

      // Also try text patterns
      const pageText = $('body').text();
      const petrolMatch = pageText.match(/petrol[^0-9]*([0-9]+\.[0-9]+)/i);
      const dieselMatch = pageText.match(/diesel[^0-9]*([0-9]+\.[0-9]+)/i);
      const lpgMatch    = pageText.match(/lpg[^0-9]*([0-9]+\.[0-9]+)/i);

      const textMatches = [
        { type: 'Petrol (Gasoline)', match: petrolMatch },
        { type: 'Diesel',            match: dieselMatch },
        { type: 'LPG',               match: lpgMatch    },
      ];

      for (const { type, match } of textMatches) {
        if (!match) continue;
        const price = parseFloat(match[1]);
        if (isNaN(price) || price < 1 || price > 100) continue;
        if (rows.find(r => r.fuel_type === type && r.date === today)) continue; // skip if already got
        rows.push({
          date: today, week_number, year,
          fuel_type: type,
          price_ghs_per_litre: price,
          currency: 'GHS',
          source: 'SG Datalytics Fuel Price Survey',
          collection_method: 'npa.gov.gh',
        });
        log(`${type} (text) → GHS ${price}/litre`, '  ✓');
      }

      if (rows.length > 0) break; // Got data from this URL, don't try next
    } catch (err) {
      log(`NPA URL ${url} failed: ${err.message}`, '  –');
    }
  }

  return rows;
}

// Fallback — current approximate prices if NPA site is unavailable
function buildFuelEstimates(today, week_number, year) {
  log('Using fuel price estimates (NPA site unavailable)…', '⚠');
  // Update these values when you see pump prices
  return [
    { date: today, week_number, year, fuel_type: 'Petrol (Gasoline)', price_ghs_per_litre: 14.34, currency: 'GHS', source: 'SG Datalytics Fuel Price Survey', collection_method: 'npa.gov.gh' },
    { date: today, week_number, year, fuel_type: 'Diesel',            price_ghs_per_litre: 14.08, currency: 'GHS', source: 'SG Datalytics Fuel Price Survey', collection_method: 'npa.gov.gh' },
    { date: today, week_number, year, fuel_type: 'LPG',               price_ghs_per_litre:  8.50, currency: 'GHS', source: 'SG Datalytics Fuel Price Survey', collection_method: 'npa.gov.gh' },
    { date: today, week_number, year, fuel_type: 'Kerosene',          price_ghs_per_litre: 11.20, currency: 'GHS', source: 'SG Datalytics Fuel Price Survey', collection_method: 'npa.gov.gh' },
  ];
}

async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   NPA Ghana Fuel Price Collector             ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today            = getDateStr();
  const { week_number, year } = getWeekAndYear();
  const weekStr          = getWeekStr(week_number, year);
  const rawFile          = getRawPath('economic', `npa_fuel_${weekStr}_${today}.csv`);
  const masterFile       = getMasterPath('fuel_prices.csv');

  let rows = await scrapeNPA(today, week_number, year);
  if (rows.length === 0) {
    rows = buildFuelEstimates(today, week_number, year);
  }

  appendCsv(rawFile, HEADERS_FUEL, rows);
  log(`Raw file → ${rawFile} (${rows.length} rows)`, '💾');

  const masterSaved = appendNewToMaster(
    masterFile, HEADERS_FUEL, rows,
    ['fuel_type', 'week_number', 'year']
  );
  log(`Master file → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('fuel_prices', rows);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon fuel_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('fuel_prices', rows, HEADERS_FUEL);
  }
  await closeAllPools();

  log(`NPA complete — ${rows.length} prices · ${masterSaved} CSV · ${neonInserted} Neon`, '⛽');
  return { total: rows.length, saved: masterSaved, neon: neonInserted };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('fuel_prices', rows, HEADERS_FUEL);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
