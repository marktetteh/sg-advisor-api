/**
 * SG Datalytics — Google Sheets Writer
 * ─────────────────────────────────────────────────────────────
 * Pulls latest data from all Neon product views and writes
 * them to the SG Datalytics Google Sheet (one tab per view).
 *
 * Tabs written:
 *   SGMPI | Property | Hotels | Airbnb | Economic | FX | Commodities | Fuel
 *
 * Run manually:  node server/db/sheets-writer.js
 * Auto-run:      Called by scheduler.js after weekly pipeline
 *
 * Env vars required:
 *   GOOGLE_CREDENTIALS_PATH  → path to google-credentials.json
 *   GOOGLE_SHEET_ID          → ID from the Google Sheet URL
 *   NEON_MARKET_PRICES, NEON_PROPERTY, NEON_ACCOMMODATION,
 *   NEON_ECONOMIC, NEON_COMMODITIES
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google }  = require('googleapis');
const { Pool }    = require('pg');
const path        = require('path');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_CREDENTIALS_PATH ||
  path.join(__dirname, '..', 'google-credentials.json');

const log = (msg, sym = '→') =>
  console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

// ── Authenticate with Google ──────────────────────────────────
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes:  ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// ── Query a Neon view ─────────────────────────────────────────
async function queryView(connStr, viewName, limit = 5000) {
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const res = await pool.query(
      `SELECT * FROM ${viewName} ORDER BY collected_date DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  } finally {
    await pool.end();
  }
}

// ── Write rows to a sheet tab ─────────────────────────────────
async function writeTab(sheets, tabName, rows) {
  if (!rows.length) {
    log(`${tabName}: no rows — skipping`, '⚠');
    return;
  }

  // Build header + data rows
  const headers = Object.keys(rows[0]);
  const values  = [
    headers,
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().split('T')[0];
      return String(v);
    })),
  ];

  // Ensure the tab exists — create it if not
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: tabName } },
        }],
      },
    });
    log(`${tabName}: tab created`, '✚');
  } catch {
    // Tab already exists — that's fine
  }

  // Clear existing content then write fresh data
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A1:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId:     SHEET_ID,
    range:             `${tabName}!A1`,
    valueInputOption:  'RAW',
    requestBody:       { values },
  });

  log(`${tabName}: ${rows.length} rows written ✓`, '📊');
}

// ── Add a "Last Updated" info tab ─────────────────────────────
async function writeInfoTab(sheets, summary) {
  const now  = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' });
  const rows = [
    ['SG Datalytics — Data Products Sheet'],
    ['Last updated', now, 'Africa/Accra time'],
    [],
    ['Tab', 'Rows written', 'Status'],
    ...summary.map(s => [s.tab, s.rows, s.status]),
    [],
    ['Questions?', 'info@sgdatalytics.org'],
    ['WhatsApp',   '+233 599 477 325'],
  ];

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'INFO', index: 0 } } }] },
    });
  } catch { /* already exists */ }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: 'INFO!A1:ZZ',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            'INFO!A1',
    valueInputOption: 'RAW',
    requestBody:      { values: rows },
  });
  log(`INFO tab updated (${now})`, '📋');
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   SG Datalytics — Google Sheets Writer              ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  if (!SHEET_ID) {
    console.error('  ✗  GOOGLE_SHEET_ID not set in .env');
    process.exit(1);
  }

  const sheets  = await getSheets();
  const summary = [];

  // ── Define all tabs to write ────────────────────────────────
  const TABS = [
    { tab: 'SGMPI',       envKey: 'NEON_MARKET_PRICES',   view: 'sgmpi_product'       },
    { tab: 'Property',    envKey: 'NEON_PROPERTY',         view: 'property_product'    },
    { tab: 'Hotels',      envKey: 'NEON_ACCOMMODATION',    view: 'hotels_product'      },
    { tab: 'Airbnb',      envKey: 'NEON_ACCOMMODATION',    view: 'airbnb_product'      },
    { tab: 'Economic',    envKey: 'NEON_ECONOMIC',         view: 'economic_product'    },
    { tab: 'FX',          envKey: 'NEON_ECONOMIC',         view: 'fx_product'          },
    { tab: 'Commodities', envKey: 'NEON_COMMODITIES',      view: 'commodities_product' },
    { tab: 'Fuel',        envKey: 'NEON_COMMODITIES',      view: 'fuel_product'        },
  ];

  for (const { tab, envKey, view } of TABS) {
    const connStr = process.env[envKey];
    if (!connStr) {
      log(`${tab}: ${envKey} not set — skipping`, '⚠');
      summary.push({ tab, rows: 0, status: 'Skipped (no env var)' });
      continue;
    }
    try {
      log(`${tab}: querying ${view}...`);
      const rows = await queryView(connStr, view);
      await writeTab(sheets, tab, rows);
      summary.push({ tab, rows: rows.length, status: '✓ Updated' });
    } catch (err) {
      log(`${tab}: ERROR — ${err.message.split('\n')[0]}`, '✗');
      summary.push({ tab, rows: 0, status: `Error: ${err.message.split('\n')[0]}` });
    }
  }

  // Write INFO tab last
  await writeInfoTab(sheets, summary);

  // Print summary
  console.log('\n  ══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('  ══════════════════════════════════════════════════════');
  for (const s of summary) {
    console.log(`  ${s.status.startsWith('✓') ? '✓' : '✗'}  ${s.tab.padEnd(14)} ${s.rows} rows`);
  }
  console.log('');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
