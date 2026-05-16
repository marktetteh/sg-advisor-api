/**
 * Migration: add item_type, brand, model columns to market_prices
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once:  node server/db/add-classification-cols.js
 *
 * Safe to re-run — uses IF NOT EXISTS so it won't error if columns exist.
 */
require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const connStr = process.env.NEON_MARKET_PRICES;
  if (!connStr) {
    console.error('❌  NEON_MARKET_PRICES not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('🔌  Connected to Neon market_prices database');

    await client.query('BEGIN');

    // item_type: product | accessory | spare_part | service
    await client.query(`
      ALTER TABLE market_prices
        ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'product'
    `);
    console.log("✅  item_type column added (VARCHAR 20, default 'product')");

    // brand: canonical brand name
    await client.query(`
      ALTER TABLE market_prices
        ADD COLUMN IF NOT EXISTS brand VARCHAR(80)
    `);
    console.log('✅  brand column added (VARCHAR 80)');

    // model: best-effort model string
    await client.query(`
      ALTER TABLE market_prices
        ADD COLUMN IF NOT EXISTS model VARCHAR(150)
    `);
    console.log('✅  model column added (VARCHAR 150)');

    // Index item_type for fast filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_prices_item_type
        ON market_prices (item_type)
    `);
    console.log('✅  Index on item_type created');

    // Index brand for brand-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_prices_brand
        ON market_prices (brand)
    `);
    console.log('✅  Index on brand created');

    await client.query('COMMIT');
    console.log('\n🎉  Migration complete! market_prices now has item_type, brand, model columns.');
    console.log('   Existing rows default item_type = \'product\', brand = NULL, model = NULL.');
    console.log('   New scraped rows will be classified at ingestion time.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
