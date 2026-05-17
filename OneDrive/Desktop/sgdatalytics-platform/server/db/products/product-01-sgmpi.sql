-- ══════════════════════════════════════════════════════════════════════
-- SG Datalytics — Product 1: SGMPI Consumer Prices
-- Run this in: NEON_MARKET_PRICES database
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Product view ────────────────────────────────────────────────────
-- Exposes only clean, enriched rows. Internal IDs, raw titles, and
-- listing URLs are excluded — buyer sees a structured price dataset only.

CREATE OR REPLACE VIEW sgmpi_product AS
SELECT
  collected_date,
  week_number,
  year,
  product_category,
  normalized_name,
  brand,
  model,
  storage,
  condition,
  price_ghs,
  location
FROM market_prices
WHERE normalized_name IS NOT NULL
  AND normalized_name <> '';

-- ── 2. Read-only role ──────────────────────────────────────────────────
-- Change the password before running. Store it securely.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sgmpi_reader') THEN
    CREATE ROLE sgmpi_reader WITH LOGIN PASSWORD 'CHANGE_ME_strong_password_1';
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO sgmpi_reader;
GRANT USAGE ON SCHEMA public TO sgmpi_reader;
GRANT SELECT ON sgmpi_product TO sgmpi_reader;

-- ── 3. Verify ──────────────────────────────────────────────────────────
SELECT
  'sgmpi_product' AS view_name,
  COUNT(*)        AS total_rows,
  COUNT(DISTINCT product_category) AS categories,
  COUNT(DISTINCT location)         AS locations,
  MIN(collected_date)              AS earliest,
  MAX(collected_date)              AS latest
FROM sgmpi_product;
