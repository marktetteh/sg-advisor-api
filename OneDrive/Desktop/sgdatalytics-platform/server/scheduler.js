/**
 * SG Datalytics — Scheduler
 * All collection on schedule → saves to local CSV
 * Run: node scheduler.js  (keep running with PM2 or forever)
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  SCHEDULE (Africa/Accra time)                                │
 * ├──────────────────────────────────────────────────────────────┤
 * │  Daily  07:00  BOG exchange rates + NPA fuel prices          │
 * │  Mon    07:00  GSS economic indicators                       │
 * │  Mon    08:00  Full Market Pipeline:                         │
 * │                → Jiji (518 products incl. Real Estate)       │
 * │                → Melcom (~150 products)                      │
 * │                → MoFA (50 commodities)                       │
 * │                → Hotels (Booking.com — 5 cities)             │
 * │                → Airbnb (5 cities)                           │
 * │                → Meqasa (13 property categories)             │
 * │  Mon    14:00  Consolidation + Report + Flyers               │
 * │  1st    05:30  World Bank + BOG full macro (IMF)             │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Pipeline timing rationale:
 *   Jiji 518 products @ ~3 pages each ≈ 2.5–3 hrs
 *   Melcom ~10 categories              ≈ 30 min
 *   MoFA (estimates fallback)          ≈ 5 min
 *   Hotels (Booking.com — 5 cities)   ≈ 5 min
 *   Airbnb (5 cities)                 ≈ 5 min
 *   Meqasa (13 categories)            ≈ 15 min
 *   Total pipeline window: ~4 hrs → report runs at 14:00
 */
require('dotenv').config();
const cron = require('node-cron');
const { getDataDir } = require('./collectors/csv-utils');

const log = (msg) => console.log(`  [${new Date().toLocaleString()}] ${msg}`);

console.log('\n  ╔════════════════════════════════════════════════════╗');
console.log('  ║   SG Datalytics Scheduler — Market Intelligence    ║');
console.log('  ╠════════════════════════════════════════════════════╣');
console.log('  ║  Daily  07:00  BOG exchange rates + NPA fuel       ║');
console.log('  ║  Mon    07:00  GSS economic indicators             ║');
console.log('  ║  Mon    08:00  Full Market Pipeline                ║');
console.log('  ║                → Jiji · Melcom · Esoko            ║');
console.log('  ║                → Hotels · Airbnb · Meqasa         ║');
console.log('  ║  Mon    14:00  Consolidation + Report + Flyers     ║');
console.log('  ║  1st    05:30  World Bank + BOG macro (IMF)        ║');
console.log('  ╠════════════════════════════════════════════════════╣');
console.log(`  ║  Data: ${getDataDir().slice(-43).padEnd(43)} ║`);
console.log('  ╚════════════════════════════════════════════════════╝\n');

log('Scheduler running — waiting for next trigger…');

// ── DAILY 07:00 — BOG Exchange Rates + NPA Fuel ──────────────
cron.schedule('0 7 * * *', async () => {
  log('▶ Daily: BOG exchange rates…');
  try {
    const { fetchExchangeRatesOnly } = require('./collectors/bog');
    await fetchExchangeRatesOnly();
    log('  ✓ BOG exchange rates done');
  } catch (e) { log(`  ✗ BOG: ${e.message}`); }

  log('▶ Daily: NPA fuel prices…');
  try {
    const { run } = require('./collectors/npa');
    await run();
    log('  ✓ NPA done');
  } catch (e) { log(`  ✗ NPA: ${e.message}`); }
}, { timezone: 'Africa/Accra' });

// ── WEEKLY MON 07:00 — GSS Economic Indicators ───────────────
// GSS publishes CPI monthly — weekly check catches it promptly
cron.schedule('0 7 * * 1', async () => {
  log('▶ Weekly: GSS CPI + economic indicators…');
  try {
    const { run } = require('./collectors/gss');
    await run();
    log('  ✓ GSS done');
  } catch (e) { log(`  ✗ GSS: ${e.message}`); }
}, { timezone: 'Africa/Accra' });

// ── WEEKLY MON 08:00 — Full Market Pipeline ───────────────────
// Jiji (500) + Melcom + MoFA run sequentially.
// Allow 5 hrs total → report trigger at 13:00.
cron.schedule('0 8 * * 1', async () => {
  log('▶ Weekly: Market Pipeline starting…');
  log('  → Jiji (500 products) + Melcom + MoFA');
  try {
    const { run } = require('./collectors/market-pipeline');
    const result = await run();
    const jijiTotal   = result.jiji?.total   || 0;
    const melcomTotal = result.melcom?.total  || 0;
    const mofaTotal   = result.mofa?.total    || 0;
    const hotelsTotal = result.hotels?.total  || 0;
    const airbnbTotal = result.airbnb?.total  || 0;
    const meqasaTotal = result.meqasa?.total  || 0;
    log(`  ✓ Pipeline done — Jiji: ${jijiTotal} · Melcom: ${melcomTotal} · MoFA: ${mofaTotal} · Hotels: ${hotelsTotal} · Airbnb: ${airbnbTotal} · Meqasa: ${meqasaTotal}`);
  } catch (e) { log(`  ✗ Market Pipeline: ${e.message}`); }
}, { timezone: 'Africa/Accra' });

// ── WEEKLY MON 14:00 — Consolidation + Report + Flyers ───────
// 6 hours after pipeline start — buffer for all 6 sources
cron.schedule('0 14 * * 1', async () => {
  log('▶ Weekly: Consolidating market data…');
  try {
    const { run } = require('./collectors/consolidate');
    const summary = await run();
    log(`  ✓ Consolidation done — ${summary.marketRows} listings, ${summary.masterNew} new`);
  } catch (e) { log(`  ✗ Consolidation: ${e.message}`); }

  log('▶ Weekly: Generating HTML report…');
  try {
    const { run } = require('./collectors/generate-report');
    const r = await run();
    log(`  ✓ Report → ${r.file}`);
  } catch (e) { log(`  ✗ Report: ${e.message}`); }

  log('▶ Weekly: Generating social media flyers…');
  try {
    const { run } = require('./collectors/generate-flyer');
    const f = await run();
    log(`  ✓ Flyers (${f.flyers.length}) → ${f.outDir}`);
  } catch (e) { log(`  ✗ Flyer: ${e.message}`); }
}, { timezone: 'Africa/Accra' });

// ── MONTHLY 1st 05:30 — World Bank + BOG Full Macro ──────────
// Annual/quarterly data — monthly refresh is sufficient
cron.schedule('30 5 1 * *', async () => {
  log('▶ Monthly: World Bank full refresh…');
  try {
    const { run: wb } = require('./collectors/worldbank');
    await wb();
    log('  ✓ World Bank done');
  } catch (e) { log(`  ✗ World Bank: ${e.message}`); }

  log('▶ Monthly: BOG macro indicators (IMF + WB + MPR)…');
  try {
    const { run: bog } = require('./collectors/bog');
    await bog();
    log('  ✓ BOG macro done');
  } catch (e) { log(`  ✗ BOG macro: ${e.message}`); }
}, { timezone: 'Africa/Accra' });
