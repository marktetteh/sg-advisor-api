/**
 * Commodities & Fuel — reads from CSV master files
 *
 * GET /api/commodities                    — all commodities, latest price per item
 * GET /api/commodities/categories         — unique categories
 * GET /api/commodities/:code              — price history for one commodity
 * GET /api/fuel                           — latest fuel prices
 */
const express = require('express');
const router  = express.Router();
const { readCsv, getMasterPath } = require('../collectors/csv-utils');

function loadCommodities() {
  return readCsv(getMasterPath('commodity_prices.csv'))
    .map(r => ({ ...r, price_ghs: parseFloat(r.price_ghs) || null }))
    .filter(r => r.price_ghs !== null);
}

function loadFuel() {
  return readCsv(getMasterPath('fuel_prices.csv'))
    .map(r => ({ ...r, price_ghs_per_litre: parseFloat(r.price_ghs_per_litre) || null }))
    .filter(r => r.price_ghs_per_litre !== null);
}

// ── GET /api/commodities ──────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let rows = loadCommodities();
    if (category) rows = rows.filter(r => r.market?.toLowerCase().includes(category.toLowerCase()) ||
                                          r.commodity_name?.toLowerCase().includes(category.toLowerCase()));

    // Latest price per commodity_code + market
    const latest = {};
    for (const r of rows) {
      const key = `${r.commodity_code}|${r.market}`;
      if (!latest[key] || r.date > latest[key].date) latest[key] = r;
    }

    // Previous price for change %
    const prev = {};
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    for (const r of sorted) {
      const key = `${r.commodity_code}|${r.market}`;
      if (latest[key] && r.date < latest[key].date) prev[key] = r;
    }

    const result = Object.entries(latest).map(([key, r]) => {
      const p = prev[key];
      const change_pct = p && p.price_ghs > 0
        ? +((r.price_ghs - p.price_ghs) / p.price_ghs * 100).toFixed(2)
        : null;
      return {
        commodity_code: r.commodity_code,
        commodity_name: r.commodity_name,
        market:         r.market,
        region:         r.region,
        unit:           r.unit,
        latest_price:   r.price_ghs,
        latest_date:    r.date,
        prev_price:     p?.price_ghs || null,
        change_pct,
        source:         r.source,
      };
    }).sort((a, b) => a.commodity_name.localeCompare(b.commodity_name));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/commodities/categories ──────────────────────────
router.get('/categories', (req, res) => {
  try {
    const rows = loadCommodities();
    const cats = {};
    for (const r of rows) {
      const c = r.commodity_name?.split(' ')[0] || 'Other';
      cats[c] = (cats[c] || 0) + 1;
    }
    res.json(Object.entries(cats).map(([name, count]) => ({ category: name, count })).sort((a, b) => a.category.localeCompare(b.category)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/commodities/:code ────────────────────────────────
router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const rows = loadCommodities()
      .filter(r => r.commodity_code?.toLowerCase() === code.toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!rows.length) return res.status(404).json({ error: `Commodity '${code}' not found` });

    const latest = rows[rows.length - 1];
    res.json({
      commodity: {
        code:  latest.commodity_code,
        name:  latest.commodity_name,
        unit:  latest.unit,
        market: latest.market,
        region: latest.region,
      },
      prices: rows.map(r => ({
        date:      r.date,
        week:      r.week_number,
        year:      r.year,
        price_ghs: r.price_ghs,
        market:    r.market,
        region:    r.region,
        source:    r.source,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/fuel ─────────────────────────────────────────────
router.get('/fuel/latest', (req, res) => {
  try {
    const rows = loadFuel();
    const latest = {};
    for (const r of rows) {
      if (!latest[r.fuel_type] || r.date > latest[r.fuel_type].date) latest[r.fuel_type] = r;
    }
    res.json({
      prices:  Object.values(latest).sort((a, b) => a.fuel_type.localeCompare(b.fuel_type)),
      updated: Object.values(latest)[0]?.date || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
