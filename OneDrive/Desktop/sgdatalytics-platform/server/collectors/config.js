/**
 * SG DATALYTICS — Master Configuration
 * All indicators, products and commodities defined here.
 * To add a new product: just add one object to the right array.
 */

// ── SECTORS ───────────────────────────────────────────────────
const SECTORS = [
  { code: 'economy',     name: 'Economy & Finance',     icon: '💹', color: '#a78bfa', description: 'GDP, inflation, trade, debt and fiscal data' },
  { code: 'monetary',    name: 'Monetary & Banking',    icon: '🏦', color: '#60a5fa', description: 'Exchange rates, interest rates, money supply' },
  { code: 'trade',       name: 'Trade & Investment',    icon: '🌐', color: '#34d399', description: 'Exports, imports, FDI, current account' },
  { code: 'social',      name: 'Social & Demographics', icon: '👥', color: '#f87171', description: 'Population, poverty, employment, health' },
  { code: 'agriculture', name: 'Agriculture',           icon: '🌾', color: '#fbbf24', description: 'Farming, food prices, land use, yields' },
  { code: 'environment', name: 'Environment & Energy',  icon: '🌿', color: '#10b981', description: 'Electricity access, CO2, renewables' },
  { code: 'market',      name: 'Market Prices',         icon: '🛒', color: '#f59e0b', description: 'Consumer goods prices from online marketplaces' },
  { code: 'realestate', name: 'Real Estate & Rentals', icon: '🏠', color: '#8b5cf6', description: 'Residential & commercial rental prices across Ghana' },
  { code: 'hospitality',name: 'Hospitality & Hotels',  icon: '🏨', color: '#ec4899', description: 'Hotel room rates across Ghana major cities' },
];

// ── WORLD BANK / BOG / GSS INDICATORS ────────────────────────
const INDICATORS = [
  { code: 'WB_GDP_USD',       name: 'GDP (current US$)',                        unit: 'USD',      fmt: 'B',   sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'NY.GDP.MKTP.CD' },
  { code: 'WB_GDP_GROWTH',    name: 'GDP Growth Rate (%)',                      unit: '%',        fmt: 'pct', sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'NY.GDP.MKTP.KD.ZG' },
  { code: 'WB_GDP_CAPITA',    name: 'GDP per Capita (USD)',                     unit: 'USD',      fmt: 'num', sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'NY.GDP.PCAP.CD' },
  { code: 'WB_INFLATION',     name: 'Inflation, Consumer Prices (%)',           unit: '%',        fmt: 'pct', sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'FP.CPI.TOTL.ZG' },
  { code: 'WB_GOVT_DEBT',     name: 'Government Debt (% of GDP)',               unit: '%',        fmt: 'pct', sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'GC.DOD.TOTL.GD.ZS' },
  { code: 'WB_TAX_REVENUE',   name: 'Tax Revenue (% of GDP)',                   unit: '%',        fmt: 'pct', sector: 'economy',     source: 'World Bank',    frequency: 'annual',  wb_code: 'GC.TAX.TOTL.GD.ZS' },
  { code: 'WB_EXPORTS',       name: 'Exports of Goods & Services (% of GDP)',   unit: '%',        fmt: 'pct', sector: 'trade',       source: 'World Bank',    frequency: 'annual',  wb_code: 'NE.EXP.GNFS.ZS' },
  { code: 'WB_IMPORTS',       name: 'Imports of Goods & Services (% of GDP)',   unit: '%',        fmt: 'pct', sector: 'trade',       source: 'World Bank',    frequency: 'annual',  wb_code: 'NE.IMP.GNFS.ZS' },
  { code: 'WB_FDI',           name: 'Foreign Direct Investment (% of GDP)',     unit: '%',        fmt: 'pct', sector: 'trade',       source: 'World Bank',    frequency: 'annual',  wb_code: 'BX.KLT.DINV.WD.GD.ZS' },
  { code: 'WB_POPULATION',    name: 'Total Population',                         unit: 'people',   fmt: 'M',   sector: 'social',      source: 'World Bank',    frequency: 'annual',  wb_code: 'SP.POP.TOTL' },
  { code: 'WB_UNEMPLOYMENT',  name: 'Unemployment Rate (% of labor force)',     unit: '%',        fmt: 'pct', sector: 'social',      source: 'World Bank',    frequency: 'annual',  wb_code: 'SL.UEM.TOTL.ZS' },
  { code: 'WB_ELECTRICITY',   name: 'Access to Electricity (% of population)', unit: '%',        fmt: 'pct', sector: 'environment', source: 'World Bank',    frequency: 'annual',  wb_code: 'EG.ELC.ACCS.ZS' },
  { code: 'BOG_MPR',          name: 'Monetary Policy Rate (%)',                 unit: '%',        fmt: 'pct', sector: 'monetary',    source: 'Bank of Ghana', frequency: 'monthly' },
  { code: 'BOG_TBILL_91',     name: '91-Day Treasury Bill Rate (%)',            unit: '%',        fmt: 'pct', sector: 'monetary',    source: 'Bank of Ghana', frequency: 'monthly' },
  { code: 'BOG_TBILL_182',    name: '182-Day Treasury Bill Rate (%)',           unit: '%',        fmt: 'pct', sector: 'monetary',    source: 'Bank of Ghana', frequency: 'monthly' },
  { code: 'BOG_TBILL_364',    name: '364-Day Treasury Bill Rate (%)',           unit: '%',        fmt: 'pct', sector: 'monetary',    source: 'Bank of Ghana', frequency: 'monthly' },
  { code: 'BOG_LENDING_RATE', name: 'Average Lending Rate (%)',                 unit: '%',        fmt: 'pct', sector: 'monetary',    source: 'Bank of Ghana', frequency: 'monthly' },
  { code: 'GSS_CPI_INFLATION',name: 'CPI Headline Inflation — GSS (%)',         unit: '%',        fmt: 'pct', sector: 'economy',     source: 'GSS',           frequency: 'monthly' },
  { code: 'GSS_GDP_GROWTH_ANNUAL', name: 'GDP Growth Rate — GSS (%)',          unit: '%',        fmt: 'pct', sector: 'economy',     source: 'GSS',           frequency: 'annual' },
  { code: 'GSS_POPULATION',   name: 'Total Population — GSS',                  unit: 'people',   fmt: 'M',   sector: 'social',      source: 'GSS',           frequency: 'annual' },
  { code: 'GSS_UNEMPLOYMENT', name: 'Unemployment Rate — GSS (%)',             unit: '%',        fmt: 'pct', sector: 'social',      source: 'GSS',           frequency: 'annual' },
];

