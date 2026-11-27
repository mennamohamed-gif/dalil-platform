/* الصفحة الرئيسية — v2 */
document.getElementById('topbar').innerHTML = topbarHTML('home');
document.getElementById('footer').innerHTML = footerHTML();
document.getElementById('searchBtn').innerHTML = icon('search') + ' دوّر';

let CATS = [];
let activeCat = '';
let searchQ = '';

/* مشهد 3D */
(function buildScene() {
  const inner = document.getElementById('sceneInner');
  document.getElementById('cube').innerHTML = ['store', 'restaurant', 'pharmacy', 'cafe', 'clinic', 'market'].map(n => `<i>${icon(n)}</i>`).join('');
  const cards = [
    { cls: 'fcard-1', ic: 'restaurant', bg: 'linear-gradient(145deg,#fb923c,#ea580c)', t: 'مطعم البرنس', s: 'طلبك يوصلك سخن' },
    { cls: 'fcard-2', ic: 'pharmacy', bg: 'linear-gradient(145deg,#2dd4bf,#0d9488)', t: 'صيدلية الشفاء', s: 'مفتوحة 24 ساعة' },
    { cls: 'fcard-3', ic: 'clinic', bg: 'linear-gradient(145deg,#818cf8,#6366f1)', t: 'عيادات', s: 'احجز كشفك أونلاين' },
    { cls: 'fcard-4', ic: 'cafe', bg: 'linear-gradient(145deg,#e879f9,#c026d3)', t: 'كافيه السحاب', s: 'قهوة مختصة' },
  ];
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'fcard ' + c.cls;
    el.innerHTML = `<span class="ficon" style="background:${c.bg}">${icon(c.ic)}</span><span><b>${c.t}</b><span>${c.s}</span></span>`;
    inner.appendChild(el);
  });
  const scene = document.getElementById('scene');
  if (scene && matchMedia('(pointer:fine)').matches) {
    scene.addEventListener('mousemove', e => {
      const r = scene.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      inner.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
    });
    scene.addEventListener('mouseleave', () => { inner.style.transform = ''; });
  }
})();

/* الشريط المتحرك */
(function marquee() {
  const items = [['pharmacy', 'صيدليات 24 ساعة'], ['clinic', 'حجز كشف أونلاين'], ['restaurant', 'أكل يوصل لباب البيت'], ['cafe', 'قهوتك جاهزة'], ['market', 'طلبات البيت'], ['services', 'صنايعي في دقايق'], ['sweets', 'حلويات طازة'], ['library', 'مكتبات وطباعة']];
  const half = items.map(([ic, t]) => `<span>${icon(ic)} ${t}</span>`).join('');
  document.getElementById('marquee').innerHTML = half + half;
})();

/* خطوات */
document.getElementById('steps').innerHTML = [
  { ic: 'search', t: 'دوّر', p: 'اكتب اللي محتاجه أو اختار القسم، وشوف كل الأماكن اللي حواليك بالتقييمات والتفاصيل.' },
  { ic: 'cart', t: 'اطلب أو احجز', p: 'ضيف للسلة واطلب توصيل لباب البيت، أو اختار خدمة واحجز ميعادك في ثانيتين.' },
  { ic: 'bell', t: 'تابع لحظة بلحظة', p: 'المحل يستقبل طلبك فوراً، وأنت تتابع كل خطوة من صفحة التتبع برقم موبايلك.' },
].map((s, i) => `
  <div class="step reveal" style="--d:${i * 0.12}s">
    <span class="step-num">${i + 1}</span>
    <span class="ficon">${icon(s.ic)}</span>
    <b>${s.t}</b>
    <p>${s.p}</p>
  </div>`).join('');

