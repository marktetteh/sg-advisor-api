/**
 * SG Datalytics — Jiji.com.gh Scraper (Parallel Edition)
 * Runs CONCURRENCY workers simultaneously → fast parallel collection
 *
 * Primary method: axios + cheerio (Jiji renders HTML server-side — no JS needed)
 * Fallback:       Playwright (used only if axios returns no listings)
 *
 * Run: node collectors/jiji.js
 * Env:
 *   MAX_PAGES=3             pages to scrape per product (default 3)
 *   CONCURRENCY=2           parallel workers            (default 2 — lower = less blocking)
 *   BROWSER_HEADLESS=false  show browser window (fallback only)
 */
require('dotenv').config();
const axios      = require('axios');
const cheerio    = require('cheerio');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const { MARKET_PRODUCTS: _ALL_PRODUCTS } = require('./config');
const { parsePrice, normalizeCondition, cleanLocation } = require('./scraper-utils');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');
const { classify } = require('./classifier');
const { enrichListings } = require('./enricher');

const BASE_URL    = 'https://jiji.com.gh';
const MAX_PAGES   = parseInt(process.env.MAX_PAGES   || '3');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1');  // 1 = safest, avoids bot detection

// Optional: CATEGORY_FILTER=Furniture,"Food & FMCG","Sports & Fitness"
// Comma-separated list of product_category values to restrict the run to.
const _CAT_FILTER = process.env.CATEGORY_FILTER
  ? process.env.CATEGORY_FILTER.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
  : null;
const MARKET_PRODUCTS = _CAT_FILTER
  ? _ALL_PRODUCTS.filter(p => _CAT_FILTER.includes(p.category))
  : _ALL_PRODUCTS;
const HEADLESS    = process.env.BROWSER_HEADLESS !== 'false';
const PAGE_TIMEOUT = 60000;   // ms — applies to Playwright fallback
const BATCH_SIZE  = 50;       // flush to Neon/CSV every N products

// ── User-agent pool — rotated per request ────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

// Delay between requests: 3–5 s (avoids rate-limiting)
function jitterDelay(minMs = 3000, maxMs = 5000) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

// ── Network health check ──────────────────────────────────────
// Returns true if jiji.com.gh resolves, false otherwise
function isNetworkUp() {
  return new Promise(resolve => {
    const dns = require('dns');
    dns.lookup('jiji.com.gh', err => resolve(!err));
  });
}

// Waits until the network comes back — checks every 30s, gives up after 20 mins
async function waitForNetwork() {
  const CHECK_INTERVAL = 30000;      // 30 s between checks
  const MAX_WAIT_MS    = 3 * 60 * 60 * 1000;  // 3 hours max
  const started        = Date.now();

  log('Network appears to be down — waiting for connection to recover…', '📡');
  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    if (await isNetworkUp()) {
      log('Network restored — resuming scrape', '✅');
      return true;
    }
    const waited = Math.round((Date.now() - started) / 1000);
    log(`Still offline (${waited}s elapsed) — retrying in 30s…`, '📡');
  }
  log('Network did not recover after 3 hours — stopping', '❌');
  return false;
}

// Detects whether an error is a network-level failure (not a scraping block)
function isNetworkError(err) {
  const msg = err && err.message ? err.message.toLowerCase() : '';
  return msg.includes('enotfound') ||
         msg.includes('econnreset') ||
         msg.includes('econnrefused') ||
         msg.includes('err_internet_disconnected') ||
         msg.includes('err_name_not_resolved') ||
         msg.includes('network error') ||
         msg.includes('etimedout');
}

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// CSV columns — shared with Melcom
const MARKET_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source', 'collection_method',
  'product_category', 'search_label', 'product_group', 'title',
  'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
  'item_type', 'brand', 'model', 'storage', 'normalized_name',
];

