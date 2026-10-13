"""
SG Datalytics — Agentic Data Quality Orchestrator
Uses Claude Haiku to autonomously assess, verify, and correct market price data
after each collection run.

Claude decides:
  - Whether today's collection is healthy
  - Whether to run price verification on flagged rows
  - Whether suggestions are trustworthy enough to apply
  - On Mondays: review collection performance and update product config (Phase 1)
  - What anomalies to flag for Mark's attention

Run: python orchestrator.py
Run after collection: python orchestrator.py --auto (non-interactive, for scheduler)
"""
import os
import re
import sys
import json
import urllib.request
import subprocess
import psycopg2
import anthropic
from datetime import date, datetime
from collections import defaultdict, Counter
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("server/.env"))

# ── Config ────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
NEON_CONN         = os.getenv("NEON_MARKET_PRICES")
MODEL             = "claude-haiku-4-5-20251001"
TODAY             = date.today().isoformat()
TODAY_DOW         = datetime.today().strftime("%A")  # "Monday", "Wednesday", etc.
IS_FIRST_MONDAY   = (TODAY_DOW == "Monday" and date.today().day <= 7)  # first Mon of month
AUTO_MODE         = "--auto" in sys.argv  # non-interactive for scheduler
CONFIG_JS_PATH        = Path("server/collectors/config.js")
JIJI_JS_PATH          = Path("server/collectors/jiji.js")
SELECTOR_FAILURE_FILE = Path("selector_failure.json")

log = lambda msg, sym="→": print(f"  [{sym}] {msg}")

# ── DB helper ─────────────────────────────────────────────────
def db_query(sql, params=None):
    conn = psycopg2.connect(NEON_CONN, sslmode="require")
    cur  = conn.cursor()
    cur.execute(sql, params or [])
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    conn.close()
    return rows

def db_execute(sql, params=None):
    conn = psycopg2.connect(NEON_CONN, sslmode="require")
    conn.autocommit = False
    cur  = conn.cursor()
    cur.execute(sql, params or [])
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected

# ── Tool implementations ──────────────────────────────────────
def get_collection_summary():
    """Today's collection stats from collection_log and direct DB count."""
    # From collection_log
    log_rows = db_query("""
        SELECT source, product_category, rows_collected, rows_inserted,
               rows_enriched, flagged_rows, avg_quality_score, notes
        FROM collection_log
        WHERE collected_date = %s
        ORDER BY source, product_category
    """, [TODAY])

    # Direct from market_prices — quality metrics on priced rows only
    stats = db_query("""
        SELECT
            COUNT(*)                                             AS total_rows,
            COUNT(*) FILTER (WHERE price_ghs > 0)              AS priced_rows,
            COUNT(*) FILTER (WHERE price_ghs IS NULL
                              OR price_ghs = 0)                 AS call_for_price,
            COUNT(DISTINCT product_category)                     AS categories,
            COUNT(*) FILTER (WHERE is_flagged = TRUE
                              AND price_ghs > 0)                AS flagged,
            ROUND(AVG(quality_score)
                  FILTER (WHERE price_ghs > 0)::numeric, 1)    AS avg_quality
        FROM market_prices
        WHERE collected_date = %s AND year = 2026
    """, [TODAY])

    return {
        "date": TODAY,
        "collection_log": log_rows,
        "todays_db_stats": stats[0] if stats else {},
    }

def get_flagged_rows_by_category():
    """Breakdown of flagged rows needing price verification.
    Excludes zero/null price rows (call-for-price listings) since Gemini cannot fix missing prices."""
    rows = db_query("""
        SELECT product_category,
               COUNT(*) AS flagged,
               COUNT(*) FILTER (WHERE price_verified_by IS NULL) AS unverified,
               ROUND(AVG(price_ghs)::numeric, 2) AS avg_price
        FROM market_prices
        WHERE is_flagged = TRUE AND year = 2026
          AND price_ghs > 0
          AND (price_verified_by IS NULL
               OR price_verified_by NOT IN ('gemini','openai','rules'))
        GROUP BY product_category
        ORDER BY flagged DESC
    """)
    return {"flagged_by_category": rows, "total_unverified_flagged": sum(r["unverified"] for r in rows)}

def run_price_verification(limit=200, category=None):
    """Run Gemini price verification on flagged rows."""
    # price_verify.py supports: (no args), --all, --week N, --dry-run
    # It automatically targets flagged rows with missing verification
    cmd = [sys.executable, "price_verify.py", "--time-budget", "1500"]
    if category:
        # category filter not supported natively — run full and filter in DB
        pass
    log(f"Running price verification: {' '.join(cmd)}", "🤖")
    # encoding/errors set explicitly: on Windows text=True decodes with cp1252,
    # and emoji in price_verify.py output crashed the reader thread (30 Sep 2026 run).
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                            errors="replace", timeout=1800, env=env)
    return {
        "exit_code": result.returncode,
        "stdout_tail": result.stdout[-2000:] if result.stdout else "",
        "stderr_tail": result.stderr[-500:]  if result.stderr else "",
    }

