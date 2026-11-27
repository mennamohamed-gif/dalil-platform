/**
 * دليل (Dalil) — منصة الدليل الشامل
 * خادم بدون أي مكتبات خارجية: يكفي تثبيت Node.js وتشغيل `node server.js`
 * قاعدة البيانات: ملف JSON في data/db.json يُنشأ تلقائياً ببيانات تجريبية
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''; // كلمة سر الأدمن تُدار من متغير البيئة
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // الجلسة تنتهي بعد 30 يوم من آخر استخدام
const CAIRO_OFFSET_MIN = 120; // توقيت القاهرة UTC+2
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ---- طبقة التخزين: PostgreSQL لو فيه DATABASE_URL، وإلا ملف JSON محلي ---- */
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const DOC_TABLE = 'dalil_doc';
const IMG_DIR = path.join(DATA_DIR, 'images');
let pgPool = null;
let saveChain = Promise.resolve();

function connString(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('channel_binding');
    u.searchParams.delete('uselibpqcompat');
    return u.toString();
  } catch (e) { return url; }
}

function pg() {
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: connString(DATABASE_URL),
      ssl: /neon\.tech|supabase\.co|aivencloud|sslmode=require/i.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 4,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    });
    pgPool.on('error', (e) => console.error('خطأ في اتصال قاعدة البيانات:', e.message));
  }
  return pgPool;
}

/* ------------------------- قاعدة البيانات ------------------------- */

