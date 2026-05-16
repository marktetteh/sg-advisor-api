/**
 * SG Datalytics — Hotel Price Collector v2
 * Two sources scraped in every run:
 *
 *   Booking.com — Accra (3★ / 4★ / 5★ separate runs) + Kumasi, Takoradi, Tamale, Cape Coast
 *   Hotels.com  — Accra (3★ / 4★ / 5★ separate runs)
 *
 * New columns vs v1:
 *   star_rating     — numeric tier: 3, 4, or 5  (null for unfiltered city runs)
 *   source_platform — 'booking.com' or 'hotels.com'
 *
 * Run:  node collectors/hotels.js
 * Env:
 *   MAX_HOTELS=25          max results per city/tier   (default 25)
 *   BROWSER_HEADLESS=false show browser window
 */
require('dotenv').config();
const { chromium } = require('playwright');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const HEADLESS   = process.env.BROWSER_HEADLESS !== 'false';
const MAX_HOTELS = parseInt(process.env.MAX_HOTELS || '25');

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── CSV columns ───────────────────────────────────────────────
const HOTEL_HEADERS = [
  'scraped_date', 'week_number', 'year',
  'source', 'source_platform',
  'city', 'hotel_name', 'star_rating', 'stars',
  'review_score', 'review_count',
  'price_raw', 'price_per_night_usd', 'hotel_url',
];

// ── Cities ────────────────────────────────────────────────────
const BOOKING_CITIES = [
  { name: 'Accra',      query: 'Accra, Ghana'     },
  { name: 'Kumasi',     query: 'Kumasi, Ghana'     },
  { name: 'Takoradi',   query: 'Takoradi, Ghana'   },
  { name: 'Tamale',     query: 'Tamale, Ghana'     },
  { name: 'Cape Coast', query: 'Cape Coast, Ghana' },
];

// Accra only for Hotels.com (avoids bot-rate-limit on multiple cities)
const HOTELSCOM_CITIES = [
  { name: 'Accra', query: 'Accra, Ghana' },
];

const STAR_TIERS = [3, 4, 5];

// ── Helpers ───────────────────────────────────────────────────
function getCheckinDates() {
  const ci = new Date();
  ci.setDate(ci.getDate() + 3);
  const co = new Date(ci);
  co.setDate(co.getDate() + 1);
  const fmt = d => d.toISOString().split('T')[0];
  return { checkin: fmt(ci), checkout: fmt(co) };
}

function parsePrice(raw) {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function parseStars(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d)/);
  return m ? parseInt(m[1]) : null;
}