def get_verification_results():
    """Check how many rows have suggestions ready to apply."""
    rows = db_query("""
        SELECT product_category,
               COUNT(*) AS ready_to_apply,
               ROUND(AVG(suggested_price_ghs)::numeric, 2)  AS avg_suggested,
               ROUND(AVG(price_ghs)::numeric, 2)            AS avg_current,
               ROUND(AVG(ABS(suggested_price_ghs - price_ghs)
                     / NULLIF(price_ghs, 0) * 100)::numeric, 1) AS avg_pct_change
        FROM market_prices
        WHERE is_flagged = TRUE
          AND suggested_price_ghs IS NOT NULL
          AND price_verified_by IN ('gemini','openai','rules')
          AND year = 2026
        GROUP BY product_category
        ORDER BY ready_to_apply DESC
    """)
    return {
        "suggestions_by_category": rows,
        "total_ready": sum(r["ready_to_apply"] for r in rows),
    }

def apply_price_corrections(category=None):
    """Apply verified price suggestions to the database."""
    where = "is_flagged = TRUE AND suggested_price_ghs IS NOT NULL AND year = 2026"
    params = []
    if category:
        where += " AND product_category = %s"
        params.append(category)

    affected = db_execute(f"""
        UPDATE market_prices
        SET price_ghs = suggested_price_ghs,
            is_flagged = FALSE,
            quality_score = 70
        WHERE {where}
    """, params)

    return {"rows_corrected": affected, "category": category or "all"}

def get_quality_report():
    """Overall data quality metrics for today — excludes zero/null price rows from averages."""
    today_stats = db_query("""
        SELECT
            ROUND(AVG(quality_score)::numeric, 1)                          AS avg_quality,
            COUNT(*) FILTER (WHERE quality_score >= 80)                    AS high_quality,
            COUNT(*) FILTER (WHERE quality_score BETWEEN 50 AND 79)        AS medium_quality,
            COUNT(*) FILTER (WHERE quality_score < 50)                     AS low_quality,
            COUNT(*) FILTER (WHERE brand IS NULL OR brand = '')            AS missing_brand,
            COUNT(*) FILTER (WHERE condition IS NULL)                      AS missing_condition,
            COUNT(*)                                                        AS total,
            COUNT(*) FILTER (WHERE price_ghs IS NULL OR price_ghs = 0)    AS call_for_price_excluded
        FROM market_prices
        WHERE collected_date = %s AND year = 2026
          AND price_ghs > 0
    """, [TODAY])
    return {"todays_quality": today_stats[0] if today_stats else {}}


def review_collection_performance():
    """
    Phase 1 — Smart product config review.
    Checks per-product-group row counts over the last 3 collection dates to identify:
      - Dead groups (0 rows on 2+ of 3 dates)
      - Weak groups (avg < 5 rows per collection)
      - Strong groups (for context)
    Also samples recent listing titles for potential new product terms to track.
    Run this on Mondays to decide if config.js needs updating.
    """
    # Last 3 collection dates (any date with priced rows)
    dates_rows = db_query("""
        SELECT DISTINCT collected_date
        FROM market_prices
        WHERE price_ghs > 0
        ORDER BY collected_date DESC
        LIMIT 3
    """)
    if not dates_rows:
        return {"error": "No priced data found in market_prices"}

    last_dates = [str(r["collected_date"]) for r in dates_rows]
    placeholders = ",".join(["%s"] * len(last_dates))

    # Per-group row counts per date
    perf_rows = db_query(f"""
        SELECT product_group, product_category, collected_date, COUNT(*) AS row_count
        FROM market_prices
        WHERE collected_date IN ({placeholders})
          AND price_ghs > 0
        GROUP BY product_group, product_category, collected_date
    """, last_dates)

    # Aggregate into per-group summary
    groups = defaultdict(lambda: {"category": "", "per_date": {}})
    for r in perf_rows:
        g = r["product_group"] or "Unknown"
        groups[g]["category"] = r["product_category"] or ""
        groups[g]["per_date"][str(r["collected_date"])] = r["row_count"]

    dead   = []   # 0 rows on ALL checked dates
    weak   = []   # avg < 5 rows or missing on 2+ dates
    strong = []   # performing well

    for group_name, info in sorted(groups.items()):
        counts = [info["per_date"].get(d, 0) for d in last_dates]
        avg    = sum(counts) / len(counts)
        zeros  = sum(1 for c in counts if c == 0)
        entry  = {
            "product_group":    group_name,
            "category":         info["category"],
            "counts_per_date":  dict(zip(last_dates, counts)),
            "avg_per_run":      round(avg, 1),
            "zero_run_count":   zeros,
        }
        if zeros == len(last_dates):
            dead.append(entry)
        elif avg < 5 or zeros >= 2:
            weak.append(entry)
        else:
            strong.append(entry)

    # Sample frequently appearing title words on recent dates to spot untracked products
    title_sample = db_query(f"""
        SELECT title
        FROM market_prices
        WHERE collected_date IN ({placeholders})
          AND price_ghs > 0
          AND product_category = 'Electronics'
        ORDER BY RANDOM()
        LIMIT 200
    """, last_dates)
    # Extract candidate model terms (2–3 consecutive word groups containing digits or known brands)
    brand_hints = defaultdict(int)
    brand_pattern = re.compile(
        r'\b(iphone|samsung|huawei|tecno|infinix|itel|xiaomi|oppo|oneplus|nokia|realme|vivo|'
        r'hp|dell|lenovo|macbook|asus|acer|lg|hisense|sony|tcl|skyworth|syinix|nasco|'
        r'ps5|ps4|xbox|airpod|ipad|pixel|motorola)\s*\w*', re.IGNORECASE
    )
    for row in title_sample:
        for m in brand_pattern.findall(row.get("title", "") or ""):
            key = m.strip().lower()
            if len(key) > 4:
                brand_hints[key] += 1
    top_terms = sorted(brand_hints.items(), key=lambda x: -x[1])[:20]

    return {
        "collection_dates_checked": last_dates,
        "dead_groups_zero_on_all_dates": dead,
        "weak_groups_low_coverage":  weak,
        "strong_groups_count":       len(strong),
        "top_strong_groups":         strong[:10],
        "trending_title_terms":      [{"term": t, "count": c} for t, c in top_terms],
        "summary": (
            f"Checked {len(last_dates)} collection dates. "
            f"{len(dead)} groups returned zero rows on all dates. "
            f"{len(weak)} groups returned fewer than 5 rows on average. "
            f"{len(strong)} groups are performing well."
        ),
    }