function nowISO() { return new Date().toISOString(); }
function id(prefix) { return prefix + '_' + crypto.randomBytes(6).toString('hex'); }
function orderCode() { return 'D-' + crypto.randomInt(1000, 9999) + '-' + crypto.randomInt(10, 99); }

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(12).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  try {
    const { hash } = hashPassword(password, user.salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(user.password_hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

function makeUser(username, password, role, name, store_id) {
  const { salt, hash } = hashPassword(password);
  return { id: id('u'), username, password_hash: hash, salt, role, name, store_id: store_id || null, created_at: nowISO() };
}

function seed() {
  const categories = [
    { id: 'c_pharmacy',   name: 'صيدليات',        icon: 'pharmacy',   color: '#10b981' },
    { id: 'c_clinic',     name: 'عيادات',         icon: 'clinic',     color: '#6366f1' },
    { id: 'c_restaurant', name: 'مطاعم',          icon: 'restaurant', color: '#f59e0b' },
    { id: 'c_cafe',       name: 'كافيهات',        icon: 'cafe',       color: '#a16207' },
    { id: 'c_market',     name: 'محلات',          icon: 'market',     color: '#0ea5e9' },
    { id: 'c_fashion',    name: 'ملابس',          icon: 'fashion',    color: '#ec4899' },
    { id: 'c_sweets',     name: 'حلويات',         icon: 'sweets',     color: '#d946ef' },
    { id: 'c_library',    name: 'مكتبات',         icon: 'library',    color: '#14b8a6' },
    { id: 'c_services',   name: 'خدمات ومهن',     icon: 'services',   color: '#f97316' },
  ];

  const stores = [
    { id: 's_shifaa',  name: 'صيدلية الشفاء',            category_id: 'c_pharmacy',   description: 'صيدلية متكاملة، أدوية ومستحضرات تجميل واستشارات مجانية. خدمة 24 ساعة.', phone: '01012345671', address: 'شارع الجلاء، بجوار ميدان المحطة', hours: '24 ساعة', delivery: true,  delivery_fee: 10, featured: true,  rating: 4.8, status: 'active', created_at: nowISO() },
    { id: 's_ahmed',   name: 'عيادة د. أحمد سمير - باطنة', category_id: 'c_clinic',   description: 'استشاري الباطنة والجهاز الهضمي. كشف ومتابعة سكر وضغط وتحاليل.', phone: '01012345672', address: 'برج الأطباء، الدور الثالث', hours: 'السبت - الخميس: 12م - 9م', delivery: false, delivery_fee: 0, featured: true, rating: 4.9, status: 'active', created_at: nowISO() },
    { id: 's_sara',    name: 'عيادة د. سارة محمود - أسنان', category_id: 'c_clinic',  description: 'تجميل وزراعة الأسنان، تقويم، تنظيف وحشو بأحدث الأجهزة.', phone: '01012345673', address: 'شارع سعد زغلول، أمام البنك الأهلي', hours: 'يومياً: 11ص - 10م', delivery: false, delivery_fee: 0, featured: false, rating: 4.7, status: 'active', created_at: nowISO() },
    { id: 's_prince',  name: 'مطعم البرنس',              category_id: 'c_restaurant', description: 'أشهر كشري ومشويات في المنطقة. طلبك يوصلك سخن لباب البيت.', phone: '01012345674', address: 'شارع الاستاد الرئيسي', hours: 'يومياً: 10ص - 2ص', delivery: true, delivery_fee: 15, featured: true, rating: 4.6, status: 'active', created_at: nowISO() },
    { id: 's_sahab',   name: 'كافيه السحاب',              category_id: 'c_cafe',       description: 'كافيه هادي، قهوة مختصة وحلويات غربية. مكان مناسب للشغل والمذاكرة.', phone: '01012345680', address: 'شارع الكورنيش، الدور الأول', hours: 'يومياً: 8ص - 1ص', delivery: true, delivery_fee: 15, featured: true, rating: 4.6, status: 'active', created_at: nowISO() },
    { id: 's_nour',    name: 'سوبر ماركت النور',          category_id: 'c_market',     description: 'كل احتياجات البيت: بقالة، منظفات، خضار يومي. توصيل خلال ساعة.', phone: '01012345675', address: 'شارع الجمهورية', hours: 'يومياً: 8ص - 12م', delivery: true, delivery_fee: 10, featured: false, rating: 4.5, status: 'active', created_at: nowISO() },
    { id: 's_style',   name: 'محل ستايل للملابس',          category_id: 'c_fashion',    description: 'أحدث موديلات الملابس الرجالي والحريمي والأطفال.', phone: '01012345676', address: 'شارع المحطة، بجوار الكوبرى', hours: 'يومياً: 10ص - 11م', delivery: true, delivery_fee: 20, featured: false, rating: 4.4, status: 'active', created_at: nowISO() },
    { id: 's_elabd',   name: 'حلويات الدليل',             category_id: 'c_sweets',     description: 'حلويات شرقية وغربية طازة يومياً. تورت وتجهيزات مناسبات.', phone: '01012345677', address: 'ميدان الساعة', hours: 'يومياً: 9ص - 12م', delivery: true, delivery_fee: 15, featured: true, rating: 4.7, status: 'active', created_at: nowISO() },
    { id: 's_marefa',  name: 'مكتبة المعرفة',             category_id: 'c_library',    description: 'أدوات مدرسية ومكتبية، طباعة وتصوير، كتب ومراجع.', phone: '01012345678', address: 'شارع المدارس، أمام المدرسة الثانوية', hours: 'السبت - الخميس: 9ص - 10م', delivery: false, delivery_fee: 0, featured: false, rating: 4.3, status: 'active', created_at: nowISO() },
    { id: 's_mahmoud', name: 'الأسطى محمود - كهرباء',      category_id: 'c_services',   description: 'كهربائي منازل ومحلات: تأسيس، صيانة، تركيبات. خدمة طوارئ.', phone: '01012345679', address: 'خدمة منازل - المنطقة كلها', hours: 'يومياً: 9ص - 11م', delivery: false, delivery_fee: 0, featured: false, rating: 4.6, status: 'active', created_at: nowISO() },
  ];

  const products = [
    // صيدلية الشفاء
    { id: 'p1',  store_id: 's_shifaa', name: 'بانادول إكسترا 24 قرص',        description: 'مسكن للألم وخافض للحرارة', price: 45,  kind: 'product', available: true },
    { id: 'p2',  store_id: 's_shifaa', name: 'فيتامين سي فوار 1000 مجم',      description: 'تقوية المناعة - 20 قرص فوار', price: 60, kind: 'product', available: true },
    { id: 'p3',  store_id: 's_shifaa', name: 'جهاز قياس ضغط ديجيتال',         description: 'قياس دقيق مع ذاكرة للقراءات', price: 950, kind: 'product', available: true },
    { id: 'p4',  store_id: 's_shifaa', name: 'كريم مرطب للبشرة',              description: 'ترطيب عميق 200 مل', price: 120, kind: 'product', available: true },
    // عيادة باطنة
    { id: 'p5',  store_id: 's_ahmed', name: 'كشف باطنة',                    description: 'كشف شامل مع خطة علاج', price: 250, kind: 'service', duration: '30 دقيقة', available: true },
    { id: 'p6',  store_id: 's_ahmed', name: 'متابعة سكر وضغط',              description: 'قياس وتقييم وتعديل جرعات', price: 150, kind: 'service', duration: '20 دقيقة', available: true },
    { id: 'p7',  store_id: 's_ahmed', name: 'باقة تحاليل شاملة',            description: 'صورة دم + سكر + وظائف كلى وكبد', price: 600, kind: 'service', duration: '15 دقيقة', available: true },
    // عيادة أسنان
    { id: 'p8',  store_id: 's_sara', name: 'كشف أسنان',                    description: 'فحص شامل مع خطة علاج', price: 150, kind: 'service', duration: '30 دقيقة', available: true },
    { id: 'p9',  store_id: 's_sara', name: 'تنظيف جير',                    description: 'تنظيف وتلميع بالكامل', price: 400, kind: 'service', duration: '45 دقيقة', available: true },
    { id: 'p10', store_id: 's_sara', name: 'حشو ضرس',                      description: 'حشو ضوئي عالي الجودة', price: 500, kind: 'service', duration: '40 دقيقة', available: true },
    // مطعم البرنس
    { id: 'p11', store_id: 's_prince', name: 'وجبة كشري كبير',             description: 'كشري بالدقة والصلصة والشطة', price: 45, kind: 'product', available: true },
    { id: 'p12', store_id: 's_prince', name: 'نص فرخة مشوية',              description: 'مع أرز وشوربة وسلطة', price: 140, kind: 'product', available: true },
    { id: 'p13', store_id: 's_prince', name: 'ساندوتش شاورما سوري',         description: 'لحم أو فراخ مع طحينة ومخلل', price: 65, kind: 'product', available: true },
    { id: 'p14', store_id: 's_prince', name: 'طاجن ملوخية بالفراخ',         description: 'ملوخية بلدي مع ربع فرخة', price: 110, kind: 'product', available: true },
    // كافيه السحاب
    { id: 'p27', store_id: 's_sahab', name: 'قهوة مختصة V60',            description: 'بن محمص طازة، تخمير يدوي', price: 55, kind: 'product', available: true },
    { id: 'p28', store_id: 's_sahab', name: 'كابتشينو',                  description: 'إسبريسو مع حليب مخملي', price: 45, kind: 'product', available: true },
    { id: 'p29', store_id: 's_sahab', name: 'كرواسون زبدة',              description: 'مخبوز طازة يومياً', price: 35, kind: 'product', available: true },
    { id: 'p30', store_id: 's_sahab', name: 'ميلك شيك أوريو',            description: 'ميلك شيك كريمي بقطع الأوريو', price: 60, kind: 'product', available: true },
    // سوبر ماركت
    { id: 'p15', store_id: 's_nour', name: 'أرز مصري فاخر 5 كيلو',         description: 'أرز عريض الحبة', price: 165, kind: 'product', available: true },
    { id: 'p16', store_id: 's_nour', name: 'زيت عباد 2.25 لتر',            description: 'زيت طبخ نقي', price: 190, kind: 'product', available: true },
    { id: 'p17', store_id: 's_nour', name: 'منظف أطباق 1 لتر',             description: 'برائحة الليمون', price: 55, kind: 'product', available: true },
    // ملابس
    { id: 'p18', store_id: 's_style', name: 'تيشيرت قطن أوفر سايز',        description: 'خامة قطن 100% - ألوان متعددة', price: 250, kind: 'product', available: true },
    { id: 'p19', store_id: 's_style', name: 'بنطلون جينز رجالي',           description: 'قصة سليم فيت', price: 450, kind: 'product', available: true },
    // حلويات
    { id: 'p20', store_id: 's_elabd', name: 'كنافة بالمكسرات (كيلو)',      description: 'كنافة ناعمة بالبندق والفستق', price: 220, kind: 'product', available: true },
    { id: 'p21', store_id: 's_elabd', name: 'مشكل بقلاوة (كيلو)',          description: 'تشكيلة فاخرة', price: 380, kind: 'product', available: true },
    { id: 'p22', store_id: 's_elabd', name: 'ميني جاتوه (قطعة)',           description: 'نكهات متنوعة', price: 35, kind: 'product', available: true },
    // مكتبة
    { id: 'p23', store_id: 's_marefa', name: 'طباعة مستندات (الورقة)',     description: 'أبيض وأسود', price: 2, kind: 'product', available: true },
    { id: 'p24', store_id: 's_marefa', name: 'حقيبة أدوات هندسية',         description: 'كاملة بالبرجل والمساطر', price: 180, kind: 'product', available: true },
    // كهربائي
    { id: 'p25', store_id: 's_mahmoud', name: 'معاينة وإصلاح عطل كهرباء',  description: 'كشف العطل وإصلاحه في نفس الزيارة', price: 150, kind: 'service', duration: 'حسب العطل', available: true },
    { id: 'p26', store_id: 's_mahmoud', name: 'تركيب نجفة أو مراوح',       description: 'تركيب آمن ومضمون', price: 120, kind: 'service', duration: 'ساعة', available: true },
  ];

  const users = [
    makeUser('admin',  ADMIN_PASSWORD || 'dalil2026', 'admin', 'محمود عامر (الأدمن)', null),
    makeUser('shifaa', 'dalil2026', 'merchant', 'صيدلية الشفاء', 's_shifaa'),
    makeUser('prince', 'dalil2026', 'merchant', 'مطعم البرنس', 's_prince'),
    makeUser('ahmed',  'dalil2026', 'merchant', 'عيادة د. أحمد سمير', 's_ahmed'),
  ];

  return { categories, stores, products, orders: [], users, sessions: {}, seeded_at: nowISO() };
}

let db;

async function loadDB() {
  if (DATABASE_URL) {
    const p = pg();
    await p.query(`CREATE TABLE IF NOT EXISTS ${DOC_TABLE} (id integer PRIMARY KEY, doc jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    await p.query('CREATE TABLE IF NOT EXISTS dalil_images (id text PRIMARY KEY, mime text NOT NULL, bytes bytea NOT NULL, size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
    const r = await p.query(`SELECT doc FROM ${DOC_TABLE} WHERE id = 1`);
    if (r.rows.length) {
      db = r.rows[0].doc;
      console.log('تم تحميل البيانات من PostgreSQL');
    } else {
      db = seed();
      await saveDB();
      console.log('تم إنشاء البيانات التجريبية في PostgreSQL');
    }
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seed();
    await saveDB();
  }
}

function saveDB() {
  if (DATABASE_URL) {
    const snapshot = JSON.stringify(db);
    const run = saveChain.then(() => pg().query(
      `INSERT INTO ${DOC_TABLE} (id, doc, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
      [snapshot]
    ));
    saveChain = run.catch(() => {});
    return run;
  }
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  return Promise.resolve();
}

/* ---------------- صور المنتجات ---------------- */

function newTrackCode() {
  const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const b = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += A[b[i] % A.length];
  return out.slice(0, 4) + '-' + out.slice(4);
}

async function saveImage(mime, buf) {
  const imgId = 'i_' + crypto.randomBytes(9).toString('hex');
  if (DATABASE_URL) {
    await pg().query('INSERT INTO dalil_images (id, mime, bytes, size) VALUES ($1, $2, $3, $4)', [imgId, mime, buf, buf.length]);
  } else {
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMG_DIR, imgId), buf);
    fs.writeFileSync(path.join(IMG_DIR, imgId + '.mime'), mime, 'utf8');
  }
  return imgId;
}

async function readImage(imgId) {
  if (!/^i_[a-f0-9]{18}$/.test(imgId)) return null;
  if (DATABASE_URL) {
    const r = await pg().query('SELECT mime, bytes FROM dalil_images WHERE id = $1', [imgId]);
    if (!r.rows.length) return null;
    return { mime: r.rows[0].mime, buf: r.rows[0].bytes };
  }
  const f = path.join(IMG_DIR, imgId);
  if (!fs.existsSync(f)) return null;
  return { mime: fs.readFileSync(f + '.mime', 'utf8'), buf: fs.readFileSync(f) };
}

/* ---------------- بث الطلبات الجديدة للتاجر ---------------- */

const orderStreams = new Set();
function pushNewOrder(storeId, order) {
  const payload = 'data: ' + JSON.stringify({ type: 'order', order: publicOrder(order) }) + '\n\n';
  for (const st of orderStreams) {
    if (st.storeId !== storeId) continue;
    try { st.res.write(payload); } catch (e) { orderStreams.delete(st); }
  }
}

/* ------------------------- أدوات مساعدة ------------------------- */

function publicStore(s) {
  const cat = db.categories.find(c => c.id === s.category_id);
  const count = db.products.filter(p => p.store_id === s.id).length;
  return Object.assign({}, s, { category_name: cat ? cat.name : '', category_icon: cat ? cat.icon : 'store', category_color: cat ? cat.color : '#6366f1', product_count: count, open_state: storeOpenState(s), payments: { cash: true, instapay: String(s.instapay || '').trim(), gateway: false } });
}
function stockLeft(p) { return (p.stock == null || p.stock === '') ? null : Math.max(0, Number(p.stock) || 0); }
function publicProduct(p) {
  const left = stockLeft(p);
  return Object.assign({}, p, { stock: left, available: p.available !== false && (left == null || left > 0) });
}
/* ---------- مواعيد العمل ---------- */
function hhmm(v) { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function storeOpenState(s) {
  const o = hhmm(s.open_time), c = hhmm(s.close_time);
  if (o == null || c == null || o === c) return { open: true, always: true, open_time: '', close_time: '' };
  const d = new Date(Date.now() + CAIRO_OFFSET_MIN * 60000);
  const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
  const open = o < c ? (cur >= o && cur < c) : (cur >= o || cur < c);
  return { open, always: false, open_time: s.open_time, close_time: s.close_time };
}
/* ---------- حد المحاولات ---------- */
const rateBuckets = new Map();
function clientIp(req) { return String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'unknown').trim(); }
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const rec = rateBuckets.get(key);
  if (!rec || now > rec.reset) { rateBuckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  rec.n++;
  if (rateBuckets.size > 5000) { for (const [k, v] of rateBuckets) if (now > v.reset) rateBuckets.delete(k); }
  return rec.n <= max;
}
function publicOrder(o) {
  return { id: o.id, code: o.code, track_code: o.track_code || '', store_id: o.store_id, store_name: o.store_name, type: o.type, items: o.items, customer: o.customer, appointment: o.appointment, fulfillment: o.fulfillment, delivery_fee: o.delivery_fee, total: o.total, status: o.status, payment: o.payment === undefined ? 'cash' : o.payment, payment_ref: o.payment_ref || '', created_at: o.created_at };
}
function cleanPhone(p) { return String(p || '').replace(/[^0-9+]/g, ''); }

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || !db.sessions[token]) return null;
  const sess = db.sessions[token];
  const now = Date.now();
  if (sess.expires_at && Date.parse(sess.expires_at) < now) { delete db.sessions[token]; return null; }
  const user = db.users.find(u => u.id === sess.user_id);
  if (!user) { delete db.sessions[token]; return null; }
  if (!sess.expires_at || Date.parse(sess.expires_at) - now < SESSION_TTL_MS / 2) sess.expires_at = new Date(now + SESSION_TTL_MS).toISOString();
  return { user, token };
}

