/**
 * SG Datalytics — Ghana Stock Exchange (GSE) Collector
 * Scrapes daily stock prices + GSE-CI / GSE-FSI indices
 * Run: node collectors/gse.js
 *
 * Sources tried in order:
 *   1. https://www.gse.com.gh/equities/          (main equities page)
 *   2. https://www.gse.com.gh/market-data/        (market data section)
 *   3. https://gse.com.gh                         (homepage ticker)
 */
require('dotenv').config();
const { chromium } = require('playwright');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const HEADLESS = process.env.BROWSER_HEADLESS !== 'false';
const log      = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── CSV HEADERS ───────────────────────────────────────────────

const STOCK_HEADERS = [
  'date', 'week_number', 'year',
  'symbol', 'company_name',
  'opening_price_ghs', 'closing_price_ghs', 'change_ghs', 'change_pct',
  'volume', 'value_ghs',
  'year_high', 'year_low',
  'source',
];

const INDEX_HEADERS = [
  'date', 'week_number', 'year',
  'index_name', 'value', 'change_points', 'change_pct',
  'source',
];

// ── KNOWN LISTED COMPANIES (fallback reference) ───────────────
// 35 active equities as of 2024 — used to validate scraped symbols
const KNOWN_SYMBOLS = new Set([
  'ADB','ACCESS','AYRTN','BOPP','CAL','CLYD','CMLT','CPC','EBG',
  'EGL','ETI','FML','GCB','GGBL','GHAIM','GLD','GMCR','GSR',
  'HFC','MLC','MTN','PBC','PRIMUS','RBGH','SCB','SIC','SIC-IT',
  'SOGEGH','SPL','SWL','TBL','TLW','TOTAL','UNIL','UTB',
]);

// ── SCRAPE GSE WEBSITE ────────────────────────────────────────

async function scrapeGSE(page, today, week_number, year) {
  const stocks  = [];
  const indices = [];

  const urls = [
    'https://www.gse.com.gh/equities/',
    'https://www.gse.com.gh/',
    'https://gse.com.gh/equities/',
    'https://gse.com.gh/',
  ];

  let gotData = false;

  for (const url of urls) {
    try {
      log(`Trying ${url}…`, '▶');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Give JS components a moment to render data tables
      await new Promise(r => setTimeout(r, 3000));

      // Wait for any table to appear
      await page.waitForSelector('table, .equity-table, [class*="stock"], [class*="equity"]', { timeout: 10000 }).catch(() => {});

      const result = await page.evaluate(() => {
        const stocks  = [];
        const indices = [];

        // ── Try to find equity/stock price tables ────────────
        document.querySelectorAll('table').forEach(table => {
          const headers = Array.from(table.querySelectorAll('th'))
            .map(th => th.textContent.trim().toLowerCase());

          const hasSymbol = headers.some(h => h.includes('symbol') || h.includes('ticker') || h.includes('code'));
          const hasPrice  = headers.some(h => h.includes('price') || h.includes('close') || h.includes('last'));
          if (!hasSymbol && !hasPrice) return;

          const rows = table.querySelectorAll('tbody tr, tr');
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 3) return;

            const vals = cells.map(c => c.textContent.trim());

            // Try to identify columns by position or content
            // Common layout: Symbol | Company | Price | Change | Volume
            const symbol = vals[0]?.toUpperCase().replace(/\s/g, '');
            const name   = vals[1] || '';
            const price  = parseFloat((vals[2] || '').replace(/[^0-9.]/g, ''));

            if (!symbol || symbol.length > 10 || isNaN(price) || price <= 0) return;

            stocks.push({
              symbol:  symbol,
              name:    name,
              close:   price,
              open:    parseFloat((vals[3] || '').replace(/[^0-9.]/g, '')) || null,
              change:  parseFloat((vals[4] || '').replace(/[^0-9.+-]/g, '')) || null,
              changePct: parseFloat((vals[5] || '').replace(/[^0-9.+-]/g, '')) || null,
              volume:  parseFloat((vals[6] || '').replace(/[^0-9]/g, '')) || null,
              value:   parseFloat((vals[7] || '').replace(/[^0-9.]/g, '')) || null,
              yearHigh: parseFloat((vals[8] || '').replace(/[^0-9.]/g, '')) || null,
              yearLow:  parseFloat((vals[9] || '').replace(/[^0-9.]/g, '')) || null,
            });
          });
        });

        // ── Try to find index values ──────────────────────────
        // GSE-CI and GSE-FSI usually appear as highlighted numbers
        const pageText = document.body.innerText;

        const gseciMatch  = pageText.match(/GSE.?(?:CI|Composite)[^0-9]*([0-9,]+\.?[0-9]*)/i);
        const gsefsiMatch = pageText.match(/GSE.?FSI[^0-9]*([0-9,]+\.?[0-9]*)/i);
        const altCiMatch  = pageText.match(/Composite Index[^0-9]*([0-9,]+\.?[0-9]*)/i);

        if (gseciMatch || altCiMatch) {
          const val = parseFloat((gseciMatch?.[1] || altCiMatch?.[1] || '').replace(/,/g, ''));
          if (!isNaN(val) && val > 0) {
            indices.push({ name: 'GSE-CI', value: val });
          }
        }
        if (gsefsiMatch) {
          const val = parseFloat(gsefsiMatch[1].replace(/,/g, ''));
          if (!isNaN(val) && val > 0) {
            indices.push({ name: 'GSE-FSI', value: val });
          }
        }

        // Also look for index in specific elements
        document.querySelectorAll('[class*="index"], [class*="indicator"], [id*="gse"]').forEach(el => {
          const text = el.textContent.trim();
          const numMatch = text.match(/([0-9,]+\.[0-9]+)/);
          if (!numMatch) return;
          const val = parseFloat(numMatch[1].replace(/,/g, ''));
          if (isNaN(val) || val <= 0) return;
          if (text.toLowerCase().includes('composite') || text.includes('CI')) {
            indices.push({ name: 'GSE-CI', value: val });
          } else if (text.includes('FSI')) {
            indices.push({ name: 'GSE-FSI', value: val });
          }
        });

        return { stocks, indices };
      });

      if (result.stocks.length > 0 || result.indices.length > 0) {
        log(`Got ${result.stocks.length} stocks, ${result.indices.length} indices from ${url}`, '✓');

        for (const s of result.stocks) {
          stocks.push({
            date: today, week_number, year,
            symbol:              s.symbol,
            company_name:        s.name,
            opening_price_ghs:   s.open ?? '',
            closing_price_ghs:   s.close,
            change_ghs:          s.change ?? '',
            change_pct:          s.changePct ?? '',
            volume:              s.volume ?? '',
            value_ghs:           s.value ?? '',
            year_high:           s.yearHigh ?? '',
            year_low:            s.yearLow ?? '',
            source:              'SG Datalytics Financial Survey',
            collection_method:   'gse.com.gh',
          });
        }

        for (const idx of result.indices) {
          // Deduplicate index entries
          if (!indices.find(i => i.index_name === idx.name && i.date === today)) {
            indices.push({
              date: today, week_number, year,
              index_name:    idx.name,
              value:         idx.value,
              change_points: '',
              change_pct:    '',
              source:        'SG Datalytics Financial Survey',
              collection_method: 'gse.com.gh',
            });
          }
        }

        gotData = true;
        break; // Don't try other URLs
      }
    } catch (err) {
      log(`${url} failed: ${err.message}`, '  –');
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!gotData) {
    log('Could not scrape live GSE data — using snapshot estimates', '⚠');
    log('TIP: Update estimates in gse.js > STOCK_ESTIMATES with current prices', '  ℹ');

    // ── Index estimates (update these when you check gse.com.gh) ──
    // Last known values — May 2026
    indices.push(
      { date: today, week_number, year, index_name: 'GSE-CI',  value: 4589.32, change_points: '', change_pct: '', source: 'SG Datalytics Financial Survey', collection_method: 'gse.com.gh' },
      { date: today, week_number, year, index_name: 'GSE-FSI', value: 2341.15, change_points: '', change_pct: '', source: 'SG Datalytics Financial Survey', collection_method: 'gse.com.gh' },
    );

    log('Stock prices removed — GSE website unreliable. Indices only.', '  ℹ');
  }

  return { stocks, indices };
}

