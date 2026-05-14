"""
db.py — Live Neon PostgreSQL catalog builder for SG Data Advisor
Connects to all 6 Neon databases and builds a unified dataset catalog
that the AI agent uses instead of the hardcoded datasets.py list.

Priority order for catalog data:
  1. catalog_cache.json  — pre-built weekly snapshot (fastest, preferred)
  2. Live Neon DB query  — fallback if JSON file is missing or stale
  3. datasets.py         — hardcoded fallback (agent.py handles this)

Run refresh_catalog.py weekly (or via scheduler) to keep the JSON fresh.
"""

import os
import json
import time
import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

CACHE_FILE = Path(__file__).parent / "catalog_cache.json"
CACHE_TTL  = 3600 * 24 * 7  # 7 days — expect weekly refresh via scheduler

_catalog_cache: list = []
_cache_timestamp: float = 0.0


# ── DB connection URLs (from .env) ────────────────────────────────────────────

def _clean_url(url: str) -> str:
    """Strip parameters unsupported by psycopg2 (e.g. channel_binding)."""
    return url.replace("&channel_binding=require", "").replace("?channel_binding=require", "")

DB_URLS = {
    "market_prices": _clean_url(os.getenv("NEON_MARKET_PRICES", "")),
    "accommodation": _clean_url(os.getenv("NEON_ACCOMMODATION", "")),
    "property":      _clean_url(os.getenv("NEON_PROPERTY", "")),
    "economic":      _clean_url(os.getenv("NEON_ECONOMIC", "")),
    "commodities":   _clean_url(os.getenv("NEON_COMMODITIES", "")),
    "financials":    _clean_url(os.getenv("NEON_FINANCIALS", "")),
}


# ── Utility ───────────────────────────────────────────────────────────────────

def _query(url: str, sql: str, params=None) -> list:
    conn = psycopg2.connect(url, connect_timeout=10)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def _scalar(url: str, sql: str, params=None):
    rows = _query(url, sql, params)
    return list(rows[0].values())[0] if rows else None


# ── Per-database catalog builders ─────────────────────────────────────────────

