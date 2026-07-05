/**
 * SG Datalytics — AI Listing Enricher
 * Uses Groq (if GROQ_API_KEY set) or Gemini 2.0 Flash Lite (GEMINI_API_KEY) to extract
 * structured fields from raw listing titles.
 * Env: GROQ_API_KEY  (preferred — free, reliable)
 *      GEMINI_API_KEY (fallback — paid standard tier, gemini-2.0-flash-lite)
 */
require('dotenv').config();
const https = require('https');

const GROQ_API_KEY   = process.env.GROQ_API_KEY   || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY  || '';

// Pick provider: Groq if key present, otherwise Gemini 2.0 Flash Lite
// Gemini is default. Set USE_GROQ=1 in env to switch to Groq.
const USE_GROQ    = process.env.USE_GROQ === '1' && !!GROQ_API_KEY;
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL  = 'llama-3.1-8b-instant';
const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'; // paid standard tier — confirmed working

const BATCH_SIZE     = 10;   // 10 titles per batch — works well with Gemini 2.5-flash
const BATCH_DELAY_MS = 3000; // 3s between batches
const MAX_RETRIES    = 3;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // half-open after 5 min

const log = (msg, sym = '->') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// Circuit breaker state
let consecutiveFailures = 0;
let circuitOpen         = false;
let circuitOpenedAt     = null;

function postJson(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const options = {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders,
      },
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

async function enrichBatch(titles) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY) return null;
  const provider = USE_GROQ ? 'Groq' : 'Gemini';

  // Circuit breaker: skip if open, but half-open after CIRCUIT_RESET_MS
  if (circuitOpen) {
    const elapsed = Date.now() - circuitOpenedAt;
    if (elapsed < CIRCUIT_RESET_MS) {
      log('Circuit open — skipping enrichment (reset in ' + Math.ceil((CIRCUIT_RESET_MS - elapsed) / 1000) + 's)', 'SKIP');
      return null;
    }
    log('Circuit half-open — testing if ' + provider + ' recovered…', 'TEST');
    circuitOpen = false;
  }

  const numbered = titles.map((t, i) => (i + 1) + '. "' + t + '"').join('\n');
  const prompt =
    'You are a product data extractor for a Ghana online marketplace.\n' +
    'Extract structured fields from each listing title below.\n' +
    'Return ONLY a valid JSON array - no explanation, no markdown.\n\n' +
    'For each title extract:\n' +
    '- brand: manufacturer name (Samsung, Apple, Tecno, Infinix, Itel, Xiaomi, Oppo, Nokia, Huawei, HP, Dell, Lenovo, Toyota, Honda etc.) or null\n' +
    '- model: specific model name/number or null\n' +
    '- storage: storage/RAM spec if present or null\n' +
    '- normalized_name: clean canonical product name (brand + model only)\n' +
    '- condition: "New" if title suggests brand new/sealed/unopened, "Used" if title suggests second-hand/fairly used/tokunbo/pre-owned/refurbished, null if unclear\n\n' +
    'Titles:\n' + numbered + '\n\n' +
    'Return exactly ' + titles.length + ' objects:\n' +
    '[{"brand":null,"model":null,"storage":null,"normalized_name":null,"condition":null}, ...]';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let resp;
      if (USE_GROQ) {
        // Groq free tier: 6000 total token limit (input ~500 + output).
        // 5 items → ~150 output tokens; cap at 1000 to stay well under limit.
        resp = await postJson(
          GROQ_URL,
          { model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 1000 },
          { 'Authorization': 'Bearer ' + GROQ_API_KEY }
        );
      } else {
        resp = await postJson(
          GEMINI_URL + '?key=' + GEMINI_API_KEY,
          { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }
        );
      }

      if (resp.status === 413) {
        log(provider + ' 413 — request too large, skipping batch (reduce BATCH_SIZE if this persists)', 'WARN');
        return null; // don't retry, don't trip circuit breaker
      }

      if (resp.status === 429) {
        const wait = attempt * 15000;
        log(provider + ' 429 rate limit - waiting ' + (wait / 1000) + 's (retry ' + attempt + '/' + MAX_RETRIES + ')...', 'WAIT');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (resp.status === 503) {
        const wait = Math.min(attempt * 30000, 90000);
        log(provider + ' 503 - waiting ' + (wait / 1000) + 's (retry ' + attempt + '/' + MAX_RETRIES + ')...', 'WAIT');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (resp.status !== 200) {
        const errMsg = (resp.body && resp.body.error && resp.body.error.message) || JSON.stringify(resp.body).slice(0, 200);
        log(provider + ' HTTP ' + resp.status + ': ' + errMsg, 'WARN');
        consecutiveFailures++;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitOpen = true; circuitOpenedAt = Date.now();
          log('Circuit breaker OPEN — ' + provider + ' unavailable. Will retry in 5 min.', 'WARN');
        }
        return null;
      }

      // Parse response — Groq uses OpenAI format, Gemini uses its own
      let text = '';
      if (USE_GROQ) {
        text = (resp.body && resp.body.choices && resp.body.choices[0] && resp.body.choices[0].message && resp.body.choices[0].message.content) || '';
      } else {
        text = (resp.body && resp.body.candidates && resp.body.candidates[0] && resp.body.candidates[0].content && resp.body.candidates[0].content.parts && resp.body.candidates[0].content.parts[0] && resp.body.candidates[0].content.parts[0].text) || '';
      }
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== titles.length) {
        log(provider + ' returned ' + (parsed && parsed.length) + ' items, expected ' + titles.length, 'WARN');
        return null;
      }
      // Success — reset circuit breaker
      consecutiveFailures = 0;
      circuitOpen = false;
      return parsed;

    } catch (err) {
      log(provider + ' error: ' + err.message, 'WARN');
      // Only trip circuit breaker on network errors, not JSON parse issues
      const isNetworkError = /ECONNRESET|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(err.message);
      if (isNetworkError) {
        consecutiveFailures++;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitOpen = true; circuitOpenedAt = Date.now();
          log('Circuit breaker OPEN — ' + provider + ' unreachable. Will retry in 5 min.', 'WARN');
        }
      }
      return null;
    }
  }

  // All retries exhausted
  consecutiveFailures++;
  log(provider + ' failed after ' + MAX_RETRIES + ' retries (' + consecutiveFailures + ' consecutive failures)', 'WARN');
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpen = true; circuitOpenedAt = Date.now();
    log('Circuit breaker OPEN — ' + provider + ' persistently unavailable. Will retry in 5 min.', 'WARN');
  }
  return null;
}

