/**
 * SG Datalytics — Run All Collectors
 * Saves everything to local CSV + Neon, then generates weekly social media flyers.
 *
 * Run: node collectors/run-all.js
 * Flags:
 *   --no-market        skip market pipeline (Jiji, Melcom, Esoko, Hotels, Airbnb, Meqasa)
 *   --no-wb            skip World Bank
 *   --no-gse           skip Ghana Stock Exchange
 *   --no-mofa          skip MOFA agricultural prices
 *   --only-market      only run market pipeline
 *   --no-consolidate   skip weekly consolidation
 *   --no-flyer         skip flyer generation
 */
require('dotenv').config();
const { ensureDirs, getDataDir } = require('./csv-utils');

const skipMarket      = process.argv.includes('--no-market');
const skipWB          = process.argv.includes('--no-wb');
const skipGSE         = process.argv.includes('--no-gse');
const skipMOFA        = process.argv.includes('--no-mofa');
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

    // ── Ghana Stock Exchange (GSE) ──────────────────────────
    if (!skipGSE) {
      console.log('\n  ── Ghana Stock Exchange (GSE) ──────────────────');
      const gse = require('./gse');
      await gse.run().catch(e => console.error('  GSE error:', e.message));
    }

    // ── MOFA Agricultural Prices ────────────────────────────
    if (!skipMOFA) {
      console.log('\n  ── MOFA Agricultural Prices ────────────────────');
      const mofa = require('./mofa');
      await mofa.run().catch(e => console.error('  MOFA error:', e.message));
    }
  }

  // ── Market Pipeline (Jiji + Melcom + Esoko + Hotels + Airbnb + Meqasa) ─
  if (!skipMarket) {
    console.log('\n  ── Market Pipeline ─────────────────────────────');
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
