/**
 * SG Datalytics — Neon PostgreSQL Setup  (Phase 1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates tables across 6 Neon projects from environment connection strings.
 * Safe to run multiple times — all DDL uses IF NOT EXISTS / ON CONFLICT.
 *
 * Run:
 *   node db/neon-setup.js
 *
 * Required .env keys:
 *   NEON_MARKET_PRICES   NEON_ACCOMMODATION   NEON_PROPERTY
 *   NEON_ECONOMIC        NEON_COMMODITIES     NEON_FINANCIALS
 *
 * Database → Tables mapping:
 *   NEON_MARKET_PRICES  → market_prices
 *   NEON_ACCOMMODATION  → airbnb_prices, hotel_prices
 *   NEON_PROPERTY       → property_prices
 *   NEON_ECONOMIC       → economic_indicators, exchange_rates
 *   NEON_COMMODITIES    → commodity_prices, fuel_prices
 *   NEON_FINANCIALS     → gse_indices, stock_prices
 */
require('dotenv').config();
const { Pool } = require('pg');

const log = (msg, sym = '→') => console.log(`  ${sym} ${msg}`);

// ── Connection strings from .env ──────────────────────────────
const DATABASES = {
  MARKET_PRICES: process.env.NEON_MARKET_PRICES,
  ACCOMMODATION: process.env.NEON_ACCOMMODATION,
  PROPERTY:      process.env.NEON_PROPERTY,
  ECONOMIC:      process.env.NEON_ECONOMIC,
  COMMODITIES:   process.env.NEON_COMMODITIES,
  FINANCIALS:    process.env.NEON_FINANCIALS,
};

// ── Expected tables per database (for verification) ───────────
const EXPECTED_TABLES = {
  MARKET_PRICES: ['market_prices'],
  ACCOMMODATION: ['airbnb_prices', 'hotel_prices'],
  PROPERTY:      ['property_prices'],
  ECONOMIC:      ['economic_indicators', 'exchange_rates'],
  COMMODITIES:   ['commodity_prices', 'fuel_prices'],
  FINANCIALS:    ['gse_indices', 'stock_prices'],
};

