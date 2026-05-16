/**
 * SG Datalytics — Classifier-Only Backfill
 * Fills brand/model/normalized_name for existing rows using the local
 * classifier (no AI, no API calls, runs instantly).
 *
 * Use this when Gemini quota is exhausted. Run Gemini backfill later
 * to upgrade rows to AI-quality enrichment.
 *
 * Run: node server/db/backfill-classifier.js
 * Env: NEON_MARKET_PRICES
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool }    = require('pg');
const { classify } = require('../collectors/classifier');

const BATCH_SIZE = 500;
const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const DB_URL = process.env.NEON_MARKET_PRICES || process.env.DATABASE_URL_MARKET_PRICES;
if (!DB_URL) {
  console.error('Fatal: NEON_MARKET_PRICES is not set. Check server/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  log('Classifier backfill starting…', '🏷');

  let offset       = 0;
  let totalUpdated = 0;

  while (true) {
    const { rows } = await pool.query(
      `SELECT id, title FROM market_prices
        WHERE (normalized_name IS NULL OR normalized_name = '')
          AND title IS NOT NULL AND title <> ''
        ORDER BY id
        LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (!rows.length) break;
    log(`Processing ${rows.length} rows (offset ${offset})…`, '📥');

    // Build UPDATE values in one query using unnest for speed
    const ids             = [];
    const brands          = [];
    const models          = [];
    const normalized_names = [];

    for (const row of rows) {
      const { brand, model } = classify(row.title);
      const b = brand || '';
      const m = model || '';
      ids.push(row.id);
      brands.push(b);
      models.push(m);
      normalized_names.push(b ? (m ? `${b} ${m}` : b) : '');
    }

    await pool.query(
      `UPDATE market_prices AS t
          SET brand           = v.brand,
              model           = v.model,
              normalized_name = v.normalized_name
         FROM (
           SELECT unnest($1::int[])  AS id,
                  unnest($2::text[]) AS brand,
                  unnest($3::text[]) AS model,
                  unnest($4::text[]) AS normalized_name
         ) AS v
        WHERE t.id = v.id`,
      [ids, brands, models, normalized_names]
    );

    const updated = normalized_names.filter(n => n).length;
    log(`Updated ${updated}/${rows.length} rows`, '🐘');
    totalUpdated += updated;
    offset       += rows.length;

    if (rows.length < BATCH_SIZE) break;
  }

  await pool.end();
  log(`Classifier backfill complete — ${totalUpdated} rows updated`, '✅');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
