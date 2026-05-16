/**
 * SG Datalytics — Database Setup
 * Creates tables and seeds sectors, indicators, and commodities
 * Run: node db/setup.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');
const { SECTORS, INDICATORS, COMMODITIES } = require('../collectors/config');

const log = (msg, sym = '→') => console.log(`  ${sym} ${msg}`);

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n  ╔══════════════════════════════════════════════╗');
    console.log('  ║   SG DATALYTICS — Database Setup             ║');
    console.log('  ╚══════════════════════════════════════════════╝\n');

    // ── 1. Run schema ────────────────────────────────────────
    log('Creating tables…', '▶');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    log('Tables ready ✓', '✓');

    // ── 2. Seed sectors ──────────────────────────────────────
    log('Seeding sectors…', '▶');
    for (const s of SECTORS) {
      await client.query(`
        INSERT INTO sectors (code, name, icon, color, description)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (code) DO UPDATE
          SET name=EXCLUDED.name, icon=EXCLUDED.icon,
              color=EXCLUDED.color, description=EXCLUDED.description
      `, [s.code, s.name, s.icon, s.color, s.description]);
    }
    log(`${SECTORS.length} sectors seeded ✓`, '✓');

    // ── 3. Seed indicators ───────────────────────────────────
    log('Seeding indicators…', '▶');
    let indCount = 0;
    for (const ind of INDICATORS) {
      const sec = await client.query('SELECT id FROM sectors WHERE code=$1', [ind.sector]);
      const sectorId = sec.rows[0]?.id || null;
      await client.query(`
        INSERT INTO indicators (code, name, unit, fmt, sector_id, source, frequency, wb_code, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (code) DO UPDATE
          SET name=EXCLUDED.name, unit=EXCLUDED.unit, fmt=EXCLUDED.fmt,
              sector_id=EXCLUDED.sector_id, source=EXCLUDED.source,
              frequency=EXCLUDED.frequency, wb_code=EXCLUDED.wb_code
      `, [ind.code, ind.name, ind.unit, ind.fmt, sectorId,
          ind.source, ind.frequency, ind.wb_code || null, ind.description || null]);
      indCount++;
    }
    log(`${indCount} indicators seeded ✓`, '✓');

    // ── 4. Seed commodities ──────────────────────────────────
    log('Seeding commodities…', '▶');
    for (const c of COMMODITIES) {
      await client.query(`
        INSERT INTO commodities (code, name, category, unit)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (code) DO UPDATE
          SET name=EXCLUDED.name, category=EXCLUDED.category, unit=EXCLUDED.unit
      `, [c.code, c.name, c.category, c.unit]);
    }
    log(`${COMMODITIES.length} commodities seeded ✓`, '✓');

    // ── Summary ──────────────────────────────────────────────
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM sectors)    AS sectors,
        (SELECT COUNT(*) FROM indicators) AS indicators,
        (SELECT COUNT(*) FROM commodities) AS commodities
    `);
    const c = counts.rows[0];
    console.log('\n  ┌─────────────────────────────────┐');
    console.log(`  │  Sectors     : ${String(c.sectors).padStart(4)}              │`);
    console.log(`  │  Indicators  : ${String(c.indicators).padStart(4)}              │`);
    console.log(`  │  Commodities : ${String(c.commodities).padStart(4)}              │`);
    console.log('  └─────────────────────────────────┘');
    console.log('\n  Database ready! ✓\n');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