def update_product_config(remove_labels=None, add_queries=None):
    """
    Phase 1 — Update config.js MARKET_PRODUCTS array.

    remove_labels: list of label strings to remove (e.g. ["Oppo Reno 10", "Nintendo Switch"])
    add_queries:   list of product dicts to add, each with keys:
                   query, label, category, group, jijiPath

    Makes a backup of config.js before modifying.
    Returns a summary of changes made.
    """
    remove_labels = remove_labels or []
    add_queries   = add_queries   or []

    if not remove_labels and not add_queries:
        return {"error": "Nothing to do — provide remove_labels and/or add_queries"}

    if not CONFIG_JS_PATH.exists():
        return {"error": f"config.js not found at {CONFIG_JS_PATH}"}

    original = CONFIG_JS_PATH.read_text(encoding="utf-8")

    # ── Backup ────────────────────────────────────────────────
    backup_path = CONFIG_JS_PATH.with_suffix(f".{TODAY}.bak.js")
    backup_path.write_text(original, encoding="utf-8")

    lines = original.split("\n")
    removed_count = 0

    # ── Remove entries by label ───────────────────────────────
    if remove_labels:
        kept = []
        for line in lines:
            should_remove = False
            for lbl in remove_labels:
                # Match: label: 'Exact Label' or label: "Exact Label"
                if re.search(rf"label:\s*['\"]" + re.escape(lbl) + r"['\"]", line):
                    should_remove = True
                    removed_count += 1
                    log(f"Removing query for label: {lbl}", "🗑")
                    break
            if not should_remove:
                kept.append(line)
        lines = kept

    # ── Add new entries before closing ]; of MARKET_PRODUCTS ──
    added_count = 0
    if add_queries:
        new_lines = []
        in_market_products = False
        inserted = False

        for line in lines:
            if "const MARKET_PRODUCTS" in line:
                in_market_products = True

            # Find the closing ]; of MARKET_PRODUCTS (first occurrence after the array starts)
            if in_market_products and not inserted and re.match(r"^];", line.strip()):
                # Insert a comment block + new entries just before this line
                new_lines.append("")
                new_lines.append("  // ═══════════════════════════════════════════════════════════")
                new_lines.append(f"  // AUTO-ADDED by orchestrator on {TODAY}")
                new_lines.append("  // ═══════════════════════════════════════════════════════════")
                for q in add_queries:
                    entry = (
                        f"  {{ query: {json.dumps(q['query']):<38} "
                        f"label: {json.dumps(q['label']):<38} "
                        f"category: {json.dumps(q['category']):<25} "
                        f"group: {json.dumps(q['group']):<30} "
                        f"jijiPath: {json.dumps(q['jijiPath'])} }},"
                    )
                    new_lines.append(entry)
                    log(f"Adding query: {q['query']} → {q['label']}", "➕")
                    added_count += 1
                new_lines.append("")
                inserted = True
                in_market_products = False  # done

            new_lines.append(line)

        lines = new_lines

    # ── Write updated file ────────────────────────────────────
    CONFIG_JS_PATH.write_text("\n".join(lines), encoding="utf-8")

    return {
        "status":         "success",
        "removed_count":  removed_count,
        "added_count":    added_count,
        "labels_removed": remove_labels,
        "queries_added":  [q["label"] for q in add_queries],
        "backup_created": str(backup_path),
        "message":        (
            f"config.js updated: {removed_count} entries removed, "
            f"{added_count} entries added. Backup saved as {backup_path.name}."
        ),
    }

# ── Phase 2 — Self-healing scraper tools ──────────────────────

