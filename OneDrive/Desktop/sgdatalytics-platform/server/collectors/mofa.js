/**
 * SG Datalytics — MoFA Agricultural Price Collector
 * Tries to scrape MoFA Ghana → falls back to expanded baseline estimates
 * Writes to commodity_prices.csv master file
 *
 * Run: node collectors/mofa.js
 */
require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const { COMMODITIES } = require('./config');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const MOFA_URLS = [
  'https://mofa.gov.gh/site/food-prices',
  'https://mofa.gov.gh/site/directorates/statistics-research-and-information-directorate-srid',
];

const HEADERS_COMMOD = [
  'date', 'week_number', 'year', 'commodity_code', 'commodity_name',
  'market', 'region', 'price_ghs', 'unit', 'source',
];

// Keyword → commodity lookup (for live scraping)
const COMMODITY_MAP = {
  'maize':          { code: 'MAIZE',          name: 'Maize',           unit: '50kg bag' },
  'corn':           { code: 'MAIZE',          name: 'Maize',           unit: '50kg bag' },
  'rice (local)':   { code: 'RICE_LOCAL',     name: 'Rice (Local)',    unit: '50kg bag' },
  'local rice':     { code: 'RICE_LOCAL',     name: 'Rice (Local)',    unit: '50kg bag' },
  'rice (import':   { code: 'RICE_IMPORTED',  name: 'Rice (Imported)', unit: '50kg bag' },
  'imported rice':  { code: 'RICE_IMPORTED',  name: 'Rice (Imported)', unit: '50kg bag' },
  'foreign rice':   { code: 'RICE_IMPORTED',  name: 'Rice (Imported)', unit: '50kg bag' },
  'millet':         { code: 'MILLET',         name: 'Millet',          unit: '50kg bag' },
  'sorghum':        { code: 'SORGHUM',        name: 'Sorghum',         unit: '50kg bag' },
  'soybean':        { code: 'SOYBEAN',        name: 'Soybeans',        unit: '50kg bag' },
  'groundnut':      { code: 'GROUNDNUT',      name: 'Groundnuts',      unit: '50kg bag' },
  'cowpea':         { code: 'COWPEA',         name: 'Cowpea (Beans)',  unit: '50kg bag' },
  'cassava':        { code: 'CASSAVA',        name: 'Cassava',         unit: '50kg bag' },
  'yam':            { code: 'YAM',            name: 'Yam',             unit: 'tuber'    },
  'cocoyam':        { code: 'COCOYAM',        name: 'Cocoyam',         unit: '50kg bag' },
  'plantain':       { code: 'PLANTAIN',       name: 'Plantain',        unit: 'bunch'    },
  'tomato':         { code: 'TOMATO',         name: 'Tomatoes',        unit: 'crate'    },
  'onion':          { code: 'ONION',          name: 'Onions',          unit: 'bag'      },
  'pepper':         { code: 'PEPPER',         name: 'Pepper',          unit: 'bag'      },
  'palm oil':       { code: 'PALM_OIL',       name: 'Palm Oil',        unit: 'litre'    },
};

const REGIONS = [
  'Greater Accra', 'Ashanti', 'Northern', 'Western', 'Eastern',
  'Central', 'Volta', 'Upper East', 'Upper West',
  'Bono', 'Ahafo', 'Oti', 'Savannah', 'North East', 'Western North',
];

function detectCommodity(text) {
  const lower = text.toLowerCase().trim();
  for (const [key, meta] of Object.entries(COMMODITY_MAP)) {
    if (lower.includes(key)) return meta;
  }
  return null;
}

function detectRegion(text) {
  const lower = text.toLowerCase();
  return REGIONS.find(r => lower.includes(r.toLowerCase())) || 'Ghana';
}

// ── Try to scrape live MoFA data ──────────────────────────────
async function scrapeMoFA(today, week_number, year) {
  log('Attempting live scrape from MoFA Ghana…', '▶');
  const rows = [];

  for (const url of MOFA_URLS) {
    try {
      const resp = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 20000,
      });
      const $ = cheerio.load(resp.data);

      $('table').each((_, table) => {
        const headerCells = $(table).find('th').map((_, el) => $(el).text().trim().toLowerCase()).get();
        const hasPriceCol = headerCells.some(h => h.includes('price') || h.includes('ghs') || h.includes('cedis'));
        if (!hasPriceCol) return;

        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 3) return;
          const col0 = $(cells[0]).text().trim();
          const col1 = $(cells[1]).text().trim();
          const col2 = $(cells[2]).text().trim();

          const meta  = detectCommodity(col0);
          if (!meta) return;
          const price = parseFloat(col2.replace(/[^0-9.]/g, ''));
          if (isNaN(price) || price <= 0) return;

          rows.push({
            date: today, week_number, year,
            commodity_code: meta.code,
            commodity_name: meta.name,
            market:   col1 || 'National',
            region:   detectRegion(col1),
            price_ghs: price,
            unit:     meta.unit,
            source:   'MoFA',
          });
          log(`${meta.name} · ${col1} → GHS ${price}`, '  ✓');
        });
      });

      if (rows.length > 0) {
        log(`Live MoFA data: ${rows.length} prices`, '✓');
        return rows;
      }
    } catch (err) {
      log(`  ${url.split('/').pop()}: ${err.message}`, '  –');
    }
  }

  return rows;
}

// ── Build from expanded config COMMODITIES list ───────────────
// Used when MoFA site is unavailable (SSL expired, 404, etc.)
function buildFromConfig(today, week_number, year) {
  log('MoFA live scrape failed — using expanded baseline estimates', '⚠');
  return COMMODITIES.map(c => ({
    date:           today,
    week_number,
    year,
    commodity_code: c.code,
    commodity_name: c.name,
    market:         c.market,
    region:         c.region,
    price_ghs:      c.price,
    unit:           c.unit,
    source:         'MoFA-Estimate',
  }));
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   MoFA Agricultural Price Collector          ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today              = getDateStr();
  const { week_number, year } = getWeekAndYear();
  const weekStr            = getWeekStr(week_number, year);
  const rawFile            = getRawPath('commodities', `mofa_${weekStr}_${today}.csv`);
  const masterFile         = getMasterPath('commodity_prices.csv');

  let rows = await scrapeMoFA(today, week_number, year);
  if (rows.length === 0) rows = buildFromConfig(today, week_number, year);

  // Save raw snapshot
  appendCsv(rawFile, HEADERS_COMMOD, rows);
  log(`Raw file → ${rawFile} (${rows.length} rows)`, '💾');

  // Append new to master — deduplicate by commodity_code + market + week + year
  const masterSaved = appendNewToMaster(
    masterFile, HEADERS_COMMOD, rows,
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
    log(`Neon insert failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('commodity_prices', rows, HEADERS_COMMOD);
  }
  await closeAllPools();

  const liveCount = rows.filter(r => r.source === 'MoFA').length;
  const estCount  = rows.filter(r => r.source === 'MoFA-Estimate').length;
  log(`MoFA done — ${liveCount} live · ${estCount} estimated · ${masterSaved} CSV · ${neonInserted} Neon`, '🌾');

  return { total: rows.length, saved: masterSaved, neon: neonInserted, live: liveCount };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('commodity_prices', rows, HEADERS_COMMOD);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
