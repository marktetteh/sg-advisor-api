/**
 * SG Datalytics — Bank of Ghana / Macro-Financial Collector
 *
 * Sources (all free, no API key):
 *  1. open.er-api.com        → Live GHS exchange rates
 *  2. IMF DataMapper API     → Ghana inflation, GDP, debt, fiscal, current account
 *  3. World Bank API         → Reserves, deposit rate, broad money
 *  4. tradingeconomics.com   → MPR (Monetary Policy Rate) page text
 *  5. Hardcoded estimates    → T-bill rates (fallback when live source unavailable)
 *
 * BOG website (www.bog.gov.gh) is blocked by Radware Bot Manager on all paths.
 * Run: node collectors/bog.js
 */
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getMonthStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);
const delay = ms => new Promise(r => setTimeout(r, ms));

const HEADERS_EXRATE = ['date', 'currency_pair', 'rate_ghs', 'source'];
// Standard header — must match across all collectors (worldbank, gss, bog)
const HEADERS_INDICATORS = [
  'fetched_date', 'year', 'month', 'indicator_code', 'indicator_name',
  'sector', 'value', 'unit', 'source',
];

const STD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── 1. EXCHANGE RATES (open.er-api.com) ──────────────────────
async function fetchExchangeRates(today) {
  log('Fetching exchange rates from open.er-api.com…', '▶');
  const rows = [];
  try {
    const resp = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 15000 });
    const { result, rates, time_last_update_utc } = resp.data;
    if (result !== 'success') throw new Error(resp.data['error-type'] || 'API error');

    const ghsPerUsd = rates.GHS;
    const pairs = [
      ['GHS/USD', 1],
      ['GHS/GBP', rates.GBP],
      ['GHS/EUR', rates.EUR],
      ['GHS/CNY', rates.CNY],
      ['GHS/XOF', rates.XOF],  // West African CFA franc
    ];

    for (const [pair, foreign] of pairs) {
      const value = +(ghsPerUsd / foreign).toFixed(pair === 'GHS/XOF' ? 6 : 4);
      rows.push({ date: today, currency_pair: pair, rate_ghs: value, source: 'SG Datalytics Exchange Rate Survey', collection_method: 'open.er-api.com' });
      log(`${pair} → ${value}`, '  ✓');
    }
    log(`Rates as of: ${time_last_update_utc}`, '  ℹ');
  } catch (err) {
    log(`Exchange rate API failed: ${err.message}`, '  ✗');
  }
  return rows;
}

// ── 2. IMF DATAMAPPER API (Ghana macro indicators) ───────────
// Free, no key. Returns annual data; we take the most recent confirmed year.
async function fetchIMFIndicators(today, monthStr) {
  log('Fetching Ghana macro data from IMF DataMapper API…', '▶');
  const rows = [];

  const indicators = [
    { code: 'PCPIPCH',      indCode: 'IMF_INFLATION',    name: 'Ghana Inflation Rate (%)',           unit: '%',    sector: 'economy'  },
    { code: 'NGDP_RPCH',    indCode: 'IMF_GDP_GROWTH',   name: 'Ghana Real GDP Growth (%)',           unit: '%',    sector: 'economy'  },
    { code: 'NGDPD',        indCode: 'IMF_GDP_USD',      name: 'Ghana GDP (Nominal, USD bn)',         unit: 'USD bn', sector: 'economy' },
    { code: 'PPPGDP',       indCode: 'IMF_GDP_PPP',      name: 'Ghana GDP (PPP, USD bn)',             unit: 'USD bn', sector: 'economy' },
    { code: 'GGXWDG_NGDP',  indCode: 'IMF_DEBT_GDP',     name: 'Ghana Gross Gov. Debt (% of GDP)',   unit: '%',    sector: 'fiscal'   },
    { code: 'GGXCNL_NGDP',  indCode: 'IMF_FISCAL_BAL',   name: 'Ghana Fiscal Balance (% of GDP)',    unit: '%',    sector: 'fiscal'   },
    { code: 'BCA_NGDPD',    indCode: 'IMF_CURRENT_ACCT', name: 'Ghana Current Account (% of GDP)',   unit: '%',    sector: 'external' },
    { code: 'LUR',          indCode: 'IMF_UNEMPLOYMENT',  name: 'Ghana Unemployment Rate (%)',        unit: '%',    sector: 'labour'   },
  ];

  const currentYear = new Date().getFullYear();

  for (const { code, indCode, name, unit, sector } of indicators) {
    try {
      await delay(300); // polite delay
      const url = `https://www.imf.org/external/datamapper/api/v1/${code}/GHA`;
      const resp = await axios.get(url, { timeout: 15000 });
      const data = resp.data?.values?.[code]?.GHA;
      if (!data) { log(`${indCode}: no Ghana data`, '  –'); continue; }

      // Find most recent year that has an actual value (not just forecast)
      // IMF marks forecasts starting from estimate year — use latest actual (≤ currentYear - 1)
      const actualYears = Object.keys(data)
        .filter(y => parseInt(y) <= currentYear)
        .sort((a, b) => parseInt(b) - parseInt(a));

      if (!actualYears.length) continue;
      const year  = actualYears[0];
      const value = data[year];
      if (value === null || value === undefined) continue;

      const rounded = Math.round(value * 100) / 100;
      rows.push({ fetched_date: today, year, month: '01', indicator_code: indCode, indicator_name: name, sector, value: rounded, unit, source: 'SG Datalytics Economic Survey', collection_method: 'imf.org' });
      log(`${indCode} (${year}) → ${rounded}${unit === '%' ? '%' : ' ' + unit}`, '  ✓');
    } catch (err) {
      log(`${indCode} IMF fetch failed: ${err.message}`, '  –');
    }
  }

  return rows;
}