// ── MELCOM CATEGORIES TO SCRAPE ───────────────────────────────
// Maps Melcom site URL paths → our standard categories
// Melcom uses Magento 2 GraphQL API (melcom.com/graphql).
// categoryId  — Magento category ID used in the products(filter:{category_id:{eq:"<id>"}}) query
// category    — maps to product_category in market_prices table (matches Jiji categories)
// label       — human-readable display name for this category
const MELCOM_CATEGORIES = [
  // ── Electronics ──────────────────────────────────────────────
  { categoryId: '1279', category: 'Electronics',      label: 'Smart Phones',              group: 'Smartphone'           },
  { categoryId: '1285', category: 'Electronics',      label: 'Computers & Accessories',   group: 'Laptop'               },
  { categoryId: '1290', category: 'Electronics',      label: 'Television & Audio',         group: 'Television'           },
  // ── Appliances ───────────────────────────────────────────────
  { categoryId: '1313', category: 'Appliances',       label: 'Kitchen Appliances',         group: 'Small Kitchen Appliance' },
  { categoryId: '1306', category: 'Appliances',       label: 'Air Conditioners',           group: 'Air Conditioner'      },
  { categoryId: '3213', category: 'Appliances',       label: 'Home Appliances',            group: 'Home Appliance'       },
  // ── Furniture ────────────────────────────────────────────────
  { categoryId: '1327', category: 'Furniture',        label: 'Living Room Furniture',      group: 'Living Room Furniture'},
  { categoryId: '1328', category: 'Furniture',        label: 'Bedroom Furniture',          group: 'Bedroom Furniture'    },
  // ── Food & FMCG ──────────────────────────────────────────────
  { categoryId: '1352', category: 'Food & FMCG',      label: 'Supermarket',                group: 'FMCG'                 },
  // ── Sports & Fitness ─────────────────────────────────────────
  { categoryId: '1383', category: 'Sports & Fitness', label: 'Sports & Fitness',           group: 'Sports & Fitness'     },
  // ── Home & Kitchen ───────────────────────────────────────────
  { categoryId: '1337', category: 'Home & Kitchen',   label: 'Home & Kitchen Essentials',  group: 'Home & Kitchen'       },
];