async function enrichListings(rows) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY) {
    log('No API key set (GROQ_API_KEY or GEMINI_API_KEY) - skipping AI enrichment', 'WARN');
    return rows;
  }
  // Reset circuit state when called fresh (each collector run starts clean)
  consecutiveFailures = 0;
  circuitOpen = false;
  circuitOpenedAt = null;
  log('Using ' + (USE_GROQ ? 'Groq (llama-3.1-8b-instant)' : 'Gemini (gemini-2.5-flash)') + ' for enrichment', '🤖');
  if (process.env.SKIP_ENRICHMENT === '1') {
    log('SKIP_ENRICHMENT=1 — skipping AI enrichment, saving raw rows', 'SKIP');
    return rows;
  }

  const total = rows.length;
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch   = rows.slice(i, i + BATCH_SIZE);
    const titles  = batch.map(function(r) { return r.title || ''; });
    const results = await enrichBatch(titles);

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const res = results && results[j];

      if (res && (res.brand || res.model || res.normalized_name)) {
        row.brand           = res.brand           || row.brand  || '';
        row.model           = res.model           || row.model  || '';
        row.storage         = res.storage         || '';
        row.normalized_name = res.normalized_name || (row.brand + (row.model ? ' ' + row.model : ''));
        row.condition       = res.condition       || row.condition || '';
        enriched++;
      } else {
        row.storage         = row.storage         || '';
        row.normalized_name = row.normalized_name || (row.brand ? row.brand + (row.model ? ' ' + row.model : '') : '');
        row.condition       = row.condition       || '';
        failed++;
      }
    }

    if (i + BATCH_SIZE < rows.length) {
      await new Promise(function(r) { setTimeout(r, BATCH_DELAY_MS); });
    }
  }

  log('Enrichment complete - ' + enriched + '/' + total + ' AI-enriched, ' + failed + ' fallback', 'DONE');
  return rows;
}

module.exports = { enrichListings };
