-- ══════════════════════════════════════════════════════════════════════
-- SG Datalytics — Product 3b: Macro & Commodities (Commodities + Fuel)
-- Run this in: NEON_COMMODITIES database
-- ══════════════════════════════════════════════════════════════════════

-- ── 1a. Commodity prices view ──────────────────────────────────────────
CREATE OR REPLACE VIEW commodities_product AS
SELECT
  collected_date,
  week_number,
  year,
  commodity_code,
  commodity_name,
  market,
  region,
  price_ghs,
  unit,
  source
FROM commodity_prices;

-- ── 1b. Fuel prices view ───────────────────────────────────────────────
CREATE OR REPLACE VIEW fuel_product AS
SELECT
  collected_date,
  week_number,
  year,
  fuel_type,
  price_ghs_per_litre,
  currency,
  source
FROM fuel_prices;

-- ── 2. Read-only role ──────────────────────────────────────────────────
-- Same role name and password as product-03-economic.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'macro_reader') THEN
    CREATE ROLE macro_reader WITH LOGIN PASSWORD 'CHANGE_ME_strong_password_3';
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO macro_reader;
GRANT USAGE ON SCHEMA public TO macro_reader;
GRANT SELECT ON commodities_product TO macro_reader;
GRANT SELECT ON fuel_product         TO macro_reader;

-- ── 3. Verify ──────────────────────────────────────────────────────────
SELECT 'commodities_product' AS view_name, COUNT(*) AS total_rows,
       COUNT(DISTINCT commodity_name) AS commodities,
       COUNT(DISTINCT region)         AS regions,
       MIN(collected_date) AS earliest, MAX(collected_date) AS latest
FROM commodities_product
UNION ALL
SELECT 'fuel_product', COUNT(*),
       COUNT(DISTINCT fuel_type), NULL,
       MIN(collected_date), MAX(collected_date)
FROM fuel_product;
