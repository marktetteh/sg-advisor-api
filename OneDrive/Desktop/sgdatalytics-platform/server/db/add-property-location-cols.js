/**
 * Migration: add neighborhood and city columns to property_prices
 * Run once: node server/db/add-property-location-cols.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

async function migrate() {
  const connStr = process.env.NEON_PROPERTY;
  if (!connStr) { console.error('NEON_PROPERTY not set'); process.exit(1); }

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Neon property DB');

  const steps = [
    [`ALTER TABLE property_prices ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100)`, 'neighborhood column'],
    [`ALTER TABLE property_prices ADD COLUMN IF NOT EXISTS city          VARCHAR(100)`, 'city column'],
    [`CREATE INDEX IF NOT EXISTS idx_prop_neighborhood ON property_prices (neighborhood)`, 'neighborhood index'],
    [`CREATE INDEX IF NOT EXISTS idx_prop_city         ON property_prices (city)`,         'city index'],
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
