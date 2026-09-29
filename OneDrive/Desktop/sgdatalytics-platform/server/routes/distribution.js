/**
 * SG Datalytics — Data Distribution API
 *
 * Authenticated endpoints for paying clients to query market_prices.
 * All routes require X-API-Key header.
 *
 * GET /data/prices      — filtered listing-level data
 * GET /data/summary     — aggregated price stats per product group
 * GET /data/categories  — available categories for this client's tier
 * GET /data/usage       — client's own quota and usage this month
 */
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const { stringify } = require('csv-stringify/sync');
const { requireApiKey, logUsage } = require('../api/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.NEON_MARKET_PRICES,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

// All distribution routes require a valid API key
router.use(requireApiKey);

// ── Helpers ───────────────────────────────────────────────────
const MAX_ROWS = {
  trial:      100,
  starter:    500,
  pro:        2000,
  enterprise: 10000,
};

function getLimit(tier, requestedLimit) {
  const max = MAX_ROWS[tier] || 500;
  return Math.min(parseInt(requestedLimit) || max, max);
}

function applyClientCategoryFilter(client, requestedCategory) {
  // If client has specific allowed_categories, enforce them
  const allowed = client.allowed_categories || [];
  if (allowed.length === 0) return requestedCategory || null; // all categories
  if (requestedCategory) {
    // Check if requested category is allowed
    if (!allowed.map(c => c.toLowerCase()).includes(requestedCategory.toLowerCase())) {
      return '__DENIED__';
    }
    return requestedCategory;
  }
  return null; // will be filtered by allowed list in query
}

// ── GET /data/prices ──────────────────────────────────────────
// Returns listing-level rows from market_prices.
// Query params:
//   category, product_group, brand, condition
//   date_from (YYYY-MM-DD), date_to (YYYY-MM-DD)
//   location, min_price, max_price
//   limit (capped by tier), offset
//   format=csv  → returns CSV file download
router.get('/prices', async (req, res) => {
  const t0 = Date.now();
  const {
    category, product_group, brand, condition,
    date_from, date_to, location,
    min_price, max_price,
    offset = 0,
    format,
  } = req.query;

  const client = req.client;
  const limit  = getLimit(client.tier, req.query.limit);

  // Category access control
  const resolvedCategory = applyClientCategoryFilter(client, category);
  if (resolvedCategory === '__DENIED__') {
    return res.status(403).json({
      error: `Your plan does not include access to the '${category}' category.`,
      allowed_categories: client.allowed_categories,
    });
  }

  // Build parameterised query
  const conditions = ['price_ghs > 0', 'is_flagged = FALSE'];
  const params     = [];
  let   p          = 1;

  // Enforce allowed_categories if set
  const allowed = client.allowed_categories || [];
  if (allowed.length > 0 && !resolvedCategory) {
    conditions.push(`product_category = ANY($${p++})`);
    params.push(allowed);
  } else if (resolvedCategory) {
    conditions.push(`LOWER(product_category) = LOWER($${p++})`);
    params.push(resolvedCategory);
  }

  if (product_group) { conditions.push(`LOWER(product_group) = LOWER($${p++})`); params.push(product_group); }
  if (brand)         { conditions.push(`LOWER(brand) = LOWER($${p++})`);          params.push(brand); }
  if (condition)     { conditions.push(`LOWER(condition) = LOWER($${p++})`);       params.push(condition); }
  if (location)      { conditions.push(`LOWER(location) LIKE LOWER($${p++})`);     params.push(`%${location}%`); }
  if (date_from)     { conditions.push(`collected_date >= $${p++}`);               params.push(date_from); }
  if (date_to)       { conditions.push(`collected_date <= $${p++}`);               params.push(date_to); }
  if (min_price)     { conditions.push(`price_ghs >= $${p++}`);                    params.push(parseFloat(min_price)); }
  if (max_price)     { conditions.push(`price_ghs <= $${p++}`);                    params.push(parseFloat(max_price)); }

  const where = conditions.join(' AND ');

  try {
    const result = await pool.query(`
      SELECT
        collected_date,
        product_category,
        product_group,
        title,
        brand,
        model,
        condition,
        price_ghs,
        location,
        quality_score
      FROM market_prices
      WHERE ${where}
      ORDER BY collected_date DESC, price_ghs
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, limit, parseInt(offset)]);

    const rows       = result.rows;
    const responseMs = Date.now() - t0;

    // Log usage (non-blocking)
    logUsage({
      clientId:    client.id,
      endpoint:    '/data/prices',
      filters:     { category, product_group, brand, condition, date_from, date_to, location, min_price, max_price },
      rowsReturned: rows.length,
      responseMs,
    });

    // CSV download
    if (format === 'csv') {
      const csv = stringify(rows, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sgdatalytics_prices_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    return res.json({
      count:        rows.length,
      limit,
      offset:       parseInt(offset),
      response_ms:  responseMs,
      data:         rows,
    });

  } catch (err) {
    console.error('[/data/prices]', err.message);
    res.status(500).json({ error: 'Query failed. Please try again.' });
  }
});

// ── GET /data/summary ─────────────────────────────────────────
// Aggregated price stats: median, min, max, count per product_group.
// Query params: category, date_from, date_to
router.get('/summary', async (req, res) => {
  const t0 = Date.now();
  const { category, date_from, date_to } = req.query;
  const client = req.client;

  const resolvedCategory = applyClientCategoryFilter(client, category);
  if (resolvedCategory === '__DENIED__') {
    return res.status(403).json({
      error: `Your plan does not include access to the '${category}' category.`,
      allowed_categories: client.allowed_categories,
    });
  }

  const conditions = ['price_ghs > 0', 'is_flagged = FALSE', 'product_group IS NOT NULL'];
  const params     = [];
  let   p          = 1;

  const allowed = client.allowed_categories || [];
  if (allowed.length > 0 && !resolvedCategory) {
    conditions.push(`product_category = ANY($${p++})`);
    params.push(allowed);
  } else if (resolvedCategory) {
    conditions.push(`LOWER(product_category) = LOWER($${p++})`);
    params.push(resolvedCategory);
  }

  if (date_from) { conditions.push(`collected_date >= $${p++}`); params.push(date_from); }
  if (date_to)   { conditions.push(`collected_date <= $${p++}`); params.push(date_to); }

  try {
    const result = await pool.query(`
      SELECT
        product_category,
        product_group,
        COUNT(*)                                                     AS listing_count,
        ROUND(MIN(price_ghs)::numeric, 2)                           AS price_min,
        ROUND(MAX(price_ghs)::numeric, 2)                           AS price_max,
        ROUND(AVG(price_ghs)::numeric, 2)                           AS price_avg,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_ghs)::numeric, 2) AS price_median,
        MIN(collected_date)                                          AS data_from,
        MAX(collected_date)                                          AS data_to
      FROM market_prices
      WHERE ${conditions.join(' AND ')}
      GROUP BY product_category, product_group
      ORDER BY product_category, listing_count DESC
    `, params);

    const responseMs = Date.now() - t0;
    logUsage({ clientId: client.id, endpoint: '/data/summary', filters: { category, date_from, date_to }, rowsReturned: result.rows.length, responseMs });

    res.json({
      count:       result.rows.length,
      response_ms: responseMs,
      data:        result.rows,
    });

  } catch (err) {
    console.error('[/data/summary]', err.message);
    res.status(500).json({ error: 'Query failed. Please try again.' });
  }
});

// ── GET /data/categories ──────────────────────────────────────
// Returns the distinct categories + product_groups available to this client.
router.get('/categories', async (req, res) => {
  const t0     = Date.now();
  const client = req.client;
  const allowed = client.allowed_categories || [];

  const conditions = ['price_ghs > 0'];
  const params     = [];

  if (allowed.length > 0) {
    conditions.push('product_category = ANY($1)');
    params.push(allowed);
  }

  try {
    const result = await pool.query(`
      SELECT
        product_category,
        COUNT(DISTINCT product_group) FILTER (WHERE product_group IS NOT NULL) AS product_group_count,
        COUNT(*)                                                                AS total_listings,
        MAX(collected_date)                                                     AS last_updated
      FROM market_prices
      WHERE ${conditions.join(' AND ')}
      GROUP BY product_category
      ORDER BY total_listings DESC
    `, params);

    const responseMs = Date.now() - t0;
    logUsage({ clientId: client.id, endpoint: '/data/categories', filters: {}, rowsReturned: result.rows.length, responseMs });

    res.json({
      count:       result.rows.length,
      response_ms: responseMs,
      data:        result.rows,
    });

  } catch (err) {
    console.error('[/data/categories]', err.message);
    res.status(500).json({ error: 'Query failed.' });
  }
});

// ── GET /data/options ─────────────────────────────────────────
// Returns distinct product_groups and brands scoped to client's allowed categories.
// Accepts optional ?category=&product_group= to narrow the lists.
router.get('/options', async (req, res) => {
  const { category, product_group } = req.query;
  const client  = req.client;
  const allowed = client.allowed_categories || [];

  // Build base category filter
  const catConditions = ['price_ghs > 0', 'is_flagged = FALSE'];
  const catParams     = [];
  let   cp            = 1;

  if (allowed.length > 0) {
    catConditions.push(`product_category = ANY($${cp++})`);
    catParams.push(allowed);
  }
  if (category) {
    catConditions.push(`LOWER(product_category) = LOWER($${cp++})`);
    catParams.push(category);
  }

  // Product groups
  const pgConditions = [...catConditions];
  const pgParams     = [...catParams];
  let   pp           = cp;

  const pgResult = await pool.query(`
    SELECT DISTINCT product_group
    FROM market_prices
    WHERE ${pgConditions.join(' AND ')} AND product_group IS NOT NULL AND product_group != ''
    ORDER BY product_group
  `, pgParams);

  // Brands (narrowed further by product_group if provided)
  const brConditions = [...catConditions];
  const brParams     = [...catParams];
  let   bp           = cp;

  if (product_group) {
    brConditions.push(`LOWER(product_group) = LOWER($${bp++})`);
    brParams.push(product_group);
  }

  const brResult = await pool.query(`
    SELECT DISTINCT brand
    FROM market_prices
    WHERE ${brConditions.join(' AND ')} AND brand IS NOT NULL AND brand != ''
    ORDER BY brand
  `, brParams);

  res.json({
    product_groups: pgResult.rows.map(r => r.product_group),
    brands:         brResult.rows.map(r => r.brand),
  });
});

// ── GET /data/usage ───────────────────────────────────────────
// Shows the client their own quota status.
router.get('/usage', async (req, res) => {
  const client = req.client;

  try {
    const usageResult = await pool.query(`
      SELECT
        COALESCE(SUM(rows_returned), 0)  AS rows_used_this_month,
        COUNT(*)                          AS requests_this_month,
        MAX(queried_at)                   AS last_request_at
      FROM api_usage_log
      WHERE client_id = $1
        AND date_trunc('month', queried_at) = date_trunc('month', NOW())
    `, [client.id]);

    const usage = usageResult.rows[0];
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1, 1);
    resetDate.setHours(0, 0, 0, 0);

    res.json({
      client:              client.name,
      tier:                client.tier,
      allowed_categories:  client.allowed_categories.length ? client.allowed_categories : 'all',
      rows_used_this_month: parseInt(usage.rows_used_this_month),
      row_limit_monthly:   client.row_limit_monthly === -1 ? 'unlimited' : client.row_limit_monthly,
      rows_remaining:      client.row_limit_monthly === -1
                             ? 'unlimited'
                             : Math.max(0, client.row_limit_monthly - parseInt(usage.rows_used_this_month)),
      requests_this_month: parseInt(usage.requests_this_month),
      last_request_at:     usage.last_request_at,
      quota_resets_at:     resetDate.toISOString().split('T')[0],
    });

  } catch (err) {
    console.error('[/data/usage]', err.message);
    res.status(500).json({ error: 'Usage lookup failed.' });
  }
});

module.exports = router;