def check_selector_health():
    """
    Phase 2 — Check whether jiji.js wrote a selector failure signal during the last run.
    Returns the full signal (failed URL, selector used, top CSS classes, qa- test IDs,
    and a body HTML snippet) if a failure was detected, or a healthy status if not.
    """
    if not SELECTOR_FAILURE_FILE.exists():
        return {
            "status":  "healthy",
            "message": "No selector failure signal found — jiji.js selectors are working correctly.",
        }
    try:
        signal = json.loads(SELECTOR_FAILURE_FILE.read_text(encoding="utf-8"))
        return {"status": "failed", **signal}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def fetch_page_html(url):
    """
    Phase 2 — Fetch a live Jiji page and extract structural information to help
    Claude identify the current listing card selector.

    Returns:
      - top_css_classes: CSS class names appearing 5+ times (likely repeated card elements)
      - qa_test_ids: Jiji qa- prefixed test IDs (stable semantic hooks)
      - body_snippet: first 5000 chars of the page body for visual inspection
      - candidate_selectors: classes that appear in a pattern suggesting list items
    """
    headers = {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GH,en-GB;q=0.9,en;q=0.8",
        "Cache-Control":   "no-cache",
    }
    try:
        req  = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=30)
        html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return {"error": f"Could not fetch {url}: {e}"}

    # Extract CSS classes and count occurrences
    class_matches = re.findall(r'class="([^"]+)"', html)
    class_counts  = Counter()
    for cls_str in class_matches:
        for cls in cls_str.split():
            if cls:
                class_counts[cls] += 1

    top_classes = [
        {"class": cls, "count": n}
        for cls, n in class_counts.most_common(40)
        if n >= 5
    ]

    # qa- test IDs (Jiji uses these as stable semantic hooks — best selector candidates)
    qa_ids = list(dict.fromkeys(re.findall(r'qa-[\w-]+', html)))[:25]

    # Body snippet for visual inspection
    body_match   = re.search(r'<body[^>]*>([\s\S]*?)</body>', html, re.IGNORECASE)
    body_snippet = body_match.group(1)[:5000] if body_match else html[:5000]

    # Heuristic: classes that appear exactly N times where N matches number of visible cards
    # (listing pages typically show 24 cards — look for classes with count near 24)
    candidate_selectors = [
        {"class": f".{c['class']}", "count": c["count"], "note": "appears ~24x — likely listing card"}
        for c in top_classes
        if 18 <= c["count"] <= 30
    ]

    return {
        "url":                 url,
        "page_size_bytes":     len(html),
        "top_css_classes":     top_classes[:25],
        "qa_test_ids":         qa_ids,
        "candidate_selectors": candidate_selectors,
        "body_snippet":        body_snippet,
        "note": (
            "Look for the qa- test ID or CSS class that wraps each individual listing card. "
            "The current broken selector is in the signal from check_selector_health(). "
            "Candidates appearing ~24 times are the most likely new listing card selector."
        ),
    }


def scan_unclassified_listings(days=30):
    """
    Phase 3 — Trend detection.
    Finds listing titles where product_group is NULL or empty over the last N days.
    Extracts the most frequent single words and bigrams (2-word phrases) from those
    titles so Claude can identify emerging product clusters worth adding as new categories.

    Returns:
      - unclassified_by_category: counts per category
      - top_unigrams: most frequent single words (product-relevant terms)
      - top_bigrams: most frequent 2-word phrases (e.g. "solar generator", "e bike")
      - sample_titles: 40 raw unclassified titles for Claude to read directly
      - existing_categories: current JIJI_CATEGORIES labels for context (so Claude
        doesn't propose something already covered)
    """
    STOP_WORDS = {
        'for', 'sale', 'in', 'the', 'a', 'and', 'or', 'new', 'used', 'ghana',
        'accra', 'price', 'best', 'good', 'quality', 'brand', 'with', 'of',
        'by', 'at', 'to', 'from', 'on', 'is', 'are', 'was', 'be', 'this',
        'we', 'our', 'your', 'my', 'all', 'only', 'just', 'get', 'call',
        'buy', 'sell', 'kumasi', 'tema', 'takoradi', 'ghana', 'available',
        'contact', 'delivery', 'original', 'genuine', 'sealed', 'box',
    }

    # Unclassified counts per category
    cat_stats = db_query("""
        SELECT product_category,
               COUNT(*) FILTER (WHERE product_group IS NULL OR product_group = '') AS unclassified,
               COUNT(*)                                                              AS total
        FROM market_prices
        WHERE collected_date >= CURRENT_DATE - (%s || ' days')::INTERVAL
          AND price_ghs > 0
        GROUP BY product_category
        ORDER BY unclassified DESC
    """, [str(days)])

    # Pull up to 2000 unclassified titles for text analysis
    title_rows = db_query("""
        SELECT title, product_category
        FROM market_prices
        WHERE collected_date >= CURRENT_DATE - (%s || ' days')::INTERVAL
          AND price_ghs > 0
          AND (product_group IS NULL OR product_group = '')
          AND title IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 2000
    """, [str(days)])

    # Word and bigram frequency analysis
    unigrams = Counter()
    bigrams  = Counter()

    for row in title_rows:
        title = row.get("title", "") or ""
        # Clean: lowercase, remove punctuation, split
        words = re.sub(r"[^a-zA-Z0-9\s]", " ", title.lower()).split()
        words = [w for w in words if len(w) > 2 and w not in STOP_WORDS]

        for w in words:
            unigrams[w] += 1
        for i in range(len(words) - 1):
            bigrams[f"{words[i]} {words[i+1]}"] += 1

    # Sample raw titles (variety across categories)
    sample_titles = [r["title"] for r in title_rows[:40]]

    # Current JIJI_CATEGORIES for context — read from config.js
    existing_labels = []
    try:
        cfg_text = CONFIG_JS_PATH.read_text(encoding="utf-8")
        existing_labels = re.findall(r"label:\s*'([^']+)'", cfg_text)
    except Exception:
        pass

    return {
        "days_scanned":            days,
        "total_titles_analysed":   len(title_rows),
        "unclassified_by_category": cat_stats,
        "top_unigrams":            [{"term": t, "count": c} for t, c in unigrams.most_common(40)],
        "top_bigrams":             [{"phrase": p, "count": c} for p, c in bigrams.most_common(40)],
        "sample_titles":           sample_titles,
        "existing_jiji_categories": existing_labels,
        "guidance": (
            "Look for bigrams or unigrams that: (1) appear 20+ times, "
            "(2) represent a clear product type NOT covered by existing_jiji_categories, "
            "(3) suggest genuine market activity (not noise or spam). "
            "Cluster related terms — e.g. 'solar generator' + 'generator diesel' + 'generator petrol' "
            "→ propose one 'Generators & Power' category. "
            "Only propose a category if the evidence is strong (50+ title appearances). "
            "If nothing new is evident, report that the existing categories are sufficient."
        ),
    }


