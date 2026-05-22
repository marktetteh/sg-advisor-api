/**
 * SG Datalytics — Tonaton.com Scraper (API Edition)
 * Ghana's second-largest classifieds platform (owned by Jiji Group).
 *
 * Uses the Tonaton JSON API directly — no browser or HTML parsing needed.
 * API: GET https://tonaton.com/api_web/v1/listing?query=<q>&page=<n>
 * Returns 18 listings/page with structured price, location, condition data.
 *
 * Run: node collectors/tonaton.js
 * Env:
 *   MAX_PAGES=3    pages per product (default 3 → up to 54 listings/query)
 */
require('dotenv').config();
const axios           = require('axios');
const { MARKET_PRODUCTS } = require('./config');
const { parsePrice, normalizeCondition, cleanLocation } = require('./scraper-utils');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');
const { classify }        = require('./classifier');
const { enrichListings }  = require('./enricher');

const BASE_URL  = 'https://tonaton.com';
const API_URL   = BASE_URL + '/api_web/v1/listing';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '3');
const BATCH_SIZE = 50;   // flush to Neon/CSV every N products

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── User-agent pool ───────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];
function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

// Polite delay: 2–4s between API calls (no browser throttling needed)
function jitterDelay(minMs = 2000, maxMs = 4000) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

// ── Network health check ──────────────────────────────────────
function isNetworkUp() {
  return new Promise(resolve => {
    const dns = require('dns');
    dns.lookup('tonaton.com', err => resolve(!err));
  });
}

async function waitForNetwork() {
  const CHECK_INTERVAL = 30000;
  const MAX_WAIT_MS    = 3 * 60 * 60 * 1000;  // 3 hours max
  const started        = Date.now();
  log('Network appears to be down — waiting for connection to recover…', '📡');
  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    if (await isNetworkUp()) { log('Network restored — resuming scrape', '✅'); return true; }
    const waited = Math.round((Date.now() - started) / 1000);
    log(`Still offline (${waited}s elapsed) — retrying in 30s…`, '📡');
  }
  log('Network did not recover after 3 hours — stopping', '❌');
  return false;
}

function isNetworkError(err) {
  const msg = err && err.message ? err.message.toLowerCase() : '';
  return msg.includes('enotfound') || msg.includes('econnreset') ||
         msg.includes('econnrefused') || msg.includes('err_internet_disconnected') ||
         msg.includes('err_name_not_resolved') || msg.includes('etimedout');
}

// ── CSV column schema (matches market_prices Neon table) ──────
const MARKET_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source', 'collection_method',
  'product_category', 'search_label', 'title',
  'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
  'item_type', 'brand', 'model', 'storage', 'normalized_name',
];

// ── Extract condition string from Tonaton attrs array ─────────
// attrs = [{ name: 'Condition', value: 'Brand New' }, ...]
function extractCondition(attrs) {
  if (!Array.isArray(attrs)) return '';
  const condAttr = attrs.find(a => a.name && a.name.toLowerCase() === 'condition');
  return condAttr ? condAttr.value || '' : '';
}

// ── Fetch one page of results from the Tonaton API ────────────
async function fetchPage(query, page) {
  const url = API_URL + '?query=' + encodeURIComponent(query) + '&page=' + page;
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent':      randomUA(),
      'Accept':          'application/json',
      'Accept-Language': 'en-GH,en-GB;q=0.9,en;q=0.8',
      'Referer':         BASE_URL + '/search?query=' + encodeURIComponent(query),
    },
  });

  const list = resp.data && resp.data.adverts_list;
  if (!list || !Array.isArray(list.adverts)) return [];
  return list.adverts;
}

// ── Scrape one product across up to MAX_PAGES ─────────────────
async function scrapeProduct(product) {
  const results = [];
  log(`"${product.label}" starting…`, '▶');

  for (let p = 1; p <= MAX_PAGES; p++) {
    let adverts = [];
    try {
      adverts = await fetchPage(product.query, p);
    } catch (err) {
      if (isNetworkError(err)) {
        const recovered = await waitForNetwork();
        if (!recovered) break;
        try { adverts = await fetchPage(product.query, p); } catch(e) { break; }
      } else {
        log(`"${product.label}" page ${p} error: ${err.message}`, '  –');
        break;
      }
    }

    if (!adverts.length) {
      log(`"${product.label}" page ${p} → 0 results, stopping`, '  –');
      break;
    }

    results.push(...adverts);
    log(`"${product.label}" page ${p} → ${adverts.length} listings`, '  ');

    if (p < MAX_PAGES) await jitterDelay();
  }

  log(`"${product.label}" → ${results.length} total`, '✓');
  return results;
}

