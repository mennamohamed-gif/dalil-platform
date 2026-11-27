/* تتبع الطلبات برقم الموبايل */
document.getElementById('topbar').innerHTML = topbarHTML('track');
document.getElementById('footer').innerHTML = footerHTML();
document.getElementById('trackBtn').innerHTML = icon('search') + ' تتبع';

const FLOW = ['new', 'accepted', 'preparing', 'ready', 'done'];
const FLOW_LABELS = { new: 'استلام', accepted: 'قبول', preparing: 'تجهيز', ready: 'جاهز', done: 'تسليم' };

async function track(phone) {
  const box = document.getElementById('results');
  box.innerHTML = `<div class="loading"><div class="spinner"></div>بنبحث عن طلباتك...</div>`;
  try {
    const { orders } = await API.get('/api/orders?phone=' + encodeURIComponent(phone));
    if (!orders.length) {
      box.innerHTML = `<div class="empty">${icon('box')}<b>لا توجد طلبات بهذا الرقم</b>تأكد من الرقم أو اطلب من الصفحة الرئيسية</div>`;
      return;
    }
    box.innerHTML = orders.map(o => {
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
        ${o.status === 'cancelled'
          ? `<p class="text-muted mt-2" style="font-size:13px">تم إلغاء هذا الطلب. تواصل مع المحل للتفاصيل.</p>`
          : `<div class="timeline">${FLOW.map((s, i) => `<span class="tl-step ${i <= idx ? 'on' : ''}">${FLOW_LABELS[s]}</span>`).join('')}</div>`}
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div class="empty"><b>تعذر البحث</b>${esc(e.message)}</div>`;
  }
}

document.getElementById('trackForm').addEventListener('submit', e => {
  e.preventDefault();
  track(document.getElementById('phoneInput').value.trim());
});

const pre = new URLSearchParams(location.search).get('phone');
if (pre) {
  document.getElementById('phoneInput').value = pre;
  track(pre);
}