/* ------------------------- الخادم ------------------------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function send(res, status, data, headers) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }, headers || {}));
  res.end(body);
}
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function fail(res, status, message) { sendJSON(res, status, { error: message }); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('JSON غير صالح')); } });
    req.on('error', reject);
  });
}

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, handler });
}

/* ---------- واجهات عامة ---------- */

/* بوابة الدفع: المكان الجاهز للربط لاحقاً — لما يبقى عندنا مزود، الدالة دي تتحول لاستدعاء حقيقي */
function paymentGatewayReady() { return Boolean(process.env.PAYMENT_GATEWAY_KEY); }

route('GET', '/api/payments/config', (req, res) => {
  sendJSON(res, 200, { methods: ['cash', 'instapay'], gateway: paymentGatewayReady() });
});

route('GET', '/api/bootstrap', (req, res) => {
  const active = db.stores.filter(s => s.status === 'active');
  sendJSON(res, 200, {
    categories: db.categories.map(c => Object.assign({}, c, { store_count: active.filter(s => s.category_id === c.id).length })),
    featured: active.filter(s => s.featured).map(publicStore),
    stats: { stores: active.length, products: db.products.filter(p => active.some(s => s.id === p.store_id)).length, orders: db.orders.length },
  });
});

route('GET', '/api/stores', (req, res, q) => {
  let list = db.stores.filter(s => s.status === 'active');
  if (q.cat) list = list.filter(s => s.category_id === q.cat);
  if (q.q) {
    const t = q.q.trim();
    list = list.filter(s => s.name.includes(t) || (s.description || '').includes(t));
  }
  sendJSON(res, 200, { stores: list.map(publicStore) });
});

