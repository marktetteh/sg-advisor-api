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
const { chromium } = require('playwright');
const { MARKET_PRODUCTS } = require('./config');
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
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '2');  // 2 keeps us under rate-limit
const HEADLESS    = process.env.BROWSER_HEADLESS !== 'false';
const PAGE_TIMEOUT = 60000;   // ms — applies to Playwright fallback

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

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// CSV columns — shared with Melcom
const MARKET_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source', 'collection_method',
  'product_category', 'search_label', 'title',
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
      log(`${tag} page ${p} axios error (${axiosErr.message}) — trying Playwright…`, '  ⚡');
      try {
        items = await scrapePagePlaywright(page, url);
      } catch (pwErr) {
        log(`${tag} page ${p} Playwright also failed: ${pwErr.message}`, '  –');
        break;
      }
    }

    if (!items.length) {
      log(`${tag} page ${p} → 0 results, stopping`, '  –');
      break;
    }

    results.push(...items);
    log(`${tag} page ${p} → ${items.length} listings`, '  ');

    // 3–5 s jitter between pages — stays under Jiji rate-limit
    if (p < MAX_PAGES) await jitterDelay(3000, 5000);
  }

  // Inter-product pause (stagger workers from each other)
  await jitterDelay(1500, 3000);

  log(`${tag} → ${results.length} total`, '✓');
  return results;
}

// ── Worker: grabs next product from shared queue ───────────────
async function worker(page, queue, dateStr, week_number, year, workerId, allRows) {
  while (true) {
    // Atomically claim next index
    const idx = queue.next++;
    if (idx >= queue.products.length) break;

    const product = queue.products[idx];
    const items   = await scrapeProduct(page, product, workerId);

    for (const item of items) {
      if (!item.url || !item.title) continue;
      const { item_type, brand, model } = classify(item.title);
      allRows.push({
        scraped_date:     dateStr,
        week_number,
        year,
        source:           'SG Datalytics Market Survey',
        collection_method:'jiji.com.gh',
        product_category: product.category,
        search_label:     product.label,
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
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  log(`Jiji scraper starting — ${MARKET_PRODUCTS.length} products · ${CONCURRENCY} parallel pages`, '🕷');
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

  // Shared mutable queue (plain object — no true threading, just async interleaving)
  const queue = { products: MARKET_PRODUCTS, next: 0 };
  const allRows = [];   // pushed to from all workers (JS is single-threaded, safe)

  try {
    // Spin up CONCURRENCY pages, run workers concurrently
    const pages   = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => context.newPage())
    );

    log(`${CONCURRENCY} pages opened — dispatching queue…`, '⚡');

    await Promise.all(
      pages.map((page, i) => worker(page, queue, dateStr, week_number, year, i + 1, allRows))
    );

    log(`All workers finished — ${allRows.length} rows collected`, '🏁');
  } finally {
    await browser.close();
  }

  // Deduplicate by listing_url within this run before saving.
  // The same URL can appear under multiple search labels when a listing
  // matches more than one search term — keep the first occurrence only.
  const seenUrls  = new Set();
  const uniqueRows = allRows.filter(r => {
    if (!r.listing_url || seenUrls.has(r.listing_url)) return false;
    seenUrls.add(r.listing_url);
    return true;
  });
  const dedupedOut = allRows.length - uniqueRows.length;
  if (dedupedOut > 0) log(`Deduped ${dedupedOut} cross-label duplicates (${uniqueRows.length} unique listings)`, '🔄');

  // AI enrichment — normalize brand/model/storage/normalized_name via Gemini Flash
  const enriched = await enrichListings(uniqueRows);

  // ── Quality gate: only keep rows with a normalized name ───
  const rowsToSave = enriched.filter(r => r.normalized_name && r.normalized_name.trim());
  const dropped = enriched.length - rowsToSave.length;
  if (dropped > 0) log(`Quality gate: dropped ${dropped} unenriched rows (no normalized_name)`, '🚫');

  // Save raw snapshot
  const rawSaved = appendCsv(rawFile, MARKET_HEADERS, rowsToSave);
  log(`Raw → ${rawFile} (${rawSaved} rows)`, '💾');

  // Append new rows to master (deduplicate by source + listing_url + week + year)
  const masterSaved = appendNewToMaster(
    masterFile, MARKET_HEADERS, rowsToSave,
    ['source', 'listing_url', 'week_number', 'year']
  );
  log(`Master market_prices.csv → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('market_prices', rowsToSave);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon market_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — writing fallback Excel`, '⚠');
    await writeFallbackExcel('market_prices', rowsToSave, MARKET_HEADERS);
  }
  await closeAllPools();

  log(`Jiji complete — ${allRows.length} scraped · ${masterSaved} CSV · ${neonInserted} Neon`, '✅');
  return { total: allRows.length, saved: masterSaved, neon: neonInserted };
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