// ── DDL — one block per Neon project ─────────────────────────
// Column types derived from actual CSV schemas in master/*.csv
// All tables share: id BIGSERIAL PRIMARY KEY, collected_date DATE NOT NULL
// ─────────────────────────────────────────────────────────────
const DDL = {

  // ── NEON_MARKET_PRICES ──────────────────────────────────────
  // Source: market_prices.csv (Jiji / Melcom scraped listings)
  // CSV cols: scraped_date, week_number, year, source, product_category,
  //           search_label, title, price_raw, price_ghs, location,
  //           condition, listing_url
  MARKET_PRICES: `
    CREATE TABLE IF NOT EXISTS market_prices (
      id               BIGSERIAL     PRIMARY KEY,
      collected_date   DATE          NOT NULL,
      week_number      SMALLINT,
      year             SMALLINT,
      source           VARCHAR(30)   NOT NULL DEFAULT 'jiji',
      product_category VARCHAR(80),
      search_label     VARCHAR(100),
      title            TEXT,
      price_raw        VARCHAR(80),
      price_ghs        NUMERIC(12,2),
      location         VARCHAR(150),
      condition        VARCHAR(20),
      listing_url      TEXT,
      inserted_at      TIMESTAMPTZ   DEFAULT NOW(),
      UNIQUE (source, listing_url)
    );
    CREATE INDEX IF NOT EXISTS idx_mp_date     ON market_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_mp_week     ON market_prices(week_number, year);
    CREATE INDEX IF NOT EXISTS idx_mp_category ON market_prices(product_category);
    CREATE INDEX IF NOT EXISTS idx_mp_label    ON market_prices(search_label);
    CREATE INDEX IF NOT EXISTS idx_mp_source   ON market_prices(source);
  `,

  // ── NEON_ACCOMMODATION ──────────────────────────────────────
  // Source A: airbnb_prices.csv
  //   CSV cols: scraped_date, week_number, year, source, city,
  //             listing_name, room_type, price_raw, price_ghs,
  //             rating, review_count, listing_url
  //
  // Source B: hotel_prices.csv (Booking.com)
  //   CSV cols: scraped_date, week_number, year, source, city,
  //             hotel_name, stars, review_score, review_count,
  //             price_raw, price_per_night_usd, hotel_url
  ACCOMMODATION: `
    CREATE TABLE IF NOT EXISTS airbnb_prices (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      week_number    SMALLINT,
      year           SMALLINT,
      source         VARCHAR(20)  DEFAULT 'airbnb',
      city           VARCHAR(60),
      listing_id     VARCHAR(30),
      listing_name   TEXT,
      room_type      VARCHAR(100),
      price_raw      VARCHAR(60),
      price_ghs      NUMERIC(12,2),
      rating         NUMERIC(3,1),
      review_count   INTEGER,
      listing_url    TEXT,
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (source, listing_id, week_number, year)
    );
    CREATE INDEX IF NOT EXISTS idx_air_date       ON airbnb_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_air_city       ON airbnb_prices(city);
    CREATE INDEX IF NOT EXISTS idx_air_week       ON airbnb_prices(week_number, year);
    CREATE INDEX IF NOT EXISTS idx_air_listing_id ON airbnb_prices(listing_id);

    CREATE TABLE IF NOT EXISTS hotel_prices (
      id                  BIGSERIAL    PRIMARY KEY,
      collected_date      DATE         NOT NULL,
      week_number         SMALLINT,
      year                SMALLINT,
      source              VARCHAR(30)  DEFAULT 'booking.com',
      city                VARCHAR(60),
      hotel_name          TEXT,
      stars               SMALLINT,
      review_score        NUMERIC(3,1),
      review_count        INTEGER,
      price_raw           VARCHAR(60),
      price_per_night_usd NUMERIC(12,2),
      hotel_url           TEXT,
      inserted_at         TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (source, city, hotel_name, week_number, year)
    );
    CREATE INDEX IF NOT EXISTS idx_hot_date ON hotel_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_hot_city ON hotel_prices(city);
    CREATE INDEX IF NOT EXISTS idx_hot_week ON hotel_prices(week_number, year);
  `,

  // ── NEON_PROPERTY ───────────────────────────────────────────
  // Source: property_prices.csv (Meqasa.com)
  // CSV cols: scraped_date, week_number, year, source, property_type,
  //           listing_type, title, price_raw, price_ghs, location,
  //           bedrooms, bathrooms, size_sqm, listing_url
  PROPERTY: `
    CREATE TABLE IF NOT EXISTS property_prices (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      week_number    SMALLINT,
      year           SMALLINT,
      source         VARCHAR(30)  DEFAULT 'meqasa',
      property_type  VARCHAR(60),
      listing_type   VARCHAR(30),
      title          TEXT,
      price_raw      VARCHAR(80),
      price_ghs      NUMERIC(15,2),
      location       VARCHAR(150),
      bedrooms       VARCHAR(20),
      bathrooms      VARCHAR(20),
      size_sqm       VARCHAR(30),
      listing_url    TEXT,
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (source, listing_url, week_number, year)
    );
    CREATE INDEX IF NOT EXISTS idx_prop_date     ON property_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_prop_type     ON property_prices(property_type);
    CREATE INDEX IF NOT EXISTS idx_prop_listing  ON property_prices(listing_type);
    CREATE INDEX IF NOT EXISTS idx_prop_location ON property_prices(location);
    CREATE INDEX IF NOT EXISTS idx_prop_week     ON property_prices(week_number, year);
  `,

  // ── NEON_ECONOMIC ───────────────────────────────────────────
  // Source A: economic_indicators.csv (World Bank / BOG / GSS)
  //   CSV cols: fetched_date, year, month, indicator_code,
  //             indicator_name, sector, value, unit, source
  //
  // Source B: exchange_rates.csv (BOG open exchange)
  //   CSV cols: date, currency_pair, rate_ghs, source
  ECONOMIC: `
    CREATE TABLE IF NOT EXISTS economic_indicators (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      year           SMALLINT,
      month          SMALLINT,
      indicator_code VARCHAR(80)  NOT NULL,
      indicator_name VARCHAR(200),
      sector         VARCHAR(80),
      value          NUMERIC(20,6),
      unit           VARCHAR(60),
      source         VARCHAR(80),
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (indicator_code, year, month)
    );
    CREATE INDEX IF NOT EXISTS idx_ei_date   ON economic_indicators(collected_date);
    CREATE INDEX IF NOT EXISTS idx_ei_code   ON economic_indicators(indicator_code);
    CREATE INDEX IF NOT EXISTS idx_ei_period ON economic_indicators(year, month);
    CREATE INDEX IF NOT EXISTS idx_ei_sector ON economic_indicators(sector);

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      currency_pair  VARCHAR(20)  NOT NULL,
      rate_ghs       NUMERIC(12,4),
      source         VARCHAR(80),
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (currency_pair, collected_date)
    );
    CREATE INDEX IF NOT EXISTS idx_er_date ON exchange_rates(collected_date);
    CREATE INDEX IF NOT EXISTS idx_er_pair ON exchange_rates(currency_pair);
  `,

  // ── NEON_COMMODITIES ────────────────────────────────────────
  // Source A: commodity_prices.csv (MoFA agricultural commodities)
  //   CSV cols: date, week_number, year, commodity_code,
  //             commodity_name, market, region, price_ghs, unit, source
  //
  // Source B: fuel_prices.csv (NPA fuel prices)
  //   CSV cols: date, week_number, year, fuel_type,
  //             price_ghs_per_litre, currency, source
  COMMODITIES: `
    CREATE TABLE IF NOT EXISTS commodity_prices (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      week_number    SMALLINT,
      year           SMALLINT,
      commodity_code VARCHAR(40)  NOT NULL,
      commodity_name VARCHAR(100),
      market         VARCHAR(100),
      region         VARCHAR(80),
      price_ghs      NUMERIC(12,2),
      unit           VARCHAR(30),
      source         VARCHAR(60)  DEFAULT 'MoFA',
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (commodity_code, market, collected_date)
    );
    CREATE INDEX IF NOT EXISTS idx_cop_date   ON commodity_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_cop_code   ON commodity_prices(commodity_code);
    CREATE INDEX IF NOT EXISTS idx_cop_region ON commodity_prices(region);
    CREATE INDEX IF NOT EXISTS idx_cop_week   ON commodity_prices(week_number, year);

    CREATE TABLE IF NOT EXISTS fuel_prices (
      id                  BIGSERIAL    PRIMARY KEY,
      collected_date      DATE         NOT NULL,
      week_number         SMALLINT,
      year                SMALLINT,
      fuel_type           VARCHAR(60)  NOT NULL,
      price_ghs_per_litre NUMERIC(10,4),
      currency            VARCHAR(10)  DEFAULT 'GHS',
      source              VARCHAR(60),
      inserted_at         TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (fuel_type, collected_date)
    );
    CREATE INDEX IF NOT EXISTS idx_fp_date ON fuel_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_fp_type ON fuel_prices(fuel_type);
    CREATE INDEX IF NOT EXISTS idx_fp_week ON fuel_prices(week_number, year);
  `,

  // ── NEON_FINANCIALS ─────────────────────────────────────────
  // Source A: gse_indices.csv (Ghana Stock Exchange indices)
  //   CSV cols: date, week_number, year, index_name, value,
  //             change_points, change_pct, source
  //
  // Source B: stock_prices.csv (GSE individual stock prices)
  //   CSV cols: date, week_number, year, symbol, company_name,
  //             opening_price_ghs, closing_price_ghs, change_ghs,
  //             change_pct, volume, value_ghs, year_high, year_low, source
  FINANCIALS: `
    CREATE TABLE IF NOT EXISTS gse_indices (
      id             BIGSERIAL    PRIMARY KEY,
      collected_date DATE         NOT NULL,
      week_number    SMALLINT,
      year           SMALLINT,
      index_name     VARCHAR(80)  NOT NULL,
      value          NUMERIC(12,4),
      change_points  NUMERIC(12,4),
      change_pct     NUMERIC(8,4),
      source         VARCHAR(60),
      inserted_at    TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (index_name, collected_date)
    );
    CREATE INDEX IF NOT EXISTS idx_gse_date  ON gse_indices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_gse_index ON gse_indices(index_name);
    CREATE INDEX IF NOT EXISTS idx_gse_week  ON gse_indices(week_number, year);

    CREATE TABLE IF NOT EXISTS stock_prices (
      id                BIGSERIAL    PRIMARY KEY,
      collected_date    DATE         NOT NULL,
      week_number       SMALLINT,
      year              SMALLINT,
      symbol            VARCHAR(20)  NOT NULL,
      company_name      VARCHAR(150),
      opening_price_ghs NUMERIC(12,4),
      closing_price_ghs NUMERIC(12,4),
      change_ghs        NUMERIC(12,4),
      change_pct        NUMERIC(8,4),
      volume            BIGINT,
      value_ghs         NUMERIC(15,2),
      year_high         NUMERIC(12,4),
      year_low          NUMERIC(12,4),
      source            VARCHAR(60),
      inserted_at       TIMESTAMPTZ  DEFAULT NOW(),
      UNIQUE (symbol, collected_date)
    );
    CREATE INDEX IF NOT EXISTS idx_sp_date   ON stock_prices(collected_date);
    CREATE INDEX IF NOT EXISTS idx_sp_symbol ON stock_prices(symbol);
    CREATE INDEX IF NOT EXISTS idx_sp_week   ON stock_prices(week_number, year);
  `,
};

