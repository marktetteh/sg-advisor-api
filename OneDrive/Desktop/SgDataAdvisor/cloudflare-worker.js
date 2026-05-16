/**
 * SG Data Advisor — Cloudflare Worker
 * Paste this entire file into the Cloudflare Worker editor
 * Set environment variable: GOOGLE_API_KEY = your key
 */

const DATASETS = [
  { id: "bog_inflation",   name: "Bank of Ghana – Inflation & CPI Data",                    sector: "Economy / Macroeconomics",        bestFor: ["inflation research","macroeconomic analysis","thesis on inflation","pricing studies"],      methods: ["Time series analysis","ARIMA forecasting","VAR models","Regression"] },
  { id: "bog_exchange",    name: "Bank of Ghana – Exchange Rate Data",                       sector: "Economy / Finance",               bestFor: ["exchange rate research","forex studies","depreciation analysis","trade research"],           methods: ["Time series","VAR models","GARCH models","Cointegration analysis"] },
  { id: "bog_interest",    name: "Bank of Ghana – Interest Rate Data",                       sector: "Economy / Finance",               bestFor: ["monetary policy research","banking analysis","credit access","SME financing"],              methods: ["Time series","Regression","Panel data","Cointegration"] },
  { id: "gss_sme",         name: "Ghana Statistical Service – SME Performance Data",         sector: "SMEs / Business",                 bestFor: ["SME research","K-means clustering","market segmentation","DSS research"],                   methods: ["K-means clustering","Logistic regression","Decision trees","PCA"] },
  { id: "gss_population",  name: "Ghana Statistical Service – Population & Housing Census",  sector: "Demographics",                    bestFor: ["demographic research","urban planning","public health","poverty mapping"],                   methods: ["Spatial analysis","Descriptive statistics","Regression","GIS mapping"] },
  { id: "gss_agriculture", name: "Ghana Statistical Service – Agriculture Survey Data",      sector: "Agriculture",                     bestFor: ["agriculture research","food security","crop yield forecasting","rural development"],         methods: ["Regression","K-means clustering","Time series","ANOVA"] },
  { id: "gss_education",   name: "Ghana Statistical Service – Education Statistics",         sector: "Education",                       bestFor: ["education policy","gender and education","AI in education","learning outcomes"],             methods: ["Regression","Chi-square tests","Panel data","Logistic regression"] },
  { id: "wb_ghana",        name: "World Bank – Ghana Development Indicators",                sector: "Economy / Development",           bestFor: ["macroeconomic research","development economics","poverty analysis","FDI studies"],           methods: ["Regression","Time series","Comparative analysis","VAR models"] },
  { id: "sgmpi",           name: "SG Market Price Index (SGMPI)",                            sector: "Pricing / Market Intelligence",   bestFor: ["retail pricing","commodity pricing","business pricing strategy","SME pricing"],            methods: ["Price elasticity","Time series","Benchmarking","Regression"] },
  { id: "health_ghana",    name: "Ghana Health Service – Health Statistics",                 sector: "Health",                          bestFor: ["public health research","healthcare access","disease burden","maternal health"],             methods: ["Regression","Survival analysis","Descriptive analytics","GIS mapping"] },
  { id: "sustainability",  name: "Ghana Environmental & Sustainability Data",                sector: "Sustainability / Environment",    bestFor: ["sustainability research","climate change","ESG analysis","SDG research"],                   methods: ["Time series","Regression","Correlation analysis","Scenario modelling"] },
];

function buildCatalog() {
  return DATASETS.map(d =>
    `[${d.id}] ${d.name} | Sector: ${d.sector}\n  Best for: ${d.bestFor.join(", ")}\n  Methods: ${d.methods.join(", ")}\n  Buy: https://sgdatalytics.org/marketplace.html`
  ).join("\n\n");
}

const SYSTEM_PROMPT = `You are SG Data Advisor, an expert AI research and data consultant for SG Datalytics (https://sgdatalytics.org).
SG Datalytics is a Ghana-based data analytics company providing curated Ghana datasets and analytics services.

AVAILABLE GHANA DATASETS:
${buildCatalog()}

YOUR JOB:
1. Understand the user's research topic or business problem.
2. Recommend the most relevant dataset(s) — mention the dataset ID in brackets like [bog_inflation].
3. Suggest 2-3 appropriate analysis methods.
4. Suggest 2-3 sample research objectives.
5. Always end by directing them to: https://sgdatalytics.org/marketplace.html

RULES:
- Only recommend datasets from the catalog above.
- Be warm, professional, and concise (under 400 words).
- If unclear, ask ONE focused follow-up question.
- Always mention dataset IDs in square brackets.`;

function extractDatasets(text) {
  return DATASETS.filter(d => text.includes(`[${d.id}]`)).map(d => ({
    id: d.id, name: d.name, sector: d.sector,
    description: `Best for: ${d.bestFor.slice(0, 3).join(", ")}`,
    suggested_methods: d.methods,
    marketplace_link: "https://sgdatalytics.org/marketplace.html",
  }));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
    }

    const { messages = [], api_key = "" } = body;
    const apiKey = api_key || env.GOOGLE_API_KEY || "";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No Google API key. Set GOOGLE_API_KEY in Cloudflare Worker environment variables." }),
        { status: 401, headers: CORS }
      );
    }

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const model = env.GOOGLE_MODEL || "gemma-4-31b-it";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: `Google API error: ${errText.slice(0, 300)}` }),
          { status: response.status, headers: CORS }
        );
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I could not generate a response.";
      const datasets_found = extractDatasets(reply);

      return new Response(
        JSON.stringify({ reply, datasets_found, tool_calls: [] }),
        { status: 200, headers: CORS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Worker error: ${err.message}` }),
        { status: 500, headers: CORS }
      );
    }
  },
};
