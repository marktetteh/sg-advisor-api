/**
 * SG Datalytics — Market Data Pipeline
 * Single entry point that runs all market data sources:
 *
 *   1. Jiji Ghana     → 1000 products  → market_prices.csv
 *   2. Melcom Ghana   → ~150 products  → market_prices.csv
 *   3. Esoko Ghana    → live API       → commodity_prices.csv
 *   4. Hotels         → Booking.com    → hotel_prices.csv
 *   5. Airbnb         → Airbnb.com     → airbnb_prices.csv
 *   6. Meqasa         → Meqasa.com     → property_prices.csv
 *
 * Run: node collectors/market-pipeline.js
 * Flags:
 *   --skip-jiji      skip Jiji scraper
 *   --skip-melcom    skip Melcom scraper
 *   --skip-esoko     skip Esoko commodity collector
 *   --skip-hotels    skip Hotel price collector
 *   --skip-airbnb    skip Airbnb collector
 *   --skip-meqasa    skip Meqasa scraper
 *   --market-only    run Jiji + Melcom only
 *   --esoko-only     run Esoko only
 *   --hotels-only    run Hotel collector only
 *   --airbnb-only    run Airbnb collector only
 *   --meqasa-only    run Meqasa scraper only
 */
require('dotenv').config();
const { ensureDirs, getDataDir } = require('./csv-utils');

