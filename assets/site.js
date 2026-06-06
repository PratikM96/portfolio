/* Pratik Mehta / Kinetic Teal. Shared behavior: scroll reveal + work filter. */
(function () {
  // Image load resilience. Lazy-loaded CDN images can have their request dropped
  // under connection load (more often in Firefox), and a failed lazy image never
  // auto-retries, so it stays broken until reload. Retry each failed image up to
  // twice with a short backoff and a cache-busting param to dodge a cached miss.
  function retryBrokenImages() {
    var imgs = document.querySelectorAll('img[src*="cdn.mehtapratik.com"]');
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.dataset.retry) return;
      var attempts = 0;
      var onErr = function () {
        if (attempts >= 3) { img.removeEventListener('error', onErr); return; }
        attempts++;
        var base = (img.currentSrc || img.src).split('#')[0].split('?')[0];
        setTimeout(function () {
          var pre = new Image();
          pre.onload = function () { img.src = pre.src; };
          pre.src = base + '?r=' + attempts + '-' + Date.now();
        }, 500 * attempts);
      };
      img.addEventListener('error', onErr);
      img.dataset.retry = '1';
      if (img.complete && img.naturalWidth === 0) onErr();
    });
  }
  retryBrokenImages();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', retryBrokenImages);
  }

  // Hero texture now handled by a synchronous snippet in each page's <head>
  // (search "hero-cover-preload"). It picks a random texture, preloads it with
  // high priority, and sets --cover before the body parses, so the LCP image is
  // discoverable early instead of being injected here by this deferred script.
  // The cs-hero/has-cover classes live in page markup. Resume stays clean (no snippet).

  // Home feature: pull the full project list from work.html and show a random 4
  // as editorial split rows. This keeps the home page in sync with the work index
  // automatically. Nothing is hard-coded here, so new projects added to work.html
  // become eligible on the home page with no edits to index.html.
  var homeRows = document.querySelector('.proj--rows');
  if (homeRows) {
    fetch('work.html', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pool = Array.prototype.slice.call(doc.querySelectorAll('.proj .p'));
        if (!pool.length) return;
        for (var i = pool.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }
        pool.slice(0, 4).forEach(function (node, idx) {
          var a = document.importNode(node, true);
          var num = a.querySelector('.num');
          var img = a.querySelector('.img');
          if (num) { num.textContent = '0' + (idx + 1); if (img) img.appendChild(num); }
          homeRows.appendChild(a);
          requestAnimationFrame(function () {
            setTimeout(function () { a.classList.add('in'); }, idx * 90);
          });
        });
      })
      .catch(function () { /* offline or file://; the View all work link stays as fallback */ });
  }

  // Home feature: pull a random 3 posts from blog.html (real posts only, no
  // "coming soon" placeholders). Keeps the home blog in sync with the blog index
  // automatically; nothing is hard-coded, so new posts become eligible with no
  // edits to index.html.
  var blogRows = document.querySelector('.blog-rows');
  if (blogRows) {
    fetch('blog.html', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pool = Array.prototype.slice.call(doc.querySelectorAll('.post-row:not(.soon)'))
          .filter(function (a) { var h = a.getAttribute('href') || ''; return h && h.charAt(0) !== '#'; });
        if (!pool.length) return;
        for (var i = pool.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }
        pool.slice(0, 3).forEach(function (node) {
          blogRows.appendChild(document.importNode(node, true));
        });
      })
      .catch(function () { /* offline or file://; the Read all posts link stays as fallback */ });
  }

  // Scroll reveal for project cards
  var cards = document.querySelectorAll('.p');
  if ('IntersectionObserver' in window && cards.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    cards.forEach(function (el, i) {
      el.style.transitionDelay = (i % 2 * 0.08) + 's';
      io.observe(el);
    });
  } else {
    cards.forEach(function (el) { el.classList.add('in'); });
  }

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    var scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    document.body.appendChild(scrim);
    var setOpen = function (open) {
      toggle.classList.toggle('open', open);
      links.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('open'));
    });
    scrim.addEventListener('click', function () { setOpen(false); });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // Work filter
  var filterBar = document.querySelector('.filters');
  if (filterBar) {
    var btns = filterBar.querySelectorAll('button');
    var items = document.querySelectorAll('.proj .p');
    filterBar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (!btn) return;
      btns.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      var f = btn.getAttribute('data-filter');
      items.forEach(function (it) {
        var tags = (it.getAttribute('data-tags') || '').split(' ');
        var show = (f === 'all') || tags.indexOf(f) !== -1;
        it.hidden = !show;
      });
    });
  }

  // Footer privacy link, injected site-wide so the policy is always one click away.
  var bl = document.querySelector('footer a[href*="behance.net"]');
  if (bl && !bl.parentNode.querySelector('a[href="/privacy.html"]')) {
    bl.parentNode.appendChild(document.createTextNode(' / '));
    var pl = document.createElement('a');
    pl.href = '/privacy.html';
    pl.textContent = 'Privacy';
    bl.parentNode.appendChild(pl);
  }

  // ---- GA4 portfolio events: contact intent + engagement (see ga4-event-tracking-plan) ----
  function track(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}); }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button');
    if (!el) return;
    if (el.matches('.filters button')) {
      track('work_filter_use', { filter: el.getAttribute('data-filter') || el.textContent.trim() });
      return;
    }
    if (el.tagName !== 'A') return;
    var href = el.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) {
      track('email_click', { location: el.closest('footer') ? 'footer' : 'contact' });
    } else if (/-resume\.pdf|\.pdf($|\?)/i.test(href)) {
      track('resume_download', { file_name: href.split('/').pop().split('?')[0] });
    } else if (/linkedin\.com/i.test(href)) {
      track('social_click', { network: 'linkedin' });
    } else if (/behance\.net/i.test(href)) {
      track('social_click', { network: 'behance' });
    } else if (el.textContent.indexOf('↗') !== -1 && !el.closest('nav') && href.indexOf('http') !== 0) {
      track('cta_click', { cta_text: el.textContent.replace(/\s+/g, ' ').trim(), destination: href });
    }
  }, true);

  var leadForm = document.querySelector('form[action^="mailto:"]');
  if (leadForm) leadForm.addEventListener('submit', function () {
    track('generate_lead', { lead_source: 'contact_form', method: 'email' });
  });

  Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
    v.addEventListener('play', function () {
      if (v.dataset.evtracked) return;
      v.dataset.evtracked = '1';
      var csm = v.closest('.cs-media');
      var cap = csm && csm.querySelector('.cap');
      var poster = v.getAttribute('poster') || '';
      var title = cap ? cap.textContent.trim() : (poster ? poster.split('/').pop().replace(/\.\w+$/, '') : (location.pathname.split('/').pop() || 'video'));
      track('video_play', { video_title: title, page: location.pathname });
    });
  });
})();
