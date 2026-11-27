/* تتبع الطلبات بكود قصير خاص بالطلب */
document.getElementById('topbar').innerHTML = topbarHTML('track');
document.getElementById('footer').innerHTML = footerHTML();
document.getElementById('trackBtn').innerHTML = icon('search') + ' تتبع';

const FLOW = ['new', 'accepted', 'preparing', 'ready', 'done'];
const FLOW_LABELS = { new: 'استلام', accepted: 'قبول', preparing: 'تجهيز', ready: 'جاهز', done: 'تسليم' };
const SAVED_KEY = 'dalil_codes';

function savedCodes() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { return []; }
}

function orderCard(o) {
  const idx = o.status === 'cancelled' ? -1 : FLOW.indexOf(o.status);
  return `
  <div class="order-card">
    <div class="order-head">
      <div><b>${esc(o.code)}</b> <span class="text-muted" style="font-size:13px">— ${esc(o.store_name)}</span></div>
      ${statusBadge(o.status)}
    </div>
    <div class="order-items">
      ${o.items.map(i => `• ${esc(i.name)} × ${i.qty}`).join('<br>')}
      ${o.appointment ? `<br>${icon('calendar')} الموعد: ${esc(o.appointment.date)} — ${esc(o.appointment.time)}` : ''}
      ${o.fulfillment === 'delivery' ? `<br>${icon('delivery')} توصيل إلى: ${esc(o.customer.address || '')}` : ''}
    </div>
    <div class="flex-between mt-2">
      <span class="text-muted" style="font-size:12.5px">${fmtDate(o.created_at)}</span>
      <b style="color:var(--gold-2)">${money(o.total)}</b>
    </div>
    <div class="mt-2"><button class="btn btn-sm btn-ghost" onclick="openComplaintForm({storeId:'${esc(o.store_id)}',storeName:'${esc(o.store_name)}',orderCode:'${esc(o.code)}'})">${icon('note')} شكوى على الطلب</button></div>
    ${o.status === 'cancelled'
      ? `<p class="text-muted mt-2" style="font-size:13px">تم إلغاء هذا الطلب. تواصل مع المحل للتفاصيل.</p>`
      : `<div class="timeline">${FLOW.map((s, i) => `<span class="tl-step ${i <= idx ? 'on' : ''}">${FLOW_LABELS[s]}</span>`).join('')}</div>`}
  </div>`;
}

async function track(code) {
  const box = document.getElementById('results');
  box.innerHTML = `<div class="loading"><div class="spinner"></div>بندور على طلبك...</div>`;
  try {
    const { orders } = await API.get('/api/orders?code=' + encodeURIComponent(code));
    box.innerHTML = orders.map(orderCard).join('');
  } catch (e) {
    box.innerHTML = `<div class="empty">${icon('box')}<b>مفيش طلب بالكود ده</b>${esc(e.message)}<br>الكود بيكون 8 حروف وأرقام زي 7K2M-9QX4</div>`;
  }
}

async function trackSaved() {
  const codes = savedCodes();
  const box = document.getElementById('results');
  if (!codes.length) {
    box.innerHTML = `<div class="empty">${icon('box')}<b>اكتب كود الطلب فوق</b>الكود بيظهر لك بعد إتمام الطلب، وبنحفظه على الجهاز ده تلقائياً</div>`;
    return;
  }
  box.innerHTML = `<div class="loading"><div class="spinner"></div>بنجيب طلباتك المحفوظة...</div>`;
  const cards = [];
  for (const c of codes.slice(0, 10)) {
    try {
      const { orders } = await API.get('/api/orders?code=' + encodeURIComponent(c));
      if (orders[0]) cards.push(orderCard(orders[0]));
    } catch (e) {}
  }
  box.innerHTML = cards.length
    ? `<p class="text-muted mb-2" style="font-size:13px">طلبات محفوظة على الجهاز ده</p>` + cards.join('')
    : `<div class="empty">${icon('box')}<b>لا توجد طلبات محفوظة</b>اكتب كود الطلب فوق</div>`;
}

document.getElementById('trackForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = document.getElementById('codeInput').value.trim();
  if (v) track(v);
});

const pre = new URLSearchParams(location.search).get('code');
if (pre) {
  document.getElementById('codeInput').value = pre;
  track(pre);
} else {
  trackSaved();
}
