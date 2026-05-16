"""
db.py — Live Neon PostgreSQL catalog builder for SG Data Advisor
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
CACHE_TTL  = 3600 * 24 * 7  # 7 days

_catalog_cache: list = []
_cache_timestamp: float = 0.0


def _clean_url(url: str) -> str:
    return url.replace("&channel_binding=require", "").replace("?channel_binding=require", "")

DB_URLS = {
    "market_prices": _clean_url(os.getenv("NEON_MARKET_PRICES", "")),
    "accommodation": _clean_url(os.getenv("NEON_ACCOMMODATION", "")),
    "property":      _clean_url(os.getenv("NEON_PROPERTY", "")),
    "economic":      _clean_url(os.getenv("NEON_ECONOMIC", "")),
    "commodities":   _clean_url(os.getenv("NEON_COMMODITIES", "")),
    "financials":    _clean_url(os.getenv("NEON_FINANCIALS", "")),
}


def _query(url: str, sql: str, params=None) -> list:
    conn = psycopg2.connect(url, connect_timeout=5)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def _scalar(url: str, sql: str, params=None):
    rows = _query(url, sql, params)
    return list(rows[0].values())[0] if rows else None


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
        "name": "SG Market Prices -- Ghana Classifieds",
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
        ],
        "suggested_methods": ["Descriptive analytics", "Regression", "Price comparison",
                               "Benchmarking", "Sentiment analysis on reviews"],
        "sample_objectives": [
            "To compare Airbnb and hotel pricing across major Ghanaian cities",
            "To analyse the relationship between hotel star rating and nightly price in Ghana",
        ],
        "row_count": airbnb_count + hotel_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


def _build_property(url: str) -> dict:
    total = _scalar(url, "SELECT COUNT(*) FROM property_prices") or 0
    types = _query(url,
        "SELECT property_type, listing_type, COUNT(*) AS n FROM property_prices "
        "GROUP BY property_type, listing_type ORDER BY n DESC LIMIT 5")
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
        ],
        "suggested_methods": ["Regression", "Hedonic pricing model", "Descriptive analytics",
                               "GIS mapping", "Price index construction"],
        "sample_objectives": [
            "To analyse determinants of residential property prices in Accra",
            "To compare rental vs sale prices for apartments across Ghanaian cities",
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
            "trade research", "exchange rate analysis", "fiscal policy research",
        ],
        "suggested_methods": ["Time series analysis", "Regression", "VAR models",
                               "Cointegration", "Panel data analysis", "ARIMA forecasting"],
        "sample_objectives": [
            "To analyse Ghana's GDP growth trends and their macroeconomic determinants",
            "To examine the relationship between exchange rate and inflation in Ghana",
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
            "food security studies", "fuel price impact analysis",
        ],
        "suggested_methods": ["Time series analysis", "Price elasticity analysis",
                               "Regression", "ARIMA", "Spatial price analysis"],
        "sample_objectives": [
            "To analyse seasonal price fluctuations of staple food commodities in Ghana",
            "To examine the impact of fuel price changes on food commodity prices in Ghana",
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
        "name": "Ghana Stock Exchange (GSE) -- Stock Prices & Indices",
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
            "portfolio analysis", "equity investment research",
        ],
        "suggested_methods": ["Time series analysis", "GARCH models", "Event study",
                               "Portfolio analysis", "Descriptive analytics", "Regression"],
        "sample_objectives": [
            "To analyse stock price volatility on the Ghana Stock Exchange",
            "To examine the performance of banking sector stocks listed on the GSE",
        ],
        "row_count": stock_count + idx_count,
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    }


BUILDERS = {
    "market_prices": _build_market_prices,
    "accommodation": _build_accommodation,
    "property":      _build_property,
    "economic":      _build_economic,
    "commodities":   _build_commodities,
    "financials":    _build_financials,
}


def _load_from_json() -> list:
    if not CACHE_FILE.exists():
        return []
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        age_seconds = time.time() - CACHE_FILE.stat().st_mtime
        if age_seconds > CACHE_TTL:
            return []
        datasets = data.get("datasets", [])
        print(f"[db.py] Loaded {len(datasets)} entries from catalog_cache.json")
        return datasets
    except Exception as e:
        print(f"[db.py] Could not read catalog_cache.json: {e}")
        return []


def _load_from_db() -> list:
    catalog = []
    for db_key, builder in BUILDERS.items():
        url = DB_URLS.get(db_key, "")
        if not url:
            print(f"[db.py] WARNING: No URL configured for {db_key}")
            continue
        try:
            entry = builder(url)
            catalog.append(entry)
            print(f"[db.py] Loaded catalog entry for {db_key} ({entry['row_count']:,} rows)")
        except Exception as e:
            print(f"[db.py] Failed to load {db_key}: {e}")
    return catalog


def load_live_catalog(force_refresh: bool = False) -> list:
    global _catalog_cache, _cache_timestamp
    if not force_refresh and _catalog_cache and (time.time() - _cache_timestamp) < CACHE_TTL:
        return _catalog_cache
    if not force_refresh:
        catalog = _load_from_json()
        if catalog:
            _catalog_cache = catalog
            _cache_timestamp = time.time()
            return catalog
    print("[db.py] Falling back to live Neon DB query...")
    catalog = _load_from_db()
    if catalog:
        _catalog_cache = catalog
        _cache_timestamp = time.time()
    return catalog


def search_live_datasets(query: str, sector: str = None) -> list:
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


# ── Keyword extraction ────────────────────────────────────────────────────────

_FILLER_WORDS = {
    "price", "prices", "cost", "costs", "rate", "rates", "value",
    "buy", "sell", "sale", "for", "in", "at", "on", "of", "the",
    "a", "an", "and", "or", "with", "get", "find", "show", "me",
    "want", "need", "looking", "search", "how", "much", "what",
    "is", "are", "was", "data", "dataset", "information", "info",
    "market", "today", "current", "recent", "latest", "available",
    "cheap", "best", "new", "used", "second", "hand", "ghana",
    "accra", "kumasi", "tamale", "tema",
}


def _extract_keywords(query: str) -> list:
    words = query.lower().replace("?", "").replace("!", "").replace(",", "").split()
    keywords = [w for w in words if w not in _FILLER_WORDS and len(w) >= 2]
    return keywords[:3] if keywords else [query.lower().split()[0]]


def _build_where(columns: list, keywords: list, require_all: bool = True) -> tuple:
    """
    Build SQL WHERE using word-boundary regex (~*) and AND/OR logic.

    require_all=True  (default): ALL keywords must match — precise
      e.g. 'samsung galaxy a24' requires title to contain all three words.
      Samsung TVs (no 'galaxy'/'a24') are excluded automatically.

    require_all=False: ANY keyword can match — broad fallback

    Word boundaries (\y) prevent 'a24' matching 'AR2A24', etc.
    """
    col_clause = " OR ".join(f"{c} ~* %s" for c in columns)
    keyword_clauses = [f"({col_clause})" for _ in keywords]
    joiner = " AND " if require_all else " OR "
    where = joiner.join(keyword_clauses)
    params = []
    for kw in keywords:
        params.extend([f"\\y{kw}\\y"] * len(columns))
    return where, params


def search_market_data(query: str) -> dict:
    keywords = _extract_keywords(query)
    findings = {}

    url = DB_URLS.get("market_prices", "")
    if url:
        try:
            where, params = _build_where(["title", "search_label"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM market_prices WHERE {where}", params) or 0
            kw_starts = " OR ".join(f"LOWER(title) LIKE %s" for _ in keywords)
            start_params = [f"{kw}%" for kw in keywords]
            rows = _query(url, f"""
                SELECT title, price_ghs, location, condition, product_category, collected_date
                FROM market_prices WHERE {where}
                ORDER BY CASE WHEN {kw_starts} THEN 0 ELSE 1 END, price_ghs DESC, collected_date DESC
                LIMIT 5
            """, params + start_params)
            if rows:
                findings["market_prices"] = {"label": "Market Prices", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search market_prices error: {e}")

    url = DB_URLS.get("property", "")
    if url:
        try:
            where, params = _build_where(["title", "location"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM property_prices WHERE {where}", params) or 0
            rows = _query(url, f"""
                SELECT title, price_ghs, location, property_type, listing_type, bedrooms, collected_date
                FROM property_prices WHERE {where} ORDER BY collected_date DESC LIMIT 5
            """, params)
            if rows:
                findings["property"] = {"label": "Property Prices", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search property error: {e}")

    url = DB_URLS.get("commodities", "")
    if url:
        try:
            where, params = _build_where(["commodity_name"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM commodity_prices WHERE {where}", params) or 0
            rows = _query(url, f"""
                SELECT commodity_name, price_ghs, unit, market, region, collected_date
                FROM commodity_prices WHERE {where} ORDER BY collected_date DESC LIMIT 5
            """, params)
            if rows:
                findings["commodities"] = {"label": "Commodity Prices", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search commodities error: {e}")

    url = DB_URLS.get("financials", "")
    if url:
        try:
            where, params = _build_where(["company_name", "symbol"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM stock_prices WHERE {where}", params) or 0
            rows = _query(url, f"""
                SELECT symbol, company_name, closing_price_ghs, change_pct, volume, collected_date
                FROM stock_prices WHERE {where} ORDER BY collected_date DESC LIMIT 5
            """, params)
            if rows:
                findings["financials"] = {"label": "Stock Prices (GSE)", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search financials error: {e}")

    url = DB_URLS.get("accommodation", "")
    if url:
        try:
            where, params = _build_where(["city", "hotel_name"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM hotel_prices WHERE {where}", params) or 0
            rows = _query(url, f"""
                SELECT hotel_name, city, stars, price_per_night_usd, review_score, collected_date
                FROM hotel_prices WHERE {where} ORDER BY collected_date DESC LIMIT 5
            """, params)
            if rows:
                findings["accommodation"] = {"label": "Accommodation Prices", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search accommodation error: {e}")

    url = DB_URLS.get("economic", "")
    if url:
        try:
            where, params = _build_where(["indicator_name"], keywords)
            total = _scalar(url, f"SELECT COUNT(*) FROM economic_indicators WHERE {where}", params) or 0
            rows = _query(url, f"""
                SELECT indicator_name, value, unit, year, month, sector
                FROM economic_indicators WHERE {where}
                ORDER BY year DESC, month DESC NULLS LAST LIMIT 5
            """, params)
            if rows:
                findings["economic"] = {"label": "Economic Indicators", "total": total, "rows": rows}
        except Exception as e:
            print(f"[db.py] search economic error: {e}")

    return findings


# ── Smart search ──────────────────────────────────────────────────────────────

_CATEGORY_MAP = {
    "Mobile Phones":      ["Mobile Phones", "Electronics", "Phones", "Smartphones", "Phone & Tablets"],
    "Electronics":        ["Electronics", "Mobile Phones", "Computers", "Laptops", "TVs"],
    "Vehicles":           ["Vehicles", "Cars", "Trucks", "Motorcycles", "Vehicle Parts", "Buses"],
    "Real Estate":        ["Real Estate", "Property", "Houses", "Land", "Apartments"],
    "Food & Agriculture": ["Food & Agriculture", "Food", "Agriculture", "Foodstuffs"],
    "Fashion":            ["Fashion", "Clothing", "Shoes", "Bags", "Accessories"],
    "Furniture":          ["Furniture", "Home Furniture", "Home & Garden", "Home Appliances"],
}

_PRODUCT_ONLY_CATEGORIES = {"Mobile Phones", "Electronics", "Vehicles", "Furniture"}
_ITEM_TYPE_COL_EXISTS: bool | None = None


def _check_item_type_col(url: str) -> bool:
    global _ITEM_TYPE_COL_EXISTS
    if _ITEM_TYPE_COL_EXISTS is not None:
        return _ITEM_TYPE_COL_EXISTS
    try:
        result = _query(url,
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='market_prices' AND column_name='item_type'")
        _ITEM_TYPE_COL_EXISTS = bool(result)
    except Exception:
        _ITEM_TYPE_COL_EXISTS = False
    return _ITEM_TYPE_COL_EXISTS


def search_market_data_smart(parsed: dict) -> dict:
    """
    Smart search with:
    - AND keyword logic: all keywords must appear in the same listing
    - Word-boundary regex: 'a24' won't match 'AR2A24'
    - item_type='product' filter for product-heavy categories
    - Fallback to OR logic if AND returns no results
    """
    keywords  = [k.lower() for k in parsed.get("keywords", []) if k]
    exclude   = [e.lower() for e in parsed.get("exclude", []) if e]
    min_price = parsed.get("min_price_ghs", 0) or 0
    category  = parsed.get("category", "General")

    if not keywords:
        return {}

    findings = {}
    url = DB_URLS.get("market_prices", "")
    if not url:
        return findings

    try:
        has_item_type = _check_item_type_col(url)
        use_item_type_filter = has_item_type and category in _PRODUCT_ONLY_CATEGORIES

        # Primary: AND logic — all keywords must match
        where, params = _build_where(["title", "search_label", "normalized_name", "brand", "model"], keywords, require_all=True)

        if use_item_type_filter:
            where += " AND item_type = %s"
            params.append("product")

        for ex in exclude[:12]:
            where += " AND LOWER(title) NOT LIKE %s"
            params.append(f"%{ex}%")

        if min_price > 0:
            where += " AND price_ghs >= %s"
            params.append(min_price)

        db_cats = _CATEGORY_MAP.get(category, [])
        if db_cats:
            ph = ",".join(["%s"] * len(db_cats))
            where += f" AND product_category IN ({ph})"
            params.extend(db_cats)

        kw_starts  = " OR ".join(f"LOWER(title) LIKE %s" for _ in keywords)
        ord_params = [f"{kw}%" for kw in keywords]

        total = _scalar(url, f"SELECT COUNT(*) FROM market_prices WHERE {where}", params) or 0
        rows  = _query(url, f"""
            SELECT title, price_ghs, location, condition, product_category, collected_date
            FROM market_prices WHERE {where}
            ORDER BY CASE WHEN {kw_starts} THEN 0 ELSE 1 END, price_ghs DESC, collected_date DESC
            LIMIT 5
        """, params + ord_params)

        if rows:
            findings["market_prices"] = {"label": "Market Prices", "total": total, "rows": rows}
        else:
            # Fallback: OR logic — any keyword can match
            where2, params2 = _build_where(["title", "search_label", "normalized_name", "brand", "model"], keywords, require_all=False)
            for ex in exclude[:12]:
                where2 += " AND LOWER(title) NOT LIKE %s"
                params2.append(f"%{ex}%")
            total2 = _scalar(url, f"SELECT COUNT(*) FROM market_prices WHERE {where2}", params2) or 0
            rows2  = _query(url, f"""
                SELECT title, price_ghs, location, condition, product_category, collected_date
                FROM market_prices WHERE {where2}
                ORDER BY CASE WHEN {kw_starts} THEN 0 ELSE 1 END, price_ghs DESC, collected_date DESC
                LIMIT 5
            """, params2 + ord_params)
            if rows2:
                findings["market_prices"] = {"label": "Market Prices", "total": total2, "rows": rows2}

    except Exception as e:
        print(f"[db.py] smart search error: {e}")

    return findings


def format_search_results(query: str, findings: dict) -> str:
    if not findings:
        return ""
    lines = [f'📊 LIVE DATA PREVIEW -- Results for "{query}" from SG Datalytics databases:\n']
    for db_key, info in findings.items():
        lines.append(f"-- {info['label']} ({info['total']:,} total records) --")
        for r in info["rows"]:
            if db_key == "market_prices":
                price = f"GHS {r['price_ghs']:,.2f}" if r.get('price_ghs') else "N/A"
                lines.append(f"  * {r.get('title','')[:60]} | {price} | {r.get('location','')} | {r.get('condition','')}")
            elif db_key == "property":
                price = f"GHS {r['price_ghs']:,.2f}" if r.get('price_ghs') else "N/A"
                beds = f"{r.get('bedrooms','')} bed" if r.get('bedrooms') else ""
                lines.append(f"  * {r.get('title','')[:50]} | {price} | {r.get('listing_type','')} | {beds} | {r.get('location','')}")
            elif db_key == "commodities":
                price = f"GHS {r['price_ghs']:,.2f}/{r.get('unit','unit')}" if r.get('price_ghs') else "N/A"
                lines.append(f"  * {r.get('commodity_name','')} | {price} | {r.get('market','')} | {r.get('region','')}")
            elif db_key == "financials":
                price = f"GHS {r['closing_price_ghs']}" if r.get('closing_price_ghs') else "N/A"
                chg = f"{r['change_pct']:+.2f}%" if r.get('change_pct') is not None else ""
                lines.append(f"  * {r.get('symbol','')} -- {r.get('company_name','')} | {price} {chg}")
            elif db_key == "accommodation":
                price = f"USD {r['price_per_night_usd']}/night" if r.get('price_per_night_usd') else "N/A"
                lines.append(f"  * {r.get('hotel_name','')[:50]} | {r.get('city','')} | {price}")
            elif db_key == "economic":
                val = f"{r['value']:,.2f} {r.get('unit','')}" if r.get('value') is not None else "N/A"
                period = f"{r.get('year','')} M{r.get('month','')}" if r.get('month') else str(r.get('year',''))
                lines.append(f"  * {r.get('indicator_name','')} | {val} | {period}")
        lines.append("")
    lines.append("Get the full dataset at: https://sgdatalytics.org/marketplace.html")
    return "\n".join(lines)