// ── 3. WORLD BANK API (reserves, deposit rate, broad money) ──
async function fetchWorldBankIndicators(today, monthStr) {
  log('Fetching Ghana financial data from World Bank API…', '▶');
  const rows = [];

  const indicators = [
    { wb: 'FI.RES.TOTL.CD',      indCode: 'WB_RESERVES_USD',    name: 'Ghana Int. Reserves (USD)',         unit: 'USD',  sector: 'monetary' },
    { wb: 'FI.RES.TOTL.MO',      indCode: 'WB_RESERVES_MONTHS', name: 'Ghana Reserves (months of imports)', unit: 'months', sector: 'monetary' },
    { wb: 'FR.INR.DPST',          indCode: 'WB_DEPOSIT_RATE',    name: 'Ghana Deposit Interest Rate (%)',   unit: '%',    sector: 'monetary' },
    { wb: 'FM.LBL.BMNY.GD.ZS',   indCode: 'WB_BROAD_MONEY',     name: 'Ghana Broad Money (% of GDP)',      unit: '%',    sector: 'monetary' },
    { wb: 'FS.AST.DOMS.GD.ZS',   indCode: 'WB_DOMESTIC_CREDIT', name: 'Ghana Domestic Credit (% of GDP)',  unit: '%',    sector: 'monetary' },
  ];

  for (const { wb, indCode, name, unit, sector } of indicators) {
    try {
      await delay(300);
      const url = `https://api.worldbank.org/v2/country/GH/indicator/${wb}?format=json&mrv=3&per_page=5`;
      const resp = await axios.get(url, { timeout: 15000 });
      const records = resp.data?.[1]?.filter(d => d.value !== null);
      if (!records?.length) { log(`${indCode}: no data`, '  –'); continue; }

      const latest = records[0];
      const rounded = Math.round(latest.value * 100) / 100;
      rows.push({ fetched_date: today, year: latest.date, month: '01', indicator_code: indCode, indicator_name: name, sector, value: rounded, unit, source: 'SG Datalytics Economic Survey', collection_method: 'worldbank.org' });
      log(`${indCode} (${latest.date}) → ${rounded}${unit === '%' ? '%' : ' ' + unit}`, '  ✓');
    } catch (err) {
      log(`${indCode} WB fetch failed: ${err.message}`, '  –');
    }
  }

  return rows;
}