// ── Flush batch: dedup → enrich → CSV → Neon ─────────────────
async function flushBatch(batch, seenUrls, rawFile, masterFile, totals) {
  if (!batch.length) return;

  const unique = batch.filter(r => {
    if (!r.listing_url || seenUrls.has(r.listing_url)) return false;
    seenUrls.add(r.listing_url);
    return true;
  });
  const dupes = batch.length - unique.length;
  if (dupes > 0) log(`Dedup: removed ${dupes} duplicates (${unique.length} unique)`, '🔄');
  if (!unique.length) return;

  // AI enrichment (best-effort — save all rows even if Gemini fails)
  const enriched = await enrichListings(unique);

  const unenriched = enriched.filter(r => !r.normalized_name || !r.normalized_name.trim()).length;
  if (unenriched > 0) log(`${unenriched} rows saved without normalized_name (backfill later)`, '⚠');

  // Save to CSV
  const rawSaved    = appendCsv(rawFile, MARKET_HEADERS, enriched);
  const masterSaved = appendNewToMaster(masterFile, MARKET_HEADERS, enriched, ['source', 'listing_url', 'week_number', 'year']);
  log(`CSV: +${rawSaved} raw · +${masterSaved} master`, '💾');

  // Write to Neon
  try {
    const { inserted, errors } = await insertRows('market_prices', enriched);
    if (errors.length) log(`Neon warnings: ${errors.slice(0, 3).join('; ')}`, '⚠');
    totals.neon += inserted;
    log(`Neon: +${inserted} rows (total so far: ${totals.neon})`, '🐘');
  } catch (err) {
    log(`Neon insert failed: ${err.message} — saving fallback Excel`, '⚠');
    await writeFallbackExcel('market_prices', enriched, MARKET_HEADERS);
  }

  totals.scraped += batch.length;
  totals.saved   += masterSaved;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Tonaton Scraper (API Edition)     ║');
  console.log('  ║   Ghana Classifieds · JSON API · No browser needed  ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  log(`Products: ${MARKET_PRODUCTS.length} · Max pages: ${MAX_PAGES}/product · Batch flush every ${BATCH_SIZE}`, '⚙');
  ensureDirs();

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();
  const rawFile    = getRawPath('market', `tonaton_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('market_prices.csv');

  const seenUrls = new Set();
  const totals   = { scraped: 0, saved: 0, neon: 0 };
  let   batch    = [];

  for (let i = 0; i < MARKET_PRODUCTS.length; i++) {
    const product = MARKET_PRODUCTS[i];
    let adverts;

    try {
      adverts = await scrapeProduct(product);
    } catch (err) {
      if (isNetworkError(err)) {
        const recovered = await waitForNetwork();
        if (!recovered) break;
        try { adverts = await scrapeProduct(product); } catch(e) { adverts = []; }
      } else {
        log(`Product "${product.label}" failed: ${err.message}`, '❌');
        adverts = [];
      }
    }

    for (const advert of adverts) {
      if (!advert.id || !advert.title) continue;

      const rawCondition = extractCondition(advert.attrs);
      const { item_type, brand, model } = classify(advert.title);

      // Construct a stable unique URL from the listing ID
      const listingUrl = BASE_URL + '/listing/' + advert.id;

      batch.push({
        scraped_date:     dateStr,
        week_number,
        year,
        source:           'SG Datalytics Market Survey',
        collection_method:'tonaton.com',
        product_category: product.category,
        search_label:     product.label,
        title:            advert.title,
        price_raw:        advert.price_title || '',
        price_ghs:        (advert.price_obj && advert.price_obj.value) || parsePrice(advert.price_title) || '',
        location:         cleanLocation(advert.region_item_text) || advert.region_name || '',
        condition:        normalizeCondition(rawCondition),
        listing_url:      listingUrl,
        item_type,
        brand:            brand || '',
        model:            model || '',
        storage:          '',
        normalized_name:  '',
      });
    }

    // Flush every BATCH_SIZE products
    if ((i + 1) % BATCH_SIZE === 0 || i === MARKET_PRODUCTS.length - 1) {
      log(`── Flushing batch (product ${i + 1}/${MARKET_PRODUCTS.length}) ──`, '📦');
      await flushBatch(batch, seenUrls, rawFile, masterFile, totals);
      batch = [];
    }

    // Inter-product pause — gentle on the API
    if (i < MARKET_PRODUCTS.length - 1) await jitterDelay(1500, 3000);
  }

  await closeAllPools();

  log(`Tonaton complete — ${totals.scraped} scraped · ${totals.saved} CSV · ${totals.neon} Neon`, '✅');
  return totals;
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
