/**
 * Backfill: classify existing market_prices rows
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads all rows where item_type = 'product' AND brand IS NULL (un-classified),
 * runs classify() on each title, then batch-updates the DB.
 *
 * Run once after the migration:
 *   node server/db/backfill-classification.js
 *
 * Safe to re-run — only touches rows that haven't been classified yet.
 */
require('dotenv').config();
const { Pool } = require('pg');
const { classify } = require('../collectors/classifier');

const BATCH_SIZE = 200;
const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

async function backfill() {
  const connStr = process.env.NEON_MARKET_PRICES;
  if (!connStr) { console.error('❌  NEON_MARKET_PRICES not set'); process.exit(1); }

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  // Count rows needing backfill
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*) FROM market_prices WHERE item_type = 'product' AND brand IS NULL"
  );
  const total = parseInt(count);
  log(`${total.toLocaleString()} rows to classify`, '🔍');

  if (total === 0) {
    log('Nothing to do — all rows already classified!', '✅');
    await pool.end();
    return;
  }

  let offset = 0;
  let totalUpdated = 0;
  let totalAccessory = 0;
  let totalSparePart = 0;
  let totalService = 0;

  while (offset < total) {
    // Fetch a batch of unclassified rows
    const { rows } = await pool.query(
      "SELECT id, title FROM market_prices WHERE item_type = 'product' AND brand IS NULL ORDER BY id LIMIT $1 OFFSET $2",
      [BATCH_SIZE, offset]
    );

    if (!rows.length) break;

    // Classify each row
    const updates = rows.map(r => {
      const c = classify(r.title);
      if (c.item_type === 'accessory') totalAccessory++;
      else if (c.item_type === 'spare_part') totalSparePart++;
      else if (c.item_type === 'service') totalService++;
      return { id: r.id, ...c };
    });

    // Batch UPDATE via unnest
    const ids        = updates.map(u => u.id);
    const itemTypes  = updates.map(u => u.item_type);
    const brands     = updates.map(u => u.brand || null);
    const models     = updates.map(u => u.model || null);

    await pool.query(
      `UPDATE market_prices
         SET item_type = data.item_type,
             brand     = data.brand,
             model     = data.model
       FROM (
         SELECT
           UNNEST($1::bigint[])   AS id,
           UNNEST($2::text[])     AS item_type,
           UNNEST($3::text[])     AS brand,
           UNNEST($4::text[])     AS model
       ) AS data
       WHERE market_prices.id = data.id`,
      [ids, itemTypes, brands, models]
    );

    totalUpdated += rows.length;
    offset += BATCH_SIZE;

    const pct = Math.round((totalUpdated / total) * 100);
    log(`Batch ${Math.ceil(offset / BATCH_SIZE)}: ${totalUpdated}/${total} rows (${pct}%)`, '⚡');
  }

  await pool.end();

  log(`Backfill complete!`, '✅');
  log(`  product:    ${totalUpdated - totalAccessory - totalSparePart - totalService}`);
  log(`  accessory:  ${totalAccessory}`);
  log(`  spare_part: ${totalSparePart}`);
  log(`  service:    ${totalService}`);
}

backfill().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
