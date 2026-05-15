"""
agent.py — SG Data Advisor Agent (hybrid: Gemini Flash for query parsing + Neon DB for data)
Gemini Flash does ONE job: parse the user's query into structured search params.
The database does everything else — fast, accurate, no hallucination.
"""

import os
import json
import datetime
import requests

# Try live DB first, fall back to static catalog
try:
    from db import load_live_catalog, search_market_data_smart, _extract_keywords
    _USE_LIVE_DB = True
except ImportError:
    _USE_LIVE_DB = False

from datasets import DATASETS as FALLBACK_DATASETS

MAX_FREE_DATASETS = 5
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"

# Maps DB finding keys → dataset catalog IDs
_KEY_TO_DATASET_ID = {
    "market_prices": "neon_market_prices",
    "property":      "neon_property",
    "commodities":   "neon_commodities",
    "economic":      "neon_economic",
    "financials":    "neon_financials",
    "accommodation": "neon_accommodation",
}


# ── Gemini Flash query parser ─────────────────────────────────────────────────

def parse_query(query: str, api_key: str) -> dict:
    """
    Call Gemini Flash with a tiny prompt to extract structured search params.
    Returns: {keywords, exclude, min_price_ghs, category}
    Falls back to basic keyword extraction if AI call fails.
    """
    prompt = f"""You are a search query parser for a Ghana online marketplace database.
Given the user's query, return search parameters as JSON only — no explanation, no markdown.

Query: "{query}"

Return this exact structure:
{{
  "keywords": ["core product terms, max 3"],
  "exclude": ["words that indicate accessories or unrelated items"],
  "min_price_ghs": 0,
  "category": "Mobile Phones|Vehicles|Real Estate|Electronics|Food & Agriculture|Fashion|Furniture|General"
}}

Examples:
- "iphone prices" → {{"keywords":["iphone"],"exclude":["case","cover","cable","charger","screen","protector","holder","pouch","bag","tempered","glass","strap","replacement","motherboard","repair","spare","parts","battery","lcd","screen replacement","housing","back glass","lens","camera replacement"],"min_price_ghs":2000,"category":"Mobile Phones"}}
- "samsung galaxy" → {{"keywords":["samsung","galaxy"],"exclude":["case","cover","cable","charger","screen","tempered","glass","holder","replacement","motherboard","repair","spare","parts","battery","lcd"],"min_price_ghs":1000,"category":"Mobile Phones"}}
- "toyota camry" → {{"keywords":["toyota","camry"],"exclude":["parts","mat","seat cover","oil filter","sticker","rim","tyre","engine","gearbox","spare","repair","body kit","bumper","mirror"],"min_price_ghs":5000,"category":"Vehicles"}}
- "macbook pro" → {{"keywords":["macbook","pro"],"exclude":["case","bag","sleeve","charger","adapter","stand","replacement","screen","repair","keyboard","battery","parts"],"min_price_ghs":2000,"category":"Electronics"}}
- "rice 50kg" → {{"keywords":["rice"],"exclude":["cooker","pot","bag","sack"],"min_price_ghs":0,"category":"Food & Agriculture"}}
- "sofa 3 seater" → {{"keywords":["sofa"],"exclude":["cover","pillow","cushion"],"min_price_ghs":0,"category":"Furniture"}}"""

    try:
        resp = requests.post(
            f"{GEMINI_URL}?key={api_key}",
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200},
            },
            timeout=8,
        )
        if resp.status_code == 200:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            parsed = json.loads(text)
            # Sanitise
            parsed.setdefault("keywords", [])
            parsed.setdefault("exclude", [])
            parsed.setdefault("min_price_ghs", 0)
            parsed.setdefault("category", "General")
            return parsed
    except Exception as e:
        print(f"[agent.py] Gemini query parse failed: {e}")

    # Fallback: basic keyword extraction, no exclusions
    keywords = _extract_keywords(query) if _USE_LIVE_DB else [query.lower().split()[0]]
    return {"keywords": keywords, "exclude": [], "min_price_ghs": 0, "category": "General"}


# ── Template reply generator ──────────────────────────────────────────────────

