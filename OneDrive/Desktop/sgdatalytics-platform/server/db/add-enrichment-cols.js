/**
 * Migration: add normalized_name and storage columns to market_prices
 * Run once: node server/db/add-enrichment-cols.js
 */
require('dotenv').config();
const { Client } = require('pg');

function cleanUrl(url) {
  return (url || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '');
}

async function migrate() {
  const connStr = cleanUrl(process.env.NEON_MARKET_PRICES);
  if (!connStr) { console.error('NEON_MARKET_PRICES not set'); process.exit(1); }

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Neon market_prices DB');

  const steps = [
    [`ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(200)`,    'normalized_name column'],
    [`ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS storage VARCHAR(50)`,             'storage column'],
    [`CREATE INDEX IF NOT EXISTS idx_market_prices_brand ON market_prices (brand)`,        'brand index (already exists — OK)'],
    [`CREATE INDEX IF NOT EXISTS idx_market_prices_model ON market_prices (LOWER(model))`, 'model index'],
    [`CREATE INDEX IF NOT EXISTS idx_market_prices_norm  ON market_prices (normalized_name)`, 'normalized_name index'],
  ];

  for (const [sql, label] of steps) {
    try {
      await client.query(sql);
      console.log(`  ✓ ${label}`);
    } catch (err) {
      console.log(`  ⚠ ${label}: ${err.message}`);
    }
  }

  await client.end();
  console.log('\nMigration complete.');
}

migrate().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
