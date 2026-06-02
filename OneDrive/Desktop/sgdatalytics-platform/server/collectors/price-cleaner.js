/**
 * SG Datalytics — Price Intelligence Cleaner
 * Three-layer price validation:
 *  Layer 1: Product-group floors (from Neon product_group_floors table)
 *           Falls back to category floors when product_group is NULL.
 *  Layer 2: IQR statistical outlier detection per product per week
 *  Layer 3: Title vs price consistency (price < 5% of product median)
 *
 * Plus: Week-on-week jump detection (reporting only, no deletions)
 *
 * Usage:
 *   const { loadGroupFloors, cleanRows, detectJumps } = require('./price-cleaner');
 *   const groupFloors = await loadGroupFloors();   // call once at startup
 *   const { kept, rejected } = cleanRows(rows, groupFloors);
 *   const jumps = detectJumps(currentStats, previousStats);
 */

const MIN_IQR_LISTINGS    = 8;    // min listings needed to apply IQR per product
const MEDIAN_PCT_THRESHOLD = 0.05; // flag if price < 5% of product median
const JUMP_THRESHOLD       = 0.50; // flag if week-on-week median moves > 50%

// ── LAYER 1a: Category price floors (fallback when product_group is NULL) ──
const CATEGORY_BOUNDS = {
  'Vehicles':           { min: 80_000 },
  'Electronics':        { min: 50     },
  'Appliances':         { min: 100    },
  'Building Materials': { min: 50     },
  'Health & Medical':   { min: 10     },
  'Vehicle Parts':      { min: 50     },
  'Home & Kitchen':     { min: 5      },
  'Furniture':          { min: 200    },
  'Sports & Fitness':   { min: 10     },
  'Food & FMCG':        { min: 1      },
  'Office & Education': { min: 100    },
  'Real Estate':        { min: 200    },
  'Security & Safety':  { min: 50     },
  'default':            { min: 1      },
};

// ── LAYER 1b: Load product_group_floors from Neon ────────────
/**
 * Fetches product_group -> min_price_ghs from Neon.
 * Returns a plain object: { 'Smartphone': 300, 'Air Conditioner': 1500, ... }
 * Pass the result into cleanRows() as the second argument.
 */
async function loadGroupFloors(pool) {
  try {
    const { rows } = await pool.query(
      'SELECT product_group, min_price_ghs FROM product_group_floors'
    );
    const floors = {};
    for (const r of rows) {
      floors[r.product_group] = parseFloat(r.min_price_ghs);
    }
    return floors;
  } catch (err) {
    console.warn('  [price-cleaner] Could not load product_group_floors from Neon:', err.message);
    return {};
  }
}

// ── HELPERS ───────────────────────────────────────────────────

function computeIQR(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  const n      = sorted.length;
  const q1     = sorted[Math.floor(n * 0.25)];
  const q3     = sorted[Math.floor(n * 0.75)];
  const iqr    = q3 - q1;
  return {
    q1, q3, iqr,
    lower: q1 - 1.5 * iqr,
    upper: q3 + 1.5 * iqr,
  };
}

function computeMedian(prices) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── BUILD PRODUCT MEDIAN REFERENCE MAP ───────────────────────
// Computes median price per search_label across all rows.
// Used by Layer 3 to catch listings priced way below the product norm.

function buildProductMedians(rows) {
  const groups = {};
  for (const row of rows) {
    const price = parseFloat(String(row.price_ghs).replace(/[^0-9.-]/g, ''));
    if (isNaN(price) || price <= 0) continue;
    if (!groups[row.search_label]) groups[row.search_label] = [];
    groups[row.search_label].push(price);
  }
  const medians = {};
  for (const [label, prices] of Object.entries(groups)) {
    medians[label] = computeMedian(prices);
  }
  return medians;
}

// ── MAIN CLEANER ──────────────────────────────────────────────

/**
 * Clean an array of market_prices rows through 3 layers.
 * @param {Array}  rows
 * @param {Object} groupFloors - map of product_group -> min_price_ghs (from loadGroupFloors)
 * @returns {{ kept: Array, rejected: Array }}
 */
