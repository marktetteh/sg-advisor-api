"""
refresh_catalog.py — Weekly catalog snapshot builder for SG Data Advisor
Run this script (manually or via scheduler) to rebuild catalog_cache.json
from all 6 Neon databases. The API reads from this file instead of hitting
the DBs on every request.

Usage: python3 refresh_catalog.py
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Ensure we can import db.py from the same directory
sys.path.insert(0, str(Path(__file__).parent))

from db import load_live_catalog

CACHE_FILE = Path(__file__).parent / "catalog_cache.json"

def refresh():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Refreshing SG Advisor catalog...")

    catalog = load_live_catalog(force_refresh=True)

    if not catalog:
        print("✗ No catalog entries loaded — check DB connections. Aborting.")
        sys.exit(1)

    output = {
        "refreshed_at": datetime.utcnow().isoformat() + "Z",
        "total_entries": len(catalog),
        "datasets": catalog,
    }

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"✓ Saved {len(catalog)} dataset entries to {CACHE_FILE}")
    for d in catalog:
        print(f"  [{d['id']}] {d['name']} — {d.get('row_count', '?'):,} rows")
    print(f"\nDone at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    refresh()
