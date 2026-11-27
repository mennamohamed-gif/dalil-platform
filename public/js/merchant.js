/* لوحة صاحب المحل */
document.getElementById('topbar').innerHTML = topbarHTML('');
const app = document.getElementById('app');
let DATA = null;
let view = 'orders';

/* ---------- تسجيل الدخول ---------- */
function renderLogin() {
  app.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-icon">${icon('store')}</div>
      <h1>لوحة المحل</h1>
      <p class="sub">نظام إدارة محترف للخدمات — أضف منتجاتك واستقبل طلباتك</p>
      <form id="loginForm">
        <div class="field"><label>اسم المستخدم</label><input name="username" required autocomplete="username" placeholder="مثال: shifaa"></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" required autocomplete="current-password" placeholder="أدخل كلمة مرورك"></div>
        <button class="btn btn-block" type="submit" id="loginBtn">${icon('logout')} دخول</button>
      </form>
      <div class="demo-hint">حسابات تجريبية:<br>shifaa / dalil2026 (صيدلية) — prince / dalil2026 (مطعم) — ahmed / dalil2026 (عيادة)</div>
      <div class="auth-links"><a href="/">← العودة إلى الرئيسية</a></div>
    </div>
  </div>`;
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    try {
      const r = await API.post('/api/login', { username: f.username.value.trim(), password: f.password.value });
      if (r.role !== 'merchant') {
        toast('هذا الحساب ليس حساب محل. استخدم لوحة الأدمن.', true);
        btn.disabled = false;
        return;
      }
      API.setToken(r.token);
      toast('أهلاً بك يا ' + r.name);
      await loadDash();
    } catch (e2) {
      toast(e2.message, true);
      btn.disabled = false;
    }
  });
}

/* ---------- اللوحة ---------- */
async function loadDash() {
  try {
    DATA = await API.get('/api/merchant/overview');
  } catch (e) {
    API.setToken('');
    renderLogin();
    return;
  }
  renderShell();
  startStream();
}

function renderShell() {
  const s = DATA.store;
  const newCount = DATA.orders.filter(o => o.status === 'new').length;
  app.innerHTML = `
  <div class="dash">
    <aside class="sidebar">
      <div class="side-user">
        <span class="avatar">${esc((s.name || 'م')[0])}</span>
        <span><b>${esc(s.name)}</b><span>${esc(s.category_name)}</span></span>
      </div>
      <nav class="side-nav">
        <button data-v="orders" class="${view === 'orders' ? 'active' : ''}">${icon('bell')} الطلبات ${newCount ? `<span class="status-badge st-new" style="margin-inline-start:auto">${newCount}</span>` : ''}</button>
        <button data-v="products" class="${view === 'products' ? 'active' : ''}">${icon('box')} المنتجات والخدمات</button>
        <button data-v="settings" class="${view === 'settings' ? 'active' : ''}">${icon('settings')} إعدادات المحل</button>
        <a href="/store.html?id=${encodeURIComponent(s.id)}" target="_blank">${icon('eye')} عرض صفحتي</a>
        <button id="logoutBtn">${icon('logout')} خروج</button>
      </nav>
    </aside>
    <main class="dash-main" id="dashMain"></main>
  </div>`;

  document.querySelectorAll('.side-nav button[data-v]').forEach(b => b.addEventListener('click', () => {
    view = b.dataset.v;
    document.querySelectorAll('.side-nav button[data-v]').forEach(x => x.classList.toggle('active', x === b));
    renderView();
  }));
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await API.post('/api/logout'); } catch (e) {}
    API.setToken('');
    renderLogin();
  });
  renderView();
}

function renderView() {
  const m = document.getElementById('dashMain');
  if (view === 'orders') m.innerHTML = ordersView();
  else if (view === 'products') m.innerHTML = productsView();
  else m.innerHTML = settingsView();
  bindView(m);
}

/* ---------- الطلبات ---------- */
function ordersView() {
  const os = DATA.orders;
  const stats = [
    { ic: 'bell', c: 'linear-gradient(145deg,#60a5fa,#2563eb)', n: os.filter(o => o.status === 'new').length, l: 'طلبات جديدة' },
    { ic: 'clock', c: 'linear-gradient(145deg,#fbbf24,#b45309)', n: os.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status)).length, l: 'قيد التنفيذ' },
    { ic: 'checkCircle', c: 'linear-gradient(145deg,#34d399,#047857)', n: os.filter(o => o.status === 'done').length, l: 'مكتملة' },
    { ic: 'chart', c: 'linear-gradient(145deg,#9d8cff,#5a48d8)', n: money(os.filter(o => o.status !== 'cancelled').reduce((t, o) => t + o.total, 0)), l: 'إجمالي المبيعات' },
  ];
  return `
    <h2 class="dash-title">الطلبات والحجوزات</h2>
    <p class="dash-sub">أي طلب جديد من صفحتك العامة يظهر هنا فوراً</p>
    <div class="stat-grid">
      ${stats.map(s => `<div class="stat-card"><span class="ficon" style="background:${s.c};color:#fff">${icon(s.ic)}</span><span><b>${s.n}</b><span>${s.l}</span></span></div>`).join('')}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>كل الطلبات (${os.length})</h3>
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" id="alertsBtn" onclick="enableAlerts()">🔔 فعّل تنبيه الصوت</button>
          <button class="btn btn-sm btn-ghost" onclick="refresh()">${icon('clock')} تحديث</button>
        </span>
      </div>
      <div class="table-wrap">
      ${!os.length ? `<div class="empty">${icon('bell')}<b>لا توجد طلبات بعد</b>شارك رابط صفحتك مع عملائك</div>` : `
      <table class="table">
        <thead><tr><th>الطلب</th><th>العميل</th><th>التفاصيل</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${os.map(o => `
          <tr>
            <td><b>${esc(o.code)}</b><br><span class="text-muted" style="font-size:12px" dir="ltr">${esc(o.track_code || '')}</span><br><span class="text-muted" style="font-size:12px">${fmtDate(o.created_at)}<br>${o.type === 'booking' ? 'حجز موعد' : o.fulfillment === 'delivery' ? 'طلب توصيل' : 'طلب استلام'}<br>${o.payment === 'instapay' ? 'إنستاباي — مرجع: ' + esc(o.payment_ref || '') : (o.payment === 'cash' ? 'كاش عند الاستلام' : '')}</span></td>
            <td><b>${esc(o.customer.name)}</b><br><a href="tel:${esc(o.customer.phone)}" style="color:var(--blue);font-size:13px" dir="ltr">${esc(o.customer.phone)}</a></td>
            <td style="max-width:280px">${o.items.map(i => `• ${esc(i.name)} × ${i.qty}`).join('<br>')}
              ${o.appointment ? `<br><span style="color:var(--purple-2)">${icon('calendar')} ${esc(o.appointment.date)} — ${esc(o.appointment.time)}</span>` : ''}
              ${o.customer.address ? `<br><span class="text-muted" style="font-size:12px">${esc(o.customer.address)}</span>` : ''}
              ${o.customer.notes ? `<br><span class="text-muted" style="font-size:12px">ملاحظة: ${esc(o.customer.notes)}</span>` : ''}
            </td>
            <td class="num">${money(o.total)}</td>
            <td>
              <select class="status-select" onchange="setStatus('${o.id}', this.value)">
                ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`}
      </div>
    </div>`;
}

window.setStatus = async function (oid, status) {
  try {
    await API.put('/api/merchant/orders/' + oid, { status });
    const o = DATA.orders.find(x => x.id === oid);
    if (o) o.status = status;
    toast('تم تحديث حالة الطلب');
    renderShell();
  } catch (e) { toast(e.message, true); }
};

window.refresh = async function () {
  DATA = await API.get('/api/merchant/overview');
  renderShell();
  toast('تم التحديث');
};

/* ---------- المنتجات ---------- */
function productsView() {
  const ps = DATA.products;
  return `
    <div class="flex-between mb-3">
      <div><h2 class="dash-title">المنتجات والخدمات</h2><p class="dash-sub" style="margin:4px 0 0">أي إضافة أو تعديل يظهر للزوار فوراً</p></div>
      <button class="btn btn-gold" onclick="openProductModal()">${icon('plus')} إضافة صنف</button>
    </div>
    ${!ps.length ? `<div class="empty">${icon('box')}<b>لا توجد أصناف بعد</b>ابدأ بإضافة أول منتج أو خدمة</div>` : `
    <div class="pgrid">
      ${ps.map(p => `
      <div class="pitem ${p.available === false ? 'unavailable' : ''}" style="${p.available === false ? 'opacity:.55' : ''}">
        ${p.image ? `<img src="${esc(p.image)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin-bottom:10px">` : ''}
        <div class="flex-between">
          <b>${esc(p.name)}</b>
          <span class="kind-badge ${p.kind === 'service' ? 'kind-service' : 'kind-product'}">${p.kind === 'service' ? 'خدمة' : 'منتج'}</span>
        </div>
        <span class="pdesc">${esc(p.description || '')}</span>
        <span class="text-muted" style="font-size:12px">${p.stock == null ? 'المخزون: غير محدود' : (p.stock > 0 ? 'المخزون: ' + p.stock : 'خلص من المخزن')}</span>
        <div class="prow">
          <span class="price">${money(p.price)}</span>
          <span class="actions">
            <button class="icon-btn" title="تعديل" onclick="openProductModal('${p.id}')">${icon('edit')}</button>
            <button class="icon-btn" title="حذف" onclick="delProduct('${p.id}')">${icon('trash')}</button>
          </span>
        </div>
        <label class="avail-toggle"><input type="checkbox" ${p.available !== false ? 'checked' : ''} onchange="toggleAvail('${p.id}', this.checked)"> متاح للطلب</label>
      </div>`).join('')}
    </div>`}`;
}

/* ---------- صور المنتجات + تنبيه الطلبات ---------- */

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type || '')) return reject(new Error('اختار صورة صحيحة'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('مش قادر أقرأ الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('مش قادر أفتح الصورة'));
      img.onload = () => {
        const steps = [[1000, 0.78], [800, 0.7], [640, 0.6], [480, 0.5]];
        for (const [side, q] of steps) {
          const scale = Math.min(1, side / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = cv.toDataURL('image/jpeg', q);
          if (out.length < 1900000) return resolve(out);
        }
        reject(new Error('الصورة كبيرة جداً، جرب صورة أصغر'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [0, 0.25].forEach(off => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.22);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + off); o.stop(t0 + off + 0.24);
    });
  } catch (e) {}
}

window.enableAlerts = async function () {
  try { beep(); } catch (e) {}
  if ('Notification' in window && Notification.permission !== 'granted') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  const b = document.getElementById('alertsBtn');
  if (b) b.innerHTML = (('Notification' in window && Notification.permission === 'granted') ? '✅ التنبيهات شغالة' : '🔔 فعّل التنبيهات من إعدادات المتصفح');
  toast('التنبيهات اتفعلت على الجهاز ده');
};

function notifyNewOrder(order) {
  beep();
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('طلب جديد — ' + order.store_name, { body: order.customer.name + ' • ' + money(order.total), tag: order.id });
    }
  } catch (e) {}
  const base = 'طلب جديد 🔔';
  if (!document.title.startsWith(base)) {
    const old = document.title;
    document.title = base + ' — ' + old;
    setTimeout(() => { if (document.title.startsWith(base)) document.title = old; }, 20000);
  }
  toast('🔔 طلب جديد من ' + order.customer.name);
}