function cleanRows(rows, groupFloors = {}) {
  const kept     = [];
  const rejected = [];

  // Pre-compute product medians for Layer 3 (use all rows as reference)
  const productMedians = buildProductMedians(rows);

  // ── Layer 1: Product-group floor (then category fallback) ─
  const afterLayer1 = [];
  for (const row of rows) {
    const price = parseFloat(String(row.price_ghs).replace(/[^0-9.-]/g, ''));
    if (isNaN(price) || price <= 0) {
      rejected.push({ ...row, reject_reason: 'no_price' });
      continue;
    }

    // Prefer product_group floor; fall back to category floor
    let minPrice;
    if (row.product_group && groupFloors[row.product_group] != null) {
      minPrice = groupFloors[row.product_group];
    } else {
      const bounds = CATEGORY_BOUNDS[row.product_category] || CATEGORY_BOUNDS['default'];
      minPrice = bounds.min;
    }

    if (price < minPrice) {
      rejected.push({ ...row, reject_reason: `below_floor_${minPrice}` });
      continue;
    }

    afterLayer1.push({ ...row, _price: price });
  }

  // ── Layer 3: Title vs price consistency ───────────────────
  // Runs before IQR so it removes bad anchors before IQR computes bounds
  const afterLayer3 = [];
  for (const row of afterLayer1) {
    const median = productMedians[row.search_label];
    if (median && median > 0) {
      const ratio = row._price / median;
      if (ratio < MEDIAN_PCT_THRESHOLD) {
        rejected.push({
          ...row,
          reject_reason: `title_price_mismatch_median_${Math.round(median)}`,
        });
        continue;
      }
    }
    afterLayer3.push(row);
  }

  // ── Layer 2: IQR per product per week ─────────────────────
  const groups = {};
  for (const row of afterLayer3) {
    const key = `${row.search_label}||${row.week_number}||${row.year}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  for (const [, groupRows] of Object.entries(groups)) {
    const prices = groupRows.map(r => r._price);

    if (prices.length < MIN_IQR_LISTINGS) {
      for (const row of groupRows) {
        const { _price, ...clean } = row;
        kept.push(clean);
      }
      continue;
    }

    const { lower, upper } = computeIQR(prices);

    for (const row of groupRows) {
      const { _price, ...clean } = row;
      if (row._price < lower) {
        rejected.push({ ...clean, reject_reason: `iqr_low_${Math.round(lower)}` });
      } else if (row._price > upper) {
        rejected.push({ ...clean, reject_reason: `iqr_high_${Math.round(upper)}` });
      } else {
        kept.push(clean);
      }
    }
  }

  return { kept, rejected };
}

// ── WEEK-ON-WEEK JUMP DETECTION ───────────────────────────────
/**
 * Compare current week stats to previous week stats.
 * Flags products where median price moved more than JUMP_THRESHOLD.
 *
 * @param {Array} currentStats  - rows from current market_stats_W##.csv
 * @param {Array} previousStats - rows from previous market_stats_W##.csv
 * @returns {Array} flagged - array of { search_label, prev, curr, pct_change }
 */
function detectJumps(currentStats, previousStats) {
  const prevMap = {};
  for (const row of previousStats) {
    const key = `${row.source}||${row.search_label}`;
    prevMap[key] = parseFloat(row.median_price_ghs);
  }

  const flagged = [];
  for (const row of currentStats) {
    const key    = `${row.source}||${row.search_label}`;
    const curr   = parseFloat(row.median_price_ghs);
    const prev   = prevMap[key];
    if (!prev || !curr || isNaN(prev) || isNaN(curr)) continue;

    const change = (curr - prev) / prev;
    if (Math.abs(change) >= JUMP_THRESHOLD) {
      flagged.push({
        search_label: row.search_label,
        source:       row.source,
        prev_median:  Math.round(prev),
        curr_median:  Math.round(curr),
        pct_change:   (change * 100).toFixed(1),
        direction:    change > 0 ? '▲ spike' : '▼ drop',
      });
    }
  }

  return flagged.sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));
}

// ── PRINT JUMP REPORT ─────────────────────────────────────────
function printJumpReport(jumps, weekStr) {
  if (!jumps.length) {
    console.log(`  ✓ No significant price jumps detected for ${weekStr}`);
    return;
  }
  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║   Week-on-Week Price Jumps — ${weekStr.padEnd(30)}║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  ${String(jumps.length).padEnd(5)} products moved >50% — review data quality          ║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  for (const j of jumps.slice(0, 15)) {
    const label  = j.search_label.slice(0, 22).padEnd(22);
    const prev   = `GHS ${j.prev_median.toLocaleString()}`.padEnd(14);
    const curr   = `GHS ${j.curr_median.toLocaleString()}`.padEnd(14);
    const change = `${j.direction} ${j.pct_change}%`;
    console.log(`  ║  ${label} ${prev}→ ${curr}${change}`);
  }
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);
}

// ── CLEAN REPORT ──────────────────────────────────────────────
function printCleanReport(kept, rejected, label = '') {
  const total = kept.length + rejected.length;
  console.log(`\n  ╔══════════════════════════════════════════════════╗`);
  console.log(`  ║   Price Cleaner Report ${label.padEnd(26)}║`);
  console.log(`  ╠══════════════════════════════════════════════════╣`);
  console.log(`  ║  Total input  : ${String(total).padEnd(31)}║`);
  console.log(`  ║  Kept         : ${String(kept.length).padEnd(31)}║`);
  console.log(`  ║  Rejected     : ${String(rejected.length).padEnd(31)}║`);
  console.log(`  ║  Rejection %  : ${(rejected.length / total * 100).toFixed(1).padEnd(30)}%║`);
  console.log(`  ╠══════════════════════════════════════════════════╣`);

  const reasons = {};
  for (const r of rejected) {
    let key = 'other';
    const reason = r.reject_reason || '';
    if (reason === 'no_price')              key = 'no_price';
    else if (reason.startsWith('below'))    key = 'floor';
    else if (reason.startsWith('iqr_low'))  key = 'iqr_low';
    else if (reason.startsWith('iqr_high')) key = 'iqr_high';
    else if (reason.startsWith('title'))    key = 'title_mismatch';
    reasons[key] = (reasons[key] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(reasons)) {
    console.log(`  ║  ${reason.padEnd(20)} : ${String(count).padEnd(27)}║`);
  }

  console.log(`  ╠══════════════════════════════════════════════════╣`);
  const catRej = {};
  for (const r of rejected) {
    catRej[r.product_category] = (catRej[r.product_category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catRej).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ║  ${(cat || 'unknown').slice(0, 20).padEnd(20)} : ${String(count).padEnd(27)}║`);
  }
  console.log(`  ╚══════════════════════════════════════════════════╝\n`);
}

module.exports = {
  loadGroupFloors,
  cleanRows,
  detectJumps,
  printCleanReport,
  printJumpReport,
  buildProductMedians,
  CATEGORY_BOUNDS,
  MIN_IQR_LISTINGS,
  JUMP_THRESHOLD,
};
