/**
 * SG Datalytics — Airbnb Price Collector
 * Scrapes Airbnb for nightly rental prices across Ghana's major cities.
 * Tries embedded JSON (__NEXT_DATA__ / data-deferred-state) first,
 * falls back to DOM selectors after scroll-to-load.
 *
 * Run:  node collectors/airbnb.js
 * Env:
 *   MAX_LISTINGS=25         max results per city (default 25)
 *   BROWSER_HEADLESS=false  show browser window
 */
require('dotenv').config();
const { chromium } = require('playwright');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const HEADLESS     = process.env.BROWSER_HEADLESS !== 'false';
const MAX_LISTINGS = parseInt(process.env.MAX_LISTINGS || '25');

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── CSV columns ───────────────────────────────────────────────
const AIRBNB_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source',
  'city', 'listing_id', 'listing_name', 'room_type', 'price_raw',
  'price_ghs', 'rating', 'review_count', 'listing_url',
];

// ── Extract Airbnb listing ID from a /rooms/<id> URL ──────────
function extractListingId(url) {
  return url?.match(/\/rooms\/(\d+)/)?.[1] || '';
}

// ── Cities to survey ──────────────────────────────────────────
const CITIES = [
  { name: 'Accra',      query: 'Accra, Ghana'     },
  { name: 'Kumasi',     query: 'Kumasi, Ghana'     },
  { name: 'Takoradi',   query: 'Takoradi, Ghana'   },
  { name: 'Tamale',     query: 'Tamale, Ghana'     },
  { name: 'Cape Coast', query: 'Cape Coast, Ghana' },
];

// ── Date helpers ──────────────────────────────────────────────
function getStayDates() {
  const checkin  = new Date();
  checkin.setDate(checkin.getDate() + 7);   // 1 week ahead
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 2); // 2-night stay (better pricing signal)
  const fmt = d => d.toISOString().split('T')[0];
  return { checkin: fmt(checkin), checkout: fmt(checkout) };
}