route('GET', '/api/stores/:id', (req, res, q, p) => {
  const s = db.stores.find(x => x.id === p.id);
  if (!s || s.status !== 'active') return fail(res, 404, 'المتجر غير موجود');
  sendJSON(res, 200, { store: publicStore(s), products: db.products.filter(x => x.store_id === s.id).map(publicProduct) });
});

route('POST', '/api/orders', async (req, res) => {
  if (!rateLimit('order:' + clientIp(req), 20, 10 * 60000)) return fail(res, 429, 'محاولات كتير — استنى شوية وحاول تاني');
  const b = await readBody(req);
  const store = db.stores.find(s => s.id === b.store_id && s.status === 'active');
  if (!store) return fail(res, 404, 'المتجر غير موجود');
  const type = b.type === 'booking' ? 'booking' : 'order';

  const customer = b.customer || {};
  if (!customer.name || String(customer.name).trim().length < 2) return fail(res, 400, 'اكتب اسمك');
  const phone = cleanPhone(customer.phone);
  if (!/^01[0-9]{9}$/.test(phone)) return fail(res, 400, 'اكتب رقم موبايل صحيح (11 رقم يبدأ بـ 01)');

  if (!Array.isArray(b.items) || b.items.length === 0) return fail(res, 400, 'أضف صنفاً واحداً على الأقل');
  const items = [];
  for (const it of b.items) {
    const prod = db.products.find(x => x.id === it.product_id && x.store_id === store.id);
    if (!prod) return fail(res, 400, 'صنف غير موجود في هذا المتجر');
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    items.push({ product_id: prod.id, name: prod.name, price: prod.price, qty, kind: prod.kind });
  }
  if (type === 'order') {
    const st = storeOpenState(store);
    if (!st.open) return fail(res, 400, 'المحل مقفول حالياً — مواعيد العمل من ' + st.open_time + ' لـ ' + st.close_time);
  }
  for (const it of items) {
    const prod = db.products.find(x => x.id === it.product_id);
    const left = stockLeft(prod);
    if (left != null && it.qty > left) return fail(res, 400, left === 0 ? ('"' + prod.name + '" خلص من المخزن') : ('الكمية المتاحة من "' + prod.name + '" هي ' + left + ' بس'));
  }
  if (type === 'booking') {
    if (!b.appointment || !b.appointment.date || !b.appointment.time) return fail(res, 400, 'اختر يوم ووقت الحجز');
  }
  let fulfillment = 'pickup';
  let delivery_fee = 0;
  if (type === 'order') {
    fulfillment = b.fulfillment === 'delivery' ? 'delivery' : 'pickup';
    if (fulfillment === 'delivery') {
      if (!store.delivery) return fail(res, 400, 'هذا المتجر لا يوفر توصيل');
      delivery_fee = store.delivery_fee || 0;
      if (!customer.address || String(customer.address).trim().length < 5) return fail(res, 400, 'اكتب العنوان بالتفصيل للتوصيل');
    }
  }
  if (type === 'order' && b.payment === 'instapay' && !String(store.instapay || '').trim()) return fail(res, 400, 'المحل مش مفعّل الدفع بإنستاباي');
  const subtotal = items.reduce((t, i) => t + i.price * i.qty, 0);
  const order = {
    id: id('o'), code: orderCode(), store_id: store.id, store_name: store.name,
    type, items, customer: { name: String(customer.name).trim(), phone, address: String(customer.address || '').trim(), notes: String(customer.notes || '').trim() },
    appointment: type === 'booking' ? { date: b.appointment.date, time: b.appointment.time } : null,
    fulfillment: type === 'order' ? fulfillment : null, delivery_fee,
    total: subtotal + delivery_fee, status: 'new', track_code: newTrackCode(),
    payment: type === 'order' ? (b.payment === 'instapay' ? 'instapay' : 'cash') : null,
    payment_ref: type === 'order' ? orderCode() : null,
    created_at: nowISO(),
  };
  for (const it of items) {
    const prod = db.products.find(x => x.id === it.product_id);
    const left = stockLeft(prod);
    if (left != null) prod.stock = Math.max(0, left - it.qty);
  }
  db.orders.unshift(order);
  await saveDB();
  pushNewOrder(order.store_id, order);
  sendJSON(res, 201, { order: publicOrder(order) });
});

