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

  // ---- Single-source site chrome ------------------------------------------
  // Nav and footer are injected from here so they live in ONE place and stay
  // consistent across every page. To add or change a link, edit this block and
  // it updates site-wide. Nav is position:fixed and the footer is the last
  // element on the page, so injecting them shifts no content (no layout shift).
  // Pages opt in with an empty <nav id="site-nav"></nav> and a
  // <footer data-foot="cta|work|blog|bare"></footer>. Bespoke pages (resume,
  // concept case studies) carry their own chrome and have no mounts here.
  function buildNav() {
    var mount = document.getElementById('site-nav');
    if (!mount) return;
    mount.innerHTML =
      '<div class="nav-inner">' +
        '<a class="brand" href="/index.html">Pratik Mehta<span class="brand-c">©</span></a>' +
        '<button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '<div class="nav-links">' +
          '<a href="/about.html">About</a>' +
          '<a href="/brand.html">Brand</a>' +
          '<a href="/work.html">Work</a>' +
          '<a href="/blog.html">Blog</a>' +
          '<a href="/contact.html">Contact↗</a>' +
        '</div>' +
      '</div>';
  }
  function buildFooter() {
    var f = document.querySelector('footer[data-foot]');
    if (!f) return;
    var type = f.getAttribute('data-foot');
    var top = '';
    if (type === 'cta')
      top = '<div class="fbig">Let\'s work<br/><a href="/contact.html">together↗</a></div>';
    else if (type === 'work')
      top = '<div class="fbig fbig-next">Next:<br/><a class="js-next-project" href="/work.html">More work ↗</a></div>';
    else if (type === 'blog')
      top = '<div class="fbig fbig-next">Next:<br/><a class="js-next-post" href="/blog.html">More writing ↗</a></div>';
    var credit = '<div>Pratik Mehta <span class="brand-c">©</span> · New York · 2026</div>';
    var social = '<div>' +
      '<a href="mailto:mehtadpratik@gmail.com">Email</a> / ' +
      '<a href="https://linkedin.com/in/pratikm96" target="_blank" rel="noopener noreferrer">LinkedIn</a> / ' +
      '<a href="https://behance.net/pratikm96" target="_blank" rel="noopener noreferrer">Behance</a> / ' +
      '<a href="https://instagram.com/pratikm96" target="_blank" rel="noopener noreferrer">Instagram</a> / ' +
      '<a href="/privacy.html">Privacy</a></div>';
    f.innerHTML = '<div class="wrap">' + top +
      '<div class="frow"' + (type === 'bare' ? ' style="margin-top:0"' : '') + '>' +
      credit + social + '</div></div>';
  }
  buildNav();
  buildFooter();

  // Fill any "next" link with a random project/post pulled live from the index,
  // excluding the current page, so footers never need editing when work is added.
  // Used by the injected work/blog footers AND by the bespoke concept-page
  // footers (which tag their link with .js-next-project). Falls back to the
  // static href (work.html / blog.html) if offline or opened from file://.
  function fillNext(sel, src, cardSel, titleSel) {
    var links = document.querySelectorAll(sel);
    if (!links.length) return;
    fetch(src, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var here = location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
        var pool = Array.prototype.slice.call(doc.querySelectorAll(cardSel)).filter(function (a) {
          var h = a.getAttribute('href') || '';
          return h && h.charAt(0) !== '#' && h.split('/').pop().replace(/\.html$/, '') !== here;
        });
        if (!pool.length) return;
        Array.prototype.forEach.call(links, function (link) {
          var pick = pool[Math.floor(Math.random() * pool.length)];
          var t = pick.querySelector(titleSel);
          var href = pick.getAttribute('href').replace(/^(\.\.\/)+/, '').replace(/^\//, '');
          link.setAttribute('href', '/' + href);
          link.textContent = (t ? t.textContent.trim() : 'Next') + ' ↗';
        });
      })
      .catch(function () { /* keep the static fallback link */ });
  }
  fillNext('.js-next-project', '/work.html', '.proj .p', 'h3');
  fillNext('.js-next-post', '/blog.html', '.post-row:not(.soon)', '.pt');

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

  // Work grid: randomize the project order each load so no project is permanently first or last.
  // Scoped to the full work grid only (.proj), never the home rows (.proj--rows). Renumbers 01..N after shuffle.
  var workGrid = document.querySelector('.proj:not(.proj--rows)');
  if (workGrid) {
    var pcards = Array.prototype.slice.call(workGrid.querySelectorAll('.p'));
    for (var si = pcards.length - 1; si > 0; si--) {
      var sj = (Math.random() * (si + 1)) | 0;
      var tmp = pcards[si]; pcards[si] = pcards[sj]; pcards[sj] = tmp;
    }
    pcards.forEach(function (c, idx) {
      workGrid.appendChild(c);
      var nm = c.querySelector('.num');
      if (nm) nm.textContent = ('0' + (idx + 1)).slice(-2);
    });
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
