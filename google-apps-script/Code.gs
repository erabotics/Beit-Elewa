/**
 * بيت عليوه — سجل الطلبات في Google Sheets
 * ==========================================
 * الكود ده بيستقبل كل طلب من الموقع ويضيفه صف جديد في الشيت.
 * الشيت خاص: محدش يقدر يفتحه غير حساب المدير. الموقع بس يقدر "يضيف" صفوف، مش يقرأ.
 *
 * طريقة التركيب (مرة واحدة، من حساب Gmail بتاع المدير)
 * -----------------------------------------------------
 * 1. افتح https://sheets.google.com واعمل شيت جديد، وسمّيه مثلاً: طلبات بيت عليوه
 * 2. من القائمة: Extensions (الإضافات) ← Apps Script
 * 3. امسح أي كود موجود، والصق الملف ده كله، واضغط Save (أيقونة الديسك)
 * 4. من القائمة اللي فوق اختار الدالة setup واضغط Run
 *    - هيطلب صلاحيات: Review permissions ← اختار حساب المدير ← Advanced ← Go to … (unsafe) ← Allow
 *      (الرسالة دي طبيعية لأي سكريبت انت كاتبه بنفسك)
 *    - هيعمل تاب اسمه "الطلبات" فيه العناوين وقائمة الحالة
 * 5. اضغط Deploy ← New deployment
 *    - من الترس جنب Select type اختار: Web app
 *    - Execute as:     Me (حساب المدير)
 *    - Who has access: Anyone
 *      (ده معناه إن الموقع يقدر يبعت طلبات، مش إن حد يقدر يشوف الشيت)
 *    - اضغط Deploy وانسخ الـ Web app URL (آخره /exec)
 * 6. افتح script.js في الموقع، وحط الرابط مكان PASTE_YOUR_WEB_APP_URL_HERE في السطر:
 *      const SHEETS_URL='...';
 * 7. للتجربة: افتح الرابط في المتصفح، المفروض يظهر: {"ok":true,"service":"beit-elewa-orders"}
 *    وبعدها اعمل طلب تجريبي من الموقع واتأكد إن الصف ظهر في الشيت.
 *
 * لو عدّلت الكود ده بعدين
 * -----------------------
 * Deploy ← Manage deployments ← القلم (Edit) ← Version: New version ← Deploy
 * كده الرابط بيفضل زي ما هو ومش محتاج تغيره في الموقع.
 *
 * مهم: الأسعار ومناطق التوصيل موجودة هنا وفي script.js. لو غيرت سعر، غيّره في المكانين.
 * السكريبت بيحسب الإجمالي بنفسه من الأسعار اللي هنا؛ لو الإجمالي اللي جاي من الموقع
 * مختلف (سعر قديم أو حد بيلعب في الطلب) هيكتب تنبيه في آخر عمود.
 */

const SHEET_NAME = 'الطلبات';
const TZ = 'Africa/Cairo';

// مصاريف التوصيل لكل منطقة (بالجنيه). الاستلام من الفرع مجاني دايماً.
const DELIVERY_ZONES = { 'زهراء مدينة نصر': 20, 'الواحة': 20 };

// عرض "أي ٣ سندوتشات بـ ١٠٠": الأصناف اللي offer: true بس.
const OFFER_TOTAL = 100;

const MENU = {
  kebda:    { name: 'كبدة',              price: 25 },
  khalta:   { name: 'سجق بالخلطة',       price: 35, offer: true },
  sharqy:   { name: 'سجق شرقي سادة',     price: 35, offer: true },
  sharqyc:  { name: 'سجق شرقي بالجبنة',  price: 40 },
  mda5n:    { name: 'مدخن',              price: 25 },
  panne:    { name: 'بانيه',             price: 120 },
  burger:   { name: 'كلاسيك برجر',       price: 130 },
  patty:    { name: 'قطعة برجر زيادة',   price: 90 },
  cheese:   { name: 'جبنة زيادة',        price: 15 },
  sakalans: { name: 'سكلانس',            price: 35, offer: true },
  fries:    { name: 'بطاطس',             price: 25 },
  tahina:   { name: 'طحينة',             price: 15 },
  pickles:  { name: 'مخلل',              price: 10 },
  tomato:   { name: 'طماطم متبلة',       price: 15 },
  pepsi:    { name: 'بيبسي',             price: 20 },
  '7up':    { name: 'سفن أب',            price: 20 },
  mirinda:  { name: 'ميرندا برتقال',     price: 20 },
  vcola:    { name: 'في كولا',           price: 20 },
  vdiet:    { name: 'في كولا دايت',      price: 20 },
  v7lemon:  { name: 'في ٧ ليمون نعناع',  price: 20 },
  juice:    { name: 'عصير جهينة برتقال', price: 15 },
  chipsy:   { name: 'شيبسي',             price: 15 },
  water:    { name: 'مياه',              price: 10 },
};

