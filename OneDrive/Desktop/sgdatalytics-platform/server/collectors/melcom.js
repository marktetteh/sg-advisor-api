/**
 * SG Datalytics — Melcom Ghana Scraper (GraphQL Edition)
 * Uses Melcom's Magento 2 GraphQL API — no browser required.
 * Fetches products directly via /graphql with category_id filter.
 *
 * Run: node collectors/melcom.js
 * Env:
 *   PAGE_SIZE=50            products per GraphQL page (default 50)
 *   MAX_PAGES=3             GraphQL pages per category (default 3)
 *   BROWSER_HEADLESS=false  (unused — no browser needed)
 *
 * Previous broken approach: Playwright DOM scraping returned "Quick view"
 * button text instead of product names because Magento 2's SPA doesn't
 * render the product grid even after networkidle + scroll wait.
 * BROKEN code kept below for reference — replaced with GraphQL.
 */
require('dotenv').config();
const axios = require('axios');
const { MELCOM_CATEGORIES } = require('./config');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const log       = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);
const BASE_URL  = 'https://melcom.com';
const GQL_URL   = `${BASE_URL}/graphql`;
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '50');
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '3');

// Same headers as jiji — shared master file
const MARKET_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source',
  'product_category', 'search_label', 'product_group', 'title',
  'price_raw', 'price_ghs', 'location', 'condition', 'listing_url',
];

// GraphQL headers — sent with every request
const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'Accept':       'application/json',
  'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Store':        'default',
};

