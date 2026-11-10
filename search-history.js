// =================== SEARCH: RECENT SEARCHES + SUGGESTIONS ===================
// Fills the dropdown that opens when you tap the empty search bar.
//   • Recent searches – real history, saved in this browser (localStorage), newest first, each one removable
//   • Suggestions     – real campus places/buildings from the map data (not already in your history)
// Picking an item behaves exactly like picking a search result (selectSearchResult in script.js).
(function () {
  'use strict';
  const KEY = 'search_history_v1';
  const MAX_SAVED = 8, SHOW_FIRST = 5, SHOW_SUGGESTIONS = 5;
  const box = () => document.getElementById('searchEmptyState');
  const input = () => document.getElementById('searchInput');
  const tr = k => (typeof t === 'function' ? t(k) : k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let expanded = false;

  // ---- storage (safe if localStorage is blocked) ----
  function load() {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.name) : []; } catch (e) { return []; }
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED))); } catch (e) { /* ignore */ } }
  const same = (a, b) => a.type === b.type && (a.id != null ? a.id === b.id : a.name === b.name);

  function slim(r) {
    const o = { type: r.type, id: r.id, name: r.name, lat: r.lat, lng: r.lng, floor: r.floor, category: r.category, floors: r.floors, buildingType: r.buildingType };
    Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
    return o;
  }
  function add(result) {
    if (!result || !result.name) return;
    const r = slim(result);
    save([r].concat(load().filter(x => !same(x, r))));
    render();
  }
  function remove(i) { const l = load(); l.splice(i, 1); save(l); render(); }
  function clearAll() { save([]); expanded = false; render(); }

  // ---- what to show ----
  function floorText(r) {
    if (r.floor === undefined || r.floor === null) return '';
    if (Array.isArray(r.floor)) return r.floor.includes('all') ? 'ชั้นทั้งหมด' : tr('floor') + ' ' + r.floor.join(', ');
    return tr('floor') + ' ' + r.floor;
  }
  function subtitle(r) {
    if (r.type === 'building') return [r.buildingType, r.floors ? r.floors + ' ' + tr('floor') : ''].filter(Boolean).join(' · ');
    return [r.category ? tr(r.category) : '', floorText(r)].filter(Boolean).join(' · ');
  }
  function icon(r, history) {
    if (history) return 'history';
    return r.type === 'building' ? 'apartment' : r.type === 'pin' ? 'photo_camera' : 'location_on';
  }
  function suggestions(exclude) {
    const out = [];
    try {
      if (typeof allPlaces !== 'undefined' && Array.isArray(allPlaces)) {
        allPlaces.forEach(p => {
          if (!p || !p.name || !p.coords || !p.coords.length) return;
          const c = typeof getPolygonCenter === 'function' ? getPolygonCenter(p.coords) : null;
          if (!c) return;
          out.push({ type: 'place', id: p.id, name: p.name, floor: p.floor !== undefined ? p.floor : 0, lat: c[0], lng: c[1], category: p.category });
        });
      }
      if (typeof savedBuildings !== 'undefined' && Array.isArray(savedBuildings)) {
        savedBuildings.forEach(b => {
          if (b && b.name && b.labelPosition) out.push({ type: 'building', name: b.name, lat: b.labelPosition[0], lng: b.labelPosition[1], buildingType: b.type, floors: b.floors });
        });
      }
    } catch (e) { /* data not ready yet */ }
    const seen = new Set(exclude.map(x => x.name));
    return out.filter(x => !seen.has(x.name) && (seen.add(x.name), true)).slice(0, SHOW_SUGGESTIONS);
  }

  // ---- rendering ----
  let shown = { recent: [], sugg: [] };
  const row = (r, key, history) =>
    '<div class="gm-recent-item" role="option" tabindex="0" data-k="' + key + '">' +
    '<div class="gm-recent-icon"><span class="material-symbols-rounded">' + icon(r, history) + '</span></div>' +
    '<div class="gm-recent-text"><div class="gm-recent-title">' + esc(r.name) + '</div>' +
    (subtitle(r) ? '<div class="gm-recent-subtitle">' + esc(subtitle(r)) + '</div>' : '') + '</div>' +
    (history ? '<button type="button" class="gm-recent-remove" data-rm="' + key.slice(1) + '" aria-label="' + esc(tr('search_remove')) + '" title="' + esc(tr('search_remove')) + '"><span class="material-symbols-rounded">close</span></button>' : '') +
    '</div>';

  function render() {
    const el = box(); if (!el) return;
    const all = load();
    const recent = expanded ? all : all.slice(0, SHOW_FIRST);
    const sugg = suggestions(all);
    shown = { recent, sugg };
    let h = '';
    if (recent.length) {
      h += '<div class="gm-section"><span>' + esc(tr('search_recent')) + '</span><button type="button" class="gm-section-act" data-act="clear">' + esc(tr('search_clear')) + '</button></div>';
      h += recent.map((r, i) => row(r, 'r' + i, true)).join('');
      if (all.length > SHOW_FIRST) h += '<div class="gm-recent-more"><a href="#" class="gm-recent-more-link" data-act="more">' + esc(tr(expanded ? 'search_less_recent' : 'search_more_recent')) + '</a></div>';
    }
    if (sugg.length) {
      h += '<div class="gm-section"><span>' + esc(tr('search_suggestions')) + '</span></div>';
      h += sugg.map((r, i) => row(r, 's' + i, false)).join('');
    }
    if (!h) h = '<div class="gm-empty-hint">' + esc(tr('search_hint')) + '</div>';
    el.innerHTML = h;
  }

  function pick(k) {
    const r = (k[0] === 'r' ? shown.recent : shown.sugg)[+k.slice(1)];
    if (!r) return;
    add(r);
    if (typeof selectSearchResult === 'function') selectSearchResult(r);
  }

  function wire() {
    const el = box(), inp = input(); if (!el || !inp) return;
    el.addEventListener('mousedown', e => e.preventDefault());      // keep the search box focused while tapping an item
    el.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { e.stopPropagation(); remove(+rm.dataset.rm); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        e.preventDefault(); e.stopPropagation();
        if (act.dataset.act === 'clear') clearAll(); else { expanded = !expanded; render(); }
        return;
      }
      const item = e.target.closest('.gm-recent-item');
      if (item) { e.stopPropagation(); pick(item.dataset.k); }
    });
    el.addEventListener('keydown', e => {
      const items = Array.from(el.querySelectorAll('.gm-recent-item'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Enter' || e.key === ' ') { const item = e.target.closest('.gm-recent-item'); if (item && !e.target.closest('button')) { e.preventDefault(); pick(item.dataset.k); } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0] || inp).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : inp).focus(); }
      else if (e.key === 'Escape') { el.style.display = 'none'; inp.focus(); }
    });
    inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && inp.value.trim() === '') { const f = el.querySelector('.gm-recent-item'); if (f) { e.preventDefault(); f.focus(); } } });
    inp.addEventListener('focus', render);
    inp.addEventListener('input', () => { if (inp.value.trim() === '') render(); });
    render();
  }

  window.SearchHistory = { add, remove, clear: clearAll, list: load, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}());