// ── Axios+cheerio scrape (primary — Jiji is server-side rendered) ──
async function scrapePageAxios(url) {
  const { data: html } = await axios.get(url, {
    timeout: PAGE_TIMEOUT,
    headers: {
      'User-Agent':      randomUA(),
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GH,en-GB;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection':      'keep-alive',
      'Cache-Control':   'no-cache',
    },
  });

  const $ = cheerio.load(html);
  const items = [];

  $('.qa-advert-list-item').each((_, card) => {
    const $card    = $(card);
    const titleEl  = $card.find('.qa-advert-title, .b-advert-title-inner').first();
    const priceEl  = $card.find('.qa-advert-price, .b-list-advert__price-base').first();
    const locEl    = $card.find('.b-list-advert__region__text, .b-list-advert__region').first();
    let   href     = $card.attr('href') || '';
    if (href && !href.startsWith('http')) href = `${BASE_URL}${href}`;

    // Collect ALL attribute chip texts so normalizeCondition can scan through
    // them for a known condition label (Brand new / Used / Refurbished).
    // A card may have chips like ['Brand new', 'iPhone', 'Accra'] — we scan all.
    const condParts = [];
    $card.find('.b-list-advert__item-attr').each((_, el) => {
      const t = $(el).text().trim();
      if (t) condParts.push(t);
    });

    items.push({
      title:     titleEl.text().trim(),
      price_raw: priceEl.text().trim(),
      location:  locEl.text().trim(),
      condition: condParts.join(' | '),   // joined; normalizeCondition scans each part
      url:       href.split('?')[0] || href,
    });
  });

  return items;
}

