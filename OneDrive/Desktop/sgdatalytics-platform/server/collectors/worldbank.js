/**
 * SG Datalytics — World Bank Collector
 * Fetches all WB indicators for Ghana (2000–present) → saves to local CSV
 * Run: node collectors/worldbank.js
 */
require('dotenv').config();
const axios = require('axios');
const { INDICATORS } = require('./config');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getMonthStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const WB_BASE   = 'https://api.worldbank.org/v2';
const COUNTRY   = 'GH';
const YEAR_FROM = 2000;
const YEAR_TO   = new Date().getFullYear();
const log       = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const WB_INDICATORS = INDICATORS.filter(i => i.source === 'World Bank' && i.wb_code);

// Standard header — must match across all collectors
const EI_HEADERS = [
  'fetched_date', 'year', 'month', 'indicator_code', 'indicator_name',
  'sector', 'value', 'unit', 'source',
];

async function fetchWB(wbCode) {
  const url    = `${WB_BASE}/country/${COUNTRY}/indicator/${wbCode}`;
  const params = { format: 'json', per_page: 60, date: `${YEAR_FROM}:${YEAR_TO}` };
  const resp   = await axios.get(url, { params, timeout: 15000 });
  const data   = resp.data;
  if (!Array.isArray(data) || data.length < 2 || !data[1]) return [];
  return data[1]
    .filter(d => d.value !== null && d.value !== undefined)
    .map(d => ({ year: parseInt(d.date), value: parseFloat(d.value) }));
}

async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   World Bank Collector — Ghana               ║');
  console.log(`  ║   ${WB_INDICATORS.length} indicators · ${YEAR_FROM}–${YEAR_TO}              ║`);
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();

  const dateStr    = getDateStr();
  const monthStr   = getMonthStr();
  const rawFile    = getRawPath('economic', `worldbank_${monthStr}.csv`);
  const masterFile = getMasterPath('economic_indicators.csv');

  const allRows = [];
  let errors = 0;

  for (const ind of WB_INDICATORS) {
    const url = `${WB_BASE}/country/${COUNTRY}/indicator/${ind.wb_code}?format=json&per_page=60&date=${YEAR_FROM}:${YEAR_TO}`;
    try {
      const records = await fetchWB(ind.wb_code);
      for (const { year, value } of records) {
        allRows.push({
          fetched_date:   dateStr,
          year:           year,
          month:          '01',        // WB data is annual
          indicator_code: ind.code,
          indicator_name: ind.name,
          sector:         ind.sector,
          value:          value,
          unit:           ind.unit,
          source:         'SG Datalytics Economic Survey',
          collection_method: 'worldbank.org',
        });
      }
      log(`${ind.name} → ${records.length} records`, '✓');
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      errors++;
      log(`${ind.name} → ${err.message}`, '✗');
    }
  }

  // Save raw file for this run
  const rawSaved = appendCsv(rawFile, EI_HEADERS, allRows);
  log(`Raw file → ${rawFile} (${rawSaved} rows)`, '💾');

  // Append only new data points to master
  const masterSaved = appendNewToMaster(
    masterFile, EI_HEADERS, allRows,
    ['indicator_code', 'year']
  );
  log(`Master file → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('economic_indicators', allRows);
    if (errors?.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon economic_indicators → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('economic_indicators_wb', allRows, EI_HEADERS);
  }
  await closeAllPools();

  console.log(`\n  ✓ World Bank done — ${allRows.length} values · ${masterSaved} CSV · ${neonInserted} Neon · ${errors} errors\n`);
  return { total: allRows.length, saved: masterSaved, neon: neonInserted };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('economic_indicators_wb', rows, EI_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