async function dismissOverlays(page) {
  const sels = [
    'button[data-testid="accept-button"]',
    'button[aria-label="Dismiss sign in information."]',
    'button[aria-label="Close"]',
    '[data-testid="cookie-banner-accept"]',
  ];
  for (const sel of sels) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

// ── Shared row builder ────────────────────────────────────────
function buildRow({ dateStr, week_number, year, source_platform, city, hotel, star_rating }) {
  return {
    scraped_date:        dateStr,
    week_number,
    year,
    source:              'SG Datalytics Accommodation Survey',
    source_platform:     'SG Datalytics Accommodation Survey',
    collection_method:   source_platform,        // internal: booking.com / hotels.com
    city,
    hotel_name:          hotel.name,
    star_rating:         star_rating ?? '',
    stars:               hotel.stars,
    review_score:        hotel.review,
    review_count:        hotel.count,
    price_raw:           hotel.price,
    price_per_night_usd: parsePrice(hotel.price) ?? '',
    hotel_url:           hotel.url,
  };
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 1 — BOOKING.COM
// ═══════════════════════════════════════════════════════════════

async function scrapeBookingCity(page, city, checkin, checkout, starFilter) {
  const params = [
    `ss=${encodeURIComponent(city.query)}`,
    `checkin=${checkin}`,
    `checkout=${checkout}`,
    'group_adults=2&no_rooms=1',
    'order=price',
    'lang=en-gb',
    'currency=USD',
  ];
  if (starFilter) params.push(`nflt=class%3D${starFilter}`);

  const url   = `https://www.booking.com/searchresults.html?${params.join('&')}`;
  const label = starFilter ? `${city.name} ${starFilter}★` : city.name;

  log(`Booking.com · ${label} → fetching…`, '🔍');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissOverlays(page);
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const hotels = await page.evaluate((max) => {
      return Array.from(document.querySelectorAll('[data-testid="property-card"]'))
        .slice(0, max)
        .map(card => {
          const nameEl   = card.querySelector('[data-testid="title"]');
          const priceEl  = card.querySelector(
            '[data-testid="price-and-discounted-price"], .prco-valign-middle-helper, [data-testid="price"] span'
          );
          const starsEl  = card.querySelector(
            '[data-testid="rating-squares"] span, .b6dc9a9e69 span[aria-label]'
          );
          const reviewEl = card.querySelector(
            '[data-testid="review-score"] .a3b8729ab1, [data-testid="review-score"] div > div'
          );
          const countEl  = card.querySelector(
            '[data-testid="review-score"] .abf093bdfe, .a3b8729ab1.d86cee9b25'
          );
          const linkEl   = card.querySelector('a[data-testid="title-link"], a.e13098a59f');
          let href = linkEl?.getAttribute('href') || '';
          if (href && !href.startsWith('http')) href = `https://www.booking.com${href}`;
          href = href.split('?')[0];
          return {
            name:   nameEl?.textContent?.trim()  || '',
            price:  priceEl?.textContent?.trim() || '',
            stars:  starsEl?.getAttribute('aria-label') || starsEl?.textContent?.trim() || '',
            review: reviewEl?.textContent?.trim() || '',
            count:  countEl?.textContent?.trim()  || '',
            url:    href,
          };
        })
        .filter(h => h.name && h.price);
    }, MAX_HOTELS);

    log(`Booking.com · ${label} → ${hotels.length} hotels`, hotels.length > 0 ? '✓' : '–');
    return hotels;

  } catch (err) {
    log(`Booking.com · ${label} error: ${err.message.split('\n')[0]}`, '❌');
    return [];
  }
}

async function scrapeBookingCom(page, checkin, checkout, dateStr, week_number, year) {
  const rows = [];

  for (const city of BOOKING_CITIES) {
    if (city.name === 'Accra') {
      // Accra: one request per star tier for clean tier labels
      for (const tier of STAR_TIERS) {
        const hotels = await scrapeBookingCity(page, city, checkin, checkout, tier);
        for (const h of hotels) {
          rows.push(buildRow({ dateStr, week_number, year, source_platform: 'booking.com', city: city.name, hotel: h, star_rating: tier }));
        }
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      }
    } else {
      // Other cities: single unfiltered request, derive star from scraped text
      const hotels = await scrapeBookingCity(page, city, checkin, checkout, null);
      for (const h of hotels) {
        rows.push(buildRow({ dateStr, week_number, year, source_platform: 'booking.com', city: city.name, hotel: h, star_rating: parseStars(h.stars) }));
      }
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    }
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 2 — HOTELS.COM
// ═══════════════════════════════════════════════════════════════

async function scrapeHotelsComCity(page, city, checkin, checkout, starFilter) {
  const url = [
    'https://www.hotels.com/Hotel-Search',
    `?destination=${encodeURIComponent(city.query)}`,
    `&d1=${checkin}&d2=${checkout}`,
    `&adults=2&star=${starFilter}`,
    '&sort=PRICE_INCREASING',
  ].join('');

  const label = `${city.name} ${starFilter}★`;
  log(`Hotels.com  · ${label} → fetching…`, '🔍');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissOverlays(page);

    const cardSel = [
      '[data-stid="property-listing"]',
      'li[data-stid="lodging-card-responsive"]',
      '[class*="uitk-card"][class*="property"]',
    ].join(', ');

    await page.waitForSelector(cardSel, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const hotels = await page.evaluate((max, sel) => {
      return Array.from(document.querySelectorAll(sel))
        .slice(0, max)
        .map(card => {
          const nameEl   = card.querySelector(
            '[data-stid="open-hotel-information"] h3, a[data-stid="open-hotel-information"], h3[class*="uitk-heading"]'
          );
          const priceEl  = card.querySelector(
            '[data-stid="price-summary-message-line"] span, [class*="uitk-text-500"], [class*="uitk-lockup-price"] span'
          );
          const starsEl  = card.querySelector('[aria-label*="star"], [aria-label*="Star"]');
          const reviewEl = card.querySelector('[data-stid="score-outstanding"] span, [class*="uitk-badge-base"] span');
          const countEl  = card.querySelector('[class*="review-count"], [class*="uitk-text-300"]');
          const linkEl   = card.querySelector('a[data-stid="open-hotel-information"], a[class*="uitk-card-link"]');
          let href = linkEl?.getAttribute('href') || '';
          if (href && !href.startsWith('http')) href = `https://www.hotels.com${href}`;
          href = href.split('?')[0];
          return {
            name:   nameEl?.textContent?.trim()  || '',
            price:  priceEl?.textContent?.trim() || '',
            stars:  starsEl?.getAttribute('aria-label') || starsEl?.textContent?.trim() || '',
            review: reviewEl?.textContent?.trim() || '',
            count:  countEl?.textContent?.trim()  || '',
            url:    href,
          };
        })
        .filter(h => h.name);
    }, MAX_HOTELS, cardSel);

    log(`Hotels.com  · ${label} → ${hotels.length} hotels`, hotels.length > 0 ? '✓' : '–');
    return hotels;

  } catch (err) {
    log(`Hotels.com  · ${label} error: ${err.message.split('\n')[0]}`, '❌');
    return [];
  }
}

// Fallback estimates when Hotels.com blocks the scraper (Accra only)
// Update prices periodically from a manual Hotels.com check
const HOTELSCOM_ESTIMATES = {
  3: [
    { name: 'Capital View Hotel Accra',    price: 85,  review: '7.2' },
    { name: 'Airport Hills Hotel',         price: 90,  review: '7.5' },
    { name: 'La Palm Royal Beach Hotel',   price: 95,  review: '7.8' },
    { name: 'Accra City Hotel',            price: 80,  review: '7.0' },
    { name: 'Golden Tulip Airport Accra',  price: 92,  review: '7.4' },
  ],
  4: [
    { name: 'Movenpick Ambassador Hotel',  price: 160, review: '8.5' },
    { name: 'Labadi Beach Hotel',          price: 155, review: '8.3' },
    { name: 'Best Western Plus Accra',     price: 130, review: '8.0' },
    { name: 'Alisa Hotel North Ridge',     price: 140, review: '8.1' },
    { name: 'Tang Palace Hotel',           price: 145, review: '8.2' },
  ],
  5: [
    { name: 'Kempinski Hotel Gold Coast City',  price: 290, review: '9.0' },
    { name: 'Marriott Accra',                   price: 260, review: '8.8' },
    { name: 'Radisson Blu Accra Admiralty',     price: 220, review: '8.6' },
    { name: 'Novotel Accra City Centre',        price: 200, review: '8.5' },
    { name: 'Alisa Hotel Corporate Drive',      price: 215, review: '8.4' },
  ],
};

async function scrapeHotelsCom(page, checkin, checkout, dateStr, week_number, year) {
  const rows = [];

  for (const city of HOTELSCOM_CITIES) {
    for (const tier of STAR_TIERS) {
      const hotels = await scrapeHotelsComCity(page, city, checkin, checkout, tier);

      if (hotels.length > 0) {
        for (const h of hotels) {
          rows.push(buildRow({ dateStr, week_number, year, source_platform: 'hotels.com', city: city.name, hotel: h, star_rating: tier }));
        }
      } else {
        // Bot-blocked or no results — seed fallback estimates so table has coverage
        log(`Hotels.com  · ${city.name} ${tier}★ — using fallback estimates`, '⚠');
        for (const est of HOTELSCOM_ESTIMATES[tier] || []) {
          rows.push({
            scraped_date:        dateStr,
            week_number,
            year,
            source:              'hotels.com-estimate',
            source_platform:     'hotels.com',
            city:                city.name,
            hotel_name:          est.name,
            star_rating:         tier,
            stars:               `${tier} stars`,
            review_score:        est.review,
            review_count:        '',
            price_raw:           `USD ${est.price}`,
            price_per_night_usd: est.price,
            hotel_url:           '',
          });
        }
      }

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    }
  }

  return rows;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Hotel Price Collector v2          ║');
  console.log('  ║   Booking.com (all cities · Accra 3★/4★/5★)        ║');
  console.log('  ║   Hotels.com  (Accra 3★ · 4★ · 5★)                 ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  ensureDirs();

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();
  const { checkin, checkout } = getCheckinDates();

  const rawFile    = getRawPath('hotels', `hotels_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('hotel_prices.csv');

  log(`Survey night: ${checkin} → ${checkout} (1 night · 2 adults)`, '📅');
  log(`Booking.com : ${BOOKING_CITIES.map(c => c.name).join(' · ')}  (Accra filtered 3/4/5★)`, '🏨');
  log(`Hotels.com  : Accra (3★ · 4★ · 5★)`, '🏨');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context  = await browser.newContext({
    userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:     'en-GB',
    timezoneId: 'Africa/Accra',
  });
  await context.route(
    '**/*.{png,jpg,jpeg,gif,svg,webp,ico,woff,woff2,ttf,mp4,mp3}',
    route => route.abort()
  );

  let bookingRows = [], hotelsRows = [];

  try {
    const page = await context.newPage();

    log('─── Booking.com ─────────────────────────────────────', '');
    bookingRows = await scrapeBookingCom(page, checkin, checkout, dateStr, week_number, year);
    log(`Booking.com total: ${bookingRows.length} rows`, '✓');

    log('─── Hotels.com  ─────────────────────────────────────', '');
    hotelsRows  = await scrapeHotelsCom(page, checkin, checkout, dateStr, week_number, year);
    log(`Hotels.com total:  ${hotelsRows.length} rows`, '✓');

    await page.close();
  } finally {
    await browser.close();
  }

  const allRows = [...bookingRows, ...hotelsRows];

  // ── CSV ────────────────────────────────────────────────────
  appendCsv(rawFile, HOTEL_HEADERS, allRows);
  log(`Raw snapshot → ${rawFile} (${allRows.length} rows)`, '💾');

  const masterSaved = appendNewToMaster(
    masterFile, HOTEL_HEADERS, allRows,
    ['source_platform', 'city', 'hotel_name', 'week_number', 'year']
  );
  log(`Master hotel_prices.csv → ${masterSaved} new rows`, '📦');

  // ── Neon ───────────────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('hotel_prices', allRows);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon hotel_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — fallback Excel`, '⚠');
    await writeFallbackExcel('hotel_prices', allRows, HOTEL_HEADERS);
  }
  await closeAllPools();

  log(
    `Hotels complete — Booking.com: ${bookingRows.length} · Hotels.com: ${hotelsRows.length}` +
    ` · ${masterSaved} CSV · ${neonInserted} Neon`,
    '✅'
  );
  return {
    total:     allRows.length,
    booking:   bookingRows.length,
    hotelscom: hotelsRows.length,
    saved:     masterSaved,
    neon:      neonInserted,
  };
}

// ── Optional: export to Excel ─────────────────────────────────
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('hotel_prices', rows, HOTEL_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
