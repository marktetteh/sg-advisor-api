/**
 * SG Datalytics — Weekly Data Consolidation & Cleaning
 * ─────────────────────────────────────────────────────
 * Run manually:  node collectors/consolidate.js
 * Or auto-runs after each market scrape via scheduler.
 *
 * What it does:
 *  1. Reads all raw market files for the current week
 *  2. Deduplicates: same listing_url in same week = keep one
 *  3. Cleans: numeric prices, trimmed strings, valid URLs only
 *  4. Writes a clean weekly snapshot CSV
 *  5. Appends new-only rows to the master market_prices.csv
 *  6. Prints a summary report (avg, min, max, count per product)
 *  7. Does the same for commodity_prices and exchange_rates
 */
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const {
  getDataDir, ensureDirs, readCsv, writeCsv, appendNewToMaster,
  getWeekAndYear, getWeekStr, getDateStr, getWeeklyPath, getMasterPath,
} = require('./csv-utils');
const { Pool } = require('pg');
const { loadGroupFloors, cleanRows, printCleanReport, detectJumps, printJumpReport } = require('./price-cleaner');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── HELPERS ───────────────────────────────────────────────────

function safeFloat(val) {
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── LOAD RAW FILES FOR A WEEK ─────────────────────────────────

function loadRawFiles(subDir, weekStr) {
  const dir = path.join(getDataDir(), 'raw', subDir);
  if (!fs.existsSync(dir)) return [];

  // Match files that contain the weekStr in their name
  const files = fs.readdirSync(dir).filter(f => f.includes(weekStr) && f.endsWith('.csv'));
  const allRows = [];
  for (const f of files) {
    const rows = readCsv(path.join(dir, f));
    allRows.push(...rows);
  }
  return allRows;
}

// ── CLEAN A SINGLE MARKET ROW ─────────────────────────────────

function cleanMarketRow(row) {
  // Ensure price_ghs is a valid positive number
  let priceGhs = safeFloat(row.price_ghs);
  if (priceGhs !== null && priceGhs <= 0) priceGhs = null;

  // If no price_ghs but there's price_raw, try to parse it
  if (priceGhs === null && row.price_raw) {
    priceGhs = safeFloat(row.price_raw.replace(/GHS|GH₵|₵|,/gi, ''));
    if (priceGhs !== null && priceGhs <= 0) priceGhs = null;
  }

  return {
    ...row,
    title:       (row.title || '').trim().replace(/\s+/g, ' '),
    price_raw:   (row.price_raw || '').trim(),
    price_ghs:   priceGhs ?? '',
    location:    (row.location || '').trim().replace(/\s+/g, ' '),
    condition:   normalizeCondition(row.condition),
    listing_url: (row.listing_url || '').trim(),
  };
}

function normalizeCondition(text) {
  if (!text) return 'unknown';
  const t = text.toLowerCase();
  if (t.includes('new') || t.includes('brand')) return 'new';
  if (t.includes('used') || t.includes('second') || t.includes('fairly')) return 'used';
  return 'unknown';
}

// ── DEDUPLICATE ───────────────────────────────────────────────
// Within same week, same source+listing_url = duplicate (keep one)

function deduplicateMarket(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (!row.listing_url || !row.title) return false;
    const key = `${row.source}|${row.listing_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── STATS PER PRODUCT ─────────────────────────────────────────

function buildMarketStats(rows) {
  const groups = {};
  for (const row of rows) {
    const key   = `${row.product_category}||${row.search_label}||${row.source}`;
    const price = safeFloat(row.price_ghs);
    if (!groups[key]) groups[key] = { rows: [], prices: [] };
    groups[key].rows.push(row);
    if (price !== null) groups[key].prices.push(price);
  }

  return Object.entries(groups).map(([key, g]) => {
    const [category, label, source] = key.split('||');
    const prices = g.prices;
    return {
      source,
      product_category: category,
      search_label:     label,
      listing_count:    g.rows.length,
      priced_count:     prices.length,
      avg_price_ghs:    average(prices)?.toFixed(2) ?? '',
      median_price_ghs: median(prices)?.toFixed(2) ?? '',
      min_price_ghs:    prices.length ? Math.min(...prices).toFixed(2) : '',
      max_price_ghs:    prices.length ? Math.max(...prices).toFixed(2) : '',
    };
  });
}

// ── CONSOLIDATE MARKET PRICES ─────────────────────────────────

function consolidateMarket(week_number, year, groupFloors = {}) {
  const weekStr = getWeekStr(week_number, year);
  log(`Loading raw market files for ${weekStr}…`, '▶');

  const rawRows   = loadRawFiles('market', weekStr);
  if (!rawRows.length) {
    log(`No raw market files found for ${weekStr}`, '  –');
    return { rows: 0, stats: 0 };
  }
  log(`Loaded ${rawRows.length} raw rows`, '  ');

  // Clean
  const cleanedRows = rawRows.map(cleanMarketRow);

  // Deduplicate within the week
  const dedupedRows = deduplicateMarket(cleanedRows);
  log(`After deduplication: ${dedupedRows.length} unique listings`, '  ✓');

  // Price intelligence cleaning (layer 1: product-group/category floors + layer 2: IQR)
  const { kept: priceClean, rejected: priceRejected } = cleanRows(dedupedRows, groupFloors);
  log(`After price cleaning: ${priceClean.length} valid · ${priceRejected.length} rejected`, '  🧹');
  if (priceRejected.length) {
    printCleanReport(priceClean, priceRejected, weekStr);
    // Save rejected rows for audit
    const rejFile = getWeeklyPath(`rejected_prices_${weekStr}.csv`);
    const REJ_HEADERS = ['product_category','search_label','price_ghs','price_raw','source','listing_url','reject_reason'];
    writeCsv(rejFile, REJ_HEADERS, priceRejected);
    log(`Rejected prices → ${rejFile}`, '📄');
  }
  const finalRows = priceClean;

  // Write clean weekly snapshot
  const snapshotFile = getWeeklyPath(`market_prices_${weekStr}.csv`);
  const MARKET_HEADERS = [
    'scraped_date', 'week_number', 'year', 'source',
    'product_category', 'search_label', 'title',
    'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
  ];
  writeCsv(snapshotFile, MARKET_HEADERS, finalRows);
  log(`Weekly snapshot → ${snapshotFile} (${finalRows.length} rows)`, '💾');

  // Append to master
  const masterFile  = getMasterPath('market_prices.csv');
  const masterSaved = appendNewToMaster(
    masterFile, MARKET_HEADERS, finalRows,
    ['source', 'listing_url', 'week_number', 'year']
  );
  log(`Master market_prices.csv → ${masterSaved} new rows added`, '📦');

  // Write weekly stats summary
  const stats       = buildMarketStats(finalRows);
  const statsFile   = getWeeklyPath(`market_stats_${weekStr}.csv`);
  const STATS_HEADERS = [
    'source', 'product_category', 'search_label',
    'listing_count', 'priced_count',
    'avg_price_ghs', 'median_price_ghs', 'min_price_ghs', 'max_price_ghs',
  ];
  writeCsv(statsFile, STATS_HEADERS, stats);
  log(`Weekly stats → ${statsFile}`, '📊');

  // Week-on-week jump detection — compare to previous week's stats
  const prevWeekNum = week_number === 1 ? 52 : week_number - 1;
  const prevYear    = week_number === 1 ? year - 1 : year;
  const prevWeekStr = getWeekStr(prevWeekNum, prevYear);
  const prevStatsFile = getWeeklyPath(`market_stats_${prevWeekStr}.csv`);
  if (fs.existsSync(prevStatsFile)) {
    const prevStats = readCsv(prevStatsFile);
    const jumps     = detectJumps(stats, prevStats);
    log(`Week-on-week jump check: ${jumps.length} products flagged (>50% move)`, '⚡');
    printJumpReport(jumps, weekStr);
  } else {
    log(`No previous week stats found (${prevWeekStr}) — skipping jump detection`, '  –');
  }

  return { rows: finalRows.length, masterSaved, stats: stats.length, rejected: priceRejected.length };
}

// ── CONSOLIDATE COMMODITY PRICES ──────────────────────────────

function consolidateCommodities(week_number, year) {
  const weekStr = getWeekStr(week_number, year);
  const rawRows = loadRawFiles('commodities', weekStr);
  if (!rawRows.length) return { rows: 0 };

  // Deduplicate: same commodity+market+week
  const seen = new Set();
  const dedupedRows = rawRows.filter(row => {
    const key = `${row.commodity_code}|${row.market}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const snapshotFile = getWeeklyPath(`commodity_prices_${weekStr}.csv`);
  const COMM_HEADERS = [
    'date', 'week_number', 'year', 'commodity_code', 'commodity_name',
    'market', 'region', 'price_ghs', 'unit', 'source',
  ];
  writeCsv(snapshotFile, COMM_HEADERS, dedupedRows);
  log(`Commodity snapshot → ${snapshotFile} (${dedupedRows.length} rows)`, '💾');

  const masterFile  = getMasterPath('commodity_prices.csv');
  const masterSaved = appendNewToMaster(
    masterFile, COMM_HEADERS, dedupedRows,
    ['commodity_code', 'market', 'week_number', 'year']
  );
  log(`Master commodity_prices.csv → ${masterSaved} new rows`, '📦');

  return { rows: dedupedRows.length, masterSaved };
}

// ── PRINT REPORT ──────────────────────────────────────────────

function printReport(week_number, year) {
  const weekStr = getWeekStr(week_number, year);
  console.log('\n  ╔══════════════════════════════════════════════════════════════╗');
  console.log(`  ║   WEEKLY REPORT — ${weekStr.padEnd(44)}║`);
  console.log('  ╠══════════════════════════════════════════════════════════════╣');

  const statsFile = getWeeklyPath(`market_stats_${weekStr}.csv`);
  if (!fs.existsSync(statsFile)) {
    console.log('  ║  No stats available for this week                            ║');
    console.log('  ╚══════════════════════════════════════════════════════════════╝\n');
    return;
  }

  const stats = readCsv(statsFile);

  // Group by source
  const bySrc = {};
  for (const s of stats) {
    if (!bySrc[s.source]) bySrc[s.source] = [];
    bySrc[s.source].push(s);
  }

  for (const [src, items] of Object.entries(bySrc)) {
    console.log(`  ║  📦 ${src.toUpperCase().padEnd(56)}║`);
    for (const s of items) {
      const label  = `${s.search_label}`.padEnd(22);
      const count  = `${s.listing_count} listings`.padEnd(14);
      const avg    = s.avg_price_ghs ? `avg GHS ${Number(s.avg_price_ghs).toLocaleString()}` : 'no price data';
      const range  = s.min_price_ghs && s.max_price_ghs ? ` [${Number(s.min_price_ghs).toLocaleString()}–${Number(s.max_price_ghs).toLocaleString()}]` : '';
      console.log(`  ║    ${label} ${count} ${avg}${range}`);
    }
    console.log('  ║');
  }

  // Commodity prices
  const commFile = getWeeklyPath(`commodity_prices_${weekStr}.csv`);
  if (fs.existsSync(commFile)) {
    const comms = readCsv(commFile);
    if (comms.length) {
      console.log('  ║  🌾 COMMODITY PRICES'.padEnd(65) + '║');
      for (const c of comms) {
        const label = `${c.commodity_name} (${c.market})`.padEnd(40);
        console.log(`  ║    ${label} GHS ${Number(c.price_ghs).toLocaleString()} / ${c.unit}`);
      }
      console.log('  ║');
    }
  }

  console.log('  ╚══════════════════════════════════════════════════════════════╝\n');
}

// ── SNAPSHOT REGIONAL GMPI ────────────────────────────────────
// Calls POST /api/gmpi/regional/snapshot on Railway after collection.
// Requires ADMIN_KEY and optionally API_URL in .env

async function snapshotGmpi() {
  const API_URL   = process.env.API_URL || 'https://sgdatalytics-production.up.railway.app';
  const adminKey  = process.env.ADMIN_KEY || '';
  const url       = new URL('/api/gmpi/regional/snapshot', API_URL);
  const isHttps   = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Content-Length': '0',
        'X-Admin-Key':   adminKey,
      },
      timeout: 30000,
    };
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ error: 'parse error', raw: body.slice(0, 120) }); }
      });
    });
    req.on('error',   (e) => resolve({ error: e.message }));
    req.on('timeout', ()  => { req.destroy(); resolve({ error: 'timeout' }); });
    req.end();
  });
}