def _build_market_prices(url: str) -> dict:
    categories = _query(url,
        "SELECT product_category, COUNT(*) AS n FROM market_prices "
        "GROUP BY product_category ORDER BY n DESC")
    cat_list = [r["product_category"] for r in categories]
    total = sum(r["n"] for r in categories)
    date_range = _query(url,
        "SELECT MIN(collected_date) AS d_from, MAX(collected_date) AS d_to FROM market_prices")
    d = date_range[0] if date_range else {}
    return {
        "id": "neon_market_prices",
        "name": "SG Market Prices — Ghana Classifieds",
        "source": "SG Datalytics (scraped from online classifieds)",
        "sector": "Pricing / Market Intelligence",
        "description": (
            f"Weekly market price listings scraped from Ghanaian online classifieds. "
            f"{total:,} records across {len(cat_list)} product categories: "
            f"{', '.join(cat_list[:8])}{'...' if len(cat_list) > 8 else ''}. "
            f"Data runs from {d.get('d_from', 'N/A')} to {d.get('d_to', 'N/A')}."
        ),
        "key_variables": ["product_category", "price_ghs", "location", "condition",
                          "source", "collected_date", "week_number"],
        "best_for": [
            "retail pricing strategy", "market price benchmarking", "price trend analysis",
            "consumer goods pricing", "inflation cross-validation", "SME procurement",
            "electronics pricing", "vehicle pricing", "real estate price intelligence",
        ],
        "suggested_methods": ["Time series analysis", "Price elasticity analysis",
                               "Regression", "Descriptive analytics", "Dashboard analytics"],
        "sample_objectives": [
            "To analyse weekly price trends for electronics in the Ghanaian second-hand market",
            "To benchmark vehicle prices across regions in Ghana using classified listings",
            "To identify price disparities for household appliances across Ghanaian cities",
        ],
        "row_count": total,
        "date_from": str(d.get("d_from", "")),
        "date_to": str(d.get("d_to", "")),
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_accommodation(url: str) -> dict:
    airbnb_count = _scalar(url, "SELECT COUNT(*) FROM airbnb_prices") or 0
    hotel_count  = _scalar(url, "SELECT COUNT(*) FROM hotel_prices") or 0
    cities = _query(url, "SELECT DISTINCT city FROM hotel_prices ORDER BY city")
    city_list = [r["city"] for r in cities]
    return {
        "id": "neon_accommodation",
        "name": "Ghana Accommodation Prices (Airbnb & Hotels)",
        "source": "SG Datalytics (scraped from Airbnb, booking platforms)",
        "sector": "Tourism / Hospitality",
        "description": (
            f"Accommodation pricing data for Ghana covering {airbnb_count} Airbnb listings "
            f"and {hotel_count} hotel entries across cities: {', '.join(city_list)}. "
            "Includes nightly rates, star ratings, review scores, and room types."
        ),
        "key_variables": ["city", "room_type", "price_ghs", "price_per_night_usd",
                          "stars", "review_score", "review_count", "source_platform"],
        "best_for": [
            "tourism pricing research", "hospitality market analysis", "travel cost studies",
            "Airbnb vs hotel comparison", "city-level accommodation benchmarking",
            "tourism investment research",
        ],
        "suggested_methods": ["Descriptive analytics", "Regression", "Price comparison",
                               "Benchmarking", "Sentiment analysis on reviews"],
        "sample_objectives": [
            "To compare Airbnb and hotel pricing across major Ghanaian cities",
            "To analyse the relationship between hotel star rating and nightly price in Ghana",
            "To assess accommodation cost as a factor in Ghana's tourism competitiveness",
        ],
        "row_count": airbnb_count + hotel_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_property(url: str) -> dict:
    total = _scalar(url, "SELECT COUNT(*) FROM property_prices") or 0
    types = _query(url,
        "SELECT property_type, listing_type, COUNT(*) AS n FROM property_prices "
        "GROUP BY property_type, listing_type ORDER BY n DESC LIMIT 8")
    type_summary = [f"{r['property_type']} ({r['listing_type']})" for r in types]
    locations = _query(url,
        "SELECT DISTINCT location FROM property_prices WHERE location IS NOT NULL LIMIT 10")
    loc_list = [r["location"] for r in locations]
    return {
        "id": "neon_property",
        "name": "Ghana Property Prices",
        "source": "SG Datalytics (scraped from property listing platforms)",
        "sector": "Real Estate / Property",
        "description": (
            f"{total:,} property listings in Ghana covering types: "
            f"{', '.join(type_summary[:5])}. "
            f"Locations include: {', '.join(loc_list[:6])}. "
            "Includes sale and rental prices in GHS, bedroom/bathroom counts, and size."
        ),
        "key_variables": ["property_type", "listing_type", "price_ghs", "location",
                          "bedrooms", "bathrooms", "size_sqm", "collected_date"],
        "best_for": [
            "real estate market research", "property price analysis", "rental yield studies",
            "housing affordability research", "investment property analysis",
            "land pricing studies", "office space benchmarking",
        ],
        "suggested_methods": ["Regression", "Hedonic pricing model", "Descriptive analytics",
                               "GIS mapping", "Price index construction"],
        "sample_objectives": [
            "To analyse determinants of residential property prices in Accra",
            "To compare rental vs sale prices for apartments across Ghanaian cities",
            "To develop a property price index for the Ghanaian real estate market",
        ],
        "row_count": total,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_economic(url: str) -> dict:
    ind_count = _scalar(url, "SELECT COUNT(*) FROM economic_indicators") or 0
    fx_count  = _scalar(url, "SELECT COUNT(*) FROM exchange_rates") or 0
    sectors   = _query(url,
        "SELECT DISTINCT sector FROM economic_indicators WHERE sector IS NOT NULL ORDER BY sector")
    sector_list = [r["sector"] for r in sectors]
    indicators = _query(url,
        "SELECT DISTINCT indicator_name FROM economic_indicators LIMIT 20")
    ind_list = [r["indicator_name"] for r in indicators]
    return {
        "id": "neon_economic",
        "name": "Ghana Economic Indicators & Exchange Rates",
        "source": "World Bank, Bank of Ghana, Ghana Statistical Service",
        "sector": "Economy / Macroeconomics",
        "description": (
            f"{ind_count:,} economic indicator readings across sectors: "
            f"{', '.join(sector_list)}. "
            f"Plus {fx_count} live exchange rate records. "
            f"Sample indicators: {', '.join(ind_list[:6])}."
        ),
        "key_variables": ["indicator_name", "indicator_code", "sector", "value",
                          "unit", "year", "month", "source", "currency_pair", "rate_ghs"],
        "best_for": [
            "macroeconomic research", "GDP analysis", "inflation studies",
            "trade research", "agriculture economics", "social development research",
            "exchange rate analysis", "fiscal policy research", "environmental economics",
        ],
        "suggested_methods": ["Time series analysis", "Regression", "VAR models",
                               "Cointegration", "Panel data analysis", "ARIMA forecasting"],
        "sample_objectives": [
            "To analyse Ghana's GDP growth trends and their macroeconomic determinants",
            "To examine the relationship between exchange rate and inflation in Ghana",
            "To assess the impact of trade openness on economic growth in Ghana",
        ],
        "row_count": ind_count + fx_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_commodities(url: str) -> dict:
    comm_count = _scalar(url, "SELECT COUNT(*) FROM commodity_prices") or 0
    fuel_count = _scalar(url, "SELECT COUNT(*) FROM fuel_prices") or 0
    items = _query(url,
        "SELECT DISTINCT commodity_name FROM commodity_prices ORDER BY commodity_name")
    item_list = [r["commodity_name"] for r in items]
    fuels = _query(url,
        "SELECT fuel_type, price_ghs_per_litre FROM fuel_prices ORDER BY collected_date DESC LIMIT 4")
    fuel_summary = [f"{r['fuel_type']} (GHS {r['price_ghs_per_litre']}/L)" for r in fuels]
    markets = _query(url,
        "SELECT DISTINCT market FROM commodity_prices ORDER BY market")
    market_list = [r["market"] for r in markets]
    return {
        "id": "neon_commodities",
        "name": "Ghana Commodity & Fuel Prices",
        "source": "SG Datalytics, Esoko, Accra markets",
        "sector": "Agriculture / Commodities / Energy",
        "description": (
            f"{comm_count} commodity price records for: {', '.join(item_list[:10])}. "
            f"Markets covered: {', '.join(market_list)}. "
            f"Plus {fuel_count} fuel price records: {', '.join(fuel_summary[:3])}."
        ),
        "key_variables": ["commodity_name", "market", "region", "price_ghs",
                          "unit", "fuel_type", "price_ghs_per_litre", "collected_date"],
        "best_for": [
            "food price research", "agricultural market analysis", "commodity price forecasting",
            "food security studies", "fuel price impact analysis", "inflation cross-validation",
            "supply chain research", "farm-gate price studies",
        ],
        "suggested_methods": ["Time series analysis", "Price elasticity analysis",
                               "Regression", "ARIMA", "Spatial price analysis"],
        "sample_objectives": [
            "To analyse seasonal price fluctuations of staple food commodities in Ghana",
            "To examine the impact of fuel price changes on food commodity prices in Ghana",
            "To compare commodity prices across market locations in Ghana",
        ],
        "row_count": comm_count + fuel_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_financials(url: str) -> dict:
    stock_count = _scalar(url, "SELECT COUNT(*) FROM stock_prices") or 0
    idx_count   = _scalar(url, "SELECT COUNT(*) FROM gse_indices") or 0
    stocks = _query(url,
        "SELECT symbol, company_name, closing_price_ghs FROM stock_prices "
        "ORDER BY collected_date DESC, symbol LIMIT 15")
    stock_list = [f"{r['symbol']} ({r['company_name']})" for r in stocks]
    return {
        "id": "neon_financials",
        "name": "Ghana Stock Exchange (GSE) — Stock Prices & Indices",
        "source": "SG Datalytics (scraped from GSE)",
        "sector": "Finance / Capital Markets",
        "description": (
            f"{stock_count} stock price records and {idx_count} GSE index records. "
            f"Listed companies include: {', '.join(stock_list[:8])}. "
            "Covers opening/closing prices, volume, value, year highs/lows, and index changes."
        ),
        "key_variables": ["symbol", "company_name", "opening_price_ghs", "closing_price_ghs",
                          "change_ghs", "change_pct", "volume", "value_ghs",
                          "year_high", "year_low", "index_name", "collected_date"],
        "best_for": [
            "capital market research", "stock price analysis", "GSE performance studies",
            "portfolio analysis", "financial market development research",
            "listed company performance", "equity investment research",
        ],
        "suggested_methods": ["Time series analysis", "GARCH models", "Event study",
                               "Portfolio analysis", "Descriptive analytics", "Regression"],
        "sample_objectives": [
            "To analyse stock price volatility on the Ghana Stock Exchange",
            "To examine the performance of banking sector stocks listed on the GSE",
            "To assess the relationship between GSE index and macroeconomic indicators in Ghana",
        ],
        "row_count": stock_count + idx_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


# ── Master catalog builder ────────────────────────────────────────────────────

BUILDERS = {
    "market_prices": _build_market_prices,
    "accommodation": _build_accommodation,
    "property":      _build_property,
    "economic":      _build_economic,
    "commodities":   _build_commodities,
    "financials":    _build_financials,
}


def _load_from_json() -> list:
    """Load catalog from the pre-built JSON snapshot if it exists and is fresh."""
    if not CACHE_FILE.exists():
        return []
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        age_seconds = time.time() - CACHE_FILE.stat().st_mtime
        if age_seconds > CACHE_TTL:
            print(f"[db.py] catalog_cache.json is {age_seconds/86400:.1f} days old — will re-query DB")
            return []
        datasets = data.get("datasets", [])
        print(f"[db.py] ✓ Loaded {len(datasets)} entries from catalog_cache.json "
              f"(refreshed: {data.get('refreshed_at', 'unknown')})")
        return datasets
    except Exception as e:
        print(f"[db.py] Could not read catalog_cache.json: {e}")
        return []


def _load_from_db() -> list:
    """Query all 6 Neon databases live and return the catalog."""
    catalog = []
    for db_key, builder in BUILDERS.items():
        url = DB_URLS.get(db_key, "")
        if not url:
            print(f"[db.py] WARNING: No URL configured for {db_key}")
            continue
        try:
            entry = builder(url)
            catalog.append(entry)
            print(f"[db.py] ✓ Loaded catalog entry for {db_key} ({entry['row_count']:,} rows)")
        except Exception as e:
            print(f"[db.py] ✗ Failed to load {db_key}: {e}")
    return catalog


def load_live_catalog(force_refresh: bool = False) -> list:
    """
    Return the unified dataset catalog.
    Priority:
      1. In-memory cache (fastest)
      2. catalog_cache.json snapshot (built weekly by refresh_catalog.py)
      3. Live Neon DB query (fallback if file is missing or stale)
    """
    global _catalog_cache, _cache_timestamp

    # 1. In-memory cache
    if not force_refresh and _catalog_cache and (time.time() - _cache_timestamp) < CACHE_TTL:
        return _catalog_cache

    # 2. JSON snapshot file
    if not force_refresh:
        catalog = _load_from_json()
        if catalog:
            _catalog_cache = catalog
            _cache_timestamp = time.time()
            return catalog

    # 3. Live DB query
    print("[db.py] Falling back to live Neon DB query...")
    catalog = _load_from_db()
    if catalog:
        _catalog_cache = catalog
        _cache_timestamp = time.time()

    return catalog


def search_live_datasets(query: str, sector: str = None) -> list:
    """Search the live catalog by keyword and optional sector filter."""
    catalog = load_live_catalog()
    query_lower = query.lower()
    results = []
    for d in catalog:
        score = 0
        searchable = " ".join([
            d["name"], d["description"], d["sector"],
            " ".join(d.get("best_for", [])),
            " ".join(d.get("key_variables", [])),
        ]).lower()
        for word in query_lower.split():
            if len(word) > 2 and word in searchable:
                score += 1
        if sector and sector.lower() in d["sector"].lower():
            score += 3
        if score > 0:
            results.append({"score": score, "dataset": d})
    results.sort(key=lambda x: x["score"], reverse=True)
    return [r["dataset"] for r in results[:5]]