def add_trend_category(label, category, jijiPath, query, tonatonQuery, reason=""):
    """
    Phase 3 — Add a new entry to JIJI_CATEGORIES in config.js.

    This is distinct from update_product_config (which targets MARKET_PRODUCTS).
    JIJI_CATEGORIES is the broad-category array used by jiji.js and tonaton.js.
    Creates a dated backup of config.js before writing.

    Args:
        label        : Human-readable name, e.g. "Generators & Power"
        category     : product_category DB value, e.g. "Electronics"
        jijiPath     : Jiji browse path or '/search' if no dedicated path
        query        : Jiji search keyword(s) — empty string for category browse
        tonatonQuery : Tonaton API search term(s)
        reason       : Why this category is being added (logged to backup header)
    """
    cfg_text = CONFIG_JS_PATH.read_text(encoding="utf-8")

    # Check for duplicates — don't add if label already exists
    existing = re.findall(r"label:\s*'([^']+)'", cfg_text)
    if label in existing:
        return {"status": "skipped", "reason": f"Label '{label}' already exists in JIJI_CATEGORIES"}

    # Create dated backup
    backup_path = CONFIG_JS_PATH.with_suffix(f".backup_{date.today().isoformat()}.js")
    backup_path.write_text(cfg_text, encoding="utf-8")

    # Build the new entry string (2-space indent to match existing style)
    new_entry = (
        f"  {{ label: '{label}', category: '{category}', "
        f"jijiPath: '{jijiPath}', query: '{query}', "
        f"tonatonQuery: '{tonatonQuery}' }},"
    )

    # Insert just before the closing ]; of JIJI_CATEGORIES
    # Pattern: find the last entry and append after it, before the ];
    # We locate the ]; that closes JIJI_CATEGORIES (it appears after the last entry)
    # Strategy: find the last },' or '}' line before the first '];' after JIJI_CATEGORIES declaration
    pattern = r"(const JIJI_CATEGORIES\s*=\s*\[[\s\S]*?)(];)"
    match   = re.search(pattern, cfg_text)
    if not match:
        return {"status": "error", "reason": "Could not locate JIJI_CATEGORIES array in config.js"}

    new_cfg = cfg_text[:match.start(2)] + new_entry + "\n" + cfg_text[match.start(2):]
    CONFIG_JS_PATH.write_text(new_cfg, encoding="utf-8")

    return {
        "status":  "added",
        "label":   label,
        "reason":  reason,
        "backup":  str(backup_path),
        "message": f"Added '{label}' to JIJI_CATEGORIES. Next collection run will include this category.",
    }


def update_scraper_selector(old_selector, new_selector):
    """
    Phase 2 — Patch jiji.js by replacing the broken CSS selector with the new one.
    Creates a dated backup of jiji.js before modifying.
    Also clears the selector_failure.json signal file.
    """
    if not JIJI_JS_PATH.exists():
        return {"error": f"jiji.js not found at {JIJI_JS_PATH}"}
    if not old_selector or not new_selector:
        return {"error": "Both old_selector and new_selector are required"}
    if old_selector == new_selector:
        return {"error": "old_selector and new_selector are identical — no change needed"}

    original = JIJI_JS_PATH.read_text(encoding="utf-8")

    if old_selector not in original:
        return {
            "error":        f"Selector '{old_selector}' not found in jiji.js",
            "hint":         "Check check_selector_health() output for the selector_used field",
            "jiji_selectors_found": re.findall(r"const \w+\s*=\s*'([^']+)'", original)[:10],
        }

    count = original.count(old_selector)

    # Backup before modifying
    backup_path = JIJI_JS_PATH.with_suffix(f".{TODAY}.selector-bak.js")
    backup_path.write_text(original, encoding="utf-8")

    # Replace all occurrences
    updated = original.replace(old_selector, new_selector)
    JIJI_JS_PATH.write_text(updated, encoding="utf-8")

    # Clear the failure signal so it doesn't re-trigger next run
    if SELECTOR_FAILURE_FILE.exists():
        SELECTOR_FAILURE_FILE.unlink()
        log("Selector failure signal cleared", "🧹")

    return {
        "status":              "success",
        "old_selector":        old_selector,
        "new_selector":        new_selector,
        "occurrences_patched": count,
        "backup":              str(backup_path),
        "message": (
            f"jiji.js patched: replaced '{old_selector}' → '{new_selector}' "
            f"in {count} place(s). Backup saved. Failure signal cleared. "
            f"The next collection run will use the new selector automatically."
        ),
    }


