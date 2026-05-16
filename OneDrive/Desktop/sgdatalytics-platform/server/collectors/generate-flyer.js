/**
 * SG Datalytics — Weekly Flyer Generator v4
 * Queries 5 Neon databases and renders 3 platform-optimised PNG flyers.
 *
 * LinkedIn  → 1200 × 627 px   sgmpi_linkedin_YYYY-MM-DD.png
 * Instagram → 1080 × 1080 px  sgmpi_instagram_YYYY-MM-DD.png
 * X         → 1600 × 900 px   sgmpi_x_YYYY-MM-DD.png
 *
 * Card pool (12 cards, 8 shown per week — rotates every 3 weeks):
 *   market_prices   → Electronics · Vehicles · Auto Parts · Appliances
 *                      Building · Real Estate · Health · Office
 *   hotel_prices    → Hotels  (Booking.com)
 *   airbnb_prices   → Airbnb  (Short-Stay Rentals)
 *   commodity_prices→ Food Prices (Esoko)
 *   property_prices → Property (Meqasa)
 *
 * Output:  DATA_DIR/flyers/YYYY-MM-DD/
 * Run:     node collectors/generate-flyer.js
 */
require('dotenv').config();
const fs           = require('fs');
const path         = require('path');
const { Pool }     = require('pg');
const { chromium } = require('playwright');
const { getDataDir } = require('./csv-utils');

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── Date helpers ───────────────────────────────────────────────

function getMondayISO(offsetWeeks = 0) {
  const today = new Date();
  const day   = today.getDay();
  const d     = new Date(today);
  d.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}

