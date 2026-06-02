/**
 * SG Datalytics - Product Group Backfill
 * One-time script to populate the product_group column for all
 * existing market_prices rows in Neon.
 *
 * Run:  node collectors/backfill-product-groups.js
 * Dry:  node collectors/backfill-product-groups.js --dry-run
 */

require('dotenv').config();
const { Pool } = require('pg');
const { MARKET_PRODUCTS, MELCOM_CATEGORIES } = require('./config');

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const log = (msg) => console.log(`  [${new Date().toLocaleTimeString()}] ${msg}`);

function buildGroupMap() {
  const map = {};

  for (const p of MARKET_PRODUCTS) {
    if (p.label && p.group) map[p.label] = p.group;
  }

  for (const c of MELCOM_CATEGORIES) {
    if (c.label && c.group) map[c.label] = c.group;
  }

  const LEGACY = {
    'iPhone SE': 'Smartphone', 'iPhone': 'Smartphone',
    'Samsung Galaxy': 'Smartphone', 'Tecno Phone': 'Smartphone',
    'Infinix Phone': 'Smartphone', 'Infinix Hot 40': 'Smartphone',
    'Nokia Smartphone': 'Smartphone', 'Motorola Edge 40': 'Smartphone',
    'Huawei Nova 11': 'Smartphone', 'Vivo Y100': 'Smartphone',
    'Oppo A98': 'Smartphone', 'iPad': 'Tablet',
    'Laptop': 'Laptop', 'MacBook': 'Laptop',
    'Smart TV': 'Television', 'OLED TV': 'Television',
    'Nikon Camera': 'Camera', 'Camera Gimbal': 'Camera',
    'External SSD': 'Computer Monitor',
    'Vacuum Cleaner': 'Vacuum Cleaner',
    'Water Dispenser': 'Small Kitchen Appliance',
    'Juicer': 'Small Kitchen Appliance',
    'Dishwasher': 'Small Kitchen Appliance',
    'Sewing Machine': 'Small Kitchen Appliance',
    'Coffee Maker': 'Small Kitchen Appliance',
    'Bread Maker': 'Small Kitchen Appliance',
    'Gas Cooker 4-Burner': 'Cooker', 'Gas Cooker 6-Burner': 'Cooker',
    'Gas Cooker': 'Cooker', 'Standing Oven': 'Oven',
    'Commercial Chest Freezer': 'Freezer', 'Deep Freezer': 'Freezer',
    'Refrigerator': 'Refrigerator',
    'Daikin Air Conditioner': 'Air Conditioner',
    'Panasonic AC': 'Air Conditioner', 'Air Conditioner': 'Air Conditioner',
    'Cassette AC (Ceiling)': 'Air Conditioner',
    'Washing Machine': 'Washing Machine', 'Clothes Dryer': 'Clothes Dryer',
    'Hair Dryer': 'Personal Care', 'Beard Trimmer': 'Personal Care',
    'Electric Shaver': 'Personal Care', 'Hair Curling Iron': 'Personal Care',
    'Water Heater (Instant)': 'Small Kitchen Appliance',
    'Water Pump': 'Small Kitchen Appliance', 'Fan Heater': 'Fan',
    'Wine Cooler / Bar Fridge': 'Refrigerator',
    'Sofa / Sofa Set': 'Living Room Furniture', 'Mattress': 'Bedroom Furniture',
    'Bed Frame': 'Bedroom Furniture', 'Wardrobe': 'Bedroom Furniture',
    'Dining Table': 'Living Room Furniture', 'Office Chair': 'Office Furniture',
    'Office Desk': 'Office Furniture', 'Car Battery': 'Engine Components',
    'Motorcycle Battery': 'Motorcycle Parts',
    '3-Bed House (Accra)': 'Property For Sale',
    '4-Bed House For Sale (Accra)': 'Property For Sale',
    '5-Bed House (Accra)': 'Property For Sale',
    '3-Bed Apt (Accra)': 'Property For Sale',
    'Executive House East Legon': 'Property For Sale',
    'Serviced Apt (Accra)': 'Property For Rent',
    'Office Space (Accra)': 'Property For Rent',
    'Generator': 'Solar Equipment',
    'CCTV Camera': 'Security Camera', 'CCTV Camera System': 'Security Camera',
  };

  for (const [label, group] of Object.entries(LEGACY)) {
    if (!map[label]) map[label] = group;
  }

  return map;
}

async function run() {
  console.log('\n  SG Datalytics - Product Group Backfill');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE RUN (Neon update)') + '\n');

  const groupMap = buildGroupMap();
  log('Group map built: ' + Object.keys(groupMap).length + ' labels mapped');

  const { rows: labelRows } = await pool.query(
    `SELECT search_label, COUNT(*) as cnt
     FROM market_prices
     GROUP BY search_label
     ORDER BY cnt DESC`
  );

  log('Distinct search_labels in Neon: ' + labelRows.length);

  const toUpdate   = labelRows.filter(r => groupMap[r.search_label]);
  const noGroup    = labelRows.filter(r => !groupMap[r.search_label]);
  const updateRows = toUpdate.reduce((s, r) => s + parseInt(r.cnt), 0);
  const skipRows   = noGroup.reduce((s, r) => s + parseInt(r.cnt), 0);

  log('Will update: ' + toUpdate.length + ' labels -> ' + updateRows.toLocaleString() + ' rows');
  log('No group found: ' + noGroup.length + ' labels -> ' + skipRows.toLocaleString() + ' rows');

  if (noGroup.length) {
    console.log('\n  Labels with no group mapping (top 20):');
    for (const r of noGroup.slice(0, 20)) {
      console.log('    ' + (r.search_label || '').padEnd(45) + r.cnt + ' rows');
    }
    if (noGroup.length > 20) console.log('    ... and ' + (noGroup.length - 20) + ' more');
    console.log('');
  }

  if (DRY_RUN) {
    log('DRY RUN complete - ' + updateRows.toLocaleString() + ' rows would be updated');
    await pool.end();
    return;
  }

  log('Updating product_group in Neon...');
  let totalUpdated = 0;
  const CHUNK = 50;

  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK);
    const chunkLabels = chunk.map(r => r.search_label);
    const caseLines = [];
    const values = [];
    let idx = 1;

    for (const r of chunk) {
      caseLines.push('WHEN search_label = $' + idx + ' THEN $' + (idx + 1));
      values.push(r.search_label, groupMap[r.search_label]);
      idx += 2;
    }

    values.push(chunkLabels);
    const sql = `
      UPDATE market_prices
      SET product_group = CASE ${caseLines.join(' ')} END
      WHERE search_label = ANY($${idx})
        AND product_group IS NULL
    `;

    const res = await pool.query(sql, values);
    totalUpdated += res.rowCount;
    log('Updated ' + totalUpdated.toLocaleString() + ' rows so far...');
  }

  log('Backfill complete - ' + totalUpdated.toLocaleString() + ' rows updated');

  const { rows: check } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE product_group IS NOT NULL) as tagged,
       COUNT(*) FILTER (WHERE product_group IS NULL)     as untagged,
       COUNT(*) as total
     FROM market_prices`
  );
  const { tagged, untagged, total } = check[0];
  log('Final: ' + parseInt(tagged).toLocaleString() + ' tagged | ' +
      parseInt(untagged).toLocaleString() + ' untagged | ' +
      parseInt(total).toLocaleString() + ' total');

  await pool.end();
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