def _generate_reply(query: str, findings: dict) -> str:
    if not findings:
        return (
            f'We searched our live Ghana market database for **"{query}"** '
            f"but didn't find exact matches.\n\n"
            "Our database covers: **electronics, mobile phones, vehicles, real estate, "
            "food & agriculture, home furniture, fashion,** and **commercial equipment** — "
            "all sourced from Ghana's major online marketplaces.\n\n"
            "Try a shorter or different search term, or visit our marketplace at "
            "[sgdatalytics.org/marketplace.html](https://sgdatalytics.org/marketplace.html) "
            "where our team can build a custom data package for your needs."
        )

    total_records = sum(v.get("total", 0) for v in findings.values())
    lines = [
        f'Found **{total_records:,} records** matching **"{query}"** '
        f"in our live Ghana market database.\n",
    ]
    for info in findings.values():
        lines.append(f"- **{info['label']}**: {info['total']:,} records available")

    lines.append(
        "\nA preview of 5 records is shown below. For the complete dataset "
        "or a custom export, visit "
        "[sgdatalytics.org/marketplace.html](https://sgdatalytics.org/marketplace.html) "
        "— our team can package exactly what you need."
    )
    return "\n".join(lines)


# ── Dataset card builder ──────────────────────────────────────────────────────

def _get_relevant_datasets(findings: dict) -> list:
    catalog = FALLBACK_DATASETS
    if _USE_LIVE_DB:
        try:
            catalog = load_live_catalog() or FALLBACK_DATASETS
        except Exception:
            pass

    found_ids = {_KEY_TO_DATASET_ID[k] for k in findings if k in _KEY_TO_DATASET_ID}
    result = []
    for d in catalog:
        if d["id"] in found_ids and len(result) < MAX_FREE_DATASETS:
            result.append({
                "id":                d["id"],
                "name":              d["name"],
                "sector":            d["sector"],
                "description":       d["description"],
                "suggested_methods": d.get("suggested_methods", []),
                "marketplace_link":  d.get("marketplace_link", "https://sgdatalytics.org/marketplace.html"),
                "row_count":         d.get("row_count"),
            })
    return result


# ── JSON serialisation helper ─────────────────────────────────────────────────

def _serialize_row(row: dict) -> dict:
    result = {}
    for k, v in row.items():
        if isinstance(v, (datetime.date, datetime.datetime)):
            result[k] = v.isoformat()
        elif hasattr(v, "__float__"):
            result[k] = float(v)
        elif v is None:
            result[k] = None
        else:
            result[k] = str(v) if not isinstance(v, (int, float, bool, str)) else v
    return result


# ── Main agent function ───────────────────────────────────────────────────────

def run_agent(messages: list, api_key: str = "") -> dict:
    """
    1. Gemini Flash parses the query into structured params (keywords, exclude, min_price, category)
    2. DB searches using those params — accurate, fast, no hallucination
    3. Returns structured result with live rows for the frontend table
    """
    user_query = messages[-1]["content"]
    actual_key = api_key or os.getenv("GOOGLE_API_KEY", "")
    findings = {}

    if _USE_LIVE_DB:
        # Step 1: AI parses query intent
        parsed = parse_query(user_query, actual_key) if actual_key else {
            "keywords": _extract_keywords(user_query),
            "exclude": [],
            "min_price_ghs": 0,
            "category": "General",
        }
        print(f"[agent.py] Parsed query: {parsed}")

        # Step 2: Smart DB search using parsed params
        try:
            findings = search_market_data_smart(parsed)
        except Exception as e:
            print(f"[agent.py] Smart search failed: {e}")

    reply = _generate_reply(user_query, findings)
    datasets_found = _get_relevant_datasets(findings)

    live_data = {
        k: {
            "label": v["label"],
            "total": v["total"],
            "rows":  [_serialize_row(r) for r in v.get("rows", [])],
        }
        for k, v in findings.items()
    }

    return {
        "reply":          reply,
        "datasets_found": datasets_found,
        "tool_calls":     [{"tool": "search_market_data_smart", "input": {"query": user_query}}],
        "live_data":      live_data,
    }