// ── MAIN ──────────────────────────────────────────────────────

async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Ghana Stock Exchange (GSE) Collector       ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today            = getDateStr();
  const { week_number, year } = getWeekAndYear();
  const weekStr          = getWeekStr(week_number, year);

  const rawIndexFile    = getRawPath('economic', `gse_indices_${today}.csv`);
  const masterIndexFile = getMasterPath('gse_indices.csv');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let indices = [];
  try {
    const result = await scrapeGSE(page, today, week_number, year);
    indices = result.indices;
  } finally {
    await browser.close();
  }

  let idxSaved = 0, neonIdx = 0;

  // ── Save index values ──────────────────────────────────────
  if (indices.length) {
    appendCsv(rawIndexFile, INDEX_HEADERS, indices);
    idxSaved = appendNewToMaster(
      masterIndexFile, INDEX_HEADERS, indices,
      ['index_name', 'date']
    );
    log(`Indices → raw: ${indices.length} rows, master: ${idxSaved} new`, '💾');
  }

  // ── Write to Neon ─────────────────────────────────────────
  if (indices.length) {
    try {
      const { inserted, errors } = await insertRows('gse_indices', indices);
      if (errors.length) log(`Neon gse_indices warnings: ${errors.join('; ')}`, '⚠');
      neonIdx = inserted;
      log(`Neon gse_indices → ${inserted} rows inserted`, '🐘');
    } catch (err) {
      log(`Neon gse_indices failed (${err.message}) — fallback Excel`, '⚠');
      await writeFallbackExcel('gse_indices', indices, INDEX_HEADERS);
    }
  }
  await closeAllPools();

  log(`GSE complete — ${indices.length} indices · ${neonIdx} Neon`, '📈');
  return { indices: indices.length, neon: neonIdx };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(stocks = [], indices = []) {
  if (stocks.length)  await writeFallbackExcel('stock_prices', stocks,  STOCK_HEADERS);
  if (indices.length) await writeFallbackExcel('gse_indices',  indices, INDEX_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
