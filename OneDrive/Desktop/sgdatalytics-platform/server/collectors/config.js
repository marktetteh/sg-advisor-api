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
  { categoryId: '1279', category: 'Electronics',      label: 'Smart Phones'             },
  { categoryId: '1285', category: 'Electronics',      label: 'Computers & Accessories'  },
  { categoryId: '1290', category: 'Electronics',      label: 'Television & Audio'        },
  // ── Appliances ───────────────────────────────────────────────
  { categoryId: '1313', category: 'Appliances',       label: 'Kitchen Appliances'        },
  { categoryId: '1306', category: 'Appliances',       label: 'Air Conditioners'          },
  { categoryId: '3213', category: 'Appliances',       label: 'Home Appliances'           },
  // ── Furniture ────────────────────────────────────────────────
  { categoryId: '1327', category: 'Furniture',        label: 'Living Room Furniture'     },
  { categoryId: '1328', category: 'Furniture',        label: 'Bedroom Furniture'         },
  // ── Food & FMCG ──────────────────────────────────────────────
  { categoryId: '1352', category: 'Food & FMCG',      label: 'Supermarket'               },
  // ── Sports & Fitness ─────────────────────────────────────────
  { categoryId: '1383', category: 'Sports & Fitness', label: 'Sports & Fitness'          },
  // ── Home & Kitchen ───────────────────────────────────────────
  { categoryId: '1337', category: 'Home & Kitchen',   label: 'Home & Kitchen Essentials' },
];

