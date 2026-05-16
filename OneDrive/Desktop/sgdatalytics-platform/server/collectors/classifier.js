/**
 * SG Datalytics — Listing Classifier
 * Classifies listing titles into: item_type, brand, model
 */
'use strict';

const SPARE_PART_PATTERNS = [
  /\bscreen\s*replacement\b/i,
  /\blcd\s*(screen|display|panel)?\b/i,
  /\bdisplay\s*(replacement|module|panel)\b/i,
  /\bmotherboard\b/i,
  /\bback\s*glass\b/i,
  /\bback\s*cover\s*(replacement|for)\b/i,
  /\bhousing\s*(for|replacement)\b/i,
  /\bcamera\s*(module|lens\s*replacement|replacement)\b/i,
  /\bcharging\s*port\s*(flex|replacement)?\b/i,
  /\bflex\s*cable\b/i,
  /\bbattery\s+(replacement|for\s+\w)/i,
  /\bengine\s+(swap|block|replacement|for)\b/i,
  /\bgearbox\b/i,
  /\btransmission\s+(for|swap)\b/i,
  /\bbumper\s+(front|rear|for)\b/i,
  /\bbonnet\s+(for|replacement)\b/i,
  /\bdoor\s+panel\b/i,
  /\boil\s+filter\b/i,
  /\bair\s+filter\b/i,
  /\bbrake\s+(pad|disc|drum)\b/i,
  /\bshock\s+absorber\b/i,
  /\bradiator\s+(for|replacement)\b/i,
  /\bspare\s+parts?\b/i,
  /\bfor\s+parts\b/i,
  /\bparts?\s+only\b/i,
  /\breplacement\s+(screen|battery|part|board)\b/i,
];

const SERVICE_PATTERNS = [
  /\brepair\s*(service|shop|center|centre)?\b/i,
  /\bfix(ing)?\s+(phone|screen|car|laptop)\b/i,
  /\bscreen\s+repair\b/i,
  /\bphone\s+repair\b/i,
  /\blaptop\s+repair\b/i,
  /\bcar\s+repair\b/i,
  /\binstallation\s+service\b/i,
  /\bmaintenance\s+service\b/i,
  /\bcleaning\s+service\b/i,
  /\bunlocking\s+service\b/i,
];

const ACCESSORY_PATTERNS = [
  /\b(iphone|samsung|galaxy|huawei|tecno|infinix|nokia|oppo|realme|xiaomi|redmi|oneplus|motorola|macbook|ipad)\s+case\b/i,
  /\bphone\s+case\b/i,
  /\b(silicone|leather|clear|hard|soft|tpu|rubber)\s+(case|cover)\b/i,
  /\bback\s+case\b/i,
  /\bphone\s+cover\b/i,
  /\bscreen\s+protector\b/i,
  /\btempered\s+glass\b/i,
  /\bphone\s+holder\b/i,
  /\bphone\s+stand\b/i,
  /\bcharging\s+cable\b/i,
  /\busb\s+cable\b/i,
  /\btype[\s-]?c\s+cable\b/i,
  /\blightning\s+cable\b/i,
  /\b(wall|car|wireless)\s+charger\b/i,
  /\bpower\s+bank\b/i,
  /\bpowerbank\b/i,
  /\bphone\s+pouch\b/i,
  /\bphone\s+bag\b/i,
  /\bpop\s*socket\b/i,
  /\bwireless\s+earbuds?\b/i,
  /\bearphones?\b/i,
  /\bheadphones?\b/i,
  /\bheadset\b/i,
  /\btws\b/i,
  /\bairpods?\b/i,
  /\bwireless\s+mouse\b/i,
  /\boptical\s+mouse\b/i,
  /\bbluetooth\s+(keyboard|mouse)\b/i,
  /\busb\s+hub\b/i,
  /\bhdmi\s+(cable|adapter)\b/i,
  /\blaptop\s+(stand|bag|sleeve|case|cooler|pad)\b/i,
  /\bflash\s+drive\b/i,
  /\bpen\s+drive\b/i,
  /\bmemory\s+card\b/i,
  /\bsd\s+card\b/i,
  /\bseat\s+cover\b/i,
  /\bcar\s+(mat|cover|sticker|perfume|charger|mount|holder|camera|audio|stereo|alarm)\b/i,
  /\bfloor\s+mat\b/i,
  /\bsteering\s+(wheel\s+)?(cover|wrap)\b/i,
  /\btyres?\b/i,
  /\btires?\b/i,
  /\brim\b/i,
  /\bsunglasses\b/i,
  /\bwatch\s+strap\b/i,
];