function isoWeekNum(mondayISO) {
  const d    = new Date(mondayISO);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

function formatMonthYear(iso) {
  return new Date(iso).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GH',
    { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Neon pool cache ────────────────────────────────────────────

const _pools = {};
function getPool(conn) {
  if (!_pools[conn]) {
    _pools[conn] = new Pool({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return _pools[conn];
}
async function nq(envKey, sql, params = []) {
  const conn = process.env[envKey];
  if (!conn) { log(`${envKey} not set — skip`, '⚠'); return []; }
  try {
    return (await getPool(conn).query(sql, params)).rows;
  } catch (e) {
    log(`${envKey} query error: ${e.message.split('\n')[0]}`, '⚠');
    return [];
  }
}
async function closePools() {
  await Promise.all(Object.values(_pools).map(p => p.end().catch(() => {})));
}

// ── Card pool — 12 cards across 5 data sources ────────────────
// source: 'market' | 'hotel' | 'airbnb' | 'commodity' | 'property'
// ilike:  only for source='market' — matched against product_category

const ALL_CARD_DEFS = {
  electronics: {
    display: 'ELECTRONICS',
    source:  'market',
    ilike:   'Electronics',
    img:     'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  vehicles: {
    display: 'VEHICLES',
    source:  'market',
    ilike:   'Vehicles',
    img:     'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  auto_parts: {
    display: 'AUTO PARTS',
    source:  'market',
    ilike:   'Vehicle Parts',
    img:     'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=320&h=200&fit=crop&auto=format',
    highlight: true,    // green price card
  },
  appliances: {
    display: 'APPLIANCES',
    source:  'market',
    ilike:   'Appliances',
    img:     'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  building: {
    display: 'BUILDING',
    source:  'market',
    ilike:   'Building Materials',
    img:     'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  real_estate: {
    display: 'REAL ESTATE',
    source:  'market',
    ilike:   'Real Estate',
    img:     'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  health: {
    display: 'HEALTH',
    source:  'market',
    ilike:   'Health & Medical',
    img:     'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  office: {
    display: 'OFFICE',
    source:  'market',
    ilike:   'Office & Education',
    img:     'https://images.unsplash.com/photo-1497366216548-37526070297c?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  hotels: {
    display: 'HOTELS',
    source:  'hotel',
    img:     'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  airbnb: {
    display: 'AIRBNB',
    source:  'airbnb',
    img:     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=320&h=200&fit=crop&auto=format',
    highlight: true,
  },
  food: {
    display: 'FOOD PRICES',
    source:  'commodity',
    img:     'https://images.unsplash.com/photo-1542838132-92c53300491e?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
  property: {
    display: 'PROPERTY',
    source:  'property',
    img:     'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=320&h=200&fit=crop&auto=format',
    highlight: false,
  },
};

// ── 3 rotation sets — weekNum % 3 selects which 8 to display ──
// Electronics is always position 0 (highest data quality anchor)
const ROTATIONS = [
  // Rotation A — core market + accommodation
  ['electronics', 'vehicles',    'auto_parts',  'appliances',
   'hotels',      'airbnb',      'health',      'building'],

  // Rotation B — property & food focus
  ['electronics', 'real_estate', 'property',    'food',
   'appliances',  'auto_parts',  'office',      'hotels'],

  // Rotation C — mixed with airbnb & commodities
  ['electronics', 'vehicles',    'building',    'health',
   'airbnb',      'food',        'property',    'real_estate'],
];

// ── Per-card data fetcher ──────────────────────────────────────

async function fetchCardData(id, def, weekNum, year, monday) {
  const base = {
    id,
    display:   def.display,
    img:       def.img,
    highlight: def.highlight || false,
  };

  // ── market_prices ────────────────────────────────────────────
  if (def.source === 'market') {
    const rows = await nq('NEON_MARKET_PRICES', `
      SELECT
        search_label                                                        AS product,
        COUNT(*)                                                            AS listing_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
              (ORDER BY price_ghs::numeric)::numeric, 0)                   AS median_price
      FROM market_prices
      WHERE collected_date = $1
        AND price_ghs::numeric > 0
        AND product_category ILIKE $2
      GROUP BY search_label
      ORDER BY listing_count DESC
      LIMIT 1
    `, [monday, def.ilike]);
    const row = rows[0];
    return {
      ...base,
      product:  row?.product       || def.display,
      price:    row?.median_price  ? parseInt(row.median_price)  : null,
      currency: 'GH₵',
      unit:     '',
      count:    row?.listing_count ? parseInt(row.listing_count) : 0,
    };
  }

  // ── hotel_prices ─────────────────────────────────────────────
  if (def.source === 'hotel') {
    const rows = await nq('NEON_ACCOMMODATION', `
      SELECT
        city,
        COUNT(*)                                           AS listing_count,
        ROUND(AVG(price_per_night_usd)::numeric, 0)        AS avg_price
      FROM hotel_prices
      WHERE week_number = $1 AND year = $2
        AND price_per_night_usd > 0
      GROUP BY city
      ORDER BY listing_count DESC
      LIMIT 1
    `, [weekNum, year]);
    const row = rows[0];
    // Also get total hotel count across all cities
    const total = await nq('NEON_ACCOMMODATION',
      'SELECT COUNT(*) AS cnt FROM hotel_prices WHERE week_number=$1 AND year=$2',
      [weekNum, year]);
    return {
      ...base,
      product:  row ? `${row.city} Hotels` : 'Ghana Hotels',
      price:    row?.avg_price    ? parseInt(row.avg_price)    : null,
      currency: 'US$',
      unit:     '/night',
      count:    total[0]?.cnt ? parseInt(total[0].cnt) : 0,
    };
  }

  // ── airbnb_prices ────────────────────────────────────────────
  if (def.source === 'airbnb') {
    const rows = await nq('NEON_ACCOMMODATION', `
      SELECT
        COUNT(*)                                                            AS listing_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
              (ORDER BY price_ghs::numeric)::numeric, 0)                   AS median_price
      FROM airbnb_prices
      WHERE week_number = $1 AND year = $2
        AND price_ghs::numeric > 0
    `, [weekNum, year]);
    const row = rows[0];
    return {
      ...base,
      product:  'Short-Stay Rentals',
      price:    row?.median_price  ? parseInt(row.median_price)  : null,
      currency: 'GH₵',
      unit:     '/night',
      count:    row?.listing_count ? parseInt(row.listing_count) : 0,
    };
  }

  // ── commodity_prices ─────────────────────────────────────────
  if (def.source === 'commodity') {
    const rows = await nq('NEON_COMMODITIES', `
      SELECT
        commodity_name                                                      AS product,
        unit,
        COUNT(*)                                                            AS listing_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
              (ORDER BY price_ghs::numeric)::numeric, 0)                   AS median_price
      FROM commodity_prices
      WHERE collected_date = (SELECT MAX(collected_date) FROM commodity_prices)
        AND price_ghs::numeric > 0
      GROUP BY commodity_name, unit
      ORDER BY listing_count DESC
      LIMIT 1
    `, []);
    const row = rows[0];
    // Truncate long units for display
    const unitStr = row?.unit
      ? (row.unit.length > 12 ? row.unit.slice(0, 12) + '…' : row.unit)
      : '';
    return {
      ...base,
      product:  row?.product       || 'Agricultural Prices',
      price:    row?.median_price  ? parseInt(row.median_price)  : null,
      currency: 'GH₵',
      unit:     unitStr ? `/ ${unitStr}` : '',
      count:    row?.listing_count ? parseInt(row.listing_count) : 0,
    };
  }

  // ── property_prices ──────────────────────────────────────────
  if (def.source === 'property') {
    const rows = await nq('NEON_PROPERTY', `
      SELECT
        property_type || ' ' || listing_type                               AS product,
        COUNT(*)                                                            AS listing_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
              (ORDER BY price_ghs::numeric)::numeric, 0)                   AS median_price
      FROM property_prices
      WHERE week_number = $1 AND year = $2
        AND price_ghs::numeric > 0
      GROUP BY 1
      ORDER BY listing_count DESC
      LIMIT 1
    `, [weekNum, year]);
    const row = rows[0];
    // Total property listings this week
    const total = await nq('NEON_PROPERTY',
      'SELECT COUNT(*) AS cnt FROM property_prices WHERE week_number=$1 AND year=$2',
      [weekNum, year]);
    return {
      ...base,
      product:  row?.product       || 'Property Listings',
      price:    row?.median_price  ? parseInt(row.median_price)  : null,
      currency: 'GH₵',
      unit:     '',
      count:    total[0]?.cnt ? parseInt(total[0].cnt) : 0,
    };
  }

  return { ...base, product: def.display, price: null, currency: 'GH₵', unit: '', count: 0 };
}

// ── Main data fetcher ─────────────────────────────────────────

async function fetchFlyerData(monday) {
  const weekNum = isoWeekNum(monday);
  const year    = new Date(monday).getFullYear();
  const rotIdx  = weekNum % ROTATIONS.length;
  const cardIds = ROTATIONS[rotIdx];

  log(`Rotation ${rotIdx} (week ${weekNum} % ${ROTATIONS.length}) — cards: ${cardIds.join(', ')}`, '🔄');

  // ── Stats from market_prices ──────────────────────────────────
  const statsRows = await nq('NEON_MARKET_PRICES', `
    SELECT
      COUNT(DISTINCT search_label)     AS products_tracked,
      COUNT(*)                         AS total_listings,
      COUNT(DISTINCT product_category) AS categories
    FROM market_prices
    WHERE collected_date = $1
  `, [monday]);

  const stats = statsRows[0] || {};
  const productsTracked = parseInt(stats.products_tracked || 0);
  let   totalListings   = parseInt(stats.total_listings   || 0);
  const categories      = parseInt(stats.categories       || 0);

  // Add accommodation + property counts to total
  const [hotelCnt, airbnbCnt, propCnt] = await Promise.all([
    nq('NEON_ACCOMMODATION', 'SELECT COUNT(*) AS cnt FROM hotel_prices WHERE week_number=$1 AND year=$2', [weekNum, year]),
    nq('NEON_ACCOMMODATION', 'SELECT COUNT(*) AS cnt FROM airbnb_prices WHERE week_number=$1 AND year=$2', [weekNum, year]),
    nq('NEON_PROPERTY',      'SELECT COUNT(*) AS cnt FROM property_prices WHERE week_number=$1 AND year=$2', [weekNum, year]),
  ]);
  totalListings += parseInt(hotelCnt[0]?.cnt  || 0)
                +  parseInt(airbnbCnt[0]?.cnt || 0)
                +  parseInt(propCnt[0]?.cnt   || 0);

  // ── Fetch card data ───────────────────────────────────────────
  const cards = [];
  for (const id of cardIds) {
    const def  = ALL_CARD_DEFS[id];
    const card = await fetchCardData(id, def, weekNum, year, monday);
    cards.push(card);
  }

  return { monday, weekNum, year, productsTracked, totalListings, categories, rotIdx, cards };
}

// ── Number formatters ─────────────────────────────────────────

function fmtPrice(n) {
  if (n === null || n === undefined) return 'N/A';
  return Number(n).toLocaleString('en-GH');
}
function fmtNum(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return n.toString();
}

// ── HTML builder ──────────────────────────────────────────────
// All sizes derived proportionally from the 1200×627 base canvas.

function buildHtml(w, h, data) {
  const { monday, weekNum, year, productsTracked, totalListings, categories,
          rotIdx, cards } = data;
  const monthYear = formatMonthYear(monday);
  const dateStr   = formatDate(monday);

  // Proportional sizing
  const sx = w / 1200;
  const sy = h / 627;
  const s  = Math.min(sx, sy);
  const px = n => `${Math.round(n * s)}px`;

  // Layout constants
  const sideW  = Math.round(220 * sx);
  const hdrH   = Math.round(68  * sy);
  const ftrH   = Math.round(38  * sy);
  const stripH = Math.round(82  * sy);
  const bodyH  = h - hdrH - ftrH - stripH;

  // Card grid
  const cardGap = Math.round(10 * s);
  const gridW   = w - sideW;
  const cardW   = Math.floor((gridW - cardGap * 5) / 4);
  const labelH  = Math.round(36 * sy);
  const cardH   = Math.floor((bodyH - labelH - cardGap * 3) / 2);

  const cardRows = [cards.slice(0, 4), cards.slice(4, 8)];

  const cardHtml = (c) => {
    const priceColor = c.highlight ? '#2E7D32' : '#E87722';
    const cardBg     = c.highlight ? '#f0fdf4' : '#ffffff';
    const border     = c.highlight ? '2px solid #bbf7d0' : '1px solid #e8ecf0';
    const priceStr   = c.price !== null ? `${c.currency} ${fmtPrice(c.price)}` : 'N/A';
    return `
    <div style="background:${cardBg};border:${border};border-radius:${px(10)};
                padding:${px(10)} ${px(10)} ${px(8)};display:flex;flex-direction:column;
                align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.06);
                width:${cardW}px;height:${cardH}px;overflow:hidden;flex-shrink:0">
      <div style="font-size:${px(8)};font-weight:700;letter-spacing:1.5px;
                  color:#9ca3af;text-transform:uppercase;align-self:flex-start;
                  margin-bottom:${px(3)}">${c.display}</div>
      <div style="font-size:${px(11.5)};font-weight:700;color:#1A1A2E;
                  align-self:flex-start;margin-bottom:${px(6)};line-height:1.2;
                  width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
        ${c.product}
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;
                  width:100%;overflow:hidden">
        <img src="${c.img}" alt="${c.display}"
             style="max-width:100%;max-height:100%;object-fit:contain;border-radius:${px(6)}"
             onerror="this.style.display='none'">
      </div>
      <div style="margin-top:${px(6)};align-self:flex-start;width:100%">
        <div style="font-size:${px(16)};font-weight:900;color:${priceColor};line-height:1">
          ${priceStr}<span style="font-size:${px(9)};font-weight:600;color:${priceColor};opacity:.7;margin-left:${px(2)}">${c.unit}</span>
        </div>
        <div style="font-size:${px(8)};color:#9ca3af;margin-top:${px(3)}">
          ${monthYear} &nbsp;·&nbsp; ${fmtNum(c.count)} listings
        </div>
      </div>
    </div>`;
  };

  const rowHtml = (row) => `
    <div style="display:flex;gap:${cardGap}px">
      ${row.map(cardHtml).join('')}
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; overflow:hidden;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;
         background:#F8F9FA; }
</style></head><body>

<!-- ══ HEADER ══════════════════════════════════════════════ -->
<div style="width:${w}px;height:${hdrH}px;background:#ffffff;
            border-bottom:1px solid #e5e7eb;display:flex;align-items:center;
            padding:0 ${px(20)};justify-content:space-between;flex-shrink:0">

  <!-- Logo -->
  <div style="display:flex;align-items:center;gap:${px(10)};min-width:${px(200)}">
    <div style="width:${px(36)};height:${px(36)};background:#1A6B3C;border-radius:${px(8)};
                display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">
      <svg width="${px(20)}" height="${px(20)}" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    </div>
    <div>
      <div style="font-size:${px(14)};font-weight:800;color:#1A1A2E;letter-spacing:.5px">
        SG <em style="font-style:normal">DATALYTICS</em>
      </div>
      <div style="font-size:${px(8)};color:#6b7280;font-weight:500">Ghana's Data Marketplace</div>
    </div>
  </div>

  <!-- Centre title -->
  <div style="text-align:center;flex:1">
    <div style="font-size:${px(9)};font-weight:600;color:#6b7280;letter-spacing:2px;
                text-transform:uppercase;margin-bottom:${px(3)}">Ghana's Data Marketplace</div>
    <div style="font-size:${px(16)};font-weight:800;color:#1A1A2E">
      SG Market Price Survey &mdash; Weekly Update
    </div>
  </div>

  <!-- Date -->
  <div style="text-align:right;min-width:${px(150)}">
    <div style="font-size:${px(13)};font-weight:700;color:#1A6B3C">
      Week ${weekNum}, ${year}
    </div>
    <div style="font-size:${px(9)};color:#1A6B3C;margin-top:${px(2)}">${dateStr}</div>
  </div>
</div>

<!-- ══ BODY ROW ═════════════════════════════════════════════ -->
<div style="display:flex;width:${w}px;height:${bodyH}px">

  <!-- ── SIDEBAR ── -->
  <div style="width:${sideW}px;height:${bodyH}px;background:#1A6B3C;flex-shrink:0;
              display:flex;flex-direction:column;padding:${px(16)} ${px(14)};
              justify-content:space-between">

    <div>
      <div style="font-size:${px(7.5)};font-weight:700;letter-spacing:2px;
                  color:rgba(255,255,255,.5);text-transform:uppercase;
                  margin-bottom:${px(8)}">Live Market Data</div>
      <div style="font-size:${px(18)};font-weight:800;color:#ffffff;line-height:1.15;
                  margin-bottom:${px(14)}">
        Real Data.<br>
        <span style="color:#F5C518">Real Decisions.</span>
      </div>

      <!-- Stats -->
      <div style="display:flex;flex-direction:column;gap:${px(8)}">

        <div style="display:flex;align-items:center;gap:${px(10)}">
          <div style="width:${px(32)};height:${px(32)};background:rgba(255,255,255,.12);
                      border-radius:${px(8)};display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;color:#a7f3d0">
            <svg width="${px(16)}" height="${px(16)}" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <div>
            <div style="font-size:${px(22)};font-weight:900;color:#ffffff;line-height:1">
              ${fmtNum(productsTracked)}
            </div>
            <div style="font-size:${px(8)};color:rgba(255,255,255,.5);font-weight:500">
              Products Tracked
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:${px(10)}">
          <div style="width:${px(32)};height:${px(32)};background:rgba(255,255,255,.12);
                      border-radius:${px(8)};display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;color:#a7f3d0">
            <svg width="${px(16)}" height="${px(16)}" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <div style="font-size:${px(22)};font-weight:900;color:#ffffff;line-height:1">
              ${fmtNum(totalListings)}
            </div>
            <div style="font-size:${px(8)};color:rgba(255,255,255,.5);font-weight:500">
              Total Listings
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:${px(10)}">
          <div style="width:${px(32)};height:${px(32)};background:rgba(255,255,255,.12);
                      border-radius:${px(8)};display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;color:#a7f3d0">
            <svg width="${px(16)}" height="${px(16)}" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <div>
            <div style="font-size:${px(22)};font-weight:900;color:#ffffff;line-height:1">
              ${categories}
            </div>
            <div style="font-size:${px(8)};color:rgba(255,255,255,.5);font-weight:500">
              Categories
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div style="border-top:1px solid rgba(255,255,255,.15);margin-bottom:${px(10)}"></div>
      <div style="display:flex;align-items:center;gap:${px(6)};margin-bottom:${px(6)}">
        <div style="width:${px(7)};height:${px(7)};border-radius:50%;
                    background:#F5C518;flex-shrink:0"></div>
        <div style="font-size:${px(9)};font-weight:600;color:#ffffff">
          Updated Week ${weekNum}, ${year}
        </div>
      </div>
      <div style="font-size:${px(7.5)};color:rgba(255,255,255,.4);
                  line-height:1.4;margin-bottom:${px(12)}">
        SG Market Price Survey across Ghana. Median price shown per product.
      </div>
      <!-- CTA Button -->
      <div style="background:#2d8f5e;border-radius:${px(8)};padding:${px(8)} ${px(10)};
                  display:flex;align-items:center;gap:${px(8)}">
        <div style="color:#a7f3d0;flex-shrink:0">
          <svg width="${px(14)}" height="${px(14)}" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div>
          <div style="font-size:${px(9.5)};font-weight:700;color:#ffffff">Get the Full Report</div>
          <div style="font-size:${px(7.5)};color:rgba(255,255,255,.5)">sgdatalytics.org</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── MAIN CONTENT ── -->
  <div style="flex:1;height:${bodyH}px;padding:${px(10)};
              display:flex;flex-direction:column;gap:${px(8)}">

    <!-- Content header -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:0 ${px(2)}">
      <div style="display:flex;align-items:center;gap:${px(6)}">
        <div style="width:${px(8)};height:${px(8)};border-radius:50%;background:#1A6B3C"></div>
        <div style="font-size:${px(10)};font-weight:700;color:#1A1A2E;
                    letter-spacing:.5px;text-transform:uppercase">Live Market Prices</div>
      </div>
      <div style="font-size:${px(10)};font-weight:600;color:#1A6B3C">${monthYear}</div>
    </div>

    <!-- Card grid -->
    <div style="display:flex;flex-direction:column;gap:${cardGap}px;flex:1">
      ${cardRows.map(rowHtml).join('')}
    </div>
  </div>
</div>

<!-- ══ BOTTOM STRIP ══════════════════════════════════════════ -->
<div style="width:${w}px;height:${stripH}px;display:flex;gap:0;border-top:1px solid #e5e7eb">

  <div style="flex:1;background:#f0fdf4;display:flex;align-items:center;
              gap:${px(12)};padding:0 ${px(18)};border-right:1px solid #e5e7eb">
    <div style="width:${px(36)};height:${px(36)};background:#1A6B3C;border-radius:${px(8)};
                display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${px(18)}" height="${px(18)}" viewBox="0 0 24 24" fill="none"
           stroke="#fff" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    </div>
    <div>
      <div style="font-size:${px(11)};font-weight:700;color:#1A1A2E">Data Collection</div>
      <div style="font-size:${px(8.5)};color:#6b7280;margin-top:${px(2)}">
        Market data gathered across Ghana's key sectors
      </div>
    </div>
  </div>

  <div style="flex:1;background:#fffbeb;display:flex;align-items:center;
              gap:${px(12)};padding:0 ${px(18)};border-right:1px solid #e5e7eb">
    <div style="width:${px(36)};height:${px(36)};background:#F5C518;border-radius:${px(8)};
                display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${px(18)}" height="${px(18)}" viewBox="0 0 24 24" fill="none"
           stroke="#1A1A2E" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    </div>
    <div>
      <div style="font-size:${px(11)};font-weight:700;color:#1A1A2E">Data Analysis</div>
      <div style="font-size:${px(8.5)};color:#6b7280;margin-top:${px(2)}">
        Industry-standard tools applied to your data
      </div>
    </div>
  </div>

  <div style="flex:1;background:#fff7ed;display:flex;align-items:center;
              gap:${px(12)};padding:0 ${px(18)}">
    <div style="width:${px(36)};height:${px(36)};background:#E87722;border-radius:${px(8)};
                display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${px(18)}" height="${px(18)}" viewBox="0 0 24 24" fill="none"
           stroke="#fff" stroke-width="2">
        <line x1="9" y1="21" x2="15" y2="21"/>
        <line x1="12" y1="21" x2="12" y2="17"/>
        <path d="M12 2a7 7 0 0 1 7 7c0 2.7-1.5 5-3.7 6.3H8.7C6.5 14 5 11.7 5 9a7 7 0 0 1 7-7z"/>
      </svg>
    </div>
    <div>
      <div style="font-size:${px(11)};font-weight:700;color:#1A1A2E">Market Insight</div>
      <div style="font-size:${px(8.5)};color:#6b7280;margin-top:${px(2)}">
        Raw data turned into actionable intelligence
      </div>
    </div>
  </div>
</div>

<!-- ══ FOOTER ═══════════════════════════════════════════════ -->
<div style="width:${w}px;height:${ftrH}px;background:#1A1A2E;
            display:flex;align-items:center;justify-content:space-between;
            padding:0 ${px(20)}">
  <div style="font-size:${px(8)};color:rgba(255,255,255,.45)">
    <strong style="color:rgba(255,255,255,.7)">SG Market Price Survey</strong>
    &nbsp;·&nbsp; ${fmtNum(totalListings)} listings &nbsp;·&nbsp; Week ${weekNum}, ${year}
  </div>
  <div style="display:flex;align-items:center;gap:${px(10)}">
    <span style="font-size:${px(9)};font-weight:700;color:#34d399">sgdatalytics.org</span>
    <div style="background:#1A6B3C;color:#fff;font-size:${px(8)};font-weight:700;
                padding:${px(4)} ${px(10)};border-radius:${px(6)}">
      Browse Datasets →
    </div>
  </div>
</div>

</body></html>`;
}

// ── MAIN ──────────────────────────────────────────────────────

async function run(overrideMonday) {
  console.log('\n  ╔═══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Weekly Flyer Generator v4           ║');
  console.log('  ║   LinkedIn 1200×627 · Instagram 1080×1080 · X 1600×900║');
  console.log('  ║   Sources: Market · Hotels · Airbnb · Food · Property  ║');
  console.log('  ╚═══════════════════════════════════════════════════════╝\n');

  const monday  = overrideMonday || getMondayISO();
  const weekNum = isoWeekNum(monday);
  const year    = new Date(monday).getFullYear();
  log(`Week ${weekNum}, ${year}  ·  collected_date = ${monday}`, '📅');

  // ── Fetch data ───────────────────────────────────────────────
  log('Querying Neon databases…', '🐘');
  const data = await fetchFlyerData(monday);
  await closePools();

  log(`Stats — ${data.productsTracked} products · ${data.totalListings} total listings · ${data.categories} categories`, '✓');
  log(`Rotation ${data.rotIdx} cards:`, '📋');
  data.cards.forEach(c => {
    const priceStr = c.price !== null ? `${c.currency} ${fmtPrice(c.price)}${c.unit}` : 'N/A';
    log(`  ${c.display.padEnd(14)} → ${c.product.slice(0,28).padEnd(28)} ${priceStr} (${c.count} listings)`, ' ');
  });

  // ── Output directory ─────────────────────────────────────────
  const outDir = path.join(getDataDir(), 'flyers', monday);
  fs.mkdirSync(outDir, { recursive: true });
  log(`Output: ${outDir}`, '📁');

  // ── Render via Playwright ────────────────────────────────────
  const FORMATS = [
    { key: 'linkedin',  w: 1200, h: 627  },
    { key: 'instagram', w: 1080, h: 1080 },
    { key: 'x',         w: 1600, h: 900  },
  ];

  const browser = await chromium.launch({ headless: true });
  const saved   = [];

  for (const fmt of FORMATS) {
    const html    = buildHtml(fmt.w, fmt.h, data);
    const fname   = `sgmpi_${fmt.key}_${monday}.png`;
    const outFile = path.join(outDir, fname);

    const page = await browser.newPage();
    await page.setViewportSize({ width: fmt.w, height: fmt.h });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);   // let images settle

    await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: fmt.w, height: fmt.h } });
    await page.close();

    const sizeKB = Math.round(fs.statSync(outFile).size / 1024);
    log(`${fmt.key.padEnd(10)} → ${fname}  (${sizeKB} KB)`, '🖼');
    saved.push({ fmt: fmt.key, file: outFile, sizeKB });
  }

  await browser.close();

  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   Flyers Generated Successfully                       ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  saved.forEach(f =>
    console.log(`  ║  ${f.fmt.padEnd(10)} → sgmpi_${f.fmt}_${monday}.png  (${String(f.sizeKB).padStart(4)} KB) ║`)
  );
  console.log(`  ║  Folder: ${outDir.slice(-45).padEnd(45)} ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  return { flyers: saved, outDir, monday };
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