// ── Set up one Neon project ───────────────────────────────────
async function setupDatabase(name, connectionString) {
  if (!connectionString) {
    log(`NEON_${name} not set in .env — skipping`, '⚠');
    return { name, skipped: true };
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  try {
    log(`Connecting to ${name}…`, '▶');
    const client = await pool.connect();

    try {
      // Run all DDL for this database
      await client.query(DDL[name]);
      log(`${name} — DDL applied ✓`, '✓');

      // Verification: query information_schema for all public tables
      const { rows } = await client.query(`
        SELECT
          t.table_name,
          COUNT(c.column_name)                                        AS column_count,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS table_size
        FROM information_schema.tables  AS t
        JOIN information_schema.columns AS c
          ON c.table_name = t.table_name AND c.table_schema = 'public'
        WHERE t.table_schema = 'public'
          AND t.table_type   = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name
      `);

      return { name, tables: rows };

    } finally {
      client.release();
    }

  } catch (err) {
    log(`${name} — FAILED: ${err.message}`, '❌');
    return { name, error: err.message };

  } finally {
    await pool.end();
  }
}

// ── MAIN ─────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Neon PostgreSQL Setup (Phase 1)    ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  6 Neon projects · 10 tables                         ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  // Pre-flight: check all env vars are present
  const missing = Object.entries(DATABASES)
    .filter(([, v]) => !v)
    .map(([k]) => `NEON_${k}`);

  if (missing.length) {
    console.warn(`  ⚠  Missing connection strings: ${missing.join(', ')}`);
    console.warn('     Add them to your .env file and re-run.\n');
  }

  // Run setups sequentially (avoids overwhelming Neon free-tier connection limits)
  const results = [];
  for (const [name, conn] of Object.entries(DATABASES)) {
    const result = await setupDatabase(name, conn);
    results.push(result);
    console.log();
  }

  // ── Verification summary ─────────────────────────────────────
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   Verification Results                               ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');

  let totalFound = 0;
  let totalExpected = 0;
  let allOk = true;

  for (const res of results) {
    const expected = EXPECTED_TABLES[res.name];
    totalExpected += expected.length;

    if (res.skipped) {
      for (const tbl of expected) {
        console.log(`  ║  ⚠  ${'NEON_' + res.name}`.padEnd(28) + `${tbl.padEnd(25)} SKIPPED          ║`);
      }
      allOk = false;
      continue;
    }

    if (res.error) {
      for (const tbl of expected) {
        console.log(`  ║  ❌ ${'NEON_' + res.name}`.padEnd(28) + `${tbl.padEnd(25)} ERROR            ║`);
      }
      allOk = false;
      continue;
    }

    for (const expectedTable of expected) {
      const found = res.tables.find(t => t.table_name === expectedTable);
      if (found) {
        totalFound++;
        const cols = String(found.column_count).padStart(2);
        const size = found.table_size.padEnd(10);
        console.log(
          `  ║  ✓  ${'NEON_' + res.name}`.padEnd(28) +
          `${expectedTable.padEnd(24)} ${cols} cols  ${size} ║`
        );
      } else {
        allOk = false;
        console.log(
          `  ║  ✗  ${'NEON_' + res.name}`.padEnd(28) +
          `${expectedTable.padEnd(24)} MISSING           ║`
        );
      }
    }
  }

  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Tables verified: ${totalFound}/${totalExpected}`.padEnd(55) + '║');
  console.log('  ╚══════════════════════════════════════════════════════╝');

  if (allOk && totalFound === totalExpected) {
    console.log('\n  ✅  Phase 1 complete — all 10 tables ready across 6 Neon databases.\n');
    console.log('  Next steps:');
    console.log('    Phase 2 — Write db/ingest.js to load CSV data into each table');
    console.log('    Phase 3 — Update collectors to write directly to Neon\n');
  } else {
    console.log('\n  ⚠   Some tables missing. Fix connection strings / errors above and re-run.\n');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exit(1);
});
