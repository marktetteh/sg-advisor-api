# SG Datalytics — Data Products Setup

Three sellable data products backed by live Neon databases.
Each product is a read-only PostgreSQL role + curated views.
Buyers receive a connection string — works in Python, R, Excel, Tableau, Power BI.

---

## Products

| # | Product | Script(s) | Neon DB env var | Role |
|---|---------|-----------|-----------------|------|
| 1 | SGMPI Consumer Prices | product-01-sgmpi.sql | NEON_MARKET_PRICES | sgmpi_reader |
| 2 | Real Estate & Accommodation | product-02-property.sql + product-02-accommodation.sql | NEON_PROPERTY + NEON_ACCOMMODATION | realestate_reader |
| 3 | Macro & Commodities | product-03-economic.sql + product-03-commodities.sql | NEON_ECONOMIC + NEON_COMMODITIES | macro_reader |

---

## How to run

1. Open the Neon console → select the correct project → SQL Editor
2. Paste and run the relevant .sql file
3. **Replace all `CHANGE_ME_strong_password_X` with real passwords before running**
4. Note the connection string from Neon's dashboard (Connection Details)

---

## Connection string format

After running a script, the buyer's connection string is:

```
postgresql://<role>:<password>@<neon-host>/<dbname>?sslmode=require
```

Example for Product 1:
```
postgresql://sgmpi_reader:yourpassword@ep-xxx-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Find `<neon-host>` in Neon dashboard → Connection Details → Host field.

---

## Views per product

### Product 1 — SGMPI Consumer Prices
| View | Columns |
|------|---------|
| `sgmpi_product` | collected_date, week_number, year, product_category, normalized_name, brand, model, storage, condition, price_ghs, location |

### Product 2 — Real Estate & Accommodation
| View | DB | Columns |
|------|----|---------|
| `property_product` | NEON_PROPERTY | collected_date, week_number, year, property_type, listing_type, price_raw, price_ghs, location, neighborhood, city, bedrooms, bathrooms, size_sqm, listing_url |
| `hotels_product` | NEON_ACCOMMODATION | collected_date, week_number, year, city, hotel_name, star_rating, stars, review_score, review_count, price_raw, price_per_night_usd, source_platform, hotel_url |
| `airbnb_product` | NEON_ACCOMMODATION | collected_date, week_number, year, city, listing_name, room_type, price_raw, price_ghs, rating, review_count, listing_url |

### Product 3 — Macro & Commodities
| View | DB | Columns |
|------|----|---------|
| `economic_product` | NEON_ECONOMIC | collected_date, year, month, indicator_code, indicator_name, sector, value, unit, source |
| `fx_product` | NEON_ECONOMIC | collected_date, currency_pair, rate_ghs, source |
| `commodities_product` | NEON_COMMODITIES | collected_date, week_number, year, commodity_code, commodity_name, market, region, price_ghs, unit, source |
| `fuel_product` | NEON_COMMODITIES | collected_date, week_number, year, fuel_type, price_ghs_per_litre, currency, source |

---

## Revoking access

When a subscription lapses, connect to the relevant Neon DB and run:

```sql
-- Revoke connection (locks them out immediately)
REVOKE CONNECT ON DATABASE neondb FROM <role_name>;

-- To fully remove the role
-- REASSIGN OWNED BY <role_name> TO postgres;
-- DROP ROLE <role_name>;
```

---

## Buyer usage examples

```python
# Python / pandas
import pandas as pd
conn = "postgresql://sgmpi_reader:password@ep-xxx.neon.tech/neondb?sslmode=require"
df = pd.read_sql("SELECT * FROM sgmpi_product WHERE year = 2026", conn)
```

```r
# R
library(RPostgres)
con <- dbConnect(Postgres(), dsn = "postgresql://sgmpi_reader:password@...")
df  <- dbGetQuery(con, "SELECT * FROM sgmpi_product")
```

Excel → Data → Get Data → From Database → PostgreSQL → paste host + credentials
Tableau / Power BI → PostgreSQL connector → paste host + credentials