route('GET', '/api/orders', (req, res, q) => {
  const code = String(q.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return fail(res, 400, 'اكتب كود الطلب (8 حروف وأرقام)');
  const list = db.orders.filter(o => o.track_code && o.track_code.replace('-', '') === code).map(publicOrder);
  if (!list.length) return fail(res, 404, 'مفيش طلب بالكود ده');
  sendJSON(res, 200, { orders: list });
});

/* ---------- الدخول ---------- */

route('POST', '/api/login', async (req, res) => {
  if (!rateLimit('login:' + clientIp(req), 10, 15 * 60000)) return fail(res, 429, 'محاولات دخول كتير — استنى ربع ساعة وحاول تاني');
  const b = await readBody(req);
  const user = db.users.find(u => u.username === String(b.username || '').trim());
  if (!user || !verifyPassword(b.password || '', user)) return fail(res, 401, 'اسم المستخدم أو كلمة السر غير صحيحة');
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { user_id: user.id, created_at: nowISO(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() };
  await saveDB();
  sendJSON(res, 200, { token, role: user.role, name: user.name, store_id: user.store_id });
});

route('POST', '/api/logout', async (req, res) => {
  const a = authUser(req);
  if (a) { delete db.sessions[a.token]; await saveDB(); }
  sendJSON(res, 200, { ok: true });
});

route('GET', '/api/me', (req, res) => {
  const a = authUser(req);
  if (!a) return fail(res, 401, 'غير مسجل الدخول');
  sendJSON(res, 200, { role: a.user.role, name: a.user.name, username: a.user.username, store_id: a.user.store_id });
});

route('POST', '/api/change-password', async (req, res) => {
  const a = authUser(req);
  if (!a) return fail(res, 401, 'غير مسجل الدخول');
  const b = await readBody(req);
  if (!verifyPassword(b.current || '', a.user)) return fail(res, 400, 'كلمة السر الحالية غير صحيحة');
  if (!b.next || String(b.next).length < 6) return fail(res, 400, 'كلمة السر الجديدة 6 أحرف على الأقل');
  const { salt, hash } = hashPassword(b.next);
  a.user.salt = salt; a.user.password_hash = hash;
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

/* ---------- لوحة صاحب المحل ---------- */

function requireMerchant(req, res) {
  const a = authUser(req);
  if (!a || a.user.role !== 'merchant') { fail(res, 403, 'هذه الصفحة لأصحاب المحلات فقط'); return null; }
  return a.user;
}

route('GET', '/api/merchant/overview', (req, res) => {
  const u = requireMerchant(req, res); if (!u) return;
  const store = db.stores.find(s => s.id === u.store_id);
  if (!store) return fail(res, 404, 'المتجر غير موجود');
  sendJSON(res, 200, {
    store: publicStore(store),
    products: db.products.filter(p => p.store_id === store.id).map(publicProduct),
    orders: db.orders.filter(o => o.store_id === store.id).map(publicOrder),
  });
});

route('POST', '/api/merchant/products/:id/image', async (req, res, q, p) => {
  const u = requireMerchant(req, res); if (!u) return;
  const prod = db.products.find(x => x.id === p.id && x.store_id === u.store_id);
  if (!prod) return fail(res, 404, 'الصنف غير موجود');
  const b = await readBody(req);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
  if (!m) return fail(res, 400, 'صيغة الصورة غير مدعومة');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return fail(res, 400, 'الصورة فاضية');
  if (buf.length > 1600000) return fail(res, 400, 'حجم الصورة كبير، جرب صورة أصغر');
  const imgId = await saveImage(m[1], buf);
  prod.image = '/img/' + imgId;
  await saveDB();
  sendJSON(res, 200, { image: prod.image, product: publicProduct(prod) });
});

route('DELETE', '/api/merchant/products/:id/image', async (req, res, q, p) => {
  const u = requireMerchant(req, res); if (!u) return;
  const prod = db.products.find(x => x.id === p.id && x.store_id === u.store_id);
  if (!prod) return fail(res, 404, 'الصنف غير موجود');
  prod.image = '';
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

route('GET', '/img/:id', async (req, res, q, p) => {
  const img = await readImage(p.id);
  if (!img) return fail(res, 404, 'الصورة غير موجودة');
  res.writeHead(200, { 'Content-Type': img.mime, 'Content-Length': img.buf.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  res.end(img.buf);
});

route('GET', '/api/merchant/stream', (req, res, q) => {
  const token = String(q.token || '');
  const session = db.sessions[token];
  const user = session ? db.users.find(x => x.id === session.user_id) : null;
  if (!user || user.role !== 'merchant') return fail(res, 403, 'غير مسموح');
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 5000\n\n');
  const entry = { res, storeId: user.store_id };
  orderStreams.add(entry);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(ping); orderStreams.delete(entry); });
});

route('PUT', '/api/merchant/store', async (req, res) => {
  const u = requireMerchant(req, res); if (!u) return;
  const store = db.stores.find(s => s.id === u.store_id);
  if (!store) return fail(res, 404, 'المتجر غير موجود');
  const b = await readBody(req);
  for (const k of ['name', 'description', 'phone', 'address', 'hours']) {
    if (typeof b[k] === 'string' && b[k].trim()) store[k] = b[k].trim();
  }
  for (const k of ['open_time', 'close_time', 'instapay']) { if (typeof b[k] === 'string') store[k] = b[k].trim(); }
  if (typeof b.delivery === 'boolean') store.delivery = b.delivery;
  if (b.delivery_fee != null && !isNaN(+b.delivery_fee) && +b.delivery_fee >= 0) store.delivery_fee = +b.delivery_fee;
  await saveDB();
  sendJSON(res, 200, { store: publicStore(store) });
});

route('POST', '/api/merchant/products', async (req, res) => {
  const u = requireMerchant(req, res); if (!u) return;
  const b = await readBody(req);
  if (!b.name || String(b.name).trim().length < 2) return fail(res, 400, 'اكتب اسم الصنف');
  const price = +b.price;
  if (isNaN(price) || price < 0) return fail(res, 400, 'اكتب سعراً صحيحاً');
  const p = { id: id('p'), store_id: u.store_id, name: String(b.name).trim(), description: String(b.description || '').trim(), price, kind: b.kind === 'service' ? 'service' : 'product', duration: String(b.duration || '').trim(), image: String(b.image || '').trim(), stock: (b.stock === '' || b.stock == null) ? null : Math.max(0, parseInt(b.stock, 10) || 0), available: b.available !== false };
  db.products.push(p);
  await saveDB();
  sendJSON(res, 201, { product: publicProduct(p) });
});

route('PUT', '/api/merchant/products/:id', async (req, res, q, p) => {
  const u = requireMerchant(req, res); if (!u) return;
  const prod = db.products.find(x => x.id === p.id && x.store_id === u.store_id);
  if (!prod) return fail(res, 404, 'الصنف غير موجود');
  const b = await readBody(req);
  if (typeof b.name === 'string' && b.name.trim()) prod.name = b.name.trim();
  if (typeof b.description === 'string') prod.description = b.description.trim();
  if (b.price != null && !isNaN(+b.price) && +b.price >= 0) prod.price = +b.price;
  if (b.kind === 'service' || b.kind === 'product') prod.kind = b.kind;
  if (typeof b.duration === 'string') prod.duration = b.duration.trim();
  if (typeof b.image === 'string') prod.image = b.image.trim();
  if (b.stock !== undefined) prod.stock = (b.stock === '' || b.stock === null) ? null : Math.max(0, parseInt(b.stock, 10) || 0);
  if (typeof b.available === 'boolean') prod.available = b.available;
  await saveDB();
  sendJSON(res, 200, { product: publicProduct(prod) });
});

route('DELETE', '/api/merchant/products/:id', async (req, res, q, p) => {
  const u = requireMerchant(req, res); if (!u) return;
  const i = db.products.findIndex(x => x.id === p.id && x.store_id === u.store_id);
  if (i === -1) return fail(res, 404, 'الصنف غير موجود');
  db.products.splice(i, 1);
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

const ORDER_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'done', 'cancelled'];

route('PUT', '/api/merchant/orders/:id', async (req, res, q, p) => {
  const u = requireMerchant(req, res); if (!u) return;
  const o = db.orders.find(x => x.id === p.id && x.store_id === u.store_id);
  if (!o) return fail(res, 404, 'الطلب غير موجود');
  const b = await readBody(req);
  if (!ORDER_STATUSES.includes(b.status)) return fail(res, 400, 'حالة غير صحيحة');
  o.status = b.status;
  await saveDB();
  sendJSON(res, 200, { order: publicOrder(o) });
});

/* ---------- لوحة الأدمن ---------- */

function requireAdmin(req, res) {
  const a = authUser(req);
  if (!a || a.user.role !== 'admin') { fail(res, 403, 'هذه الصفحة للأدمن فقط'); return null; }
  return a.user;
}

route('GET', '/api/admin/overview', (req, res) => {
  requireAdmin(req, res) || void 0;
  const u = authUser(req);
  if (!u || u.user.role !== 'admin') return;
  const stores = db.stores.map(publicStore);
  sendJSON(res, 200, {
    stats: {
      stores: stores.length,
      active: stores.filter(s => s.status === 'active').length,
      products: db.products.length,
      orders: db.orders.length,
      new_orders: db.orders.filter(o => o.status === 'new').length,
      revenue: db.orders.filter(o => o.status !== 'cancelled').reduce((t, o) => t + o.total, 0),
    },
    categories: db.categories,
    stores,
    orders: db.orders.slice(0, 200).map(publicOrder),
    users: db.users.map(u2 => ({ id: u2.id, username: u2.username, role: u2.role, name: u2.name, store_id: u2.store_id })),
  });
});

route('POST', '/api/admin/stores', async (req, res) => {
  const u = requireAdmin(req, res); if (!u) return;
  const b = await readBody(req);
  if (!b.name || String(b.name).trim().length < 2) return fail(res, 400, 'اكتب اسم المحل');
  if (!db.categories.find(c => c.id === b.category_id)) return fail(res, 400, 'اختر تصنيفاً صحيحاً');
  const s = { id: id('s'), name: String(b.name).trim(), category_id: b.category_id, description: String(b.description || '').trim(), phone: cleanPhone(b.phone), address: String(b.address || '').trim(), hours: String(b.hours || '').trim(), delivery: !!b.delivery, delivery_fee: +b.delivery_fee || 0, featured: !!b.featured, rating: 5.0, status: 'active', created_at: nowISO() };
  db.stores.push(s);
  let owner = null;
  if (b.owner_username) {
    const uname = String(b.owner_username).trim();
    if (db.users.find(x => x.username === uname)) return fail(res, 400, 'اسم المستخدم مستخدم من قبل');
    if (!b.owner_password || String(b.owner_password).length < 6) return fail(res, 400, 'كلمة سر صاحب المحل 6 أحرف على الأقل');
    owner = makeUser(uname, b.owner_password, 'merchant', s.name, s.id);
    db.users.push(owner);
  }
  await saveDB();
  sendJSON(res, 201, { store: publicStore(s), owner: owner ? { username: owner.username } : null });
});

route('PUT', '/api/admin/stores/:id', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  const s = db.stores.find(x => x.id === p.id);
  if (!s) return fail(res, 404, 'المتجر غير موجود');
  const b = await readBody(req);
  for (const k of ['name', 'description', 'address', 'hours']) if (typeof b[k] === 'string' && b[k].trim()) s[k] = b[k].trim();
  if (typeof b.phone === 'string') s.phone = cleanPhone(b.phone);
  if (b.category_id && db.categories.find(c => c.id === b.category_id)) s.category_id = b.category_id;
  if (typeof b.delivery === 'boolean') s.delivery = b.delivery;
  if (b.delivery_fee != null && !isNaN(+b.delivery_fee) && +b.delivery_fee >= 0) s.delivery_fee = +b.delivery_fee;
  if (typeof b.featured === 'boolean') s.featured = b.featured;
  if (b.rating != null && !isNaN(+b.rating)) s.rating = Math.max(0, Math.min(5, +b.rating));
  if (b.status === 'active' || b.status === 'suspended') s.status = b.status;
  await saveDB();
  sendJSON(res, 200, { store: publicStore(s) });
});

route('DELETE', '/api/admin/stores/:id', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  const i = db.stores.findIndex(x => x.id === p.id);
  if (i === -1) return fail(res, 404, 'المتجر غير موجود');
  db.stores.splice(i, 1);
  db.products = db.products.filter(x => x.store_id !== p.id);
  const owner = db.users.find(x => x.store_id === p.id);
  if (owner) db.users = db.users.filter(x => x.id !== owner.id);
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

route('POST', '/api/admin/categories', async (req, res) => {
  const u = requireAdmin(req, res); if (!u) return;
  const b = await readBody(req);
  if (!b.name || String(b.name).trim().length < 2) return fail(res, 400, 'اكتب اسم التصنيف');
  const c = { id: id('c'), name: String(b.name).trim(), icon: String(b.icon || 'store'), color: String(b.color || '#6366f1') };
  db.categories.push(c);
  await saveDB();
  sendJSON(res, 201, { category: c });
});

route('PUT', '/api/admin/categories/:id', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  const c = db.categories.find(x => x.id === p.id);
  if (!c) return fail(res, 404, 'التصنيف غير موجود');
  const b = await readBody(req);
  if (typeof b.name === 'string' && b.name.trim()) c.name = b.name.trim();
  if (typeof b.icon === 'string' && b.icon.trim()) c.icon = b.icon.trim();
  if (typeof b.color === 'string' && b.color.trim()) c.color = b.color.trim();
  await saveDB();
  sendJSON(res, 200, { category: c });
});

route('DELETE', '/api/admin/categories/:id', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  if (db.stores.some(s => s.category_id === p.id)) return fail(res, 400, 'لا يمكن حذف تصنيف به محلات');
  const i = db.categories.findIndex(x => x.id === p.id);
  if (i === -1) return fail(res, 404, 'التصنيف غير موجود');
  db.categories.splice(i, 1);
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

route('PUT', '/api/admin/orders/:id', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  const o = db.orders.find(x => x.id === p.id);
  if (!o) return fail(res, 404, 'الطلب غير موجود');
  const b = await readBody(req);
  if (!ORDER_STATUSES.includes(b.status)) return fail(res, 400, 'حالة غير صحيحة');
  o.status = b.status;
  await saveDB();
  sendJSON(res, 200, { order: publicOrder(o) });
});

route('POST', '/api/admin/users/:id/reset-password', async (req, res, q, p) => {
  const u = requireAdmin(req, res); if (!u) return;
  const target = db.users.find(x => x.id === p.id && x.role === 'merchant');
  if (!target) return fail(res, 404, 'المستخدم غير موجود');
  const b = await readBody(req);
  if (!b.password || String(b.password).length < 6) return fail(res, 400, 'كلمة السر 6 أحرف على الأقل');
  const { salt, hash } = hashPassword(b.password);
  target.salt = salt; target.password_hash = hash;
  await saveDB();
  sendJSON(res, 200, { ok: true });
});

/* ---------- تقديم الملفات الثابتة ---------- */

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'ممنوع');
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, fallback) => {
        if (e2) return fail(res, 404, 'غير موجود');
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const pathname = decodeURIComponent(u.pathname);
    if (pathname.startsWith('/api/') || pathname.startsWith('/img/')) {
      const q = Object.fromEntries(u.searchParams.entries());
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = pathname.match(r.rx);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => params[k] = m[i + 1]);
        return await r.handler(req, res, q, params);
      }
      return fail(res, 404, 'واجهة غير موجودة');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'غير مسموح');
    serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, e.message === 'JSON غير صالح' ? e.message : 'خطأ في الخادم');
  }
});

