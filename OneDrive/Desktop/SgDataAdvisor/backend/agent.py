"""
agent.py — SG Data Advisor Agent (database-driven, no LLM)
All responses are generated from live Neon PostgreSQL data.
No external API calls — instant, reliable, no timeouts.
"""

# Try live DB first, fall back to static catalog
try:
    from db import load_live_catalog, search_market_data
    _USE_LIVE_DB = True
except ImportError:
    _USE_LIVE_DB = False

from datasets import DATASETS as FALLBACK_DATASETS

MAX_FREE_DATASETS = 5

# Maps DB finding keys → dataset catalog IDs
_KEY_TO_DATASET_ID = {
    "market_prices": "neon_market_prices",
    "property":      "neon_property",
    "commodities":   "neon_commodities",
    "economic":      "neon_economic",
    "financials":    "neon_financials",
    "accommodation": "neon_accommodation",
}


# ── Template reply generator ──────────────────────────────────────────────────

def _generate_reply(query: str, findings: dict) -> str:
    """Build a professional response purely from database search results."""

    if not findings:
        return (
            f'We searched our live Ghana market database for **"{query}"** '
            f"but didn't find exact matches.\n\n"
            "Our database covers: **electronics, mobile phones, vehicles, real estate, "
            "food & agriculture, home furniture, fashion,** and **commercial equipment** — "
            "all sourced from Ghana's major online marketplaces.\n\n"
            "Try a shorter search term (e.g. just *\"iPhone\"* or *\"Toyota\"*), or visit our marketplace at "
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
    """Return dataset metadata cards for whatever DBs returned results."""
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


# ── Main agent function ───────────────────────────────────────────────────────

def run_agent(messages: list, api_key: str = "") -> dict:
    """
    Search live databases and return structured result.
    No LLM involved — instant template responses from DB results.
    Returns: {"reply": str, "datasets_found": list, "tool_calls": list, "live_data": dict}
    """
    user_query = messages[-1]["content"]
    findings = {}

    if _USE_LIVE_DB:
        try:
            findings = search_market_data(user_query)
        except Exception as e:
            print(f"[agent.py] Live data search failed: {e}")

    reply = _generate_reply(user_query, findings)
    datasets_found = _get_relevant_datasets(findings)

    # Include rows in live_data so the frontend can render the preview table
    live_data = {
        k: {
            "label": v["label"],
            "total": v["total"],
            "rows":  v.get("rows", []),
        }
        for k, v in findings.items()
    }

    return {
        "reply":          reply,
        "datasets_found": datasets_found,
        "tool_calls":     [{"tool": "search_market_data", "input": {"query": user_query}}],
        "live_data":      live_data,
    }
