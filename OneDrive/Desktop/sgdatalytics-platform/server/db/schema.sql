-- ============================================================
--  SG DATALYTICS — PostgreSQL Schema
--  Ghana Market Intelligence Platform
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. SECTORS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sectors (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(32)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(8),
    color       VARCHAR(10),
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── 2. INDICATORS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indicators (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(80)  UNIQUE NOT NULL,
    name        VARCHAR(200) NOT NULL,
    unit        VARCHAR(60),
    fmt         VARCHAR(10),              -- pct | num | B | M | K | dec
    sector_id   INTEGER REFERENCES sectors(id),
    source      VARCHAR(60)  NOT NULL,    -- 'World Bank' | 'Bank of Ghana' | 'GSS'
    frequency   VARCHAR(20)  DEFAULT 'annual',  -- annual | monthly | daily | weekly
    wb_code     VARCHAR(80),              -- World Bank API code if applicable
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── 3. INDICATOR VALUES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS indicator_values (
    id           BIGSERIAL PRIMARY KEY,
    indicator_id INTEGER NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    period_date  DATE    NOT NULL,        -- annual → Jan 1; monthly → 1st of month
    value        NUMERIC(20, 6),
    fetched_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (indicator_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_iv_indicator ON indicator_values(indicator_id);
CREATE INDEX IF NOT EXISTS idx_iv_date      ON indicator_values(period_date);
CREATE INDEX IF NOT EXISTS idx_iv_ind_date  ON indicator_values(indicator_id, period_date);

-- ── 4. COMMODITIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commodities (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(40)  UNIQUE NOT NULL,
    name       VARCHAR(100) NOT NULL,
    category   VARCHAR(60),
    unit       VARCHAR(30),              -- kg | 50kg bag | crate | litre
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── 5. COMMODITY PRICES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS commodity_prices (
    id           BIGSERIAL PRIMARY KEY,
    commodity_id INTEGER NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    market       VARCHAR(100),
    region       VARCHAR(80),
    price_ghs    NUMERIC(12, 2),
    price_date   DATE NOT NULL,
    source       VARCHAR(60) DEFAULT 'MoFA',
    fetched_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (commodity_id, market, price_date)
);

CREATE INDEX IF NOT EXISTS idx_cp_commodity ON commodity_prices(commodity_id);
CREATE INDEX IF NOT EXISTS idx_cp_date      ON commodity_prices(price_date);
CREATE INDEX IF NOT EXISTS idx_cp_region    ON commodity_prices(region);

-- ── 6. SCRAPED LISTINGS (Jiji / Tonaton) ─────────────────────
CREATE TABLE IF NOT EXISTS scraped_listings (
    id               BIGSERIAL PRIMARY KEY,
    source           VARCHAR(20)  NOT NULL,   -- 'jiji' | 'tonaton'
    product_category VARCHAR(60),
    search_label     VARCHAR(80),
    title            TEXT,
    price_raw        VARCHAR(60),
    price_ghs        NUMERIC(12, 2),
    location         VARCHAR(120),
    condition        VARCHAR(20),             -- new | used | unknown
    listing_url      TEXT,
    scraped_at       TIMESTAMP DEFAULT NOW(),
    week_number      SMALLINT,
    year             SMALLINT,
    UNIQUE (source, listing_url)
);

CREATE INDEX IF NOT EXISTS idx_sl_source ON scraped_listings(source);
CREATE INDEX IF NOT EXISTS idx_sl_label  ON scraped_listings(search_label);
CREATE INDEX IF NOT EXISTS idx_sl_week   ON scraped_listings(week_number, year);
CREATE INDEX IF NOT EXISTS idx_sl_cat    ON scraped_listings(product_category);

-- ── 7. WEEKLY MARKET ANALYSES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_market_analyses (
    id               SERIAL PRIMARY KEY,
    search_label     VARCHAR(80) NOT NULL,
    product_category VARCHAR(60),
    week_number      SMALLINT    NOT NULL,
    year             SMALLINT    NOT NULL,
    total_listings   INTEGER     DEFAULT 0,
    platform_a_count INTEGER     DEFAULT 0,
    platform_b_count INTEGER     DEFAULT 0,
    avg_price_ghs    NUMERIC(12, 2),
    median_price_ghs NUMERIC(12, 2),
    min_price_ghs    NUMERIC(12, 2),
    max_price_ghs    NUMERIC(12, 2),
    new_count        INTEGER     DEFAULT 0,
    used_count       INTEGER     DEFAULT 0,
    price_trend_pct  NUMERIC(8, 2),
    volume_trend_pct NUMERIC(8, 2),
    insights_text    TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE (search_label, week_number, year)
);

-- ── 8. FETCH LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fetch_log (
    id             BIGSERIAL PRIMARY KEY,
    collector      VARCHAR(60) NOT NULL,
    indicator_code VARCHAR(80),
    records_fetched INTEGER     DEFAULT 0,
    status         VARCHAR(20) DEFAULT 'ok',  -- ok | error | partial
    message        TEXT,
    fetched_at     TIMESTAMP DEFAULT NOW(),
    source_url     TEXT
);
