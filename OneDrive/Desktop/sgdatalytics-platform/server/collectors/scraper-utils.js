/**
 * Shared utilities for Jiji & Tonaton scrapers
 */

// Parse GHS price from raw string
function parsePrice(raw) {
  if (!raw) return null;
  const clean = raw.replace(/GHS|GH₵|₵|,/gi, '').trim();
  const num   = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Normalize condition — only returns a value when text exactly matches
// a known Jiji condition label. Returns null for anything else — never guesses.
// Input may be a single attribute value or multiple joined with ' | '
// (as emitted by the scraper when a card has multiple attribute chips).
const _CONDITION_MAP = new Map([
  ['brand new',   'Brand new'],
  ['new',         'Brand new'],
  ['used',        'Used'],
  ['fairly used', 'Used'],
  ['second hand', 'Used'],
  ['refurbished', 'Refurbished'],
]);

function normalizeCondition(text) {
  if (!text || !text.trim()) return null;
  for (const part of text.split('|').map(s => s.trim().toLowerCase())) {
    const mapped = _CONDITION_MAP.get(part);
    if (mapped) return mapped;
  }
  return null;   // not guessing — no recognised condition label found
}

// Clean location text
function cleanLocation(text) {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').trim();
}

// ISO week number
function getWeekAndYear(date = new Date()) {
  const d    = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day  = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return { week_number: week, year };
}

module.exports = { parsePrice, normalizeCondition, cleanLocation, getWeekAndYear };
