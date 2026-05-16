/**
 * SG Datalytics — CSV Utilities
 * Core helper for reading/writing local CSV files.
 * No external dependencies — uses only Node built-ins.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

// ── DATA DIRECTORY ────────────────────────────────────────────
function getDataDir() {
  return process.env.DATA_DIR ||
    path.join('C:', 'Users', process.env.USERNAME || 'markt',
              'OneDrive', 'Desktop', 'sgdatalytics-data');
}

// ── FOLDER STRUCTURE ──────────────────────────────────────────
const SUBDIRS = [
  'raw/market',
  'raw/economic',
  'raw/commodities',
  'raw/hotels',
  'weekly',
  'monthly',
  'master',
];

function ensureDirs() {
  const base = getDataDir();
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  for (const sub of SUBDIRS) {
    const full = path.join(base, sub);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  }
  return base;
}

// ── CSV ESCAPING ──────────────────────────────────────────────
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(',');
}

// ── CSV PARSING ───────────────────────────────────────────────
// Handles quoted fields, embedded commas, double-quote escaping
function parseCsvLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ── READ CSV ──────────────────────────────────────────────────
// Returns array of objects using first-row headers as keys
function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines   = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const obj    = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

// ── APPEND TO CSV ─────────────────────────────────────────────
// Creates the file with a header row if new; appends rows otherwise
function appendCsv(filePath, headers, rows) {
  if (!rows.length) return 0;
  const isNew = !fs.existsSync(filePath);
  const lines  = [];
  if (isNew) lines.push(toCsvRow(headers));
  for (const row of rows) {
    const values = headers.map(h => row[h] ?? '');
    lines.push(toCsvRow(values));
  }
  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return rows.length;
}

// ── WRITE NEW CSV (overwrites) ────────────────────────────────
function writeCsv(filePath, headers, rows) {
  const lines = [toCsvRow(headers)];
  for (const row of rows) {
    const values = headers.map(h => row[h] ?? '');
    lines.push(toCsvRow(values));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return rows.length;
}

// ── FILE PATH HELPERS ─────────────────────────────────────────
function getRawPath(category, filename) {
  return path.join(getDataDir(), 'raw', category, filename);
}

function getMasterPath(filename) {
  return path.join(getDataDir(), 'master', filename);
}

function getWeeklyPath(filename) {
  return path.join(getDataDir(), 'weekly', filename);
}

function getMonthlyPath(filename) {
  return path.join(getDataDir(), 'monthly', filename);
}

// ── DATE / WEEK HELPERS ───────────────────────────────────────
function getDateStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function getWeekAndYear(date = new Date()) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return { week_number: week, year };
}

function getWeekStr(week, year) {
  return `W${String(week).padStart(2, '0')}_${year}`;
}

function getMonthStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ── MASTER FILE: APPEND ONLY NEW ROWS ─────────────────────────
// uniqueKey: array of field names that together form a unique key.
// Deduplicates both against existing rows AND within the incoming
// batch itself — so two rows with the same key in one run only
// produce one entry (first occurrence wins).
function appendNewToMaster(masterPath, headers, rows, uniqueKey) {
  const existing = readCsv(masterPath);
  const knownSet = new Set(existing.map(r => uniqueKey.map(k => r[k]).join('|')));

  const newRows = [];
  for (const r of rows) {
    const key = uniqueKey.map(k => r[k]).join('|');
    if (!knownSet.has(key)) {
      knownSet.add(key);   // mark seen so duplicates later in this batch are also skipped
      newRows.push(r);
    }
  }

  if (!newRows.length) return 0;
  return appendCsv(masterPath, headers, newRows);
}

module.exports = {
  getDataDir,
  ensureDirs,
  csvEscape,
  toCsvRow,
  readCsv,
  appendCsv,
  writeCsv,
  appendNewToMaster,
  getRawPath,
  getMasterPath,
  getWeeklyPath,
  getMonthlyPath,
  getDateStr,
  getWeekAndYear,
  getWeekStr,
  getMonthStr,
};