// Parse GHS price value → number
function parsePrice(value) {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

// Clean product title — truncate at 200 chars
function cleanTitle(t) {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

// Derive search_label from product name
// e.g. "SAMSUNG GALAXY MOBILE A07 4GB 64GB (SM-A075F)" → "SAMSUNG GALAXY MOBILE A07 4GB 64GB"
function deriveLabel(title, maxLen = 60) {
  return title.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// Build product URL from url_key
function buildUrl(urlKey) {
  return urlKey ? `${BASE_URL}/${urlKey}.html` : BASE_URL;
}

// ── GraphQL product query ──────────────────────────────────────
function buildProductQuery(categoryId, pageSize, currentPage) {
  return {
    query: `{
      products(
        filter: { category_id: { eq: "${categoryId}" } }
        pageSize: ${pageSize}
        currentPage: ${currentPage}
        sort: { position: ASC }
      ) {
        total_count
        items {
          name
          sku
          url_key
          price_range {
            minimum_price {
              regular_price {
                value
                currency
              }
            }
          }
        }
      }
    }`,
  };
}

// ── Fetch all products in a category (paginated) ───────────────
async function fetchCategory(catConfig) {
  const { categoryId, category, label } = catConfig;
  const allItems = [];

  log(`"${label}" (cat ${categoryId}) — fetching…`, '▶');

  let totalCount = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const { data } = await axios.post(
        GQL_URL,
        buildProductQuery(categoryId, PAGE_SIZE, page),
        { headers: GQL_HEADERS, timeout: 20000 }
      );

      if (data.errors?.length) {
        log(`  GraphQL errors: ${data.errors.map(e => e.message).join('; ')}`, '  ⚠');
        break;
      }

      const products = data?.data?.products;
      if (!products) { log(`  No products object in response`, '  –'); break; }

      if (totalCount === null) totalCount = products.total_count;

      const items = products.items || [];
      if (!items.length) { log(`  Page ${page}: 0 items — stopping`, '  –'); break; }

      allItems.push(...items);
      log(`  Page ${page}: ${items.length} items (total so far: ${allItems.length} / ${totalCount})`, '  ');

      // All pages fetched
      if (allItems.length >= totalCount) break;

      // Brief pause between pages
      await new Promise(r => setTimeout(r, 800));

    } catch (err) {
      log(`  Page ${page} error: ${err.message}`, '  ✗');
      break;
    }
  }

  log(`"${label}" → ${allItems.length} products`, '✓');
  return allItems;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Melcom Ghana Scraper (GraphQL)             ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();
  const rawFile    = getRawPath('market', `melcom_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('market_prices.csv');

  const allRows = [];

  for (const catConfig of MELCOM_CATEGORIES) {
    const items = await fetchCategory(catConfig);

    for (const item of items) {
      const priceVal = item.price_range?.minimum_price?.regular_price?.value;
      const price    = parsePrice(priceVal);
      if (!price) continue;

      const title = cleanTitle(item.name);
      if (!title) continue;

      const currency = item.price_range?.minimum_price?.regular_price?.currency || 'GHS';
      const priceRaw = `${currency} ${priceVal}`;

      allRows.push({
        scraped_date:     dateStr,
        week_number:      week_number,
        year:             year,
        source:           'SG Datalytics Market Survey',
        collection_method: 'melcom.com',
        product_category: catConfig.category,
        search_label:     deriveLabel(title),
        product_group:    catConfig.group || null,
        title:            title,
        price_raw:        priceRaw,
        price_ghs:        price,
        location:         'Nationwide',
        condition:        'Brand new',
        listing_url:      buildUrl(item.url_key),
      });
    }

    log(`${catConfig.label} complete — ${items.length} products`, '✓');

    // Polite pause between categories
    await new Promise(r => setTimeout(r, 1200));
  }

  if (allRows.length === 0) {
    log('No products scraped from Melcom — check GraphQL API or category IDs', '⚠');
    return { total: 0, saved: 0, neon: 0 };
  }

  // ── Deduplicate by listing_url (same product in multiple categories) ──
  const seenUrls   = new Set();
  const uniqueRows = allRows.filter(r => {
    if (!r.listing_url || seenUrls.has(r.listing_url)) return false;
    seenUrls.add(r.listing_url);
    return true;
  });
  const dedupedOut = allRows.length - uniqueRows.length;
  if (dedupedOut > 0) log(`Deduped ${dedupedOut} cross-category duplicates (${uniqueRows.length} unique)`, '🔄');

  // Save raw snapshot
  appendCsv(rawFile, MARKET_HEADERS, uniqueRows);
  log(`Raw → ${rawFile} (${uniqueRows.length} rows)`, '💾');

  // Append new to master (deduplicates by source+listing_url+week+year)
  const masterSaved = appendNewToMaster(
    masterFile, MARKET_HEADERS, uniqueRows,
    ['source', 'listing_url', 'week_number', 'year']
  );
  log(`Master market_prices.csv → ${masterSaved} new Melcom rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('market_prices', uniqueRows);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon market_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — writing fallback Excel`, '⚠');
    await writeFallbackExcel('market_prices', uniqueRows, MARKET_HEADERS);
  }
  await closeAllPools();

  log(`Melcom complete — ${uniqueRows.length} products · ${masterSaved} CSV · ${neonInserted} Neon`, '✅');
  return { total: uniqueRows.length, saved: masterSaved, neon: neonInserted };
}

// ── TEST MODE — print 10 sample rows ──────────────────────────
async function testRun() {
  console.log('\n  [TEST MODE] Fetching sample Melcom products via GraphQL…\n');
  const rows = [];

  // Test 3 categories
  const testCats = MELCOM_CATEGORIES.slice(0, 3);
  for (const cat of testCats) {
    const items = await fetchCategory({ ...cat });
    for (const item of items.slice(0, 4)) {
      const price = item.price_range?.minimum_price?.regular_price?.value;
      rows.push({
        category: cat.category,
        label:    cat.label,
        title:    item.name,
        price:    `GHS ${price}`,
        url:      buildUrl(item.url_key),
      });
    }
    if (rows.length >= 10) break;
  }

  console.log('\n  Sample output (first 10):');
  rows.slice(0, 10).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.label}] ${r.title} | ${r.price}`);
    console.log(`     ${r.url}`);
  });
  return rows;
}

if (require.main === module) {
  const isTest = process.argv.includes('--test');
  if (isTest) {
    testRun().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
  } else {
    run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
  }
}

module.exports = { run, testRun };

// ── BROKEN — REPLACED: Playwright DOM scraping ────────────────
// The code below used Playwright (chromium) to navigate category pages
// and scrape product names/prices from the DOM. It returned "Quick view"
// button text as the product title because:
//   1. Melcom uses Magento 2 KnockoutJS SPA — products render via RequireJS
//      AFTER page load; even waitUntil:'networkidle' returns an empty grid
//   2. The selector [class*="product"] matched a hover-overlay .quick-view
//      wrapper rather than the actual product card
// Replaced with GraphQL API — returns real product data without any browser.
