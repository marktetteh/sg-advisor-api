/**
 * SG Datalytics — Weekly Market Price Report Generator
 * 2 categories per page · round product images · PDF via Playwright
 * Run: node collectors/generate-report.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { readCsv, getMasterPath, getDataDir, getWeekAndYear } = require('./csv-utils');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── Helpers ───────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function fmt(n, dec = 0) {
  return n == null ? 'N/A' : Number(n).toLocaleString('en-GH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtGHS(n) { return n == null ? 'N/A' : `GH₵ ${fmt(n)}`; }
function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function niceMax(v) {
  if (!v || v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil((v * 1.35) / mag) * mag;
}
function unsplash(id, w = 150, h = 150) {
  return `https://images.unsplash.com/photo-${id}?auto=format&w=${w}&h=${h}&fit=crop&q=75`;
}

// ── Category config ───────────────────────────────────────────
const CAT_META = {
  'Electronics': {
    color: '#2563eb',
    banner: '1593642632559-0c6d3fc62b89',
    note: 'Smartphones, laptops, and accessories dominate this category. Prices move closely with cedi-dollar exchange rates and import cycles. A strong second-hand segment keeps lower price tiers active.',
    products: [
      { label: 'Smartphones',  id: '1512941937669-90a1b58e7e9c' },
      { label: 'Laptops',      id: '1496181133206-80ce9b88a853' },
      { label: 'Televisions',  id: '1593359677879-a4bb92f829d1' },
      { label: 'Headphones',   id: '1505740420928-5e560c06d30e' },
      { label: 'Cameras',      id: '1516035069371-29a1b244cc32' },
    ],
  },
  'Vehicles': {
    color: '#7c3aed',
    banner: '1503376780353-7e6692767b70',
    note: 'Predominantly used imports priced by age, mileage, and duties. Saloons and SUVs dominate listing volumes. Fuel costs are a key secondary influence on buyer demand.',
    products: [
      { label: 'Saloons',      id: '1533473359331-0135ef1b58bf' },
      { label: 'SUVs',         id: '1519641471654-76ce0107ad1b' },
      { label: 'Pickups',      id: '1601584115197-04ecc0da31d7' },
      { label: 'Minibuses',    id: '1544620347460-4798b89d1b27' },
      { label: 'Motorbikes',   id: '1558981403-c5f9899a28bc' },
    ],
  },
  'Appliances': {
    color: '#0891b2',
    banner: '1558618666-fcd25c85cd64',
    note: 'Steady demand driven by urban household formation. Refrigerators, ACs, and washing machines top listings. European and Asian brands sit in distinct pricing tiers.',
    products: [
      { label: 'Refrigerators', id: '1571175443880-49e1d25b2bc5' },
      { label: 'Microwaves',    id: '1574269909917-9b2f9fe05caa' },
      { label: 'Air Cons',      id: '1585338447937-7082f8fc763d' },
      { label: 'Washing M.',    id: '1626806787461-102c1bfaaea1' },
      { label: 'Fans',          id: '1586075010923-2dd4570fb338' },
    ],
  },
  'Building Materials': {
    color: '#d97706',
    banner: '1504307651254-35680f356dfd',
    note: 'Prices reflect ongoing urban construction. Cement, roofing sheets, and iron rods are sensitive to import tariffs. Demand peaks in the dry season when building activity accelerates.',
    products: [
      { label: 'Cement',       id: '1589939705384-5185137a7f0f' },
      { label: 'Roofing',      id: '1504307651254-35680f356dfd' },
      { label: 'Iron Rods',    id: '1504148455328-c376907d081c' },
      { label: 'Paint',        id: '1562259929-b44a5c88f7cf' },
      { label: 'Tiles',        id: '1617806118233-18e1de247200' },
    ],
  },
  'Furniture': {
    color: '#16a34a',
    banner: '1555041469-a586c61ea9bc',
    note: 'Local craftsmanship competes with imported pieces. Sofas and bedroom sets see the highest volumes. Locally made items are more accessible; imports carry a quality premium.',
    products: [
      { label: 'Sofas',        id: '1555041469-a586c61ea9bc' },
      { label: 'Beds',         id: '1505693314914-c2f34f4d3fca' },
      { label: 'Wardrobes',    id: '1558618047-3c8c76ca7d13' },
      { label: 'Dining Sets',  id: '1615529328331-f8917597711f' },
      { label: 'Office Desks', id: '1524758631624-e2822132143c' },
    ],
  },
  'Vehicle Parts': {
    color: '#9333ea',
    banner: '1486262715619-67b85e0b08d3',
    note: "Ghana's ageing vehicle fleet sustains a large spare parts economy. Tyres, engine components, and body panels are most traded. Original vs aftermarket pricing shows a significant spread.",
    products: [
      { label: 'Tyres',        id: '1518987048-93e29699e9a9' },
      { label: 'Engine Parts', id: '1486262715619-67b85e0b08d3' },
      { label: 'Batteries',    id: '1609220136736-443140ad8fd0' },
      { label: 'Shock Abs.',   id: '1519641471654-76ce0107ad1b' },
      { label: 'Brake Pads',   id: '1558618666-fcd25c85cd64' },
    ],
  },
  'Food & FMCG': {
    color: '#15803d',
    banner: '1542838132-92c53300491e',
    note: 'Packaged foods and consumer staples are direct indicators of household affordability. Price movements here signal cost-of-living pressure at the everyday consumer level.',
    products: [
      { label: 'Groceries',    id: '1542838132-92c53300491e' },
      { label: 'Beverages',    id: '1544145945-f90425340c7e' },
      { label: 'Cooking Oil',  id: '1474979266404-7eaacbcd87c5' },
      { label: 'Rice & Grains',id: '1536304929831-ee1ca9d44906' },
      { label: 'Snacks',       id: '1604182553882-2b37b8f7cbb4' },
    ],
  },
  'Fashion': {
    color: '#db2777',
    banner: '1445205170230-053b83016050',
    note: 'Combines local Kente and Ankara designs with imported apparel. Asian imports compete strongly on price. Local designers command premiums in tailored and occasion wear.',
    products: [
      { label: 'Clothing',     id: '1445205170230-053b83016050' },
      { label: 'Footwear',     id: '1542291026-7eec264c27ff' },
      { label: 'Handbags',     id: '1548036161-b9b02b0ef6b2' },
      { label: 'Ankara/Kente', id: '1589156280159-27698a70f29e' },
      { label: 'Accessories',  id: '1611042553365-9b101441c135' },
    ],
  },
  'Agriculture': {
    color: '#65a30d',
    banner: '1625246333-efa4bae1fecc',
    note: 'Seeds, fertilisers, and farm tools are leading food production indicators. Input price increases typically translate into food price pressure 2–3 months later at the consumer level.',
    products: [
      { label: 'Seeds',        id: '1625246333-efa4bae1fecc' },
      { label: 'Fertilisers',  id: '1416879595882-3373a0480b5b' },
      { label: 'Farm Tools',   id: '1599059813005-11265ba4b4ce' },
      { label: 'Irrigation',   id: '1530836369250-ef72a3f5cda8' },
      { label: 'Pesticides',   id: '1464226184884-fa280b87c399' },
    ],
  },
  'Health & Medical': {
    color: '#dc2626',
    banner: '1584308666744-24d5c474f2ae',
    note: 'Medical equipment and supplies are monitored as healthcare access indicators. Import dependency and seasonal demand drive pricing. Post-pandemic demand for diagnostics and PPE remains elevated.',
    products: [
      { label: 'Equipment',    id: '1584308666744-24d5c474f2ae' },
      { label: 'PPE / Masks',  id: '1583324113626-70df0f2dbe72' },
      { label: 'Diagnostics',  id: '1559757148-5c350d0d3c56' },
      { label: 'Medicines',    id: '1587854692152-cbe660dbde88' },
      { label: 'First Aid',    id: '1516302350523-4c09e68b1f1f' },
    ],
  },
  'Office & Education': {
    color: '#0284c7',
    banner: '1497366216548-37526070297c',
    note: "Serves Ghana's formal business sector and growing private school market. Demand for projectors, printers, and stationery spikes sharply at the start of each academic term.",
    products: [
      { label: 'Printers',     id: '1612815154858-60ad4b9b0f1a' },
      { label: 'Projectors',   id: '1497366216548-37526070297c' },
      { label: 'Stationery',   id: '1497633762265-9d179a990aa6' },
      { label: 'Laptops',      id: '1496181133206-80ce9b88a853' },
      { label: 'Office Chairs',id: '1524758631624-e2822132143c' },
    ],
  },
  'Sports & Fitness': {
    color: '#059669',
    banner: '1571902943202-507ec2618e8f',
    note: 'Rising urban health awareness is expanding this market. Gym equipment and sports gear lead listing volumes, concentrated primarily in Accra and Kumasi.',
    products: [
      { label: 'Gym Equip.',   id: '1571902943202-507ec2618e8f' },
      { label: 'Footballs',    id: '1553778263-73a83bab9b0c' },
      { label: 'Bicycles',     id: '1485965120184-e220f721d03e' },
      { label: 'Sportswear',   id: '1540497077202-7c8a3999166f' },
      { label: 'Dumbells',     id: '1517836357463-d25dfeac3438' },
    ],
  },
  'Baby & Kids': {
    color: '#e11d48',
    banner: '1515488042361-ee00e0ddd4e4',
    note: 'Consistent household spending regardless of economic conditions. Import-dependent items show clear exchange rate pass-through, making this a useful affordability indicator for families.',
    products: [
      { label: 'Baby Clothes', id: '1515488042361-ee00e0ddd4e4' },
      { label: 'Toys',         id: '1558060370-d644479cb6f7' },
      { label: 'Prams',        id: '1519742866133-b4dd89d2a8b3' },
      { label: 'Baby Food',    id: '1604182553882-2b37b8f7cbb4' },
      { label: 'School Bags',  id: '1497633762265-9d179a990aa6' },
    ],
  },
  'Tools & Equipment': {
    color: '#b45309',
    banner: '1504148455328-c376907d081c',
    note: "Supports Ghana's construction and artisan economy. Power tools command a premium while hand tools stay accessible. Demand correlates strongly with construction sector activity.",
    products: [
      { label: 'Power Tools',  id: '1504148455328-c376907d081c' },
      { label: 'Hand Tools',   id: '1609428456985-b35791e8f28e' },
      { label: 'Generators',   id: '1581092334651-ddf19d89d1b5' },
      { label: 'Ladders',      id: '1504307651254-35680f356dfd' },
      { label: 'Safety Gear',  id: '1607400201515-c2c41c07d307' },
    ],
  },
  'Security & Safety': {
    color: '#ca8a04',
    banner: '1557804506-669a67965ba0',
    note: 'Growing urbanisation drives demand for CCTV, alarms, and electric fencing. Most products are imported, making this category sensitive to exchange rate movements.',
    products: [
      { label: 'CCTV',         id: '1557804506-669a67965ba0' },
      { label: 'Padlocks',     id: '1558618047-3c8c76ca7d13' },
      { label: 'Alarm Sys.',   id: '1558618666-fcd25c85cd64' },
      { label: 'Electric Fence',id: '1504307651254-35680f356dfd' },
      { label: 'Safes',        id: '1589939705384-5185137a7f0f' },
    ],
  },
};

function catColor(cat)    { return (CAT_META[cat] || {}).color    || '#0a8f6b'; }
function catBanner(cat)   { return (CAT_META[cat] || {}).banner   || ''; }
function catNote(cat)     { return (CAT_META[cat] || {}).note     || ''; }
function catProducts(cat) { return (CAT_META[cat] || {}).products || []; }

// ── Market data helpers ───────────────────────────────────────
function marketSummary(rows) {
  const latest = {};
  for (const r of rows) {
    if (!r.price_ghs || isNaN(parseFloat(r.price_ghs))) continue;
    const wk = parseInt(r.week_number), yr = parseInt(r.year), key = r.search_label;
    if (!latest[key] || yr > latest[key].yr || (yr === latest[key].yr && wk > latest[key].wk))
      latest[key] = { wk, yr, cat: r.product_category, prices: [] };
  }
  for (const r of rows) {
    if (!r.price_ghs || isNaN(parseFloat(r.price_ghs))) continue;
    const lb = latest[r.search_label];
    if (lb && parseInt(r.week_number) === lb.wk && parseInt(r.year) === lb.yr)
      lb.prices.push(parseFloat(r.price_ghs));
  }
  return Object.entries(latest).map(([label, d]) => ({
    label, category: d.cat, week: d.wk, year: d.yr,
    count: d.prices.length, median: median(d.prices),
    min: Math.min(...d.prices), max: Math.max(...d.prices),
  })).sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
}

function pickSpotlight(market, n = 8) {
  const seen = {};
  for (const item of market)
    if (!seen[item.category] || item.count > seen[item.category].count) seen[item.category] = item;
  return Object.values(seen).sort((a, b) => b.count - a.count).slice(0, n);
}

// ── Product circles HTML ──────────────────────────────────────
function buildCircles(cat) {
  const items = catProducts(cat);
  const color = catColor(cat);
  if (!items.length) return '';
  return `
  <div class="circles-row">
    ${items.map(p => `
    <div class="circle-item">
      <div class="circle-wrap" style="border-color:${hexAlpha(color,0.35)}">
        <img class="circle-img"
             src="${unsplash(p.id, 120, 120)}"
             alt="${p.label}"
             loading="eager"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="circle-fallback" style="background:${hexAlpha(color,0.15)};color:${color}">
          ${p.label.charAt(0)}
        </div>
      </div>
      <div class="circle-label">${p.label}</div>
    </div>`).join('')}
  </div>`;
}

// ── Category block ────────────────────────────────────────────
let _cid = 0;
function buildCatBlock(cat, prods, totalCharts) {
  const color  = catColor(cat);
  const banner = catBanner(cat);
  const note   = catNote(cat);
  const total  = prods.reduce((a, b) => a + b.count, 0);
  const top    = prods.slice(0, 5);  // 5 products keeps chart compact

  // Banner
  const bannerHtml = banner ? `
    <div class="cat-banner">
      <img class="cat-banner-img" src="${unsplash(banner, 794, 90)}" alt="${cat}" loading="eager">
      <div class="cat-banner-overlay" style="background:linear-gradient(90deg,${hexAlpha(color,0.9)} 0%,${hexAlpha(color,0.5)} 55%,transparent 100%)">
        <span class="cat-banner-title">${cat}</span>
        <span class="cat-banner-stats">${prods.length} products &nbsp;·&nbsp; ${total.toLocaleString()} listings</span>
      </div>
    </div>` : '';

  // 1–2 products → mini cards only
  if (top.length <= 2) {
    const cards = top.map(p => `
      <div class="mini-card" style="border-left:4px solid ${color}">
        <div class="mini-label">${p.label}</div>
        <div class="mini-price" style="color:${color}">${fmtGHS(p.median)}</div>
        <div class="mini-meta">${fmtGHS(p.min)} – ${fmtGHS(p.max)} · ${p.count} listings</div>
      </div>`).join('');
    return `
    <div class="cat-block">
      ${bannerHtml}
      ${buildCircles(cat)}
      ${note ? `<p class="cat-note">${note}</p>` : ''}
      <div class="mini-cards">${cards}</div>
    </div>`;
  }

  // Chart
  const id      = `c${++_cid}`;
  const medians = top.map(p => Math.round(p.median ?? 0));
  const axMax   = niceMax(Math.max(...medians));
  const labels  = JSON.stringify(top.map(p => p.label.length > 26 ? p.label.slice(0,24)+'…' : p.label));
  const values  = JSON.stringify(medians);
  const counts  = JSON.stringify(top.map(p => p.count));
  const mins    = JSON.stringify(top.map(p => Math.round(p.min ?? 0)));
  const maxs    = JSON.stringify(top.map(p => Math.round(p.max ?? 0)));
  const chartH  = top.length * 34 + 44;  // exact: 34px/bar + axis room

  return `
  <div class="cat-block">
    ${bannerHtml}
    ${buildCircles(cat)}
    ${note ? `<p class="cat-note">${note}</p>` : ''}
    <div class="chart-wrap">
      <div class="chart-label">Median Price (GH₵) — Top ${top.length} products</div>
      <div style="height:${chartH}px;position:relative;overflow:hidden">
        <canvas id="${id}" width="726" height="${chartH}" style="width:726px;height:${chartH}px;display:block"></canvas>
      </div>
    </div>
  </div>
  <script>
  (function(){
    var c=document.getElementById('${id}');
    new Chart(c.getContext('2d'),{
      type:'bar',
      data:{
        labels:${labels},
        datasets:[{
          data:${values},
          backgroundColor:'${hexAlpha(color,0.15)}',
          borderColor:'${color}',
          borderWidth:2,
          borderRadius:4,
          borderSkipped:false,
          _c:${counts},_mn:${mins},_mx:${maxs}
        }]
      },
      options:{
        indexAxis:'y',
        responsive:false,
        animation:{
          duration:0,
          onComplete:function(){
            window._dc=(window._dc||0)+1;
            if(window._dc>=${totalCharts})window.chartsReady=true;
          }
        },
        plugins:{
          legend:{display:false},
          tooltip:{
            padding:10,
            callbacks:{
              title:function(i){return i[0].label;},
              label:function(ctx){
                var d=ctx.dataset,i=ctx.dataIndex;
                return[' Median: GH₵ '+ctx.parsed.x.toLocaleString(),' Range:  GH₵ '+d._mn[i].toLocaleString()+' – GH₵ '+d._mx[i].toLocaleString(),' Listings: '+d._c[i]];
              }
            }
          }
        },
        scales:{
          x:{
            min:0,max:${axMax},
            grid:{color:'#f0f0f0'},
            border:{display:false},
            ticks:{
              font:{size:11,family:'Inter,system-ui'},
              color:'#9ca3af',maxTicksLimit:6,
              callback:function(v){
                if(v>=1000000)return'GH₵'+(v/1e6).toFixed(1)+'M';
                if(v>=1000)return'GH₵'+(v/1000).toFixed(0)+'k';
                return'GH₵'+v;
              }
            }
          },
          y:{
            grid:{display:false},
            border:{display:false},
            ticks:{font:{size:12,family:'Inter,system-ui'},color:'#1f2937',crossAlign:'far',padding:8}
          }
        },
        layout:{padding:{top:6,right:16,bottom:6,left:6}}
      }
    });
  })();
  <\/script>`;
}

// ── HTML report ───────────────────────────────────────────────
function buildReport(data) {
  const { week, year, generated, market } = data;
  const categories    = [...new Set(market.map(r => r.category))].sort();
  const totalListings = market.reduce((a, b) => a + b.count, 0);
  const spotlight     = pickSpotlight(market, 8);
  const monthLabel    = new Date().toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });

  _cid = 0;
  const totalCharts = categories.filter(cat =>
    market.filter(r => r.category === cat && r.median != null).length > 2
  ).length;

  const spotCards = spotlight.map((item, i) => `
    <div class="spot-card">
      <div class="spot-cat">${item.category.toUpperCase()}</div>
      <div class="spot-label">${item.label}</div>
      <div class="spot-price" style="color:${i===0?'#d97706':'#0a8f6b'}">${fmtGHS(item.median)}</div>
      <div class="spot-meta">${monthLabel} · ${item.count} listings</div>
    </div>`).join('');

  // 2 categories per page
  const groups = [];
  for (let i = 0; i < categories.length; i += 2) groups.push(categories.slice(i, i+2));

  const catPages = groups.map((grp, gi) => {
    const isLast = gi === groups.length - 1;
    const blocks = grp.map(cat => {
      const prods = market.filter(r => r.category === cat && r.median != null);
      return prods.length ? buildCatBlock(cat, prods, totalCharts) : '';
    }).join('');
    return `<div class="cat-page${isLast ? '' : ' pg-break'}">${blocks}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SG Market Price Survey · Week ${week}, ${year}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --teal:#0a8f6b;--amber:#d97706;
  --dark:#111827;--gray:#6b7280;--gray-lt:#9ca3af;
  --bg:#eef1f4;--border:#e5e7eb;--white:#fff;
}
html,body{width:794px;margin:0 auto;font-family:'Inter',system-ui,sans-serif;
  background:var(--bg);color:var(--dark);font-size:11.5px;line-height:1.45;
  -webkit-font-smoothing:antialiased}

/* COVER */
.cover{background:var(--white);width:794px;page-break-after:always}
.cover-top{display:flex;justify-content:space-between;align-items:center;padding:14px 28px;border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:8px}
.logo-icon{width:30px;height:30px;background:var(--teal);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900}
.logo-text{font-size:13px;font-weight:700;color:var(--dark)}
.logo-text span{color:var(--teal)}
.cover-week{text-align:right;color:var(--teal);font-weight:700;font-size:12px}
.cover-week small{display:block;font-size:9.5px;color:var(--gray);font-weight:400;margin-top:1px}

