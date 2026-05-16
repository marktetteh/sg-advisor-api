/**
 * SG Datalytics — Meqasa.com Property Scraper
 * Ghana's largest dedicated real estate portal.
 * Collects commercial sales, commercial rentals, residential sales & rentals.
 *
 * Run:  node collectors/meqasa.js
 * Env:
 *   MAX_PAGES=3            pages to click through per category (default 3)
 *   BROWSER_HEADLESS=false show browser window
 */
require('dotenv').config();
const { chromium } = require('playwright');
const { parsePrice } = require('./scraper-utils');
const {
  ensureDirs, appendCsv, getRawPath, getMasterPath,
  getDateStr, getWeekAndYear, getWeekStr, appendNewToMaster,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');
const { enrichPropertyListings } = require('./property-enricher');

const HEADLESS  = process.env.BROWSER_HEADLESS !== 'false';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '3');

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── CSV columns ───────────────────────────────────────────────
const MEQASA_HEADERS = [
  'scraped_date', 'week_number', 'year', 'source',
  'property_type', 'listing_type', 'title',
  'price_raw', 'price_ghs', 'location', 'neighborhood', 'city',
  'bedrooms', 'bathrooms', 'size_sqm', 'listing_url',
];

// ── Categories — verified working URLs ────────────────────────
const CATEGORIES = [
  // Commercial — For Sale
  { url: 'https://meqasa.com/offices-for-sale-in-ghana',             property_type: 'Office',       listing_type: 'For Sale' },
  { url: 'https://meqasa.com/shops-for-sale-in-ghana',               property_type: 'Shop / Store', listing_type: 'For Sale' },
  { url: 'https://meqasa.com/warehouses-for-sale-in-ghana',          property_type: 'Warehouse',    listing_type: 'For Sale' },
  { url: 'https://meqasa.com/commercial%20spaces-for-sale-in-ghana', property_type: 'Commercial',   listing_type: 'For Sale' },

  // Commercial — For Rent
  { url: 'https://meqasa.com/offices-for-rent-in-ghana',             property_type: 'Office',       listing_type: 'For Rent' },
  { url: 'https://meqasa.com/shops-for-rent-in-ghana',               property_type: 'Shop / Store', listing_type: 'For Rent' },
  { url: 'https://meqasa.com/warehouses-for-rent-in-ghana',          property_type: 'Warehouse',    listing_type: 'For Rent' },

  // Residential — For Sale
  { url: 'https://meqasa.com/houses-for-sale-in-ghana',              property_type: 'House',        listing_type: 'For Sale' },
  { url: 'https://meqasa.com/apartments-for-sale-in-ghana',          property_type: 'Apartment',    listing_type: 'For Sale' },
  { url: 'https://meqasa.com/townhouses-for-sale-in-ghana',          property_type: 'Townhouse',    listing_type: 'For Sale' },

  // Residential — For Rent
  { url: 'https://meqasa.com/houses-for-rent-in-ghana',              property_type: 'House',        listing_type: 'For Rent' },
  { url: 'https://meqasa.com/apartments-for-rent-in-ghana',          property_type: 'Apartment',    listing_type: 'For Rent' },

  // Land
  { url: 'https://meqasa.com/lands-for-sale-in-ghana',               property_type: 'Land',         listing_type: 'For Sale' },
];

// ── Extract all visible listing cards from current page ───────
async function extractCards(page) {
  return page.evaluate(() => {
    // Reveal all paginated divs (Meqasa hides pages 2+ as display:none)
    document.querySelectorAll('.filtRpg').forEach(el => {
      el.style.display = 'block';
    });

    const cards   = document.querySelectorAll('.mqs-featured-prop-inner-wrap');
    const results = [];

    cards.forEach(card => {
      const titleEl = card.querySelector('.mqs-prop-dt-wrapper h2 a');
      const priceEl = card.querySelector('p.h3');
      const bedEl   = card.querySelector('li.bed span');
      const bathEl  = card.querySelector('li.shower span');
      const sizeEl  = card.querySelector('li.area span');
      const linkEl  = card.querySelector('a[href]');

      // Title: use text content; fall back to link title attribute; never "undefined"
      const title = (titleEl?.textContent?.trim() || titleEl?.getAttribute('title')?.trim() || '');
      // Price text contains "Price" label prefix — strip it
      let price = priceEl?.textContent?.trim() || '';
      price = price.replace(/^Price\s*/i, '').replace(/\s+/g, ' ').trim();

      let href = linkEl?.getAttribute('href') || '';
      if (href && !href.startsWith('http')) href = `https://meqasa.com${href}`;
      href = href.split('?')[0]; // remove tracking params

      if (title && price && href) {
        results.push({
          title,
          price,
          bedrooms:  bedEl?.textContent?.trim()  || '',
          bathrooms: bathEl?.textContent?.trim() || '',
          size:      sizeEl?.textContent?.trim() || '',
          url:       href,
        });
      }
    });

    return results;
  });
}

