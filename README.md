# دليل — Dalil Platform v2

منصة دليل المحلات والخدمات (عربي RTL): دليل عام + طلبات توصيل وحجز خدمات، بوابة تاجر كاملة، ولوحة إدارة. بدون أي اعتماديات خارجية — Node.js فقط.

## التشغيل محلياً

```bash
node server.js
# أو
npm start
```

ثم افتح http://localhost:3000

- لا يوجد `npm install` — صفر اعتماديات، Node 18 أو أحدث يكفي.
- قاعدة البيانات ملف JSON يُنشأ تلقائياً في `data/db.json` ببيانات تجريبية جاهزة عند أول تشغيل.

## المتغيرات البيئية

| المتغير | الافتراضي | الوصف |
|---|---|---|
| `PORT` | `3000` | منفذ السيرفر (كل منصات الاستضافة تحقنه تلقائياً) |

## حسابات الدخول التجريبية

- بوابة التاجر `/merchant.html`: اسم المستخدم `prince` (أو `shifaa` أو `ahmed`)، كلمة السر `dalil2026`
- لوحة الإدارة `/admin.html`: اسم المستخدم `admin`، كلمة السر `dalil2026`

> غيّر كلمات السر دي قبل أي نشر حقيقي (من لوحة الإدارة أو بتعديل البيانات المبدئية في `server.js`).

## الصفحات

| المسار | الوصف |
|---|---|
| `/` | الدليل الرئيسي: بحث، أقسام، محلات |
| `/store.html?id=…` | صفحة المحل: المنتجات، السلة، الطلب/الحجز |
| `/track.html` | تتبع الطلبات برقم الموبايل |
| `/merchant.html` | بوابة التاجر: الطلبات، المنتجات، الإحصائيات |
| `/admin.html` | لوحة الإدارة: المحلات، الأقسام، الطلبات |

## النشر (Deploy)

المشروع فيه سيرفر Node، فمينفعش استضافة static فقط. اختار منصة بتشغّل Node:

### Render (الأسهل — مجاني)

1. ارفع المشروع على GitHub.
2. على render.com: New → Web Service → اربط المستودع.
3. Build Command: اتركه فاضياً (مفيش build). Start Command: `node server.js`.
4. Deploy — وهيشتغل على رابط `https://<name>.onrender.com`.

### Railway

1. New Project → Deploy from GitHub repo.
2. Railway هيكتشف Node تلقائياً ويشغّل `npm start`.

### VPS (Ubuntu)

```bash
git clone <repo> && cd dalil-platform
node server.js          # أو مع مدير عمليات:
npm i -g pm2 && pm2 start server.js --name dalil
```

ضع Nginx أمامه كـ reverse proxy للدومين و HTTPS.

## قائمة فحص الإنتاج

- [ ] تغيير كلمات سر التاجر والأدمن الافتراضية
- [ ] تحديث بيانات المحلات التجريبية أو مسحها
- [ ] `data/db.json` خارج Git (موجود في `.gitignore`) — مع نسخ احتياطي دوري على السيرفر
- [ ] HTTPS عبر المنصة أو Nginx + Let's Encrypt
- [ ] مراجعة حدود حجم الطلبات وعددها (السيرفر فيه rate limiting مدمج)

## البنية

```
server.js          # السيرفر + API + البيانات المبدئية (zero-dependency)
data/db.json       # قاعدة البيانات (تُنشأ تلقائياً — لا تُرفع)
public/
  index.html       # الرئيسية
  store.html       # صفحة المحل
  track.html       # تتبع الطلبات
  merchant.html    # بوابة التاجر
  admin.html       # لوحة الإدارة
  css/style.css    # ثيم Aurora الكامل
  js/              # common / effects / home / store / track / merchant / admin
```
