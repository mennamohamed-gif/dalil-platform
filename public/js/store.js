/* صفحة المتجر: عرض + سلة + طلب/حجز */
document.getElementById('topbar').innerHTML = topbarHTML('stores');
document.getElementById('footer').innerHTML = footerHTML();

const storeId = new URLSearchParams(location.search).get('id');
let STORE = null;
let PRODUCTS = [];
let cart = {}; // product_id -> qty

const main = document.getElementById('main');
const fab = document.getElementById('cartFab');
const drawer = document.getElementById('drawer');
const veil = document.getElementById('drawerVeil');

async function init() {
  if (!storeId) { main.innerHTML = `<div class="empty">${icon('search')}<b>المتجر غير موجود</b><a href="/" style="color:var(--purple-2)">ارجع للرئيسية</a></div>`; return; }
  try {
    const data = await API.get('/api/stores/' + encodeURIComponent(storeId));
    STORE = data.store;
    PRODUCTS = data.products;
    document.title = 'دليل — ' + STORE.name;
    renderStore();
  } catch (e) {
    main.innerHTML = `<div class="empty">${icon('search')}<b>${esc(e.message)}</b><a href="/" style="color:var(--purple-2)">ارجع للرئيسية</a></div>`;
  }
}

function renderStore() {
  const s = STORE;
  const services = PRODUCTS.filter(p => p.kind === 'service');
  const products = PRODUCTS.filter(p => p.kind === 'product');
  const tabs = [];
  if (products.length) tabs.push(['product', 'المنتجات']);
  if (services.length) tabs.push(['service', 'الخدمات والحجز']);
  if (!tabs.length) tabs.push(['product', 'المنتجات']);

  main.innerHTML = `
    <div class="store-hero" style="--cat-color:${esc(s.category_color)}">
      <div class="store-hero-cover">
        ${icon(s.category_icon)}
        ${s.open_state && s.open_state.open === false ? '<span class="badge-open" style="background:#b4232a">مقفول الآن</span>' : '<span class="badge-open">مفتوح</span>'}
        ${s.featured ? `<span class="badge-featured">${icon('spark')} مميز</span>` : ''}
      </div>
      <div class="store-hero-body">
        <h1>${esc(s.name)} <span class="store-cat">${esc(s.category_name)}</span></h1>
        <div class="stars mt-2">${stars(s.rating)} <small>${(+s.rating).toFixed(1)}</small></div>
        <p class="store-desc mt-2">${esc(s.description || '')}</p>
        <div class="store-hero-info">
          ${s.address ? `<span>${icon('location')} ${esc(s.address)}</span>` : ''}
          ${s.open_time && s.close_time ? `<span>${icon('clock')} من ${esc(s.open_time)} لـ ${esc(s.close_time)}</span>` : (s.hours ? `<span>${icon('clock')} ${esc(s.hours)}</span>` : '')}
          ${s.phone ? `<a href="tel:${esc(s.phone)}">${icon('phone')} ${esc(s.phone)}</a>` : ''}
          ${s.phone ? `<a href="${waLink(s.phone)}" target="_blank" rel="noopener">${icon('whatsapp')} واتساب</a>` : ''}
          ${s.delivery ? `<span>${icon('delivery')} توصيل متاح (${s.delivery_fee ? money(s.delivery_fee) : 'مجاني'})</span>` : '<span>' + icon('bag') + ' استلام من المحل</span>'}
        </div>
      </div>
    </div>
    <div class="tabs" id="tabs">
      ${tabs.map(([k, label], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-kind="${k}">${label}</button>`).join('')}
    </div>
    <div class="products-grid" id="grid"></div>`;

  const grid = document.getElementById('grid');
  function renderList(kind) {
    const list = PRODUCTS.filter(p => p.kind === kind);
    if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('box')}<b>لا توجد أصناف هنا بعد</b></div>`; return; }
    grid.innerHTML = list.map(productHTML).join('');
  }
  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    b.classList.add('active');
    renderList(b.dataset.kind);
  });
  renderList(tabs[0][0]);
  updateFab();
}

