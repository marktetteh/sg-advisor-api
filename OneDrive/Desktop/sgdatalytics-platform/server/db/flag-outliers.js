/**
 * SG Datalytics — Outlier Flagging Script
 *
 * Scans the market_prices table and sets is_flagged = TRUE for records that
 * are statistical outliers using the same IQR method as price-cleaner.js.
 *
 * Two passes:
 *   Pass 1 — Category hard ceilings: immediate flag for prices above a
 *             maximum that no legitimate listing in that category should exceed.
 *
 *   Pass 2 — IQR per product_group: groups rows by product_group, computes
 *             Q1/Q3/IQR, and flags records outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
 *             Only applied to groups with >= MIN_GROUP_SIZE listings so small
 *             groups (5–7 listings) aren't aggressively pruned.
 *
 * Usage:
 *   node server/db/flag-outliers.js            # dry run — prints report only
 *   node server/db/flag-outliers.js --apply    # writes is_flagged=TRUE to DB
 *   node server/db/flag-outliers.js --unflag   # resets ALL is_flagged to FALSE first, then re-flags
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
});

const APPLY   = process.argv.includes('--apply');
const UNFLAG  = process.argv.includes('--unflag');
const MIN_GROUP_SIZE = 8; // minimum listings needed to run IQR on a group

// Product groups where price variation is naturally extreme — a budget and a
// premium item can coexist legitimately. IQR would flag the premium ones as
// outliers even though they're real. Rely on category ceilings instead.
const IQR_EXEMPT_GROUPS = new Set([
  // Wide natural price range — premium and budget coexist legitimately
  'Medical Device', 'Hospital Equipment', 'Diagnostic Equipment',
  'Electrical', 'Generator', 'Solar Panel', 'Inverter',
  'Sports & Fitness', 'Gym Equipment', 'Exercise Equipment',
  'Small Kitchen Appliance', 'Kitchen Appliance',
  'Industrial Equipment', 'Heavy Equipment', 'Machinery',
  'Property For Sale', 'Property For Rent', 'Land',
  // Unit-of-measurement ambiguity — listings mix per-unit and per-batch pricing,
  // making IQR anchors unreliable. Category ceilings handle extreme errors instead.
  'Roofing', 'Tiles', 'Tile', 'Flooring', 'Scaffolding',
  'Cement', 'Paint', 'Sand', 'Gravel', 'Timber', 'Lumber',
]);

// ── Category hard ceilings ────────────────────────────────────────────────────
// Prices above these are almost certainly data errors regardless of IQR.
// Set conservatively high — we only want to catch the really egregious ones.
const CATEGORY_MAX = {
  'Vehicles':           2_000_000,   // GHS 2M for a car is extreme but possible
  'Electronics':          100_000,   // GHS 100k (high-end laptops/TVs)
  'Appliances':           150_000,   // GHS 150k (industrial appliances)
  'Building Materials':   500_000,   // GHS 500k (bulk material orders)
  'Health & Medical':     200_000,
  'Vehicle Parts':        100_000,
  'Home & Kitchen':        50_000,
  'Furniture':            100_000,
  'Sports & Fitness':      50_000,
  'Food & FMCG':           20_000,
  'Office & Education':    50_000,
  'Real Estate':        5_000_000,   // GHS 5M (luxury properties)
  'Security & Safety':    200_000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Using 3.0× IQR (extreme outlier threshold) instead of the standard 1.5×.
// Marketplace prices are right-skewed — premium products create a long legitimate
// tail, so 1.5× would incorrectly flag flagship phones, MacBooks, luxury TVs etc.
// 3.0× only catches genuinely absurd prices (data entry errors, misplaced decimals).
const IQR_MULTIPLIER = 3.0;

function computeIQR(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  const n  = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return {
    q1, q3, iqr,
    lower: Math.max(0, q1 - IQR_MULTIPLIER * iqr),
    upper: q3 + IQR_MULTIPLIER * iqr,
  };
}

function fmt(n) { return n?.toLocaleString('en-GH', { minimumFractionDigits: 0 }) ?? '—'; }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   SG Datalytics — Outlier Detection                         ║');
  console.log(`║   Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no changes)'}${' '.repeat(APPLY ? 34 : 31)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Optionally reset existing flags first
  if (UNFLAG && APPLY) {
    console.log('  Resetting all is_flagged = FALSE...');
    await pool.query('UPDATE market_prices SET is_flagged = FALSE');
    console.log('  Done.\n');
  }

  // Fetch all non-null prices
  console.log('  Loading records from market_prices...');
  const { rows: allRows } = await pool.query(`
    SELECT id, product_category, product_group, price_ghs, is_flagged
    FROM market_prices
    WHERE price_ghs IS NOT NULL
    ORDER BY product_group, price_ghs
  `);
  console.log(`  Loaded ${allRows.length.toLocaleString()} records.\n`);

  const toFlag   = new Set(); // IDs to flag
  const reasons  = {};        // reason -> count
  const groupLog = [];        // per-group summary for report

  // ── Pass 1: Category hard ceilings ───────────────────────────────────────
  let ceilingCount = 0;
  for (const row of allRows) {
    const max = CATEGORY_MAX[row.product_category];
    const price = parseFloat(row.price_ghs);
    if (max != null && price > max) {
      toFlag.add(row.id);
      reasons['above_category_ceiling'] = (reasons['above_category_ceiling'] || 0) + 1;
      ceilingCount++;
    }
  }
  console.log(`  Pass 1 — Category ceilings: ${ceilingCount} records flagged`);

  // ── Pass 2: IQR per product_group ────────────────────────────────────────
  const groups = {};
  for (const row of allRows) {
    if (toFlag.has(row.id)) continue; // already flagged, skip from IQR anchor
    const g = row.product_group || `__cat__${row.product_category}`;
    if (!groups[g]) groups[g] = [];
    groups[g].push({ id: row.id, price: parseFloat(row.price_ghs) });
  }

  let iqrFlagged = 0;
  for (const [group, rows] of Object.entries(groups)) {
    if (rows.length < MIN_GROUP_SIZE) continue;
    if (IQR_EXEMPT_GROUPS.has(group)) continue; // wide price range — ceiling handles this

    const prices = rows.map(r => r.price);
    const { lower, upper, q1, q3 } = computeIQR(prices);

    const flaggedInGroup = [];
    for (const row of rows) {
      if (row.price < lower) {
        toFlag.add(row.id);
        reasons['iqr_low'] = (reasons['iqr_low'] || 0) + 1;
        flaggedInGroup.push({ ...row, reason: `below GHS ${fmt(Math.round(lower))}` });
        iqrFlagged++;
      } else if (row.price > upper) {
        toFlag.add(row.id);
        reasons['iqr_high'] = (reasons['iqr_high'] || 0) + 1;
        flaggedInGroup.push({ ...row, reason: `above GHS ${fmt(Math.round(upper))}` });
        iqrFlagged++;
      }
    }

    if (flaggedInGroup.length) {
      groupLog.push({
        group,
        total: rows.length,
        flagged: flaggedInGroup.length,
        q1: Math.round(q1),
        q3: Math.round(q3),
        lower: Math.round(lower),
        upper: Math.round(upper),
        samples: flaggedInGroup.slice(0, 3).map(r => `GHS ${fmt(Math.round(r.price))}`),
      });
    }
  }
  console.log(`  Pass 2 — IQR per product group: ${iqrFlagged} records flagged\n`);

  // ── Report ────────────────────────────────────────────────────────────────
  const total = toFlag.size;
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Outlier Report                                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total to flag    : ${String(total).padEnd(41)}║`);
  for (const [reason, count] of Object.entries(reasons)) {
    console.log(`║  ${reason.padEnd(20)}: ${String(count).padEnd(39)}║`);
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Top affected product groups:                                ║');
  const topGroups = groupLog.sort((a, b) => b.flagged - a.flagged).slice(0, 15);
  for (const g of topGroups) {
    const name    = g.group.slice(0, 24).padEnd(24);
    const flagged = String(g.flagged).padEnd(4);
    const range   = `valid: GHS ${fmt(g.lower)}–${fmt(g.upper)}`;
    console.log(`║  ${name} ${flagged} ${range}`);
  }
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── Apply ─────────────────────────────────────────────────────────────────
  if (!APPLY) {
    console.log('  DRY RUN complete. Run with --apply to write changes to the database.\n');
    await pool.end();
    return;
  }

  if (total === 0) {
    console.log('  Nothing to flag. Database is clean.\n');
    await pool.end();
    return;
  }

  // Batch updates in chunks of 500 to avoid huge IN(...) clauses
  const ids = [...toFlag];
  const BATCH = 500;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const placeholders = chunk.map((_, j) => `$${j + 1}`).join(',');
    await pool.query(
      `UPDATE market_prices SET is_flagged = TRUE WHERE id IN (${placeholders})`,
      chunk
    );
    updated += chunk.length;
    process.stdout.write(`\r  Flagging... ${updated.toLocaleString()} / ${total.toLocaleString()}`);
  }

  console.log(`\n\n  ✓ Done. ${total.toLocaleString()} records flagged in the database.\n`);
  await pool.end();
}

main().catch(err => {
  console.error('\n[flag-outliers] Fatal error:', err.message);
  process.exit(1);
});
