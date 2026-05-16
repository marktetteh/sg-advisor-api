/**
 * SG Datalytics — Ghana Statistical Service Collector
 * Scrapes live stats from GSS homepage dashboard cards (SSR / Next.js)
 * + CPI, GDP, Unemployment, Population, Poverty, etc.
 * Run: node collectors/gss.js
 */
require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const {
  ensureDirs, appendCsv, appendNewToMaster, getRawPath, getMasterPath,
  getDateStr, getMonthStr,
} = require('./csv-utils');
const { insertRows, writeFallbackExcel, closeAllPools } = require('../db/neon-writer');

const log = (msg, sym = '→') => console.log(`  [${new Date().toLocaleTimeString()}] ${sym} ${msg}`);

const GSS_HOME = 'https://www.statsghana.gov.gh';

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const EI_HEADERS = [
  'fetched_date', 'year', 'month', 'indicator_code', 'indicator_name',
  'sector', 'value', 'unit', 'source',
];

// Month name → 2-digit string
const MONTH_MAP = {
  january:'01', february:'02', march:'03', april:'04',
  may:'05', june:'06', july:'07', august:'08',
  september:'09', october:'10', november:'11', december:'12',
};

function parseMonth(text) {
  const lower = text.toLowerCase();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (lower.includes(name)) return num;
  }
  // Try abbreviated e.g. "Mar"
  const abbrevs = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for (let i = 0; i < abbrevs.length; i++) {
    if (lower.includes(abbrevs[i])) return String(i + 1).padStart(2, '0');
  }
  return '01';
}