// ── MARKET PRODUCTS — Jiji.com.gh ────────────────────────────
// Trimmed to ~240 productive terms (≥10 listings confirmed in W21-2026)
// source: jiji  |  jijiPath: Jiji category URL path
const MARKET_PRODUCTS = [

  // ═══════════════════════════════════════════════════════════
  // ELECTRONICS & PHONES
  // ═══════════════════════════════════════════════════════════

  // iPhone
  { query: 'iphone 17',              label: 'iPhone 17',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 16 pro',          label: 'iPhone 16 Pro',          category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 16',              label: 'iPhone 16',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 15 pro',          label: 'iPhone 15 Pro',          category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 15',              label: 'iPhone 15',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 14',              label: 'iPhone 14',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 13',              label: 'iPhone 13',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 12',              label: 'iPhone 12',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 11',              label: 'iPhone 11',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Samsung Flagship
  { query: 'samsung s25 ultra',      label: 'Samsung S25 Ultra',      category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s25',            label: 'Samsung S25',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s24',            label: 'Samsung S24',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s23',            label: 'Samsung S23',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s22',            label: 'Samsung S22',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Samsung A-Series
  { query: 'samsung a55',            label: 'Samsung A55',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a35',            label: 'Samsung A35',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a25',            label: 'Samsung A25',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a24',            label: 'Samsung A24',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a15',            label: 'Samsung A15',            category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Tecno
  { query: 'tecno camon 30',         label: 'Tecno Camon 30',         category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno spark 20',         label: 'Tecno Spark 20',         category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno phantom',          label: 'Tecno Phantom',          category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno pop',              label: 'Tecno Pop',              category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Infinix
  { query: 'infinix note 40',        label: 'Infinix Note 40',        category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'infinix smart',          label: 'Infinix Smart',          category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Other Phones
  { query: 'itel phone',             label: 'Itel Phone',             category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'xiaomi redmi',           label: 'Xiaomi Redmi',           category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'google pixel',           label: 'Google Pixel',           category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'motorola moto g',        label: 'Motorola Moto G',        category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'oppo reno 10',           label: 'Oppo Reno 10',           category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },
  { query: 'oneplus 12',             label: 'OnePlus 12',             category: 'Electronics', group: 'Smartphone',          jijiPath: '/mobile-phones-tablets' },

  // Tablets
  { query: 'ipad',                   label: 'iPad',                   category: 'Electronics', group: 'Tablet',              jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung tablet',         label: 'Samsung Tablet',         category: 'Electronics', group: 'Tablet',              jijiPath: '/mobile-phones-tablets' },

  // Laptops & Computers
  { query: 'hp laptop',              label: 'HP Laptop',              category: 'Electronics', group: 'Laptop',              jijiPath: '/computers' },
  { query: 'dell laptop',            label: 'Dell Laptop',            category: 'Electronics', group: 'Laptop',              jijiPath: '/computers' },
  { query: 'lenovo laptop',          label: 'Lenovo Laptop',          category: 'Electronics', group: 'Laptop',              jijiPath: '/computers' },
  { query: 'macbook',                label: 'MacBook',                category: 'Electronics', group: 'Laptop',              jijiPath: '/computers' },
  { query: 'asus laptop',            label: 'Asus Laptop',            category: 'Electronics', group: 'Laptop',              jijiPath: '/computers' },
  { query: 'desktop computer',       label: 'Desktop Computer',       category: 'Electronics', group: 'Desktop Computer',    jijiPath: '/computers' },

  // TVs
  { query: 'samsung smart tv',       label: 'Samsung Smart TV',       category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'lg smart tv',            label: 'LG Smart TV',            category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'hisense tv',             label: 'Hisense TV',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'tcl tv',                 label: 'TCL TV',                 category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'nasco tv',               label: 'Nasco TV',               category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'sharp tv',               label: 'Sharp TV',               category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'sony bravia tv',         label: 'Sony Bravia TV',         category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: 'oled tv',                label: 'OLED TV',                category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: '32 inch tv',             label: 'TV 32 inch',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: '43 inch tv',             label: 'TV 43 inch',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: '55 inch tv',             label: 'TV 55 inch',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: '65 inch tv',             label: 'TV 65 inch',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },
  { query: '75 inch tv',             label: 'TV 75 inch',             category: 'Electronics', group: 'Television',          jijiPath: '/electronics' },

  // Audio
  { query: 'soundbar',               label: 'Soundbar',               category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },
  { query: 'bluetooth speaker',      label: 'Bluetooth Speaker',      category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },
  { query: 'wireless earbuds',       label: 'Wireless Earbuds',       category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },
  { query: 'woofer subwoofer',       label: 'Woofer / Subwoofer',     category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },
  { query: 'over ear headphones',    label: 'Over-Ear Headphones',    category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },
  { query: 'home theater system',    label: 'Home Theater System',    category: 'Electronics', group: 'Audio Equipment',     jijiPath: '/electronics' },

  // Gaming
  { query: 'ps5 playstation 5',      label: 'PlayStation 5',          category: 'Electronics', group: 'Gaming Console',      jijiPath: '/electronics' },
  { query: 'ps4 playstation',        label: 'PlayStation 4',          category: 'Electronics', group: 'Gaming Console',      jijiPath: '/electronics' },
  { query: 'xbox',                   label: 'Xbox Console',           category: 'Electronics', group: 'Gaming Console',      jijiPath: '/electronics' },
  { query: 'nintendo switch',        label: 'Nintendo Switch',        category: 'Electronics', group: 'Gaming Console',      jijiPath: '/electronics' },
  { query: 'gaming headset',         label: 'Gaming Headset',         category: 'Electronics', group: 'Gaming Accessory',    jijiPath: '/electronics' },
  { query: 'gaming keyboard',        label: 'Gaming Keyboard',        category: 'Electronics', group: 'Gaming Accessory',    jijiPath: '/electronics' },
  { query: 'gaming mouse',           label: 'Gaming Mouse',           category: 'Electronics', group: 'Gaming Accessory',    jijiPath: '/electronics' },

  // Cameras
  { query: 'digital camera',         label: 'Digital Camera',         category: 'Electronics', group: 'Camera',              jijiPath: '/electronics' },
  { query: 'dslr camera',            label: 'DSLR Camera',            category: 'Electronics', group: 'Camera',              jijiPath: '/electronics' },
  { query: 'canon camera',           label: 'Canon Camera',           category: 'Electronics', group: 'Camera',              jijiPath: '/electronics' },
  { query: 'ip camera wifi',         label: 'IP Camera (WiFi)',        category: 'Electronics', group: 'Security Camera',     jijiPath: '/electronics' },

  // Monitors & Accessories
  { query: 'monitor 24 inch',        label: 'Monitor 24 inch',        category: 'Electronics', group: 'Computer Monitor',    jijiPath: '/electronics' },
  { query: 'monitor 27 inch',        label: 'Monitor 27 inch',        category: 'Electronics', group: 'Computer Monitor',    jijiPath: '/electronics' },
  { query: 'smartwatch',             label: 'Smartwatch',             category: 'Electronics', group: 'Smartwatch',          jijiPath: '/electronics' },
  { query: 'wireless router',        label: 'WiFi Router',            category: 'Electronics', group: 'Networking Equipment',jijiPath: '/electronics' },
  { query: 'drone',                  label: 'Drone',                  category: 'Electronics', group: 'Drone',               jijiPath: '/electronics' },
  { query: 'projector',              label: 'Projector',              category: 'Electronics', group: 'Projector',           jijiPath: '/electronics' },

  // Power & Security
  { query: 'power bank',             label: 'Power Bank',             category: 'Electronics', group: 'Power Bank',          jijiPath: '/electronics' },
  { query: 'ups battery backup',     label: 'UPS Battery Backup',     category: 'Electronics', group: 'UPS',                 jijiPath: '/electronics' },
  { query: 'solar panel',            label: 'Solar Panel',            category: 'Electronics', group: 'Solar Equipment',     jijiPath: '/electronics' },
  { query: 'solar inverter',         label: 'Solar Inverter',         category: 'Electronics', group: 'Solar Equipment',     jijiPath: '/electronics' },
  { query: 'lithium solar battery',  label: 'Lithium Solar Battery',  category: 'Electronics', group: 'Solar Equipment',     jijiPath: '/electronics' },
  { query: 'inverter battery pack',  label: 'Inverter / Battery Pack',category: 'Electronics', group: 'Solar Equipment',     jijiPath: '/electronics' },
  { query: 'access control system',  label: 'Access Control System',  category: 'Electronics', group: 'Security System',     jijiPath: '/electronics' },
  { query: 'biometric device',       label: 'Biometric Device',       category: 'Electronics', group: 'Security System',     jijiPath: '/electronics' },
  { query: 'network switch 24 port', label: 'Network Switch 24-Port', category: 'Electronics', group: 'Networking Equipment',jijiPath: '/electronics' },

  // ═══════════════════════════════════════════════════════════
  // VEHICLES
  // ═══════════════════════════════════════════════════════════

  // Toyota
  { query: 'toyota corolla',            label: 'Toyota Corolla',            category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota camry',              label: 'Toyota Camry',              category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota land cruiser',       label: 'Toyota Land Cruiser',       category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota land cruiser prado', label: 'Toyota Land Cruiser Prado', category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota hilux',              label: 'Toyota Hilux',              category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota fortuner',           label: 'Toyota Fortuner',           category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota rav4',               label: 'Toyota RAV4',               category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota venza',              label: 'Toyota Venza',              category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota avensis',            label: 'Toyota Avensis',            category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota yaris',              label: 'Toyota Yaris',              category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota chr',                label: 'Toyota C-HR',               category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },
  { query: 'toyota rush',               label: 'Toyota Rush',               category: 'Vehicles', group: 'Toyota',   jijiPath: '/cars' },

  // Honda
  { query: 'honda civic',               label: 'Honda Civic',               category: 'Vehicles', group: 'Honda',    jijiPath: '/cars' },
  { query: 'honda accord',              label: 'Honda Accord',              category: 'Vehicles', group: 'Honda',    jijiPath: '/cars' },
  { query: 'honda crv',                 label: 'Honda CR-V',                category: 'Vehicles', group: 'Honda',    jijiPath: '/cars' },
  { query: 'honda hrv',                 label: 'Honda HR-V',                category: 'Vehicles', group: 'Honda',    jijiPath: '/cars' },

  // Hyundai
  { query: 'hyundai elantra',           label: 'Hyundai Elantra',           category: 'Vehicles', group: 'Hyundai',  jijiPath: '/cars' },
  { query: 'hyundai tucson',            label: 'Hyundai Tucson',            category: 'Vehicles', group: 'Hyundai',  jijiPath: '/cars' },
  { query: 'hyundai santa fe',          label: 'Hyundai Santa Fe',          category: 'Vehicles', group: 'Hyundai',  jijiPath: '/cars' },
  { query: 'hyundai h1 starex',         label: 'Hyundai H1 / Starex',       category: 'Vehicles', group: 'Hyundai',  jijiPath: '/cars' },

  // Kia
  { query: 'kia sorento',               label: 'Kia Sorento',               category: 'Vehicles', group: 'Kia',      jijiPath: '/cars' },
  { query: 'kia sportage',              label: 'Kia Sportage',              category: 'Vehicles', group: 'Kia',      jijiPath: '/cars' },
  { query: 'kia picanto',               label: 'Kia Picanto',               category: 'Vehicles', group: 'Kia',      jijiPath: '/cars' },

  // European
  { query: 'mercedes c class',          label: 'Mercedes C-Class',          category: 'Vehicles', group: 'Mercedes', jijiPath: '/cars' },
  { query: 'mercedes glc',              label: 'Mercedes GLC',              category: 'Vehicles', group: 'Mercedes', jijiPath: '/cars' },
  { query: 'bmw 3 series',              label: 'BMW 3 Series',              category: 'Vehicles', group: 'BMW',      jijiPath: '/cars' },
  { query: 'bmw x5',                    label: 'BMW X5',                    category: 'Vehicles', group: 'BMW',      jijiPath: '/cars' },
  { query: 'audi a4',                   label: 'Audi A4',                   category: 'Vehicles', group: 'Audi',     jijiPath: '/cars' },
  { query: 'audi q5',                   label: 'Audi Q5',                   category: 'Vehicles', group: 'Audi',     jijiPath: '/cars' },
  { query: 'peugeot 3008',              label: 'Peugeot 3008',              category: 'Vehicles', group: 'Peugeot',  jijiPath: '/cars' },
  { query: 'range rover',               label: 'Range Rover',               category: 'Vehicles', group: 'Land Rover', jijiPath: '/cars' },

  // American / Others
  { query: 'chevrolet cruze',           label: 'Chevrolet Cruze',           category: 'Vehicles', group: 'Chevrolet',jijiPath: '/cars' },
  { query: 'ford ranger',               label: 'Ford Ranger',               category: 'Vehicles', group: 'Ford',     jijiPath: '/cars' },
  { query: 'jeep grand cherokee',       label: 'Jeep Grand Cherokee',       category: 'Vehicles', group: 'Jeep',     jijiPath: '/cars' },
  { query: 'lexus rx',                  label: 'Lexus RX',                  category: 'Vehicles', group: 'Lexus',    jijiPath: '/cars' },

  // Mitsubishi / Nissan / Subaru / Others
  { query: 'mitsubishi l200',           label: 'Mitsubishi L200',           category: 'Vehicles', group: 'Mitsubishi',jijiPath: '/cars' },
  { query: 'mitsubishi pajero',         label: 'Mitsubishi Pajero',         category: 'Vehicles', group: 'Mitsubishi',jijiPath: '/cars' },
  { query: 'nissan navara',             label: 'Nissan Navara',             category: 'Vehicles', group: 'Nissan',   jijiPath: '/cars' },
  { query: 'nissan x-trail',            label: 'Nissan X-Trail',            category: 'Vehicles', group: 'Nissan',   jijiPath: '/cars' },
  { query: 'subaru forester',           label: 'Subaru Forester',           category: 'Vehicles', group: 'Subaru',   jijiPath: '/cars' },
  { query: 'mg zs',                     label: 'MG ZS',                     category: 'Vehicles', group: 'MG',       jijiPath: '/cars' },
  { query: 'electric car ev',           label: 'Electric Car (EV)',         category: 'Vehicles', group: 'Electric Vehicle', jijiPath: '/cars' },
  { query: 'pickup truck',              label: 'Pickup Truck',              category: 'Vehicles', group: 'Pickup Truck', jijiPath: '/cars' },

  // ═══════════════════════════════════════════════════════════
  // VEHICLE PARTS
  // ═══════════════════════════════════════════════════════════

  { query: 'air filter car',         label: 'Air Filter',             category: 'Vehicle Parts', group: 'Engine Filter',        jijiPath: '/vehicle-parts' },
  { query: 'windscreen windshield',  label: 'Windscreen / Windshield',category: 'Vehicle Parts', group: 'Car Glass',            jijiPath: '/vehicle-parts' },
  { query: 'shock absorber',         label: 'Shock Absorber',         category: 'Vehicle Parts', group: 'Suspension',           jijiPath: '/vehicle-parts' },
  { query: 'tie rod end',            label: 'Tie Rod End',            category: 'Vehicle Parts', group: 'Steering & Suspension',jijiPath: '/vehicle-parts' },
  { query: 'android car radio',      label: 'Android Car Radio',      category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'ignition coil',          label: 'Ignition Coil',          category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'brake pads',             label: 'Brake Pads',             category: 'Vehicle Parts', group: 'Brake System',         jijiPath: '/vehicle-parts' },
  { query: 'car radiator',           label: 'Car Radiator',           category: 'Vehicle Parts', group: 'Cooling System',       jijiPath: '/vehicle-parts' },
  { query: 'transmission fluid',     label: 'Transmission Fluid',     category: 'Vehicle Parts', group: 'Transmission',         jijiPath: '/vehicle-parts' },
  { query: 'steering rack',          label: 'Steering Rack',          category: 'Vehicle Parts', group: 'Steering & Suspension',jijiPath: '/vehicle-parts' },
  { query: 'fuel pump car',          label: 'Fuel Pump',              category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'brake disc rotor',       label: 'Brake Disc',             category: 'Vehicle Parts', group: 'Brake System',         jijiPath: '/vehicle-parts' },
  { query: 'suspension arm',         label: 'Suspension Arm',         category: 'Vehicle Parts', group: 'Steering & Suspension',jijiPath: '/vehicle-parts' },
  { query: 'car cover dust',         label: 'Car Cover (Dust)',       category: 'Vehicle Parts', group: 'Car Accessories',      jijiPath: '/vehicle-parts' },
  { query: 'oil filter car',         label: 'Oil Filter',             category: 'Vehicle Parts', group: 'Engine Filter',        jijiPath: '/vehicle-parts' },
  { query: 'alternator car',         label: 'Alternator',             category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'reverse camera car',     label: 'Reverse Camera',         category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'alloy rim wheel',        label: 'Alloy Rim / Wheel',      category: 'Vehicle Parts', group: 'Wheels & Tyres',       jijiPath: '/vehicle-parts' },
  { query: 'power steering pump',    label: 'Power Steering Pump',    category: 'Vehicle Parts', group: 'Steering & Suspension',jijiPath: '/vehicle-parts' },
  { query: 'wheel bearing',          label: 'Wheel Bearing',          category: 'Vehicle Parts', group: 'Steering & Suspension',jijiPath: '/vehicle-parts' },
  { query: 'dash camera dashcam',    label: 'Dash Camera',            category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'engine mount',           label: 'Engine Mount',           category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'car jack',               label: 'Car Jack',               category: 'Vehicle Parts', group: 'Car Tools',            jijiPath: '/vehicle-parts' },
  { query: 'starter motor car',      label: 'Starter Motor',          category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'car seat cover',         label: 'Car Seat Cover',         category: 'Vehicle Parts', group: 'Car Accessories',      jijiPath: '/vehicle-parts' },
  { query: 'gearbox transmission',   label: 'Gearbox',                category: 'Vehicle Parts', group: 'Transmission',         jijiPath: '/vehicle-parts' },
  { query: 'mass airflow sensor',    label: 'Mass Airflow Sensor',    category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'motorcycle battery',     label: 'Motorcycle Battery',     category: 'Vehicle Parts', group: 'Motorcycle Parts',     jijiPath: '/vehicle-parts' },
  { query: 'car charger inverter',   label: 'Car Charger / Inverter', category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'spark plug',             label: 'Spark Plug',             category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'car door panel',         label: 'Car Door Panel',         category: 'Vehicle Parts', group: 'Car Body Parts',       jijiPath: '/vehicle-parts' },
  { query: 'oxygen lambda sensor',   label: 'Oxygen / Lambda Sensor', category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'motorcycle engine',      label: 'Motorcycle Engine',      category: 'Vehicle Parts', group: 'Motorcycle Parts',     jijiPath: '/vehicle-parts' },
  { query: 'car battery charger',    label: 'Car Battery Charger',    category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'exhaust pipe car',       label: 'Exhaust Pipe',           category: 'Vehicle Parts', group: 'Exhaust System',       jijiPath: '/vehicle-parts' },
  { query: 'side mirror car',        label: 'Side Mirror',            category: 'Vehicle Parts', group: 'Car Body Parts',       jijiPath: '/vehicle-parts' },
  { query: 'catalytic converter',    label: 'Catalytic Converter',    category: 'Vehicle Parts', group: 'Exhaust System',       jijiPath: '/vehicle-parts' },
  { query: 'car gps tracker',        label: 'Car GPS Tracker',        category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },
  { query: 'coolant antifreeze',     label: 'Coolant / Antifreeze',   category: 'Vehicle Parts', group: 'Cooling System',       jijiPath: '/vehicle-parts' },
  { query: 'fan belt drive belt',    label: 'Fan Belt / Drive Belt',  category: 'Vehicle Parts', group: 'Engine Components',    jijiPath: '/vehicle-parts' },
  { query: 'car floor mat',          label: 'Car Floor Mat',          category: 'Vehicle Parts', group: 'Car Accessories',      jijiPath: '/vehicle-parts' },
  { query: 'car headlight',          label: 'Car Headlight',          category: 'Vehicle Parts', group: 'Car Lighting',         jijiPath: '/vehicle-parts' },
  { query: 'car bonnet hood',        label: 'Car Bonnet / Hood',      category: 'Vehicle Parts', group: 'Car Body Parts',       jijiPath: '/vehicle-parts' },
  { query: 'car tyre 235',           label: 'Car Tyre 235/55',        category: 'Vehicle Parts', group: 'Wheels & Tyres',       jijiPath: '/vehicle-parts' },
  { query: 'car alarm system',       label: 'Car Alarm System',       category: 'Vehicle Parts', group: 'Car Electronics',      jijiPath: '/vehicle-parts' },

  // ═══════════════════════════════════════════════════════════
  // APPLIANCES
  // ═══════════════════════════════════════════════════════════

  // Washing
  { query: 'twin tub washing machine', label: 'Twin Tub Washing Machine',    category: 'Appliances', group: 'Washing Machine',  jijiPath: '/home-appliances' },
  { query: 'washing machine top load', label: 'Washing Machine (Top Load)',  category: 'Appliances', group: 'Washing Machine',  jijiPath: '/home-appliances' },
  { query: 'washing machine front load', label: 'Washing Machine (Front Load)', category: 'Appliances', group: 'Washing Machine', jijiPath: '/home-appliances' },
  { query: 'clothes dryer',           label: 'Clothes Dryer',              category: 'Appliances', group: 'Clothes Dryer',    jijiPath: '/home-appliances' },

  // Air Conditioning & Fans
  { query: 'air conditioner 1hp',     label: 'Air Conditioner 1HP',        category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'air conditioner 1.5hp',   label: 'Air Conditioner 1.5HP',      category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'air conditioner 2hp',     label: 'Air Conditioner 2HP',        category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'air conditioner 3hp',     label: 'Air Conditioner 3HP',        category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'midea air conditioner',   label: 'Midea Air Conditioner',      category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'cassette ac ceiling',     label: 'Cassette AC (Ceiling)',      category: 'Appliances', group: 'Air Conditioner',  jijiPath: '/home-appliances' },
  { query: 'ceiling fan',             label: 'Ceiling Fan',                category: 'Appliances', group: 'Fan',              jijiPath: '/home-appliances' },
  { query: 'standing fan',            label: 'Standing Fan',               category: 'Appliances', group: 'Fan',              jijiPath: '/home-appliances' },
  { query: 'dehumidifier',            label: 'Dehumidifier',               category: 'Appliances', group: 'Air Treatment',    jijiPath: '/home-appliances' },
  { query: 'humidifier',              label: 'Humidifier',                 category: 'Appliances', group: 'Air Treatment',    jijiPath: '/home-appliances' },
  { query: 'robot vacuum cleaner',    label: 'Robot Vacuum',               category: 'Appliances', group: 'Vacuum Cleaner',   jijiPath: '/home-appliances' },

  // Refrigeration
  { query: 'lg refrigerator',         label: 'LG Refrigerator',            category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'samsung refrigerator',    label: 'Samsung Refrigerator',       category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'hisense refrigerator',    label: 'Hisense Refrigerator',       category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'haier refrigerator',      label: 'Haier Refrigerator',         category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'midea refrigerator',      label: 'Midea Refrigerator',         category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'bosch refrigerator',      label: 'Bosch Refrigerator',         category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'tcl refrigerator',        label: 'TCL Refrigerator',           category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'side by side fridge',     label: 'Side-by-Side Fridge',        category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },
  { query: 'chest freezer',           label: 'Chest Freezer',              category: 'Appliances', group: 'Freezer',          jijiPath: '/home-appliances' },
  { query: 'upright freezer',         label: 'Upright Freezer',            category: 'Appliances', group: 'Freezer',          jijiPath: '/home-appliances' },
  { query: 'wine cooler bar fridge',  label: 'Wine Cooler / Bar Fridge',   category: 'Appliances', group: 'Refrigerator',     jijiPath: '/home-appliances' },

  // Cooking
  { query: 'electric cooker',         label: 'Electric Cooker',            category: 'Appliances', group: 'Cooker',           jijiPath: '/home-appliances' },
  { query: 'microwave oven',          label: 'Microwave Oven',             category: 'Appliances', group: 'Microwave',        jijiPath: '/home-appliances' },
  { query: 'oven toaster',            label: 'Oven Toaster',               category: 'Appliances', group: 'Oven',             jijiPath: '/home-appliances' },
  { query: 'built in oven',           label: 'Built-in Oven',              category: 'Appliances', group: 'Oven',             jijiPath: '/home-appliances' },
  { query: 'gas cooker 2 burner',     label: 'Gas Cooker 2-Burner',        category: 'Appliances', group: 'Cooker',           jijiPath: '/home-appliances' },
  { query: 'electric hotplate',       label: 'Electric Hotplate',          category: 'Appliances', group: 'Cooker',           jijiPath: '/home-appliances' },
  { query: 'rice cooker',             label: 'Rice Cooker',                category: 'Appliances', group: 'Rice Cooker',      jijiPath: '/home-appliances' },

  // Small Appliances
  { query: 'blender',                 label: 'Blender',                    category: 'Appliances', group: 'Blender',          jijiPath: '/home-appliances' },
  { query: 'food processor',          label: 'Food Processor',             category: 'Appliances', group: 'Food Processor',   jijiPath: '/home-appliances' },
  { query: 'steam iron',              label: 'Steam Iron',                 category: 'Appliances', group: 'Iron',             jijiPath: '/home-appliances' },
  { query: 'stand mixer',             label: 'Stand Mixer',                category: 'Appliances', group: 'Food Processor',   jijiPath: '/home-appliances' },
  { query: 'air fryer',               label: 'Air Fryer',                  category: 'Appliances', group: 'Air Fryer',        jijiPath: '/home-appliances' },
  { query: 'sandwich maker',          label: 'Sandwich Maker',             category: 'Appliances', group: 'Small Kitchen Appliance', jijiPath: '/home-appliances' },
  { query: 'electric kettle',         label: 'Electric Kettle',            category: 'Appliances', group: 'Electric Kettle',  jijiPath: '/home-appliances' },
  { query: 'hair clipper',            label: 'Hair Clipper',               category: 'Appliances', group: 'Personal Care',    jijiPath: '/home-appliances' },
  { query: 'epilator',                label: 'Epilator',                   category: 'Appliances', group: 'Personal Care',    jijiPath: '/home-appliances' },
  { query: 'back massager',           label: 'Back Massager',              category: 'Appliances', group: 'Massager',         jijiPath: '/home-appliances' },
  { query: 'foot massager',           label: 'Foot Massager',              category: 'Appliances', group: 'Massager',         jijiPath: '/home-appliances' },

  // ═══════════════════════════════════════════════════════════
  // HEALTH & MEDICAL
  // ═══════════════════════════════════════════════════════════

  { query: 'multivitamins',           label: 'Multivitamins',              category: 'Health & Medical', group: 'Supplements',         jijiPath: '/ghana' },
  { query: 'wheelchair',              label: 'Wheelchair',                 category: 'Health & Medical', group: 'Mobility Aid',        jijiPath: '/ghana' },
  { query: 'pulse oximeter',          label: 'Pulse Oximeter',             category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'oxygen concentrator',     label: 'Oxygen Concentrator',        category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'glucose test strips',     label: 'Glucose Test Strips',        category: 'Health & Medical', group: 'Medical Test Kit',    jijiPath: '/ghana' },
  { query: 'glucometer',              label: 'Glucometer',                 category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'hearing aid',             label: 'Hearing Aid',                category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'face mask box',           label: 'Face Mask (Box)',            category: 'Health & Medical', group: 'Medical Consumables', jijiPath: '/ghana' },
  { query: 'hair loss treatment',     label: 'Hair Loss Treatment',        category: 'Health & Medical', group: 'Personal Care',       jijiPath: '/ghana' },
  { query: 'surgical gloves box',     label: 'Surgical Gloves (Box)',      category: 'Health & Medical', group: 'Medical Consumables', jijiPath: '/ghana' },
  { query: 'digital thermometer',     label: 'Digital Thermometer',        category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'pregnancy test kit',      label: 'Pregnancy Test Kit',         category: 'Health & Medical', group: 'Medical Test Kit',    jijiPath: '/ghana' },
  { query: 'protein supplement',      label: 'Protein Supplement',         category: 'Health & Medical', group: 'Supplements',         jijiPath: '/ghana' },
  { query: 'dental equipment',        label: 'Dental Equipment',           category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },
  { query: 'blood pressure monitor',  label: 'Blood Pressure Monitor',     category: 'Health & Medical', group: 'Medical Device',      jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // BUILDING MATERIALS
  // ═══════════════════════════════════════════════════════════

  { query: 'scaffolding',             label: 'Scaffolding',                category: 'Building Materials', group: 'Scaffolding',    jijiPath: '/building-materials' },
  { query: 'wall tiles',              label: 'Wall Tiles',                 category: 'Building Materials', group: 'Tiles',          jijiPath: '/building-materials' },
  { query: 'marble tiles',            label: 'Marble Tiles',               category: 'Building Materials', group: 'Tiles',          jijiPath: '/building-materials' },
  { query: 'wall putty skimcoat',     label: 'Wall Putty / Skimcoat',      category: 'Building Materials', group: 'Wall Finishing', jijiPath: '/building-materials' },
  { query: 'granite countertop',      label: 'Granite Countertop',         category: 'Building Materials', group: 'Countertop',     jijiPath: '/building-materials' },
  { query: 'polytank water tank',     label: 'Polytank / Water Tank',      category: 'Building Materials', group: 'Water Storage',  jijiPath: '/building-materials' },
  { query: 'stone coated roof tile',  label: 'Stone Coated Roof Tile',     category: 'Building Materials', group: 'Roofing',        jijiPath: '/building-materials' },
  { query: 'roller shutter',          label: 'Roller Shutter',             category: 'Building Materials', group: 'Doors & Shutters',jijiPath: '/building-materials' },
  { query: 'electrical cable wire',   label: 'Electrical Cable / Wire',    category: 'Building Materials', group: 'Electrical',     jijiPath: '/building-materials' },
  { query: 'waterproofing',           label: 'Waterproofing Material',     category: 'Building Materials', group: 'Waterproofing',  jijiPath: '/building-materials' },
  { query: 'sliding glass door',      label: 'Sliding Glass Door',         category: 'Building Materials', group: 'Doors & Shutters',jijiPath: '/building-materials' },
  { query: 'circuit breaker mcb',     label: 'Circuit Breaker (MCB)',      category: 'Building Materials', group: 'Electrical',     jijiPath: '/building-materials' },
  { query: 'barbed wire',             label: 'Barbed Wire',                category: 'Building Materials', group: 'Fencing',        jijiPath: '/building-materials' },
  { query: 'glass wool insulation',   label: 'Glass Wool',                 category: 'Building Materials', group: 'Insulation',     jijiPath: '/building-materials' },
  { query: 'pop plaster ceiling',     label: 'POP / Plaster',              category: 'Building Materials', group: 'Ceiling',        jijiPath: '/building-materials' },
  { query: 'vinyl flooring',          label: 'Vinyl Flooring',             category: 'Building Materials', group: 'Flooring',       jijiPath: '/building-materials' },
  { query: 'light switch socket',     label: 'Light Switch & Socket',      category: 'Building Materials', group: 'Electrical',     jijiPath: '/building-materials' },
  { query: 'cement',                  label: 'Cement (Generic)',           category: 'Building Materials', group: 'Cement',         jijiPath: '/building-materials' },
  { query: 'angle iron',              label: 'Angle Iron',                 category: 'Building Materials', group: 'Steel & Iron',   jijiPath: '/building-materials' },

  // ═══════════════════════════════════════════════════════════
  // REAL ESTATE
  // ═══════════════════════════════════════════════════════════

  { query: '3 bedroom house for sale accra',  label: '3-Bed House For Sale (Accra)',  category: 'Real Estate', group: 'Property For Sale', jijiPath: '/houses-apartments-for-sale' },
  { query: '2 bedroom apartment for sale accra', label: '2-Bed Apartment For Sale (Accra)', category: 'Real Estate', group: 'Property For Sale', jijiPath: '/houses-apartments-for-sale' },
  { query: '3 bedroom house rent accra',      label: '3-Bed House For Rent (Accra)',  category: 'Real Estate', group: 'Property For Rent', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom apartment rent accra',  label: '2-Bed Apartment For Rent (Accra)', category: 'Real Estate', group: 'Property For Rent', jijiPath: '/houses-apartments-for-rent' },
  { query: 'chamber and hall rent accra',     label: 'Chamber & Hall For Rent (Accra)', category: 'Real Estate', group: 'Property For Rent', jijiPath: '/houses-apartments-for-rent' },

  // NOTE: Furniture → sourced from Melcom collector (MELCOM_CATEGORIES has Living Room & Bedroom)
  // NOTE: Food & FMCG → sourced from commodity_prices (MOFA agricultural data)
  // NOTE: Sports & Fitness → no reliable Ghana online source yet; data gap acknowledged

];

// ── MOFA AGRICULTURAL COMMODITIES ────────────────────────────
const COMMODITIES = [

  // ── GRAINS ──────────────────────────────────────────────────
  { code: 'MAIZE_KUMASI',       name: 'Maize',             market: 'Kumasi Central',         region: 'Ashanti',       unit: '50kg bag',  price: 280  },
  { code: 'MAIZE_ACCRA',        name: 'Maize',             market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 310  },
  { code: 'MAIZE_TAMALE',       name: 'Maize',             market: 'Tamale Central',         region: 'Northern',      unit: '50kg bag',  price: 260  },
  { code: 'RICE_LOCAL_KUMASI',  name: 'Rice (Local)',      market: 'Kumasi Central',         region: 'Ashanti',       unit: '50kg bag',  price: 580  },
  { code: 'RICE_LOCAL_ACCRA',   name: 'Rice (Local)',      market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 620  },
  { code: 'RICE_IMP_ACCRA',     name: 'Rice (Imported)',   market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 750  },
  { code: 'RICE_IMP_KUMASI',    name: 'Rice (Imported)',   market: 'Kumasi Central',         region: 'Ashanti',       unit: '50kg bag',  price: 720  },
  { code: 'MILLET_TAMALE',      name: 'Millet',            market: 'Tamale Central',         region: 'Northern',      unit: '50kg bag',  price: 240  },
  { code: 'SORGHUM_TAMALE',     name: 'Sorghum',           market: 'Tamale Central',         region: 'Northern',      unit: '50kg bag',  price: 230  },
  { code: 'SOYBEAN_TAMALE',     name: 'Soybeans',          market: 'Tamale Central',         region: 'Northern',      unit: '50kg bag',  price: 320  },
  { code: 'GROUNDNUT_TAMALE',   name: 'Groundnuts',        market: 'Tamale Central',         region: 'Northern',      unit: '50kg bag',  price: 380  },
  { code: 'COWPEA_ACCRA',       name: 'Cowpea (Beans)',    market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: '50kg bag',  price: 420  },

  // ── ROOTS & TUBERS ──────────────────────────────────────────
  { code: 'CASSAVA_EASTERN',    name: 'Cassava',           market: 'Koforidua Market',       region: 'Eastern',       unit: '50kg bag',  price: 120  },
  { code: 'CASSAVA_ACCRA',      name: 'Cassava',           market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: '50kg bag',  price: 140  },
  { code: 'YAM_TAMALE',         name: 'Yam',               market: 'Tamale Central',         region: 'Northern',      unit: 'tuber',     price: 95   },
  { code: 'YAM_KUMASI',         name: 'Yam',               market: 'Kumasi Kejetia',         region: 'Ashanti',       unit: 'tuber',     price: 110  },
  { code: 'COCOYAM_ACCRA',      name: 'Cocoyam',           market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 160  },
  { code: 'SWEET_POTATO_ACCRA', name: 'Sweet Potato',      market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 130  },
  { code: 'GARI_ACCRA',         name: 'Gari',              market: 'Accra Makola',           region: 'Greater Accra', unit: '50kg bag',  price: 350  },

  // ── VEGETABLES ──────────────────────────────────────────────
  { code: 'TOMATO_KUMASI',      name: 'Tomatoes',          market: 'Kumasi Central',         region: 'Ashanti',       unit: 'crate',     price: 180  },
  { code: 'TOMATO_ACCRA',       name: 'Tomatoes',          market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'crate',     price: 200  },
  { code: 'ONION_ACCRA',        name: 'Onions',            market: 'Accra Makola',           region: 'Greater Accra', unit: 'bag',       price: 160  },
  { code: 'ONION_KUMASI',       name: 'Onions',            market: 'Kumasi Central',         region: 'Ashanti',       unit: 'bag',       price: 150  },
  { code: 'PEPPER_RED_ACCRA',   name: 'Pepper (Red)',      market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'bag',       price: 90   },
  { code: 'GARDEN_EGG_KUMASI',  name: 'Garden Eggs',       market: 'Kumasi Central',         region: 'Ashanti',       unit: 'bag',       price: 60   },
  { code: 'OKRA_ACCRA',         name: 'Okra',              market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'kg',        price: 8    },
  { code: 'CABBAGE_KUMASI',     name: 'Cabbage',           market: 'Kumasi Central',         region: 'Ashanti',       unit: 'head',      price: 12   },
  { code: 'CARROT_ACCRA',       name: 'Carrots',           market: 'Accra Makola',           region: 'Greater Accra', unit: 'kg',        price: 14   },
  { code: 'LETTUCE_ACCRA',      name: 'Lettuce',           market: 'Accra Makola',           region: 'Greater Accra', unit: 'head',      price: 8    },

  // ── FRUITS ──────────────────────────────────────────────────
  { code: 'PLANTAIN_KUMASI',    name: 'Plantain',          market: 'Kumasi Central',         region: 'Ashanti',       unit: 'bunch',     price: 45   },
  { code: 'PLANTAIN_ACCRA',     name: 'Plantain',          market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'bunch',     price: 55   },
  { code: 'BANANA_ACCRA',       name: 'Banana',            market: 'Accra Makola',           region: 'Greater Accra', unit: 'bunch',     price: 30   },
  { code: 'ORANGE_ACCRA',       name: 'Oranges',           market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'bag (50)',  price: 80   },
  { code: 'WATERMELON_ACCRA',   name: 'Watermelon',        market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'each',      price: 35   },
  { code: 'MANGO_ACCRA',        name: 'Mango',             market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'crate',     price: 60   },
  { code: 'PINEAPPLE_ACCRA',    name: 'Pineapple',         market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'each',      price: 15   },

  // ── PROTEIN & OILS ──────────────────────────────────────────
  { code: 'PALM_OIL_WESTERN',   name: 'Palm Oil',          market: 'Takoradi Market',        region: 'Western',       unit: 'litre',     price: 28   },
  { code: 'PALM_OIL_ACCRA',     name: 'Palm Oil',          market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'litre',     price: 32   },
  { code: 'GROUNDNUT_OIL_ACC',  name: 'Groundnut Oil',     market: 'Accra Makola',           region: 'Greater Accra', unit: 'litre',     price: 45   },
  { code: 'CHICKEN_LIVE_ACC',   name: 'Chicken (Live)',    market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'each',      price: 80   },
  { code: 'EGGS_ACCRA',         name: 'Eggs',              market: 'Accra Makola',           region: 'Greater Accra', unit: 'crate 30',  price: 60   },
  { code: 'TILAPIA_ACCRA',      name: 'Tilapia (Fresh)',   market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'kg',        price: 55   },
  { code: 'MACKEREL_ACCRA',     name: 'Mackerel (Fresh)',  market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'kg',        price: 45   },
  { code: 'SMOKED_FISH_ACCRA',  name: 'Smoked Fish',       market: 'Accra Makola',           region: 'Greater Accra', unit: 'kg',        price: 80   },

  // ── PROCESSED / STAPLES ─────────────────────────────────────
  { code: 'BREAD_ACCRA',        name: 'Bread (Large Loaf)', market: 'Accra Retail',          region: 'Greater Accra', unit: 'loaf',      price: 22   },
  { code: 'SUGAR_ACCRA',        name: 'Sugar',             market: 'Accra Makola',           region: 'Greater Accra', unit: '1kg',       price: 28   },
  { code: 'COOKING_OIL_ACC',    name: 'Cooking Oil',       market: 'Accra Makola',           region: 'Greater Accra', unit: '2L bottle', price: 95   },
  { code: 'COOKING_GAS_ACC',    name: 'LPG Cooking Gas',   market: 'Accra Retail',           region: 'Greater Accra', unit: '6kg cyl',   price: 110  },
];

module.exports = { SECTORS, INDICATORS, MARKET_PRODUCTS, MELCOM_CATEGORIES, COMMODITIES };