// كومبو (بطاطس + كانز) بـ 45 مع أي ساندوتش — واحد لكل ساندوتش.
const COMBO_PRICE = 45;
const COMBO_FOR = ['kebda', 'khalta', 'sharqy', 'sharqyc', 'mda5n', 'panne', 'burger', 'sakalans'];
['pepsi', '7up', 'mirinda', 'vcola', 'vdiet', 'v7lemon'].forEach(function (id) {
  MENU['combo_' + id] = { name: 'كومبو: بطاطس + ' + MENU[id].name, price: COMBO_PRICE, combo: true };
});

const STATUSES = ['جديد', 'اتأكد', 'بيتجهز', 'خرج للتوصيل', 'جاهز للاستلام', 'اتسلم', 'ملغي'];

const HEADERS = ['التاريخ والوقت', 'رقم الطلب', 'الحالة', 'النوع', 'الاسم', 'الموبايل',
  'المنطقة', 'العنوان', 'الدور / الشقة', 'الأصناف', 'عدد القطع',
  'المجموع', 'الخصم', 'التوصيل', 'الإجمالي', 'ملاحظات', 'تنبيه'];

const MAX_ORDERS_PER_PHONE_10_MIN = 3;


/** شغّلها مرة واحدة بس (الخطوة 4). آمن تشغيلها تاني. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  sh.setRightToLeft(true);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#2B2B2B').setFontColor('#F3EAD9');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('F:F').setNumberFormat('@');                 // keep the leading 0 in phone numbers
  sh.getRange('L:O').setNumberFormat('#,##0 "ج"');
  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  sh.getRange(2, 3, sh.getMaxRows() - 1, 1).setDataValidation(statusRule);
  sh.setColumnWidth(10, 320);                               // items
  sh.setColumnWidth(17, 260);                               // warnings
}


/** للتجربة: فتح الرابط في المتصفح يرجّع ok. */
function doGet() {
  return json_({ ok: true, service: 'beit-elewa-orders' });
}


/** بيستقبل الطلب من الموقع. */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 6000) return json_({ ok: false, error: 'TOO_LARGE' });

    const body = JSON.parse(raw);
    // Honeypot: a hidden form field that only spam bots fill. Answer "ok" so they don't retry, but save nothing.
    if (body && body.website) return json_({ ok: true });
    const order = validate_(body);
    const cache = CacheService.getScriptCache();

    // One request at a time, so two orders arriving together never overwrite each other
    // and the duplicate check below is reliable.
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      // Same order sent twice (double click / retry) -> keep only the first.
      if (cache.get('id:' + order.orderId) || orderIdExists_(order.orderId)) {
        return json_({ ok: true, duplicate: true });
      }

      const rateKey = 'rl:' + order.phone;
      const recent = Number(cache.get(rateKey) || 0);
      if (recent >= MAX_ORDERS_PER_PHONE_10_MIN) return json_({ ok: false, error: 'TOO_MANY_ORDERS' });

      const p = price_(order);
      const warnings = p.warnings.slice();
      if (Number(order.clientTotal) !== p.total) {
        warnings.push('إجمالي الموقع ' + order.clientTotal + ' ≠ الإجمالي الصحيح ' + p.total);
      }

      const pickup = order.mode === 'pickup';
      sheet_().appendRow([
        new Date(),
        safe_(order.orderId),
        'جديد',
        pickup ? 'استلام من الفرع' : 'توصيل',
        safe_(order.name),
        "'" + order.phone,
        safe_(pickup ? '' : order.area),
        safe_(pickup ? '' : order.address),
        safe_(pickup ? '' : order.floor),
        safe_(p.itemsText),
        p.count,
        p.subtotal,
        p.discount,
        p.fee,
        p.total,
        safe_(order.notes),
        safe_(warnings.join(' — ')),
      ]);

      cache.put('id:' + order.orderId, '1', 21600);          // 6 hours
      cache.put(rateKey, String(recent + 1), 600);           // 10 minutes
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}