// ── Extract location from title (e.g. "3 bed house for sale in Accra") ──
function extractLocation(title) {
  const match = title.match(/\bin\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

// ── Scrape one category (handles pagination via Next button) ──
async function scrapeCategory(page, cat) {
  const allResults = [];
  const seenUrls   = new Set();

  log(`"${cat.property_type} — ${cat.listing_type}" starting…`, '▶');

  await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2500);

  for (let p = 1; p <= MAX_PAGES; p++) {
    const items = await extractCards(page);

    let newCount = 0;
    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      allResults.push(item);
      newCount++;
    }

    log(`  page ${p} → ${newCount} new listings (${allResults.length} total)`, ' ');

    if (newCount === 0 || p >= MAX_PAGES) break;

    // Try clicking the "Next" pagination button
    const nextBtn = page.locator('a.next, a[rel="next"], .pagination a:has-text("Next"), a:has-text("›"), a:has-text("»")').first();
    const hasNext = await nextBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasNext) break;

    await nextBtn.click();
    await page.waitForTimeout(2500);
  }

  log(`"${cat.property_type} — ${cat.listing_type}" → ${allResults.length} total`, '✓');
  return allResults;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Meqasa Property Scraper           ║');
  console.log('  ║   Ghana Real Estate Portal · Commercial + Residential║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  ensureDirs();

  const { week_number, year } = getWeekAndYear();
  const weekStr    = getWeekStr(week_number, year);
  const dateStr    = getDateStr();

  const rawFile    = getRawPath('market', `meqasa_${weekStr}_${dateStr}.csv`);
  const masterFile = getMasterPath('property_prices.csv');

  log(`Categories : ${CATEGORIES.length}`, '⚙');
  log(`Max pages  : ${MAX_PAGES} per category`, '⚙');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context  = await browser.newContext({
    userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:     'en-GB',
    timezoneId: 'Africa/Accra',
  });
  await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico,woff,woff2,ttf,mp4,mp3}',
    r => r.abort());

  const allRows = [];
  const masterUrls = new Set(); // deduplicate across categories

  try {
    const page = await context.newPage();

    for (const cat of CATEGORIES) {
      try {
        const items = await scrapeCategory(page, cat);

        for (const item of items) {
          if (masterUrls.has(item.url)) continue;
          masterUrls.add(item.url);

          allRows.push({
            scraped_date:  dateStr,
            week_number,
            year,
            source:        'SG Datalytics Property Survey',
            collection_method: 'meqasa.com',
            property_type: cat.property_type,
            listing_type:  cat.listing_type,
            title:         item.title,
            price_raw:     item.price,
            price_ghs:     parsePrice(item.price) ?? '',
            location:      extractLocation(item.title),
            neighborhood:  '',
            city:          '',
            bedrooms:      item.bedrooms,
            bathrooms:     item.bathrooms,
            size_sqm:      item.size,
            listing_url:   item.url,
          });
        }
      } catch (err) {
        log(`Category "${cat.property_type}" failed: ${err.message}`, '❌');
      }

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    }

    await page.close();
  } finally {
    await browser.close();
  }

  // ── AI location enrichment ────────────────────────────────
  const enriched = await enrichPropertyListings(allRows);

  // ── Quality gate: only keep rows where at least city is known ─
  const rowsToSave = enriched.filter(r => r.city && r.city.trim());
  const dropped = enriched.length - rowsToSave.length;
  if (dropped > 0) log(`Quality gate: dropped ${dropped} rows with no city/location`, '🚫');

  // ── Save ──────────────────────────────────────────────────
  const rawSaved = appendCsv(rawFile, MEQASA_HEADERS, rowsToSave);
  log(`Raw snapshot → ${rawFile} (${rawSaved} rows)`, '💾');

  const masterSaved = appendNewToMaster(
    masterFile, MEQASA_HEADERS, rowsToSave,
    ['source', 'listing_url', 'week_number', 'year']
  );
  log(`Master property_prices.csv → ${masterSaved} new rows added`, '📦');

  // ── Write to Neon ─────────────────────────────────────────
  let neonInserted = 0;
  try {
    const { inserted, errors } = await insertRows('property_prices', rowsToSave);
    if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
    neonInserted = inserted;
    log(`Neon property_prices → ${inserted} rows inserted`, '🐘');
  } catch (err) {
    log(`Neon insert failed (${err.message}) — writing fallback Excel`, '⚠');
    await writeFallbackExcel('property_prices', rowsToSave, MEQASA_HEADERS);
  }
  await closeAllPools();

  log(`Meqasa complete — ${allRows.length} listings · ${masterSaved} CSV · ${neonInserted} Neon`, '✅');
  return { total: allRows.length, saved: masterSaved, neon: neonInserted };
}

// ── TEST MODE — print 10 sample rows without writing CSV/Neon ──
async function testRun() {
  console.log('\n  [TEST MODE] Fetching sample Meqasa listings…\n');
  const browser = await chromium.launch({ headless: true });
  const context  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico,woff,woff2,ttf}', r => r.abort());

  const allSamples = [];
  try {
    const page = await context.newPage();
    // Test 2 categories
    for (const cat of CATEGORIES.slice(0, 2)) {
      const items = await scrapeCategory(page, cat);
      for (const item of items.slice(0, 5)) {
        allSamples.push({ ...cat, ...item });
        if (allSamples.length >= 10) break;
      }
      if (allSamples.length >= 10) break;
    }
    await page.close();
  } finally {
    await browser.close();
  }

  console.log('\n  Sample output (first 10):');
  allSamples.slice(0, 10).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.property_type} — ${r.listing_type}] ${r.title}`);
    console.log(`     Price: ${r.price} | ${r.url}`);
  });
  return allSamples;
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('property_prices', rows, MEQASA_HEADERS);
}

if (require.main === module) {
  const isTest = process.argv.includes('--test');
  if (isTest) {
    testRun().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
  } else {
    run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
  }
}

module.exports = { run, testRun, exportToExcel };
