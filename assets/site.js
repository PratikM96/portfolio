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
    // Subpages (case studies, blog posts) get the floating-capsule nav; main pages get the banded bar.
    if (/^\/(work|blog)\/[^\/]+/.test(location.pathname)) mount.classList.add('nav-sub');
    mount.innerHTML =
      '<div class="nav-inner">' +
        '<a class="brand" href="/">Pratik Mehta<span class="brand-c">©</span></a>' +
        '<button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '<div class="nav-links">' +
          '<a class="nav-home" href="/">PM<span class="brand-c">©</span></a>' +
          '<a href="/about">About</a>' +
          '<a href="/brand">Brand</a>' +
          '<a href="/work">Work</a>' +
          '<a href="/blog">Journal</a>' +
          '<a href="/contact">Contact ↗\uFE0E</a>' +
        '</div>' +
      '</div>';
  }
  function buildFooter() {
    var f = document.querySelector('footer[data-foot]');
    if (!f) return;
    var type = f.getAttribute('data-foot');
    var top = '';
    if (type === 'cta')
      top = '<div class="fbig">Let\'s work<br/><a href="/contact">together↗\uFE0E</a></div>';
    else if (type === 'work')
      top = '<div class="fbig fbig-next">Next:<br/><a class="js-next-project" href="/work">See more work ↗\uFE0E</a></div>';
    else if (type === 'blog')
      top = '<div class="fbig fbig-next">Next:<br/><a class="js-next-post" href="/blog">Read more writing ↗\uFE0E</a></div>';
    var credit = '<div>Pratik Mehta <span class="brand-c">©</span> · New York · 2026</div>';
    var social = '<div>' +
      '<a href="mailto:mehtadpratik@gmail.com">Email</a> / ' +
      '<a href="https://linkedin.com/in/pratikm96" target="_blank" rel="noopener noreferrer">LinkedIn</a> / ' +
      '<a href="https://instagram.com/pratikm96" target="_blank" rel="noopener noreferrer">Instagram</a> / ' +
      '<a href="/privacy">Privacy</a></div>';
    f.innerHTML = '<div class="wrap">' + top +
      '<div class="frow"' + (type === 'bare' ? ' style="margin-top:0"' : '') + '>' +
      credit + social + '</div></div>';
  }
  buildNav();
  buildFooter();

  // Nav: transparent at the top of the page, banded once the page is scrolled.
  (function () {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  // Dossier rail: highlight the in-page index entry for the section in view.
  (function () {
    var idx = document.querySelector('.dz-idx');
    if (!idx) return;
    var links = Array.prototype.slice.call(idx.querySelectorAll('a'));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    if (!secs.length) return;
    var spy = function () {
      var y = window.scrollY + window.innerHeight * 0.32, cur = 0;
      for (var i = 0; i < secs.length; i++) { if (secs[i] && secs[i].offsetTop <= y) cur = i; }
      links.forEach(function (a, j) { a.classList.toggle('on', j === cur); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    spy();
  })();

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
          var href = pick.getAttribute('href').replace(/^(\.\.\/)+/, '').replace(/^\//, '').replace(/\.html$/, '');
          link.setAttribute('href', '/' + href);
          link.textContent = (t ? t.textContent.trim() : 'Next') + ' ↗\uFE0E';
        });
      })
      .catch(function () { /* keep the static fallback link */ });
  }
  fillNext('.js-next-project', '/work', '.proj .p', 'h3');
  fillNext('.js-next-post', '/blog', '.post-row:not(.soon)', '.pt');

  // Hero texture now handled by a synchronous snippet in each page's <head>
  // (search "hero-cover-preload"). It picks a random texture, preloads it with
  // high priority, and sets --cover before the body parses, so the LCP image is
  // discoverable early instead of being injected here by this deferred script.
  // The cs-hero/has-cover classes live in page markup. Resume stays clean (no snippet).

  // Home: featured Selected Work and Journal are now hardcoded directly in
  // index.html (#home-work / #home-blog) rather than fetched + DOM-parsed at
  // runtime. This removes two extra HTTP requests and main-thread parse work on
  // every home load, and makes the featured cards visible to the browser's
  // preload scanner. When the featured set changes, edit those sections in
  // index.html to match work.html / blog.html (see CLAUDE.md recipes).

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

  // Work page: build the Featured + Index hybrid from the .p cards. The cards stay in
  // the DOM as the no-JS fallback, the SEO source, and the home page's data source, so
  // nothing downstream breaks. Recency order, featured pair pinned, chip filter, hover preview.
  var workApp = document.getElementById('work-app');
  if (workApp) {
    var grid0 = document.querySelector('.proj:not(.proj--rows)');
    var cards0 = grid0 ? Array.prototype.slice.call(grid0.querySelectorAll('.p')) : [];
    if (cards0.length) {
      var FEAT = ['work/sportime-clubs.html', 'work/the-ninth.html'];
      // Compare by slug so featured matching works whether card links use pretty
      // URLs (/work/x) or .html (work/x.html). Prevents Featured from going empty
      // when internal links are switched to clean URLs.
      var slug = function (h) { return (h || '').replace(/^(\.\.\/)+/, '').replace(/^\//, '').replace(/\.html$/, ''); };
      var FEATS = FEAT.map(slug);
      var parse = function (c) {
        var im = c.querySelector('.img img');
        var src = im ? (im.getAttribute('src') || '') : '';
        var tEl = c.querySelector('.t');
        var disc = tEl ? tEl.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim() : '';
        var h3 = c.querySelector('h3'), yrEl = c.querySelector('.yr');
        var yr = yrEl ? yrEl.textContent : '';
        var yrs = (yr.match(/\d{4}/g) || []).map(Number);
        return {
          href: c.getAttribute('href') || '#',
          title: h3 ? h3.textContent : '',
          yr: yr, disc: disc, tags: c.getAttribute('data-tags') || '',
          base: src, srcset: im ? (im.getAttribute('srcset') || '') : '',
          small: src.replace('.webp', '-480.webp'), mid: src.replace('.webp', '-960.webp'),
          sort: yrs.length ? Math.max.apply(null, yrs) : 0
        };
      };
      var all = cards0.map(parse);
      var feat = FEATS.map(function (h) { var m = all.filter(function (p) { return slug(p.href) === h; }); return m[0]; }).filter(Boolean);
      var rest = all.filter(function (p) { return FEATS.indexOf(slug(p.href)) === -1; }).sort(function (a, b) { return b.sort - a.sort; });
      var isConcept = function (p) { return (' ' + (p.tags || '') + ' ').indexOf(' concept ') !== -1; };
      var clientRest = rest.filter(function (p) { return !isConcept(p); });
      var conceptRest = rest.filter(isConcept);

      var featHtml = '<div class="wk-lab" style="padding-bottom:1.2rem;border-bottom:1px solid var(--line);margin-bottom:1.4rem">Featured</div><div class="wk-feat">' +
        feat.map(function (p) {
          var pill = isConcept(p) ? '<span class="ctag">Concept</span>' : '';
          return '<a href="' + p.href + '"><div class="img">' + pill + '<img src="' + p.base + '" srcset="' + p.srcset + '" sizes="(max-width: 980px) 92vw, 600px" alt="' + p.title + '" loading="lazy" decoding="async"/></div>' +
            '<div class="fl"><h3>' + p.title + '</h3><div class="fmeta"><span class="wk-disc">' + p.disc + '</span><span class="wk-yr">' + p.yr + '</span></div></div></a>';
        }).join('') + '</div>';

      var cats = [['all', 'All'], ['brand', 'Brand'], ['uiux', 'UI/UX'], ['motion', 'Motion'], ['photo', 'Photo'], ['ai', 'AI']];
      var barHtml = '<div class="wk-bar"><div class="wk-lab">Index</div><div class="wk-chips">' +
        cats.map(function (c, i) { return '<button class="wk-chip' + (i === 0 ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';

      var liHtml = function (p, i) {
        return '<a class="wk-li" href="' + p.href + '" data-tags="' + p.tags + '" data-img="' + p.mid + '">' +
          '<span class="wn">' + ('0' + (i + 1)).slice(-2) + '</span>' +
          '<img class="wt" src="' + p.small + '" alt="" loading="lazy"/>' +
          '<div class="wm"><h3>' + p.title + '</h3><div class="wr"><span class="wk-disc">' + p.disc + '</span><span class="wk-yr">' + p.yr + '</span></div></div></a>';
      };
      var groupHtml = function (cls, label, list) {
        if (!list.length) return '';
        return '<div class="wk-group ' + cls + '"><div class="wk-ghead">' + label + '</div><div class="wk-index">' + list.map(liHtml).join('') + '</div></div>';
      };
      var groupsHtml = groupHtml('first', 'Selected client work', clientRest) + groupHtml('', 'Concepts', conceptRest) +
        '<div class="wk-empty" id="wk-empty">No projects in this discipline.</div><div class="wk-prev" id="wk-prev"><img alt=""/></div>';

      workApp.innerHTML = featHtml + barHtml + groupsHtml;
      workApp.hidden = false;
      grid0.style.display = 'none';

      var wchips = workApp.querySelector('.wk-chips');
      var wgroups = Array.prototype.slice.call(workApp.querySelectorAll('.wk-group'));
      var wlis = Array.prototype.slice.call(workApp.querySelectorAll('.wk-li'));
      var wempty = workApp.querySelector('#wk-empty');
      wchips.addEventListener('click', function (e) {
        var b = e.target.closest('.wk-chip'); if (!b) return;
        Array.prototype.slice.call(wchips.querySelectorAll('.wk-chip')).forEach(function (c) { c.classList.toggle('on', c === b); });
        var f = b.getAttribute('data-f'), shown = 0;
        wlis.forEach(function (li) {
          var ok = f === 'all' || (li.getAttribute('data-tags') || '').split(' ').indexOf(f) !== -1;
          li.classList.toggle('off', !ok); if (ok) shown++;
        });
        wgroups.forEach(function (g) {
          g.classList.toggle('off', g.querySelectorAll('.wk-li:not(.off)').length === 0);
        });
        wempty.style.display = shown ? 'none' : 'block';
        if (typeof track === 'function') track('work_filter_use', { filter: f });
      });

      var wprev = workApp.querySelector('#wk-prev'), wpim = wprev.querySelector('img');
      wlis.forEach(function (li) {
        var show = function () { wpim.src = li.getAttribute('data-img'); wprev.classList.add('on'); };
        var hide = function () { wprev.classList.remove('on'); };
        li.addEventListener('mouseenter', show);
        li.addEventListener('mouseleave', hide);
        li.addEventListener('focus', show);
        li.addEventListener('blur', hide);
      });
      Array.prototype.slice.call(workApp.querySelectorAll('.wk-index')).forEach(function (idx) {
        idx.addEventListener('mousemove', function (e) {
          wprev.style.left = e.clientX + 'px'; wprev.style.top = e.clientY + 'px';
        });
      });
    }
  }

  // ===== Motion system (shared, all pages). Gated behind prefers-reduced-motion and IO support. =====
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IO_OK = 'IntersectionObserver' in window;

  function animNum(el) {
    var raw = el.dataset.target, hasComma = raw.indexOf(',') !== -1;
    var target = parseFloat(raw.replace(/,/g, '')), dec = (raw.split('.')[1] || '').length;
    function fmt(v) { var s = dec ? v.toFixed(dec) : String(Math.round(v)); if (hasComma) s = (+s).toLocaleString(); return s; }
    var start = null, dur = 1500;
    function step(ts) { if (!start) start = ts; var p = Math.min((ts - start) / dur, 1);
      el.textContent = fmt(target * (0.1 + 0.9 * p)); if (p < 1) requestAnimationFrame(step); else el.textContent = raw; }
    requestAnimationFrame(step);
  }

  if (!REDUCED && IO_OK) {
    document.body.classList.add('kin');
    // hero kinetic headline
    Array.prototype.forEach.call(document.querySelectorAll('h1.mega .kw'), function (k, i) {
      setTimeout(function () { k.classList.add('go'); }, 110 + i * 105);
    });
    // scroll reveals (consistent across pages)
    var REVEAL_SEL = '.about, .caps-grid > .cap, .inds, .approach-grid > .item, .stats > .s, .tcards > .tcard, .contact-cta, .dz-media, .dz-grid2, .dz-statbar, .sb-cell, .sb-banner, .sb-overview, .sb-split, .sb-reflect-inner';
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll(REVEAL_SEL), function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) * 0.93) { el.classList.add('reveal', 'in'); }
      else { el.classList.add('reveal'); io.observe(el); }
    });
    // stat count-up
    var io3 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { animNum(e.target); io3.unobserve(e.target); } });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(document.querySelectorAll('.stats .accent'), function (el) {
      var raw = el.textContent.trim();
      if (!/^[\d,]+(\.\d+)?$/.test(raw)) return;
      el.dataset.target = raw;
      var dec = (raw.split('.')[1] || '').length;
      el.textContent = dec ? (0).toFixed(dec) : '0';
      io3.observe(el);
    });
  }

  // ---- GA4 events: contact intent + engagement ----
  function track(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}); }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button');
    if (!el) return;
    if (el.tagName !== 'A') return;
    var href = el.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) {
      track('email_click', { location: el.closest('footer') ? 'footer' : 'contact' });
    } else if (/-resume\.pdf|\.pdf($|\?)/i.test(href)) {
      track('resume_download', { file_name: href.split('/').pop().split('?')[0] });
    } else if (/linkedin\.com/i.test(href)) {
      track('social_click', { network: 'linkedin' });
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