function productHTML(p) {
  const qty = cart[p.id] || 0;
  const off = p.available === false;
  return `
  <div class="product-card ${off ? 'unavailable' : ''}">
    ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:14px;margin-bottom:10px">` : ''}
    <div class="product-top">
      <h4>${esc(p.name)}</h4>
      <span class="kind-badge ${p.kind === 'service' ? 'kind-service' : 'kind-product'}">${p.kind === 'service' ? 'خدمة/حجز' : 'منتج'}</span>
    </div>
    <p class="pdesc">${esc(p.description || '')}${p.duration ? ' — المدة: ' + esc(p.duration) : ''}</p>
    <div class="flex-between">
      <span class="product-price">${money(p.price)} <small>${p.kind === 'service' ? '/ الخدمة' : ''}</small></span>
      ${!off && p.stock != null && p.stock <= 5 ? `<small class="text-muted" style="font-size:12px">باقي ${p.stock} بس</small>` : ''}
    </div>
    ${off ? `<span class="text-muted" style="font-size:13px">${p.stock === 0 ? 'خلص من المخزن' : 'غير متاح حالياً'}</span>` : `
    <div class="qty-row">
      <span class="stepper">
        <button onclick="chQty('${p.id}',-1)">−</button>
        <b id="qty-${p.id}">${qty}</b>
        <button onclick="chQty('${p.id}',1)">+</button>
      </span>
      ${qty > 0 ? `<button class="btn btn-sm" onclick="openCart()">${icon('cart')} في السلة</button>` : `<button class="btn btn-sm btn-ghost" onclick="chQty('${p.id}',1);openCart()">${icon('plus')} أضف</button>`}
    </div>`}
  </div>`;
}

window.chQty = function (pid, d) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return;
  cart[pid] = Math.max(0, Math.min(99, (cart[pid] || 0) + d));
  if (!cart[pid]) delete cart[pid];
  // حدّث الكارت مكانه
  const card = document.getElementById('qty-' + pid);
  if (card) card.closest('.product-card').outerHTML = productHTML(p);
  updateFab();
};

function cartItems() {
  return Object.keys(cart).map(pid => {
    const p = PRODUCTS.find(x => x.id === pid);
    return p ? { p, qty: cart[pid] } : null;
  }).filter(Boolean);
}

function updateFab() {
  const items = cartItems();
  if (!items.length) { fab.classList.add('hidden'); return; }
  const count = items.reduce((t, i) => t + i.qty, 0);
  const total = items.reduce((t, i) => t + i.p.price * i.qty, 0);
  fab.innerHTML = `${icon('cart')} السلة <span class="count">${count}</span> ${money(total)}`;
  fab.classList.remove('hidden');
}

window.openCart = function () {
  const items = cartItems();
  const hasService = items.some(i => i.p.kind === 'service');
  const subtotal = items.reduce((t, i) => t + i.p.price * i.qty, 0);
  const fee = STORE.delivery && !hasService ? (STORE.delivery_fee || 0) : 0;

  drawer.innerHTML = `
    <div class="drawer-head">
      <h3>${hasService ? 'إتمام الحجز' : 'إتمام الطلب'}</h3>
      <button class="icon-btn" onclick="closeCart()">${icon('x')}</button>
    </div>
    <div class="drawer-body" id="drawerBody">
      ${!items.length ? `<div class="empty">${icon('cart')}<b>السلة فاضية</b>ضيف أصناف من الصفحة الأول</div>` : `
        ${items.map(i => `
          <div class="cart-item">
            <div><b>${esc(i.p.name)}</b><span class="p">${money(i.p.price)} × ${i.qty}</span></div>
            <span class="stepper">
              <button onclick="chQtyDrawer('${i.p.id}',-1)">−</button>
              <b>${i.qty}</b>
              <button onclick="chQtyDrawer('${i.p.id}',1)">+</button>
            </span>
          </div>`).join('')}
        <form id="checkoutForm" class="mt-2">
          <div class="field"><label>الاسم *</label><input name="name" required placeholder="اكتب اسمك"></div>
          <div class="field"><label>رقم الموبايل *</label><input name="phone" required inputmode="tel" placeholder="01xxxxxxxxx" maxlength="11"></div>
          ${hasService ? `
            <div class="form-grid-2">
              <div class="field"><label>يوم الحجز *</label><input name="date" type="date" required min="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field"><label>الساعة *</label><input name="time" type="time" required></div>
            </div>` : `
            <div class="field"><label>طريقة الاستلام</label>
              <div class="radio-cards">
                <span class="radio-card"><input type="radio" name="fulfillment" id="f1" value="pickup" checked><label for="f1">${icon('bag')} استلام من المحل</label></span>
                ${STORE.delivery ? `<span class="radio-card"><input type="radio" name="fulfillment" id="f2" value="delivery"><label for="f2">${icon('delivery')} توصيل ${STORE.delivery_fee ? '(' + money(STORE.delivery_fee) + ')' : '(مجاني)'}</label></span>` : ''}
              </div>
            </div>
            <div class="field hidden" id="addrField"><label>العنوان بالتفصيل *</label><textarea name="address" placeholder="الشارع، رقم العمارة، الدور، علامة مميزة"></textarea></div>`}
          <div class="field"><label>ملاحظات (اختياري)</label><input name="notes" placeholder="أي تفاصيل تانية"></div>
        </form>`}
    </div>
    ${items.length ? `
    <div class="drawer-foot">
      <div class="total-row"><span>المجموع</span><span>${money(subtotal)}</span></div>
      <div class="total-row" id="feeRow"><span>رسوم التوصيل</span><span id="feeVal">${hasService || !STORE.delivery ? '—' : money(fee)}</span></div>
      <div class="total-row grand"><span>الإجمالي</span><span id="grandVal">${money(subtotal + (hasService || !STORE.delivery ? 0 : fee))}</span></div>
      <button class="btn btn-gold btn-block" id="submitOrder">${hasService ? 'تأكيد الحجز' : 'تأكيد الطلب'} ${icon('check')}</button>
    </div>` : ''}`;

  drawer.classList.add('open');
  veil.classList.add('open');

  const form = document.getElementById('checkoutForm');
  if (form && !hasService) {
    form.addEventListener('change', e => {
      if (e.target.name !== 'fulfillment') return;
      const delivery = form.fulfillment.value === 'delivery';
      document.getElementById('addrField').classList.toggle('hidden', !delivery);
      const f = delivery ? (STORE.delivery_fee || 0) : 0;
      document.getElementById('feeVal').textContent = delivery ? money(f) : '—';
      document.getElementById('grandVal').textContent = money(subtotal + f);
    });
  }

  const btn = document.getElementById('submitOrder');
  if (btn) btn.addEventListener('click', async () => {
    const f = form;
    if (!f.reportValidity()) return;
    btn.disabled = true;
    btn.textContent = 'جاري الإرسال...';
    const payload = {
      store_id: STORE.id,
      type: hasService ? 'booking' : 'order',
      items: cartItems().map(i => ({ product_id: i.p.id, qty: i.qty })),
      customer: {
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        address: f.address ? f.address.value.trim() : '',
        notes: f.notes.value.trim(),
      },
      fulfillment: f.fulfillment ? f.fulfillment.value : 'pickup',
      appointment: hasService ? { date: f.date.value, time: f.time.value } : null,
    };
    try {
      const { order } = await API.post('/api/orders', payload);
      if (order && order.track_code) {
        try {
          const key = 'dalil_codes';
          const list = JSON.parse(localStorage.getItem(key) || '[]').filter(c => c !== order.track_code);
          list.unshift(order.track_code);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
        } catch (e) {}
      }
      cart = {};
      updateFab();
      renderStore();
      showSuccess(order);
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
      btn.innerHTML = 'تأكيد ' + icon('check');
    }
  });
};

window.chQtyDrawer = function (pid, d) {
  chQty(pid, d);
  openCart();
};

window.closeCart = function () {
  drawer.classList.remove('open');
  veil.classList.remove('open');
};

fab.addEventListener('click', openCart);
veil.addEventListener('click', closeCart);

function showSuccess(order) {
  drawer.innerHTML = `
    <div class="drawer-head"><h3></h3><button class="icon-btn" onclick="closeCart()">${icon('x')}</button></div>
    <div class="drawer-body">
      <div class="success-box">
        <div class="success-icon">${icon('checkCircle')}</div>
        <h3>${order.type === 'booking' ? 'تم إرسال الحجز بنجاح!' : 'تم إرسال الطلب بنجاح!'}</h3>
        <p class="text-muted mt-2">رقم ${order.type === 'booking' ? 'الحجز' : 'الطلب'} الخاص بك:</p>
        <div class="order-code">${esc(order.code)}</div>
        ${order.track_code ? `<p class="text-muted mt-2" style="font-size:13px">كود تتبع الطلب (احتفظ بيه):</p><div class="order-code" dir="ltr" style="letter-spacing:2px">${esc(order.track_code)}</div>` : ''}
        ${order.appointment ? `<p class="text-muted">الموعد: ${esc(order.appointment.date)} — ${esc(order.appointment.time)}</p>` : ''}
        <p class="text-muted">الإجمالي: <b style="color:var(--gold-2)">${money(order.total)}</b></p>
        <p class="text-muted mt-2" style="font-size:13px">هيتم مراجعة ${order.type === 'booking' ? 'حجزك' : 'طلبك'} من ${esc(order.store_name)}. كود التتبع محفوظ على الجهاز ده، وتقدر تتابع بيه من صفحة التتبع.</p>
        <a class="btn mt-3" href="/track.html${order.track_code ? '?code=' + encodeURIComponent(order.track_code) : ''}">${icon('search')} تتبع الحالة</a>
      </div>
    </div>`;
}

init();
