/**
 * Market Prices — reads from CSV master files
 *
 * GET /api/market/summary          — latest week stats per product
 * GET /api/market/weekly           — price trend for one product over time
 * GET /api/market/data             — paginated raw listings
 * GET /api/market/export           — CSV download of raw listings
 * GET /api/market/categories       — product categories
 * GET /api/market/products         — all product labels (optionally by category)
 */
const express = require('express');
const router  = express.Router();
const { readCsv, getMasterPath } = require('../collectors/csv-utils');

function loadMarket() {
  return readCsv(getMasterPath('market_prices.csv'))
    .map(r => ({ ...r, price_ghs: r.price_ghs !== '' ? parseFloat(r.price_ghs) : null }));
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── GET /api/market/summary ───────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const { category, product_group } = req.query;
    let rows = loadMarket().filter(r => r.price_ghs && r.price_ghs > 0);
    if (category)      rows = rows.filter(r => r.product_category?.toLowerCase() === category.toLowerCase());
    if (product_group) rows = rows.filter(r => r.product_group?.toLowerCase() === product_group.toLowerCase());

    // Group by product label, get stats for the LATEST week seen per label
    const labelMap = {};
    for (const r of rows) {
      const label = r.search_label;
      if (!labelMap[label]) labelMap[label] = { latest_week: 0, latest_year: 0, rows: [] };
      const wk = parseInt(r.week_number), yr = parseInt(r.year);
      if (yr > labelMap[label].latest_year || (yr === labelMap[label].latest_year && wk > labelMap[label].latest_week)) {
        labelMap[label].latest_week = wk;
        labelMap[label].latest_year = yr;
      }
    }

    // Collect rows for each label's latest week
    for (const r of rows) {
      const lb = labelMap[r.search_label];
      if (parseInt(r.week_number) === lb.latest_week && parseInt(r.year) === lb.latest_year) {
        lb.rows.push(r.price_ghs);
      }
    }

    const summary = Object.entries(labelMap).map(([label, lb]) => {
      const prices = lb.rows;
      const ref    = rows.find(r => r.search_label === label);
      return {
        search_label:     label,
        product_category: ref?.product_category || '',
        product_group:    ref?.product_group    || '',
        week_number:      lb.latest_week,
        year:             lb.latest_year,
        total_listings:   prices.length,
        avg_price_ghs:    prices.length ? +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null,
        median_price_ghs: +(median(prices) || 0).toFixed(2),
        min_price_ghs:    prices.length ? Math.min(...prices) : null,
        max_price_ghs:    prices.length ? Math.max(...prices) : null,
      };
    }).sort((a, b) => a.product_category.localeCompare(b.product_category) || a.search_label.localeCompare(b.search_label));

    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/weekly ────────────────────────────────────
// ?label=iPhone  ?category=Electronics  ?product_group=Smartphone
router.get('/weekly', (req, res) => {
  try {
    const { label, category, product_group } = req.query;
    let rows = loadMarket().filter(r => r.price_ghs && r.price_ghs > 0);
    if (label)         rows = rows.filter(r => r.search_label?.toLowerCase() === label.toLowerCase());
    if (category)      rows = rows.filter(r => r.product_category?.toLowerCase() === category.toLowerCase());
    if (product_group) rows = rows.filter(r => r.product_group?.toLowerCase() === product_group.toLowerCase());

    // Group by label + week + year
    const weekMap = {};
    for (const r of rows) {
      const key = `${r.search_label}|${r.year}|${r.week_number}`;
      if (!weekMap[key]) weekMap[key] = { label: r.search_label, category: r.product_category, year: parseInt(r.year), week: parseInt(r.week_number), prices: [] };
      weekMap[key].prices.push(r.price_ghs);
    }

    const trend = Object.values(weekMap).map(w => ({
      search_label:     w.label,
      product_category: w.category,
      year:             w.year,
      week_number:      w.week,
      total_listings:   w.prices.length,
      avg_price_ghs:    +(w.prices.reduce((a, b) => a + b, 0) / w.prices.length).toFixed(2),
      median_price_ghs: +(median(w.prices) || 0).toFixed(2),
      min_price_ghs:    Math.min(...w.prices),
      max_price_ghs:    Math.max(...w.prices),
    })).sort((a, b) => a.year - b.year || a.week_number - b.week_number);

    res.json(trend);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/groups ────────────────────────────────────
router.get('/groups', (req, res) => {
  try {
    const rows = loadMarket();
    const groupMap = {};
    for (const r of rows) {
      const g = r.product_group;
      if (!g) continue;
      if (!groupMap[g]) groupMap[g] = { product_group: g, product_count: new Set(), total_listings: 0 };
      groupMap[g].product_count.add(r.search_label);
      groupMap[g].total_listings++;
    }
    res.json(Object.values(groupMap).map(g => ({
      product_group:  g.product_group,
      product_count:  g.product_count.size,
      total_listings: g.total_listings,
    })).sort((a, b) => b.total_listings - a.total_listings));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/categories ────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const rows = loadMarket();
    const catMap = {};
    for (const r of rows) {
      const c = r.product_category;
      if (!catMap[c]) catMap[c] = { category: c, product_count: new Set(), total_listings: 0 };
      catMap[c].product_count.add(r.search_label);
      catMap[c].total_listings++;
    }
    res.json(Object.values(catMap).map(c => ({
      category:       c.category,
      product_count:  c.product_count.size,
      total_listings: c.total_listings,
    })).sort((a, b) => a.category.localeCompare(b.category)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/products ──────────────────────────────────
// ?category=Electronics
router.get('/products', (req, res) => {
  try {
    const { category } = req.query;
    let rows = loadMarket();
    if (category) rows = rows.filter(r => r.product_category?.toLowerCase() === category.toLowerCase());
    const labels = [...new Set(rows.map(r => r.search_label))].sort();
    const result = labels.map(label => {
      const ref = rows.find(r => r.search_label === label);
      return { label, category: ref?.product_category || '' };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/data ──────────────────────────────────────
// Paginated raw listings
// ?page=1  ?limit=50  ?search=iphone  ?category=Electronics
// ?label=iPhone  ?condition=used  ?location=Accra  ?week=18  ?year=2026
router.get('/data', (req, res) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page)  || 1);
    const limit     = Math.min(200, parseInt(req.query.limit) || 50);
    const { search, category, label, condition, location, week, year } = req.query;

    let rows = loadMarket();
    if (search)    rows = rows.filter(r => r.title?.toLowerCase().includes(search.toLowerCase()));
    if (category)  rows = rows.filter(r => r.product_category?.toLowerCase() === category.toLowerCase());
    if (label)     rows = rows.filter(r => r.search_label?.toLowerCase() === label.toLowerCase());
    if (condition) rows = rows.filter(r => r.condition?.toLowerCase() === condition.toLowerCase());
    if (location)  rows = rows.filter(r => r.location?.toLowerCase().includes(location.toLowerCase()));
    if (week)      rows = rows.filter(r => r.week_number === week);
    if (year)      rows = rows.filter(r => r.year === year);

    // Sort: newest week first
    rows.sort((a, b) => parseInt(b.year) - parseInt(a.year) || parseInt(b.week_number) - parseInt(a.week_number));

    const total = rows.length;
    const data  = rows.slice((page - 1) * limit, page * limit).map(r => ({
      source:           r.source,
      product_category: r.product_category,
      search_label:     r.search_label,
      title:            r.title,
      price_raw:        r.price_raw,
      price_ghs:        r.price_ghs,
      location:         r.location,
      condition:        r.condition,
      week_number:      parseInt(r.week_number),
      year:             parseInt(r.year),
      scraped_date:     r.scraped_date,
    }));

    // Filter options for UI dropdowns
    const allRows  = loadMarket();
    const weeks    = [...new Set(allRows.map(r => `${r.year}|${r.week_number}`))].sort().reverse().slice(0, 20)
                       .map(s => { const [y, w] = s.split('|'); return { year: parseInt(y), week_number: parseInt(w) }; });
    const locations = [...new Set(allRows.map(r => r.location).filter(Boolean))].sort().slice(0, 60);
    const labels    = [...new Set(allRows.map(r => r.search_label))].sort().map(l => ({
      label: l, category: allRows.find(r => r.search_label === l)?.product_category || '',
    }));

    res.json({
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      filterOptions: { weeks, locations, labels, conditions: ['new', 'used', 'unknown'] },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/market/export ────────────────────────────────────
// Download CSV of filtered listings
router.get('/export', (req, res) => {
  try {
    const { search, category, label, condition, week, year } = req.query;
    let rows = loadMarket();
    if (search)    rows = rows.filter(r => r.title?.toLowerCase().includes(search.toLowerCase()));
    if (category)  rows = rows.filter(r => r.product_category?.toLowerCase() === category.toLowerCase());
    if (label)     rows = rows.filter(r => r.search_label?.toLowerCase() === label.toLowerCase());
    if (condition) rows = rows.filter(r => r.condition?.toLowerCase() === condition.toLowerCase());
    if (week)      rows = rows.filter(r => r.week_number === week);
    if (year)      rows = rows.filter(r => r.year === year);

    const headers = ['Category','Product','Title','Price (Raw)','Price (GHS)','Location','Condition','Source','Week','Year','Date'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.product_category || ''}"`,
        `"${r.search_label || ''}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.price_raw || '').replace(/"/g, '""')}"`,
        r.price_ghs || '',
        `"${(r.location || '').replace(/"/g, '""')}"`,
        r.condition || '',
        r.source || '',
        r.week_number,
        r.year,
        r.scraped_date || '',
      ].join(','))
    ].join('\n');

    const filename = `sgdatalytics-${label || category || 'market'}-${week ? `week${week}` : 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
