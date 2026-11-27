/* أدوات مشتركة بين الصفحات */

const API = {
  token() { return localStorage.getItem('dalil_token') || ''; },
  setToken(t) { t ? localStorage.setItem('dalil_token', t) : localStorage.removeItem('dalil_token'); },
  async call(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        this.token() ? { Authorization: 'Bearer ' + this.token() } : {}
      ),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error(data.error || 'حصل خطأ، حاول تاني');
    return data;
  },
  get(url) { return this.call('GET', url); },
  post(url, body) { return this.call('POST', url, body); },
  put(url, body) { return this.call('PUT', url, body); },
  del(url) { return this.call('DELETE', url); },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  return (Math.round((+n || 0) * 100) / 100).toLocaleString('ar-EG') + ' ج.م';
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  } catch (e) { return ''; }
}

const ORDER_STATUS = {
  new: 'جديد',
  accepted: 'مقبول',
  preparing: 'قيد التجهيز',
  ready: 'جاهز',
  done: 'تم التسليم',
  cancelled: 'ملغي',
};
function statusBadge(s) {
  return `<span class="status-badge st-${esc(s)}">${ORDER_STATUS[s] || esc(s)}</span>`;
}

function stars(rating) {
  const r = Math.round(+rating || 0);
  let s = '';
  for (let i = 0; i < 5; i++) s += i < r ? '★' : '☆';
  return s;
}

function toast(msg, isErr) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function waLink(phone) {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '2' + p;
  return 'https://wa.me/' + p;
}

function topbarHTML(active) {
  const links = [
    ['/', 'الرئيسية', 'home'],
    ['/#stores', 'المتاجر', 'stores'],
    ['/track.html', 'تتبع طلبك', 'track'],
    ['/#about', 'عن دليل', 'about'],
  ];
  return `
  <header class="topbar">
    <div class="container topbar-inner">
      <a class="brand" href="/">
        <span class="brand-mark">${icon('logo')}</span>
        <span>
          <span class="brand-name">دليـ<em>ـل</em></span>
          <span class="brand-tag">دليلك لكل المحلات والخدمات</span>
        </span>
      </a>
      <nav class="nav">
        ${links.map(([href, label, key]) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`).join('')}
        <a href="/merchant.html" class="nav-cta">${icon('store')} لوحة المحل</a>
      </nav>
    </div>
  </header>`;
}

function footerHTML() {
  return `
  <footer class="footer">
    <div class="container footer-inner">
      <span>© 2026 <b>دليل</b> — كل المحلات والخدمات في مكان واحد</span>
      <a href="/admin.html" style="display:inline-flex;align-items:center;gap:6px">${icon('shield')} دخول الأدمن</a>
    </div>
  </footer>`;
}

/* ---------- الشكاوى ---------- */
function openComplaintForm(opts) {
  opts = opts || {};
  let veil = document.getElementById('complaintVeil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'complaintVeil';
    veil.className = 'modal-veil';
    veil.innerHTML = '<div class="modal" id="complaintModal"></div>';
    document.body.appendChild(veil);
  }
  const modal = document.getElementById('complaintModal');
  const storeLabel = opts.storeName ? `<p class="text-muted" style="font-size:13px;margin:0 0 12px">شكوى على: <b>${esc(opts.storeName)}</b>${opts.orderCode ? ' — طلب ' + esc(opts.orderCode) : ''}</p>` : '';
  modal.innerHTML = `
    <h3>تقديم شكوى</h3>
    ${storeLabel}
    <form id="complaintForm">
      <div class="field"><label>اسمك *</label><input name="name" required placeholder="اكتب اسمك"></div>
      <div class="field"><label>رقم الموبايل *</label><input name="phone" required inputmode="tel" maxlength="11" placeholder="01xxxxxxxxx"></div>
      ${opts.orderCode ? '' : '<div class="field"><label>كود الطلب (لو الشكوى على طلب معين)</label><input name="order_code" dir="ltr" maxlength="12" placeholder="7K2M-9QX4"></div>'}
      <div class="field"><label>تفاصيل الشكوى *</label><textarea name="message" required minlength="10" maxlength="2000" rows="4" placeholder="اكتب اللي حصل بالتفصيل"></textarea></div>
      <div class="modal-actions">
        <button class="btn btn-gold" type="submit">إرسال الشكوى</button>
        <button class="btn btn-ghost" type="button" id="complaintCancel">إلغاء</button>
      </div>
    </form>`;
  veil.classList.add('open');
  veil.onclick = (e) => { if (e.target === veil) veil.classList.remove('open'); };
  document.getElementById('complaintCancel').onclick = () => veil.classList.remove('open');
  document.getElementById('complaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'جاري الإرسال...';
    try {
      await API.post('/api/complaints', {
        store_id: opts.storeId || '',
        order_code: opts.orderCode || (f.order_code ? f.order_code.value.trim() : ''),
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        message: f.message.value.trim(),
      });
      modal.innerHTML = `<div class="empty" style="padding:26px 10px">${icon('checkCircle')}<b>وصلتنا شكوتك</b>المحل والإدارة هيشوفوها وهيتابعوها معاك.</div>
        <div class="modal-actions"><button class="btn btn-gold" type="button" id="complaintDone">تمام</button></div>`;
      document.getElementById('complaintDone').onclick = () => veil.classList.remove('open');
    } catch (err) {
      toast(err.message || 'مش قادرين نبعت الشكوى دلوقتي', true);
      btn.disabled = false; btn.textContent = 'إرسال الشكوى';
    }
  });
}
