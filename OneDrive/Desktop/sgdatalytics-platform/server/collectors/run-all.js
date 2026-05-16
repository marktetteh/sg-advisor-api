/**
 * SG Datalytics — Run All Collectors
 * Saves everything to local CSV + Neon, then generates weekly social media flyers.
 *
 * Run: node collectors/run-all.js
 * Flags:
 *   --no-market        skip Jiji + market pipeline
 *   --no-wb            skip World Bank
 *   --only-market      only Jiji + consolidate
 *   --no-consolidate   skip weekly consolidation
 *   --no-flyer         skip flyer generation
 */
require('dotenv').config();
const { ensureDirs, getDataDir } = require('./csv-utils');

const skipMarket      = process.argv.includes('--no-market');
const skipWB          = process.argv.includes('--no-wb');
const onlyMarket      = process.argv.includes('--only-market');
const skipConsolidate = process.argv.includes('--no-consolidate');
const skipFlyer       = process.argv.includes('--no-flyer');

async function main() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SG DATALYTICS — Full Collection Run        ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   Data → ${getDataDir().slice(-38).padEnd(38)} ║`);
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const start = Date.now();

  if (!onlyMarket) {
    // ── World Bank (API — fastest, cleanest) ────────────────
    if (!skipWB) {
      console.log('\n  ── World Bank ──────────────────────────────────');
      const wb = require('./worldbank');
      await wb.run().catch(e => console.error('  WB error:', e.message));
    }

    // ── Bank of Ghana ───────────────────────────────────────
    console.log('\n  ── Bank of Ghana ───────────────────────────────');
    const bog = require('./bog');
    await bog.run().catch(e => console.error('  BOG error:', e.message));

    // ── NPA Fuel Prices ─────────────────────────────────────
    console.log('\n  ── NPA Fuel Prices ─────────────────────────────');
    const npa = require('./npa');
    await npa.run().catch(e => console.error('  NPA error:', e.message));

    // ── Ghana Statistical Service ───────────────────────────
    console.log('\n  ── GSS ─────────────────────────────────────────');
    const gss = require('./gss');
    await gss.run().catch(e => console.error('  GSS error:', e.message));

    // Note: Esoko commodity prices run inside market-pipeline (step 3)
  }

  // ── Market Pipeline (Jiji 1000 + Melcom + Esoko) ─────────
  if (!skipMarket) {
    console.log('\n  ── Market Pipeline (Jiji 1000 + Melcom + Esoko) ────');
    const pipeline = require('./market-pipeline');
    await pipeline.run().catch(e => console.error('  Pipeline error:', e.message));

    // ── Consolidate ──────────────────────────────────────────
    if (!skipConsolidate) {
      console.log('\n  ── Weekly Consolidation ────────────────────────');
      const consolidate = require('./consolidate');
      await consolidate.run().catch(e => console.error('  Consolidate error:', e.message));
    }
  }

  // ── Weekly Social Media Flyers ───────────────────────────────
  // Runs after all Neon inserts are complete so queries see fresh data
  if (!skipFlyer) {
    console.log('\n  ── Weekly Flyer Generation ─────────────────────');
    const flyer = require('./generate-flyer');
    await flyer.run().catch(e => console.error('  Flyer error:', e.message));
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n  ✅ All collectors done in ${elapsed} min`);
  console.log(`  📁 Data saved to: ${getDataDir()}\n`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
