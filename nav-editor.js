// =================== WALKWAY EDITOR (dev mode only) ===================
// Draws the walkway network that navigation.js routes over. Works like Google's "Missing road" flow:
// a crosshair stays in the middle of the screen, you pan the map under it and press "Add point".
// Everything is finger-friendly (no dragging of tiny dots needed).
//
//   Walkway  – add points along a corridor, press Next to save the line
//   Door     – drop a door/entrance, link it to a place; it auto-connects to the nearest walkway
//   Stairs   – drop stairs/lift on several floors at once; each floor auto-connects to the nearest walkway
//   Edit     – tap a point or line to rename, re-type, move (to the crosshair) or delete it
//
// Data format (data/navgraph.json):
//   { version, autoFromPins, nodes:{id:{lat,lng,floor,type,name?,placeId?}}, edges:[{from,to}],
//     transitions:[{id,type:'staircase'|'elevator',nodes:[ids]}] }
// Save → POST /save_navgraph (server.py). Without a server the draft stays in this browser; use Export.
(function () {
  'use strict';
  const NC = window.NavCore;
  const $ = id => document.getElementById(id);
  const mapObj = () => window.mapEngine && window.mapEngine.map;
  const NS = () => window.NavSystem;
  const floorNow = () => (NS() ? NS().userFloor() : 1);
  const nFloors = () => (typeof FLOORS !== 'undefined' ? FLOORS.length : 3);
  const EMPTY = { type: 'FeatureCollection', features: [] };
  const uid = () => 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m, type) => { if (typeof showToast === 'function') showToast(m, type || 'info'); };
  const SNAP_PX = 18;
  const CONNECT_M = 30;           // doors/stairs auto-link to a walkway closer than this
  const MODES = [
    { id: 'walk', icon: 'timeline', label: 'Walkway' },
    { id: 'door', icon: 'door_front', label: 'Door' },
    { id: 'stairs', icon: 'stairs', label: 'Stairs' },
    { id: 'edit', icon: 'edit', label: 'Edit' }
  ];

  let data = null, isOpen = false, mode = 'walk', draft = [], sel = null, history = [], dirty = false;
  let ui = null, layersReady = false, reloadTimer = null, raf = 0, savedNote = '';
  const form = { dType: 'door', dName: '', dPlace: '', vKind: 'stairs', vName: '', vFloors: null };

  // ---------------------------------------------------------------- data
  async function loadData() {
    let d = null;
    try { const raw = lsGet('dev_navgraph'); if (raw) { d = JSON.parse(raw); dirty = true; } } catch (e) { /* corrupt draft */ }
    if (!d) {
      for (const url of ['/get_navgraph', 'data/navgraph.json']) {
        try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && typeof j === 'object' && !Array.isArray(j)) { d = j; break; } } } catch (e) { /* next */ }
      }
    }
    setData(d);
  }
  function setData(d) {
    data = Object.assign({ version: '2.0', autoFromPins: true, nodes: {}, edges: [], transitions: [] }, d || {});
    data.nodes = data.nodes || {}; data.edges = data.edges || []; data.transitions = data.transitions || [];
  }

  function graph() { return NS() && NS().getGraph(); }
  function coord(id) {
    if (data.nodes[id]) return data.nodes[id];
    const g = graph();
    return g && g.nodes.get(id) || null;
  }
  const hasEdge = (a, b) => data.edges.some(e => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  function addEdge(a, b) { if (a && b && a !== b && !hasEdge(a, b)) data.edges.push({ from: a, to: b }); }
  function removeEdge(a, b) { data.edges = data.edges.filter(e => !((e.from === a && e.to === b) || (e.from === b && e.to === a))); }

  function snapshot() { history.push(JSON.stringify(data)); if (history.length > 60) history.shift(); }
  function deleteNode(id) {
    delete data.nodes[id];
    data.edges = data.edges.filter(e => e.from !== id && e.to !== id);
    data.transitions.forEach(t => { t.nodes = t.nodes.filter(n => n !== id); });
    data.transitions = data.transitions.filter(t => t.nodes.length >= 2);
  }
  function newNode(ll, floor, type, extra) {
    const id = uid();
    data.nodes[id] = Object.assign({ lat: ll.lat, lng: ll.lng, floor, type: type || 'corridor' }, extra || {});
    return id;
  }
  function splitEdge(a, b, ll) {
    const A = coord(a); if (!A) return null;
    const id = newNode(ll, A.floor || 1, 'corridor');
    removeEdge(a, b); addEdge(a, id); addEdge(id, b);
    return id;
  }

  // ---------------------------------------------------------------- snapping
  function floorNodes(f) {
    const out = [];
    Object.keys(data.nodes).forEach(id => { const n = data.nodes[id]; if ((n.floor || 1) === f) out.push({ id, lat: n.lat, lng: n.lng, manual: true }); });
    const g = graph();
    if (g) g.nodes.forEach(n => { if (n.source === 'pin' && n.floor === f) out.push({ id: n.id, lat: n.lat, lng: n.lng, manual: false }); });
    return out;
  }
  function distPx(p, a, b) {        // point-to-segment distance on screen
    const bx = b.x - a.x, by = b.y - a.y, l2 = bx * bx + by * by;
    let t = l2 ? ((p.x - a.x) * bx + (p.y - a.y) * by) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + bx * t), p.y - (a.y + by * t));
  }
  /** What is under screen point `pt`? An existing node (preferred) or a point on a manual line, else null. */
  function snapAt(pt, f, r) {
    const map = mapObj();
    let best = null, bd = r;
    floorNodes(f).forEach(n => {
      const p = map.project([n.lng, n.lat]); const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bd) { bd = d; best = { type: 'node', id: n.id, lat: n.lat, lng: n.lng, manual: n.manual }; }
    });
    if (best) return best;
    bd = r * 0.7;
    data.edges.forEach(e => {
      const A = data.nodes[e.from] || coord(e.from), B = data.nodes[e.to] || coord(e.to);
      if (!A || !B || (A.floor || 1) !== f) return;
      const d = distPx(pt, map.project([A.lng, A.lat]), map.project([B.lng, B.lat]));
      if (d < bd) {
        const ll = map.unproject([pt.x, pt.y]);
        const q = NC.project({ lat: ll.lat, lng: ll.lng }, A, B);
        bd = d; best = { type: 'edge', a: e.from, b: e.to, lat: q.lat, lng: q.lng };
      }
    });
    return best;
  }
  // The crosshair is lifted above the bottom sheet on phones, so "centre" = where the crosshair really is.
  function centerPt() {
    const c = mapObj().getContainer(), r = c.getBoundingClientRect();
    if (ui && ui.cross && !ui.root.hidden) { const q = ui.cross.getBoundingClientRect(); if (q.width) return { x: q.left + q.width / 2 - r.left, y: q.top + q.height / 2 - r.top }; }
    return { x: c.clientWidth / 2, y: c.clientHeight / 2 };
  }
  function centerLL() { const p = centerPt(), c = mapObj().unproject([p.x, p.y]); return { lat: c.lat, lng: c.lng }; }
  const target = () => snapAt(centerPt(), floorNow(), SNAP_PX) || null;

  /** Nearest place to hook a door/stairs onto: a node or a point on a line, within CONNECT_M metres. */
  function connectTo(id, f) {
    const me = coord(id); if (!me) return null;
    let best = null, bd = CONNECT_M;
    floorNodes(f).forEach(n => {
      if (n.id === id) return;
      const d = NC.distance(me, n);
      if (d < bd) { bd = d; best = { type: 'node', id: n.id }; }
    });
    data.edges.forEach(e => {
      if (e.from === id || e.to === id) return;
      const A = coord(e.from), B = coord(e.to);
      if (!A || !B || (A.floor || 1) !== f || !data.nodes[e.from] && !data.nodes[e.to]) return;   // pin-only edges can't be split
      const q = NC.project(me, A, B);
      if (q.dist < bd - 0.5 && q.t > 0.02 && q.t < 0.98) { bd = q.dist; best = { type: 'edge', a: e.from, b: e.to, lat: q.lat, lng: q.lng }; }
    });
    if (!best) return null;
    if (best.type === 'node') addEdge(id, best.id);
    else { const j = splitEdge(best.a, best.b, best); addEdge(id, j); }
    return Math.round(bd);
  }

  // ---------------------------------------------------------------- persistence
  const counts = () => Object.keys(data.nodes).length + ' points · ' + data.edges.length + ' lines · ' + data.transitions.length + ' stairs/lifts';
  function changed() {
    dirty = true; savedNote = '';
    lsSet('dev_navgraph', JSON.stringify(data));
    renderAll();
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { if (NS()) NS().reloadGraph().then(renderAll); }, 350);
  }
  async function saveServer() {
    const btn = $('neSave'); if (btn) btn.disabled = true;
    try {
      const r = await fetch('/save_navgraph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      try { localStorage.removeItem('dev_navgraph'); } catch (e) { /* ignore */ }
      dirty = false; savedNote = 'Saved to data/navgraph.json';
      toast('Walkways saved', 'success');
      await NS().reloadGraph();
    } catch (e) {
      lsSet('dev_navgraph', JSON.stringify(data));
      savedNote = 'No server — draft kept in this browser';
      toast('Server not reachable. Use ⋮ → Export JSON, then put it in data/navgraph.json', 'error');
    }
    if (btn) btn.disabled = false;
    renderAll();
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'navgraph.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (!j || typeof j !== 'object' || Array.isArray(j) || !j.nodes || !j.edges) throw new Error('not a navgraph file');
        snapshot(); setData(j); sel = null; draft = []; changed(); toast('Imported', 'success');
      } catch (e) { toast('Import failed: ' + e.message, 'error'); }
    };
    rd.readAsText(file);
  }

  // ---------------------------------------------------------------- map layers
  const COL = { door: '#34c759', entrance: '#30b0c7', stairs: '#af52de', elevator: '#5856d6', draft: '#12b5cb' };
  function ensureLayers() {
    const map = mapObj(); if (!map) return false;
    if (layersReady && map.getSource('ne-edges')) return true;
    try {
      ['ne-pin-edges', 'ne-pin-nodes', 'ne-edges', 'ne-nodes', 'ne-sel', 'ne-draft', 'ne-draft-pts', 'ne-snap'].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY }); });
      const L = (o) => map.addLayer(o);
      L({ id: 'ne-pin-edges', type: 'line', source: 'ne-pin-edges', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [1, 2], 'line-opacity': 0.6 } });
      L({ id: 'ne-edges-casing', type: 'line', source: 'ne-edges', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#202124', 'line-width': 9, 'line-opacity': 0.45 } });
      L({ id: 'ne-edges', type: 'line', source: 'ne-edges', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5 } });
      L({ id: 'ne-pin-nodes', type: 'circle', source: 'ne-pin-nodes', paint: { 'circle-radius': 4.5, 'circle-color': ['case', ['get', 'assumed'], 'rgba(255,255,255,0.4)', '#ffffff'], 'circle-stroke-color': '#5f6368', 'circle-stroke-width': 1.5, 'circle-opacity': 0.9 } });
      L({ id: 'ne-nodes', type: 'circle', source: 'ne-nodes', paint: {
        'circle-radius': ['match', ['get', 'type'], 'corridor', 5, 7.5],
        'circle-color': ['match', ['get', 'type'], 'door', COL.door, 'entrance', COL.entrance, 'stairs', COL.stairs, 'elevator', COL.elevator, '#ffffff'],
        'circle-stroke-color': ['match', ['get', 'type'], 'corridor', '#202124', '#ffffff'], 'circle-stroke-width': 2.5 } });
      L({ id: 'ne-sel-line', type: 'line', source: 'ne-sel', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#1a73e8', 'line-width': 8, 'line-opacity': 0.8 } });
      L({ id: 'ne-sel', type: 'circle', source: 'ne-sel', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 13, 'circle-color': 'rgba(26,115,232,0.18)', 'circle-stroke-color': '#1a73e8', 'circle-stroke-width': 3 } });
      L({ id: 'ne-draft', type: 'line', source: 'ne-draft', layout: { 'line-cap': 'butt' }, paint: { 'line-color': COL.draft, 'line-width': 5, 'line-dasharray': [1.6, 1.4] } });
      L({ id: 'ne-draft-pts', type: 'circle', source: 'ne-draft-pts', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': COL.draft, 'circle-stroke-width': 3.5 } });
      L({ id: 'ne-snap', type: 'circle', source: 'ne-snap', paint: { 'circle-radius': 14, 'circle-color': 'rgba(52,199,89,0.15)', 'circle-stroke-color': '#34c759', 'circle-stroke-width': 3 } });
      layersReady = true; return true;
    } catch (e) { console.warn('walkway editor layers', e); return false; }
  }
  const setSrc = (id, features) => { const s = mapObj().getSource(id); if (s) s.setData({ type: 'FeatureCollection', features }); };
  const pt = (lng, lat, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'Point', coordinates: [lng, lat] } });
  const ln = (coords, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'LineString', coordinates: coords } });

  function drawData() {
    const f = floorNow(), g = graph();
    const nodes = [], edges = [], pinNodes = [], pinEdges = [];
    Object.keys(data.nodes).forEach(id => { const n = data.nodes[id]; if ((n.floor || 1) === f) nodes.push(pt(n.lng, n.lat, { id, type: n.type || 'corridor' })); });
    data.edges.forEach(e => {
      const a = coord(e.from), b = coord(e.to); if (!a || !b || (a.floor || 1) !== f) return;
      edges.push(ln([[a.lng, a.lat], [b.lng, b.lat]], { a: e.from, b: e.to }));
    });
    if (g) {
      g.nodes.forEach(n => { if (n.source === 'pin' && n.floor === f) pinNodes.push(pt(n.lng, n.lat, { id: n.id, assumed: !!n.assumed })); });
      g.edges.forEach(e => {
        if (e.source !== 'pin') return;
        const a = g.nodes.get(e.a), b = g.nodes.get(e.b); if (!a || !b || a.floor !== f) return;
        pinEdges.push(ln([[a.lng, a.lat], [b.lng, b.lat]]));
      });
    }
    setSrc('ne-nodes', nodes); setSrc('ne-edges', edges); setSrc('ne-pin-nodes', pinNodes); setSrc('ne-pin-edges', pinEdges);
    const s = [];
    if (sel && sel.kind === 'node' && data.nodes[sel.id]) { const n = data.nodes[sel.id]; if ((n.floor || 1) === f) s.push(pt(n.lng, n.lat)); }
    if (sel && sel.kind === 'edge') { const a = coord(sel.a), b = coord(sel.b); if (a && b && (a.floor || 1) === f) s.push(ln([[a.lng, a.lat], [b.lng, b.lat]])); }
    setSrc('ne-sel', s);
  }

  /** Cheap part: the dashed draft line + snap ring + crosshair colour. Runs on every map move. */
  function drawLive() {
    raf = 0;
    if (!isOpen || !layersReady) return;
    const tg = (mode === 'walk' || mode === 'door' || mode === 'stairs') ? target() : null;
    const c = tg ? { lat: tg.lat, lng: tg.lng } : centerLL();
    const coords = draft.map(p => [p.lng, p.lat]);
    if (mode === 'walk' && draft.length) coords.push([c.lng, c.lat]);
    setSrc('ne-draft', coords.length >= 2 ? [ln(coords)] : []);
    setSrc('ne-draft-pts', draft.map(p => pt(p.lng, p.lat)));
    setSrc('ne-snap', tg ? [pt(tg.lng, tg.lat)] : []);
    if (ui) {
      ui.cross.classList.toggle('snap', !!tg);
      const m = $('neMeters'); if (m && mode === 'walk') m.textContent = draftInfo(c);
    }
  }
  const live = () => { if (!raf) raf = requestAnimationFrame(drawLive); };

  function draftLength(extra) {
    let m = 0;
    for (let i = 1; i < draft.length; i++) m += NC.distance(draft[i - 1], draft[i]);
    if (extra && draft.length) m += NC.distance(draft[draft.length - 1], extra);
    return Math.round(m);
  }
  function draftInfo(c) {
    if (!draft.length) return 'Move the map so + sits on the path start';
    return draft.length + ' point' + (draft.length > 1 ? 's' : '') + ' · ' + draftLength() + ' m' + (c ? ' (+' + Math.round(NC.distance(draft[draft.length - 1], c)) + ' m to +)' : '');
  }

  // ---------------------------------------------------------------- actions
  function addPoint() {
    const tg = target(), c = tg ? { lat: tg.lat, lng: tg.lng } : centerLL();
    const last = draft[draft.length - 1];
    if (last && NC.distance(last, c) < 0.3) { toast('Move the map first'); return; }
    draft.push({ lat: c.lat, lng: c.lng, floor: floorNow(), snap: tg });
    renderSheet(); drawLive();
  }
  function resolve(p) {
    const s = p.snap;
    if (s && s.type === 'node' && coord(s.id)) return s.id;
    if (s && s.type === 'edge' && hasEdge(s.a, s.b)) return splitEdge(s.a, s.b, p);
    return newNode(p, p.floor, 'corridor');
  }
  function commitDraft() {
    if (draft.length < 2) { toast('Add at least 2 points'); return; }
    snapshot();
    const ids = draft.map(resolve);
    for (let i = 1; i < ids.length; i++) addEdge(ids[i - 1], ids[i]);
    const m = draftLength(), n = draft.length;
    draft = [];
    changed(); toast('Walkway added · ' + n + ' points · ' + m + ' m', 'success');
  }
  function undo() {
    if (draft.length) { draft.pop(); renderSheet(); drawLive(); return; }
    if (!history.length) { toast('Nothing to undo'); return; }
    setData(JSON.parse(history.pop())); sel = null; changed();
  }
  function placeDoor() {
    const tg = target(), f = floorNow();
    snapshot();
    let id;
    const props = { name: form.dName.trim() || undefined, placeId: form.dPlace || undefined };
    if (!props.name && form.dPlace) { const pl = places().find(p => String(p.id) === String(form.dPlace)); if (pl) props.name = pl.name; }
    if (tg && tg.type === 'node' && tg.manual && data.nodes[tg.id]) {      // turn an existing point into a door
      id = tg.id; Object.assign(data.nodes[id], props, { type: form.dType });
    } else {
      id = newNode(tg ? tg : centerLL(), f, form.dType, props);
    }
    const onWalkway = tg && tg.type === 'node' && tg.manual;
    const linked = onWalkway ? null : connectTo(id, f);
    sel = { kind: 'node', id };
    changed();
    toast(onWalkway ? 'Point turned into a door' : linked != null ? 'Door placed · linked to walkway (' + linked + ' m)' : 'Door placed — draw a walkway to it', onWalkway || linked != null ? 'success' : 'info');
  }
  function placeStairs() {
    const floors = (form.vFloors || [1, 2]).slice().sort((a, b) => a - b);
    if (floors.length < 2) { toast('Tick at least two floors'); return; }
    const tg = target(), ll = tg ? { lat: tg.lat, lng: tg.lng } : centerLL();
    snapshot();
    const type = form.vKind;
    const ids = floors.map(fl => newNode(ll, fl, type, { name: form.vName.trim() || undefined }));
    data.transitions.push({ id: 't_' + uid(), type: type === 'elevator' ? 'elevator' : 'staircase', nodes: ids });
    let linkedFloors = 0;
    ids.forEach((id, i) => { if (connectTo(id, floors[i]) != null) linkedFloors++; });
    const mine = ids[floors.indexOf(floorNow())] || ids[0];
    sel = { kind: 'node', id: mine };
    changed();
    toast((type === 'elevator' ? 'Lift' : 'Stairs') + ' placed on floors ' + floors.join(', ') + (linkedFloors < floors.length ? ' — draw walkways to it on the other floors' : ' · linked on every floor'), 'success');
  }
  function tapSelect(pxPt) {
    const f = floorNow(), map = mapObj();
    let node = null, nd = 24;
    Object.keys(data.nodes).forEach(id => {
      const n = data.nodes[id]; if ((n.floor || 1) !== f) return;
      const p = map.project([n.lng, n.lat]); const d = Math.hypot(p.x - pxPt.x, p.y - pxPt.y);
      if (d < nd) { nd = d; node = id; }
    });
    if (node) { sel = { kind: 'node', id: node }; }
    else {
      let be = null, bd = 14;
      data.edges.forEach(e => {
        const A = coord(e.from), B = coord(e.to); if (!A || !B || (A.floor || 1) !== f || !data.nodes[e.from] && !data.nodes[e.to]) return;
        const d = distPx(pxPt, map.project([A.lng, A.lat]), map.project([B.lng, B.lat]));
        if (d < bd) { bd = d; be = e; }
      });
      sel = be ? { kind: 'edge', a: be.from, b: be.to } : null;
    }
    renderAll();
  }
  function moveSelected() {
    if (!sel || sel.kind !== 'node' || !data.nodes[sel.id]) return;
    snapshot();
    const c = centerLL(), n = data.nodes[sel.id];
    n.lat = c.lat; n.lng = c.lng;
    // keep stairs/lift columns lined up on every floor
    data.transitions.forEach(t => { if (t.nodes.includes(sel.id)) t.nodes.forEach(o => { if (data.nodes[o]) { data.nodes[o].lat = c.lat; data.nodes[o].lng = c.lng; } }); });
    changed();
  }
  function deleteSelected() {
    if (!sel) return;
    snapshot();
    if (sel.kind === 'node') deleteNode(sel.id); else removeEdge(sel.a, sel.b);
    sel = null; changed();
  }

  // ---------------------------------------------------------------- UI
  const places = () => (typeof allPlaces !== 'undefined' && Array.isArray(allPlaces) ? allPlaces : []);
  const ic = n => '<span class="material-symbols-rounded">' + n + '</span>';

  function buildUI() {
    if (ui) return;
    const root = document.createElement('div'); root.className = 'ne-ui'; root.id = 'neUI'; root.hidden = true;
    root.innerHTML =
      '<div class="ne-top">' +
      '<button class="ne-round" id="neClose" aria-label="Close editor">' + ic('close') + '</button>' +
      '<button class="ne-pill ne-floorbtn" id="neFloorBtn" aria-haspopup="listbox" aria-expanded="false">' + ic('layers') + '<span id="neFloorTxt">Floor 1</span>' + ic('arrow_drop_down') + '</button>' +
      '<div class="ne-floors" id="neFloors" role="listbox" aria-label="Floor" hidden></div>' +
      '<button class="ne-pill primary" id="neSave"><span class="ne-dot" id="neDot"></span>Save</button>' +
      '<button class="ne-round" id="neMore" aria-label="More" aria-expanded="false">' + ic('more_vert') + '</button>' +
      '<div class="ne-menu" id="neMenu" hidden>' +
      '<button id="neExport">' + ic('download') + 'Export JSON</button>' +
      '<button id="neImport">' + ic('upload') + 'Import JSON</button>' +
      '<button id="neClear" class="danger">' + ic('delete_sweep') + 'Delete all my walkways</button>' +
      '<div class="ne-menu-note" id="neCounts"></div></div>' +
      '<input type="file" id="neFile" accept="application/json,.json" hidden></div>' +
      '<div class="ne-cross" id="neCross" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="ring" cx="24" cy="24" r="17"/><path class="tick" d="M24 3v10M24 35v10M3 24h10M35 24h10"/><circle class="dotc" cx="24" cy="24" r="3.2"/></svg></div>' +
      '<div class="ne-fabs" id="neFabs"><button class="ne-pill" id="neUndo">' + ic('undo') + 'Undo</button>' +
      '<button class="ne-pill" id="neAdd">' + ic('add_circle') + 'Add point</button></div>' +
      '<div class="ne-sheet" id="neSheet"><div class="ne-grab"></div>' +
      '<div class="ne-tabs" id="neTabs" role="tablist">' + MODES.map(m => '<button role="tab" data-mode="' + m.id + '">' + ic(m.icon) + '<span>' + m.label + '</span></button>').join('') + '</div>' +
      '<div class="ne-body" id="neBody"></div></div>';
    document.body.appendChild(root);
    ui = { root, cross: $('neCross'), sheet: $('neSheet') };

    $('neClose').onclick = closeEditor;
    $('neSave').onclick = saveServer;
    $('neUndo').onclick = undo;
    $('neAdd').onclick = addPoint;
    $('neMore').onclick = () => { const m = $('neMenu'); m.hidden = !m.hidden; $('neMore').setAttribute('aria-expanded', String(!m.hidden)); };
    $('neExport').onclick = () => { $('neMenu').hidden = true; exportJson(); };
    $('neImport').onclick = () => { $('neMenu').hidden = true; $('neFile').click(); };
    $('neFile').onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };
    $('neClear').onclick = () => {
      $('neMenu').hidden = true;
      if (!confirm('Delete every walkway you have drawn? (360° pins are not touched.) You can still press Undo.')) return;
      snapshot(); setData({ autoFromPins: data.autoFromPins }); sel = null; draft = []; changed();
    };
    $('neTabs').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
    $('neFloorBtn').onclick = () => { const l = $('neFloors'); l.hidden = !l.hidden; $('neFloorBtn').setAttribute('aria-expanded', String(!l.hidden)); };
    $('neFloors').addEventListener('click', e => {
      const b = e.target.closest('button[data-f]'); if (!b) return;
      $('neFloors').hidden = true; $('neFloorBtn').setAttribute('aria-expanded', 'false');
      if (typeof switchFloor === 'function') switchFloor(+b.dataset.f - 1);
    });
    if (window.ResizeObserver) new ResizeObserver(() => syncSheetHeight()).observe(ui.sheet);
  }
  function syncSheetHeight() { if (ui) document.documentElement.style.setProperty('--ne-sheet-h', ui.sheet.offsetHeight + 'px'); }

  function renderFloors() {
    const box = $('neFloors'); if (!box) return;
    const f = floorNow(); let h = '';
    for (let i = 1; i <= nFloors(); i++) h += '<button role="option" data-f="' + i + '" aria-selected="' + (i === f) + '" class="' + (i === f ? 'on' : '') + '">Floor ' + i + '</button>';
    box.innerHTML = h;
    const t = $('neFloorTxt'); if (t) t.textContent = 'Floor ' + f;
  }

  function placeOptions(selected) {
    return '<option value="">— none —</option>' + places().map(p => '<option value="' + esc(p.id) + '"' + (String(p.id) === String(selected) ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  }

  function renderSheet() {
    if (!ui) return;
    $('neTabs').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-selected', String(b.dataset.mode === mode)); });
    $('neAdd').hidden = mode !== 'walk';
    const undoBtn = $('neUndo'); if (undoBtn) undoBtn.disabled = !draft.length && !history.length;
    const body = $('neBody'); let h = '';
    if (mode === 'walk') {
      h = '<div class="ne-title">Draw a walkway</div>' +
        '<p class="ne-sub" id="neMeters">' + esc(draftInfo()) + '</p>' +
        '<p class="ne-tip">Pan the map so the <b>+</b> is on the corridor, tap <b>Add point</b>. The + turns green when it snaps to an existing point or line, so lines join up.</p>' +
        '<button class="ne-main" id="neNext"' + (draft.length < 2 ? ' disabled' : '') + '>Next</button>';
    } else if (mode === 'door') {
      h = '<div class="ne-title">Add a door</div><p class="ne-tip">Put the <b>+</b> on the doorway. It links itself to the nearest walkway (within ' + CONNECT_M + ' m). Put the + on an existing walkway point to turn it into a door.</p>' +
        '<div class="ne-field"><label for="neDType">Type</label><select id="neDType"><option value="door"' + (form.dType === 'door' ? ' selected' : '') + '>Room door</option><option value="entrance"' + (form.dType === 'entrance' ? ' selected' : '') + '>Building entrance</option></select></div>' +
        '<div class="ne-field"><label for="neDPlace">Place</label><select id="neDPlace">' + placeOptions(form.dPlace) + '</select></div>' +
        '<div class="ne-field"><label for="neDName">Name</label><input id="neDName" placeholder="Optional" value="' + esc(form.dName) + '"></div>' +
        '<button class="ne-main" id="neGo">Place door here</button>';
    } else if (mode === 'stairs') {
      const fl = form.vFloors || (form.vFloors = [1, 2]);
      let chips = ''; for (let i = 1; i <= nFloors(); i++) chips += '<label class="ne-chk"><input type="checkbox" value="' + i + '"' + (fl.includes(i) ? ' checked' : '') + '><span>' + i + '</span></label>';
      h = '<div class="ne-title">Add stairs or lift</div><p class="ne-tip">Tick every floor it reaches, put the <b>+</b> on it and tap Place. Each floor links to the nearest walkway.</p>' +
        '<div class="ne-field"><label for="neVKind">Kind</label><select id="neVKind"><option value="stairs"' + (form.vKind === 'stairs' ? ' selected' : '') + '>Stairs</option><option value="elevator"' + (form.vKind === 'elevator' ? ' selected' : '') + '>Lift</option></select></div>' +
        '<div class="ne-field"><label for="neVName">Name</label><input id="neVName" placeholder="e.g. Stairs A" value="' + esc(form.vName) + '"></div>' +
        '<div class="ne-field"><label>Floors</label><div class="ne-chks" id="neVFloors">' + chips + '</div></div>' +
        '<button class="ne-main" id="neGo">Place here</button>';
    } else {
      h = editHtml();
    }
    body.innerHTML = h;
    wireBody();
    syncSheetHeight();
  }

  function editHtml() {
    if (sel && sel.kind === 'node' && data.nodes[sel.id]) {
      const n = data.nodes[sel.id], isDoor = n.type === 'door' || n.type === 'entrance';
      return '<div class="ne-title">Point</div>' +
        '<div class="ne-field"><label for="neEName">Name</label><input id="neEName" value="' + esc(n.name) + '" placeholder="Optional"></div>' +
        '<div class="ne-field"><label for="neEType">Type</label><select id="neEType">' + ['corridor', 'door', 'entrance', 'stairs', 'elevator'].map(t => '<option' + (t === (n.type || 'corridor') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
        (isDoor ? '<div class="ne-field"><label for="neEPlace">Place</label><select id="neEPlace">' + placeOptions(n.placeId) + '</select></div>' : '') +
        '<div class="ne-row2"><button class="ne-sec" id="neMove">' + ic('my_location') + 'Move to +</button><button class="ne-sec danger" id="neDel">' + ic('delete') + 'Delete</button></div>';
    }
    if (sel && sel.kind === 'edge') {
      const a = coord(sel.a), b = coord(sel.b);
      return '<div class="ne-title">Walkway line</div><p class="ne-sub">' + (a && b ? Math.round(NC.distance(a, b)) + ' m' : '') + '</p>' +
        '<div class="ne-row2"><button class="ne-sec danger" id="neDel">' + ic('delete') + 'Delete line</button></div>';
    }
    return '<div class="ne-title">Edit</div><p class="ne-tip">Tap a point or a line on the map to select it. Stairs and lifts move together on all floors.</p><p class="ne-sub">' + esc(counts()) + '</p>';
  }

  function wireBody() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
    on('neNext', 'onclick', commitDraft);
    on('neGo', 'onclick', () => (mode === 'door' ? placeDoor() : placeStairs()));
    on('neDType', 'onchange', e => { form.dType = e.target.value; });
    on('neDPlace', 'onchange', e => { form.dPlace = e.target.value; });
    on('neDName', 'oninput', e => { form.dName = e.target.value; });
    on('neVKind', 'onchange', e => { form.vKind = e.target.value; });
    on('neVName', 'oninput', e => { form.vName = e.target.value; });
    const vf = $('neVFloors');
    if (vf) vf.onchange = () => { form.vFloors = Array.from(vf.querySelectorAll('input:checked')).map(i => +i.value); };
    on('neMove', 'onclick', moveSelected);
    on('neDel', 'onclick', deleteSelected);
    const n = sel && sel.kind === 'node' && data.nodes[sel.id];
    if (n) {
      on('neEName', 'oninput', e => { n.name = e.target.value || undefined; lsSet('dev_navgraph', JSON.stringify(data)); dirty = true; });
      on('neEName', 'onchange', () => { snapshot(); changed(); });
      on('neEType', 'onchange', e => { snapshot(); n.type = e.target.value; if (n.type !== 'door' && n.type !== 'entrance') delete n.placeId; changed(); });
      on('neEPlace', 'onchange', e => {
        snapshot();
        if (e.target.value) { n.placeId = e.target.value; const p = places().find(x => String(x.id) === e.target.value); if (p && !n.name) n.name = p.name; } else delete n.placeId;
        changed();
      });
    }
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m; draft = []; sel = null;
    ui.root.dataset.mode = m;
    renderAll();
  }

  function renderAll() {
    if (!isOpen || !ui) return;
    if (ensureLayers()) { drawData(); drawLive(); }
    renderFloors(); renderSheet();
    ui.root.classList.toggle('has-sel', !!sel && sel.kind === 'node');
    const dot = $('neDot'); if (dot) dot.hidden = !dirty;
    const c = $('neCounts'); if (c) c.textContent = counts() + (savedNote ? ' · ' + savedNote : '');
    const s = $('neSave'); if (s) s.title = savedNote || (dirty ? 'Unsaved changes' : 'Saved');
  }

  // ---------------------------------------------------------------- map input
  function onClick(e) {
    if (!isOpen) return;
    if (e.target.closest && e.target.closest('.maplibregl-ctrl, .gps-btn, .layer-switcher')) return;
    e.stopPropagation(); e.preventDefault();                  // keep place polygons/pins from opening while drawing
    if (mode !== 'edit') return;
    const r = mapObj().getContainer().getBoundingClientRect();
    tapSelect({ x: e.clientX - r.left, y: e.clientY - r.top });
  }
  function onKey(e) {
    if (!isOpen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
    if (e.key === 'Enter' && mode === 'walk') { e.preventDefault(); addPoint(); }
    else if (e.key === 'Enter' && draft.length >= 2) commitDraft();
    else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undo(); }
    else if (e.key === 'Delete' && sel) deleteSelected();
    else if (e.key === 'Escape') { if (draft.length) { draft = []; renderSheet(); drawLive(); } else if (sel) { sel = null; renderAll(); } }
  }

  async function openEditor() {
    if (isOpen) return;
    const map = mapObj(); if (!map || !NS()) return;
    if (typeof closeAllSidebars === 'function') closeAllSidebars();
    try { if (NS().S.mode !== 'idle') NS().end(); } catch (e) { /* ignore */ }
    try { document.getElementById('devPanel') && document.getElementById('devPanel').classList.add('hidden'); } catch (e) { /* ignore */ }
    await loadData();
    await NS().reloadGraph();                           // fresh pin skeleton to draw next to
    buildUI();
    isOpen = true; draft = []; sel = null; history = []; mode = 'walk';
    ui.root.hidden = false; ui.root.dataset.mode = mode;
    document.body.classList.add('ne-active');
    map.getContainer().addEventListener('click', onClick, true);
    map.on('move', live); map.on('moveend', live);
    document.addEventListener('keydown', onKey);
    map.doubleClickZoom.disable();
    // helpful starting view: where the pins are
    const g = graph(); let focus = null;
    if (g) g.nodes.forEach(n => { if (!focus && n.source === 'pin') focus = n; });
    if (focus && Object.keys(data.nodes).length === 0) map.jumpTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 19.5) });
    if (NS().setNetworkVisible) NS().setNetworkVisible(false);       // the editor draws its own lines
    ensureLayers();
    renderAll();
    setTimeout(() => { map.resize(); renderAll(); }, 60);
  }

  function closeEditor() {
    if (!isOpen) return;
    if (draft.length && !confirm('Discard the unfinished line?')) return;
    isOpen = false; draft = []; sel = null;
    ui.root.hidden = true; $('neMenu').hidden = true;
    document.body.classList.remove('ne-active');
    const map = mapObj();
    map.getContainer().removeEventListener('click', onClick, true);
    map.off('move', live); map.off('moveend', live);
    document.removeEventListener('keydown', onKey);
    map.doubleClickZoom.enable();
    ['ne-nodes', 'ne-edges', 'ne-pin-nodes', 'ne-pin-edges', 'ne-sel', 'ne-draft', 'ne-draft-pts', 'ne-snap'].forEach(id => { if (map.getSource(id)) map.getSource(id).setData(EMPTY); });
    document.documentElement.style.removeProperty('--ne-sheet-h');
    if (NS() && NS().setNetworkVisible) { NS().setNetworkVisible(true); NS().reloadGraph().then(() => NS().refreshNetwork && NS().refreshNetwork()); }
    if (dirty) toast('Draft kept. Press Save inside the editor to publish it.');
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    if (!mapObj() || !NS()) { setTimeout(boot, 200); return; }
    const orig = window.switchFloor;
    if (typeof orig === 'function' && !orig.__neHooked) {
      const hooked = function () { const r = orig.apply(this, arguments); if (isOpen) { draft = []; sel = null; renderAll(); } return r; };
      hooked.__neHooked = true; hooked.__navHooked = orig.__navHooked; window.switchFloor = hooked;
    }
    fetch('config.json').then(r => r.json()).then(cfg => {
      if (!cfg.devMode) return;
      const btn = $('navEditorBtn');
      if (btn) { btn.style.display = ''; btn.addEventListener('click', () => { openEditor(); }); }
      document.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyW') { e.preventDefault(); isOpen ? closeEditor() : openEditor(); } });
    }).catch(() => { });
    window.NavEditor = {
      open: openEditor, close: closeEditor, setMode, addPoint, commit: commitDraft, undo, placeDoor, placeStairs,
      get data() { return data; }, get draft() { return draft; }, get isOpen() { return isOpen; }, get dirty() { return dirty; },
      counts: () => (data ? counts() : '')
    };
    document.dispatchEvent(new Event('navEditorReady'));
  }
  boot();
}());
