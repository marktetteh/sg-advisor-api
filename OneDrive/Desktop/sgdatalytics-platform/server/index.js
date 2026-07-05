require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 4001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));   // open CORS for local dev
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api', require('./routes/indicators'));       // stats, sectors, indicators, exchange-rates
app.use('/api/commodities', require('./routes/commodities'));
app.use('/api/market',      require('./routes/market'));
app.use('/admin',           require('./routes/admin'));  // protected admin jobs

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'SG Datalytics', version: '2.0.0', storage: 'CSV', ts: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.path}` }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 SG Datalytics API → http://localhost:${PORT}`);
  console.log(`\n  📋 Endpoints:`);
  console.log(`     GET /api/health`);
  console.log(`     GET /api/stats                          platform summary + file sizes`);
  console.log(`     GET /api/sectors                        all data sectors`);
  console.log(`     GET /api/indicators                     all indicators  ?sector=economy&source=IMF`);
  console.log(`     GET /api/indicators/:code               time series     ?from=2000&to=2025`);
  console.log(`     GET /api/exchange-rates                 latest GHS/USD, GHS/GBP ...`);
  console.log(`     GET /api/commodities                    commodity prices`);
  console.log(`     GET /api/commodities/categories         commodity categories`);
  console.log(`     GET /api/commodities/:code              price history for one commodity`);
  console.log(`     GET /api/commodities/fuel/latest        latest fuel prices`);
  console.log(`     GET /api/market/summary                 latest week stats per product`);
  console.log(`     GET /api/market/weekly?label=iPhone     price trend over time`);
  console.log(`     GET /api/market/categories              product categories`);
  console.log(`     GET /api/market/products                all product labels`);
  console.log(`     GET /api/market/data                    paginated listings  ?search=&category=`);
  console.log(`     GET /api/market/export                  download CSV`);
  console.log(`     GET /api/market/stocks                  GSE stock prices`);
  console.log(`     GET /api/market/indices                 GSE-CI / GSE-FSI\n`);
});