// ── MARKET PRODUCTS — Jiji.com.gh (500 products) ─────────────
// source: jiji
// jijiPath: Jiji category URL path for more relevant results
const MARKET_PRODUCTS = [

  // ═══════════════════════════════════════════════════════════
  // ELECTRONICS & PHONES (80)
  // ═══════════════════════════════════════════════════════════

  // Phones — iPhone
  { query: 'iphone 17',            label: 'iPhone 17',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 16 pro',        label: 'iPhone 16 Pro',          category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 16',            label: 'iPhone 16',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 15 pro',        label: 'iPhone 15 Pro',          category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 15',            label: 'iPhone 15',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 14',            label: 'iPhone 14',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 13',            label: 'iPhone 13',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 12',            label: 'iPhone 12',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone se',            label: 'iPhone SE',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Phones — Samsung
  { query: 'samsung s25 ultra',    label: 'Samsung S25 Ultra',      category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s25',          label: 'Samsung S25',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s24',          label: 'Samsung S24',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s23',          label: 'Samsung S23',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a55',          label: 'Samsung A55',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a35',          label: 'Samsung A35',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a25',          label: 'Samsung A25',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a24',          label: 'Samsung A24',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung a15',          label: 'Samsung A15',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Phones — Tecno
  { query: 'tecno camon 30',       label: 'Tecno Camon 30',         category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno spark 20',       label: 'Tecno Spark 20',         category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno phantom',        label: 'Tecno Phantom',          category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'tecno pop',            label: 'Tecno Pop',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Phones — Infinix
  { query: 'infinix hot 40',       label: 'Infinix Hot 40',         category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'infinix note 40',      label: 'Infinix Note 40',        category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'infinix zero 30',      label: 'Infinix Zero 30',        category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'infinix smart',        label: 'Infinix Smart',          category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Phones — Other brands
  { query: 'itel phone',           label: 'Itel Phone',             category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'xiaomi redmi',         label: 'Xiaomi Redmi',           category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'google pixel',         label: 'Google Pixel',           category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Computers
  { query: 'hp laptop',            label: 'HP Laptop',              category: 'Electronics', jijiPath: '/computers' },
  { query: 'dell laptop',          label: 'Dell Laptop',            category: 'Electronics', jijiPath: '/computers' },
  { query: 'lenovo laptop',        label: 'Lenovo Laptop',          category: 'Electronics', jijiPath: '/computers' },
  { query: 'macbook',              label: 'MacBook',                category: 'Electronics', jijiPath: '/computers' },
  { query: 'asus laptop',          label: 'Asus Laptop',            category: 'Electronics', jijiPath: '/computers' },
  { query: 'desktop computer',     label: 'Desktop Computer',       category: 'Electronics', jijiPath: '/computers' },
  { query: 'ipad',                 label: 'iPad',                   category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung tablet',       label: 'Samsung Tablet',         category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // TVs & Audio
  { query: 'samsung smart tv',     label: 'Samsung Smart TV',       category: 'Electronics', jijiPath: '/electronics' },
  { query: 'lg smart tv',          label: 'LG Smart TV',            category: 'Electronics', jijiPath: '/electronics' },
  { query: 'hisense tv',           label: 'Hisense TV',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'tcl tv',               label: 'TCL TV',                 category: 'Electronics', jijiPath: '/electronics' },
  { query: '32 inch tv',           label: 'TV 32 inch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: '43 inch tv',           label: 'TV 43 inch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: '55 inch tv',           label: 'TV 55 inch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'soundbar',             label: 'Soundbar',               category: 'Electronics', jijiPath: '/electronics' },
  { query: 'bluetooth speaker',    label: 'Bluetooth Speaker',      category: 'Electronics', jijiPath: '/electronics' },
  { query: 'wireless earbuds',     label: 'Wireless Earbuds',       category: 'Electronics', jijiPath: '/electronics' },

  // Power
  { query: 'generator 2.5kva',     label: 'Generator 2.5KVA',       category: 'Electronics', jijiPath: '/generators' },
  { query: 'generator 3.5kva',     label: 'Generator 3.5KVA',       category: 'Electronics', jijiPath: '/generators' },
  { query: 'generator 5kva',       label: 'Generator 5KVA',         category: 'Electronics', jijiPath: '/generators' },
  { query: 'solar panel',          label: 'Solar Panel',            category: 'Electronics', jijiPath: '/electronics' },
  { query: 'solar inverter',       label: 'Solar Inverter',         category: 'Electronics', jijiPath: '/electronics' },
  { query: 'power bank',           label: 'Power Bank',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'ups uninterruptible',  label: 'UPS Battery Backup',     category: 'Electronics', jijiPath: '/electronics' },

  // Security & Cameras
  { query: 'cctv camera',          label: 'CCTV Camera System',     category: 'Electronics', jijiPath: '/electronics' },
  { query: 'digital camera',       label: 'Digital Camera',         category: 'Electronics', jijiPath: '/electronics' },

  // Gaming
  { query: 'ps5 playstation 5',    label: 'PlayStation 5',          category: 'Electronics', jijiPath: '/electronics' },
  { query: 'ps4 playstation',      label: 'PlayStation 4',          category: 'Electronics', jijiPath: '/electronics' },
  { query: 'xbox',                 label: 'Xbox Console',           category: 'Electronics', jijiPath: '/electronics' },

  // Accessories
  { query: 'smartwatch',           label: 'Smartwatch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'wireless router',      label: 'WiFi Router',            category: 'Electronics', jijiPath: '/electronics' },
  { query: 'drone',                label: 'Drone',                  category: 'Electronics', jijiPath: '/electronics' },
  { query: 'printer',              label: 'Printer',                category: 'Electronics', jijiPath: '/ghana'        },
  { query: 'projector',            label: 'Projector',              category: 'Electronics', jijiPath: '/electronics' },

  // ═══════════════════════════════════════════════════════════
  // VEHICLES (50)
  // ═══════════════════════════════════════════════════════════

  // Toyota
  { query: 'toyota corolla',       label: 'Toyota Corolla',         category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota camry',         label: 'Toyota Camry',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota land cruiser',  label: 'Toyota Land Cruiser',    category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota hilux',         label: 'Toyota Hilux',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota fortuner',      label: 'Toyota Fortuner',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota rav4',          label: 'Toyota RAV4',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota venza',         label: 'Toyota Venza',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota avensis',       label: 'Toyota Avensis',         category: 'Vehicles', jijiPath: '/cars' },

  // Honda
  { query: 'honda civic',          label: 'Honda Civic',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'honda accord',         label: 'Honda Accord',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'honda crv',            label: 'Honda CR-V',             category: 'Vehicles', jijiPath: '/cars' },
  { query: 'honda hrv',            label: 'Honda HR-V',             category: 'Vehicles', jijiPath: '/cars' },

  // Hyundai
  { query: 'hyundai elantra',      label: 'Hyundai Elantra',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'hyundai tucson',       label: 'Hyundai Tucson',         category: 'Vehicles', jijiPath: '/cars' },
  { query: 'hyundai santa fe',     label: 'Hyundai Santa Fe',       category: 'Vehicles', jijiPath: '/cars' },
  { query: 'hyundai h1',           label: 'Hyundai H1 / Starex',    category: 'Vehicles', jijiPath: '/cars' },

  // Kia
  { query: 'kia sorento',          label: 'Kia Sorento',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'kia sportage',         label: 'Kia Sportage',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'kia picanto',          label: 'Kia Picanto',            category: 'Vehicles', jijiPath: '/cars' },

  // Mercedes / BMW / VW
  { query: 'mercedes c class',     label: 'Mercedes C-Class',       category: 'Vehicles', jijiPath: '/cars' },
  { query: 'mercedes glc',         label: 'Mercedes GLC',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'bmw 3 series',         label: 'BMW 3 Series',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'bmw x5',               label: 'BMW X5',                 category: 'Vehicles', jijiPath: '/cars' },
  { query: 'vw golf',              label: 'Volkswagen Golf',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'vw passat',            label: 'Volkswagen Passat',      category: 'Vehicles', jijiPath: '/cars' },
  { query: 'vw tiguan',            label: 'Volkswagen Tiguan',      category: 'Vehicles', jijiPath: '/cars' },

  // Ford / Mitsubishi / Nissan
  { query: 'ford ranger',          label: 'Ford Ranger',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'mitsubishi pajero',    label: 'Mitsubishi Pajero',      category: 'Vehicles', jijiPath: '/cars' },
  { query: 'mitsubishi l200',      label: 'Mitsubishi L200',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'nissan navara',        label: 'Nissan Navara',          category: 'Vehicles', jijiPath: '/cars' },
  { query: 'nissan xtrail',        label: 'Nissan X-Trail',         category: 'Vehicles', jijiPath: '/cars' },

  // Other cars
  { query: 'suzuki swift',         label: 'Suzuki Swift',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'lexus rx',             label: 'Lexus RX',               category: 'Vehicles', jijiPath: '/cars' },
  { query: 'lexus es',             label: 'Lexus ES',               category: 'Vehicles', jijiPath: '/cars' },
  { query: 'range rover',          label: 'Range Rover',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'chevrolet cruze',      label: 'Chevrolet Cruze',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'opel corsa',           label: 'Opel Corsa',             category: 'Vehicles', jijiPath: '/cars' },

  // Motorbikes & Commercial
  { query: 'yamaha motorbike',     label: 'Yamaha Motorbike',       category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'honda motorbike',      label: 'Honda Motorbike',        category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'tvs motorbike',        label: 'TVS Motorbike',          category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'tricycle aboboyaa',    label: 'Tricycle (Aboboyaa)',    category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'tuk tuk',              label: 'Tuk-Tuk',               category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'sprinter bus',         label: 'Sprinter / Minibus',     category: 'Vehicles', jijiPath: '/ghana' },
  { query: '52 seater bus',        label: '52-Seater Bus',          category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'pickup truck',         label: 'Pickup Truck',           category: 'Vehicles', jijiPath: '/cars'  },
  { query: 'cargo truck',          label: 'Cargo Truck',            category: 'Vehicles', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // BUILDING MATERIALS (50)
  // ═══════════════════════════════════════════════════════════

  // Cement & Concrete
  { query: 'diamond cement',       label: 'Diamond Cement',         category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'ghacem cement',        label: 'GHACEM Cement',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'supaset cement',       label: 'Supaset Cement',         category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'cement bag',           label: 'Cement (Generic)',       category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'concrete block',       label: 'Concrete Blocks',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'sand filling',         label: 'Sand (Filling)',         category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'sharp sand',           label: 'Sharp Sand',             category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'gravel chippings',     label: 'Gravel / Chippings',     category: 'Building Materials', jijiPath: '/building-materials' },

  // Iron & Steel
  { query: 'iron rod 10mm',        label: 'Iron Rod 10mm',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'iron rod 12mm',        label: 'Iron Rod 12mm',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'iron rod 16mm',        label: 'Iron Rod 16mm',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'iron rod 20mm',        label: 'Iron Rod 20mm',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'steel column',         label: 'Steel Column / H-Beam',  category: 'Building Materials', jijiPath: '/building-materials' },

  // Roofing
  { query: 'aluminium roofing',    label: 'Aluminium Roofing Sheet',category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'long span roofing',    label: 'Long Span Roofing',      category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'step tile roofing',    label: 'Step Tile Roofing',      category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'decra roofing',        label: 'Decra Stone Coated Tile',category: 'Building Materials', jijiPath: '/building-materials' },

  // Tiles & Flooring
  { query: 'floor tiles',          label: 'Floor Tiles',            category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'wall tiles',           label: 'Wall Tiles',             category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'porcelain tiles',      label: 'Porcelain Tiles',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'marble tiles',         label: 'Marble Tiles',           category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'vinyl flooring',       label: 'Vinyl Flooring',         category: 'Building Materials', jijiPath: '/building-materials' },

  // Wood & Board
  { query: 'plywood sheet',        label: 'Plywood Sheet',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'hardwood timber',      label: 'Hardwood Timber',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'chipboard',            label: 'Chipboard / MDF',        category: 'Building Materials', jijiPath: '/building-materials' },

  // Windows, Doors & Glass
  { query: 'aluminium window',     label: 'Aluminium Window',       category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'aluminium door',       label: 'Aluminium Door',         category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'security door',        label: 'Security / Steel Door',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'clear glass',          label: 'Glass (Clear)',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'sliding door',         label: 'Sliding Glass Door',     category: 'Building Materials', jijiPath: '/building-materials' },

  // Paint
  { query: 'dulux paint',          label: 'Dulux Paint',            category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'tex paint',            label: 'Tex Paint',              category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'durbond paint',        label: 'Durbond Paint',          category: 'Building Materials', jijiPath: '/building-materials' },

  // Pipes & Electrical
  { query: 'pvc pipe 1 inch',      label: 'PVC Pipe 1 inch',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'pvc pipe 2 inch',      label: 'PVC Pipe 2 inch',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'electrical cable wire',label: 'Electrical Cable / Wire',category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'conduit pipe',         label: 'Conduit Pipe',           category: 'Building Materials', jijiPath: '/building-materials' },

  // Bathroom & Water
  { query: 'toilet bowl',          label: 'Toilet Bowl / WC',       category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'bathroom sink',        label: 'Bathroom Sink / Basin',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'bathtub',              label: 'Bathtub',                category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'polytank water tank',  label: 'Polytank / Water Tank',  category: 'Building Materials', jijiPath: '/building-materials' },

  // Misc
  { query: 'waterproofing',        label: 'Waterproofing Material', category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'wall putty',           label: 'Wall Putty / Skimcoat',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'barbed wire',          label: 'Barbed Wire',            category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'scaffolding',          label: 'Scaffolding',            category: 'Building Materials', jijiPath: '/building-materials' },

  // ═══════════════════════════════════════════════════════════
  // HOME APPLIANCES (40)
  // ═══════════════════════════════════════════════════════════

  // Air Conditioning
  { query: 'air conditioner 1hp',  label: 'Air Conditioner 1HP',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'air conditioner 1.5hp',label: 'Air Conditioner 1.5HP',  category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'air conditioner 2hp',  label: 'Air Conditioner 2HP',    category: 'Appliances', jijiPath: '/home-appliances' },

  // Refrigerators & Freezers
  { query: 'samsung refrigerator', label: 'Samsung Refrigerator',   category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'lg refrigerator',      label: 'LG Refrigerator',        category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'hisense refrigerator', label: 'Hisense Refrigerator',   category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'haier refrigerator',   label: 'Haier Refrigerator',     category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'chest freezer',        label: 'Chest Freezer',          category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'upright freezer',      label: 'Upright Freezer',        category: 'Appliances', jijiPath: '/home-appliances' },

  // Washing Machines
  { query: 'washing machine top load',   label: 'Washing Machine (Top Load)',   category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'washing machine front load', label: 'Washing Machine (Front Load)', category: 'Appliances', jijiPath: '/home-appliances' },

  // Cookers & Ovens
  { query: 'gas cooker 4 burner',  label: 'Gas Cooker 4-Burner',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'gas cooker 2 burner',  label: 'Gas Cooker 2-Burner',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'electric cooker',      label: 'Electric Cooker',        category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'microwave oven',       label: 'Microwave Oven',         category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'oven toaster',         label: 'Oven Toaster',           category: 'Appliances', jijiPath: '/home-appliances' },

  // Small Appliances
  { query: 'blender',              label: 'Blender',                category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'food processor',       label: 'Food Processor',         category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'rice cooker',          label: 'Rice Cooker',            category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'electric kettle',      label: 'Electric Kettle',        category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'steam iron',           label: 'Steam Iron',             category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'sewing machine',       label: 'Sewing Machine',         category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'vacuum cleaner',       label: 'Vacuum Cleaner',         category: 'Appliances', jijiPath: '/home-appliances' },

  // Fans & Water
  { query: 'standing fan',         label: 'Standing Fan',           category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'ceiling fan',          label: 'Ceiling Fan',            category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'water dispenser hot cold', label: 'Water Dispenser',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'water heater instant', label: 'Water Heater (Instant)', category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'water pump submersible',label: 'Water Pump',            category: 'Appliances', jijiPath: '/home-appliances' },

  // Irons & Misc
  { query: 'dish washer',          label: 'Dishwasher',             category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'air fryer',            label: 'Air Fryer',              category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'juicer',               label: 'Juicer',                 category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'coffee maker',         label: 'Coffee Maker',           category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'bread maker',          label: 'Bread Maker',            category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'sandwich maker',       label: 'Sandwich Maker',         category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'hair dryer',           label: 'Hair Dryer',             category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'hair clipper',         label: 'Hair Clipper',           category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'electric shaver',      label: 'Electric Shaver',        category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'electric fan heater',  label: 'Fan Heater',             category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'humidifier',           label: 'Humidifier',             category: 'Appliances', jijiPath: '/home-appliances' },

  // ═══════════════════════════════════════════════════════════
  // FURNITURE (35)
  // ═══════════════════════════════════════════════════════════

  { query: 'sofa 3 seater',        label: 'Sofa 3-Seater',          category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'l shape sofa',         label: 'L-Shape Sofa',           category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'corner sofa',          label: 'Corner Sofa Set',        category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'sofa bed',             label: 'Sofa Bed',               category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'king size bed',        label: 'King Size Bed',          category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'queen size bed',       label: 'Queen Size Bed',         category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'double bed frame',     label: 'Double Bed Frame',       category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'single bed',           label: 'Single Bed Frame',       category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'bunk bed',             label: 'Bunk Bed',               category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'orthopedic mattress',  label: 'Orthopedic Mattress',    category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'foam mattress',        label: 'Foam Mattress',          category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: '3 door wardrobe',      label: 'Wardrobe 3-Door',        category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'sliding wardrobe',     label: 'Sliding Wardrobe',       category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'dining table 6 seater',label: 'Dining Table 6-Seater',  category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'dining table 4 seater',label: 'Dining Table 4-Seater',  category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'office chair executive',label: 'Executive Office Chair', category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'office desk',          label: 'Office Desk',            category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'kitchen cabinet',      label: 'Kitchen Cabinet',        category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'tv stand',             label: 'TV Stand / Cabinet',     category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'bookshelf',            label: 'Bookshelf',              category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'dressing table',       label: 'Dressing Table',         category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'center table',         label: 'Center / Coffee Table',  category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'computer desk',        label: 'Computer Desk',          category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'filing cabinet',       label: 'Filing Cabinet',         category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'plastic chair mono',   label: 'Plastic Chair (Mono)',   category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'garden chair',         label: 'Garden / Outdoor Chair', category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'recliner chair',       label: 'Recliner Chair',         category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'bar stool',            label: 'Bar Stool',              category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'shoe rack',            label: 'Shoe Rack',              category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'wall unit display',    label: 'Wall Unit / Display',    category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'study table',          label: 'Study / Student Desk',   category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'reception desk',       label: 'Reception / Counter Desk',category: 'Furniture',jijiPath: '/ghana'              },
  { query: 'hospital bed',         label: 'Hospital Bed',           category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'baby cot crib',        label: 'Baby Cot / Crib',        category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'changing table',       label: 'Baby Changing Table',    category: 'Furniture', jijiPath: '/ghana'              },

  // ═══════════════════════════════════════════════════════════
  // VEHICLE PARTS (35)
  // ═══════════════════════════════════════════════════════════

  { query: 'car tyre 195 65',      label: 'Car Tyre 195/65',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car tyre 205 65',      label: 'Car Tyre 205/65',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'truck tyre',           label: 'Truck Tyre',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car battery',          label: 'Car Battery',            category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'truck battery',        label: 'Truck Battery',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'engine oil 5l',        label: 'Engine Oil (5L)',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'gear box',             label: 'Gearbox',                category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'alternator',           label: 'Alternator',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'starter motor',        label: 'Starter Motor',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'radiator',             label: 'Car Radiator',           category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'shock absorber',       label: 'Shock Absorber',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'brake pads',           label: 'Brake Pads',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'brake disc',           label: 'Brake Disc',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car headlight',        label: 'Car Headlight',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'spark plug',           label: 'Spark Plug',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'air filter',           label: 'Air Filter',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'oil filter',           label: 'Oil Filter',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'fan belt',             label: 'Fan Belt / Drive Belt',  category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'catalytic converter',  label: 'Catalytic Converter',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car bumper',           label: 'Car Bumper',             category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car bonnet hood',      label: 'Car Bonnet / Hood',      category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car door panel',       label: 'Car Door Panel',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'steering rack',        label: 'Steering Rack',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'suspension arm',       label: 'Suspension Arm',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car jack',             label: 'Car Jack',               category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car seat cover',       label: 'Car Seat Cover',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car floor mat',        label: 'Car Floor Mat',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'exhaust pipe',         label: 'Exhaust Pipe',           category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'fuel pump',            label: 'Fuel Pump',              category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'power steering pump',  label: 'Power Steering Pump',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'motorcycle tyre',      label: 'Motorcycle Tyre',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'motorcycle battery',   label: 'Motorcycle Battery',     category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'motorcycle engine',    label: 'Motorcycle Engine',      category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'dashcam',              label: 'Dash Camera',            category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car charger',          label: 'Car Charger / Inverter', category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },

  // ═══════════════════════════════════════════════════════════
  // FOOD & FMCG (35)
  // ═══════════════════════════════════════════════════════════

  { query: 'imported rice bag 50kg',label: 'Rice (Imported 50kg)',  category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'local rice bag',       label: 'Rice (Local 50kg)',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'cooking oil 5 litre',  label: 'Cooking Oil (5L)',       category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'cooking oil 2 litre',  label: 'Cooking Oil (2L)',       category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'palm oil litre',       label: 'Palm Oil (per litre)',   category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'frozen chicken',       label: 'Frozen Chicken',         category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'canned sardines',      label: 'Canned Sardines',        category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'bottled water 1.5l',   label: 'Bottled Water (1.5L)',   category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'gas cylinder 6kg',     label: 'LPG Gas Cylinder (6kg)', category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'gas cylinder 14.5kg',  label: 'LPG Cylinder (14.5kg)', category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'baby milk formula',    label: 'Baby Milk / Formula',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'milo tin',             label: 'Milo / Ovaltine (Tin)',  category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'sugar 1kg',            label: 'Sugar (1kg)',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'sugar 50kg bag',       label: 'Sugar (50kg Bag)',       category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'bread loaf',           label: 'Bread (Large Loaf)',     category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'tin tomatoes',         label: 'Tin Tomatoes',           category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'noodles indomie',      label: 'Indomie / Noodles',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'flour 2kg',            label: 'Flour (2kg)',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'vegetable oil',        label: 'Vegetable Oil',          category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'margarine butter',     label: 'Margarine / Butter',     category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'washing detergent',    label: 'Washing Detergent',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'bar soap',             label: 'Bar Soap',               category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'diapers',              label: 'Diapers / Pampers',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'sanitary pad',         label: 'Sanitary Pads',          category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'toothpaste colgate',   label: 'Toothpaste',             category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'shampoo hair',         label: 'Shampoo',                category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'body lotion',          label: 'Body Lotion',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'evaporated milk tin',  label: 'Evaporated Milk (Tin)',  category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'groundnut paste',      label: 'Groundnut Paste',        category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'tomato paste sachet',  label: 'Tomato Paste (Sachet)',  category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'pepper dried',         label: 'Dried Pepper',           category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'stockfish',            label: 'Stockfish',              category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'smoked fish',          label: 'Smoked Fish',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'eggs crate',           label: 'Eggs (Crate of 30)',     category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'mineral water sachet', label: 'Pure Water (Sachet)',    category: 'Food & FMCG', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // FASHION & CLOTHING (35)
  // ═══════════════════════════════════════════════════════════

  { query: 'nike sneakers',        label: 'Nike Sneakers',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'adidas sneakers',      label: 'Adidas Sneakers',        category: 'Fashion', jijiPath: '/ghana' },
  { query: 'puma sneakers',        label: 'Puma Sneakers',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'men casual shoes',     label: "Men's Casual Shoes",     category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ladies heels',         label: "Ladies' Heels",          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'sandals slippers',     label: 'Sandals / Slippers',     category: 'Fashion', jijiPath: '/ghana' },
  { query: 'work boots safety',    label: 'Safety / Work Boots',    category: 'Fashion', jijiPath: '/ghana' },
  { query: 'men suit',             label: "Men's Suit",             category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ankara fabric',        label: 'Ankara Fabric',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'kente cloth',          label: 'Kente Cloth',            category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ladies dress',         label: "Ladies' Dress",          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'jeans trousers',       label: 'Jeans (Trousers)',       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'men polo shirt',       label: "Men's Polo Shirt",       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'school uniform',       label: 'School Uniform',         category: 'Fashion', jijiPath: '/ghana' },
  { query: 'football jersey',      label: 'Football Jersey',        category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ladies handbag',       label: "Ladies' Handbag",        category: 'Fashion', jijiPath: '/ghana' },
  { query: 'backpack bag',         label: 'Backpack Bag',           category: 'Fashion', jijiPath: '/ghana' },
  { query: 'wristwatch',           label: 'Wristwatch',             category: 'Fashion', jijiPath: '/ghana' },
  { query: 'sunglasses',           label: 'Sunglasses',             category: 'Fashion', jijiPath: '/ghana' },
  { query: 'gold necklace',        label: 'Gold Necklace',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'gold ring',            label: 'Gold Ring',              category: 'Fashion', jijiPath: '/ghana' },
  { query: 'bracelet',             label: 'Bracelet / Bangle',      category: 'Fashion', jijiPath: '/ghana' },
  { query: 'perfume',              label: 'Perfume',                category: 'Fashion', jijiPath: '/ghana' },
  { query: 'weave hair extension', label: 'Hair Weave / Extension', category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ladies skirt',         label: "Ladies' Skirt",          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'men shorts',           label: "Men's Shorts",           category: 'Fashion', jijiPath: '/ghana' },
  { query: 'cap hat',              label: 'Cap / Hat',              category: 'Fashion', jijiPath: '/ghana' },
  { query: 'belt leather',         label: 'Leather Belt',           category: 'Fashion', jijiPath: '/ghana' },
  { query: 't shirt',              label: 'T-Shirt',                category: 'Fashion', jijiPath: '/ghana' },
  { query: 'swimwear',             label: 'Swimwear',               category: 'Fashion', jijiPath: '/ghana' },
  { query: 'tie corporate',        label: 'Neck Tie',               category: 'Fashion', jijiPath: '/ghana' },
  { query: 'underwear boxers',     label: 'Underwear / Boxers',     category: 'Fashion', jijiPath: '/ghana' },
  { query: 'hijab abaya',          label: 'Hijab / Abaya',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'children clothing',    label: "Children's Clothing",    category: 'Fashion', jijiPath: '/ghana' },
  { query: 'school bag children',  label: 'School Bag (Children)',  category: 'Fashion', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // AGRICULTURE & FARM INPUTS (35)
  // ═══════════════════════════════════════════════════════════

  { query: 'npk fertilizer',       label: 'NPK Fertilizer',         category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'urea fertilizer',      label: 'Urea Fertilizer',        category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'sulphate ammonia fertilizer', label: 'Sulphate of Ammonia', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'glyphosate herbicide', label: 'Glyphosate Herbicide',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'primextra herbicide',  label: 'Primextra Herbicide',    category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'insecticide pesticide',label: 'Insecticide / Pesticide',category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'fungicide',            label: 'Fungicide',              category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'maize seeds',          label: 'Maize Seeds',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'tomato seedlings',     label: 'Tomato Seedlings',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'pepper seeds',         label: 'Pepper Seeds',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'onion seeds',          label: 'Onion Seeds',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'vegetable seeds',      label: 'Vegetable Seeds (Mixed)',category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'day old chicks',       label: 'Day-Old Chicks',         category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'layers poultry feed',  label: 'Layers Poultry Feed',    category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'broiler poultry feed', label: 'Broiler Poultry Feed',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'fish feed',            label: 'Fish Feed',              category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'pig feed',             label: 'Pig / Swine Feed',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'water pump 1hp',       label: 'Water Pump 1HP',         category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'water pump 2hp',       label: 'Water Pump 2HP',         category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'knapsack sprayer',     label: 'Knapsack Sprayer',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'motorized sprayer',    label: 'Motorized Sprayer',      category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'irrigation drip pipe', label: 'Drip Irrigation Pipe',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'farm tractor',         label: 'Farm Tractor',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'power tiller',         label: 'Power Tiller',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'chainsaw',             label: 'Chainsaw',               category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'cutlass',              label: 'Cutlass',                category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'hoe fork',             label: 'Hoe / Garden Fork',      category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'fishing net',          label: 'Fishing Net',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'fish cage',            label: 'Fish Cage / Pond Net',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'poultry cage',         label: 'Poultry Cage',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'farm boots',           label: 'Farm / Rain Boots',      category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'wheelbarrow',          label: 'Wheelbarrow',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'watering can',         label: 'Watering Can',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'greenhouse',           label: 'Greenhouse Structure',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'beehive',              label: 'Beehive / Apiary',       category: 'Agriculture', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // HEALTH & MEDICAL (25)
  // ═══════════════════════════════════════════════════════════

  { query: 'blood pressure monitor',   label: 'Blood Pressure Monitor',  category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'glucometer blood sugar',   label: 'Glucometer',              category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'pulse oximeter',           label: 'Pulse Oximeter',          category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'digital thermometer',      label: 'Digital Thermometer',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'oxygen concentrator',      label: 'Oxygen Concentrator',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'nebulizer',                label: 'Nebulizer',               category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'wheelchair',               label: 'Wheelchair',              category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'walking stick crutch',     label: 'Walking Stick / Crutch',  category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'massage chair',            label: 'Massage Chair',           category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'stethoscope',              label: 'Stethoscope',             category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'first aid kit',            label: 'First Aid Kit',           category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'surgical gloves',          label: 'Surgical Gloves (Box)',   category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'face mask surgical',       label: 'Face Mask (Box)',         category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'hearing aid',              label: 'Hearing Aid',             category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'weighing scale body',      label: 'Body Weighing Scale',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'baby weighing scale',      label: 'Baby Weighing Scale',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'dental equipment',         label: 'Dental Equipment',        category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'hospital furniture',       label: 'Hospital Equipment',      category: 'Health & Medical', jijiPath: '/ghana'            },
  { query: 'pregnancy test kit',       label: 'Pregnancy Test Kit',      category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'hair loss treatment',      label: 'Hair Loss Treatment',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'knee brace support',       label: 'Knee Brace / Support',    category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'back pain support belt',   label: 'Back Support Belt',       category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'blood glucose strips',     label: 'Glucose Test Strips',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'multivitamins supplement', label: 'Multivitamins',           category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'protein powder supplement',label: 'Protein Supplement',      category: 'Health & Medical', jijiPath: '/health-and-beauty' },

  // ═══════════════════════════════════════════════════════════
  // OFFICE & EDUCATION (25)
  // ═══════════════════════════════════════════════════════════

  { query: 'printer inkjet',       label: 'Inkjet Printer',         category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'laser printer',        label: 'Laser Printer',          category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'photocopier',          label: 'Photocopier',            category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'projector epson',      label: 'Projector',              category: 'Office & Education', jijiPath: '/electronics' },
  { query: 'whiteboard',           label: 'Whiteboard',             category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'school bag',           label: 'School Bag',             category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'scientific calculator',label: 'Scientific Calculator',  category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'shredder',             label: 'Paper Shredder',         category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'laminator',            label: 'Laminator',              category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'binding machine',      label: 'Binding Machine',        category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'cash register pos',    label: 'Cash Register / POS',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'barcode scanner',      label: 'Barcode Scanner',        category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'digital scale',        label: 'Digital Weighing Scale', category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'whiteboard marker',    label: 'Whiteboard Markers',     category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'drawing board',        label: 'Drawing Board',          category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'stapler',              label: 'Stapler (Heavy Duty)',   category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'money counter',        label: 'Money Counter Machine',  category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'label printer',        label: 'Label Printer',          category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'storage cabinet',      label: 'Storage Cabinet',        category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'cctv monitor',         label: 'Monitor Screen',         category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'keyboard mouse',       label: 'Keyboard & Mouse',       category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'external hard drive',  label: 'External Hard Drive',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'flash drive usb',      label: 'Flash Drive (USB)',      category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'ink cartridge',        label: 'Printer Ink Cartridge',  category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'extension board',      label: 'Extension Board',        category: 'Office & Education', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // SPORTS & FITNESS (20)
  // ═══════════════════════════════════════════════════════════

  { query: 'treadmill',            label: 'Treadmill',              category: 'Sports & Fitness', jijiPath: '/ghana' },
  { query: 'exercise bike',        label: 'Exercise Bike',          category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'rowing machine',       label: 'Rowing Machine',         category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'dumbbells weights',    label: 'Dumbbells / Weights',    category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'gym bench',            label: 'Gym Bench Press',        category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'pull up bar',          label: 'Pull-Up Bar',            category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'football',             label: 'Football',               category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'football boots',       label: 'Football Boots',         category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'basketball',           label: 'Basketball',             category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'tennis racket',        label: 'Tennis Racket',          category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'volleyball',           label: 'Volleyball',             category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'bicycle adult',        label: 'Bicycle (Adult)',        category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'mountain bike',        label: 'Mountain Bike',          category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'swimming goggles',     label: 'Swimming Goggles',       category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'yoga mat',             label: 'Yoga Mat',               category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'jump rope',            label: 'Jump Rope',              category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'boxing gloves',        label: 'Boxing Gloves',          category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'camping tent',         label: 'Camping Tent',           category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'golf clubs',           label: 'Golf Clubs',             category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'badminton racket',     label: 'Badminton Racket',       category: 'Sports & Fitness', jijiPath: '/sport' },

  // ═══════════════════════════════════════════════════════════
  // BABY & KIDS (20)
  // ═══════════════════════════════════════════════════════════

  { query: 'baby stroller pram',   label: 'Baby Stroller / Pram',  category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby car seat',        label: 'Baby Car Seat',         category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby walker',          label: 'Baby Walker',           category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby monitor',         label: 'Baby Monitor',          category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'high chair feeding',   label: 'High Chair',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby swing',           label: 'Baby Swing',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby bath tub',        label: 'Baby Bath Tub',         category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby carrier wrap',    label: 'Baby Carrier',          category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'children bicycle',     label: "Children's Bicycle",    category: 'Baby & Kids', jijiPath: '/sport' },
  { query: 'trampoline kids',      label: 'Trampoline',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'kids scooter',         label: "Kids' Scooter",         category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'lego toys',            label: 'Lego / Building Toys',  category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'toy car remote',       label: 'Remote Control Toy Car',category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'barbie doll',          label: 'Barbie / Doll',         category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'board game',           label: 'Board Game',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'kids tablet',          label: "Kids' Tablet",          category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'school bag primary',   label: 'School Bag (Primary)',  category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'diaper bag',           label: 'Diaper Bag',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby bottle sterilizer',label: 'Baby Bottle Sterilizer',category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'childrens shoe',       label: "Children's Shoes",      category: 'Baby & Kids', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // TOOLS & EQUIPMENT (20)
  // ═══════════════════════════════════════════════════════════

  { query: 'welding machine',      label: 'Welding Machine',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'angle grinder',        label: 'Angle Grinder',          category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'drill machine',        label: 'Drill Machine',          category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'circular saw',         label: 'Circular Saw',           category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'concrete mixer',       label: 'Concrete Mixer',         category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'air compressor',       label: 'Air Compressor',         category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'pressure washer',      label: 'Pressure Washer',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'tile cutter',          label: 'Tile Cutter',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'ladder 6ft',           label: 'Ladder 6ft',             category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'ladder 12ft',          label: 'Ladder 12ft',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'toolbox set',          label: 'Toolbox Set',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'electric jigsaw',      label: 'Electric Jigsaw',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'spray paint gun',      label: 'Spray Paint Gun',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'plumbing tools',       label: 'Plumbing Tools Set',     category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'sanding machine',      label: 'Sanding Machine',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'level tool',           label: 'Spirit Level',           category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'measuring tape',       label: 'Measuring Tape',         category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'scaffolding mobile',   label: 'Mobile Scaffolding',     category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'block machine',        label: 'Block Making Machine',   category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'hand saw',             label: 'Hand Saw',               category: 'Tools & Equipment', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // SECURITY & SAFETY (10)
  // ═══════════════════════════════════════════════════════════

  { query: 'electric fence energizer', label: 'Electric Fence',     category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'alarm system',          label: 'Burglar Alarm System',  category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'fire extinguisher',     label: 'Fire Extinguisher',     category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'safe vault money',      label: 'Safe / Vault',          category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'padlock',               label: 'Heavy-Duty Padlock',    category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'door lock smart',       label: 'Smart Door Lock',       category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'motion sensor light',   label: 'Motion Sensor Light',   category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'fire alarm',            label: 'Fire Alarm / Detector', category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'smoke detector',        label: 'Smoke Detector',        category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'spike strip security',  label: 'Security Spike Strip',  category: 'Security & Safety', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // REAL ESTATE & RENTALS (30)
  // ═══════════════════════════════════════════════════════════

  // Residential Rentals — Accra
  { query: 'single room rent accra',          label: 'Single Room (Accra)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'chamber hall rent accra',         label: 'Chamber & Hall (Accra)',         category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '1 bedroom apartment accra',       label: '1-Bed Apt (Accra)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom apartment accra',       label: '2-Bed Apt (Accra)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom apartment accra',       label: '3-Bed Apt (Accra)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom house rent accra',      label: '3-Bed House (Accra)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '4 bedroom house rent accra',      label: '4-Bed House (Accra)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Residential Rentals — Kumasi
  { query: 'single room rent kumasi',         label: 'Single Room (Kumasi)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '1 bedroom apartment kumasi',      label: '1-Bed Apt (Kumasi)',             category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom apartment kumasi',      label: '2-Bed Apt (Kumasi)',             category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom house rent kumasi',     label: '3-Bed House (Kumasi)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Residential Rentals — Other Cities
  { query: '2 bedroom apartment takoradi',    label: '2-Bed Apt (Takoradi)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom apartment tema',        label: '2-Bed Apt (Tema)',               category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom house tamale',          label: '2-Bed House (Tamale)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom apartment cape coast',  label: '2-Bed Apt (Cape Coast)',         category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Short-Let / Serviced Apartments
  { query: 'short let apartment accra',       label: 'Short Let Apt (Accra)',          category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'furnished apartment accra rent',  label: 'Furnished Apt (Accra)',          category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'serviced apartment accra',        label: 'Serviced Apt (Accra)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Commercial Rentals
  { query: 'office space rent accra',         label: 'Office Space (Accra)',           category: 'Real Estate', jijiPath: '/commercial-property-for-rent' },
  { query: 'shop store rent accra',           label: 'Shop / Store (Accra)',           category: 'Real Estate', jijiPath: '/commercial-property-for-rent' },
  { query: 'warehouse rent accra',            label: 'Warehouse (Accra)',              category: 'Real Estate', jijiPath: '/commercial-property-for-rent' },
  { query: 'office space rent kumasi',        label: 'Office Space (Kumasi)',          category: 'Real Estate', jijiPath: '/commercial-property-for-rent' },
  { query: 'shop for rent kumasi',            label: 'Shop / Store (Kumasi)',          category: 'Real Estate', jijiPath: '/commercial-property-for-rent' },

  // Commercial For Sale
  { query: 'office building for sale accra',  label: 'Office Building For Sale (Accra)',   category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'shop for sale accra',             label: 'Shop / Store For Sale (Accra)',      category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'warehouse for sale accra',        label: 'Warehouse For Sale (Accra)',         category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'factory industrial for sale',     label: 'Factory / Industrial (Accra)',       category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'plaza mall space for sale accra', label: 'Plaza / Mall Space (Accra)',         category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'office building for sale kumasi', label: 'Office Building For Sale (Kumasi)',  category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'shop for sale kumasi',            label: 'Shop / Store For Sale (Kumasi)',     category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'commercial land for sale accra',  label: 'Commercial Land (Accra)',            category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'filling station for sale ghana',  label: 'Filling Station For Sale',           category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'hotel guesthouse for sale ghana', label: 'Hotel / Guesthouse For Sale',        category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },

  // Land For Sale
  { query: 'land for sale accra',             label: 'Land (Accra)',                   category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale kumasi',            label: 'Land (Kumasi)',                  category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale tema',              label: 'Land (Tema)',                    category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale takoradi',          label: 'Land (Takoradi)',                category: 'Real Estate', jijiPath: '/land-plots-for-sale' },

  // Houses For Sale
  { query: '3 bedroom house sale accra',      label: '3-Bed House For Sale (Accra)',   category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '4 bedroom house sale accra',      label: '4-Bed House For Sale (Accra)',   category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '3 bedroom house sale kumasi',     label: '3-Bed House For Sale (Kumasi)',  category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },

  // ═══════════════════════════════════════════════════════════
  // ELECTRONICS & PHONES — EXPANSION (+50)
  // ═══════════════════════════════════════════════════════════

  // Phones — OnePlus / Oppo / Vivo / Motorola / Huawei
  { query: 'oneplus 12',            label: 'OnePlus 12',             category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'oppo reno 10',          label: 'Oppo Reno 10',           category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'oppo a98',              label: 'Oppo A98',               category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'vivo y100',             label: 'Vivo Y100',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'motorola edge 40',      label: 'Motorola Edge 40',       category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'motorola moto g',       label: 'Motorola Moto G',        category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'huawei nova 11',        label: 'Huawei Nova 11',         category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'nokia smartphone',      label: 'Nokia Smartphone',       category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'samsung s22',           label: 'Samsung S22',            category: 'Electronics', jijiPath: '/mobile-phones-tablets' },
  { query: 'iphone 11',             label: 'iPhone 11',              category: 'Electronics', jijiPath: '/mobile-phones-tablets' },

  // Computers — more models
  { query: 'acer laptop',           label: 'Acer Laptop',            category: 'Electronics', jijiPath: '/computers' },
  { query: 'microsoft surface',     label: 'Microsoft Surface',      category: 'Electronics', jijiPath: '/computers' },
  { query: 'gaming laptop',         label: 'Gaming Laptop',          category: 'Electronics', jijiPath: '/computers' },
  { query: 'chromebook',            label: 'Chromebook',             category: 'Electronics', jijiPath: '/computers' },
  { query: 'mini pc',               label: 'Mini PC',                category: 'Electronics', jijiPath: '/computers' },
  { query: 'all in one computer',   label: 'All-in-One Desktop',     category: 'Electronics', jijiPath: '/computers' },
  { query: 'second hand laptop',    label: 'Used Laptop (Refurbished)',category: 'Electronics',jijiPath: '/computers' },

  // TVs & Display — more sizes/brands
  { query: '65 inch tv',            label: 'TV 65 inch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: '75 inch tv',            label: 'TV 75 inch',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'sony bravia tv',        label: 'Sony Bravia TV',         category: 'Electronics', jijiPath: '/electronics' },
  { query: 'sharp tv',              label: 'Sharp TV',               category: 'Electronics', jijiPath: '/electronics' },
  { query: 'nasco tv',              label: 'Nasco TV',               category: 'Electronics', jijiPath: '/electronics' },
  { query: 'oled tv',               label: 'OLED TV',                category: 'Electronics', jijiPath: '/electronics' },
  { query: 'monitor 24 inch',       label: 'Monitor 24 inch',        category: 'Electronics', jijiPath: '/electronics' },
  { query: 'monitor 27 inch',       label: 'Monitor 27 inch',        category: 'Electronics', jijiPath: '/electronics' },

  // Audio
  { query: 'home theater system',   label: 'Home Theater System',    category: 'Electronics', jijiPath: '/electronics' },
  { query: 'woofer subwoofer',      label: 'Woofer / Subwoofer',     category: 'Electronics', jijiPath: '/electronics' },
  { query: 'headphones',            label: 'Over-Ear Headphones',    category: 'Electronics', jijiPath: '/electronics' },

  // Power — more
  { query: 'generator 10kva',       label: 'Generator 10KVA',        category: 'Electronics', jijiPath: '/generators' },
  { query: 'solar battery lithium', label: 'Lithium Solar Battery',  category: 'Electronics', jijiPath: '/electronics' },
  { query: 'inverter battery',      label: 'Inverter / Battery Pack',category: 'Electronics', jijiPath: '/electronics' },

  // Security — more
  { query: 'ip camera',             label: 'IP Camera (WiFi)',       category: 'Electronics', jijiPath: '/electronics' },
  { query: 'access control system', label: 'Access Control System',  category: 'Electronics', jijiPath: '/electronics' },
  { query: 'biometric attendance',  label: 'Biometric Device',       category: 'Electronics', jijiPath: '/electronics' },

  // Networking / Peripherals
  { query: 'fiber optic modem',     label: 'Fibre / ADSL Modem',     category: 'Electronics', jijiPath: '/electronics' },
  { query: 'network switch 24 port',label: 'Network Switch 24-Port', category: 'Electronics', jijiPath: '/electronics' },
  { query: 'external ssd',          label: 'External SSD',           category: 'Electronics', jijiPath: '/electronics' },
  { query: 'graphic card gpu',      label: 'Graphics Card (GPU)',     category: 'Electronics', jijiPath: '/computers' },
  { query: 'ram memory 16gb',       label: 'RAM 16GB',               category: 'Electronics', jijiPath: '/computers' },

  // Camera & Photography
  { query: 'dslr camera',           label: 'DSLR Camera',            category: 'Electronics', jijiPath: '/electronics' },
  { query: 'canon camera',          label: 'Canon Camera',           category: 'Electronics', jijiPath: '/electronics' },
  { query: 'nikon camera',          label: 'Nikon Camera',           category: 'Electronics', jijiPath: '/electronics' },
  { query: 'ring light photography',label: 'Ring Light',             category: 'Electronics', jijiPath: '/electronics' },
  { query: 'gimbal stabilizer',     label: 'Camera Gimbal',          category: 'Electronics', jijiPath: '/electronics' },

  // Gaming
  { query: 'gaming keyboard',       label: 'Gaming Keyboard',        category: 'Electronics', jijiPath: '/electronics' },
  { query: 'gaming mouse',          label: 'Gaming Mouse',           category: 'Electronics', jijiPath: '/electronics' },
  { query: 'gaming headset',        label: 'Gaming Headset',         category: 'Electronics', jijiPath: '/electronics' },
  { query: 'switch nintendo',       label: 'Nintendo Switch',        category: 'Electronics', jijiPath: '/electronics' },

  // ═══════════════════════════════════════════════════════════
  // VEHICLES — EXPANSION (+40)
  // ═══════════════════════════════════════════════════════════

  // More Toyota
  { query: 'toyota prado',          label: 'Toyota Land Cruiser Prado', category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota rush',           label: 'Toyota Rush',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota yaris',          label: 'Toyota Yaris',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota c hr',           label: 'Toyota C-HR',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'toyota harrier',        label: 'Toyota Harrier',         category: 'Vehicles', jijiPath: '/cars' },

  // Chinese brands (popular in Ghana)
  { query: 'haval h6',              label: 'Haval H6',               category: 'Vehicles', jijiPath: '/cars' },
  { query: 'haval jolion',          label: 'Haval Jolion',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'byd seal',              label: 'BYD Seal',               category: 'Vehicles', jijiPath: '/cars' },
  { query: 'byd atto',              label: 'BYD Atto 3',             category: 'Vehicles', jijiPath: '/cars' },
  { query: 'chery tiggo',           label: 'Chery Tiggo',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'mg zs',                 label: 'MG ZS',                  category: 'Vehicles', jijiPath: '/cars' },
  { query: 'mg 5',                  label: 'MG 5',                   category: 'Vehicles', jijiPath: '/cars' },
  { query: 'geely',                 label: 'Geely',                  category: 'Vehicles', jijiPath: '/cars' },

  // Other European / American
  { query: 'peugeot 308',           label: 'Peugeot 308',            category: 'Vehicles', jijiPath: '/cars' },
  { query: 'peugeot 3008',          label: 'Peugeot 3008',           category: 'Vehicles', jijiPath: '/cars' },
  { query: 'audi a4',               label: 'Audi A4',                category: 'Vehicles', jijiPath: '/cars' },
  { query: 'audi q5',               label: 'Audi Q5',                category: 'Vehicles', jijiPath: '/cars' },
  { query: 'subaru forester',       label: 'Subaru Forester',        category: 'Vehicles', jijiPath: '/cars' },
  { query: 'jeep grand cherokee',   label: 'Jeep Grand Cherokee',    category: 'Vehicles', jijiPath: '/cars' },
  { query: 'chevrolet trailblazer', label: 'Chevrolet Trailblazer',  category: 'Vehicles', jijiPath: '/cars' },

  // More commercial
  { query: 'isuzu truck',           label: 'Isuzu Truck',            category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'hino truck',            label: 'Hino Truck',             category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'man truck',             label: 'MAN Truck',              category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'daf truck',             label: 'DAF Truck',              category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'tipper truck',          label: 'Tipper / Dump Truck',    category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'refrigerated truck',    label: 'Refrigerated Truck',     category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'flatbed trailer',       label: 'Flatbed Trailer',        category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'water tanker truck',    label: 'Water Tanker Truck',     category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'fuel tanker truck',     label: 'Fuel Tanker Truck',      category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'forklift',              label: 'Forklift',               category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'excavator',             label: 'Excavator',              category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'bulldozer',             label: 'Bulldozer',              category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'grader machine',        label: 'Motor Grader',           category: 'Vehicles', jijiPath: '/ghana' },

  // Boats
  { query: 'canoe boat',            label: 'Canoe / Fishing Boat',   category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'speedboat',             label: 'Speedboat',              category: 'Vehicles', jijiPath: '/ghana' },

  // Electric vehicles
  { query: 'electric car ev',       label: 'Electric Car (EV)',      category: 'Vehicles', jijiPath: '/cars' },
  { query: 'electric motorbike',    label: 'Electric Motorbike',     category: 'Vehicles', jijiPath: '/ghana' },
  { query: 'solar tricycle',        label: 'Solar / Electric Tricycle', category: 'Vehicles', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // BUILDING MATERIALS — EXPANSION (+40)
  // ═══════════════════════════════════════════════════════════

  // More cement brands
  { query: 'cimaf cement',          label: 'CIMAF Cement',           category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'portland cement',       label: 'Portland Cement',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'rapid set cement',      label: 'Rapid Set Cement',       category: 'Building Materials', jijiPath: '/building-materials' },

  // More steel / iron
  { query: 'iron rod 8mm',          label: 'Iron Rod 8mm',           category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'hollow section square pipe', label: 'Square Hollow Section', category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'angle iron',            label: 'Angle Iron',             category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'gi pipe galvanized',    label: 'GI Pipe (Galvanized)',   category: 'Building Materials', jijiPath: '/building-materials' },

  // More roofing
  { query: 'stone coated tile roof',label: 'Stone Coated Roof Tile', category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'polycarbonate roofing', label: 'Polycarbonate Roofing',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'flat roof membrane',    label: 'Waterproof Membrane',    category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'ceiling board',         label: 'Ceiling Board',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'plaster of paris pop',  label: 'POP / Plaster',         category: 'Building Materials', jijiPath: '/building-materials' },

  // Tiles & countertops
  { query: 'granite countertop',    label: 'Granite Countertop',     category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'terrazzo tile',         label: 'Terrazzo Tile',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'outdoor paving stones', label: 'Paving Stones',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'carpet flooring',       label: 'Carpet Flooring',        category: 'Building Materials', jijiPath: '/building-materials' },

  // Paint & finishing
  { query: 'jotun paint',           label: 'Jotun Paint',            category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'sika waterproofing',    label: 'Sika Products',          category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'wood stain varnish',    label: 'Wood Stain / Varnish',   category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'epoxy floor coating',   label: 'Epoxy Floor Coating',    category: 'Building Materials', jijiPath: '/building-materials' },

  // Plumbing
  { query: 'mixer tap basin',       label: 'Basin Mixer Tap',        category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'shower enclosure',      label: 'Shower Enclosure',       category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'kitchen sink stainless',label: 'Kitchen Sink (Stainless)',category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'water meter',           label: 'Water Meter',            category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'pvc tank 1000l',        label: 'PVC Storage Tank 1000L', category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'ppe protective gloves', label: 'PPE / Work Gloves',      category: 'Building Materials', jijiPath: '/building-materials' },

  // Electrical
  { query: 'circuit breaker mcb',   label: 'Circuit Breaker (MCB)',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'distribution board db', label: 'Distribution Board',     category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'light switch socket',   label: 'Light Switch & Socket',  category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'led downlight',         label: 'LED Downlight / Bulb',   category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'solar street light',    label: 'Solar Street Light',     category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'transformer electric',  label: 'Transformer (Electric)', category: 'Building Materials', jijiPath: '/ghana'              },

  // Insulation & other
  { query: 'rock wool insulation',  label: 'Rock Wool / Insulation', category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'glass wool blanket',    label: 'Glass Wool',             category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'staircase railing',     label: 'Staircase Railing',      category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'fence gate metal',      label: 'Metal Gate / Fence',     category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'roller shutter',        label: 'Roller Shutter',         category: 'Building Materials', jijiPath: '/building-materials' },
  { query: 'drainage channel',      label: 'Drainage Channel',       category: 'Building Materials', jijiPath: '/building-materials' },

  // ═══════════════════════════════════════════════════════════
  // HOME APPLIANCES — EXPANSION (+30)
  // ═══════════════════════════════════════════════════════════

  // More AC brands
  { query: 'midea air conditioner', label: 'Midea Air Conditioner',  category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'daikin air conditioner',label: 'Daikin Air Conditioner', category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'panasonic air conditioner',label:'Panasonic AC',         category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'air conditioner 3hp',   label: 'Air Conditioner 3HP',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'cassette air conditioner',label: 'Cassette AC (Ceiling)',category: 'Appliances', jijiPath: '/home-appliances' },

  // More fridges/freezers
  { query: 'bosch refrigerator',    label: 'Bosch Refrigerator',     category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'tcl refrigerator',      label: 'TCL Refrigerator',       category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'midea refrigerator',    label: 'Midea Refrigerator',     category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'side by side fridge',   label: 'Side-by-Side Fridge',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'wine cooler',           label: 'Wine Cooler / Bar Fridge',category: 'Appliances', jijiPath: '/home-appliances' },

  // More washing machines
  { query: 'twin tub washing machine',label: 'Twin Tub Washing Machine', category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'dryer machine',         label: 'Clothes Dryer',          category: 'Appliances', jijiPath: '/home-appliances' },

  // More cookers / ovens
  { query: 'gas cooker 6 burner',   label: 'Gas Cooker 6-Burner',    category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'standing oven',         label: 'Standing Oven',          category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'built in oven',         label: 'Built-in Oven',          category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'electric hotplate',     label: 'Electric Hotplate',      category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'pressure cooker',       label: 'Pressure Cooker',        category: 'Appliances', jijiPath: '/home-appliances' },

  // Commercial kitchen
  { query: 'commercial oven bakery',label: 'Commercial Oven (Bakery)',category: 'Appliances', jijiPath: '/ghana' },
  { query: 'chest freezer commercial',label: 'Commercial Chest Freezer',category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'display fridge chiller',label: 'Display Fridge / Chiller',category: 'Appliances', jijiPath: '/ghana' },
  { query: 'slush machine',         label: 'Slush / Ice Cream Machine',category: 'Appliances', jijiPath: '/ghana' },
  { query: 'popcorn machine',       label: 'Popcorn Machine',        category: 'Appliances', jijiPath: '/ghana' },

  // Personal care
  { query: 'curling iron hair',     label: 'Hair Curling Iron',      category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'beard trimmer',         label: 'Beard Trimmer',          category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'epilator',              label: 'Epilator',               category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'massager back',         label: 'Back Massager',          category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'foot massager',         label: 'Foot Massager',          category: 'Appliances', jijiPath: '/home-appliances' },

  // Misc
  { query: 'dehumidifier',          label: 'Dehumidifier',           category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'robot vacuum cleaner',  label: 'Robot Vacuum',           category: 'Appliances', jijiPath: '/home-appliances' },
  { query: 'stand mixer kitchen',   label: 'Stand Mixer',            category: 'Appliances', jijiPath: '/home-appliances' },

  // ═══════════════════════════════════════════════════════════
  // FURNITURE — EXPANSION (+25)
  // ═══════════════════════════════════════════════════════════

  { query: 'outdoor garden sofa',   label: 'Outdoor / Garden Sofa',  category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'hammock',               label: 'Hammock',                category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'patio umbrella',        label: 'Patio Umbrella',         category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'bar counter',           label: 'Bar Counter',            category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'pool table billiard',   label: 'Pool / Billiard Table',  category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'foosball table',        label: 'Foosball Table',         category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'spa bed massage table', label: 'Massage / Spa Table',    category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'church chair stackable',label: 'Church / Stackable Chair',category: 'Furniture', jijiPath: '/ghana'             },
  { query: 'school desk chair',     label: 'School Desk & Chair',    category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'cafeteria bench table', label: 'Cafeteria Bench Set',    category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'banquet round table',   label: 'Banquet Round Table',    category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'children study desk',   label: 'Children Study Desk',    category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'wall mirror large',     label: 'Large Wall Mirror',      category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'bedside table',         label: 'Bedside Table',          category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'chest of drawers',      label: 'Chest of Drawers',       category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'locker cabinet metal',  label: 'Metal Locker Cabinet',   category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'waiting room bench',    label: 'Waiting Room Bench',     category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'restaurant chair',      label: 'Restaurant Chair',       category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'curtain rod blinds',    label: 'Curtains / Blinds',      category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'carpet rug large',      label: 'Carpet / Rug',           category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'flower pot planter',    label: 'Flower Pot / Planter',   category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'picture frame wall art',label: 'Wall Art / Picture Frame',category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'swivel office chair',   label: 'Swivel Office Chair',    category: 'Furniture', jijiPath: '/furniture-and-decor' },
  { query: 'conference table',      label: 'Conference Table',       category: 'Furniture', jijiPath: '/ghana'              },
  { query: 'telephone stand',       label: 'Telephone / Side Stand', category: 'Furniture', jijiPath: '/furniture-and-decor' },

  // ═══════════════════════════════════════════════════════════
  // VEHICLE PARTS — EXPANSION (+25)
  // ═══════════════════════════════════════════════════════════

  { query: 'car tyre 225 45',       label: 'Car Tyre 225/45',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car tyre 235 55',       label: 'Car Tyre 235/55',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'run flat tyre',         label: 'Run-Flat Tyre',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'alloy rim wheel',       label: 'Alloy Rim / Wheel',      category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car alarm system',      label: 'Car Alarm System',       category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car tracker gps',       label: 'Car GPS Tracker',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'coolant antifreeze',    label: 'Coolant / Antifreeze',   category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'transmission fluid',    label: 'Transmission Fluid',     category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car battery charger',   label: 'Car Battery Charger',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'wheel bearing',         label: 'Wheel Bearing',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'cv joint boot',         label: 'CV Joint / Boot',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'tie rod end',           label: 'Tie Rod End',            category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'ignition coil',         label: 'Ignition Coil',          category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'mass air flow sensor',  label: 'Mass Airflow Sensor',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'oxygen sensor',         label: 'Oxygen / Lambda Sensor', category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'engine mount',          label: 'Engine Mount',           category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'timing belt chain',     label: 'Timing Belt / Chain',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'auto windscreen',       label: 'Windscreen / Windshield',category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'side mirror car',       label: 'Side Mirror',            category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car radio android',     label: 'Android Car Radio',      category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'reverse camera',        label: 'Reverse Camera',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car led lights',        label: 'LED Car Lights',         category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'car cover dust',        label: 'Car Cover (Dust)',       category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'tow bar hitch',         label: 'Tow Bar / Hitch',        category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },
  { query: 'roof rack carrier',     label: 'Roof Rack / Carrier',    category: 'Vehicle Parts', jijiPath: '/car-parts-and-accessories' },

  // ═══════════════════════════════════════════════════════════
  // FOOD & FMCG — EXPANSION (+30)
  // ═══════════════════════════════════════════════════════════

  { query: 'pasta spaghetti',       label: 'Pasta / Spaghetti',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'cornflakes oats',       label: 'Cornflakes / Oats',      category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'biscuits crackers',     label: 'Biscuits / Crackers',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'chocolate drink',       label: 'Chocolate Drink',        category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'soft drinks soda',      label: 'Soft Drinks (Crate)',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'fruit juice carton',    label: 'Fruit Juice (Carton)',   category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'energy drink',          label: 'Energy Drinks',          category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'beer crate',            label: 'Beer (Crate)',           category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'malta guiness',         label: 'Malta / Malt Drink',     category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'yogurt',                label: 'Yogurt',                 category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'cheese',                label: 'Cheese',                 category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'honey jar',             label: 'Honey (Jar)',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'powdered milk tin',     label: 'Powdered Milk (Tin)',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'coffee nescafe',        label: 'Coffee / Nescafe',       category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'table salt',            label: 'Table Salt',             category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'seasoning cube',        label: 'Seasoning / Maggi Cube', category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'canned tuna',           label: 'Canned Tuna',            category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'soya milk',             label: 'Soya Milk',              category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'vinegar bottle',        label: 'Vinegar',                category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'soya oil',              label: 'Soya Oil',               category: 'Food & FMCG', jijiPath: '/ghana' },
  // Household
  { query: 'dishwashing liquid',    label: 'Dishwashing Liquid',     category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'toilet cleaner',        label: 'Toilet / Bathroom Cleaner', category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'insect killer spray',   label: 'Insect Killer Spray',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'air freshener',         label: 'Air Freshener',          category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'floor cleaner mop',     label: 'Floor Cleaner',          category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'tissue paper roll',     label: 'Tissue Paper (Roll)',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'black soap',            label: 'Black Soap (Alata Samina)', category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'deodorant roll on',     label: 'Deodorant / Roll-On',    category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'face wash cleanser',    label: 'Face Wash / Cleanser',   category: 'Food & FMCG', jijiPath: '/ghana' },
  { query: 'sunscreen spf',         label: 'Sunscreen SPF',          category: 'Food & FMCG', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // FASHION & CLOTHING — EXPANSION (+30)
  // ═══════════════════════════════════════════════════════════

  // More shoes
  { query: 'converse sneakers',     label: 'Converse Sneakers',      category: 'Fashion', jijiPath: '/ghana' },
  { query: 'new balance sneakers',  label: 'New Balance Sneakers',   category: 'Fashion', jijiPath: '/ghana' },
  { query: 'timberland boots',      label: 'Timberland Boots',       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'loafers shoes men',     label: "Men's Loafers",          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'flat shoes ladies',     label: "Ladies' Flat Shoes",     category: 'Fashion', jijiPath: '/ghana' },

  // More clothing
  { query: 'ankara dress',          label: 'Ankara Dress',           category: 'Fashion', jijiPath: '/ghana' },
  { query: 'kaba and slit',         label: 'Kaba & Slit',            category: 'Fashion', jijiPath: '/ghana' },
  { query: 'kaftan boubou',         label: 'Kaftan / Boubou',        category: 'Fashion', jijiPath: '/ghana' },
  { query: 'agbada',                label: 'Agbada',                 category: 'Fashion', jijiPath: '/ghana' },
  { query: 'batakari smock',        label: 'Batakari / Smock',       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'men jogger trouser',    label: "Men's Jogger Trousers",  category: 'Fashion', jijiPath: '/ghana' },
  { query: 'ladies legging',        label: "Ladies' Leggings",       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'hoodie sweatshirt',     label: 'Hoodie / Sweatshirt',    category: 'Fashion', jijiPath: '/ghana' },
  { query: 'wedding dress',         label: 'Wedding Dress / Gown',   category: 'Fashion', jijiPath: '/ghana' },
  { query: 'corporate skirt suit',  label: 'Corporate Skirt Suit',   category: 'Fashion', jijiPath: '/ghana' },
  { query: 'uniform workwear',      label: 'Workwear / Uniform',     category: 'Fashion', jijiPath: '/ghana' },

  // Bags / Accessories
  { query: 'travel suitcase luggage',label: 'Travel Suitcase / Luggage',category: 'Fashion', jijiPath: '/ghana' },
  { query: 'laptop bag',            label: 'Laptop Bag',             category: 'Fashion', jijiPath: '/ghana' },
  { query: 'waist bag fanny pack',  label: 'Waist Bag / Fanny Pack', category: 'Fashion', jijiPath: '/ghana' },

  // Jewellery
  { query: 'diamond earrings',      label: 'Diamond Earrings',       category: 'Fashion', jijiPath: '/ghana' },
  { query: 'pearl necklace',        label: 'Pearl Necklace',         category: 'Fashion', jijiPath: '/ghana' },
  { query: 'silver ring',           label: 'Silver Ring',            category: 'Fashion', jijiPath: '/ghana' },

  // Grooming
  { query: 'wig lace front',        label: 'Lace Front Wig',         category: 'Fashion', jijiPath: '/ghana' },
  { query: 'braiding hair',         label: 'Braiding Hair / Yarn',   category: 'Fashion', jijiPath: '/ghana' },
  { query: 'makeup foundation',     label: 'Makeup Foundation',      category: 'Fashion', jijiPath: '/ghana' },
  { query: 'mascara eyeliner',      label: 'Mascara / Eyeliner',     category: 'Fashion', jijiPath: '/ghana' },
  { query: 'nail polish',           label: 'Nail Polish',            category: 'Fashion', jijiPath: '/ghana' },
  { query: 'pocket square',         label: 'Pocket Square',          category: 'Fashion', jijiPath: '/ghana' },
  { query: 'bow tie',               label: 'Bow Tie',                category: 'Fashion', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // AGRICULTURE — EXPANSION (+30)
  // ═══════════════════════════════════════════════════════════

  // More seeds & seedlings
  { query: 'cocoa seedlings',       label: 'Cocoa Seedlings',        category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'oil palm seedlings',    label: 'Oil Palm Seedlings',     category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'plantain suckers',      label: 'Plantain Suckers',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'cassava cuttings',      label: 'Cassava Cuttings',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'rice seeds',            label: 'Rice Seeds / Varieties', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'soybean seeds',         label: 'Soybean Seeds',          category: 'Agriculture', jijiPath: '/ghana' },

  // More fertilizers / chemicals
  { query: 'calcium nitrate fertilizer',label: 'Calcium Nitrate Fertilizer', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'micronutrient foliar',  label: 'Foliar Micronutrient',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'weedicide',             label: 'Weedicide',              category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'rodenticide rat poison',label: 'Rodenticide / Rat Poison',category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'neem extract',          label: 'Neem Extract (Organic)', category: 'Agriculture', jijiPath: '/ghana' },

  // More livestock / poultry
  { query: 'turkey birds',          label: 'Turkey Birds',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'guinea fowl',           label: 'Guinea Fowl',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'goat sheep',            label: 'Goat / Sheep',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'cattle cow',            label: 'Cattle / Cow',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'pig piglet',            label: 'Pig / Piglet',           category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'rabbit',                label: 'Rabbit',                 category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'catfish fingerlings',   label: 'Catfish Fingerlings',    category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'tilapia fingerlings',   label: 'Tilapia Fingerlings',    category: 'Agriculture', jijiPath: '/ghana' },

  // More machinery / equipment
  { query: 'rice huller miller',    label: 'Rice Huller / Miller',   category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'maize sheller',         label: 'Maize Sheller',          category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'groundnut sheller',     label: 'Groundnut Sheller',      category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'cassava grater',        label: 'Cassava Grater Machine', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'palm oil press',        label: 'Palm Oil Press',         category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'biomass shredder',      label: 'Biomass / Garden Shredder', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'water borehole pump',   label: 'Borehole / Submersible Pump', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'irrigation valve',      label: 'Irrigation Valve / Timer',category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'compost bin',           label: 'Compost Bin',            category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'soil testing kit',      label: 'Soil Testing Kit',       category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'thermometer greenhouse',label: 'Greenhouse Thermometer', category: 'Agriculture', jijiPath: '/ghana' },
  { query: 'weighing scale farm 200kg',label:'Weighing Scale 200kg', category: 'Agriculture', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // HEALTH & MEDICAL — EXPANSION (+25)
  // ═══════════════════════════════════════════════════════════

  { query: 'ecg machine',           label: 'ECG Machine',            category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'ultrasound machine',    label: 'Ultrasound Machine',     category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'examination table',     label: 'Examination Table',      category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'autoclave sterilizer',  label: 'Autoclave Sterilizer',   category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'iv drip stand',         label: 'IV Drip Stand',          category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'surgical mask n95',     label: 'N95 / KN95 Mask',        category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'forehead thermometer',  label: 'Forehead Thermometer',   category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'cpap machine',          label: 'CPAP Machine',           category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'stretcher',             label: 'Stretcher / Gurney',     category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'defibrillator aed',     label: 'AED Defibrillator',      category: 'Health & Medical', jijiPath: '/ghana' },
  { query: 'hot compress pad',      label: 'Hot / Cold Compress Pad',category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'cervical neck collar',  label: 'Cervical Neck Collar',   category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'wrist brace',           label: 'Wrist Brace / Support',  category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'ankle brace',           label: 'Ankle Brace / Support',  category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'diabetic socks',        label: 'Diabetic Socks',         category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'compression stockings', label: 'Compression Stockings',  category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'collagen supplement',   label: 'Collagen Supplement',    category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'omega 3 fish oil',      label: 'Omega-3 / Fish Oil',     category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'vitamin c supplement',  label: 'Vitamin C Supplement',   category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'herbal supplement',     label: 'Herbal Supplement',      category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'dental chair',          label: 'Dental Chair',           category: 'Health & Medical', jijiPath: '/ghana'            },
  { query: 'microscope laboratory', label: 'Laboratory Microscope',  category: 'Health & Medical', jijiPath: '/ghana'            },
  { query: 'cholesterol test kit',  label: 'Cholesterol Test Kit',   category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'malaria test kit',      label: 'Malaria Test Kit (RDT)', category: 'Health & Medical', jijiPath: '/health-and-beauty' },
  { query: 'urine test strip',      label: 'Urine Test Strip',       category: 'Health & Medical', jijiPath: '/health-and-beauty' },

  // ═══════════════════════════════════════════════════════════
  // OFFICE & EDUCATION — EXPANSION (+25)
  // ═══════════════════════════════════════════════════════════

  { query: 'pos machine payment',   label: 'POS Payment Terminal',   category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'receipt printer thermal',label: 'Thermal Receipt Printer',category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'card reader nfc',       label: 'Card Reader (NFC)',       category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'scanner flatbed',       label: 'Flatbed Scanner',        category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'cctv dvr recorder',     label: 'DVR Recorder',           category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'electric letterhead',   label: 'Letterhead / Stationery',category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'conference speaker',    label: 'Conference Speaker',     category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'video conferencing',    label: 'Video Conferencing System',category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'digital signage screen',label: 'Digital Signage Screen', category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'interactive whiteboard',label: 'Interactive Whiteboard', category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'teaching aids flashcards',label: 'Teaching Aids / Flashcards', category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'globe map',             label: 'Globe / World Map',      category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'scientific books textbooks',label: 'Textbooks',          category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'stationery set',        label: 'Stationery Set',         category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'shredder cross cut',    label: 'Cross-Cut Shredder',     category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'time attendance machine',label: 'Attendance Machine',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'vault safe office',     label: 'Office Safe / Vault',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'fingerprint scanner',   label: 'Fingerprint Scanner',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'uv lamp sterilizer',    label: 'UV Sterilizer Lamp',     category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'air purifier office',   label: 'Air Purifier',           category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'locker staff',          label: 'Staff Locker',           category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'first aid cabinet',     label: 'First Aid Cabinet',      category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'notice board cork',     label: 'Notice / Cork Board',    category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'numbering machine',     label: 'Numbering Machine',      category: 'Office & Education', jijiPath: '/ghana' },
  { query: 'hole punch machine',    label: 'Hole Punch Machine',     category: 'Office & Education', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // SPORTS & FITNESS — EXPANSION (+20)
  // ═══════════════════════════════════════════════════════════

  { query: 'elliptical trainer',    label: 'Elliptical Trainer',     category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'weight bench adjustable',label: 'Adjustable Weight Bench',category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'barbell set',           label: 'Barbell & Weight Set',   category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'kettlebell',            label: 'Kettlebell',             category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'resistance bands',      label: 'Resistance Bands',       category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'chin up pull up station',label: 'Pull-Up / Chin-Up Station', category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'speed bag punching',    label: 'Speed Bag / Punching Bag',category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'martial arts uniform',  label: 'Martial Arts Uniform',   category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'cricket bat',           label: 'Cricket Bat',            category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'table tennis set',      label: 'Table Tennis Set',       category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'badminton shuttlecock', label: 'Badminton Shuttlecock',  category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'swimming cap goggles',  label: 'Swimming Cap & Goggles', category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'hiking boots',          label: 'Hiking Boots',           category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'cycling jersey',        label: 'Cycling Jersey',         category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'football goal post',    label: 'Football Goal Post',     category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'fishing rod reel',      label: 'Fishing Rod & Reel',     category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'hunting air gun',       label: 'Air Gun / Pellet Gun',   category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'skipping rope',         label: 'Skipping Rope',          category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'foam roller',           label: 'Foam Roller',            category: 'Sports & Fitness', jijiPath: '/sport' },
  { query: 'sports bag gym',        label: 'Sports / Gym Bag',       category: 'Sports & Fitness', jijiPath: '/sport' },

  // ═══════════════════════════════════════════════════════════
  // BABY & KIDS — EXPANSION (+15)
  // ═══════════════════════════════════════════════════════════

  { query: 'breast pump',           label: 'Breast Pump',            category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby food blender',     label: 'Baby Food Blender',      category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby humidifier',       label: 'Baby Humidifier',        category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby clothes newborn',  label: 'Baby Clothes (Newborn)', category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'kids smart watch',      label: "Kids' Smart Watch",      category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'educational toys',      label: 'Educational Toys',       category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'play mat foam',         label: 'Play Mat / Foam Mat',    category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'toy kitchen set',       label: 'Toy Kitchen Set',        category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'action figure toy',     label: 'Action Figure / Toy',    category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'jigsaw puzzle kids',    label: 'Jigsaw Puzzle (Kids)',   category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'baby gate safety',      label: 'Baby Safety Gate',       category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'bed rail guard',        label: 'Bed Rail / Guard',       category: 'Baby & Kids', jijiPath: '/ghana' },
  { query: 'kids balance bike',     label: 'Balance Bike (Kids)',    category: 'Baby & Kids', jijiPath: '/sport' },
  { query: 'kids rollerblades',     label: "Kids' Rollerblades",     category: 'Baby & Kids', jijiPath: '/sport' },
  { query: 'bouncy castle inflatable',label: 'Bouncy Castle',        category: 'Baby & Kids', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // TOOLS & EQUIPMENT — EXPANSION (+20)
  // ═══════════════════════════════════════════════════════════

  { query: 'impact wrench',         label: 'Impact Wrench',          category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'nail gun',              label: 'Nail Gun',               category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'heat gun',              label: 'Heat Gun',               category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'soldering iron',        label: 'Soldering Iron',         category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'multimeter tester',     label: 'Multimeter / Tester',    category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'oscilloscope',          label: 'Oscilloscope',           category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'generator service kit', label: 'Generator Service Kit',  category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'pipe wrench',           label: 'Pipe Wrench',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'bolt cutter',           label: 'Bolt Cutter',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'ratchet set',           label: 'Ratchet & Socket Set',   category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'cordless drill',        label: 'Cordless Drill',         category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'electric planer',       label: 'Electric Planer',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'router wood',           label: 'Wood Router',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'lathe machine',         label: 'Lathe Machine',          category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'metal bender',          label: 'Metal Bending Machine',  category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'cable tester',          label: 'Cable Tester',           category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'chalk line reel',       label: 'Chalk Line Reel',        category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'pipe cutter',           label: 'Pipe Cutter',            category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'generator spare parts', label: 'Generator Spare Parts',  category: 'Tools & Equipment', jijiPath: '/ghana' },
  { query: 'inverter welder',       label: 'Inverter Welder',        category: 'Tools & Equipment', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // SECURITY & SAFETY — EXPANSION (+15)
  // ═══════════════════════════════════════════════════════════

  { query: 'fire suppression system',label: 'Fire Suppression System',category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'emergency exit sign',   label: 'Emergency Exit Sign',    category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'fire hose reel',        label: 'Fire Hose Reel',         category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'hard hat helmet',       label: 'Safety Helmet / Hard Hat',category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'reflective vest',       label: 'Reflective Safety Vest', category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'safety harness',        label: 'Safety Harness',         category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'safety goggles',        label: 'Safety Goggles',         category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'first aid box kit',     label: 'First Aid Box',          category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'intercom system',       label: 'Intercom / Video Doorbell',category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'perimeter alarm',       label: 'Perimeter Alarm',        category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'x ray baggage scanner', label: 'Baggage X-Ray Scanner',  category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'metal detector',        label: 'Metal Detector',         category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'guard booth',           label: 'Security Guard Booth',   category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'boom barrier gate',     label: 'Boom Barrier / Gate',    category: 'Security & Safety', jijiPath: '/ghana' },
  { query: 'razor wire coil',       label: 'Razor Wire / Concertina',category: 'Security & Safety', jijiPath: '/ghana' },

  // ═══════════════════════════════════════════════════════════
  // REAL ESTATE — EXPANSION (+42)
  // ═══════════════════════════════════════════════════════════

  // More Accra residential
  { query: '5 bedroom house rent accra',       label: '5-Bed House (Accra)',             category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'studio apartment accra',           label: 'Studio Apt (Accra)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '1 bedroom house rent accra',       label: '1-Bed House (Accra)',             category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'executive house rent east legon',  label: 'Executive House East Legon',      category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'apartment rent airport residential',label:'Apt (Airport Residential)',       category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'apartment rent cantonments accra', label: 'Apt (Cantonments)',               category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'room rent madina accra',           label: 'Room (Madina)',                   category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'room rent adenta accra',           label: 'Room (Adenta)',                   category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'apartment rent spintex accra',     label: 'Apt (Spintex)',                   category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'apartment rent north legon',       label: 'Apt (North Legon)',               category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'apartment rent teshie accra',      label: 'Apt (Teshie)',                    category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'room rent labadi accra',           label: 'Room (Labadi)',                   category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Kumasi more
  { query: '3 bedroom apartment kumasi',       label: '3-Bed Apt (Kumasi)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'studio apartment kumasi',          label: 'Studio Apt (Kumasi)',             category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: 'executive house kumasi',           label: 'Executive House (Kumasi)',        category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Other cities more
  { query: '1 bedroom apartment takoradi',     label: '1-Bed Apt (Takoradi)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom house takoradi',         label: '3-Bed House (Takoradi)',          category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '1 bedroom apartment tema',         label: '1-Bed Apt (Tema)',                category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom house tema',             label: '3-Bed House (Tema)',              category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom house tamale',           label: '2-Bed House (Tamale)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '3 bedroom house tamale',           label: '3-Bed House (Tamale)',            category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom house ho volta',         label: '2-Bed House (Ho)',                category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom house sunyani',          label: '2-Bed House (Sunyani)',           category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },
  { query: '2 bedroom house koforidua',        label: '2-Bed House (Koforidua)',         category: 'Real Estate', jijiPath: '/houses-apartments-for-rent' },

  // Houses for sale — more
  { query: '2 bedroom house sale accra',       label: '2-Bed House For Sale (Accra)',    category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '5 bedroom house sale accra',       label: '5-Bed House For Sale (Accra)',    category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: 'townhouse sale accra',             label: 'Townhouse For Sale (Accra)',      category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: 'detached house sale east legon',   label: 'Detached House East Legon',       category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: 'duplex house for sale accra',      label: 'Duplex For Sale (Accra)',         category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '2 bedroom house sale kumasi',      label: '2-Bed House For Sale (Kumasi)',   category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '4 bedroom house sale kumasi',      label: '4-Bed House For Sale (Kumasi)',   category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '3 bedroom house sale tema',        label: '3-Bed House For Sale (Tema)',     category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '3 bedroom house sale takoradi',    label: '3-Bed House For Sale (Takoradi)', category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },

  // Apartments for sale
  { query: '1 bedroom apartment sale accra',   label: '1-Bed Apt For Sale (Accra)',      category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '2 bedroom apartment sale accra',   label: '2-Bed Apt For Sale (Accra)',      category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '3 bedroom apartment sale accra',   label: '3-Bed Apt For Sale (Accra)',      category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },
  { query: '2 bedroom apartment sale kumasi',  label: '2-Bed Apt For Sale (Kumasi)',     category: 'Real Estate', jijiPath: '/houses-apartments-for-sale' },

  // More commercial
  { query: 'shop for sale takoradi',           label: 'Shop For Sale (Takoradi)',        category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'office space for sale tema',       label: 'Office Space For Sale (Tema)',    category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },
  { query: 'school building for sale ghana',   label: 'School Building For Sale',        category: 'Real Estate', jijiPath: '/commercial-property-for-sale' },

  // More land
  { query: 'land for sale tamale',             label: 'Land (Tamale)',                   category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale cape coast',         label: 'Land (Cape Coast)',               category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale ho',                 label: 'Land (Ho)',                       category: 'Real Estate', jijiPath: '/land-plots-for-sale' },
  { query: 'land for sale sunyani',            label: 'Land (Sunyani)',                  category: 'Real Estate', jijiPath: '/land-plots-for-sale' },

  // ─── Top-up to reach 1000 ────────────────────────────────────
  { query: 'warehouse for rent accra',          label: 'Warehouse For Rent (Accra)',       category: 'Real Estate',        jijiPath: '/commercial-property-for-rent' },
  { query: 'studio apartment rent accra',       label: 'Studio Apt For Rent (Accra)',      category: 'Real Estate',        jijiPath: '/houses-apartments-for-rent'   },
  { query: 'gym equipment ghana',               label: 'Gym Equipment',                    category: 'Sports & Fitness',   jijiPath: '/sports-outdoors'               },
  { query: 'treadmill ghana',                   label: 'Treadmill',                        category: 'Sports & Fitness',   jijiPath: '/sports-outdoors'               },
  { query: 'school bag ghana',                  label: 'School Bag',                       category: 'Baby & Kids',        jijiPath: '/kids-fashion'                  },
  { query: 'children mattress ghana',           label: "Children's Mattress",              category: 'Baby & Kids',        jijiPath: '/baby-products'                 },
  { query: 'electric hand drill',               label: 'Electric Hand Drill',              category: 'Tools & Equipment',  jijiPath: '/tools-equipment'               },
  { query: 'welding machine inverter',          label: 'Inverter Welding Machine',         category: 'Tools & Equipment',  jijiPath: '/tools-equipment'               },
  { query: 'biometric attendance machine',      label: 'Biometric Attendance Machine',     category: 'Office & Education', jijiPath: '/office-furniture-equipment'    },
  { query: 'receipt printer ghana',             label: 'Receipt / POS Printer',            category: 'Office & Education', jijiPath: '/office-furniture-equipment'    },
  { query: 'cctv camera system ghana',          label: 'CCTV Camera System',               category: 'Security & Safety',  jijiPath: '/electronics'                   },
  { query: 'solar fence energizer',             label: 'Solar Fence Energizer',            category: 'Security & Safety',  jijiPath: '/electronics'                   },
  { query: 'riding lawnmower ghana',            label: 'Riding Lawnmower',                 category: 'Agriculture',        jijiPath: '/agro-equipment'                },
  { query: 'greenhouse structure ghana',        label: 'Greenhouse Structure',             category: 'Agriculture',        jijiPath: '/agro-equipment'                },
];

// ── MOFA AGRICULTURAL COMMODITIES (50) ───────────────────────
// Prices collected from MoFA Ghana and major market hubs
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
  { code: 'ORANGE_ACCRA',       name: 'Oranges',           market: 'Accra Agbogbloshie',     region: 'Greater Accra', unit: 'bag (50)', price: 80   },
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