# ── Tool registry ─────────────────────────────────────────────
TOOL_HANDLERS = {
    "get_collection_summary":       lambda inp: get_collection_summary(),
    "get_flagged_rows_by_category": lambda inp: get_flagged_rows_by_category(),
    "run_price_verification":       lambda inp: run_price_verification(
                                        limit=inp.get("limit", 200),
                                        category=inp.get("category")),
    "get_verification_results":     lambda inp: get_verification_results(),
    "apply_price_corrections":      lambda inp: apply_price_corrections(
                                        category=inp.get("category")),
    "get_quality_report":           lambda inp: get_quality_report(),
    # Phase 1 — Smart product config
    "review_collection_performance": lambda inp: review_collection_performance(),
    "update_product_config":         lambda inp: update_product_config(
                                        remove_labels=inp.get("remove_labels", []),
                                        add_queries=inp.get("add_queries", [])),
    # Phase 2 — Self-healing scraper
    "check_selector_health":   lambda inp: check_selector_health(),
    "fetch_page_html":         lambda inp: fetch_page_html(inp.get("url", "")),
    "update_scraper_selector": lambda inp: update_scraper_selector(
                                   old_selector=inp.get("old_selector", ""),
                                   new_selector=inp.get("new_selector", "")),
    # Phase 3 — Trend detection
    "scan_unclassified_listings": lambda inp: scan_unclassified_listings(
                                      days=inp.get("days", 30)),
    "add_trend_category":         lambda inp: add_trend_category(
                                      label=inp.get("label", ""),
                                      category=inp.get("category", ""),
                                      jijiPath=inp.get("jijiPath", "/search"),
                                      query=inp.get("query", ""),
                                      tonatonQuery=inp.get("tonatonQuery", ""),
                                      reason=inp.get("reason", "")),
}

