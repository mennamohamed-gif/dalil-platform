/* إفكتات v2: سكرول ريفيل، 3D tilt، توهج الماوس، شريط التقدم، عدادات */
(function () {
  // شريط تقدم السكرول
  const prog = document.createElement('div');
  prog.className = 'scroll-progress';
  prog.innerHTML = '<i></i>';
  document.body.appendChild(prog);
  const bar = prog.firstElementChild;
  addEventListener('scroll', () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100 + '%';
  }, { passive: true });

  // توهج يتبع الماوس
  if (matchMedia('(pointer:fine)').matches) {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    }, { passive: true });
  }

  // خلفية الأورورا
  const bg = document.createElement('div');
  bg.className = 'aurora-bg';
  bg.innerHTML = '<i></i><i></i><i></i>';
  document.body.prepend(bg);

  // الظهور مع السكرول
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  window.FX = {
    watch(root) {
      (root || document).querySelectorAll('.reveal, .reveal-r').forEach(el => io.observe(el));
    },
    // 3D tilt للكروت
    tilt(el, max) {
      if (!matchMedia('(pointer:fine)').matches) return;
      const m = max || 9;
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * m}deg) rotateX(${-y * m}deg) translateY(-5px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    },
    // عدادات
    countUp(el) {
      const target = +el.dataset.count || 0;
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now();
      const dur = 1400;
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    },
  };
  FX.watch(document);
})();
