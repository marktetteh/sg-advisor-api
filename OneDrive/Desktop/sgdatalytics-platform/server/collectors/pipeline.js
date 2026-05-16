/**
 * SG Datalytics — Market Scraper Pipeline
 * Runs Jiji scraper and builds weekly analyses from Neon market_prices.
 * Run: node collectors/pipeline.js
 *
 * Note: The primary full pipeline is market-pipeline.js (Jiji + Melcom + Esoko
 * + Hotels + Airbnb + Meqasa). This file is a lightweight Jiji-only entry point.
 */
require('dotenv').config();
const { Pool } = require('pg');
const { getWeekAndYear } = require('./scraper-utils');
const { MARKET_PRODUCTS } = require('./config');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

function _cleanUrl(url) {
  return (url || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '');
}

// ── RUN JIJI SCRAPER ──────────────────────────────────────────
async function runScrapers() {
  log('Running Jiji scraper…', '🕷');
  const jijiMod = require('./jiji');

  try {
    const result = await jijiMod.run();
    log(`Jiji done — ${result.total} scraped · ${result.saved} CSV · ${result.neon} Neon`, '✓');
    return result;
  } catch (err) {
    log(`Jiji error: ${err.message}`, '✗');
    return { total: 0, saved: 0, neon: 0 };
  }
}

// ── BUILD WEEKLY ANALYSES (queries Neon market_prices) ────────
async function buildWeeklyAnalyses() {
  const connStr = _cleanUrl(process.env.NEON_MARKET_PRICES);
  if (!connStr) {
    log('NEON_MARKET_PRICES not set — skipping weekly analyses', '⚠');
    return;
  }

  const { week_number, year } = getWeekAndYear();
  log(`Building weekly analyses for W${week_number}/${year}…`, '📊');

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    for (const product of MARKET_PRODUCTS) {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*)                                               AS total,
          COUNT(*) FILTER (WHERE item_type = 'product')        AS product_count,
          AVG(price_ghs) FILTER (WHERE item_type = 'product')  AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_ghs)
            FILTER (WHERE item_type = 'product')               AS median_price,
          MIN(price_ghs) FILTER (WHERE item_type = 'product')  AS min_price,
          MAX(price_ghs) FILTER (WHERE item_type = 'product')  AS max_price,
          COUNT(*) FILTER (WHERE condition = 'Brand new')      AS new_count,
          COUNT(*) FILTER (WHERE condition = 'Used')           AS used_count
        FROM market_prices
        WHERE search_label = $1
          AND week_number  = $2
          AND year         = $3
          AND price_ghs IS NOT NULL
      `, [product.label, week_number, year]);

      const s = rows[0];
      if (!s || parseInt(s.total) === 0) continue;

      const avgPrice = parseFloat(s.avg_price) || 0;
      const total    = parseInt(s.total);

      log(`${product.label} → avg GHS ${avgPrice.toFixed(2)} · ${total} listings`, '  ✓');
    }

    log('Weekly analyses complete ✓', '✓');
  } catch (err) {
    log(`Weekly analyses error: ${err.message}`, '✗');
  } finally {
    await pool.end();
  }
}

function buildInsights(label, stats, priceTrend, volumeTrend, week, year) {
  const avg   = parseFloat(stats.avg_price) || 0;
  const total = parseInt(stats.total)        || 0;
  const lines = [];

  lines.push(`📊 Week ${week}, ${year} — ${label} Market Survey`);
  lines.push(`Survey recorded ${total} listings from Ghana's online marketplaces.`);
  lines.push(`Average asking price: GHS ${avg.toFixed(2)} (median: GHS ${parseFloat(stats.median_price || 0).toFixed(2)})`);
  lines.push(`Range: GHS ${parseFloat(stats.min_price || 0).toFixed(2)} – GHS ${parseFloat(stats.max_price || 0).toFixed(2)}`);

  if (priceTrend !== null) {
    const dir = priceTrend > 0 ? '📈 Up' : priceTrend < 0 ? '📉 Down' : '➡ Flat';
    lines.push(`${dir} ${Math.abs(priceTrend)}% vs previous week.`);
  }
  if (volumeTrend !== null) {
    lines.push(`Listing volume ${volumeTrend > 0 ? '↑' : '↓'} ${Math.abs(volumeTrend)}% week-over-week.`);
  }

  lines.push(`#SGDatalytics #GhanaMarket #${label.replace(/\s+/g, '')}`);
  return lines.join('\n');
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Market Price Pipeline — Jiji Only          ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  try {
    await runScrapers();
    await buildWeeklyAnalyses();
    log('Pipeline complete ✓', '🏁');
  } catch (err) {
    log(`Pipeline error: ${err.message}`, '✗');
  }
}

if (require.main === module) {
  run().catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { run, buildWeeklyAnalyses };
