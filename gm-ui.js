// =================== GOOGLE-MAPS-STYLE HOME SCREEN HELPERS (v1.0) ===================
// Builds the row of quick "category chips" under the search bar (Food, Classrooms, Garden ...).
// The chips are made from the REAL categories found in your places data, so if you add a new
// category in the editor, a new chip appears on its own. Tapping a chip simply runs a search.
(function () {
  'use strict';
  const ICONS = { cafeteria: 'restaurant', academic: 'school', garden: 'park', library: 'local_library', toilet: 'wc', restroom: 'wc', parking: 'local_parking', sport: 'sports_soccer', office: 'business_center' };
  const MAX_CHIPS = 8;
  const bar = () => document.getElementById('gmChips');
  const input = () => document.getElementById('searchInput');
  const tr = k => (typeof t === 'function' ? t(k) : k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function iconFor(cat) {
    const k = String(cat).toLowerCase();
    for (const key in ICONS) if (k.indexOf(key) !== -1) return ICONS[key];
    return 'place';
  }

  function categories() {
    const seen = new Map();
    try {
      if (typeof allPlaces !== 'undefined' && Array.isArray(allPlaces)) {
        allPlaces.forEach(p => { if (p && p.category) seen.set(p.category, (seen.get(p.category) || 0) + 1); });
      }
    } catch (e) { /* data not ready yet */ }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).slice(0, MAX_CHIPS).map(e => e[0]);
  }

  function render() {
    const el = bar(); if (!el) return false;
    const cats = categories();
    if (!cats.length) { el.hidden = true; return false; }
    el.hidden = false;
    el.innerHTML = cats.map(c => {
      const label = tr(c);
      return '<button type="button" class="gm-chip" data-q="' + esc(label) + '"><span class="material-symbols-rounded">' + iconFor(c) + '</span><span>' + esc(label) + '</span></button>';
    }).join('');
    return true;
  }

  function runSearch(q) {
    const inp = input(); if (!inp) return;
    inp.value = q;
    inp.focus();
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function init() {
    const el = bar(); if (!el) return;
    el.addEventListener('click', e => {
      const b = e.target.closest('.gm-chip');
      if (b) runSearch(b.dataset.q);
    });
    // Places load a moment after the page; keep checking until they arrive.
    let tries = 0;
    const timer = setInterval(() => { if (render() || ++tries > 60) clearInterval(timer); }, 400);
    window.addEventListener('languagechange', render);
    wireBar(); wireCompass();

    // Remember "search is focused" on <body> so CSS can tuck the chips away while you type.
    const inp = input();
    if (inp) {
      inp.addEventListener('focus', () => document.body.classList.add('gm-searching'));
      inp.addEventListener('blur', () => setTimeout(() => document.body.classList.remove('gm-searching'), 150));
    }
  }

  // ---- bottom bar (phone): Saved / Settings / Info open the same windows as the menu ----
  function labelBar() {
    document.querySelectorAll('#gmBottomBar [data-i18n-key]').forEach(el => { const v = tr(el.dataset.i18nKey); if (v && v !== el.dataset.i18nKey) el.textContent = v; });
    const c = document.getElementById('gmCompass');
    if (c) { const v = tr('compass_label'); if (v && v !== 'compass_label') { c.title = v; c.setAttribute('aria-label', v); } }
  }
  function wireBar() {
    const bar = document.getElementById('gmBottomBar'); if (!bar) return;
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-open]'); if (!b) return;
      if (typeof openModal === 'function') openModal(b.dataset.open);
    });
    labelBar();
    window.addEventListener('languagechange', labelBar);
    setTimeout(labelBar, 800);          // translations finish loading a moment after the page
  }

  // ---- compass: round, red N, turns with the map, tap = face north again ----
  function wireCompass() {
    const btn = document.getElementById('gmCompass'), needle = document.getElementById('gmCompassNeedle');
    if (!btn || !needle) return;
    const getMap = () => (window.mapEngine && window.mapEngine.map) || null;
    let tries = 0;
    const attach = () => {
      const map = getMap();
      if (!map || typeof map.on !== 'function') { if (++tries < 100) setTimeout(attach, 200); return; }
      const sync = () => { needle.style.transform = 'rotate(' + (-map.getBearing()) + 'deg)'; };
      map.on('rotate', sync); map.on('load', sync); sync();
      btn.addEventListener('click', () => map.easeTo({ bearing: 0, pitch: 0, duration: 350 }));
    };
    attach();
  }

  window.GmUI = { renderChips: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
