/**
 * SG Datalytics — Real Estate Product Group Reclassifier
 *
 * Reclassifies existing "Property For Sale" / "Property For Rent" / null
 * records in market_prices into specific sub-groups based on title patterns.
 *
 * Sub-groups assigned:
 *   Apartment For Rent   — flat/apartment/studio for rent
 *   House For Rent       — house/townhouse/villa for rent
 *   Chamber & Hall       — chamber & hall / single room self-contained for rent
 *   Single Room          — single room / boys quarters for rent
 *   Office Space         — office space/suite for rent or sale
 *   Warehouse            — warehouse/storage for rent or sale
 *   Commercial Property  — shop/store/showroom for rent or sale
 *   Apartment For Sale   — flat/apartment for sale
 *   House For Sale       — house/townhouse/villa for sale
 *   Land For Sale        — land/plot/acres for sale
 *
 * Usage:
 *   node server/db/reclassify-realestate.js           # dry run
 *   node server/db/reclassify-realestate.js --apply   # write to DB
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
});

const APPLY = process.argv.includes('--apply');

// ── Classification rules (checked in order — first match wins) ───────────────
// Each rule: { group, test: (title, lowerTitle) => bool }
const RULES = [
  // Commercial / non-residential (check before house/apartment to avoid misclassification)
  {
    group: 'Warehouse',
    test: t => /warehouse|storage facility|cold storage/i.test(t),
  },
  {
    group: 'Office Space',
    test: t => /office space|office suite|office complex|serviced office|co.?working/i.test(t),
  },
  {
    group: 'Commercial Property',
    test: t => /\bshop\b|showroom|retail space|store for (rent|sale)|commercial (property|space|building)|plaza|mall unit/i.test(t),
  },

  // Land
  {
    group: 'Land For Sale',
    test: t => /\bland\b|\bplot\b|\bacres?\b|\bperches?\b|land for sale|plot for sale/i.test(t),
  },

  // Rental types
  {
    group: 'Chamber & Hall',
    test: t => /chamber\s*(&|and)\s*hall|chamber hall/i.test(t),
  },
  {
    group: 'Single Room',
    test: t => /single room|boys?\s*quarter|self.?contained single|1 room self/i.test(t),
  },
  {
    group: 'Apartment For Rent',
    test: t => /(apartment|flat|studio|unit)\s+(for\s+rent|to\s+let)|(\d+\s*bed(room)?[a-z]*\s+(apartment|flat))/i.test(t) &&
               /rent|let/i.test(t),
  },
  {
    group: 'House For Rent',
    test: t => /(house|townhouse|villa|mansion|bungalow)\s+(for\s+rent|to\s+let)|(\d+\s*bed(room)?[a-z]*\s+(house|home))/i.test(t) &&
               /rent|let/i.test(t),
  },

  // Sale types
  {
    group: 'Apartment For Sale',
    test: t => /(apartment|flat|studio|unit)\s+for\s+sale|(\d+\s*bed(room)?[a-z]*\s+(apartment|flat))/i.test(t) &&
               /\bsale\b|selling/i.test(t),
  },
  {
    group: 'House For Sale',
    test: t => /(house|townhouse|villa|mansion|bungalow)\s+for\s+sale|(\d+\s*bed(room)?[a-z]*\s+(house|home))/i.test(t) &&
               /\bsale\b|selling/i.test(t),
  },

  // Bedroom-count fallback: "Xbdrm / X bed" in title — infer rent vs sale from existing group
  {
    group: '__bedroom_rent__',  // resolved below
    test: t => /\d+\s*bdr(m|oom)|\d+\s*bed(room)?/i.test(t) && /rent|let/i.test(t),
  },
  {
    group: '__bedroom_sale__',
    test: t => /\d+\s*bdr(m|oom)|\d+\s*bed(room)?/i.test(t) && /\bsale\b|selling/i.test(t),
  },
];

function classify(title, currentGroup) {
  if (!title) return null;

  for (const rule of RULES) {
    if (rule.test(title)) {
      if (rule.group === '__bedroom_rent__') {
        // Distinguish apartment vs house
        return /apartment|flat|studio/i.test(title) ? 'Apartment For Rent' : 'House For Rent';
      }
      if (rule.group === '__bedroom_sale__') {
        return /apartment|flat|studio/i.test(title) ? 'Apartment For Sale' : 'House For Sale';
      }
      return rule.group;
    }
  }

  // If no rule matched, try to preserve "For Rent" / "For Sale" direction
  if (/rent|let/i.test(title))   return 'House For Rent';
  if (/\bsale\b|selling/i.test(title)) return 'House For Sale';

  return null; // can't classify — leave as is
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Real Estate Product Group Reclassifier                     ║');
  console.log(`║   Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no changes)'}${' '.repeat(APPLY ? 34 : 31)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const { rows } = await pool.query(`
    SELECT id, title, product_group
    FROM market_prices
    WHERE product_category = 'Real Estate'
      AND is_flagged = FALSE
    ORDER BY id
  `);
  console.log(`  Loaded ${rows.length.toLocaleString()} Real Estate records.\n`);

  const changes   = [];
  const unchanged = [];
  const groupCounts = {};

  for (const row of rows) {
    const newGroup = classify(row.title, row.product_group);
    if (newGroup && newGroup !== row.product_group) {
      changes.push({ id: row.id, from: row.product_group, to: newGroup, title: row.title });
      groupCounts[newGroup] = (groupCounts[newGroup] || 0) + 1;
    } else {
      unchanged.push(row);
    }
  }

  // Report
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Reclassification Report                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total records    : ${String(rows.length).padEnd(41)}║`);
  console.log(`║  Will reclassify  : ${String(changes.length).padEnd(41)}║`);
  console.log(`║  Already correct  : ${String(unchanged.length).padEnd(41)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  New group distribution:                                     ║');
  for (const [group, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`║  ${group.padEnd(28)}: ${String(count).padEnd(31)}║`);
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Sample reclassifications:                                   ║');
  changes.slice(0, 8).forEach(c => {
    const title = (c.title || '').slice(0, 40).padEnd(40);
    console.log(`║  "${title}" → ${c.to}`);
  });
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!APPLY) {
    console.log('  DRY RUN complete. Run with --apply to write changes.\n');
    await pool.end();
    return;
  }

  if (!changes.length) {
    console.log('  Nothing to update.\n');
    await pool.end();
    return;
  }

  // Batch by target group for efficiency
  const byGroup = {};
  for (const c of changes) {
    if (!byGroup[c.to]) byGroup[c.to] = [];
    byGroup[c.to].push(c.id);
  }

  let updated = 0;
  for (const [group, ids] of Object.entries(byGroup)) {
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const placeholders = chunk.map((_, j) => `$${j + 2}`).join(',');
      await pool.query(
        `UPDATE market_prices SET product_group = $1 WHERE id IN (${placeholders})`,
        [group, ...chunk]
      );
      updated += chunk.length;
    }
    process.stdout.write(`\r  Updated... ${updated.toLocaleString()} / ${changes.length.toLocaleString()}`);
  }

  console.log(`\n\n  ✓ Done. ${changes.length.toLocaleString()} records reclassified.\n`);
  await pool.end();
}

main().catch(err => {
  console.error('\n[reclassify-realestate] Fatal:', err.message);
  process.exit(1);
});