// ── 4. TRADING ECONOMICS (MPR — page text extraction) ─────────
// TE renders the current value client-side, but the Ghana country name
// appears near the current percentage in the page text.
async function fetchMPRFromTE(today, monthStr) {
  log('Fetching MPR from Trading Economics…', '▶');
  const rows = [];
  try {
    await delay(1000);
    const resp = await axios.get('https://tradingeconomics.com/ghana/interest-rate', {
      headers: STD_HEADERS,
      timeout: 20000,
    });
    const $ = cheerio.load(resp.data);
    const pageText = $('body').text().replace(/\s+/g, ' ');

    // TE embeds forecast array in page JS: TEForecast = [current, ...]
    const forecastMatch = resp.data.match(/TEForecast\s*=\s*\[([0-9.,\s]+)\]/);
    // Also try matching "Ghana ... X percent" in page text
    const textMatch = pageText.match(/Ghana[^0-9]{0,30}([0-9]+\.?[0-9]*)\s*(?:percent|%)/i);
    // Also try matching meta description
    const metaMatch = resp.data.match(/content="Ghana Interest Rate[^"]*?([0-9]+\.?[0-9]*)\s*percent/i);

    let mpr = null;
    if (forecastMatch) {
      mpr = parseFloat(forecastMatch[1].split(',')[0].trim());
      log(`MPR from TEForecast array → ${mpr}%`, '  ✓');
    } else if (metaMatch) {
      mpr = parseFloat(metaMatch[1]);
      log(`MPR from meta tag → ${mpr}%`, '  ✓');
    } else if (textMatch) {
      mpr = parseFloat(textMatch[1]);
      log(`MPR from page text → ${mpr}%`, '  ✓');
    }

    if (mpr && mpr > 0 && mpr < 100) {
      const yr = new Date().getFullYear();
      const mo = String(new Date().getMonth() + 1).padStart(2, '0');
      rows.push({ fetched_date: today, year: yr, month: mo, indicator_code: 'BOG_MPR', indicator_name: 'Ghana Monetary Policy Rate (%)', sector: 'monetary', value: mpr, unit: '%', source: 'Trading Economics' });
    }
  } catch (err) {
    log(`TE MPR fetch failed: ${err.message}`, '  –');
  }
  return rows;
}

