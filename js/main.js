/* 木白室內設計 MuBai Studio — 全站交互
   功能：nav 滾動收縮、手機抽屜（focus trap / Esc）、作品篩選（URL ?cat= 同步）、
        表單前端驗證 + mailto 降級、顯現動畫、圖片失敗回退、跳過連結。
   無外部依賴；全部 addEventListener，無行內 on* 事件。 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Nav sticky + 滾動收縮 ---------- */
  var nav = document.getElementById('site-nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 2. 手機抽屜 ---------- */
  var overlay = document.getElementById('drawer-overlay');
  var drawer = document.getElementById('drawer');
  var openBtn = document.getElementById('drawer-open');
  var closeBtn = document.getElementById('drawer-close');

  function openDrawer() {
    if (!drawer) return;
    document.body.classList.add('drawer-open', 'no-scroll');
    openBtn.setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('a, button');
    if (first) first.focus();
  }
  function closeDrawer(returnFocus) {
    if (!drawer) return;
    document.body.classList.remove('drawer-open', 'no-scroll');
    openBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus && openBtn) openBtn.focus();
  }
  function trapFocus(e) {
    if (!drawer || !document.body.classList.contains('drawer-open')) return;
    if (e.key !== 'Tab') return;
    var focusables = drawer.querySelectorAll('a[href], button:not([disabled])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }
  if (openBtn) openBtn.addEventListener('click', function () { openDrawer(); });
  if (closeBtn) closeBtn.addEventListener('click', function () { closeDrawer(true); });
  if (overlay) overlay.addEventListener('click', function () { closeDrawer(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer(true);
    trapFocus(e);
  });
  drawer && drawer.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () { closeDrawer(false); });
  });

  /* ---------- 3. 作品篩選（URL ?cat= 同步） ---------- */
  var grid = document.getElementById('works-grid');
  if (grid) {
    var pills = Array.prototype.slice.call(document.querySelectorAll('.filter-pill[data-cat]'));
    var items = Array.prototype.slice.call(grid.querySelectorAll('.work-item'));
    var emptyMsg = document.getElementById('works-empty');

    function applyCat(cat, updateUrl) {
      var visible = 0;
      items.forEach(function (item) {
        var match = cat === 'all' || item.dataset.cat === cat;
        if (match) {
          item.classList.remove('hidden-fade');
          if (!reduceMotion) {
            item.classList.add('fading');
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { item.classList.remove('fading'); });
            });
          }
          visible++;
        } else {
          // display:none 隱藏，保留已載入圖片（UX §5.3）
          item.classList.add('hidden-fade');
        }
      });
      if (emptyMsg) emptyMsg.hidden = visible !== 0;
      if (updateUrl) {
        var url = new URL(window.location.href);
        if (cat === 'all') url.searchParams.delete('cat');
        else url.searchParams.set('cat', cat);
        history.replaceState(null, '', url);
      }
      pills.forEach(function (p) {
        var active = p.dataset.cat === cat;
        p.setAttribute('aria-pressed', active ? 'true' : 'false');
        p.classList.toggle('bg-ink', active);
        p.classList.toggle('text-mist', active);
        p.classList.toggle('border-ink', active);
        p.classList.toggle('bg-linen', !active);
        p.classList.toggle('text-slate', !active);
        p.classList.toggle('border-linen', !active);
      });
    }

    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        applyCat(p.dataset.cat, true);
      });
    });

    var initial = new URLSearchParams(window.location.search).get('cat');
    var known = pills.some(function (p) { return p.dataset.cat === initial; }) || initial === 'all';
    applyCat(known && initial ? initial : 'all', false);
  }

  /* ---------- 4. 表單驗證 + mailto 降級 ---------- */
  var form = document.getElementById('contact-form');
  if (form) {
    var errorBanner = document.getElementById('form-banner');
    var successBox = document.getElementById('form-success');
    var submitBtn = form.querySelector('[type="submit"]');

    var rules = {
      name: {
        test: function (v) { return v.trim().length >= 2 && v.trim().length <= 20; },
        msg: '請輸入您的姓名（至少 2 字）'
      },
      phone: {
        test: function (v) { return /^09\d{8}$/.test(v.replace(/[\s-]/g, '')); },
        msg: '請輸入正確的 10 位手機號碼（09 開頭）'
      },
      email: {
        test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
        msg: '請輸入正確的 email'
      },
      location: {
        test: function (v) { var t = v.trim(); return t.length >= 2 && t.length <= 50; },
        msg: '請填寫房屋所在地（如：台北市）'
      },
      needType: {
        test: function (v) { return v !== ''; },
        msg: '請選擇到宅類型'
      },
      message: {
        test: function (v) { var t = v.trim(); return t.length >= 10 && t.length <= 500; },
        msg: '請簡單描述您的需求（10–500 字）'
      },
      privacy: {
        test: function (_, el) { return el.checked; },
        msg: '請閱讀並同意隱私聲明'
      }
    };

    function fieldEl(id) { return form.querySelector('[name="' + id + '"]'); }
    function errEl(id) { return document.getElementById(id + '-error'); }

    function validateField(id) {
      var el = fieldEl(id);
      var rule = rules[id];
      if (!el || !rule) return true;
      var ok = rule.test(el.value, el);
      var err = errEl(id);
      el.classList.toggle('has-error', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) {
        err.hidden = ok;
        err.textContent = ok ? '' : rule.msg;
      }
      if (el.id === 'message') {
        var counter = document.getElementById('message-count');
        if (counter) counter.textContent = el.value.trim().length + ' / 500';
      }
      return ok;
    }

    // 失焦即時驗證；輸入中不即時變紅（UX §5.4）
    Object.keys(rules).forEach(function (id) {
      var el = fieldEl(id);
      if (!el) return;
      el.addEventListener('blur', function () { validateField(id); });
      if (el.type === 'checkbox' || el.tagName === 'SELECT') {
        el.addEventListener('change', function () { validateField(id); });
      }
    });
    var msgEl = fieldEl('message');
    if (msgEl) msgEl.addEventListener('input', function () {
      var counter = document.getElementById('message-count');
      if (counter) counter.textContent = msgEl.value.trim().length + ' / 500';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // honeypot：機器人留值即靜默結束
      if (form.querySelector('[name="website"]') && form.querySelector('[name="website"]').value !== '') {
        e.submitter && e.submitter.blur();
        return;
      }
      var allOk = true;
      var firstBad = null;
      Object.keys(rules).forEach(function (id) {
        var ok = validateField(id);
        if (!ok && !firstBad) firstBad = fieldEl(id);
        if (!ok) allOk = false;
      });
      if (!allOk) {
        if (firstBad) firstBad.focus();
        return;
      }
      // 組裝 mailto 降級（CTO 規格 §5.2 階段 1）
      var g = function (id) { return fieldEl(id).value.trim(); };
      var subject = encodeURIComponent('【預約諮詢】' + g('name') + '（' + g('location') + '）');
      var bodyLines = [
        '姓名：' + g('name'),
        '手機：' + g('phone'),
        'Email：' + g('email'),
        '房屋所在地：' + g('location'),
        '到宅類型：' + g('needType'),
        '',
        '需求描述：',
        g('message')
      ];
      var mailto = 'mailto:hello@mubai.design?subject=' + subject + '&body=' + encodeURIComponent(bodyLines.join('\n'));

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> 送出中…';
      }
      // 模擬送出延遲，呈現 loading 狀態後開啟 mailto
      setTimeout(function () {
        window.location.href = mailto;
        if (errorBanner) errorBanner.hidden = true;
        if (successBox) {
          successBox.hidden = false;
          successBox.focus();
          window.scrollTo({ top: form.offsetTop - 80, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }, 600);
    });
  }

  /* ---------- 5. 顯現動畫（IntersectionObserver） ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('revealed');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('revealed'); });
  }

  /* ---------- 6. 統計數字滾入 ---------- */
  var stats = document.querySelectorAll('[data-count]');
  if (stats.length && 'IntersectionObserver' in window && !reduceMotion) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        sio.unobserve(en.target);
        var el = en.target;
        var target = parseInt(el.dataset.count, 10);
        var suffix = el.dataset.suffix || '';
        var start = null;
        var dur = 900;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          el.textContent = Math.round(target * p) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    stats.forEach(function (el) { sio.observe(el); });
  }

  /* ---------- 7. 圖片失敗回退（CTO §5.1） ---------- */
  document.querySelectorAll('img[data-fallback]').forEach(function (img) {
    img.addEventListener('error', function () {
      var w = img.getAttribute('width');
      var h = img.getAttribute('height');
      var holder = document.createElement('div');
      holder.className = 'img-fallback ' + (img.className || '');
      holder.setAttribute('role', 'img');
      holder.setAttribute('aria-label', img.getAttribute('alt') || '');
      if (w) holder.style.width = w + 'px';
      if (h) holder.style.height = h + 'px';
      holder.style.maxWidth = '100%';
      holder.textContent = '圖片載入失敗';
      if (img.parentNode) img.parentNode.replaceChild(holder, img);
    });
  });
})();
