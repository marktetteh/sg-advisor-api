"""
agent.py — SG Data Advisor Agent
Uses Google AI Studio (gemma-4-31b-it) via direct HTTP requests.
Dataset catalog is loaded LIVE from the 6 Neon PostgreSQL databases.
Falls back to the hardcoded datasets.py catalog if the DB is unreachable.
"""

import json
import requests

# Try live DB first, fall back to static catalog
try:
    from db import load_live_catalog, search_live_datasets
    _USE_LIVE_DB = True
except ImportError:
    _USE_LIVE_DB = False

from datasets import DATASETS as FALLBACK_DATASETS

GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GOOGLE_MODEL   = "gemma-4-31b-it"


# ── Build catalog text for the system prompt ──────────────────────────────────

def build_catalog_text() -> str:
    """Build the dataset catalog text, preferring live Neon data."""
    if _USE_LIVE_DB:
        try:
            datasets = load_live_catalog()
            if datasets:
                source_note = "LIVE DATA — pulled directly from SG Datalytics databases"
            else:
                datasets = FALLBACK_DATASETS
                source_note = "STATIC CATALOG — live DB unavailable"
        except Exception as e:
            print(f"[agent.py] DB catalog load failed, using fallback: {e}")
            datasets = FALLBACK_DATASETS
            source_note = "STATIC CATALOG — live DB error"
    else:
        datasets = FALLBACK_DATASETS
        source_note = "STATIC CATALOG"

    lines = [f"[Source: {source_note}]\n"]
    for d in datasets:
        row_info = f" | {d['row_count']:,} records" if d.get("row_count") else ""
        date_info = ""
        if d.get("date_from") and d.get("date_to"):
            date_info = f" | {d['date_from']} → {d['date_to']}"
        lines.append(
            f"[{d['id']}] {d['name']}{row_info}{date_info}\n"
            f"  Sector: {d['sector']}\n"
            f"  Description: {d['description']}\n"
            f"  Key variables: {', '.join(d.get('key_variables', [])[:6])}\n"
            f"  Best for: {', '.join(d.get('best_for', [])[:5])}\n"
            f"  Methods: {', '.join(d.get('suggested_methods', []))}\n"
            f"  Marketplace: {d.get('marketplace_link', 'https://sgdatalytics.org/marketplace.html')}"
        )
    return "\n\n".join(lines)


MAX_FREE_DATASETS = 5


def get_system_prompt() -> str:
    catalog_text = build_catalog_text()
    return f"""
You are SG Data Advisor, an expert AI research and data consultant for SG Datalytics (https://sgdatalytics.org).
SG Datalytics is a Ghana-based data analytics company offering curated Ghana datasets and analytics services.

AVAILABLE GHANA DATASETS (live from SG Datalytics databases):
{catalog_text}

YOUR JOB:
1. Understand the user's research topic, business problem, or data need.
2. Recommend the most relevant dataset(s) from the catalog above — mention the dataset ID in brackets like [neon_economic].
3. Suggest 2-3 appropriate analysis methods (e.g. regression, time series, K-means).
4. Suggest 2-3 sample research objectives they can use.
5. If they need pricing, market, or real-time Ghana data, highlight the live datasets.
6. Always end by directing them to: https://sgdatalytics.org/marketplace.html

DATASET LIMIT RULE (very important):
- You may recommend a maximum of {MAX_FREE_DATASETS} datasets per response.
- If the user's needs would require more than {MAX_FREE_DATASETS} datasets, recommend the top {MAX_FREE_DATASETS} most relevant ones and then say:
  "For access to our full dataset catalog and additional data combinations, visit our marketplace at https://sgdatalytics.org/marketplace.html — our team can also put together a custom data package for your specific needs."
- Never list more than {MAX_FREE_DATASETS} dataset IDs in a single response.

RULES:
- Only recommend datasets from the catalog above.
- Be warm, professional, and concise (under 450 words).
- If the user's need is unclear, ask ONE focused follow-up question.
- Always mention the dataset ID in square brackets when recommending.
- For pricing or market intelligence needs, prefer the live scraped datasets (neon_market_prices, neon_property, neon_commodities).
- For academic or macro research, prefer neon_economic.
- For financial/stock research, use neon_financials.
- For hospitality or tourism research, use neon_accommodation.
"""


# ── Call Google AI Studio ─────────────────────────────────────────────────────

def call_google_api(conversation: list, api_key: str) -> str:
    """Send conversation to Gemma via Google AI Studio and return reply text."""
    url = f"{GOOGLE_API_URL}/{GOOGLE_MODEL}:generateContent?key={api_key}"

    contents = []
    for msg in conversation:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })

    payload = {
        "system_instruction": {
            "parts": [{"text": get_system_prompt()}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 1024,
        }
    }

    response = requests.post(url, json=payload, timeout=60)

    if response.status_code != 200:
        raise Exception(f"{response.status_code} {response.text}")

    data = response.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise Exception(f"Unexpected API response: {json.dumps(data)[:300]}")


# ── Extract dataset IDs mentioned in the reply ────────────────────────────────

def extract_datasets_from_reply(reply: str) -> list:
    """Find any dataset IDs mentioned in the AI reply and return their full metadata."""
    found = []
    seen = set()

    # Check live catalog first
    if _USE_LIVE_DB:
        try:
            catalog = load_live_catalog()
        except Exception:
            catalog = FALLBACK_DATASETS
    else:
        catalog = FALLBACK_DATASETS

    for d in catalog:
        if len(found) >= MAX_FREE_DATASETS:
            break
        tag = f"[{d['id']}]"
        if tag in reply and d["id"] not in seen:
            seen.add(d["id"])
            found.append({
                "id": d["id"],
                "name": d["name"],
                "sector": d["sector"],
                "description": d["description"],
                "suggested_methods": d.get("suggested_methods", []),
                "marketplace_link": d.get("marketplace_link", "https://sgdatalytics.org/marketplace.html"),
                "row_count": d.get("row_count"),
            })
    return found


# ── Main agent function ───────────────────────────────────────────────────────

def run_agent(messages: list, api_key: str) -> dict:
    """
    Call Gemma with the conversation history and return structured result.
    Returns: {"reply": str, "datasets_found": list, "tool_calls": list}
    """
    reply = call_google_api(messages, api_key)
    datasets_found = extract_datasets_from_reply(reply)

    return {
        "reply": reply,
        "datasets_found": datasets_found,
        "tool_calls": [{"tool": "search_live_datasets", "input": {"query": messages[-1]["content"]}}],
    }