.hero{padding:22px 28px 0}
.hero-eyebrow{font-size:8.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--teal);margin-bottom:8px;display:flex;align-items:center;gap:7px}
.hero-eyebrow::before{content:'';width:20px;height:2px;background:var(--teal);display:inline-block}
.hero-title{font-size:28px;font-weight:900;line-height:1.1;letter-spacing:-.7px;color:var(--dark);margin-bottom:5px}
.hero-title span{color:var(--teal)}
.hero-sub{font-size:11px;color:var(--gray);margin-bottom:18px}

.stats-strip{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--border);background:#f9fafb}
.stat-panel{padding:12px 18px;border-right:1px solid var(--border)}
.stat-panel:last-child{border-right:none}
.stat-val{font-size:24px;font-weight:800;color:var(--dark);letter-spacing:-.5px;line-height:1}
.stat-val.t{color:var(--teal)}
.stat-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray-lt);margin-top:3px}
.stat-note{font-size:8.5px;color:var(--gray-lt);margin-top:1px}

.spot-section{padding:14px 28px 20px;border-top:1px solid var(--border)}
.spot-head{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--dark);display:flex;align-items:center;gap:6px;margin-bottom:10px}
.spot-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);flex-shrink:0}
.spot-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.spot-card{border:1px solid var(--border);border-radius:8px;padding:10px 10px 8px;background:#fafafa}
.spot-cat{font-size:7.5px;font-weight:700;letter-spacing:1.5px;color:var(--gray-lt);margin-bottom:3px;text-transform:uppercase}
.spot-label{font-size:10.5px;font-weight:700;color:var(--dark);margin-bottom:7px;line-height:1.25;min-height:24px}
.spot-price{font-size:15px;font-weight:800;letter-spacing:-.2px;line-height:1;margin-bottom:3px}
.spot-meta{font-size:8.5px;color:var(--gray-lt)}

/* CONTENT PAGES */
.page{width:794px;padding:16px 22px 20px;background:var(--bg)}
.pg-break{page-break-after:always}
.cat-page{display:flex;flex-direction:column;gap:16px}

/* Category block */
.cat-block{background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden;width:100%}

/* Banner */
.cat-banner{position:relative;height:82px;overflow:hidden}
.cat-banner-img{width:100%;height:82px;object-fit:cover;display:block}
.cat-banner-overlay{position:absolute;inset:0;display:flex;align-items:center;padding:0 18px;gap:12px}
.cat-banner-title{font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.6px;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.cat-banner-stats{font-size:9.5px;color:rgba(255,255,255,.8);font-weight:500;background:rgba(0,0,0,.2);padding:3px 8px;border-radius:12px}

/* Product circles */
.circles-row{display:flex;gap:0;padding:10px 14px 6px;background:#fafafa;border-bottom:1px solid var(--border)}
.circle-item{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.circle-wrap{width:52px;height:52px;border-radius:50%;overflow:hidden;border:2px solid;flex-shrink:0}
.circle-img{width:52px;height:52px;object-fit:cover;display:block}
.circle-fallback{display:none;width:52px;height:52px;border-radius:50%;align-items:center;justify-content:center;font-size:18px;font-weight:700}
.circle-label{font-size:8px;font-weight:600;color:var(--gray);text-align:center;line-height:1.2;max-width:58px}

/* Note */
.cat-note{font-size:11px;color:#374151;line-height:1.65;padding:8px 14px 6px}

/* Chart */
.chart-wrap{padding:6px 14px 12px}
.chart-label{font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gray-lt);margin-bottom:4px}

/* Mini cards */
.mini-cards{padding:8px 14px 12px;display:flex;flex-direction:column;gap:6px}
.mini-card{padding:8px 12px;border-radius:6px;background:#fafafa}
.mini-label{font-size:11px;font-weight:600;color:var(--dark);margin-bottom:2px}
.mini-price{font-size:18px;font-weight:800;letter-spacing:-.3px;margin-bottom:2px}
.mini-meta{font-size:9px;color:var(--gray-lt)}

/* About */
.about-box{background:var(--white);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-top:16px}
.about-title{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--dark);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.about-title::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gray-lt);flex-shrink:0}
.about-text{font-size:10.5px;color:#4b5563;line-height:1.75}
.about-text strong{color:var(--dark);font-weight:600}

/* Footer */
.report-footer{background:var(--dark);color:rgba(255,255,255,.5);padding:12px 28px;display:flex;justify-content:space-between;align-items:center;width:794px}
.footer-brand{font-weight:700;color:#fff;font-size:12px}
.footer-brand span{color:var(--teal)}
.footer-right{text-align:right;font-size:9px;line-height:1.8}
.footer-link{color:var(--teal)}

@media print{
  html,body{background:#fff;width:794px}
  .cover,.cat-block,.about-box,.report-footer,
  .cat-banner,.cat-banner-overlay,.circles-row,
  .circle-wrap,.cat-banner-img,.circle-img,
  .spot-price,.stat-val.t{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pg-break{page-break-after:always}
}
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-top">
    <div class="logo">
      <div class="logo-icon">↗</div>
      <div class="logo-text"><span>SG</span> DATALYTICS</div>
    </div>
    <div class="cover-week">Week ${week}, ${year}<small>${generated}</small></div>
  </div>
  <div class="hero">
    <div class="hero-eyebrow">Ghana's Data Marketplace</div>
    <div class="hero-title">SG Market Price Survey<br><span>— Weekly Report</span></div>
    <div class="hero-sub">Median prices from the SG Market Price Survey across Ghana. Updated every week.</div>
  </div>
  <div class="stats-strip">
    <div class="stat-panel"><div class="stat-val t">${market.length}</div><div class="stat-lbl">Products Tracked</div><div class="stat-note">${categories.length} categories</div></div>
    <div class="stat-panel"><div class="stat-val">${totalListings.toLocaleString()}</div><div class="stat-lbl">Listings Surveyed</div><div class="stat-note">Week ${week} survey</div></div>
    <div class="stat-panel"><div class="stat-val t">${categories.length}</div><div class="stat-lbl">Categories</div><div class="stat-note">Consumer &amp; trade goods</div></div>
    <div class="stat-panel"><div class="stat-val">${week}</div><div class="stat-lbl">Survey Week</div><div class="stat-note">${monthLabel}</div></div>
  </div>
  <div class="spot-section">
    <div class="spot-head">
      <div class="spot-dot"></div>
      Market Price Highlights
      <span style="font-weight:400;color:var(--gray-lt);font-size:8.5px;text-transform:none;letter-spacing:0">${monthLabel} · Median price per product</span>
    </div>
    <div class="spot-grid">${spotCards}</div>
  </div>
</div>

<!-- CATEGORY PAGES -->
<div class="page">
  ${catPages}
  <div class="about-box">
    <div class="about-title">About This Report</div>
    <p class="about-text">
      The <strong>SG Market Price Survey</strong> tracks median consumer prices across Ghana, updated weekly.
      This edition covers <strong>${market.length} products</strong> across <strong>${categories.length} categories</strong>
      with <strong>${totalListings.toLocaleString()} listings</strong> surveyed in Week ${week}, ${year}.
      <strong>Median price</strong> is the midpoint of all surveyed prices — less sensitive to outliers than a simple average.
      All prices in Ghanaian Cedi (GH₵). For informational purposes only — not financial advice.
      &copy; ${year} SG Datalytics &nbsp;·&nbsp; <strong>sgdatalytics.org</strong>
    </p>
  </div>
</div>

<div class="report-footer">
  <div>
    <div class="footer-brand"><span>SG</span> DATALYTICS</div>
    <div style="margin-top:2px">Ghana's Market Intelligence Platform</div>
  </div>
  <div class="footer-right">
    <a class="footer-link" href="https://sgdatalytics.org">sgdatalytics.org</a><br>
    SG Market Price Survey · Week ${week}, ${year} · Generated ${generated}
  </div>
</div>

</body>
</html>`;
}

// ── MAIN ─────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Report Generator           ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  const { week_number: week, year } = getWeekAndYear();
  const generated = new Date().toLocaleDateString('en-GH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  log('Loading market data…', '▶');
  const marketData    = readCsv(getMasterPath('market_prices.csv'));
  const market        = marketSummary(marketData);
  const categories    = [...new Set(market.map(r => r.category))];
  const totalListings = market.reduce((a, b) => a + b.count, 0);
  log(`${marketData.length} listings · ${market.length} products · ${categories.length} categories`, '✓');

  const html = buildReport({ week, year, generated, market });

  const reportsDir = path.join(getDataDir(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const base     = `ghana-market-report-${year}-W${String(week).padStart(2,'0')}`;
  const htmlPath = path.join(reportsDir, `${base}.html`);
  const pdfPath  = path.join(reportsDir, `${base}.pdf`);

  fs.writeFileSync(htmlPath, html, 'utf8');
  log(`HTML → ${htmlPath}`, '📄');

  log('Launching browser…', '🖥');
  const browser = await chromium.launch({ headless: true });
  const pg      = await (await browser.newContext()).newPage();

  await pg.setViewportSize({ width: 794, height: 1123 });
  await pg.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 45000 });

  // Wait for all images
  log('Loading images…', '🖼');
  await pg.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.every(i => i.complete);
  }, { timeout: 25000 }).catch(() => {});

  // Wait for charts
  log('Rendering charts…', '📊');
  await pg.waitForFunction(() => window.chartsReady === true, { timeout: 20000 })
    .catch(() => log('Some charts may be partial', '⚠'));
  await pg.waitForTimeout(500);

  log('Saving PDF…', '📑');
  await pg.pdf({
    path: pdfPath, format: 'A4', printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
  });
  await browser.close();

  log(`PDF → ${pdfPath}`, '✅');
  log(`${market.length} products · ${totalListings.toLocaleString()} listings · ${categories.length} categories`, '📊');
  return { file: pdfPath, htmlFile: htmlPath, week, year, products: market.length };
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run };