const BRAND_RULES = [
  [/\biphone\b/i, 'Apple'],
  [/\bapple\b/i, 'Apple'],
  [/\bsamsung\b/i, 'Samsung'],
  [/\bhuawei\b/i, 'Huawei'],
  [/\btecno\b/i, 'Tecno'],
  [/\bitel\b/i, 'Itel'],
  [/\binfinix\b/i, 'Infinix'],
  [/\bxiaomi\b/i, 'Xiaomi'],
  [/\bredmi\b/i, 'Xiaomi'],
  [/\bpoco\b/i, 'Xiaomi'],
  [/\boneplus\b/i, 'OnePlus'],
  [/\bnokia\b/i, 'Nokia'],
  [/\boppo\b/i, 'Oppo'],
  [/\brealme\b/i, 'Realme'],
  [/\bvivo\b/i, 'Vivo'],
  [/\bgoogle\s+pixel\b/i, 'Google'],
  [/\bpixel\s+\d/i, 'Google'],
  [/\bmotorola\b/i, 'Motorola'],
  [/\bblackberry\b/i, 'BlackBerry'],
  [/\bmacbook\b/i, 'Apple'],
  [/\bimac\b/i, 'Apple'],
  [/\bipad\b/i, 'Apple'],
  [/\bhp\b/i, 'HP'],
  [/\bdell\b/i, 'Dell'],
  [/\blenovo\b/i, 'Lenovo'],
  [/\bthinkpad\b/i, 'Lenovo'],
  [/\basus\b/i, 'Asus'],
  [/\bacer\b/i, 'Acer'],
  [/\btoshiba\b/i, 'Toshiba'],
  [/\blg\b/i, 'LG'],
  [/\bsony\b/i, 'Sony'],
  [/\btcl\b/i, 'TCL'],
  [/\bhisense\b/i, 'Hisense'],
  [/\bskyworth\b/i, 'Skyworth'],
  [/\bpanasonic\b/i, 'Panasonic'],
  [/\bnasco\b/i, 'Nasco'],
  [/\bwestpoint\b/i, 'Westpoint'],
  [/\bbosch\b/i, 'Bosch'],
  [/\bwhirlpool\b/i, 'Whirlpool'],
  [/\belectrolux\b/i, 'Electrolux'],
  [/\bmidea\b/i, 'Midea'],
  [/\bhaier\b/i, 'Haier'],
  [/\btoyota\b/i, 'Toyota'],
  [/\bhonda\b/i, 'Honda'],
  [/\bmercedes[\s-]?benz\b/i, 'Mercedes-Benz'],
  [/\bmercedes\b/i, 'Mercedes-Benz'],
  [/\bbenz\b/i, 'Mercedes-Benz'],
  [/\bbmw\b/i, 'BMW'],
  [/\bford\b/i, 'Ford'],
  [/\bhyundai\b/i, 'Hyundai'],
  [/\bkia\b/i, 'Kia'],
  [/\bnissan\b/i, 'Nissan'],
  [/\bmitsubishi\b/i, 'Mitsubishi'],
  [/\bvolkswagen\b/i, 'Volkswagen'],
  [/\bvw\b/i, 'Volkswagen'],
  [/\blexus\b/i, 'Lexus'],
  [/\baudi\b/i, 'Audi'],
  [/\brange\s+rover\b/i, 'Land Rover'],
  [/\bland\s+rover\b/i, 'Land Rover'],
  [/\bchevrolet\b/i, 'Chevrolet'],
  [/\bchevy\b/i, 'Chevrolet'],
  [/\bjeep\b/i, 'Jeep'],
  [/\bporsche\b/i, 'Porsche'],
  [/\bsuzuki\b/i, 'Suzuki'],
  [/\bmazda\b/i, 'Mazda'],
  [/\bisuzu\b/i, 'Isuzu'],
  [/\bpeugeot\b/i, 'Peugeot'],
  [/\brenault\b/i, 'Renault'],
  [/\bvolvo\b/i, 'Volvo'],
  [/\bsubaru\b/i, 'Subaru'],
  [/\byamaha\b/i, 'Yamaha'],
  [/\bkawasaki\b/i, 'Kawasaki'],
  [/\bbajaj\b/i, 'Bajaj'],
];