let es = null;
function startStream() {
  if (!('EventSource' in window)) return;
  try { if (es) es.close(); } catch (e) {}
  es = new EventSource('/api/merchant/stream?token=' + encodeURIComponent(API.token()));
  es.onmessage = ev => {
    let d = null;
    try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (!d || d.type !== 'order') return;
    if (DATA && DATA.orders) DATA.orders.unshift(d.order);
    notifyNewOrder(d.order);
    const modalOpen = document.getElementById('modalVeil').classList.contains('open');
    if (!modalOpen) renderShell();
  };
  es.onerror = () => {
    // إعادة الاتصال تلقائية من المتصفح؛ لو الطلب اتقفل تمامًا نرجع للتحديث الدوري
  };
  if (!window.__pollTimer) {
    window.__pollTimer = setInterval(() => {
      if (!API.token()) return;
      if (es && es.readyState === 1) return;
      API.get('/api/merchant/overview').then(d => {
        const known = new Set((DATA.orders || []).map(o => o.id));
        const fresh = d.orders.filter(o => !known.has(o.id));
        DATA = d;
        if (fresh.length) { fresh.forEach(notifyNewOrder); renderShell(); }
      }).catch(() => {});
    }, 25000);
  }
}

window.openProductModal = function (pid) {
  const p = pid ? DATA.products.find(x => x.id === pid) : null;
  const veil = document.getElementById('modalVeil');
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <h3>${p ? 'تعديل الصنف' : 'إضافة صنف جديد'}</h3>
    <form id="pForm">
      <div class="field"><label>الاسم *</label><input name="name" required value="${p ? esc(p.name) : ''}" placeholder="مثال: وجبة كشري كبير / كشف باطنة"></div>
      <div class="field"><label>الوصف</label><input name="description" value="${p ? esc(p.description || '') : ''}" placeholder="وصف مختصر يظهر للعميل"></div>
      <div class="form-grid-2">
        <div class="field"><label>السعر (ج.م) *</label><input name="price" type="number" min="0" step="0.5" required value="${p ? p.price : ''}"></div>
        <div class="field"><label>النوع</label>
          <select name="kind">
            <option value="product" ${p && p.kind === 'product' ? 'selected' : ''}>منتج (يُطلب)</option>
            <option value="service" ${p && p.kind === 'service' ? 'selected' : ''}>خدمة (تُحجز بموعد)</option>
          </select>
        </div>
      </div>
      <div class="field"><label>مدة الخدمة (اختياري، للخدمات)</label><input name="duration" value="${p ? esc(p.duration || '') : ''}" placeholder="مثال: 30 دقيقة"></div>
      <div class="field"><label>الكمية في المخزن (سيبها فاضية = غير محدود)</label><input name="stock" type="number" min="0" step="1" value="${p && p.stock != null ? p.stock : ''}" placeholder="مثال: 20"></div>
      <div class="field">
        <label>صورة الصنف (اختياري)</label>
        <input name="photo" type="file" accept="image/*">
        <div id="pPhotoPrev" style="margin-top:8px">${p && p.image ? `<img src="${esc(p.image)}" alt="" style="max-width:150px;border-radius:14px">` : '<span class="text-muted" style="font-size:12.5px">من غير صورة هيظهر بشكل مرتب بالنص بس</span>'}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-gold" type="submit">${icon('check')} حفظ</button>
        <button class="btn btn-ghost" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>`;
  veil.classList.add('open');
  veil.onclick = e => { if (e.target === veil) closeModal(); };
  document.getElementById('pForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const body = { name: f.name.value, description: f.description.value, price: +f.price.value, kind: f.kind.value, duration: f.duration.value, stock: f.stock && f.stock.value !== '' ? +f.stock.value : null };
    try {
      let saved = p;
      if (p) { const r = await API.put('/api/merchant/products/' + p.id, body); saved = r.product || p; }
      else { const r = await API.post('/api/merchant/products', body); saved = r.product; }
      const file = f.photo && f.photo.files && f.photo.files[0];
      if (file && saved && saved.id) {
        const dataUrl = await compressImage(file);
        await API.post('/api/merchant/products/' + saved.id + '/image', { data: dataUrl });
      }
      closeModal();
      toast(p ? 'تم التعديل — ظاهر للناس الآن' : 'تمت الإضافة — ظاهر للناس الآن');
      await window.refresh();
      view = 'products';
      renderShell();
    } catch (e2) { toast(e2.message, true); }
  });
};

window.closeModal = function () { document.getElementById('modalVeil').classList.remove('open'); };

window.delProduct = async function (pid) {
  if (!confirm('متأكد من حذف هذا الصنف؟ سيختفي من صفحتك فوراً.')) return;
  try {
    await API.del('/api/merchant/products/' + pid);
    DATA.products = DATA.products.filter(x => x.id !== pid);
    toast('تم الحذف');
    renderShell();
  } catch (e) { toast(e.message, true); }
};

window.toggleAvail = async function (pid, available) {
  try {
    await API.put('/api/merchant/products/' + pid, { available });
    const p = DATA.products.find(x => x.id === pid);
    if (p) p.available = available;
    toast(available ? 'الصنف متاح الآن' : 'تم إخفاء الصنف مؤقتاً');
    renderShell();
  } catch (e) { toast(e.message, true); }
};

/* ---------- إعدادات المحل ---------- */
function settingsView() {
  const s = DATA.store;
  return `
    <h2 class="dash-title">إعدادات المحل</h2>
    <p class="dash-sub">عدّل بيانات محلك — التغييرات تظهر للزوار فور الحفظ</p>
    <div class="panel"><div class="panel-body">
      <form id="storeForm">
        <div class="form-grid-2">
          <div class="field"><label>اسم المحل</label><input name="name" required value="${esc(s.name)}"></div>
          <div class="field"><label>رقم الموبايل / واتساب</label><input name="phone" value="${esc(s.phone || '')}" maxlength="11"></div>
        </div>
        <div class="field"><label>الوصف</label><textarea name="description">${esc(s.description || '')}</textarea></div>
        <div class="form-grid-2">
          <div class="field"><label>العنوان</label><input name="address" value="${esc(s.address || '')}"></div>
          <div class="field"><label>مواعيد العمل (نص يظهر للعميل)</label><input name="hours" value="${esc(s.hours || '')}" placeholder="مثال: يومياً 9ص - 11م"></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>يفتح الساعة</label><input name="open_time" type="time" value="${esc(s.open_time || '')}"></div>
          <div class="field"><label>يقفل الساعة</label><input name="close_time" type="time" value="${esc(s.close_time || '')}"></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>خدمة التوصيل</label>
            <select name="delivery">
              <option value="1" ${s.delivery ? 'selected' : ''}>متاحة</option>
              <option value="0" ${!s.delivery ? 'selected' : ''}>غير متاحة</option>
            </select>
          </div>
          <div class="field"><label>رسوم التوصيل (ج.م)</label><input name="delivery_fee" type="number" min="0" value="${s.delivery_fee || 0}"></div>
        </div>
        <div class="field"><label>عنوان إنستاباي للتحويل (سيبها فاضية لو مش مفعّل)</label><input name="instapay" value="${esc(s.instapay || '')}" placeholder="مثال: 01012345671 أو name@instapay"></div>
        <div class="form-grid-2" style="display:none">
        </div>
        <button class="btn btn-gold" type="submit">${icon('check')} حفظ التعديلات</button>
      </form>
    </div></div>
    <div class="panel"><div class="panel-head"><h3>تغيير كلمة المرور</h3></div><div class="panel-body">
      <form id="pwForm">
        <div class="form-grid-2">
          <div class="field"><label>كلمة المرور الحالية</label><input name="current" type="password" required></div>
          <div class="field"><label>الجديدة (6 أحرف على الأقل)</label><input name="next" type="password" required minlength="6"></div>
        </div>
        <button class="btn" type="submit">${icon('lock')} تغيير</button>
      </form>
    </div></div>`;
}

function bindView(m) {
  const sf = m.querySelector('#storeForm');
  if (sf) sf.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const { store } = await API.put('/api/merchant/store', {
        name: f.name.value, phone: f.phone.value, description: f.description.value,
        address: f.address.value, hours: f.hours.value, open_time: f.open_time.value, close_time: f.close_time.value, instapay: f.instapay.value,
        delivery: f.delivery.value === '1', delivery_fee: +f.delivery_fee.value || 0,
      });
      DATA.store = store;
      toast('تم الحفظ — التعديلات ظاهرة للناس الآن');
      renderShell();
    } catch (e2) { toast(e2.message, true); }
  });
  const pw = m.querySelector('#pwForm');
  if (pw) pw.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await API.post('/api/change-password', { current: pw.current.value, next: pw.next.value });
      toast('تم تغيير كلمة المرور');
      pw.reset();
    } catch (e2) { toast(e2.message, true); }
  });
}

/* بداية */
if (API.token()) loadDash(); else renderLogin();
