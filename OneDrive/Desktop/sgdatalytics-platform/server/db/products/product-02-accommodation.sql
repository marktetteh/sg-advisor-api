-- ══════════════════════════════════════════════════════════════════════
-- SG Datalytics — Product 2b: Real Estate & Accommodation (Hotels + Airbnb)
-- Run this in: NEON_ACCOMMODATION database
-- ══════════════════════════════════════════════════════════════════════

-- ── 1a. Hotels view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW hotels_product AS
SELECT
  collected_date,
  week_number,
  year,
  city,
  hotel_name,
  star_rating,
  stars,
  review_score,
  review_count,
  price_raw,
  price_per_night_usd,
  source_platform,
  hotel_url
FROM hotel_prices;

-- ── 1b. Airbnb view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW airbnb_product AS
SELECT
  collected_date,
  week_number,
  year,
  city,
  listing_name,
  room_type,
  price_raw,
  price_ghs,
  rating,
  review_count,
  listing_url
FROM airbnb_prices;

-- ── 2. Read-only role ──────────────────────────────────────────────────
-- Same role name and password as product-02-property.sql.
-- Run this AFTER running product-02-property.sql so the role already exists,
-- or create it fresh here with the same credentials.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'realestate_reader') THEN
    CREATE ROLE realestate_reader WITH LOGIN PASSWORD 'CHANGE_ME_strong_password_2';
  END IF;
END $$;

GRANT CONNECT ON DATABASE neondb TO realestate_reader;
GRANT USAGE ON SCHEMA public TO realestate_reader;
GRANT SELECT ON hotels_product  TO realestate_reader;
GRANT SELECT ON airbnb_product  TO realestate_reader;

-- ── 3. Verify ──────────────────────────────────────────────────────────
SELECT 'hotels_product'  AS view_name, COUNT(*) AS total_rows,
       COUNT(DISTINCT city) AS cities,
       MIN(collected_date) AS earliest, MAX(collected_date) AS latest
FROM hotels_product
UNION ALL
SELECT 'airbnb_product', COUNT(*),
       COUNT(DISTINCT city),
       MIN(collected_date), MAX(collected_date)
FROM airbnb_product;