const skipJiji   = process.argv.includes('--skip-jiji');
const skipMelcom = process.argv.includes('--skip-melcom');
const skipEsoko  = process.argv.includes('--skip-esoko')  || process.argv.includes('--market-only');
const skipHotels = process.argv.includes('--skip-hotels') || process.argv.includes('--market-only');
const skipAirbnb = process.argv.includes('--skip-airbnb') || process.argv.includes('--market-only');
const skipMeqasa = process.argv.includes('--skip-meqasa') || process.argv.includes('--market-only');
const esokoOnly  = process.argv.includes('--esoko-only');
const hotelsOnly = process.argv.includes('--hotels-only');
const airbnbOnly = process.argv.includes('--airbnb-only');
const meqasaOnly = process.argv.includes('--meqasa-only');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Market Pipeline                    ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  Sources:  Jiji · Melcom · Esoko · Hotels · Airbnb   ║');
  console.log('  ║            Meqasa (Ghana Real Estate)                ║');
  console.log('  ║  Output:   market_prices.csv · commodity_prices.csv  ║');
  console.log('  ║            hotel_prices.csv  · airbnb_prices.csv     ║');
  console.log('  ║            property_prices.csv                       ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  ensureDirs();
  const start = Date.now();
  const results = {};

  // ── 1. JIJI (1000 products incl. Real Estate) ────────────
  if (!skipJiji && !esokoOnly && !hotelsOnly && !airbnbOnly && !meqasaOnly) {
    console.log('\n  ── Jiji Ghana (500 products) ───────────────────────────');
    try {
      const { run: jijiRun } = require('./jiji');
      results.jiji = await jijiRun();
      log(`Jiji done — ${results.jiji.total} scraped, ${results.jiji.saved} new in master`, '✅');
    } catch (e) {
      log(`Jiji failed: ${e.message}`, '❌');
      results.jiji = { total: 0, saved: 0, error: e.message };
    }
  }

  // ── 2. MELCOM (~150 products) ─────────────────────────────
  if (!skipMelcom && !esokoOnly && !hotelsOnly && !airbnbOnly && !meqasaOnly) {
    console.log('\n  ── Melcom Ghana (retail prices) ────────────────────────');
    try {
      const { run: melcomRun } = require('./melcom');
      results.melcom = await melcomRun();
      log(`Melcom done — ${results.melcom.total} scraped, ${results.melcom.saved} new in master`, '✅');
    } catch (e) {
      log(`Melcom failed: ${e.message}`, '❌');
      results.melcom = { total: 0, saved: 0, error: e.message };
    }
  }

  // ── 3. ESOKO (live commodity prices — Esoko Marketplace API) ─
  if (!skipEsoko && !hotelsOnly && !airbnbOnly && !meqasaOnly) {
    console.log('\n  ── Esoko Ghana (agricultural commodity prices) ─────────');
    try {
      const { run: esokoRun } = require('./esoko');
      results.esoko = await esokoRun();
      log(`Esoko done — ${results.esoko.total} prices, ${results.esoko.saved} new in master`, '✅');
    } catch (e) {
      log(`Esoko failed: ${e.message}`, '❌');
      results.esoko = { total: 0, saved: 0, error: e.message };
    }
  }

  // ── 4. HOTELS (Booking.com — 5 cities) ───────────────────
  if (!skipHotels && !esokoOnly && !airbnbOnly && !meqasaOnly) {
    console.log('\n  ── Hotels Ghana (Booking.com — 5 cities) ───────────────');
    try {
      const { run: hotelsRun } = require('./hotels');
      results.hotels = await hotelsRun();
      log(`Hotels done — ${results.hotels.total} collected, ${results.hotels.saved} new in master`, '✅');
    } catch (e) {
      log(`Hotels failed: ${e.message}`, '❌');
      results.hotels = { total: 0, saved: 0, error: e.message };
    }
  }

  // ── 5. AIRBNB (Airbnb.com — 5 cities) ────────────────────
  if (!skipAirbnb && !esokoOnly && !hotelsOnly && !meqasaOnly) {
    console.log('\n  ── Airbnb Ghana (Airbnb.com — 5 cities) ────────────────');
    try {
      const { run: airbnbRun } = require('./airbnb');
      results.airbnb = await airbnbRun();
      log(`Airbnb done — ${results.airbnb.total} collected, ${results.airbnb.saved} new in master`, '✅');
    } catch (e) {
      log(`Airbnb failed: ${e.message}`, '❌');
      results.airbnb = { total: 0, saved: 0, error: e.message };
    }
  }

  // ── 6. MEQASA (Ghana real estate portal) ─────────────────
  if (!skipMeqasa && !esokoOnly && !hotelsOnly && !airbnbOnly) {
    console.log('\n  ── Meqasa Ghana (commercial + residential properties) ───');
    try {
      const { run: meqasaRun } = require('./meqasa');
      results.meqasa = await meqasaRun();
      log(`Meqasa done — ${results.meqasa.total} listings, ${results.meqasa.saved} new in master`, '✅');
    } catch (e) {
      log(`Meqasa failed: ${e.message}`, '❌');
      results.meqasa = { total: 0, saved: 0, error: e.message };
    }
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  // ── Summary ───────────────────────────────────────────────
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   Pipeline Complete                                   ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  if (results.jiji)   console.log(`  ║  Jiji    → ${String(results.jiji.total).padEnd(5)} scraped · ${String(results.jiji.saved).padEnd(5)} new          ║`);
  if (results.melcom) console.log(`  ║  Melcom  → ${String(results.melcom.total).padEnd(5)} scraped · ${String(results.melcom.saved).padEnd(5)} new          ║`);
  if (results.esoko)  console.log(`  ║  Esoko   → ${String(results.esoko.total).padEnd(5)} prices  · ${String(results.esoko.saved).padEnd(5)} new          ║`);
  if (results.hotels) console.log(`  ║  Hotels  → ${String(results.hotels.total).padEnd(5)} hotels  · ${String(results.hotels.saved).padEnd(5)} new          ║`);
  if (results.airbnb)  console.log(`  ║  Airbnb  → ${String(results.airbnb.total).padEnd(5)} listings · ${String(results.airbnb.saved).padEnd(5)} new          ║`);
  if (results.meqasa)  console.log(`  ║  Meqasa  → ${String(results.meqasa.total).padEnd(5)} listings · ${String(results.meqasa.saved).padEnd(5)} new          ║`);
  console.log(`  ║  Time: ${elapsed} min                                      ║`);
  console.log(`  ║  Data: ${getDataDir().slice(-45).padEnd(45)} ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  return results;
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