TOOLS = [
    {
        "name": "get_collection_summary",
        "description": "Get today's collection stats — how many rows were collected, inserted, enriched, flagged, and the average quality score.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_flagged_rows_by_category",
        "description": "Get a breakdown of flagged rows that need price verification, grouped by product category.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "run_price_verification",
        "description": "Run Gemini price verification on flagged rows. Use limit to control how many rows to process.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit":    {"type": "integer", "description": "Max rows to verify (default 200)"},
                "category": {"type": "string",  "description": "Optional: restrict to one product category"},
            },
            "required": [],
        },
    },
    {
        "name": "get_verification_results",
        "description": "Check how many rows have Gemini price suggestions ready to apply, with average price change percentage.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "apply_price_corrections",
        "description": "Apply verified price suggestions to the database. Only call this when you are confident the suggestions are trustworthy (average price change < 80% and verification ran successfully).",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Optional: restrict to one category"},
            },
            "required": [],
        },
    },
    {
        "name": "get_quality_report",
        "description": "Get quality score distribution for today's collected data.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    # ── Phase 1 — Smart product config ─────────────────────────
    {
        "name": "review_collection_performance",
        "description": (
            "Phase 1 tool. Check how many rows each product group collected over the last 3 "
            "collection dates. Identifies dead groups (zero rows on all dates), weak groups "
            "(avg < 5 rows), and strong groups. Also surfaces trending listing title terms "
            "that might indicate new products worth adding to config.js. "
            "Run this on Mondays as part of the weekly config review."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    # ── Phase 2 — Self-healing scraper ─────────────────────────
    {
        "name": "check_selector_health",
        "description": (
            "Phase 2 tool. Check whether jiji.js detected a CSS selector failure during the last "
            "collection run. If Jiji updated their HTML and the listing card selector no longer "
            "matches, jiji.js writes a signal file with the failed URL, broken selector, top CSS "
            "classes, and an HTML snippet. This tool reads that signal. "
            "Always call this as part of every post-collection check."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "fetch_page_html",
        "description": (
            "Phase 2 tool. Fetch a live Jiji page and return its CSS class frequency analysis, "
            "qa- test IDs, candidate selectors (classes appearing ~24 times match listing cards), "
            "and a body HTML snippet. Use the failed_url from check_selector_health() as the URL. "
            "Call this to identify what the new listing card selector should be."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The Jiji URL that failed — from check_selector_health() failed_url field"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "update_scraper_selector",
        "description": (
            "Phase 2 tool. Patch jiji.js by replacing the broken CSS selector with the correct new one. "
            "Creates a dated backup first. Also clears the failure signal so it doesn't re-trigger. "
            "Only call this when you are confident in the new selector based on fetch_page_html() output. "
            "The old_selector must exactly match what is in jiji.js (check check_selector_health() selector_used field). "
            "After patching, tell Mark what changed and that the next collection run will use the new selector."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "old_selector": {"type": "string", "description": "The broken selector currently in jiji.js (e.g. '.qa-advert-list-item')"},
                "new_selector": {"type": "string", "description": "The new working selector identified from fetch_page_html() output"},
            },
            "required": ["old_selector", "new_selector"],
        },
    },
    # ── Phase 3 — Trend detection ──────────────────────────────
    {
        "name": "scan_unclassified_listings",
        "description": (
            "Phase 3 tool. Scans listing titles in market_prices where product_group is NULL "
            "over the last N days. Extracts the most frequent single words and 2-word phrases "
            "(bigrams) from those titles so you can identify emerging product types not covered "
            "by any existing JIJI_CATEGORIES entry. "
            "Returns: unclassified_by_category counts, top_unigrams, top_bigrams, sample_titles, "
            "and existing_jiji_categories for reference. "
            "Run this on the first Monday of each month as the monthly trend check."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "How many days back to scan (default 30)"},
            },
            "required": [],
        },
    },
    {
        "name": "add_trend_category",
        "description": (
            "Phase 3 tool. Add a new entry to JIJI_CATEGORIES in config.js so the next "
            "collection run picks it up. Creates a dated backup before writing. "
            "Only call this when scan_unclassified_listings() shows clear evidence of 50+ "
            "listings mentioning an untracked product type — cluster related bigrams/unigrams "
            "into a single coherent category before calling. "
            "One call per new category. Do not add categories already in existing_jiji_categories."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "label":        {"type": "string", "description": "Human-readable name, e.g. 'Generators & Power'"},
                "category":     {"type": "string", "description": "product_category DB value, e.g. 'Electronics'"},
                "jijiPath":     {"type": "string", "description": "Jiji browse path, e.g. '/search' or '/generators'"},
                "query":        {"type": "string", "description": "Jiji keyword(s) — empty string for category browse, otherwise space-separated terms"},
                "tonatonQuery": {"type": "string", "description": "Tonaton API search term(s)"},
                "reason":       {"type": "string", "description": "Brief justification based on scan evidence, e.g. '73 unclassified listings mentioning generator'"},
            },
            "required": ["label", "category", "jijiPath", "query", "tonatonQuery"],
        },
    },
    {
        "name": "update_product_config",
        "description": (
            "Phase 1 tool. Modify config.js to add new product queries or remove dead ones. "
            "Use remove_labels to retire queries producing zero results. "
            "Use add_queries to introduce new product searches. "
            "Always creates a dated backup of config.js before writing. "
            "Only call this after reviewing review_collection_performance() output. "
            "Be conservative — only remove if dead on 2+ consecutive dates. "
            "Only add if there is clear evidence from trending_title_terms."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "remove_labels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of label strings to remove from MARKET_PRODUCTS (must match exactly).",
                },
                "add_queries": {
                    "type": "array",
                    "description": "List of new product query objects to add to MARKET_PRODUCTS.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "query":    {"type": "string", "description": "Search keyword(s)"},
                            "label":    {"type": "string", "description": "Human-readable label"},
                            "category": {"type": "string", "description": "product_category value"},
                            "group":    {"type": "string", "description": "product_group value"},
                            "jijiPath": {"type": "string", "description": "Jiji URL path (e.g. /mobile-phones-tablets)"},
                        },
                        "required": ["query", "label", "category", "group", "jijiPath"],
                    },
                },
            },
            "required": [],
        },
    },
]

