/**
 * SG Datalytics — Property Location Enricher
 * Uses Gemini Flash to extract neighborhood and city from
 * raw Meqasa listing titles.
 * Env: GEMINI_API_KEY
 */
require('dotenv').config();
const https = require('https');

const GEMINI_API_KEY  = process.env.GEMINI_API_KEY || '';
const GEMINI_URL      = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const BATCH_SIZE      = 30;
const BATCH_DELAY_MS  = 1000;
const MAX_RETRIES     = 3;
const log = (msg, sym = '->') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

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

async function enrichBatch(titles) {
  if (!GEMINI_API_KEY) return null;

  const numbered = titles.map((t, i) => (i + 1) + '. "' + t + '"').join('\n');
  const prompt =
    'You are a Ghana real estate data analyst.\n' +
    'Extract the neighborhood/area and city from each property listing title below.\n' +
    'Return ONLY a valid JSON array — no explanation, no markdown.\n\n' +
    'Ghana context:\n' +
    '- Major cities: Accra, Kumasi, Takoradi, Tamale, Cape Coast, Tema, Kasoa\n' +
    '- Accra neighborhoods: East Legon, Cantonments, Labone, Osu, Airport Residential, ' +
    'Adenta, Spintex, Haatso, Madina, Sakumono, Roman Ridge, Ridge, Asylum Down, ' +
    'North Legon, Trasacco, Abelemkpe, Dzorwulu, Tesano, Accra Central, Dansoman, ' +
    'Dome, Achimota, Teshie, Nungua, Baatsona, Kotobabi, Bubuashie\n' +
    '- Tema neighborhoods: Community 18, Afienya, Ashaiman\n' +
    '- Kumasi areas: Ahodwo, Nhyiaeso, Ayigya, Bantama, KNUST area\n\n' +
    'Rules:\n' +
    '- neighborhood: the specific area/suburb (e.g. "East Legon", "Cantonments") or null if not clear\n' +
    '- city: the city name only (e.g. "Accra", "Kumasi") — infer from neighborhood if not stated\n' +
    '- If only a city is mentioned with no neighborhood, set neighborhood to null\n' +
    '- Standardize: "Greater Accra" → city "Accra"; "Ashanti" → city "Kumasi"\n\n' +
    'Titles:\n' + numbered + '\n\n' +
    'Return exactly ' + titles.length + ' objects:\n' +
    '[{"neighborhood":null,"city":null}, ...]';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await postJson(GEMINI_URL + '?key=' + GEMINI_API_KEY, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
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
      if (!Array.isArray(parsed) || parsed.length !== titles.length) {
        log('Gemini returned ' + (parsed && parsed.length) + ' items, expected ' + titles.length, 'WARN');
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

async function enrichPropertyListings(rows) {
  if (!GEMINI_API_KEY) {
    log('GEMINI_API_KEY not set — skipping property location enrichment', 'WARN');
    return rows;
  }

  let enriched = 0;
  let failed   = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch   = rows.slice(i, i + BATCH_SIZE);
    const titles  = batch.map(r => r.title || '');
    const results = await enrichBatch(titles);

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const res = results && results[j];

      if (res && (res.neighborhood || res.city)) {
        row.neighborhood = res.neighborhood || '';
        row.city         = res.city         || '';
        enriched++;
      } else {
        row.neighborhood = row.neighborhood || '';
        row.city         = row.city         || '';
        failed++;
      }
    }

    if (i + BATCH_SIZE < rows.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  log('Property enrichment complete — ' + enriched + '/' + rows.length + ' enriched, ' + failed + ' fallback', 'DONE');
  return rows;
}

module.exports = { enrichPropertyListings };