function parsePrice(raw) {
  if (!raw) return null;
  // Handle GH₵ format: "GH₵2,567" → 2567  or  "GH₵1,283.50" → 1283.50
  const n = parseFloat(String(raw).replace(/GH₵/g, '').replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

// ── Extract listings from embedded JSON ───────────────────────
// Tries multiple known Airbnb JSON shapes across versions
function extractFromJson(json) {
  if (!json) return null;
  try {
    // Shape 1: __NEXT_DATA__ presentation.staysSearch
    const v1 = json?.props?.pageProps?.initialData?.data?.presentation
      ?.staysSearch?.results?.searchResults;
    if (v1?.length) return v1;

    // Shape 2: __NEXT_DATA__ direct staysSearch
    const v2 = json?.props?.pageProps?.initialData?.data
      ?.staysSearch?.results?.searchResults;
    if (v2?.length) return v2;

    // Shape 3: data-deferred-state niobe search results
    const niobeKeys = ['staysSearch', 'exploreSearch', 'homesSearch'];
    for (const key of niobeKeys) {
      const v3 = json?.data?.[key]?.results?.searchResults;
      if (v3?.length) return v3;
    }

    // Shape 4: data-deferred-state with nested sections
    const sections = json?.data?.presentation?.staysSearch?.results?.searchResults
      || json?.data?.presentation?.explore?.sections?.[0]?.items;
    if (sections?.length) return sections;

    // Shape 5: flat array at top level (some mobile API responses)
    if (Array.isArray(json?.searchResults)) return json.searchResults;

    return null;
  } catch { return null; }
}

function parseJsonListings(rawResults, max) {
  const out = [];
  for (const r of rawResults.slice(0, max * 2)) { // fetch extra, filter down
    if (out.length >= max) break;
    try {
      const listing  = r?.listing || r?.staysListing || r?.item?.listing || {};
      const pricing  = r?.pricingQuote || r?.price || r?.item?.pricingQuote || {};

      const name      = listing?.name || listing?.title || r?.name || '';
      const roomType  = listing?.roomAndPropertyType || listing?.roomType || '';
      const rating    = listing?.avgRatingLocalized || listing?.avgRating || '';
      const reviews   = listing?.reviewsCount ?? '';
      const id        = String(listing?.id || r?.listing?.id || '');
      const url       = id ? `https://www.airbnb.com/rooms/${id}` : '';

      // Price — look in several possible locations
      const priceRaw  = pricing?.displayPrice?.total?.amountFormatted
        || pricing?.rate?.amountFormatted
        || pricing?.structuredDisplayPrice?.primaryLine?.price
        || pricing?.price?.total?.formatted
        || r?.price?.total?.formatted
        || '';

      if (name && priceRaw) {
        out.push({ name, roomType, priceRaw: String(priceRaw), rating: String(rating), reviews: String(reviews), url, listing_id: id });
      }
    } catch { /* skip malformed entry */ }
  }
  return out;
}

// ── Scroll page to trigger lazy-loaded listings ───────────────
async function scrollToLoadMore(page) {
  // Scroll down in 4 steps, pausing so Airbnb can render new cards
  for (let i = 1; i <= 4; i++) {
    await page.evaluate((step) => {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo(0, (scrollHeight / 4) * step);
    }, i);
    await page.waitForTimeout(1200);
  }
  // Scroll back to top — some cards only enter the DOM once scrolled to
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
}

// ── Extract listings from DOM (fallback) ──────────────────────
async function extractFromDom(page, max) {
  return page.evaluate((max) => {
    const results = [];

    // Card containers — Airbnb uses data-testid or itemprop
    const cards = document.querySelectorAll(
      '[data-testid="card-container"], ' +
      '[itemprop="itemListElement"], ' +
      'div[class*="g1qv1ctd"], ' +
      '[data-testid="listing-card-wrapper"]'
    );

    for (const card of Array.from(cards).slice(0, max)) {
      // ── Title ──────────────────────────────────────────────
      const titleEl = card.querySelector(
        '[data-testid="listing-card-title"], ' +
        '[class*="t1jojoys"], ' +
        'div[class*="ln2bl2p"]'
      );

      // ── Price — find leaf SPAN containing GH₵ ─────────────
      let price = '';
      // Strategy 1: aria-label "GH₵X,XXX for N nights"
      const ariaSpan = Array.from(card.querySelectorAll('[aria-label]'))
        .find(el => /GH₵[\d,]+.*night/i.test(el.getAttribute('aria-label') || ''));
      if (ariaSpan) {
        const m = (ariaSpan.getAttribute('aria-label') || '').match(/GH₵([\d,]+)/);
        if (m) price = `GH₵${m[1]}`;
      }

      // Strategy 2: leaf SPAN whose text is exactly GH₵X,XXX (no children)
      if (!price) {
        const leafSpan = Array.from(card.querySelectorAll('span')).find(
          s => s.children.length === 0 && /^GH₵[\d,]+$/.test(s.textContent.trim())
        );
        if (leafSpan) price = leafSpan.textContent.trim();
      }

      // Strategy 3: any span/div with GH₵ in it
      if (!price) {
        const anyPrice = Array.from(card.querySelectorAll('span, div')).find(
          el => el.children.length === 0 && /GH₵\s*[\d,]+/.test(el.textContent)
        );
        if (anyPrice) {
          const m = anyPrice.textContent.match(/GH₵\s*([\d,]+)/);
          if (m) price = `GH₵${m[1]}`;
        }
      }

      // ── Rating ─────────────────────────────────────────────
      const ratingEl = card.querySelector(
        'span[class*="r4a59j5"], ' +
        'span[aria-label*="rating"], ' +
        'span[class*="t5sr6bp"]'
      );

      // ── Room type ──────────────────────────────────────────
      const typeEl = card.querySelector(
        '[data-testid="listing-card-subtitle"] span, ' +
        'span[class*="fb4nyux"]'
      );

      // ── Link + listing ID ──────────────────────────────────
      const linkEl = card.querySelector('a[href*="/rooms/"]');

      const name     = titleEl?.textContent?.trim() || '';
      const rating   = ratingEl?.textContent?.trim() || '';
      const roomType = typeEl?.textContent?.trim()   || '';
      let   url      = linkEl?.getAttribute('href')  || '';
      if (url && !url.startsWith('http')) url = `https://www.airbnb.com${url}`;
      url = url.split('?')[0];

      const listing_id = (url.match(/\/rooms\/(\d+)/) || [])[1] || '';

      if (name && price) {
        results.push({ name, roomType, priceRaw: price, rating, reviews: '', url, listing_id });
      }
    }
    return results;
  }, max);
}

// ── Scrape one city ───────────────────────────────────────────
async function scrapeCity(page, city, checkin, checkout) {
  const url = [
    'https://www.airbnb.com/s/',
    encodeURIComponent(city.query),
    '/homes',
    `?checkin=${checkin}`,
    `&checkout=${checkout}`,
    '&adults=2',
    '&tab_id=home_tab',
    '&refinement_paths%5B%5D=%2Fhomes',
    '&price_filter_input_type=0',
    '&channel=EXPLORE',
  ].join('');

  log(`${city.name} → fetching…`, '🏠');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Dismiss modals (translation prompt, sign-in, etc.)
    for (const sel of [
      'button[aria-label="Close"]',
      'button[data-testid="modal-container-close-button"]',
      'button[aria-label="Dismiss"]',
    ]) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    // Initial wait for first results to render
    await page.waitForTimeout(3500);

    // ── Try JSON extraction first (before scroll) ─────────
    let listings = [];
    let jsonSource = '';

    const json = await page.evaluate(() => {
      const el = document.getElementById('data-deferred-state') ||
                 document.getElementById('__NEXT_DATA__');
      if (!el) return null;
      try { return JSON.parse(el.textContent); } catch { return null; }
    });

    if (json) {
      const raw = extractFromJson(json);
      if (raw?.length) {
        listings = parseJsonListings(raw, MAX_LISTINGS);
        jsonSource = 'JSON';
      }
    }

    // ── Scroll to load more, then retry / do DOM fallback ──
    // Always scroll — even JSON results may be incomplete if Airbnb
    // only embeds the first page of results before lazy-loading the rest.
    await scrollToLoadMore(page);

    if (listings.length < MAX_LISTINGS) {
      // Re-try JSON after scroll in case more data was injected
      const json2 = await page.evaluate(() => {
        const el = document.getElementById('data-deferred-state') ||
                   document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch { return null; }
      });

      if (json2) {
        const raw2 = extractFromJson(json2);
        if (raw2?.length > (listings.length || 0)) {
          listings = parseJsonListings(raw2, MAX_LISTINGS);
          jsonSource = 'JSON(post-scroll)';
        }
      }
    }

    if (listings.length > 0) {
      log(`${city.name} → ${listings.length} listings (${jsonSource})`, '✓');
    }

    // ── DOM fallback if JSON yielded nothing ───────────────
    if (!listings.length) {
      await page.waitForSelector(
        '[data-testid="card-container"], [itemprop="itemListElement"], [data-testid="listing-card-wrapper"]',
        { timeout: 8000 }
      ).catch(() => {});
      listings = await extractFromDom(page, MAX_LISTINGS);
      log(`${city.name} → ${listings.length} listings (DOM)`, listings.length > 0 ? '✓' : '–');
    }

    // ── If DOM also short, do a second scroll pass ─────────
    if (listings.length < 10) {
      log(`${city.name} — only ${listings.length} found, scrolling again…`, '↻');
      await scrollToLoadMore(page);
      await page.waitForTimeout(2000);
      const domRetry = await extractFromDom(page, MAX_LISTINGS);
      if (domRetry.length > listings.length) {
        listings = domRetry;
        log(`${city.name} → ${listings.length} listings (DOM retry)`, '✓');
      }
    }

    return listings;

  } catch (err) {
    log(`${city.name} error: ${err.message}`, '❌');
    return [];
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Airbnb Price Collector             ║');
  console.log('  ║   Source: Airbnb.com  ·  Ghana major cities          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  ensureDirs();

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();
  const { checkin, checkout } = getStayDates();

  const rawFile    = getRawPath('hotels', `airbnb_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('airbnb_prices.csv');

  log(`Stay period : ${checkin} → ${checkout} (2 nights, 2 adults)`, '📅');
  log(`Cities      : ${CITIES.map(c => c.name).join(' · ')}`, '🌍');
  log(`Max/city    : ${MAX_LISTINGS}`, '⚙');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context  = await browser.newContext({
    userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:     'en-GB',
    timezoneId: 'Africa/Accra',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });

  await context.route('**/*.{png,jpg,jpeg,gif,webp,ico,mp4,mp3}', r => r.abort());

  const allRows = [];

  try {
    const page = await context.newPage();

    for (const city of CITIES) {
      const listings = await scrapeCity(page, city, checkin, checkout);

      for (const l of listings) {
        allRows.push({
          scraped_date:        dateStr,
          week_number,
          year,
          source:              'SG Datalytics Accommodation Survey',
          collection_method:   'airbnb.com',
          city:                city.name,
          listing_id:          l.listing_id || extractListingId(l.url),
          listing_name:        l.name,
          room_type:           l.roomType,
          price_raw:           l.priceRaw,
          price_ghs:           parsePrice(l.priceRaw) ?? '',
          rating:              l.rating,
          review_count:        l.reviews,
          listing_url:         l.url,
        });
      }

      // Polite delay between cities (4–6 s)
      await new Promise(r => setTimeout(r, 4000 + Math.random() * 2000));
    }

    await page.close();
  } finally {
    await browser.close();
  }

  // ── Save ──────────────────────────────────────────────────
  const rawSaved = appendCsv(rawFile, AIRBNB_HEADERS, allRows);
  log(`Raw snapshot → ${rawFile} (${rawSaved} rows)`, '💾');

  const masterSaved = appendNewToMaster(
    masterFile, AIRBNB_HEADERS, allRows,
    ['source', 'listing_id', 'week_number', 'year']
  );
  log(`Master airbnb_prices.csv → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('airbnb_prices', allRows);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon airbnb_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — writing fallback Excel`, '⚠');
    await writeFallbackExcel('airbnb_prices', allRows, AIRBNB_HEADERS);
  }
  await closeAllPools();

  log(`Airbnb complete — ${allRows.length} collected · ${masterSaved} CSV · ${neonInserted} Neon`, '✅');
  return { total: allRows.length, saved: masterSaved, neon: neonInserted };
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('airbnb_prices', rows, AIRBNB_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
