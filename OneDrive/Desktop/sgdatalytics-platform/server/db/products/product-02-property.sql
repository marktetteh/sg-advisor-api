-- ══════════════════════════════════════════════════════════════════════
-- SG Datalytics — Product 2a: Real Estate & Accommodation (Property)
-- Run this in: NEON_PROPERTY database
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Product view ────────────────────────────────────────────────────
-- Only rows that passed the AI location quality gate (city is known).
-- listing_url included so buyers can verify/enrich listings themselves.

CREATE OR REPLACE VIEW property_product AS
SELECT
  collected_date,
  week_number,
  year,
  property_type,
  listing_type,
  price_raw,
  price_ghs,
  location,
  neighborhood,
  city,
  bedrooms,
  bathrooms,
  size_sqm,
  listing_url
FROM property_prices
WHERE city IS NOT NULL
  AND city <> '';

-- ── 2. Read-only role ──────────────────────────────────────────────────
-- Same role name used in the accommodation DB so buyer remembers one name.
-- Change the password before running.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'realestate_reader') THEN
    CREATE ROLE realestate_reader WITH LOGIN PASSWORD 'CHANGE_ME_strong_password_2';
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO realestate_reader;
GRANT USAGE ON SCHEMA public TO realestate_reader;
GRANT SELECT ON property_product TO realestate_reader;

-- ── 3. Verify ──────────────────────────────────────────────────────────
SELECT
  'property_product'              AS view_name,
  COUNT(*)                        AS total_rows,
  COUNT(DISTINCT property_type)   AS property_types,
  COUNT(DISTINCT city)            AS cities,
  MIN(collected_date)             AS earliest,
  MAX(collected_date)             AS latest
FROM property_product;
