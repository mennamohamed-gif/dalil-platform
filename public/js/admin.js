/* لوحة الأدمن — تحكم كامل في المنصة */
document.getElementById('topbar').innerHTML = topbarHTML('');
const app = document.getElementById('app');
let DATA = null;
let view = 'overview';

/* ---------- الدخول ---------- */
function renderLogin() {
  app.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-icon gold">${icon('shield')}</div>
      <h1>لوحة الأدمن</h1>
      <p class="sub">تحكم كامل في المنصة: المتاجر، التصنيفات، الطلبات والحسابات</p>
      <form id="loginForm">
        <div class="field"><label>اسم المستخدم</label><input name="username" required autocomplete="username" placeholder="admin"></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
        <button class="btn btn-gold btn-block" type="submit" id="loginBtn">${icon('shield')} دخول</button>
      </form>
      <div class="demo-hint">الحساب الافتراضي: admin / dalil2026<br>غيّر كلمة المرور من اللوحة بعد أول دخول</div>
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
      if (r.role !== 'admin') {
        toast('هذا الحساب ليس حساب أدمن', true);
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

async function loadDash() {
  try {
    DATA = await API.get('/api/admin/overview');
  } catch (e) {
    API.setToken('');
    renderLogin();
    return;
  }
  renderShell();
}

function renderShell() {
  const nav = [
    ['overview', 'chart', 'نظرة عامة'],
    ['stores', 'store', 'المتاجر'],
    ['categories', 'grid', 'التصنيفات'],
    ['orders', 'bell', 'الطلبات'],
    ['users', 'users', 'الحسابات'],
    ['security', 'lock', 'كلمة المرور'],
  ];
  app.innerHTML = `
  <div class="dash">
    <aside class="sidebar">
      <div class="side-user">
        <span class="avatar" style="background:linear-gradient(145deg,var(--gold-2),var(--gold-deep));color:#2a1a05">${icon('shield')}</span>
        <span><b>الأدمن</b><span>تحكم كامل</span></span>
      </div>
      <nav class="side-nav">
        ${nav.map(([k, ic, l]) => `<button data-v="${k}" class="${view === k ? 'active' : ''}">${icon(ic)} ${l}</button>`).join('')}
        <a href="/" target="_blank">${icon('eye')} عرض الموقع</a>
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
  if (view === 'overview') m.innerHTML = overviewView();
  else if (view === 'stores') m.innerHTML = storesView();
  else if (view === 'categories') m.innerHTML = categoriesView();
  else if (view === 'orders') m.innerHTML = ordersView();
  else if (view === 'users') m.innerHTML = usersView();
  else m.innerHTML = securityView();
  bindView(m);
}

window.refresh = async function () {
  DATA = await API.get('/api/admin/overview');
  renderShell();
  toast('تم التحديث');
};

/* ---------- نظرة عامة ---------- */
function overviewView() {
  const s = DATA.stats;
  const cards = [
    { ic: 'store', c: 'linear-gradient(145deg,#9d8cff,#5a48d8)', n: s.stores, l: 'إجمالي المتاجر' },
    { ic: 'eye', c: 'linear-gradient(145deg,#34d399,#047857)', n: s.active, l: 'متاجر ظاهرة' },
    { ic: 'box', c: 'linear-gradient(145deg,#60a5fa,#2563eb)', n: s.products, l: 'منتج وخدمة' },
    { ic: 'bell', c: 'linear-gradient(145deg,#fbbf24,#b45309)', n: s.new_orders, l: 'طلبات جديدة' },
    { ic: 'chart', c: 'linear-gradient(145deg,#f0c47f,#b97f35)', n: money(s.revenue), l: 'إجمالي قيمة الطلبات' },
  ];
  const latest = DATA.orders.slice(0, 6);
  return `
    <div class="flex-between mb-3">
      <div><h2 class="dash-title">نظرة عامة</h2><p class="dash-sub" style="margin:4px 0 0">صورة حية لكل ما يحدث على المنصة</p></div>
      <button class="btn btn-sm btn-ghost" onclick="refresh()">${icon('clock')} تحديث</button>
    </div>
    <div class="stat-grid">${cards.map(c => `<div class="stat-card"><span class="ficon" style="background:${c.c};color:#fff">${icon(c.ic)}</span><span><b>${c.n}</b><span>${c.l}</span></span></div>`).join('')}</div>
    <div class="panel">
      <div class="panel-head"><h3>أحدث الطلبات</h3><button class="btn btn-sm" onclick="goView('orders')">كل الطلبات</button></div>
      <div class="table-wrap">
      ${!latest.length ? `<div class="empty">${icon('bell')}<b>لا توجد طلبات بعد</b></div>` : `
      <table class="table"><thead><tr><th>الطلب</th><th>المتجر</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
      <tbody>${latest.map(o => `
        <tr><td><b>${esc(o.code)}</b><br><span class="text-muted" style="font-size:12px">${fmtDate(o.created_at)}</span></td>
        <td>${esc(o.store_name)}</td><td>${esc(o.customer.name)}</td>
        <td class="num">${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}
      </tbody></table>`}
      </div>
    </div>`;
}

window.goView = function (v) {
  view = v;
  renderShell();
};

/* ---------- المتاجر ---------- */
function storesView() {
  return `
    <div class="flex-between mb-3">
      <div><h2 class="dash-title">المتاجر</h2><p class="dash-sub" style="margin:4px 0 0">إضافة وتعديل وإيقاف — كل تغيير يظهر للناس فوراً</p></div>
      <button class="btn btn-gold" onclick="openStoreModal()">${icon('plus')} إضافة متجر</button>
    </div>
    <div class="panel"><div class="table-wrap">
      <table class="table">
        <thead><tr><th>المتجر</th><th>التصنيف</th><th>موبايل</th><th>توصيل</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${DATA.stores.map(s => `
          <tr style="${s.status !== 'active' ? 'opacity:.55' : ''}">
            <td><b>${esc(s.name)}</b> ${s.featured ? `<span class="badge-featured" style="position:static">${icon('spark')} مميز</span>` : ''}<br><span class="text-muted" style="font-size:12px">${esc(s.address || '')}</span></td>
            <td><span class="store-cat" style="--cat-color:${esc(s.category_color)}">${esc(s.category_name)}</span></td>
            <td dir="ltr">${esc(s.phone || '—')}</td>
            <td>${s.delivery ? 'نعم (' + money(s.delivery_fee || 0) + ')' : 'لا'}</td>
            <td>${s.status === 'active' ? '<span class="status-badge st-done">ظاهر</span>' : '<span class="status-badge st-cancelled">موقوف</span>'}</td>
            <td>
              <span class="flex" style="gap:6px">
                <button class="icon-btn" title="تعديل" onclick="openStoreModal('${s.id}')">${icon('edit')}</button>
                <button class="icon-btn" title="${s.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}" onclick="toggleStore('${s.id}')">${icon(s.status === 'active' ? 'x' : 'check')}</button>
                <button class="icon-btn" title="حذف نهائي" onclick="delStore('${s.id}')">${icon('trash')}</button>
              </span>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
}

window.openStoreModal = function (sid) {
  const s = sid ? DATA.stores.find(x => x.id === sid) : null;
  const veil = document.getElementById('modalVeil');
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <h3>${s ? 'تعديل متجر' : 'إضافة متجر جديد'}</h3>
    <form id="sForm">
      <div class="form-grid-2">
        <div class="field"><label>اسم المحل *</label><input name="name" required value="${s ? esc(s.name) : ''}"></div>
        <div class="field"><label>التصنيف *</label>
          <select name="category_id">${DATA.categories.map(c => `<option value="${c.id}" ${s && s.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>الوصف</label><textarea name="description">${s ? esc(s.description || '') : ''}</textarea></div>
      <div class="form-grid-2">
        <div class="field"><label>موبايل</label><input name="phone" value="${s ? esc(s.phone || '') : ''}" maxlength="11"></div>
        <div class="field"><label>مواعيد العمل</label><input name="hours" value="${s ? esc(s.hours || '') : ''}"></div>
      </div>
      <div class="field"><label>العنوان</label><input name="address" value="${s ? esc(s.address || '') : ''}"></div>
      <div class="form-grid-2">
        <div class="field"><label>التوصيل</label>
          <select name="delivery"><option value="1" ${s && s.delivery ? 'selected' : ''}>متاح</option><option value="0" ${s && !s.delivery ? 'selected' : ''}>غير متاح</option></select>
        </div>
        <div class="field"><label>رسوم التوصيل (ج.م)</label><input name="delivery_fee" type="number" min="0" value="${s ? (s.delivery_fee || 0) : 0}"></div>
      </div>
      <div class="field"><label><input type="checkbox" name="featured" ${s && s.featured ? 'checked' : ''} style="width:auto;margin-inline-end:8px">متجر مميز (يظهر بشارة "مميز")</label></div>
      ${!s ? `
      <div class="panel" style="background:rgba(124,108,240,.07)"><div class="panel-body">
        <b style="font-size:14px">حساب صاحب المحل (اختياري)</b>
        <div class="form-grid-2 mt-2">
          <div class="field"><label>اسم المستخدم</label><input name="owner_username" placeholder="مثال: nahda-pharmacy"></div>
          <div class="field"><label>كلمة المرور</label><input name="owner_password" type="text" placeholder="6 أحرف على الأقل"></div>
        </div>
        <p class="text-muted" style="font-size:12.5px">سلّم البيانات لصاحب المحل ليدخل من "لوحة المحل" ويضيف منتجاته بنفسه.</p>
      </div></div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-gold" type="submit">${icon('check')} حفظ</button>
        <button class="btn btn-ghost" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>`;
  veil.classList.add('open');
  veil.onclick = e => { if (e.target === veil) closeModal(); };
  document.getElementById('sForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value, category_id: f.category_id.value, description: f.description.value,
      phone: f.phone.value, hours: f.hours.value, address: f.address.value,
      delivery: f.delivery.value === '1', delivery_fee: +f.delivery_fee.value || 0, featured: f.featured.checked,
    };
    if (!s) {
      body.owner_username = f.owner_username.value.trim();
      body.owner_password = f.owner_password.value;
    }
    try {
      const r = s ? await API.put('/api/admin/stores/' + s.id, body) : await API.post('/api/admin/stores', body);
      closeModal();
      toast(s ? 'تم التعديل — ظاهر للناس الآن' : 'تمت الإضافة — المتجر ظاهر للناس الآن');
      if (!s && r.owner) toast('حساب صاحب المحل: ' + r.owner.username);
      await window.refresh();
      view = 'stores';
      renderShell();
    } catch (e2) { toast(e2.message, true); }
  });
};

window.closeModal = function () { document.getElementById('modalVeil').classList.remove('open'); };

window.toggleStore = async function (sid) {
  const s = DATA.stores.find(x => x.id === sid);
  if (!s) return;
  const next = s.status === 'active' ? 'suspended' : 'active';
  try {
    await API.put('/api/admin/stores/' + sid, { status: next });
    toast(next === 'active' ? 'المتجر ظاهر الآن' : 'تم إيقاف المتجر مؤقتاً');
    await window.refresh();
    view = 'stores';
    renderShell();
  } catch (e) { toast(e.message, true); }
};

window.delStore = async function (sid) {
  const s = DATA.stores.find(x => x.id === sid);
  if (!confirm(`حذف "${s ? s.name : ''}" نهائياً مع كل منتجاته وحسابه؟`)) return;
  try {
    await API.del('/api/admin/stores/' + sid);
    toast('تم الحذف');
    await window.refresh();
    view = 'stores';
    renderShell();
  } catch (e) { toast(e.message, true); }
};

/* ---------- التصنيفات ---------- */
const CAT_ICONS = ['store', 'pharmacy', 'clinic', 'restaurant', 'cafe', 'market', 'fashion', 'sweets', 'library', 'services'];

function categoriesView() {
  return `
    <div class="flex-between mb-3">
      <div><h2 class="dash-title">التصنيفات</h2><p class="dash-sub" style="margin:4px 0 0">أنواع المحلات الظاهرة في الدليل</p></div>
      <button class="btn btn-gold" onclick="openCatModal()">${icon('plus')} إضافة تصنيف</button>
    </div>
    <div class="cat-grid">
      ${DATA.categories.map(c => `
      <div class="cat-card" style="--cat-color:${esc(c.color)}">
        <span class="cat-icon" style="color:#fff">${icon(c.icon)}</span>
        <b>${esc(c.name)}</b>
        <div class="flex mt-2" style="justify-content:center">
          <button class="icon-btn" onclick="openCatModal('${c.id}')">${icon('edit')}</button>
          <button class="icon-btn" onclick="delCat('${c.id}')">${icon('trash')}</button>
        </div>
      </div>`).join('')}
    </div>`;
}

window.openCatModal = function (cid) {
  const c = cid ? DATA.categories.find(x => x.id === cid) : null;
  const veil = document.getElementById('modalVeil');
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <h3>${c ? 'تعديل تصنيف' : 'إضافة تصنيف'}</h3>
    <form id="cForm">
      <div class="field"><label>الاسم *</label><input name="name" required value="${c ? esc(c.name) : ''}" placeholder="مثال: أجهزة كهربائية"></div>
      <div class="form-grid-2">
        <div class="field"><label>الأيقونة</label>
          <select name="icon">${CAT_ICONS.map(i => `<option value="${i}" ${c && c.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
        </div>
        <div class="field"><label>اللون</label><input name="color" type="color" value="${c ? esc(c.color) : '#6366f1'}" style="height:48px;padding:6px"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-gold" type="submit">${icon('check')} حفظ</button>
        <button class="btn btn-ghost" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>`;
  veil.classList.add('open');
  veil.onclick = e => { if (e.target === veil) closeModal(); };
  document.getElementById('cForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const body = { name: f.name.value, icon: f.icon.value, color: f.color.value };
    try {
      if (c) await API.put('/api/admin/categories/' + c.id, body);
      else await API.post('/api/admin/categories', body);
      closeModal();
      toast('تم الحفظ — ظاهر للناس الآن');
      await window.refresh();
      view = 'categories';
      renderShell();
    } catch (e2) { toast(e2.message, true); }
  });
};

window.delCat = async function (cid) {
  if (!confirm('حذف هذا التصنيف؟ (لا يمكن حذف تصنيف به محلات)')) return;
  try {
    await API.del('/api/admin/categories/' + cid);
    toast('تم الحذف');
    await window.refresh();
    view = 'categories';
    renderShell();
  } catch (e) { toast(e.message, true); }
};

/* ---------- الطلبات ---------- */
function ordersView() {
  const os = DATA.orders;
  return `
    <div class="flex-between mb-3">
      <div><h2 class="dash-title">كل الطلبات (${os.length})</h2><p class="dash-sub" style="margin:4px 0 0">متابعة طلبات كل المتاجر من مكان واحد</p></div>
      <button class="btn btn-sm btn-ghost" onclick="refresh()">${icon('clock')} تحديث</button>
    </div>
    <div class="panel"><div class="table-wrap">
    ${!os.length ? `<div class="empty">${icon('bell')}<b>لا توجد طلبات بعد</b></div>` : `
      <table class="table">
        <thead><tr><th>الطلب</th><th>المتجر</th><th>العميل</th><th>التفاصيل</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${os.map(o => `
          <tr>
            <td><b>${esc(o.code)}</b><br><span class="text-muted" style="font-size:12px">${fmtDate(o.created_at)}</span></td>
            <td>${esc(o.store_name)}</td>
            <td><b>${esc(o.customer.name)}</b><br><a href="tel:${esc(o.customer.phone)}" style="color:var(--blue);font-size:13px" dir="ltr">${esc(o.customer.phone)}</a></td>
            <td style="max-width:240px">${o.items.map(i => `• ${esc(i.name)} × ${i.qty}`).join('<br>')}
              ${o.appointment ? `<br><span style="color:var(--purple-2)">${esc(o.appointment.date)} — ${esc(o.appointment.time)}</span>` : ''}
            </td>
            <td class="num">${money(o.total)}</td>
            <td><select class="status-select" onchange="adminSetStatus('${o.id}', this.value)">
              ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div></div>`;
}

window.adminSetStatus = async function (oid, status) {
  try {
    await API.put('/api/admin/orders/' + oid, { status });
    const o = DATA.orders.find(x => x.id === oid);
    if (o) o.status = status;
    toast('تم تحديث الحالة');
    renderShell();
  } catch (e) { toast(e.message, true); }
};

/* ---------- الحسابات ---------- */
function usersView() {
  return `
    <h2 class="dash-title">الحسابات</h2>
    <p class="dash-sub">حسابات أصحاب المحلات على المنصة</p>
    <div class="panel"><div class="table-wrap">
      <table class="table">
        <thead><tr><th>المستخدم</th><th>الاسم</th><th>الدور</th><th>المتجر</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${DATA.users.map(u => `
          <tr>
            <td><b dir="ltr">${esc(u.username)}</b></td>
            <td>${esc(u.name || '')}</td>
            <td>${u.role === 'admin' ? '<span class="status-badge st-preparing">أدمن</span>' : '<span class="status-badge st-accepted">صاحب محل</span>'}</td>
            <td>${u.store_id ? esc((DATA.stores.find(s => s.id === u.store_id) || {}).name || 'محذوف') : '—'}</td>
            <td>${u.role === 'merchant' ? `<button class="btn btn-sm btn-ghost" onclick="resetPw('${u.id}', '${esc(u.username)}')">${icon('lock')} إعادة كلمة المرور</button>` : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
}

window.resetPw = async function (uid, username) {
  const pw = prompt('كلمة المرور الجديدة للحساب ' + username + ' (6 أحرف على الأقل):');
  if (!pw) return;
  try {
    await API.post('/api/admin/users/' + uid + '/reset-password', { password: pw });
    toast('تم تعيين كلمة مرور جديدة — سلّمها لصاحب المحل');
  } catch (e) { toast(e.message, true); }
};

/* ---------- كلمة المرور ---------- */
function securityView() {
  return `
    <h2 class="dash-title">كلمة المرور</h2>
    <p class="dash-sub">غيّر كلمة مرور الأدمن الافتراضية فوراً</p>
    <div class="panel" style="max-width:520px"><div class="panel-body">
      <form id="pwForm">
        <div class="field"><label>كلمة المرور الحالية</label><input name="current" type="password" required></div>
        <div class="field"><label>الجديدة (6 أحرف على الأقل)</label><input name="next" type="password" required minlength="6"></div>
        <button class="btn btn-gold" type="submit">${icon('lock')} تغيير كلمة المرور</button>
      </form>
    </div></div>`;
}

function bindView(m) {
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

if (API.token()) loadDash(); else renderLogin();
