/**
 * SG Datalytics — Re-Enrich Poor Quality Product Names
 *
 * Targets rows where normalized_name is too short (brand-only like "Midea", "HP")
 * and re-runs Gemini enrichment with a better prompt that produces:
 *   "Midea 1.5HP Split AC", "Samsung 55in Smart TV", "HP 256GB Laptop"
 *
 * Run:
 *   node server/db/re-enrich-poor-names.js                   # all poor rows
 *   MAX_ROWS=100 node server/db/re-enrich-poor-names.js      # test run
 *   MIN_LEN=20   node server/db/re-enrich-poor-names.js      # custom threshold
 *
 * Env: NEON_MARKET_PRICES, GEMINI_API_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https  = require('https');
const { Pool } = require('pg');

const GEMINI_API_KEY  = process.env.GEMINI_API_KEY || '';
const GEMINI_URL      = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const BATCH_SIZE      = 30;
const BATCH_DELAY_MS  = 1200;
const MAX_RETRIES     = 3;
const FETCH_BATCH     = 200;
const MAX_ROWS        = parseInt(process.env.MAX_ROWS  || '0');
const MIN_LEN         = parseInt(process.env.MIN_LEN   || '20');  // re-enrich names shorter than this

const log = (msg, sym = '->') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const DB_URL = process.env.NEON_MARKET_PRICES || process.env.DATABASE_URL_MARKET_PRICES;
if (!DB_URL) {
  console.error('Fatal: NEON_MARKET_PRICES is not set. Check server/.env');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('Fatal: GEMINI_API_KEY is not set. Check server/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// ── HTTP helper ───────────────────────────────────────────────────────────────
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const options = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(url, options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { reject(new Error('JSON parse failed: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Gemini: extract descriptive product name from title ───────────────────────
async function extractProductNames(rows) {
  const numbered = rows.map((r, i) =>
    (i + 1) + '. Title: "' + r.title + '"  Category: "' + (r.product_category || '') + '"'
  ).join('\n');

  const prompt =
    'You are a product cataloguer for a Ghana online marketplace.\n' +
    'For each listing below, create a DESCRIPTIVE product label that a customer would search for.\n' +
    'Return ONLY a valid JSON array of strings — no explanation, no markdown, no code fences.\n\n' +
    'Rules:\n' +
    '- 3–6 words max\n' +
    '- Format: "Brand Model/Size/Spec ProductType" — e.g. "Midea 1.5HP Split AC", "Samsung 55in 4K Smart TV", "HP Core i5 Laptop", "Ramtons 300L Chest Freezer"\n' +
    '- KEEP the brand name — it is important for marketplace search\n' +
    '- Include the most useful spec (capacity, size, HP rating, storage, screen size)\n' +
    '- Use common abbreviations: AC (air conditioner), TV (television), HP (horsepower), in (inch), L (litres)\n' +
    '- If the title is completely unintelligible or just a serial number, return null\n' +
    '- Do NOT include prices, colours, or condition (new/used)\n\n' +
    'Listings:\n' + numbered + '\n\n' +
    'Return exactly ' + rows.length + ' strings (or nulls):\n' +
    '["Midea 1.5HP Split AC", "Samsung 55in 4K TV", null, ...]';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await postJson(GEMINI_URL + '?key=' + GEMINI_API_KEY, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      });

      if (resp.status === 429) {
        const wait = attempt * 15000;
        log('Gemini 429 — waiting ' + (wait / 1000) + 's (retry ' + attempt + '/' + MAX_RETRIES + ')…', 'WAIT');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (resp.status !== 200) {
        const errMsg = (resp.body && resp.body.error && resp.body.error.message) || JSON.stringify(resp.body).slice(0, 200);
        log('Gemini HTTP ' + resp.status + ': ' + errMsg, 'WARN');
        return null;
      }

      let text = (resp.body &&
                  resp.body.candidates &&
                  resp.body.candidates[0] &&
                  resp.body.candidates[0].content &&
                  resp.body.candidates[0].content.parts &&
                  resp.body.candidates[0].content.parts[0] &&
                  resp.body.candidates[0].content.parts[0].text) || '';
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== rows.length) {
        log('Gemini returned ' + (parsed && parsed.length) + ' items, expected ' + rows.length, 'WARN');
        return null;
      }
      return parsed;
    } catch (err) {
      log('Gemini error: ' + err.message, 'WARN');
      if (attempt === MAX_RETRIES) return null;
    }
  }
  return null;
}

// ── Bulk UPDATE via unnest ────────────────────────────────────────────────────
async function bulkUpdate(ids, names) {
  await pool.query(
    `UPDATE market_prices AS t
        SET normalized_name = v.normalized_name
       FROM (
         SELECT unnest($1::int[])  AS id,
                unnest($2::text[]) AS normalized_name
       ) AS v
      WHERE t.id = v.id`,
    [ids, names]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // Count how many rows need re-enrichment
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS n FROM market_prices
      WHERE LENGTH(normalized_name) < $1
        AND title IS NOT NULL AND title <> ''`,
    [MIN_LEN]
  );
  const total = parseInt(countRows[0].n);
  log(`Re-enrich starting — ${total} rows with normalized_name shorter than ${MIN_LEN} chars`, '🏷');

  let offset       = 0;
  let totalFetched = 0;
  let totalUpdated = 0;

  while (true) {
    const limit = MAX_ROWS > 0 ? Math.min(FETCH_BATCH, MAX_ROWS - offset) : FETCH_BATCH;
    if (limit <= 0) break;

    const { rows } = await pool.query(
      `SELECT id, title, product_category FROM market_prices
        WHERE LENGTH(normalized_name) < $1
          AND title IS NOT NULL AND title <> ''
        ORDER BY id
        LIMIT $2 OFFSET $3`,
      [MIN_LEN, limit, offset]
    );

    if (!rows.length) break;
    log('Fetched ' + rows.length + ' rows (offset ' + offset + ')…', '📥');

    const updateIds   = [];
    const updateNames = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch   = rows.slice(i, i + BATCH_SIZE);
      const results = await extractProductNames(batch);

      for (let j = 0; j < batch.length; j++) {
        const name = results && results[j];
        if (name && typeof name === 'string' && name.trim().length > 3) {
          updateIds.push(batch[j].id);
          updateNames.push(name.trim());
        }
      }

      log('  sub-batch ' + Math.floor(i / BATCH_SIZE + 1) + ': ' +
          (results ? results.filter(Boolean).length : 0) + '/' + batch.length + ' extracted', '·');

      if (i + BATCH_SIZE < rows.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    if (updateIds.length) {
      await bulkUpdate(updateIds, updateNames);
    }

    log('Page done — updated ' + updateIds.length + '/' + rows.length + ' rows', '🐘');

    totalFetched += rows.length;
    totalUpdated += updateIds.length;
    offset       += rows.length;

    if (MAX_ROWS > 0 && totalFetched >= MAX_ROWS) {
      log('MAX_ROWS (' + MAX_ROWS + ') reached — stopping', '🛑');
      break;
    }

    if (rows.length < FETCH_BATCH) break;

    await new Promise(r => setTimeout(r, 500));
  }

  await pool.end();
  log(`Re-enrichment complete — ${totalFetched} rows processed, ${totalUpdated} updated`, '✅');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