async function boot() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await loadDB();
      if (ADMIN_PASSWORD) {
        const adm = db.users.find(u => u.username === 'admin');
        if (adm && !verifyPassword(ADMIN_PASSWORD, adm)) {
          const { salt, hash } = hashPassword(ADMIN_PASSWORD);
          adm.salt = salt; adm.password_hash = hash;
          await saveDB();
          console.log('تم تحديث كلمة سر الأدمن من متغير البيئة');
        }
      }
      return;
    }
    catch (e) {
      console.error(`محاولة تحميل البيانات رقم ${attempt} فشلت: ${e.message}`);
      if (attempt === 5) throw e;
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    Promise.resolve(saveChain).catch(() => {}).then(() => (pgPool ? pgPool.end().catch(() => {}) : null)).then(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

boot().then(() => {
  server.listen(PORT, () => {
    console.log('منصة دليل شغالة على: http://localhost:' + PORT);
    console.log(ADMIN_PASSWORD ? 'حساب الأدمن: admin (كلمة السر من متغير البيئة)' : 'حساب الأدمن: admin / dalil2026');
    console.log('حساب تاجر تجريبي: shifaa / dalil2026');
    console.log(DATABASE_URL ? 'التخزين: PostgreSQL' : 'التخزين: ملف data/db.json محلي');
  });
}).catch((e) => {
  console.error('تعذّر تشغيل الخادم:', e.message);
  process.exit(1);
});