// ── PARSE HOMEPAGE DASHBOARD CARDS ───────────────────────────
// GSS homepage (Next.js SSR) renders stat cards as <a> links whose
// inner text contains the value and period. We match by href pattern.
async function scrapeHomepageCards(today) {
  log('Scraping GSS homepage dashboard cards…', '▶');
  const rows = [];

  let $;
  try {
    const resp = await axios.get(GSS_HOME, { headers: HTTP_HEADERS, timeout: 20000 });
    $ = cheerio.load(resp.data);
    log('  Homepage loaded OK', '  ✓');
  } catch (err) {
    log(`  Homepage failed: ${err.message}`, '  ✗');
    return rows;
  }

  // Collect all anchor link texts indexed by href
  const cards = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 5) cards.push({ href, text });
  });

  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  // ── CPI / Inflation (YoY) ─────────────────────────────────
  // Text pattern: "CPIInflation(YoY)3.2%March 2026−0.1 ppvs February 2026"
  const cpiCard = cards.find(c => c.href.includes('tab=price-index') && /CPI/i.test(c.text));
  if (cpiCard) {
    const valMatch  = cpiCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const dateMatch = cpiCard.text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = dateMatch ? dateMatch[2] : currentYear;
      const month = dateMatch ? parseMonth(dateMatch[1]) : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_CPI_INFLATION', indicator_name: 'CPI Headline Inflation YoY (%)', sector: 'economy', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_CPI_INFLATION ${year}-${month} → ${value}%`, '  ✓');
    }
  }

  // ── PPI (Producer Price Index, YoY) ──────────────────────
  // Text: "PPIPPI(YoY)1.4%February 2026..."
  const ppiCard = cards.find(c => c.href.includes('tab=price-index') && /PPI/i.test(c.text) && !/CPI/.test(c.text));
  if (ppiCard) {
    const valMatch  = ppiCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const dateMatch = ppiCard.text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = dateMatch ? dateMatch[2] : currentYear;
      const month = dateMatch ? parseMonth(dateMatch[1]) : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_PPI', indicator_name: 'Producer Price Index YoY (%)', sector: 'economy', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_PPI ${year}-${month} → ${value}%`, '  ✓');
    }
  }

  // ── PBCI (Private Business Confidence / Building Construction) ─
  // Text: "PBCIPBCI2.2%March 2026..."
  const pbciCard = cards.find(c => c.href.includes('tab=price-index') && /PBCI/i.test(c.text));
  if (pbciCard) {
    const valMatch  = pbciCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const dateMatch = pbciCard.text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = dateMatch ? dateMatch[2] : currentYear;
      const month = dateMatch ? parseMonth(dateMatch[1]) : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_PBCI', indicator_name: 'Private Building & Construction Index YoY (%)', sector: 'construction', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_PBCI ${year}-${month} → ${value}%`, '  ✓');
    }
  }

  // ── GDP Annual Growth ─────────────────────────────────────
  // Text: "GDPGrowth by ProductionQuarterly5.8%2025 Q4Annual6.0%Year 2025..."
  const gdpCard = cards.find(c => c.href.includes('tab=national-accounts') && /GDP/i.test(c.text));
  if (gdpCard) {
    // Annual growth: "Annual6.0%Year 2025"
    const annualMatch = gdpCard.text.match(/Annual\s*([0-9]+\.?[0-9]*)\s*%.*?Year\s*(\d{4})/i);
    if (annualMatch) {
      rows.push({ fetched_date: today, year: annualMatch[2], month: '01', indicator_code: 'GSS_GDP_GROWTH_ANNUAL', indicator_name: 'GDP Annual Growth Rate (%)', sector: 'economy', value: parseFloat(annualMatch[1]), unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_GDP_GROWTH_ANNUAL ${annualMatch[2]} → ${annualMatch[1]}%`, '  ✓');
    }
    // Quarterly growth: "Quarterly5.8%2025 Q4"
    const qtrMatch = gdpCard.text.match(/Quarterly\s*([0-9]+\.?[0-9]*)\s*%\s*(\d{4})\s*Q(\d)/i);
    if (qtrMatch) {
      rows.push({ fetched_date: today, year: qtrMatch[2], month: String(parseInt(qtrMatch[3]) * 3).padStart(2,'0'), indicator_code: 'GSS_GDP_GROWTH_QTR', indicator_name: `GDP Quarterly Growth Rate (%) Q${qtrMatch[3]}`, sector: 'economy', value: parseFloat(qtrMatch[1]), unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_GDP_GROWTH_QTR ${qtrMatch[2]}Q${qtrMatch[3]} → ${qtrMatch[1]}%`, '  ✓');
    }
  }

  // ── MIEG (Mining, Industry, Energy & Gas) Index ───────────
  // Text: "MIEGMIEG7.5%January 2026..."
  const miegCard = cards.find(c => c.href.includes('tab=national-accounts') && /MIEG/i.test(c.text));
  if (miegCard) {
    const valMatch  = miegCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const dateMatch = miegCard.text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = dateMatch ? dateMatch[2] : currentYear;
      const month = dateMatch ? parseMonth(dateMatch[1]) : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_MIEG', indicator_name: 'Mining, Industry, Energy & Gas Index YoY (%)', sector: 'industry', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_MIEG ${year}-${month} → ${value}%`, '  ✓');
    }
  }

  // ── IIP (Industrial/Import Index) ────────────────────────
  // Text: "IIPIIP102.6%2025Q4..."
  const iipCard = cards.find(c => /IIP/i.test(c.text) && !/MIEG|GDP|PPI|CPI|PBCI/.test(c.text));
  if (iipCard) {
    const valMatch = iipCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const yrMatch  = iipCard.text.match(/(\d{4})\s*Q(\d)/);
    if (valMatch && yrMatch) {
      rows.push({ fetched_date: today, year: yrMatch[1], month: String(parseInt(yrMatch[2]) * 3).padStart(2,'0'), indicator_code: 'GSS_IIP', indicator_name: 'Industrial/Import Index (%)', sector: 'industry', value: parseFloat(valMatch[1]), unit: 'index', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_IIP ${yrMatch[1]}Q${yrMatch[2]} → ${valMatch[1]}`, '  ✓');
    }
  }

  // ── Unemployment Rate ─────────────────────────────────────
  // Text: "UNEMPUnemployment Rate13.0%GSS LFS · Q3 2025+0.4 ppvs Q2 2025"
  const unempCard = cards.find(c => /Unemployment/i.test(c.text));
  if (unempCard) {
    const valMatch  = unempCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const qyrMatch  = unempCard.text.match(/Q(\d)\s+(\d{4})/);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = qyrMatch ? qyrMatch[2] : currentYear;
      const month = qyrMatch ? String(parseInt(qyrMatch[1]) * 3).padStart(2,'0') : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_UNEMPLOYMENT', indicator_name: 'Unemployment Rate (%)', sector: 'labour', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_UNEMPLOYMENT ${year} Q → ${value}%`, '  ✓');
    }
  }

  // ── Population Projection ─────────────────────────────────
  // Text: "POPProjected Population34,378,7682026"
  // The year (4 digits) is concatenated directly after the population number.
  const popCard = cards.find(c => /Population/i.test(c.text) && /\d{7,}/.test(c.text.replace(/,/g, '')));
  if (popCard) {
    // Extract 4-digit year at end; population is the numeric block before it
    const yrMatch  = popCard.text.match(/(\d{4})\s*(?:[^0-9]|$)/);
    // Remove all non-digit/comma chars, then strip the trailing 4-digit year
    const numPart  = popCard.text.replace(/[^0-9,]/g, ''); // e.g. "34,378,7682026"
    const year     = yrMatch ? yrMatch[1] : String(currentYear);
    // Population ends where the year starts — remove trailing year digits
    const popStr   = numPart.endsWith(year) ? numPart.slice(0, -4) : numPart;
    const value    = parseInt(popStr.replace(/,/g, ''));
    if (!isNaN(value) && value > 1_000_000) {
      rows.push({ fetched_date: today, year, month: '01', indicator_code: 'GSS_POPULATION', indicator_name: 'Projected Population', sector: 'demography', value, unit: 'persons', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_POPULATION ${year} → ${value.toLocaleString()}`, '  ✓');
    }
  }

  // ── Multidimensional Poverty Index ───────────────────────
  // Text: "MPIMultidimensional Poverty21.9%GSS · Q3 2025..."
  const mpiCard = cards.find(c => /Poverty/i.test(c.text) && /\d+\.?\d*\s*%/.test(c.text));
  if (mpiCard) {
    const valMatch = mpiCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const qyrMatch = mpiCard.text.match(/Q(\d)\s+(\d{4})/);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = qyrMatch ? qyrMatch[2] : currentYear;
      const month = qyrMatch ? String(parseInt(qyrMatch[1]) * 3).padStart(2,'0') : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_MPI', indicator_name: 'Multidimensional Poverty Index (%)', sector: 'welfare', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_MPI ${year} → ${value}%`, '  ✓');
    }
  }

  // ── Food Insecurity ───────────────────────────────────────
  // Text: "FOODFood Insecurity38.1%GSS · Q3 2025+2.8 ppvs Q1 2024"
  const foodCard = cards.find(c => /Food Insecurity/i.test(c.text));
  if (foodCard) {
    const valMatch = foodCard.text.match(/([0-9]+\.?[0-9]*)\s*%/);
    const qyrMatch = foodCard.text.match(/Q(\d)\s+(\d{4})/);
    if (valMatch) {
      const value = parseFloat(valMatch[1]);
      const year  = qyrMatch ? qyrMatch[2] : currentYear;
      const month = qyrMatch ? String(parseInt(qyrMatch[1]) * 3).padStart(2,'0') : currentMonth;
      rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_FOOD_INSECURITY', indicator_name: 'Food Insecurity Rate (%)', sector: 'welfare', value, unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
      log(`GSS_FOOD_INSECURITY ${year} → ${value}%`, '  ✓');
    }
  }

  return rows;
}

// ── SCRAPE INDIVIDUAL RELEASE PAGES ──────────────────────────
// Check the highlights and latest press releases for detailed CPI breakdown
async function scrapeLatestReleases(today) {
  log('Checking GSS release pages for CPI breakdown…', '▶');
  const rows = [];

  const releasePaths = [
    '/highlights/annual-inflation-report-2025',
    '/news-and-events/press-releases',
    '/data-statistics/economic-statistics',
  ];

  for (const path of releasePaths) {
    try {
      const url = GSS_HOME + path;
      const resp = await axios.get(url, { headers: HTTP_HEADERS, timeout: 15000 });
      const $ = cheerio.load(resp.data);
      const text = $('body').text().replace(/\s+/g, ' ');

      const now = new Date();
      const year  = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      // Headline inflation
      const hlMatch = text.match(/headline inflation[^0-9]*([0-9]+\.?[0-9]*)\s*(?:per\s*cent|%)/i);
      if (hlMatch && !rows.find(r => r.indicator_code === 'GSS_CPI_INFLATION')) {
        rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_CPI_INFLATION', indicator_name: 'CPI Headline Inflation YoY (%)', sector: 'economy', value: parseFloat(hlMatch[1]), unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
        log(`GSS_CPI_INFLATION (release) → ${hlMatch[1]}%`, '  ✓');
      }

      // Food inflation
      const foodInfMatch = text.match(/food inflation[^0-9]*([0-9]+\.?[0-9]*)\s*%/i);
      if (foodInfMatch && !rows.find(r => r.indicator_code === 'GSS_FOOD_INFLATION')) {
        rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_FOOD_INFLATION', indicator_name: 'Food Inflation YoY (%)', sector: 'economy', value: parseFloat(foodInfMatch[1]), unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
        log(`GSS_FOOD_INFLATION (release) → ${foodInfMatch[1]}%`, '  ✓');
      }

      // Non-food inflation
      const nonfoodMatch = text.match(/non.food inflation[^0-9]*([0-9]+\.?[0-9]*)\s*%/i);
      if (nonfoodMatch && !rows.find(r => r.indicator_code === 'GSS_NONFOOD_INFLATION')) {
        rows.push({ fetched_date: today, year, month, indicator_code: 'GSS_NONFOOD_INFLATION', indicator_name: 'Non-Food Inflation YoY (%)', sector: 'economy', value: parseFloat(nonfoodMatch[1]), unit: '%', source: 'SG Datalytics Economic Survey', collection_method: 'statsghana.gov.gh' });
        log(`GSS_NONFOOD_INFLATION (release) → ${nonfoodMatch[1]}%`, '  ✓');
      }

    } catch (err) {
      log(`  ${path}: ${err.message}`, '  –');
    }
  }

  return rows;
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Ghana Statistical Service Collector        ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  ensureDirs();
  const today      = getDateStr();
  const monthStr   = getMonthStr();
  const rawFile    = getRawPath('economic', `gss_${monthStr}.csv`);
  const masterFile = getMasterPath('economic_indicators.csv');

  const cardRows    = await scrapeHomepageCards(today);
  const releaseRows = await scrapeLatestReleases(today);

  // Merge — prefer homepage cards, supplement with release page data
  const allRows = [...cardRows];
  for (const r of releaseRows) {
    if (!allRows.find(a => a.indicator_code === r.indicator_code)) {
      allRows.push(r);
    }
  }

  if (allRows.length) {
    appendCsv(rawFile, EI_HEADERS, allRows);
    log(`Raw file → ${rawFile} (${allRows.length} rows)`, '💾');

    const saved = appendNewToMaster(
      masterFile, EI_HEADERS, allRows,
      ['indicator_code', 'year', 'month']
    );
    log(`Master file → ${saved} new rows added`, '📦');

    // ── Write to Neon ───────────────────────────────────────
    let neonInserted = 0;
    try {
      const { inserted, errors } = await insertRows('economic_indicators', allRows);
      if (errors.length) log(`Neon warnings: ${errors.join('; ')}`, '⚠');
      neonInserted = inserted;
      log(`Neon economic_indicators → ${inserted} rows inserted`, '🐘');
    } catch (err) {
      log(`Neon insert failed (${err.message}) — fallback Excel`, '⚠');
      await writeFallbackExcel('economic_indicators_gss', allRows, EI_HEADERS);
    }
    await closeAllPools();

    log(`GSS complete — ${allRows.length} indicators · ${saved} CSV · ${neonInserted} Neon`, '📊');
    return { total: allRows.length, saved, neon: neonInserted };
  } else {
    log('GSS: no data extracted (homepage may have changed structure)', '⚠');
    return { total: 0, saved: 0, neon: 0 };
  }
}

// ── Optional: export to Excel (call separately when needed) ──
async function exportToExcel(rows = []) {
  if (!rows.length) return log('exportToExcel: no rows provided', '⚠');
  await writeFallbackExcel('economic_indicators_gss', rows, EI_HEADERS);
}

if (require.main === module) {
  run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { run, exportToExcel };
