/**
 * SG Datalytics — Property Location Backfill
 * Fills neighborhood and city for existing property_prices rows
 * using Gemini to parse listing titles.
 *
 * Run:
 *   node server/db/backfill-property-locations.js
 *   MAX_ROWS=100 node server/db/backfill-property-locations.js  # test run
 *
 * Env: NEON_PROPERTY, GEMINI_API_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool }   = require('pg');
const { enrichPropertyListings } = require('../collectors/property-enricher');

const FETCH_BATCH = 200;
const MAX_ROWS    = parseInt(process.env.MAX_ROWS || '0');
const log = (msg, sym = '->') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const DB_URL = process.env.NEON_PROPERTY;
if (!DB_URL) {
  console.error('Fatal: NEON_PROPERTY is not set. Check server/.env');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('Fatal: GEMINI_API_KEY is not set. Check server/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function bulkUpdate(ids, neighborhoods, cities) {
  await pool.query(
    `UPDATE property_prices AS t
        SET neighborhood = v.neighborhood,
            city         = v.city
       FROM (
         SELECT unnest($1::int[])  AS id,
                unnest($2::text[]) AS neighborhood,
                unnest($3::text[]) AS city
       ) AS v
      WHERE t.id = v.id`,
    [ids, neighborhoods, cities]
  );
}

async function run() {
  log('Property location backfill starting…', '🏘');

  let offset       = 0;
  let totalFetched = 0;
  let totalUpdated = 0;

  while (true) {
    const limit = MAX_ROWS > 0 ? Math.min(FETCH_BATCH, MAX_ROWS - offset) : FETCH_BATCH;
    if (limit <= 0) break;

    const { rows } = await pool.query(
      `SELECT id, title FROM property_prices
        WHERE (neighborhood IS NULL OR neighborhood = '')
          AND (city IS NULL OR city = '')
          AND title IS NOT NULL AND title <> ''
        ORDER BY id
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    if (!rows.length) break;
    log('Fetched ' + rows.length + ' rows (offset ' + offset + ')…', '📥');

    const enriched = await enrichPropertyListings(rows);

    const ids           = [];
    const neighborhoods = [];
    const cities        = [];

    for (const row of enriched) {
      if (row.neighborhood || row.city) {
        ids.push(row.id);
        neighborhoods.push(row.neighborhood || '');
        cities.push(row.city || '');
      }
    }

    if (ids.length) await bulkUpdate(ids, neighborhoods, cities);

    log('Page done — updated ' + ids.length + '/' + rows.length + ' rows', '🐘');

    totalFetched += rows.length;
    totalUpdated += ids.length;
    offset       += rows.length;

    if (MAX_ROWS > 0 && totalFetched >= MAX_ROWS) {
      log('MAX_ROWS (' + MAX_ROWS + ') reached — stopping', '🛑');
      break;
    }

    if (rows.length < FETCH_BATCH) break;
    await new Promise(r => setTimeout(r, 500));
  }

  await pool.end();
  log('Backfill complete — ' + totalFetched + ' rows processed, ' + totalUpdated + ' updated', '✅');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