// ── Playwright fallback (only when axios returns 0 listings) ────
async function scrapePagePlaywright(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
  await page.waitForSelector('.qa-advert-list-item', { timeout: 15000 }).catch(() => {});

  return page.evaluate(() => {
    const cards = document.querySelectorAll('.qa-advert-list-item');
    return Array.from(cards).map(card => {
      const titleEl = card.querySelector('.qa-advert-title, .b-advert-title-inner');
      const priceEl = card.querySelector('.qa-advert-price, .b-list-advert__price-base');
      const locEl   = card.querySelector('.b-list-advert__region__text, .b-list-advert__region');
      let   href    = card.getAttribute('href') || '';
      if (href && !href.startsWith('http')) href = `https://jiji.com.gh${href}`;

      // Scan ALL attribute chips — normalizeCondition picks the known condition label
      const condParts = Array.from(card.querySelectorAll('.b-list-advert__item-attr'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);

      return {
        title:     titleEl?.textContent?.trim() || '',
        price_raw: priceEl?.textContent?.trim() || '',
        location:  locEl?.textContent?.trim()   || '',
        condition: condParts.join(' | '),
        url:       href.split('?')[0] || href,
      };
    });
  });
}

// ── Scrape one product across up to MAX_PAGES ──────────────────
async function scrapeProduct(page, product, workerId) {
  const results = [];
  const tag = `[W${workerId}] "${product.label}"`;
  log(`${tag} starting…`, '▶');

  for (let p = 1; p <= MAX_PAGES; p++) {
    const jijiPath = product.jijiPath || '/search';
    const url = `${BASE_URL}${jijiPath}?query=${encodeURIComponent(product.query)}&start=${(p - 1) * 24}`;

    let items = [];
    try {
      // ── Primary: axios + cheerio (fast, no browser overhead) ──
      items = await scrapePageAxios(url);

      if (!items.length) {
        // ── Fallback: Playwright (handles JS-gated edge cases) ──
        log(`${tag} page ${p} axios→0, trying Playwright fallback…`, '  ⚡');
        items = await scrapePagePlaywright(page, url);
      }
    } catch (axiosErr) {
      // ── Network dropped? Wait for it to recover before continuing ──
      if (isNetworkError(axiosErr)) {
        const recovered = await waitForNetwork();
        if (!recovered) break;
        // Retry this page once after recovery
        try {
          items = await scrapePageAxios(url);
        } catch (retryErr) {
          log(`${tag} page ${p} still failing after recovery: ${retryErr.message}`, '  –');
          break;
        }
      } else {
        log(`${tag} page ${p} axios error (${axiosErr.message}) — trying Playwright…`, '  ⚡');
        try {
          items = await scrapePagePlaywright(page, url);
        } catch (pwErr) {
          if (isNetworkError(pwErr)) {
            const recovered = await waitForNetwork();
            if (!recovered) break;
          } else {
            log(`${tag} page ${p} Playwright also failed: ${pwErr.message}`, '  –');
            break;
          }
        }
      }
    }

    if (!items.length) {
      log(`${tag} page ${p} → 0 results, stopping`, '  –');
      break;
    }

    results.push(...items);
    log(`${tag} page ${p} → ${items.length} listings`, '  ');

    // 8–15 s jitter between pages — avoids Jiji bot detection
    if (p < MAX_PAGES) await jitterDelay(8000, 15000);
  }

  // Inter-product pause — longer gap between products
  await jitterDelay(5000, 10000);

  log(`${tag} → ${results.length} total`, '✓');
  return results;
}

// ── Flush a batch: dedup → enrich → save CSV → write Neon ─────
async function flushBatch(batch, seenUrls, rawFile, masterFile, totals) {
  if (!batch.length) return;

  // Dedup within batch + across previous batches (by listing_url)
  const unique = batch.filter(r => {
    if (!r.listing_url || seenUrls.has(r.listing_url)) return false;
    seenUrls.add(r.listing_url);
    return true;
  });
  const dedupedOut = batch.length - unique.length;
  if (dedupedOut > 0) log(`Batch dedup: removed ${dedupedOut} duplicates (${unique.length} unique)`, '🔄');
  if (!unique.length) return;

  // AI enrichment (best-effort — save all rows even if Gemini fails)
  const enriched = await enrichListings(unique);

  // Save ALL rows — unenriched rows will have normalized_name='' and can be backfilled later
  const toSave = enriched;
  const unenriched = enriched.filter(r => !r.normalized_name || !r.normalized_name.trim()).length;
  if (unenriched > 0) log(`${unenriched} rows saved without normalized_name (will backfill later)`, '⚠');
  if (!toSave.length) return;

  // Save to CSV
  const rawSaved    = appendCsv(rawFile, MARKET_HEADERS, toSave);
  const masterSaved = appendNewToMaster(masterFile, MARKET_HEADERS, toSave, ['source', 'listing_url', 'week_number', 'year']);
  log(`CSV: +${rawSaved} raw · +${masterSaved} master`, '💾');

  // Write to Neon
  try {
    const { inserted, errors } = await insertRows('market_prices', toSave);
    if (errors.length) log(`Neon warnings: ${errors.slice(0, 3).join('; ')}`, '⚠');
    totals.neon += inserted;
    log(`Neon: +${inserted} rows (total so far: ${totals.neon})`, '🐘');
  } catch (err) {
    log(`Neon insert failed: ${err.message} — saving fallback Excel`, '⚠');
    await writeFallbackExcel('market_prices', toSave, MARKET_HEADERS);
  }

  totals.scraped += batch.length;
  totals.saved   += masterSaved;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  log(`Jiji scraper starting — ${MARKET_PRODUCTS.length} products · ${CONCURRENCY} parallel pages · batch every ${BATCH_SIZE}`, '🕷');
  ensureDirs();

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Block images, fonts, media — speeds up each page load significantly
  await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico,woff,woff2,ttf,mp4,mp3}', route => route.abort());

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();
  const rawFile    = getRawPath('market', `jiji_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('market_prices.csv');

  const seenUrls = new Set();  // tracks duplicates across all batches
  const totals   = { scraped: 0, saved: 0, neon: 0 };
  let   batch    = [];         // current batch buffer
  let   page;

  try {
    page = await context.newPage();
    log(`Browser ready — dispatching ${MARKET_PRODUCTS.length} products…`, '⚡');

    for (let i = 0; i < MARKET_PRODUCTS.length; i++) {
      const product = MARKET_PRODUCTS[i];
      const items   = await scrapeProduct(page, product, 1);

      for (const item of items) {
        if (!item.url || !item.title) continue;
        const { item_type, brand, model } = classify(item.title);
        batch.push({
          scraped_date:     dateStr,
          week_number,
          year,
          source:           'SG Datalytics Market Survey',
          collection_method:'jiji.com.gh',
          product_category: product.category,
          search_label:     product.label,
          product_group:    product.group || null,
          title:            item.title,
          price_raw:        item.price_raw,
          price_ghs:        parsePrice(item.price_raw) ?? '',
          location:         cleanLocation(item.location) ?? '',
          condition:        normalizeCondition(item.condition),
          listing_url:      item.url,
          item_type,
          brand:            brand ?? '',
          model:            model ?? '',
          storage:          '',
          normalized_name:  '',
        });
      }

      // Flush every BATCH_SIZE products
      if ((i + 1) % BATCH_SIZE === 0 || i === MARKET_PRODUCTS.length - 1) {
        log(`── Flushing batch (products ${i - batch.length / 24 | 0}–${i + 1} of ${MARKET_PRODUCTS.length}) ──`, '📦');
        await flushBatch(batch, seenUrls, rawFile, masterFile, totals);
        batch = [];  // clear buffer — free memory
      }
    }

    log(`All products scraped — ${totals.scraped} rows collected`, '🏁');
  } finally {
    await browser.close();
    await closeAllPools();
  }

  log(`Jiji complete — ${totals.scraped} scraped · ${totals.saved} CSV · ${totals.neon} Neon`, '✅');
  return totals;
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('market_prices', rows, MARKET_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
