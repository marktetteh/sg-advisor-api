/**
 * Economic Indicators — reads from CSV master files
 *
 * GET /api/stats                          — platform summary
 * GET /api/sectors                        — unique sectors
 * GET /api/indicators                     — all indicators (filter: sector, source, code)
 * GET /api/indicators/:code               — single indicator time series
 * GET /api/exchange-rates                 — latest FX rates
 */
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const { readCsv, getMasterPath } = require('../collectors/csv-utils');

// ── helpers ───────────────────────────────────────────────────
function loadIndicators() {
  return readCsv(getMasterPath('economic_indicators.csv'))
    .map(r => ({ ...r, value: r.value !== '' ? parseFloat(r.value) : null }))
    .filter(r => r.value !== null && !isNaN(r.value));
}

function loadExchangeRates() {
  return readCsv(getMasterPath('exchange_rates.csv'))
    .map(r => ({ ...r, rate_ghs: parseFloat(r.rate_ghs) }));
}

function masterFileStats(file) {
  const p = getMasterPath(file);
  if (!fs.existsSync(p)) return { rows: 0, updated: null };
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  const stat  = fs.statSync(p);
  return { rows: Math.max(0, lines.length - 1), updated: stat.mtime.toISOString() };
}

// ── GET /api/stats ────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const indicators = loadIndicators();
    const years      = indicators.map(r => parseInt(r.year)).filter(y => !isNaN(y));

    res.json({
      total_indicators:   new Set(indicators.map(r => r.indicator_code)).size,
      total_values:       indicators.length,
      total_sectors:      new Set(indicators.map(r => r.sector)).size,
      year_min:           years.length ? Math.min(...years) : null,
      year_max:           years.length ? Math.max(...years) : null,
      files: {
        economic_indicators: masterFileStats('economic_indicators.csv'),
        exchange_rates:      masterFileStats('exchange_rates.csv'),
        market_prices:       masterFileStats('market_prices.csv'),
        commodity_prices:    masterFileStats('commodity_prices.csv'),
        fuel_prices:         masterFileStats('fuel_prices.csv'),
        stock_prices:        masterFileStats('stock_prices.csv'),
        gse_indices:         masterFileStats('gse_indices.csv'),
      },
      platform: 'SG Datalytics',
      version:  '2.0.0',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/sectors ──────────────────────────────────────────
router.get('/sectors', (req, res) => {
  try {
    const rows    = loadIndicators();
    const sectorMap = {};
    for (const r of rows) {
      if (!r.sector) continue;
      if (!sectorMap[r.sector]) sectorMap[r.sector] = { sector: r.sector, indicator_count: 0, sources: new Set() };
      sectorMap[r.sector].indicator_count++;
      sectorMap[r.sector].sources.add(r.source);
    }
    const sectors = Object.values(sectorMap).map(s => ({
      ...s,
      sources: [...s.sources],
      indicator_count: new Set(
        rows.filter(r => r.sector === s.sector).map(r => r.indicator_code)
      ).size,
    })).sort((a, b) => a.sector.localeCompare(b.sector));
    res.json(sectors);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/indicators ───────────────────────────────────────
// ?sector=economy  ?source=World+Bank  ?code=WB_GDP_USD  ?latest=1
router.get('/indicators', (req, res) => {
  try {
    const { sector, source, code, latest } = req.query;
    let rows = loadIndicators();

    if (sector) rows = rows.filter(r => r.sector?.toLowerCase() === sector.toLowerCase());
    if (source) rows = rows.filter(r => r.source?.toLowerCase().includes(source.toLowerCase()));
    if (code)   rows = rows.filter(r => r.indicator_code?.toLowerCase().includes(code.toLowerCase()));

    // Build indicator summary (one row per code)
    const codeMap = {};
    for (const r of rows) {
      const c = r.indicator_code;
      if (!codeMap[c]) {
        codeMap[c] = {
          indicator_code: c,
          indicator_name: r.indicator_name,
          sector:         r.sector,
          unit:           r.unit,
          sources:        new Set(),
          years:          [],
          latest_value:   null,
          latest_year:    null,
        };
      }
      codeMap[c].sources.add(r.source);
      const yr = parseInt(r.year);
      if (!isNaN(yr)) codeMap[c].years.push(yr);
      if (!codeMap[c].latest_year || yr > codeMap[c].latest_year) {
        codeMap[c].latest_year  = yr;
        codeMap[c].latest_value = r.value;
      }
    }

    const result = Object.values(codeMap).map(c => ({
      ...c,
      sources:    [...c.sources],
      year_from:  c.years.length ? Math.min(...c.years) : null,
      year_to:    c.years.length ? Math.max(...c.years) : null,
      value_count: c.years.length,
      years:      undefined,
    })).sort((a, b) => a.sector.localeCompare(b.sector) || a.indicator_name.localeCompare(b.indicator_name));

    res.json(latest === '1' ? result : result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/indicators/:code ─────────────────────────────────
// ?from=2000  ?to=2025
router.get('/indicators/:code', (req, res) => {
  try {
    const { code }      = req.params;
    const { from, to }  = req.query;
    const yearFrom      = parseInt(from) || 1990;
    const yearTo        = parseInt(to)   || new Date().getFullYear() + 1;

    const all = loadIndicators().filter(r =>
      r.indicator_code?.toLowerCase() === code.toLowerCase()
    );

    if (!all.length) return res.status(404).json({ error: `Indicator '${code}' not found` });

    const series = all
      .filter(r => {
        const yr = parseInt(r.year);
        return !isNaN(yr) && yr >= yearFrom && yr <= yearTo;
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year))
      .map(r => ({
        date:   `${r.year}-${(r.month || '01').toString().padStart(2,'0')}-01`,
        year:   parseInt(r.year),
        month:  parseInt(r.month || '1'),
        value:  r.value,
        source: r.source,
      }));

    const latest = [...all].sort((a, b) => parseInt(b.year) - parseInt(a.year))[0];

    res.json({
      indicator: {
        code:           latest.indicator_code,
        name:           latest.indicator_name,
        sector:         latest.sector,
        unit:           latest.unit,
        source:         [...new Set(all.map(r => r.source))].join(', '),
        latest_value:   latest.value,
        latest_year:    parseInt(latest.year),
      },
      data:       series,
      year_range: { from: yearFrom, to: yearTo },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/exchange-rates ───────────────────────────────────
router.get('/exchange-rates', (req, res) => {
  try {
    const rates = loadExchangeRates();
    // Return the latest entry per currency pair
    const latest = {};
    for (const r of rates) {
      if (!latest[r.currency_pair] || r.date > latest[r.currency_pair].date) {
        latest[r.currency_pair] = r;
      }
    }
    res.json({
      rates:    Object.values(latest).sort((a, b) => a.currency_pair.localeCompare(b.currency_pair)),
      updated:  Object.values(latest)[0]?.date || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