// ── MAIN ──────────────────────────────────────────────────────

async function run(opts = {}) {
  const { week_number, year } = opts.week_number
    ? { week_number: opts.week_number, year: opts.year }
    : getWeekAndYear();

  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Weekly Consolidation       ║');
  console.log(`  ║   ${getWeekStr(week_number, year).padEnd(44)}║`);
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();

  // Load product-group price floors from Neon (best-effort — falls back to category floors)
  const floorsPool = new Pool({
    connectionString: process.env.NEON_MARKET_PRICES,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  const groupFloors = await loadGroupFloors(floorsPool);
  await floorsPool.end();
  log(`Loaded ${Object.keys(groupFloors).length} product-group price floors from Neon`, '⚙');

  // 1. Market prices
  log('── Market Prices ────────────────────────────────', ' ');
  const market = consolidateMarket(week_number, year, groupFloors);

  // 2. Commodity prices
  log('── Commodity Prices ─────────────────────────────', ' ');
  const commod = consolidateCommodities(week_number, year);

  // 3. Print summary
  printReport(week_number, year);

  // 4. Snapshot regional GMPI to Neon
  log('── Regional GMPI Snapshot ───────────────────────', ' ');
  try {
    const snap = await snapshotGmpi();
    if (snap.error) {
      log(`GMPI snapshot failed: ${snap.error}`, '  [FAILED]');
    } else {
      log(`GMPI snapshot saved — ${snap.regions} regions, ${snap.neighbourhoods} neighbourhoods (${snap.week})`, '  [OK]');
    }
  } catch(e) {
    log(`GMPI snapshot error: ${e.message}`, '  [FAILED]');
  }

  const summary = {
    week:         getWeekStr(week_number, year),
    marketRows:   market.rows,
    masterNew:    market.masterSaved,
    commodRows:   commod.rows,
  };
  log(`Consolidation complete — ${summary.marketRows} market listings, ${summary.masterNew} new in master`, '[OK]');
  return summary;
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