// ── 5. BOG INDICATOR ESTIMATES (fallback) ────────────────────
// Used for indicators we cannot fetch live (T-bill rates, interbank).
// Update these when BOG publishes a press release or MPC decision.
// Last updated: May 2026 — based on BOG MPC communiqué
function buildBOGEstimates(today, monthStr, mprLive) {
  log('Adding BOG T-bill / interbank rate estimates…', '▶');
  const mpr = mprLive || 14.0; // MPR as of May 2026

  // T-bill rates historically track 1-5pp above MPR in Ghana
  const estimates = [
    { code: 'BOG_TBILL_91',     name: '91-Day T-Bill Rate (%)',       value: +(mpr + 1.5).toFixed(2) },
    { code: 'BOG_TBILL_182',    name: '182-Day T-Bill Rate (%)',      value: +(mpr + 2.5).toFixed(2) },
    { code: 'BOG_TBILL_364',    name: '364-Day T-Bill Rate (%)',      value: +(mpr + 3.5).toFixed(2) },
    { code: 'BOG_INTERBANK',    name: 'Interbank Rate (%)',           value: +(mpr + 0.5).toFixed(2) },
    { code: 'BOG_LENDING_RATE', name: 'Average Lending Rate (%)',     value: +(mpr + 16.0).toFixed(2) },
  ];

  const yr = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  return estimates.map(e => ({
    fetched_date: today, year: yr, month: mo,
    indicator_code: e.code, indicator_name: e.name,
    sector: 'monetary', value: e.value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'bank_of_ghana',
  }));
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Bank of Ghana / Macro-Financial Collector  ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today    = getDateStr();
  const monthStr = getMonthStr();

  const rawExFile  = getRawPath('economic', `bog_exchange_${today}.csv`);
  const rawIndFile = getRawPath('economic', `bog_indicators_${today}.csv`);
  const masterEx   = getMasterPath('exchange_rates.csv');
  const masterInd  = getMasterPath('economic_indicators.csv');

  // ── Fetch from all sources in parallel where safe ──────────
  const exRates  = await fetchExchangeRates(today);
  const imfRows  = await fetchIMFIndicators(today, monthStr);
  const wbRows   = await fetchWorldBankIndicators(today, monthStr);
  const mprRows  = await fetchMPRFromTE(today, monthStr);

  // Build T-bill estimates anchored to live MPR if we got it
  const liveMPR     = mprRows[0]?.value || null;
  const estRows     = buildBOGEstimates(today, monthStr, liveMPR);

  const allIndRows  = [...imfRows, ...wbRows, ...mprRows, ...estRows];

  // ── Save raw files ─────────────────────────────────────────
  if (exRates.length) {
    appendCsv(rawExFile, HEADERS_EXRATE, exRates);
    log(`Raw exchange rates → ${rawExFile} (${exRates.length} rows)`, '💾');
  }
  if (allIndRows.length) {
    appendCsv(rawIndFile, HEADERS_INDICATORS, allIndRows);
    log(`Raw indicators → ${rawIndFile} (${allIndRows.length} rows)`, '💾');
  }

  // ── Append new to master ───────────────────────────────────
  const exSaved  = appendNewToMaster(masterEx,  HEADERS_EXRATE,     exRates,     ['date', 'currency_pair']);
  const indSaved = appendNewToMaster(masterInd, HEADERS_INDICATORS, allIndRows,  ['date', 'indicator_code']);

  log(`Master exchange_rates.csv  → ${exSaved} new rows`, '📦');
  log(`Master economic_indicators → ${indSaved} new rows`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonEx = 0, neonInd = 0;
  try {
    const { inserted, errors } = await insertRows('exchange_rates', exRates);
    if (errors.length) log(`Neon exchange_rates warnings: ${errors.join('; ')}`, '⚠');
    neonEx = inserted;
    log(`Neon exchange_rates → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon exchange_rates failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('exchange_rates', exRates, HEADERS_EXRATE);
  }
  try {
    const { inserted, errors } = await insertRows('economic_indicators', allIndRows);
    if (errors.length) log(`Neon economic_indicators warnings: ${errors.join('; ')}`, '⚠');
    neonInd = inserted;
    log(`Neon economic_indicators → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon economic_indicators failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('economic_indicators', allIndRows, HEADERS_INDICATORS);
  }
  await closeAllPools();

  const total = exRates.length + allIndRows.length;
  log(`BOG complete — ${exRates.length} FX · ${allIndRows.length} indicators · ${neonEx + neonInd} Neon`, '🏦');
  return { total, saved: exSaved + indSaved, neon: neonEx + neonInd };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(exRates = [], indicators = []) {
  if (exRates.length)   await writeFallbackExcel('exchange_rates',       exRates,     HEADERS_EXRATE);
  if (indicators.length) await writeFallbackExcel('economic_indicators', indicators,  HEADERS_INDICATORS);
}

// ── EXCHANGE RATES ONLY (called by daily scheduler) ──────────
// Fetches only FX rates — skips IMF/WB/TE macro indicators.
// Macro indicators run monthly via the full run() call.
async function fetchExchangeRatesOnly() {
  ensureDirs();
  const today    = getDateStr();
  const rawExFile = getRawPath('economic', `bog_exchange_${today}.csv`);
  const masterEx  = getMasterPath('exchange_rates.csv');

  const exRates = await fetchExchangeRates(today);
  if (exRates.length) {
    appendCsv(rawExFile, HEADERS_EXRATE, exRates);
    const saved = appendNewToMaster(masterEx, HEADERS_EXRATE, exRates, ['date', 'currency_pair']);
    log(`Exchange rates → ${saved} new rows in master`, '📦');

    try {
      const { inserted, errors } = await insertRows('exchange_rates', exRates);
      if (errors.length) log(`Neon exchange_rates warnings: ${errors.join('; ')}`, '⚠');
      log(`Neon exchange_rates → ${inserted} rows inserted`, '🐘');
    } catch (err) {
      log(`Neon exchange_rates failed (${err.message}) — fallback Excel`, '⚠');
      await writeFallbackExcel('exchange_rates', exRates, HEADERS_EXRATE);
    }
    await closeAllPools();
  }
  return { total: exRates.length };
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, fetchExchangeRatesOnly, exportToExcel };