# ── Agentic loop ──────────────────────────────────────────────
def run_orchestrator():
    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set in server/.env")
        sys.exit(1)
    if not NEON_CONN:
        print("ERROR: NEON_MARKET_PRICES not set in server/.env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    phase3_note = (
        "\n⚠ TODAY IS THE FIRST MONDAY OF THE MONTH — run Phase 3 trend detection after Phase 1."
        if IS_FIRST_MONDAY else ""
    )
    system_prompt = f"""You are the SG Datalytics data quality agent for {TODAY} ({TODAY_DOW}).{phase3_note}

Your job is to autonomously ensure the quality of Ghana market price data after each collection run,
and — on Mondays — to review and optimise the product configuration (Phase 1).

═══════════════════════════════════════════════════
COLLECTION SCHEDULE CONTEXT
═══════════════════════════════════════════════════
- Jiji + Tonaton + Esoko + Hotels + Airbnb + Meqasa run every weekday (Mon–Fri).
- Melcom is skipped in the daily run (--skip-melcom flag).
- On Saturday and Sunday — 0 rows collected today is NORMAL.
- Backlog of flagged rows from previous collection days is valid and should be processed.

═══════════════════════════════════════════════════
STANDARD DAILY WORKFLOW (every run)
═══════════════════════════════════════════════════
1. get_collection_summary — check today's rows collected and any backlog
2. check_selector_health — ALWAYS check this; if status=failed go to Phase 2 healing below
3. get_flagged_rows_by_category — identify unverified flagged rows (today + backlog)
4. If ANY unverified flagged rows exist → run_price_verification
5. get_verification_results — check suggestions
6. apply_price_corrections ONLY if: verification succeeded AND avg_pct_change < 80%
7. get_quality_report
8. Write a brief summary for Mark

═══════════════════════════════════════════════════
PHASE 2 — SELF-HEALING SCRAPER (triggers on selector failure)
═══════════════════════════════════════════════════
If check_selector_health() returns status=failed:
A. fetch_page_html(failed_url) — analyse the live page structure
B. Study the candidate_selectors and qa_test_ids carefully:
   - qa- prefixed IDs are Jiji's own stable semantic hooks — prefer these
   - Classes appearing ~24 times strongly suggest listing card wrappers
   - The new selector should wrap ONE complete listing card
C. update_scraper_selector(old_selector, new_selector) — patch jiji.js
D. In your summary: tell Mark exactly what broke, what the new selector is,
   and confirm the next collection run will work automatically
E. If you cannot confidently identify the new selector, tell Mark to check
   the body_snippet manually and report back — do NOT guess

═══════════════════════════════════════════════════
MONDAY-ONLY — PHASE 1: SMART PRODUCT CONFIG REVIEW
═══════════════════════════════════════════════════
After completing the standard workflow above, on Mondays also:
8. review_collection_performance — see which product groups are dead or weak
9. Evaluate the results:
   - REMOVE a label from config.js if its product_group returned 0 rows on ALL 3 checked dates
     (strong signal: no listings exist for this search term in Ghana)
   - ADD a new query if trending_title_terms shows a brand/model appearing 5+ times that
     has no matching entry already in the well-performing groups
   - SKIP action if data is ambiguous or the group only missed 1 date (could be a slow day)
10. If changes are warranted → update_product_config with your remove_labels and/or add_queries
11. Include your config changes in the summary for Mark:
    - What you removed and why
    - What you added and why
    - If no changes, say "Config looks healthy — no changes needed"

═══════════════════════════════════════════════════
FIRST MONDAY OF THE MONTH — PHASE 3: TREND DETECTION
═══════════════════════════════════════════════════
On the first Monday of each calendar month, after completing Phase 1 above, also:
12. scan_unclassified_listings(days=30) — find listing titles with no product_group
13. Analyse the top_unigrams and top_bigrams carefully:
    - Cluster related terms into coherent product types
      (e.g. "solar generator" + "generator diesel" + "generator petrol" → "Generators & Power")
    - A cluster is significant if the combined mention count is 50+ across the 30-day window
    - Cross-reference against existing_jiji_categories — do NOT add anything already covered
    - Read sample_titles to confirm the pattern is a real product type, not spam or noise
14. For each significant new cluster → add_trend_category(...)
    - Use a descriptive label, pick the right product_category DB value
    - Set jijiPath to '/search' and query to relevant terms if no dedicated Jiji path exists
    - Include reason explaining the evidence (e.g. "87 unclassified listings mentioning solar generator")
15. In your summary: list any new categories added and the evidence behind each
    - If nothing new is evident: "Trend scan complete — existing categories cover all significant clusters"

═══════════════════════════════════════════════════
GUARDRAILS
═══════════════════════════════════════════════════
- Be conservative with apply_price_corrections: only apply if avg_pct_change < 80%
- Be conservative with config changes: zero tolerance for guesses — only act on clear evidence
- Do NOT remove a product group if it returned data on even ONE of the 3 dates
- Phase 3: minimum 50 title mentions before proposing a new category — single sporadic listings are noise
- Phase 3: cluster related terms before adding — avoid adding near-duplicates of existing categories
- Keep your final summary brief and actionable — Mark is a business owner, not a data engineer"""

    messages = [
        {
            "role": "user",
            "content": f"Today is {TODAY}. Assess the data quality for today's market collection and take appropriate action."
        }
    ]

    print(f"\n{'='*60}")
    print(f"  SG Datalytics Quality Orchestrator — {TODAY}")
    print(f"  Model: {MODEL}")
    print(f"{'='*60}\n")

    iteration = 0
    max_iterations = 10  # safety cap

    while iteration < max_iterations:
        iteration += 1
        log(f"Agent thinking... (step {iteration})", "🤔")

        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

        # Add assistant response to history
        messages.append({"role": "assistant", "content": response.content})

        # Check if done
        if response.stop_reason == "end_turn":
            # Extract and print final text summary
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n{'─'*60}")
                    print("  AGENT SUMMARY")
                    print(f"{'─'*60}")
                    print(block.text)
                    print(f"{'─'*60}\n")
            break

        # Handle tool calls
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input
                log(f"Calling tool: {tool_name}({json.dumps(tool_input) if tool_input else ''})", "🔧")

                try:
                    result = TOOL_HANDLERS[tool_name](tool_input)
                    log(f"Tool {tool_name} → OK", "✓")
                except Exception as e:
                    result = {"error": str(e)}
                    log(f"Tool {tool_name} → ERROR: {e}", "❌")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, default=str),
                })

        if tool_results:
            messages.append({"role": "user", "content": tool_results})

    if iteration >= max_iterations:
        log("Max iterations reached — stopping agent", "⚠")

    print("Orchestrator complete.\n")

if __name__ == "__main__":
    run_orchestrator()
