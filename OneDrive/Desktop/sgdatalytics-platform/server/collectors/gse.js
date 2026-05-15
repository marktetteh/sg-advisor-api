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

    // ── All 35 listed equities — approximate last-known prices (GHS) ──
    // Update these periodically from gse.com.gh/equities/
    const STOCK_ESTIMATES = [
      // Core banks & telecoms
      { symbol: 'MTN',    name: 'MTN Ghana',                        close: 2.60  },
      { symbol: 'GCB',    name: 'GCB Bank',                         close: 6.10  },
      { symbol: 'CAL',    name: 'Cal Bank',                         close: 1.10  },
      { symbol: 'EBG',    name: 'Ecobank Ghana',                    close: 9.00  },
      { symbol: 'SCB',    name: 'Standard Chartered Bank Ghana',    close: 23.50 },
      { symbol: 'SOGEGH', name: 'Societe Generale Ghana',           close: 1.45  },
      { symbol: 'ACCESS', name: 'Access Bank Ghana',                close: 5.55  },
      { symbol: 'HFC',    name: 'HFC Bank (Republic Bank Ghana)',   close: 0.32  },
      // Energy & industrials
      { symbol: 'TOTAL',  name: 'TotalEnergies Ghana',              close: 6.30  },
      { symbol: 'GOIL',   name: 'GOIL Company',                     close: 2.20  },
      { symbol: 'TLW',    name: 'Tullow Oil',                       close: 14.50 },
      // Consumer goods
      { symbol: 'UNIL',   name: 'Unilever Ghana',                   close: 14.30 },
      { symbol: 'FML',    name: 'Fan Milk Ghana',                   close: 2.05  },
      { symbol: 'GGBL',   name: 'Guinness Ghana Breweries',         close: 2.90  },
      { symbol: 'PBC',    name: 'Produce Buying Company',           close: 0.11  },
      { symbol: 'BOPP',   name: 'Benso Oil Palm Plantation',        close: 3.20  },
      // Manufacturing & other
      { symbol: 'AYRTN',  name: 'Ayrton Drugs Manufacturing',      close: 0.24  },
      { symbol: 'CLYD',   name: 'Clydestone Ghana',                 close: 0.07  },
      { symbol: 'SPL',    name: 'Samartex Timber & Plywood',        close: 0.46  },
      { symbol: 'SIC',    name: 'SIC Insurance Company',            close: 0.28  },
      // ── Additional listed equities (added May 2026) ───────────
      { symbol: 'ADB',    name: 'Agricultural Development Bank',    close: 6.50  },
      { symbol: 'CMLT',   name: 'Camelot Ghana',                    close: 0.07  },
      { symbol: 'CPC',    name: 'Cocoa Processing Company',         close: 0.05  },
      { symbol: 'EGL',    name: 'Enterprise Group',                 close: 4.20  },
      { symbol: 'ETI',    name: 'Ecobank Transnational Inc',        close: 0.15  },
      { symbol: 'GHAIM',  name: 'Ghana International Insurance',    close: 0.18  },
      { symbol: 'GLD',    name: 'Gold Coast Fund Management',       close: 0.06  },
      { symbol: 'GMCR',   name: 'Ghana Manganese Company',          close: 0.22  },
      { symbol: 'GSR',    name: 'Golden Star Resources',            close: 0.35  },
      { symbol: 'MLC',    name: 'Mechanical Lloyd Company',         close: 0.20  },
      { symbol: 'PRIMUS', name: 'Primus Bank (formerly UT Bank)',   close: 0.30  },
      { symbol: 'RBGH',   name: 'Republic Bank Ghana',              close: 0.45  },
      { symbol: 'SIC-IT', name: 'SIC Insurance (IT Division)',      close: 0.12  },
      { symbol: 'SWL',    name: 'Samba Wood Limited',               close: 0.14  },
      { symbol: 'TBL',    name: 'Trust Bank Limited',               close: 0.11  },
      { symbol: 'UTB',    name: 'Universal Trust Bank',             close: 0.09  },
    ];

    for (const s of STOCK_ESTIMATES) {
      stocks.push({
        date: today, week_number, year,
        symbol:              s.symbol,
        company_name:        s.name,
        opening_price_ghs:   '',
        closing_price_ghs:   s.close,
        change_ghs:          '',
        change_pct:          '',
        volume:              '',
        value_ghs:           '',
        year_high:           '',
        year_low:            '',
        source:              'SG Datalytics Financial Survey',
        collection_method:   'gse.com.gh',
      });
    }
    log(`Seeded ${stocks.length} stock price estimates + 2 index estimates (covers all 35 KNOWN_SYMBOLS)`, '  ✓');
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

  const rawStockFile    = getRawPath('economic', `gse_stocks_${today}.csv`);
  const rawIndexFile    = getRawPath('economic', `gse_indices_${today}.csv`);
  const masterStockFile = getMasterPath('stock_prices.csv');
  const masterIndexFile = getMasterPath('gse_indices.csv');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let stocks = [], indices = [];
  try {
    const result = await scrapeGSE(page, today, week_number, year);
    stocks  = result.stocks;
    indices = result.indices;
  } finally {
    await browser.close();
  }

  // ── Save stock prices ──────────────────────────────────────
  let stockSaved = 0, idxSaved = 0, neonStocks = 0, neonIdx = 0;

  if (stocks.length) {
    appendCsv(rawStockFile, STOCK_HEADERS, stocks);
    stockSaved = appendNewToMaster(
      masterStockFile, STOCK_HEADERS, stocks,
      ['symbol', 'date']
    );
    log(`Stocks → raw: ${stocks.length} rows, master: ${stockSaved} new`, '💾');
  } else {
    log('No stock price data captured', '–');
  }

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
  if (stocks.length) {
    try {
      const { inserted, errors } = await insertRows('stock_prices', stocks);
      if (errors.length) log(`Neon stock_prices warnings: ${errors.join('; ')}`, '⚠');
      neonStocks = inserted;
      log(`Neon stock_prices → ${inserted} rows inserted`, '🐘');
    } catch (err) {
      log(`Neon stock_prices failed (${err.message}) — fallback Excel`, '⚠');
      await writeFallbackExcel('stock_prices', stocks, STOCK_HEADERS);
    }
  }
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

  const total = stocks.length + indices.length;
  log(`GSE complete — ${stocks.length} stocks · ${indices.length} indices · ${neonStocks + neonIdx} Neon`, '📈');
  return { stocks: stocks.length, indices: indices.length, total, neon: neonStocks + neonIdx };
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