/* البيانات */
async function loadBootstrap() {
  const data = await API.get('/api/bootstrap');
  CATS = data.categories;

  document.getElementById('heroStats').innerHTML = `
    <div class="hstat"><b data-count="${data.stats.stores}" data-suffix="+">0</b><span>محل وخدمة</span></div>
    <div class="hstat"><b data-count="${data.stats.products}" data-suffix="+">0</b><span>منتج وخدمة</span></div>
    <div class="hstat"><b data-count="${CATS.length}" data-suffix="">0</b><span>قسم رئيسي</span></div>`;
  document.querySelectorAll('.hstat b').forEach(b => FX.countUp(b));

  document.getElementById('catGrid').innerHTML = CATS.map((c, i) => `
    <a class="cat-card reveal" style="--cat-color:${esc(c.color)};--d:${i * 0.05}s" href="javascript:void(0)" onclick="pickCat('${esc(c.id)}')">
      <span class="cat-icon">${icon(c.icon)}</span>
      <b>${esc(c.name)}</b>
      <span>${c.store_count} مكان</span>
    </a>`).join('');
  FX.watch(document.getElementById('catGrid'));

  renderChips();
  await loadStores();
}

function renderChips() {
  const all = [{ id: '', name: 'الكل', icon: 'grid', store_count: CATS.reduce((t, c) => t + c.store_count, 0) }].concat(CATS);
  document.getElementById('chipRow').innerHTML = all.map(c => `
    <button class="chip ${activeCat === c.id ? 'active' : ''}" onclick="pickCat('${esc(c.id)}')">
      ${icon(c.icon)} ${esc(c.name)} <span class="cnt">(${c.store_count})</span>
    </button>`).join('');
}

window.pickCat = function (id) {
  activeCat = id;
  renderChips();
  loadStores();
  document.getElementById('stores').scrollIntoView({ behavior: 'smooth' });
};

async function loadStores() {
  const grid = document.getElementById('storesGrid');
  const params = new URLSearchParams();
  if (activeCat) params.set('cat', activeCat);
  if (searchQ) params.set('q', searchQ);
  const data = await API.get('/api/stores?' + params.toString());
  if (!data.stores.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('search')}<b>مفيش نتائج</b>جرّب كلمة تانية أو قسم مختلف</div>`;
    return;
  }
  grid.innerHTML = data.stores.map((s, i) => storeCardHTML(s, i)).join('');
  grid.querySelectorAll('.store-card').forEach(c => FX.tilt(c));
  FX.watch(grid);
}

function storeCardHTML(s, i) {
  return `
  <article class="store-card reveal" style="--cat-color:${esc(s.category_color)};--d:${(i % 3) * 0.08}s">
    <div class="store-cover">
      ${icon(s.category_icon)}
      <span class="badge-open">مفتوح</span>
      ${s.featured ? `<span class="badge-featured">${icon('spark')} مميز</span>` : ''}
    </div>
    <div class="store-body">
      <div class="flex-between">
        <h3>${esc(s.name)}</h3>
        <span class="store-cat">${esc(s.category_name)}</span>
      </div>
      <p class="store-desc">${esc(s.description || '')}</p>
      <div class="stars">${stars(s.rating)} <small>${(+s.rating).toFixed(1)}</small></div>
      <div class="store-meta">
        <span>${icon('location')} ${esc(s.address || '')}</span>
        ${s.delivery ? `<span>${icon('delivery')} توصيل ${s.delivery_fee ? money(s.delivery_fee) : 'مجاني'}</span>` : ''}
      </div>
    </div>
    <div class="store-foot">
      <a class="btn btn-block" href="/store.html?id=${encodeURIComponent(s.id)}">ادخل واطلب ${icon('back')}</a>
    </div>
  </article>`;
}

document.getElementById('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  searchQ = document.getElementById('searchInput').value.trim();
  loadStores();
  document.getElementById('stores').scrollIntoView({ behavior: 'smooth' });
});

loadBootstrap().catch(e => {
  document.getElementById('catGrid').innerHTML = `<div class="empty"><b>حصلت مشكلة في التحميل</b>${esc(e.message)}</div>`;
  document.getElementById('storesGrid').innerHTML = '';
});
