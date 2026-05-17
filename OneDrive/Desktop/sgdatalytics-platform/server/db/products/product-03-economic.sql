-- ══════════════════════════════════════════════════════════════════════
-- SG Datalytics — Product 3a: Macro & Commodities (Economic Indicators)
-- Run this in: NEON_ECONOMIC database
-- ══════════════════════════════════════════════════════════════════════

-- ── 1a. Economic indicators view ───────────────────────────────────────
CREATE OR REPLACE VIEW economic_product AS
SELECT
  collected_date,
  year,
  month,
  indicator_code,
  indicator_name,
  sector,
  value,
  unit,
  source
FROM economic_indicators;

-- ── 1b. Exchange rates view ────────────────────────────────────────────
CREATE OR REPLACE VIEW fx_product AS
SELECT
  collected_date,
  currency_pair,
  rate_ghs,
  source
FROM exchange_rates;

-- ── 2. Read-only role ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'macro_reader') THEN
    CREATE ROLE macro_reader WITH LOGIN PASSWORD 'CHANGE_ME_strong_password_3';
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO macro_reader;
GRANT USAGE ON SCHEMA public TO macro_reader;
GRANT SELECT ON economic_product TO macro_reader;
GRANT SELECT ON fx_product        TO macro_reader;

-- ── 3. Verify ──────────────────────────────────────────────────────────
SELECT 'economic_product' AS view_name, COUNT(*) AS total_rows,
       COUNT(DISTINCT indicator_name) AS indicators,
       COUNT(DISTINCT sector)         AS sectors,
       MIN(collected_date) AS earliest, MAX(collected_date) AS latest
FROM economic_product
UNION ALL
SELECT 'fx_product', COUNT(*),
       COUNT(DISTINCT currency_pair), NULL,
       MIN(collected_date), MAX(collected_date)
FROM fx_product;