const MODEL_PATTERNS = [
  ['Apple', /\biphone\s*1[5-9]\s*(pro\s*max|pro|plus|max|mini)?\b/i],
  ['Apple', /\biphone\s*1[0-4]\s*(pro\s*max|pro|plus|max|mini)?\b/i],
  ['Apple', /\biphone\s*(xs\s*max|xs|xr|x)\b/i],
  ['Apple', /\biphone\s*[6-9]\s*(s\s*plus|s|plus)?\b/i],
  ['Apple', /\biphone\s*se\s*(\d+)?\b/i],
  ['Apple', /\bmacbook\s*(pro|air)\s*(m[1-4])?\b/i],
  ['Apple', /\bipad\s*(pro|air|mini)\s*(\d+)?\b/i],
  ['Samsung', /\bgalaxy\s*s\s*2[0-4]\s*(ultra|plus|fe)?\b/i],
  ['Samsung', /\bgalaxy\s*s\s*1[0-9]\s*(ultra|plus|fe)?\b/i],
  ['Samsung', /\bgalaxy\s*a\s*\d{2}\s*(s|fe)?\b/i],
  ['Samsung', /\bgalaxy\s*note\s*\d+\s*(ultra|plus)?\b/i],
  ['Samsung', /\bgalaxy\s*z\s*(fold|flip)\s*\d?\b/i],
  ['Huawei', /\bp\s*[345][05]\s*(pro|lite|plus)?\b/i],
  ['Huawei', /\bmate\s*\d{2}\s*(pro|x)?\b/i],
  ['Huawei', /\bnova\s*\d+\s*(pro|lite)?\b/i],
  ['Tecno', /\bspark\s*\d+\s*(pro|c|b|s)?\b/i],
  ['Tecno', /\bcamon\s*\d+\s*(pro|c)?\b/i],
  ['Tecno', /\bphantom\s*(v|x|u)\s*(fold|flip)?\s*\d?\b/i],
  ['Tecno', /\bpop\s*\d+\s*(pro)?\b/i],
  ['Infinix', /\bnote\s*\d+\s*(pro|ultra)?\b/i],
  ['Infinix', /\bhot\s*\d+\s*(play|i|s|pro)?\b/i],
  ['Infinix', /\bzero\s*\d+\s*(ultra|pro|x)?\b/i],
  ['Infinix', /\bsmart\s*\d+\s*(hd|plus)?\b/i],
  ['Xiaomi', /\bredmi\s*note\s*\d+\s*(pro|s|t)?\b/i],
  ['Xiaomi', /\bredmi\s*\d+\s*(a|c|s|pro)?\b/i],
  ['Xiaomi', /\bpoco\s*(x|m|f|c)\s*\d+\s*(pro|gt)?\b/i],
  ['Toyota', /\bcamry\b/i],
  ['Toyota', /\bcorolla\b/i],
  ['Toyota', /\brav[\s-]?4\b/i],
  ['Toyota', /\bland\s*cruiser\b/i],
  ['Toyota', /\bprado\b/i],
  ['Toyota', /\bhilux\b/i],
  ['Toyota', /\bfortuner\b/i],
  ['Toyota', /\bvenza\b/i],
  ['Toyota', /\balphard\b/i],
  ['Toyota', /\byaris\b/i],
  ['Toyota', /\bsienna\b/i],
  ['Honda', /\bcivic\b/i],
  ['Honda', /\baccord\b/i],
  ['Honda', /\bcr[\s-]?v\b/i],
  ['Honda', /\bpilot\b/i],
  ['Honda', /\bjazz\b/i],
  ['Honda', /\bhr[\s-]?v\b/i],
  ['Mercedes-Benz', /\bc[\s-]?class\b/i],
  ['Mercedes-Benz', /\be[\s-]?class\b/i],
  ['Mercedes-Benz', /\bs[\s-]?class\b/i],
  ['Mercedes-Benz', /\bgle\b/i],
  ['Mercedes-Benz', /\bglc\b/i],
  ['BMW', /\b[1357][\s-]?series\b/i],
  ['BMW', /\bx\s*[1-7]\b/i],
  ['Nissan', /\balmera\b/i],
  ['Nissan', /\bteana\b/i],
  ['Nissan', /\bpathfinder\b/i],
  ['Nissan', /\bnavara\b/i],
  ['Nissan', /\bx[\s-]?trail\b/i],
  ['Nissan', /\bjuke\b/i],
  ['Hyundai', /\bsonata\b/i],
  ['Hyundai', /\belantra\b/i],
  ['Hyundai', /\btucson\b/i],
  ['Hyundai', /\bsanta\s*fe\b/i],
  ['Hyundai', /\bcreta\b/i],
  ['Kia', /\bsorento\b/i],
  ['Kia', /\bsportage\b/i],
  ['Kia', /\bcerato\b/i],
  ['Kia', /\bcarnival\b/i],
  ['Kia', /\bpicanto\b/i],
  ['Lexus', /\brx\s*\d{3}\b/i],
  ['Lexus', /\blx\s*\d{3}\b/i],
  ['Lexus', /\bes\s*\d{3}\b/i],
  ['HP', /\bpavilion\b/i],
  ['HP', /\benvy\b/i],
  ['HP', /\belitebook\b/i],
  ['HP', /\bprobook\b/i],
  ['Dell', /\binspiron\b/i],
  ['Dell', /\bxps\b/i],
  ['Dell', /\blatitude\b/i],
  ['Dell', /\balienware\b/i],
  ['Lenovo', /\bthinkpad\s*[a-z]?\d+\b/i],
  ['Lenovo', /\bideapad\s*\d+\b/i],
  ['Lenovo', /\byoga\s*\d+\b/i],
  ['Lenovo', /\blegion\s*\d+\b/i],
  ['Asus', /\bzenbook\b/i],
  ['Asus', /\bvivobook\b/i],
  ['Asus', /\brog\b/i],
];

function classify(title) {
  if (!title || typeof title !== 'string') {
    return { item_type: 'product', brand: null, model: null };
  }

  let item_type = 'product';

  for (const p of SPARE_PART_PATTERNS) {
    if (p.test(title)) { item_type = 'spare_part'; break; }
  }
  if (item_type === 'product') {
    for (const p of SERVICE_PATTERNS) {
      if (p.test(title)) { item_type = 'service'; break; }
    }
  }
  if (item_type === 'product') {
    for (const p of ACCESSORY_PATTERNS) {
      if (p.test(title)) { item_type = 'accessory'; break; }
    }
  }

  let brand = null;
  for (const [regex, canonical] of BRAND_RULES) {
    if (regex.test(title)) { brand = canonical; break; }
  }

  let model = null;
  if (brand) {
    for (const [b, pattern] of MODEL_PATTERNS) {
      if (b === brand) {
        const m = title.match(pattern);
        if (m) {
          model = m[0].replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }
  }

  return { item_type, brand, model };
}

module.exports = { classify };
