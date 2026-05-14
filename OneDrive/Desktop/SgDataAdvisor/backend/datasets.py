"""
datasets.py — SG Datalytics dataset knowledge base
All datasets the Claude agent can search and retrieve.
"""

DATASETS = [
    {
        "id": "bog_inflation",
        "name": "Bank of Ghana – Inflation & CPI Data",
        "source": "Bank of Ghana (BoG)",
        "sector": "Economy / Macroeconomics",
        "description": (
            "Monthly Consumer Price Index (CPI) and inflation rate data for Ghana. "
            "Covers headline inflation, food inflation, and non-food inflation from 2000 to present."
        ),
        "key_variables": ["CPI", "headline inflation", "food inflation", "non-food inflation", "monthly rate"],
        "best_for": [
            "inflation research", "macroeconomic analysis", "thesis on inflation",
            "cost of living studies", "pricing studies", "monetary policy"
        ],
        "suggested_methods": ["Time series analysis", "ARIMA forecasting", "VAR models", "Regression analysis"],
        "sample_objectives": [
            "To analyse the trend and determinants of inflation in Ghana from 2010–2024",
            "To examine the relationship between money supply and inflation in Ghana",
            "To forecast Ghana's inflation rate using ARIMA modelling",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "bog_exchange",
        "name": "Bank of Ghana – Exchange Rate Data",
        "source": "Bank of Ghana (BoG)",
        "sector": "Economy / Finance",
        "description": (
            "Daily and monthly Ghana Cedi (GHS) exchange rates against USD, GBP, EUR, and other currencies. "
            "Includes buying and selling rates from commercial banks."
        ),
        "key_variables": ["GHS/USD", "GHS/GBP", "GHS/EUR", "buying rate", "selling rate", "interbank rate"],
        "best_for": [
            "exchange rate research", "import/export analysis", "forex studies",
            "currency depreciation analysis", "trade research", "FDI studies"
        ],
        "suggested_methods": ["Time series analysis", "VAR models", "GARCH models", "Cointegration analysis"],
        "sample_objectives": [
            "To examine the impact of exchange rate depreciation on import prices in Ghana",
            "To analyse the volatility of the Ghana Cedi against the US Dollar",
            "To assess the relationship between exchange rate and inflation in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "bog_interest",
        "name": "Bank of Ghana – Interest Rate Data",
        "source": "Bank of Ghana (BoG)",
        "sector": "Economy / Finance",
        "description": (
            "Monetary Policy Rate (MPR), prime rate, lending rates, deposit rates, and Treasury bill rates "
            "from Ghanaian commercial banks and the Bank of Ghana."
        ),
        "key_variables": ["MPR", "lending rate", "deposit rate", "91-day T-bill", "182-day T-bill", "prime rate"],
        "best_for": [
            "monetary policy research", "banking sector analysis", "credit access studies",
            "investment research", "SME financing studies"
        ],
        "suggested_methods": ["Time series analysis", "Regression", "Panel data analysis", "Cointegration"],
        "sample_objectives": [
            "To examine the effect of monetary policy rate on lending rates in Ghana",
            "To analyse the transmission of monetary policy to the real economy in Ghana",
            "To assess the impact of interest rates on SME credit access in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "gss_sme",
        "name": "Ghana Statistical Service – SME Performance Data",
        "source": "Ghana Statistical Service (GSS)",
        "sector": "SMEs / Business",
        "description": (
            "Survey data on small and medium enterprise performance in Ghana. "
            "Covers revenue, employment, sector distribution, business age, location, and challenges."
        ),
        "key_variables": ["revenue", "employment size", "sector", "firm age", "location", "access to credit", "challenges"],
        "best_for": [
            "SME research", "entrepreneurship studies", "business strategy",
            "K-means clustering", "market segmentation", "DSS research", "SME financing"
        ],
        "suggested_methods": ["K-means clustering", "Logistic regression", "Decision trees", "Descriptive analytics", "PCA"],
        "sample_objectives": [
            "To segment SMEs in Ghana by performance using K-means clustering",
            "To identify the key factors influencing SME growth in Ghana",
            "To develop a decision support system for SME performance prediction in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "gss_population",
        "name": "Ghana Statistical Service – Population & Housing Census",
        "source": "Ghana Statistical Service (GSS)",
        "sector": "Demographics",
        "description": (
            "Population distribution, household data, urbanisation, and demographic indicators "
            "across Ghana's 16 regions. Based on the 2021 Population and Housing Census."
        ),
        "key_variables": ["population", "household size", "region", "urban/rural split", "age group", "gender", "housing type"],
        "best_for": [
            "demographic research", "urban planning", "public health",
            "education access studies", "poverty mapping", "regional equity"
        ],
        "suggested_methods": ["Spatial analysis", "Descriptive statistics", "Regression", "GIS mapping", "Chi-square tests"],
        "sample_objectives": [
            "To analyse the spatial distribution of population across Ghana's regions",
            "To examine the relationship between urbanisation and access to basic services in Ghana",
            "To assess demographic trends and their implications for education planning in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "gss_agriculture",
        "name": "Ghana Statistical Service – Agriculture Survey Data",
        "source": "Ghana Statistical Service (GSS)",
        "sector": "Agriculture",
        "description": (
            "Data on crop production, farm sizes, agricultural inputs, yields, and farmer demographics "
            "across Ghana's regions. Based on the Ghana Living Standards Survey (GLSS) agriculture module."
        ),
        "key_variables": ["crop type", "yield", "farm size (hectares)", "region", "inputs used", "farmer age", "rainfall"],
        "best_for": [
            "agriculture research", "food security studies", "crop yield forecasting",
            "farmer segmentation", "agricultural policy", "rural development"
        ],
        "suggested_methods": ["Regression", "K-means clustering", "Time series", "ANOVA", "Random forest"],
        "sample_objectives": [
            "To analyse the determinants of crop yield among smallholder farmers in Ghana",
            "To segment farmers in Ghana by productivity using K-means clustering",
            "To examine the impact of agricultural inputs on food security in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "gss_education",
        "name": "Ghana Statistical Service – Education Statistics",
        "source": "Ghana Statistical Service (GSS)",
        "sector": "Education",
        "description": (
            "Enrolment rates, literacy levels, dropout rates, school infrastructure, and teacher-pupil ratios "
            "across Ghana's regions and school levels (primary, JHS, SHS, tertiary)."
        ),
        "key_variables": ["enrolment rate", "literacy rate", "dropout rate", "region", "gender", "school type", "teacher-pupil ratio"],
        "best_for": [
            "education policy research", "gender and education", "regional equity studies",
            "AI in education", "learning outcomes", "educational access"
        ],
        "suggested_methods": ["Regression", "Descriptive analytics", "Chi-square tests", "Panel data", "Logistic regression"],
        "sample_objectives": [
            "To examine gender disparities in secondary school enrolment across Ghana's regions",
            "To analyse the determinants of school dropout in rural Ghana",
            "To assess the impact of teacher-pupil ratio on learning outcomes in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "wb_ghana",
        "name": "World Bank – Ghana Development Indicators",
        "source": "World Bank",
        "sector": "Economy / Development",
        "description": (
            "Key development indicators for Ghana including GDP, GDP per capita, poverty rate, "
            "FDI inflows, trade balance, and human development metrics from 1990 to present."
        ),
        "key_variables": ["GDP", "GDP per capita", "poverty rate", "FDI", "trade balance", "unemployment", "HDI"],
        "best_for": [
            "macroeconomic research", "development economics", "poverty analysis",
            "comparative country studies", "economic growth research", "FDI determinants"
        ],
        "suggested_methods": ["Regression", "Time series", "Comparative analysis", "VAR models", "Cointegration"],
        "sample_objectives": [
            "To analyse the determinants of economic growth in Ghana from 1990–2024",
            "To examine the relationship between FDI and GDP growth in Ghana",
            "To assess the impact of trade openness on poverty reduction in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "sgmpi",
        "name": "SG Market Price Index (SGMPI)",
        "source": "SG Datalytics (Proprietary)",
        "sector": "Pricing / Market Intelligence",
        "description": (
            "SG Datalytics' proprietary market price index tracking commodity and consumer good prices "
            "across Ghanaian markets. Updated regularly. Unique dataset not available elsewhere."
        ),
        "key_variables": ["market price", "commodity type", "region", "price change %", "date", "market location"],
        "best_for": [
            "retail pricing strategy", "commodity price tracking", "business pricing decisions",
            "SME market intelligence", "inflation cross-validation", "procurement planning"
        ],
        "suggested_methods": ["Price elasticity analysis", "Time series", "Benchmarking", "Regression", "Dashboard analytics"],
        "sample_objectives": [
            "To track and forecast commodity price trends in Ghanaian markets using SGMPI",
            "To assess regional price disparities for key consumer goods in Ghana",
            "To develop a pricing decision support tool for SMEs using SGMPI data",
        ],
        "price": "See marketplace",
        "bundle": "SGMPI Standalone or Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "health_ghana",
        "name": "Ghana Health Service – Health Statistics",
        "source": "Ghana Health Service / GSS",
        "sector": "Health",
        "description": (
            "Health indicators including disease prevalence, maternal mortality, child mortality, "
            "health facility access, and immunisation rates across Ghana's regions."
        ),
        "key_variables": ["disease rate", "maternal mortality ratio", "under-5 mortality", "health facility density", "immunisation rate", "region"],
        "best_for": [
            "public health research", "healthcare access studies", "disease burden analysis",
            "maternal health", "child health", "health equity"
        ],
        "suggested_methods": ["Regression", "Survival analysis", "Descriptive analytics", "GIS mapping", "Logistic regression"],
        "sample_objectives": [
            "To examine the determinants of maternal mortality across Ghana's regions",
            "To assess equity in healthcare access between urban and rural Ghana",
            "To analyse the impact of immunisation rates on child mortality in Ghana",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
    {
        "id": "sustainability",
        "name": "Ghana Environmental & Sustainability Data",
        "source": "EPA Ghana / World Bank",
        "sector": "Sustainability / Environment",
        "description": (
            "Environmental indicators for Ghana: CO2 emissions, deforestation rates, "
            "renewable energy access, water quality, and sanitation coverage."
        ),
        "key_variables": ["CO2 emissions", "deforestation rate", "renewable energy %", "water access", "sanitation coverage"],
        "best_for": [
            "sustainability research", "climate change studies", "ESG analysis",
            "green business", "environmental policy", "SDG research"
        ],
        "suggested_methods": ["Time series", "Regression", "Correlation analysis", "Scenario modelling", "Decomposition analysis"],
        "sample_objectives": [
            "To analyse trends in CO2 emissions and their relationship to economic growth in Ghana",
            "To examine the impact of deforestation on agricultural productivity in Ghana",
            "To assess Ghana's progress toward SDG 7 (clean energy) and SDG 13 (climate action)",
        ],
        "price": "See marketplace",
        "bundle": "Ghana Data Full Bundle",
        "marketplace_link": "https://sgdatalytics.org/marketplace.html",
    },
]


# ── Helper functions used by the Claude agent tools ──────────────────────────

def search_datasets(query: str, sector: str = None) -> list[dict]:
    """Search datasets by keyword and optionally filter by sector."""
    query_lower = query.lower()
    results = []
    for d in DATASETS:
        score = 0
        searchable = " ".join([
            d["name"], d["description"], d["sector"],
            " ".join(d["best_for"]), " ".join(d["key_variables"])
        ]).lower()
        for word in query_lower.split():
            if word in searchable:
                score += 1
        if sector and sector.lower() in d["sector"].lower():
            score += 3
        if score > 0:
            results.append({"score": score, "dataset": d})
    results.sort(key=lambda x: x["score"], reverse=True)
    return [r["dataset"] for r in results[:4]]  # top 4


def get_dataset_by_id(dataset_id: str) -> dict | None:
    """Return a single dataset by its ID."""
    for d in DATASETS:
        if d["id"] == dataset_id:
            return d
    return None


def list_all_sectors() -> list[str]:
    """Return unique sectors."""
    return list({d["sector"] for d in DATASETS})


def recommend_methods(dataset_ids: list[str], goal: str) -> list[str]:
    """Return deduplicated suggested methods for a set of datasets."""
    methods = set()
    for did in dataset_ids:
        d = get_dataset_by_id(did)
        if d:
            methods.update(d["suggested_methods"])
    return sorted(methods)
