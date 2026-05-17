/**
 * SG Datalytics — Monthly Password Rotation
 * ─────────────────────────────────────────────────────────────
 * Run once a month to rotate all product role passwords.
 * Outputs new connection strings to copy and email subscribers.
 *
 * Run: node server/db/products/rotate-passwords.js
 * Env: NEON_MARKET_PRICES, NEON_PROPERTY, NEON_ACCOMMODATION,
 *      NEON_ECONOMIC, NEON_COMMODITIES
 */
require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

// ── Generate a strong readable password ──────────────────────
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$';
  let pass = '';
  for (let i = 0; i < 12; i++) pass += chars[crypto.randomInt(chars.length)];
  pass += special[crypto.randomInt(special.length)];
  pass += crypto.randomInt(10);
  return pass;
}

// ── Product role definitions ──────────────────────────────────
const PRODUCTS = [
  {
    name:    'SGMPI Consumer Prices',
    envKey:  'NEON_MARKET_PRICES',
    role:    'sgmpi_reader',
    views:   ['sgmpi_product'],
  },
  {
    name:    'Real Estate & Accommodation (Property DB)',
    envKey:  'NEON_PROPERTY',
    role:    'realestate_reader',
    views:   ['property_product'],
  },
  {
    name:    'Real Estate & Accommodation (Accommodation DB)',
    envKey:  'NEON_ACCOMMODATION',
    role:    'realestate_reader',
    views:   ['hotels_product', 'airbnb_product'],
  },
  {
    name:    'Macro & Commodities (Economic DB)',
    envKey:  'NEON_ECONOMIC',
    role:    'macro_reader',
    views:   ['economic_product', 'fx_product'],
  },
  {
    name:    'Macro & Commodities (Commodities DB)',
    envKey:  'NEON_COMMODITIES',
    role:    'macro_reader',
    views:   ['commodities_product', 'fuel_product'],
  },
];

// ── Parse host and dbname from a Neon connection string ───────
function parseConnStr(connStr) {
  try {
    const url = new URL(connStr);
    return { host: url.hostname, dbname: url.pathname.replace('/', '') };
  } catch {
    return { host: 'unknown', dbname: 'neondb' };
  }
}

// ── Rotate one role ───────────────────────────────────────────
async function rotateRole(product, newPassword) {
  const connStr = process.env[product.envKey];
  if (!connStr) {
    console.log(`  ⚠  ${product.envKey} not set — skipping`);
    return null;
  }

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(`ALTER ROLE ${product.role} WITH PASSWORD '${newPassword}'`);
    const { host, dbname } = parseConnStr(connStr);
    const newConnStr = `postgresql://${product.role}:${newPassword}@${host}/${dbname}?sslmode=require`;
    console.log(`  ✓  ${product.name} — password rotated`);
    return newConnStr;
  } catch (err) {
    console.log(`  ✗  ${product.name} — error: ${err.message.split('\n')[0]}`);
    return null;
  } finally {
    await pool.end();
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Monthly Password Rotation         ║');
  console.log(`  ║   ${month.padEnd(52)}║`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  // Generate one password per unique role
  const rolePasswords = {
    sgmpi_reader:     generatePassword(),
    realestate_reader: generatePassword(),
    macro_reader:      generatePassword(),
  };

  console.log('  Rotating passwords...\n');

  const results = {};

  for (const product of PRODUCTS) {
    const newPassword = rolePasswords[product.role];
    const connStr = await rotateRole(product, newPassword);
    if (connStr && !results[product.role]) {
      results[product.role] = { connStr, product };
    }
    // For realestate_reader and macro_reader: same role across 2 DBs
    // The connection strings differ by host — store both
    if (connStr && results[product.role] && results[product.role].connStr !== connStr) {
      if (!results[product.role].connStr2) {
        results[product.role].connStr2 = connStr;
      }
    }
  }

  // ── Print new connection strings ──────────────────────────
  console.log('\n  ══════════════════════════════════════════════════════');
  console.log('  NEW CONNECTION STRINGS — copy and email to subscribers');
  console.log('  ══════════════════════════════════════════════════════\n');

  console.log('  📦 PRODUCT 1 — SGMPI Consumer Prices (GHS 150/mo | $10/mo)');
  console.log('  Views: sgmpi_product');
  if (results['sgmpi_reader']) {
    console.log(`  ${results['sgmpi_reader'].connStr}`);
  }

  console.log('\n  📦 PRODUCT 2 — Real Estate & Accommodation (GHS 100/mo | $7/mo)');
  console.log('  Views: property_product, hotels_product, airbnb_product');
  console.log('  ⚠  This product has TWO connection strings (two separate databases):');
  if (results['realestate_reader']) {
    console.log(`  String 1 (Property):      ${results['realestate_reader'].connStr}`);
    if (results['realestate_reader'].connStr2) {
      console.log(`  String 2 (Accommodation): ${results['realestate_reader'].connStr2}`);
    }
  }

  console.log('\n  📦 PRODUCT 3 — Macro & Commodities (GHS 100/mo | $7/mo)');
  console.log('  Views: economic_product, fx_product, commodities_product, fuel_product');
  console.log('  ⚠  This product has TWO connection strings (two separate databases):');
  if (results['macro_reader']) {
    console.log(`  String 1 (Economic):    ${results['macro_reader'].connStr}`);
    if (results['macro_reader'].connStr2) {
      console.log(`  String 2 (Commodities): ${results['macro_reader'].connStr2}`);
    }
  }

  console.log('\n  📦 BUNDLE — All Three Products (GHS 200/mo | $14/mo)');
  console.log('  Send the subscriber all strings from Products 1, 2, and 3 above.');

  console.log('\n  ══════════════════════════════════════════════════════');
  console.log('  ACTION: Email new strings to ALL active subscribers now.');
  console.log('  Old strings are already dead — act fast.');
  console.log('  ══════════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
