/**
 * SG Datalytics — Historical Price Backfill Cleaner
 * ──────────────────────────────────────────────────
 * One-time script to clean all existing market_prices rows in Neon.
 *
 * What it does:
 *  1. Reads ALL rows from market_prices in Neon (in batches)
 *  2. Applies two-layer price cleaning (category bounds + IQR)
 *  3. Deletes rejected rows from Neon by their listing_url + week + year
 *  4. Writes rejected_prices.csv report to data folder
 *  5. Prints a full summary
 *
 * Run:
 *   node collectors/backfill-clean-prices.js
 *
 * DRY RUN (no deletions, just shows what would be removed):
 *   node collectors/backfill-clean-prices.js --dry-run
 */

require('dotenv').config();
const { Pool }  = require('pg');
const fs        = require('fs');
const path      = require('path');
const { loadGroupFloors, cleanRows, printCleanReport } = require('./price-cleaner');
const { getDataDir } = require('./csv-utils');

const DRY_RUN   = process.argv.includes('--dry-run');
const BATCH     = 5000; // rows fetched per query

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── FETCH ALL ROWS FROM NEON ──────────────────────────────────

async function fetchAllRows() {
  log('Counting rows in market_prices…');
  const countRes = await pool.query('SELECT COUNT(*) AS n FROM market_prices');
  const total    = parseInt(countRes.rows[0].n);
  log(`Total rows in Neon: ${total.toLocaleString()}`);

  const allRows = [];
  let offset    = 0;

  while (offset < total) {
    const res = await pool.query(
      `SELECT id, product_category, search_label, price_ghs,
              price_raw, week_number, year, source, listing_url, collected_date
       FROM market_prices
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );
    allRows.push(...res.rows);
    offset += res.rows.length;
    log(`Fetched ${allRows.length.toLocaleString()} / ${total.toLocaleString()} rows…`);
    if (!res.rows.length) break;
  }

  return allRows;
}

// ── DELETE REJECTED ROWS FROM NEON ───────────────────────────

async function deleteRejected(rejected) {
  if (!rejected.length) { log('Nothing to delete.'); return 0; }

  log(`Deleting ${rejected.length.toLocaleString()} rejected rows from Neon…`);

  // Delete by id in chunks of 1000
  const ids    = rejected.map(r => r.id).filter(Boolean);
  let deleted  = 0;
  const CHUNK  = 1000;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res   = await pool.query(
      `DELETE FROM market_prices WHERE id = ANY($1)`,
      [chunk]
    );
    deleted += res.rowCount;
    log(`Deleted ${deleted.toLocaleString()} rows so far…`);
  }

  return deleted;
}

// ── WRITE REJECTED CSV REPORT ─────────────────────────────────

function writeRejectedCsv(rejected) {
  const dir  = path.join(getDataDir(), 'master');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rejected_prices_backfill_${new Date().toISOString().slice(0,10)}.csv`);

  const headers = [
    'id','product_category','search_label','price_ghs','price_raw',
    'week_number','year','source','listing_url','collected_date','reject_reason'
  ];

  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const lines = [headers.join(',')];
  for (const r of rejected) {
    lines.push(headers.map(h => escape(r[h])).join(','));
  }

  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  log(`Rejected prices report → ${file}`, '📄');
  return file;
}

// ── SUMMARY BREAKDOWN ─────────────────────────────────────────

function printDetailedBreakdown(rejected) {
  // By category
  const byCat = {};
  for (const r of rejected) {
    const cat = r.product_category || 'unknown';
    if (!byCat[cat]) byCat[cat] = { total: 0, floor: 0, ceiling: 0, iqr: 0, no_price: 0 };
    byCat[cat].total++;
    const reason = r.reject_reason || '';
    if (reason === 'no_price')           byCat[cat].no_price++;
    else if (reason.startsWith('below')) byCat[cat].floor++;
    else if (reason.startsWith('above')) byCat[cat].ceiling++;
    else if (reason.startsWith('iqr'))   byCat[cat].iqr++;
  }

  console.log('\n  Category Breakdown:');
  console.log('  ' + '─'.repeat(75));
  console.log(`  ${'Category'.padEnd(25)} ${'Total'.padStart(7)} ${'No price'.padStart(9)} ${'Floor'.padStart(7)} ${'Ceiling'.padStart(8)} ${'IQR'.padStart(7)}`);
  console.log('  ' + '─'.repeat(75));
  for (const [cat, s] of Object.entries(byCat).sort((a,b) => b[1].total - a[1].total)) {
    console.log(`  ${cat.slice(0,25).padEnd(25)} ${String(s.total).padStart(7)} ${String(s.no_price).padStart(9)} ${String(s.floor).padStart(7)} ${String(s.ceiling).padStart(8)} ${String(s.iqr).padStart(7)}`);
  }
  console.log('  ' + '─'.repeat(75));

  // Top 10 most rejected products
  const byProduct = {};
  for (const r of rejected) {
    const key = r.search_label || 'unknown';
    byProduct[key] = (byProduct[key] || 0) + 1;
  }
  const top10 = Object.entries(byProduct).sort((a,b) => b[1]-a[1]).slice(0,10);
  console.log('\n  Top 10 products with most rejections:');
  for (const [label, count] of top10) {
    console.log(`    ${label.slice(0,40).padEnd(40)} ${count} rejected`);
  }
  console.log('');
}

// ── MAIN ──────────────────────────────────────────────────────

async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log(`  ║   SG Datalytics — Price Backfill Cleaner         ║`);
  console.log(`  ║   ${DRY_RUN ? 'DRY RUN — no deletions will be made'.padEnd(44) : 'LIVE RUN — bad rows will be deleted'.padEnd(44)}║`);
  console.log('  ╚══════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    log('DRY RUN mode — Neon will NOT be modified', '⚠');
  }

  try {
    // 1. Fetch all rows
    const allRows = await fetchAllRows();
    log(`Loaded ${allRows.length.toLocaleString()} rows — running price cleaner…`, '🔍');

    // 2. Load product-group floors from Neon then clean
    const groupFloors = await loadGroupFloors(pool);
    log(`Loaded ${Object.keys(groupFloors).length} product-group price floors`, '⚙');
    const { kept, rejected } = cleanRows(allRows, groupFloors);
    printCleanReport(kept, rejected, 'Backfill');
    printDetailedBreakdown(rejected);

    // 3. Write rejected CSV
    const csvFile = writeRejectedCsv(rejected);
    log(`Rejected rows saved to CSV — review before proceeding`, '📋');

    if (DRY_RUN) {
      log(`DRY RUN complete — ${rejected.length.toLocaleString()} rows would be deleted from Neon`, '✅');
      log(`Review: ${csvFile}`, '📄');
    } else {
      // 4. Delete from Neon
      const deleted = await deleteRejected(rejected);
      log(`Deletion complete — ${deleted.toLocaleString()} rows removed from Neon`, '✅');
      log(`${kept.length.toLocaleString()} clean rows remain in market_prices`, '✅');
    }

  } catch(e) {
    log(`Fatal error: ${e.message}`, '❌');
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