// ---------------------------------------------------------------- helpers

function validate_(d) {
  if (!d || typeof d !== 'object') throw new Error('INVALID_BODY');
  const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);

  const o = {
    orderId: str(d.orderId, 30),
    mode: d.mode === 'pickup' ? 'pickup' : 'delivery',
    name: str(d.name, 60),
    phone: str(d.phone, 20).replace(/\D/g, ''),
    area: str(d.area, 40),
    address: str(d.address, 200),
    floor: str(d.floor, 60),
    notes: str(d.notes, 300),
    clientTotal: d.clientTotal,
    items: [],
  };

  if (!/^BE-\d{4}-\d{4}-[A-Z0-9]{4}$/.test(o.orderId)) throw new Error('INVALID_ORDER_ID');
  if (o.name.length < 2) throw new Error('INVALID_NAME');
  if (!/^01[0125]\d{8}$/.test(o.phone)) throw new Error('INVALID_PHONE');
  if (o.mode === 'delivery') {
    if (!Object.prototype.hasOwnProperty.call(DELIVERY_ZONES, o.area)) throw new Error('INVALID_AREA');
    if (o.address.length < 5) throw new Error('INVALID_ADDRESS');
  }

  if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 30) throw new Error('INVALID_ITEMS');
  const merged = {};
  d.items.forEach(function (it) {
    const id = it && typeof it.id === 'string' ? it.id : '';
    const qty = it && it.qty;
    if (!Object.prototype.hasOwnProperty.call(MENU, id)) throw new Error('UNKNOWN_ITEM');
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error('INVALID_QTY');
    merged[id] = (merged[id] || 0) + qty;
  });
  Object.keys(merged).forEach(function (id) {
    if (merged[id] > 50) throw new Error('INVALID_QTY');
    o.items.push({ id: id, qty: merged[id] });
  });
  return o;
}

/** Recomputes the bill from the prices in this file (never trusts the website's numbers). */
function price_(o) {
  let subtotal = 0, count = 0;
  let units = [];
  const lines = o.items.map(function (it) {
    const m = MENU[it.id];
    subtotal += m.price * it.qty;
    count += it.qty;
    if (m.offer) for (let i = 0; i < it.qty; i++) units.push(m.price);
    return m.name + ' × ' + it.qty;
  });

  units.sort(function (a, b) { return b - a; });
  let discount = 0;
  for (let i = 0; i + 2 < units.length; i += 3) {
    discount += Math.max(0, units[i] + units[i + 1] + units[i + 2] - OFFER_TOTAL);
  }

  // Add-ons need their main item: 1 extra patty per burger, 1 combo per sandwich.
  const qty = {};
  o.items.forEach(function (it) { qty[it.id] = it.qty; });
  const combos = o.items.filter(function (it) { return MENU[it.id].combo; })
    .reduce(function (s, it) { return s + it.qty; }, 0);
  const mains = COMBO_FOR.reduce(function (s, id) { return s + (qty[id] || 0); }, 0);
  const warnings = [];
  if ((qty.patty || 0) > (qty.burger || 0)) warnings.push('قطع برجر زيادة أكتر من عدد البرجر');
  const sandwiches = ['kebda', 'khalta', 'sharqy', 'sharqyc', 'mda5n', 'panne', 'burger']
    .reduce(function (s, id) { return s + (qty[id] || 0); }, 0);
  if ((qty.cheese || 0) > sandwiches) warnings.push('جبنة زيادة أكتر من عدد السندوتشات');
  if (combos > mains) warnings.push('كومبو أكتر من عدد السندوتشات');

  const fee = o.mode === 'pickup' ? 0 : DELIVERY_ZONES[o.area];
  return {
    warnings: warnings,
    itemsText: lines.join('، '),
    count: count,
    subtotal: subtotal,
    discount: discount,
    fee: fee,
    total: subtotal - discount + fee,
  };
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAME)) setup();
  return ss.getSheetByName(SHEET_NAME);
}

function orderIdExists_(id) {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;
  return !!sh.getRange(2, 2, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
}

/** Stops text like "=HYPERLINK(...)" typed by a customer from running as a formula in the sheet. */
function safe_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
