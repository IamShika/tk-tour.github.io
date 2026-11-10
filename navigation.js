// =================== NAVIGATION (GPS + routing UI) ===================
// Loaded after script.js. Uses nav-core.js for the routing maths and talks to MapLibre directly
// (the Leaflet-compat shim can't update circles/markers reliably).
//
//   window.NavSystem            public API (navigateTo, openPicker, end, tracker, reloadGraph, ...)
//   navigationController        legacy facade used by script.js (isNavigating, currentDestinationId,
//                               navigateToLocation)
//
// Floors: nav-core is 1-indexed, script.js `currentFloor` is 0-indexed. The floor selected on the map
// is treated as "the floor the user is on" (GPS cannot tell floors apart).
(function () {
  'use strict';
  const NC = window.NavCore;
  if (!NC) { console.error('[Nav] nav-core.js must be loaded before navigation.js'); return; }

  const $ = id => document.getElementById(id);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, type, o) => { if (typeof showToast === 'function') showToast(msg, type || 'info', o); else console.log('[toast]', msg); };

  function tr(key, params) {
    let s = typeof t === 'function' ? t(key) : key;
    if (params) Object.keys(params).forEach(k => { s = s.split('{' + k + '}').join(params[k]); });
    return s;
  }

  const SPEEDUP_DEMO = 5;          // m/s for the demo walker
  const ARROW_ID = 'nav-arrow';
  const SRC_ROUTE = 'nav-route-src', SRC_ACC = 'nav-accuracy-src';
  const EMPTY = { type: 'FeatureCollection', features: [] };

  // ------------------------------------------------------------------ helpers
  const userFloor = () => (typeof currentFloor === 'number' ? currentFloor : 0) + 1;
  const floorCount = () => (typeof FLOORS !== 'undefined' ? FLOORS.length : 6);
  const mapObj = () => (window.mapEngine && window.mapEngine.map) || null;

  function fmtDist(m) {
    m = Math.max(0, m);
    if (m >= 1000) return (m / 1000).toFixed(1) + ' ' + tr('nav_km');
    const r = m < 20 ? Math.round(m) : Math.round(m / 5) * 5;
    return r + ' ' + tr('nav_m');
  }
  function fmtTime(sec) { return Math.max(1, Math.round(sec / 60)) + ' ' + tr('nav_min'); }
  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const dirWord = h => tr('nav_dir_' + DIRS[Math.round(((h % 360) + 360) % 360 / 45) % 8]);

  const TURN_ICON = { left: 'turn_left', right: 'turn_right', slight_left: 'turn_slight_left', slight_right: 'turn_slight_right', sharp_left: 'turn_sharp_left', sharp_right: 'turn_sharp_right', uturn: 'u_turn_left' };

  function describeStep(step, route) {
    switch (step.type) {
      case 'head': return { icon: 'navigation', text: tr('nav_head', { dir: dirWord(step.heading || 0) }) };
      case 'turn': return { icon: TURN_ICON[step.dir] || 'straight', text: tr('nav_turn_' + step.dir) };
      case 'vertical': return {
        icon: step.kind === 'elevator' ? 'elevator' : 'stairs',
        text: tr('nav_' + (step.kind === 'elevator' ? 'elevator' : 'stairs') + '_' + (step.up ? 'up' : 'down'), { floor: step.toFloor })
      };
      default: {
        const name = (S.dest && S.dest.name) || '';
        return { icon: 'flag', text: name ? tr('nav_arrive', { name }) : tr('nav_arrive_plain') };
      }
    }
  }

  // ------------------------------------------------------------------ campus bounds
  let CAMPUS = null;                       // {s,w,n,e}
  function loadCampus() {
    const fromFloors = () => { try { const b = FLOORS[0].bounds; return { s: Math.min(b[0][0], b[1][0]), n: Math.max(b[0][0], b[1][0]), w: Math.min(b[0][1], b[1][1]), e: Math.max(b[0][1], b[1][1]) }; } catch (e) { return null; } };
    CAMPUS = fromFloors();
    fetch('data/config.json').then(r => r.json()).then(c => {
      const b = c && c.school && c.school.bounds;
      if (b) CAMPUS = { s: Math.min(b[0][0], b[1][0]), n: Math.max(b[0][0], b[1][0]), w: Math.min(b[0][1], b[1][1]), e: Math.max(b[0][1], b[1][1]) };
    }).catch(() => { });
  }
  function inCampus(p, margin) {
    if (!CAMPUS) return true;
    const m = margin != null ? margin : 0.0015;       // ≈160 m: GPS drift + the street outside the gate
    return p.lat >= CAMPUS.s - m && p.lat <= CAMPUS.n + m && p.lng >= CAMPUS.w - m && p.lng <= CAMPUS.e + m;
  }

  // ------------------------------------------------------------------ GPS tracker
  class GPSTracker {
    constructor() {
      this.watchId = null; this.pos = null; this.manual = false;
      this.listeners = []; this._waiters = [];
      this._k = null; this._anchor = null; this._motionHeading = null;
      this.compass = null; this._compassOn = false; this._lastCompassEmit = 0;
    }
    get active() { return this.watchId !== null || this.manual || (this.pos && this.pos.source === 'sim'); }
    get tracking() { return this.watchId !== null; }
    on(fn) { this.listeners.push(fn); }
    _emit(ev) { this.listeners.forEach(fn => { try { fn(ev, this.pos); } catch (e) { console.error('[GPS] listener', e); } }); }

    /** Resolves with the first fix, rejects with {code:'denied'|'unsupported'|'outside'|'timeout'}. */
    start() {
      return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject({ code: 'unsupported' });
        this.manual = false;
        if (this.watchId !== null) {
          if (this.pos && this.pos.source === 'gps') return resolve(this.pos);
          this._waiters.push({ resolve, reject }); return;
        }
        this._waiters = [{ resolve, reject }];
        this._requestCompass();
        this.watchId = navigator.geolocation.watchPosition(p => this._onFix(p), e => this._onError(e), { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
        this._emit('status');
      });
    }

    stop() {
      if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null; this.manual = false; this.pos = null; this._k = null; this._anchor = null; this._motionHeading = null;
      const w = this._waiters; this._waiters = []; w.forEach(x => x.reject({ code: 'stopped' }));
      this._emit('status');
    }

    setManual(lat, lng) {
      if (this.watchId !== null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
      this.manual = true; this._k = null;
      this.pos = { lat, lng, accuracy: 0, heading: null, source: 'manual', ts: Date.now() };
      this._emit('position');
    }

    inject(p) {                              // demo walker
      this.pos = Object.assign({ accuracy: 5, heading: null, source: 'sim', ts: Date.now() }, p);
      this._emit('position');
    }

    get heading() { return this.compass != null ? this.compass : (this.pos ? this.pos.heading : null); }

    _onError(e) {
      if (e && e.code === 1) {                       // PERMISSION_DENIED
        const w = this._waiters; this._waiters = [];
        this.stop(); w.forEach(x => x.reject({ code: 'denied' }));
        this._emit({ type: 'error', code: 'denied' });
      } else {
        this._emit({ type: 'error', code: e && e.code === 3 ? 'timeout' : 'unavailable' });   // transient: keep watching
      }
    }

    _onFix(p) {
      const c = p.coords;
      const raw = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy || 25, speed: c.speed, heading: c.heading, ts: p.timestamp || Date.now() };
      if (!inCampus(raw)) {
        const w = this._waiters; this._waiters = [];
        this.stop(); w.forEach(x => x.reject({ code: 'outside' }));
        this._emit({ type: 'error', code: 'outside' });
        return;
      }
      if (raw.accuracy > 300) { this._emit({ type: 'error', code: 'poor' }); return; }   // IP/cell-tower guess, useless indoors

      // 1-D Kalman per axis: weights each fix by its reported accuracy, so a jittery indoor fix moves the dot less
      const a = Math.max(3, raw.accuracy), k = this._k;
      if (!k || raw.ts - k.ts > 20000 || NC.distance(k, raw) > Math.max(25, raw.accuracy * 3)) this._k = { lat: raw.lat, lng: raw.lng, v: a * a, ts: raw.ts };
      else {
        const dt = Math.max(0, (raw.ts - k.ts) / 1000), v = k.v + dt * 3, K = v / (v + a * a);
        this._k = { lat: k.lat + K * (raw.lat - k.lat), lng: k.lng + K * (raw.lng - k.lng), v: (1 - K) * v, ts: raw.ts };
      }
      const here = { lat: this._k.lat, lng: this._k.lng };

      if (isFinite(raw.heading) && raw.speed > 0.7) this._motionHeading = raw.heading;
      else if (!this._anchor) this._anchor = here;
      else if (NC.distance(this._anchor, here) >= 4) { this._motionHeading = NC.bearing(this._anchor, here); this._anchor = here; }

      this.pos = { lat: here.lat, lng: here.lng, accuracy: raw.accuracy, heading: this._motionHeading, source: 'gps', ts: raw.ts };
      const w = this._waiters; this._waiters = []; w.forEach(x => x.resolve(this.pos));
      this._emit('position');
    }

    _requestCompass() {
      if (this._compassOn) return;
      try {
        const DOE = window.DeviceOrientationEvent;
        const attach = () => {
          if (this._compassOn) return;
          this._compassOn = true;
          const h = e => {
            let hd = null;
            if (typeof e.webkitCompassHeading === 'number') hd = e.webkitCompassHeading;
            else if (e.absolute && typeof e.alpha === 'number') hd = (360 - e.alpha) % 360;
            if (hd == null || isNaN(hd)) return;
            hd = (hd + ((screen.orientation && screen.orientation.angle) || 0) + 360) % 360;
            this.compass = this.compass == null ? hd : (this.compass + NC.angleDiff(this.compass, hd) * 0.25 + 360) % 360;
            const now = Date.now();
            if (now - this._lastCompassEmit > 120) { this._lastCompassEmit = now; this._emit('heading'); }
          };
          window.addEventListener('deviceorientationabsolute', h, true);
          window.addEventListener('deviceorientation', h, true);
        };
        if (DOE && typeof DOE.requestPermission === 'function') DOE.requestPermission().then(r => { if (r === 'granted') attach(); }).catch(() => { });
        else if (DOE) attach();
      } catch (e) { /* no compass: heading falls back to GPS motion */ }
    }
  }

  // ------------------------------------------------------------------ state
  const tracker = new GPSTracker();
  const S = {
    mode: 'idle',                 // idle | preview | navigating | arrived
    route: null, rp: null, dest: null, start: null,
    accessible: lsGet('nav_accessible') === '1', voice: lsGet('nav_voice') === '1',
    follow: false, graph: null, graphPins: -1,
    lastReroute: 0, manualStepUntil: 0, lastRenderedStep: -2, lastDrawnProgress: -99, spokenStep: -1,
    baseNotice: null, dynNotice: null, sim: null, wakeLock: null, lastPos: null, cancelPick: null,
    markers: { user: null, dest: null, vertical: [] }, layersReady: false, busy: false
  };

  // ------------------------------------------------------------------ graph loading
  let graphPromise = null;
  function ensureGraph(force) {
    const pinCount = (typeof allPins !== 'undefined' && allPins) ? allPins.length : 0;
    if (!graphPromise || force || (pinCount && pinCount !== S.graphPins)) graphPromise = buildGraph();
    return graphPromise;
  }
  async function buildGraph() {
    let manual = null;
    try { if (window.devMode) { const d = lsGet('dev_navgraph'); if (d) manual = JSON.parse(d); } } catch (e) { /* corrupt draft */ }
    if (!manual) {
      for (const url of ['/get_navgraph', 'data/navgraph.json']) {
        try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && typeof j === 'object') { manual = j; break; } } } catch (e) { /* try next */ }
      }
    }
    let pins = (typeof allPins !== 'undefined' && allPins && allPins.length) ? allPins : null;
    if (!pins) { try { const r = await fetch('data/pins.json'); pins = r.ok ? await r.json() : []; } catch (e) { pins = []; } }
    const g = NC.NavGraph.build({ manual, pins });
    S.graph = g; S.graphPins = pins.length;
    console.log('[Nav] graph:', g.nodes.size, 'nodes,', g.edges.length, 'edges,', g.transitions.length, 'transitions', g.stats);
    return g;
  }

  // ------------------------------------------------------------------ destination / start normalisation
  /** Accepts a search result, a place, a pin or a bare point; returns {name,lat,lng,floor,placeId,coords,id}. */
  function normalizeDest(raw, refFloor) {
    const d = { name: raw.name || '', id: raw.id, lat: raw.lat, lng: raw.lng, placeId: null, coords: null, floor: null };
    let place = null;
    if (raw.coords && raw.coords.length >= 3) place = raw;
    else if (raw.type === 'place' && typeof allPlaces !== 'undefined') place = allPlaces.find(p => p.id === raw.id) || null;
    if (place && place.coords && place.coords.length >= 3) {
      const c = NC.polygonCentroid(place.coords);
      d.coords = place.coords; d.lat = c.lat; d.lng = c.lng; d.placeId = place.id; d.name = d.name || place.name;
    }
    let f = raw.floor !== undefined ? raw.floor : (place ? place.floor : undefined);
    if (raw.type === 'pin' && !Array.isArray(f)) f = (Number(f) || 0) + 1;          // pins are 0-indexed, everything else is a floor number
    if (Array.isArray(f)) {
      if (f.includes('all')) f = null;
      else { const nums = f.map(Number).filter(n => n >= 1); f = !nums.length ? null : nums.includes(refFloor) ? refFloor : Math.min(...nums); }
    } else if (f === 'all' || f == null || !(Number(f) >= 1)) f = null;
    else f = Number(f);
    d.floor = f == null ? refFloor : Math.min(f, floorCount());
    return d;
  }

  // ------------------------------------------------------------------ routing
  async function computeRoute(start, dest) {
    const g = await ensureGraph();
    const end = { lat: dest.lat, lng: dest.lng, floor: dest.floor, name: dest.name, placeId: dest.placeId };
    let route = g.findRoute(start, end, { accessible: S.accessible });
    let notice = null;
    if (!route) {
      if (S.accessible && g.findRoute(start, end, {})) return { error: tr('nav_noAccessible') };
      if (start.floor === end.floor) { route = NC.directRoute(start, end); notice = tr('nav_approx'); }
      else return { error: tr('nav_noRouteFloor', { a: start.floor, b: end.floor }) };
    }
    return route ? { route, notice } : { error: tr('nav_noRoute') };
  }

  // ------------------------------------------------------------------ map layers
  function arrowImage() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.lineCap = x.lineJoin = 'round';
    x.beginPath(); x.moveTo(10, 8); x.lineTo(22, 16); x.lineTo(10, 24);      // chevron pointing right (= along the line)
    x.strokeStyle = 'rgba(0,0,0,0.0)'; x.lineWidth = 0;
    x.strokeStyle = '#ffffff'; x.lineWidth = 4.5; x.stroke();
    return x.getImageData(0, 0, 32, 32);
  }

  function ensureLayers() {
    const map = mapObj();
    if (!map) return false;
    if (S.layersReady && map.getSource(SRC_ROUTE)) return true;
    try {
      if (!map.getStyle()) return false;
      if (!map.hasImage(ARROW_ID)) map.addImage(ARROW_ID, arrowImage(), { pixelRatio: 2 });
      if (!map.getSource(SRC_ACC)) {
        map.addSource(SRC_ACC, { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'nav-accuracy-fill', type: 'fill', source: SRC_ACC, paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.13 } });
        map.addLayer({ id: 'nav-accuracy-line', type: 'line', source: SRC_ACC, paint: { 'line-color': '#1a73e8', 'line-opacity': 0.35, 'line-width': 1 } });
      }
      if (!map.getSource(SRC_ROUTE)) {
        map.addSource(SRC_ROUTE, { type: 'geojson', data: EMPTY });
        const round = { 'line-cap': 'round', 'line-join': 'round' };
        map.addLayer({ id: 'nav-route-casing', type: 'line', source: SRC_ROUTE, layout: round, paint: { 'line-color': '#ffffff', 'line-width': 11, 'line-opacity': 0.95 } });
        map.addLayer({ id: 'nav-route-passed', type: 'line', source: SRC_ROUTE, layout: round, paint: { 'line-color': '#9aa0a6', 'line-width': 6, 'line-opacity': 0.9 } });
        map.addLayer({ id: 'nav-route-line', type: 'line', source: SRC_ROUTE, layout: round, paint: { 'line-color': '#1a73e8', 'line-width': 6 } });
        map.addLayer({ id: 'nav-route-connector', type: 'line', source: SRC_ROUTE, layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#1a73e8', 'line-width': 5, 'line-dasharray': [1.2, 1.6] } });
        map.addLayer({ id: 'nav-route-arrows', type: 'symbol', source: SRC_ROUTE, layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': ARROW_ID, 'icon-size': 0.6, 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
      }
      S.layersReady = true;
      applyFloorFilter();
      return true;
    } catch (e) { return false; }
  }

  function applyFloorFilter() {
    const map = mapObj(); if (!map || !S.layersReady) return;
    const f = ['==', ['get', 'floor'], userFloor()];
    const set = (id, extra) => { if (map.getLayer(id)) map.setFilter(id, extra ? ['all', f, extra] : f); };
    set('nav-route-casing', ['==', ['get', 'passed'], false]);
    set('nav-route-passed', ['==', ['get', 'passed'], true]);
    set('nav-route-line', ['all', ['==', ['get', 'passed'], false], ['==', ['get', 'connector'], false]]);
    set('nav-route-connector', ['all', ['==', ['get', 'passed'], false], ['==', ['get', 'connector'], true]]);
    set('nav-route-arrows', ['all', ['==', ['get', 'passed'], false], ['==', ['get', 'connector'], false]]);
    set('nav-accuracy-fill'); set('nav-accuracy-line');
  }

  function bringToFront() {
    const map = mapObj(); if (!map || !S.layersReady) return;
    ['nav-accuracy-fill', 'nav-accuracy-line', 'nav-route-casing', 'nav-route-passed', 'nav-route-line', 'nav-route-connector', 'nav-route-arrows']
      .forEach(id => { if (map.getLayer(id)) map.moveLayer(id); });
  }

  function drawRoute() {
    const map = mapObj();
    if (!ensureLayers()) { setTimeout(drawRoute, 250); return; }
    const src = map.getSource(SRC_ROUTE);
    if (!S.route) { src.setData(EMPTY); return; }
    const progress = S.mode === 'navigating' || S.mode === 'arrived' ? S.rp.progress : null;
    const lines = NC.routeLines(S.route, progress);
    src.setData({
      type: 'FeatureCollection',
      features: lines.map(l => ({ type: 'Feature', properties: { floor: l.floor, passed: l.passed, connector: l.connector }, geometry: { type: 'LineString', coordinates: l.coords } }))
    });
    S.lastDrawnProgress = progress == null ? -99 : progress;
    bringToFront();
  }

  function circlePolygon(lat, lng, r) {
    const pts = [], k = Math.cos(lat * Math.PI / 180);
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * 2 * Math.PI;
      pts.push([lng + (r * Math.cos(a)) / (111320 * k), lat + (r * Math.sin(a)) / 110574]);
    }
    return { type: 'Feature', properties: { floor: userFloor() }, geometry: { type: 'Polygon', coordinates: [pts] } };
  }

  // ------------------------------------------------------------------ markers
  function makeEl(html, cls) { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; return el; }

  function updateUserMarker(pos) {
    const map = mapObj(); if (!map || !window.maplibregl) return;
    if (!pos) { if (S.markers.user) { S.markers.user.remove(); S.markers.user = null; } if (ensureLayers()) map.getSource(SRC_ACC).setData(EMPTY); return; }
    if (!S.markers.user) {
      const el = makeEl('<div class="nav-user-pulse"></div><div class="nav-user-cone"></div><div class="nav-user-dot"></div>', 'nav-user');
      el.setAttribute('aria-label', tr('nav_myLocation'));
      S.markers.user = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([pos.lng, pos.lat]).addTo(map);
    }
    S.markers.user.setLngLat([pos.lng, pos.lat]);
    const el = S.markers.user.getElement();
    el.classList.toggle('manual', pos.source === 'manual');
    const h = tracker.heading;
    const cone = el.querySelector('.nav-user-cone');
    if (h != null && pos.source !== 'manual') { cone.style.display = 'block'; cone.style.transform = 'rotate(' + h + 'deg)'; } else cone.style.display = 'none';
    if (ensureLayers()) map.getSource(SRC_ACC).setData(pos.accuracy > 3 && pos.source !== 'manual' ? circlePolygon(pos.lat, pos.lng, pos.accuracy) : EMPTY);
  }

  function clearRouteMarkers() {
    if (S.markers.dest) { S.markers.dest.remove(); S.markers.dest = null; }
    S.markers.vertical.forEach(m => m.marker.remove()); S.markers.vertical = [];
  }
  function placeRouteMarkers() {
    const map = mapObj(); if (!map || !S.route || !window.maplibregl) return;
    clearRouteMarkers();
    const last = S.dest || S.route.points[S.route.points.length - 1];
    const el = makeEl('<span class="material-symbols-rounded">flag</span>', 'nav-dest-pin');
    S.markers.dest = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([last.lng, last.lat]).addTo(map);
    S.markers.dest._floor = S.route.endFloor;
    S.route.steps.forEach(st => {
      if (st.type !== 'vertical') return;
      const e = makeEl('<span class="material-symbols-rounded">' + (st.kind === 'elevator' ? 'elevator' : 'stairs') + '</span><b>' + (st.toFloor) + '</b>', 'nav-vertical-pin');
      const m = new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat([st.point.lng, st.point.lat]).addTo(map);
      S.markers.vertical.push({ marker: m, floor: st.floor });
    });
    refreshMarkerFloors();
  }
  function refreshMarkerFloors() {
    const f = userFloor();
    if (S.markers.dest) S.markers.dest.getElement().style.display = S.markers.dest._floor === f ? '' : 'none';
    S.markers.vertical.forEach(v => { v.marker.getElement().style.display = v.floor === f ? '' : 'none'; });
  }

  function fitRoute() {
    const map = mapObj(); if (!map || !S.route) return;
    const f = userFloor();
    let pts = S.route.points.filter(p => p.floor === f);
    if (!pts.length) pts = S.route.points;
    let b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    pts.concat(S.dest ? [S.dest] : []).forEach(p => { b[0][0] = Math.min(b[0][0], p.lng); b[0][1] = Math.min(b[0][1], p.lat); b[1][0] = Math.max(b[1][0], p.lng); b[1][1] = Math.max(b[1][1], p.lat); });
    const narrow = window.innerWidth < 700;
    try { maplibregl.Map.prototype.fitBounds.call(map, b, { padding: { top: narrow ? 90 : 110, bottom: narrow ? 300 : 260, left: narrow ? 40 : 80, right: narrow ? 40 : 80 }, maxZoom: 20, duration: 700 }); } catch (e) { /* bad bounds */ }
  }

  // ------------------------------------------------------------------ panel
  const panelEls = () => ({
    panel: $('navigationPanel'), dest: $('navDestination'), dist: $('navDistance'), time: $('navTime'),
    icon: $('navStepIcon'), text: $('navStepInstruction'), stepDist: $('navStepDistance'), list: $('navStepsList'),
    notice: $('navNotice'), start: $('startNavBtn'), end: $('endNavBtn')
  });

  function setPanelHeightVar() {
    const p = $('navigationPanel');
    document.documentElement.style.setProperty('--nav-panel-h', p && p.classList.contains('active') ? p.offsetHeight + 'px' : '0px');
  }

  function showPanel(show) {
    const p = $('navigationPanel'); if (!p) return;
    p.classList.toggle('active', show);
    document.body.classList.toggle('nav-panel-open', show);
    requestAnimationFrame(setPanelHeightVar);
    setTimeout(setPanelHeightVar, 450);
    if (!show) setTimeout(() => { if (!p.classList.contains('active')) { p.classList.remove('steps-open'); setMinimized(false); } }, 450);
  }

  // Collapsed card = just the route header, the current step and the End button, so it covers as little map as possible.
  function setMinimized(min) {
    S.minimized = !!min;
    const p = $('navigationPanel'); if (!p) return;
    p.classList.toggle('min', S.minimized);
    const b = $('navMinBtn');
    if (b) {
      b.setAttribute('aria-expanded', S.minimized ? 'false' : 'true');
      const k = S.minimized ? 'nav_expand' : 'nav_collapse';
      b.title = tr(k); b.setAttribute('aria-label', tr(k));
      const ic = b.querySelector('span'); if (ic) ic.textContent = S.minimized ? 'expand_less' : 'expand_more';
    }
    requestAnimationFrame(setPanelHeightVar); setTimeout(setPanelHeightVar, 350);
  }

  function setNotice() {
    const E = panelEls(); if (!E.notice) return;
    const n = S.dynNotice || S.baseNotice;
    E.notice.hidden = !n;
    E.notice.textContent = n ? n.text : '';
    E.notice.className = 'nav-notice' + (n && n.kind ? ' ' + n.kind : '') + (n && n.onClick ? ' clickable' : '');
    E.notice.onclick = n && n.onClick ? n.onClick : null;
    requestAnimationFrame(setPanelHeightVar);
  }
  const dyn = (text, kind, onClick) => { S.dynNotice = text ? { text, kind, onClick } : null; setNotice(); };

  function renderSteps(activeIdx) {
    const E = panelEls(); if (!E.list || !S.route) return;
    E.list.innerHTML = S.route.steps.map((st, i) => {
      const d = describeStep(st, S.route);
      const dist = st.type === 'arrive' ? '' : (st.type === 'vertical' ? tr('nav_floorShort', { floor: st.toFloor }) : fmtDist(st.distance));
      const cls = i < activeIdx ? 'done' : i === activeIdx ? 'active' : '';
      return '<button type="button" class="nav-step ' + cls + '" data-i="' + i + '"><span class="material-symbols-rounded">' + d.icon + '</span><span class="nav-step-text">' + esc(d.text) + '</span><span class="nav-step-dist">' + esc(dist) + '</span></button>';
    }).join('');
    E.list.querySelectorAll('.nav-step').forEach(b => b.addEventListener('click', () => stepTo(+b.dataset.i)));
    const act = E.list.querySelector('.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
  }

  function renderBanner(u) {
    const E = panelEls(); if (!E.icon || !S.route) return;
    const idx = u ? u.stepIndex : (S.rp ? S.rp.upcomingStep() : 0);
    const st = S.route.steps[idx];
    const d = describeStep(st, S.route);
    E.icon.innerHTML = '<span class="material-symbols-rounded">' + d.icon + '</span>';
    E.text.textContent = S.mode === 'arrived' ? tr('nav_arrived') : d.text;
    let label = '';
    if (S.mode === 'arrived') label = '';
    else if (S.mode === 'preview' || !S.rp) label = st.type === 'arrive' ? '' : fmtDist(st.distance);
    else {
      const dd = Math.max(0, st.cum - S.rp.progress);
      label = st.type === 'vertical' || dd < 4 ? tr('nav_now') : tr('nav_inDistance', { dist: fmtDist(dd) });
      if (st.type === 'head' && S.rp.progress < 4) label = tr('nav_walk', { dist: fmtDist(st.distance) });
    }
    E.stepDist.textContent = label;
    if (idx !== S.lastRenderedStep) { S.lastRenderedStep = idx; renderSteps(idx); }
  }

  function renderStats() {
    const E = panelEls(); if (!E.dist || !S.route) return;
    let rem = S.route.total, secs = S.route.seconds;
    if (S.rp && (S.mode === 'navigating' || S.mode === 'arrived')) { rem = Math.max(0, S.route.total - S.rp.progress); secs = S.mode === 'arrived' ? 0 : S.rp.remainingSeconds(); }
    E.dist.textContent = fmtDist(rem);
    E.time.textContent = fmtTime(secs);
  }

  function renderPanel() {
    const E = panelEls(); if (!E.panel || !S.route) return;
    E.dest.textContent = S.dest ? S.dest.name : '';
    const nav = S.mode === 'navigating' || S.mode === 'arrived';
    E.start.style.display = S.mode === 'preview' ? '' : 'none';
    E.start.textContent = tr('nav_start');
    E.end.style.display = nav ? '' : 'none';
    E.end.textContent = S.mode === 'arrived' ? tr('nav_close') : tr('nav_end');
    $('navTools').style.display = nav ? '' : 'none';
    const demoBtn = $('navDemoBtn'); if (demoBtn) demoBtn.style.display = window.devMode ? '' : 'none';
    $('navVoiceBtn').classList.toggle('on', S.voice);
    $('navVoiceBtn').querySelector('span').textContent = S.voice ? 'volume_up' : 'volume_off';
    $('navAccessBtn').classList.toggle('on', S.accessible);
    S.lastRenderedStep = -2;
    renderStats(); renderBanner(null); setNotice();
    updateStaticLabels();
  }

  function updateStaticLabels() {
    const set = (id, key) => { const el = $(id); if (el) { el.title = tr(key); el.setAttribute('aria-label', tr(key)); } };
    set('navPrevBtn', 'nav_prevStep'); set('navNextBtn', 'nav_nextStep'); set('navLocBtn', 'nav_setLocation');
    set('navVoiceBtn', 'nav_voice'); set('navAccessBtn', 'nav_avoidStairs'); set('navDemoBtn', 'nav_demo');
    set('navToggleSteps', 'nav_steps'); set('navCloseBtn', 'nav_end'); set('navMinBtn', S.minimized ? 'nav_expand' : 'nav_collapse');
  }

  // ------------------------------------------------------------------ voice + wake lock
  function speak(text) {
    if (!S.voice || !('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (typeof currentLanguage !== 'undefined' && currentLanguage === 'en') ? 'en-US' : 'th-TH';
      speechSynthesis.speak(u);
    } catch (e) { /* TTS unavailable */ }
  }
  function maybeSpeak(idx) {
    if (!S.voice || idx === S.spokenStep || !S.route) return;
    const st = S.route.steps[idx], d = describeStep(st, S.route);
    const dd = Math.max(0, st.cum - S.rp.progress);
    if (idx === 0 || dd <= 30 || st.type === 'arrive') {
      S.spokenStep = idx;
      speak(dd > 8 && idx > 0 ? tr('nav_inDistance', { dist: fmtDist(dd) }) + ', ' + d.text : d.text);
    }
  }
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) S.wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && S.wakeLock) { await S.wakeLock.release(); S.wakeLock = null; }
    } catch (e) { /* not allowed (e.g. page hidden) */ }
  }

  // ------------------------------------------------------------------ route lifecycle
  function installRoute(route, opts) {
    S.route = route;
    S.rp = new NC.RouteProgress(route, { destPolygon: S.dest && S.dest.coords });
    S.lastRenderedStep = -2; S.spokenStep = -1;
    drawRoute(); placeRouteMarkers(); renderPanel();
  }

  function gotoFloor(f) {
    if (f >= 1 && f <= floorCount() && f !== userFloor() && typeof switchFloor === 'function') switchFloor(f - 1);
  }

  async function startRoute(start, destRaw, opts) {
    opts = opts || {};
    if (S.busy) return false;
    S.busy = true;
    try {
      const dest = normalizeDest(destRaw, start.floor);
      const res = await computeRoute(start, dest);
      if (!res.route) { toast(res.error, 'error', { duration: 4500 }); return false; }
      if (res.route.total < 8 && res.route.startFloor === res.route.endFloor) { toast(tr('nav_alreadyHere'), 'info'); return false; }
      if (S.mode !== 'idle') cleanupRoute(true);
      if (typeof closeAllSidebars === 'function') closeAllSidebars();
      closePicker();
      S.dest = dest; S.start = start; S.mode = 'preview';
      S.baseNotice = res.notice ? { text: res.notice, kind: 'warn' } : null; S.dynNotice = null;
      gotoFloor(start.floor);
      installRoute(res.route);
      showPanel(true);
      setTimeout(fitRoute, 60);
      legacy.currentDestinationId = dest.id || dest.placeId || null;
      if (typeof renderPlaces === 'function') renderPlaces();
      if (dest.floor !== start.floor || res.route.endFloor !== start.floor) {
        const n = tr('nav_destFloorHint', { floor: res.route.endFloor });
        S.baseNotice = S.baseNotice || { text: n, kind: 'info' };
        setNotice();
      }
      if (opts.autoStart) begin();
      return true;
    } finally { S.busy = false; }
  }

  function begin() {
    if (!S.route || (S.mode !== 'preview' && S.mode !== 'arrived')) return;
    S.mode = 'navigating';
    { const p = $('navigationPanel'); if (p) p.classList.remove('steps-open'); setMinimized(true); }   // keep the map visible while walking
    S.rp.reset(S.route);
    S.follow = true; S.lastRenderedStep = -2; S.spokenStep = -1;
    keepAwake(true);
    renderPanel(); drawRoute();
    const src = S.start && S.start.source;
    if (src === 'gps' || src === 'sim') {
      if (!tracker.active) tracker.start().catch(() => { });
    } else if (src === 'picked' || src === 'manual') {
      if (!tracker.active || tracker.manual) tracker.setManual(S.start.lat, S.start.lng);
    }
    const p = tracker.pos;
    if (p) onPosition(p, true);
    else { const first = S.route.steps[0]; if (first) mapObj().easeTo({ center: [first.point.lng, first.point.lat], zoom: Math.max(mapObj().getZoom(), 19), duration: 600 }); }
    speak(describeStep(S.route.steps[0], S.route).text);
    updateGpsBtn();
  }

  function cleanupRoute(keepPanel) {
    stopDemo();
    S.route = null; S.rp = null; S.dest = null; S.start = null; S.mode = 'idle';
    S.baseNotice = null; S.dynNotice = null; S.follow = false;
    legacy.currentDestinationId = null;
    clearRouteMarkers();
    const map = mapObj();
    if (map && S.layersReady && map.getSource(SRC_ROUTE)) map.getSource(SRC_ROUTE).setData(EMPTY);
    if (!keepPanel) showPanel(false);
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    keepAwake(false);
  }

  function end() {
    const was = S.mode;
    cleanupRoute(false);
    if (was === 'navigating') toast(tr('navigationEnded'), 'info');
    if (typeof renderPlaces === 'function') renderPlaces();
    updateGpsBtn();
  }

  function arrive() {
    if (S.mode !== 'navigating') return;
    S.mode = 'arrived';
    stopDemo();
    renderPanel(); drawRoute();
    toast(tr('nav_arrived'), 'success', { duration: 5000 });
    speak(tr('nav_arrived'));
    keepAwake(false);
  }

  async function reroute(pos) {
    if (!S.dest || S.busy) return;
    S.lastReroute = Date.now();
    dyn(tr('nav_rerouting'), 'info');
    const start = { lat: pos.lat, lng: pos.lng, floor: userFloor(), name: tr('nav_myLocation'), source: pos.source === 'sim' ? 'sim' : (pos.source === 'manual' ? 'manual' : 'gps') };
    const res = await computeRoute(start, S.dest);
    if (!res.route) { dyn(null); toast(res.error, 'error'); return; }
    S.baseNotice = res.notice ? { text: res.notice, kind: 'warn' } : null;
    S.start = start;
    installRoute(res.route);
    S.rp.reset(res.route);
    dyn(null);
    toast(tr('nav_rerouted'), 'info', { duration: 1800 });
    speak(describeStep(res.route.steps[0], res.route).text);
    if (S.mode === 'navigating') onPosition(pos, true);
  }

  // ------------------------------------------------------------------ live updates
  function onPosition(pos, force) {
    S.lastPos = pos;
    updateUserMarker(pos);
    if (S.mode !== 'navigating' || !S.rp) { followCamera(pos); return; }
    const u = S.rp.update({ lat: pos.lat, lng: pos.lng, floor: userFloor(), accuracy: pos.accuracy });

    if (u.status === 'arrived') { renderBanner(u); renderStats(); arrive(); return; }

    if (u.status === 'wrongFloor') {
      dyn(tr('nav_wrongFloor', { floor: u.expectedFloor }), 'warn', () => gotoFloor(u.expectedFloor));
    } else if (u.status === 'off') {
      const manualHold = Date.now() < S.manualStepUntil;
      if (u.offCount >= 3 && !manualHold && pos.source !== 'manual' && Date.now() - S.lastReroute > 8000) { reroute(pos); return; }
    } else {
      if (S.dynNotice && S.dynNotice.kind !== 'info') dyn(null);
      if (pos.source === 'gps' && pos.accuracy > 40 && !S.dynNotice) dyn(tr('nav_gpsPoor', { acc: Math.round(pos.accuracy) }), 'info');
      else if (S.dynNotice && /±/.test(S.dynNotice.text) && pos.accuracy <= 40) dyn(null);
    }
    refreshProgress(u);
    followCamera(pos);
  }

  function refreshProgress(u) {
    renderBanner(u); renderStats();
    if (Math.abs(S.rp.progress - S.lastDrawnProgress) >= 1.5) drawRoute();
    maybeSpeak(u.stepIndex);
  }

  function followCamera(pos) {
    const map = mapObj(); if (!map || !S.follow || !pos) return;
    map.easeTo({ center: [pos.lng, pos.lat], duration: 500, zoom: Math.max(map.getZoom(), 18.5) });
  }

  function onFloorChange() {
    applyFloorFilter(); refreshMarkerFloors();
    const map = mapObj();
    if (S.layersReady && S.lastPos && map.getSource(SRC_ACC)) updateUserMarker(S.lastPos);
    if (S.mode === 'navigating' && S.lastPos) {
      S.dynNotice && S.dynNotice.kind === 'warn' && dyn(null);
      onPosition(S.lastPos, true);
    }
  }

  // manual stepping (tap a step, or ‹ ›), for when GPS is weak/unavailable indoors
  function stepTo(j) {
    if (!S.route || !S.rp) return;
    if (S.mode === 'preview') {
      const st = S.route.steps[j]; if (!st) return;
      gotoFloor(st.floor);
      mapObj().easeTo({ center: [st.point.lng, st.point.lat], zoom: Math.max(mapObj().getZoom(), 19), duration: 500 });
      return;
    }
    const st = S.rp.setStep(j);
    S.manualStepUntil = Date.now() + 20000;
    gotoFloor(st.type === 'vertical' ? st.floor : st.floor);
    S.lastRenderedStep = -2;
    refreshProgress({ stepIndex: S.rp.upcomingStep() });
    drawRoute();
    mapObj().easeTo({ center: [st.point.lng, st.point.lat], zoom: Math.max(mapObj().getZoom(), 19), duration: 500 });
    if (S.mode === 'arrived') { S.mode = 'navigating'; renderPanel(); }
  }

  // ------------------------------------------------------------------ demo walker (dev mode)
  function stopDemo() { if (S.sim) { clearInterval(S.sim.timer); S.sim = null; } const b = $('navDemoBtn'); if (b) b.classList.remove('on'); }
  function startDemo() {
    if (!S.route) return;
    if (S.sim) { stopDemo(); return; }
    if (S.mode !== 'navigating') { S.start = Object.assign({}, S.start, { source: 'sim' }); begin(); }
    tracker.stop();
    const route = S.route;
    S.rp.reset(route);
    gotoFloor(route.startFloor);
    $('navDemoBtn').classList.add('on');
    let d = 0, wait = 0;
    S.sim = {
      timer: setInterval(() => {
        if (S.mode !== 'navigating') return stopDemo();
        if (wait > 0) { wait--; return; }
        const up = route.steps[S.rp.upcomingStep()];
        if (up && up.type === 'vertical' && S.rp.progress >= up.cum - 1.5) {
          wait = 3; gotoFloor(up.toFloor); return;        // "climb the stairs", then continue
        }
        d = Math.min(route.total, d + SPEEDUP_DEMO * 0.4);
        const p = NC.pointAt(route, d);
        tracker.inject({ lat: p.lat, lng: p.lng, accuracy: 5, heading: null });
      }, 400)
    };
  }

  // ------------------------------------------------------------------ picking points on the map
  function pickOnMap(promptKey) {
    return new Promise(resolve => {
      const map = mapObj();
      if (S.cancelPick) S.cancelPick();
      const ov = $('manualLocationOverlay'), cont = map.getContainer();
      $('manualLocationText').textContent = tr(promptKey || 'nav_pickPrompt');
      $('cancelManualBtn').textContent = tr('cancel');
      ov.classList.add('active');
      map.getCanvas().style.cursor = 'crosshair';
      const done = v => {
        cont.removeEventListener('click', onClick, true);
        $('cancelManualBtn').removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey, true);
        ov.classList.remove('active'); map.getCanvas().style.cursor = '';
        S.cancelPick = null; resolve(v);
      };
      const onClick = e => {
        if (e.target.closest && e.target.closest('.maplibregl-ctrl')) return;
        e.stopPropagation(); e.preventDefault();
        const r = cont.getBoundingClientRect();
        const ll = map.unproject([e.clientX - r.left, e.clientY - r.top]);
        done({ lat: ll.lat, lng: ll.lng, floor: userFloor() });
      };
      const onCancel = () => done(null);
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      S.cancelPick = onCancel;
      cont.addEventListener('click', onClick, true);
      $('cancelManualBtn').addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey, true);
    });
  }

  async function chooseManualLocation() {
    const p = await pickOnMap('nav_pickPrompt');
    if (!p) return null;
    setManualLocation(p.lat, p.lng);
    return p;
  }
  function setManualLocation(lat, lng) {
    stopDemo();
    tracker.setManual(lat, lng);
    toast(tr('nav_locationSet'), 'success', { duration: 1500 });
    updateGpsBtn();
    if (S.mode === 'navigating') reroute(tracker.pos);
  }

  // ------------------------------------------------------------------ GPS button
  function updateGpsBtn() {
    const b = $('gpsBtn'); if (!b) return;
    b.classList.toggle('active', tracker.tracking);
    b.classList.toggle('manual-mode', tracker.manual);
    b.title = tr('nav_myLocation');
  }

  function explainGpsFailure(e) {
    const code = e && e.code;
    if (code === 'denied') toast(tr('gpsPermissionDenied'), 'error', { duration: 4500 });
    else if (code === 'outside') toast(tr('nav_outside'), 'warning', { duration: 5000 });
    else if (code === 'unsupported') toast(tr('gpsUnavailable'), 'error');
    else if (code !== 'stopped') toast(tr('gpsError'), 'error');
  }

  /** Current position, starting GPS if needed. Resolves null (after explaining) when none is available. */
  async function acquirePosition() {
    const p = tracker.pos;
    if (p && (p.source !== 'gps' || Date.now() - p.ts < 60000)) return p;
    toast(tr('nav_gpsSearching'), 'info', { duration: 2000 });
    try {
      return await Promise.race([tracker.start(), new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), 9000))]);
    } catch (e) { explainGpsFailure(e); updateGpsBtn(); return null; }
  }

  async function onGpsButton() {
    if (S.cancelPick) { S.cancelPick(); return; }
    const map = mapObj();
    if (tracker.tracking && tracker.pos) {
      if (!S.follow) { S.follow = true; followCamera(tracker.pos); return; }
      if (S.mode === 'navigating') { toast(tr('nav_stopTrackingFirst'), 'info'); return; }
      S.follow = false; tracker.stop(); updateUserMarker(null); updateGpsBtn(); toast(tr('nav_trackingOff'), 'info', { duration: 1500 });
      return;
    }
    if (tracker.manual && tracker.pos) { tracker.stop(); updateUserMarker(null); updateGpsBtn(); return; }
    toast(tr('nav_locating'), 'info', { duration: 1500 });
    try {
      const p = await tracker.start();
      S.follow = true;
      map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 18.5), duration: 700 });
    } catch (e) {
      explainGpsFailure(e);
      updateGpsBtn();
      if (e && e.code !== 'stopped') chooseManualLocation();            // keep the site usable off-campus / without GPS
    }
    updateGpsBtn();
  }

  // ------------------------------------------------------------------ search helpers + picker UI
  function searchAll(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    const out = [], seen = new Set();
    const push = o => { const k = (o.name || '').toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); out.push(o); };
    const has = s => s && String(s).toLowerCase().includes(q);
    if (typeof allPlaces !== 'undefined') allPlaces.forEach(p => {
      if (has(p.name) || has(p.category) || (p.category && has(tr(p.category)))) push({ type: 'place', id: p.id, name: p.name, sub: tr(p.category), floor: p.floor, coords: p.coords });
    });
    if (typeof allPins !== 'undefined') allPins.forEach(p => {
      if (has(p.name)) push({ type: 'pin', id: p.id, name: p.name, sub: tr('nav_floorShort', { floor: (Number(p.floor) || 0) + 1 }), floor: p.floor, lat: p.lat, lng: p.lng });
    });
    if (typeof locationsFromFile !== 'undefined') locationsFromFile.forEach(l => {
      if (has(l.name) || (l.keywords || []).some(has)) push({ type: 'location', id: l.id, name: l.name, floor: l.floor, lat: l.lat, lng: l.lng });
    });
    return out.slice(0, 6);
  }

  const P = { from: null, to: null, active: 'to', el: null };

  function buildPicker() {
    if (P.el) return;
    const el = document.createElement('div');
    el.id = 'navPicker'; el.className = 'nav-picker'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Directions');
    el.innerHTML =
      '<div class="nav-picker-head"><span class="material-symbols-rounded">directions</span><b id="npTitle"></b><button type="button" id="npClose" class="np-icon" aria-label="Close">×</button></div>' +
      '<div class="np-rows">' +
      '  <div class="np-dots"><i class="np-dot from"></i><i class="np-line"></i><i class="np-dot to"></i></div>' +
      '  <div class="np-inputs">' +
      '    <div class="np-field"><input id="npFrom" autocomplete="off" /><button type="button" id="npMyLoc" class="np-icon" title=""><span class="material-symbols-rounded">my_location</span></button><button type="button" id="npFromMap" class="np-icon" title=""><span class="material-symbols-rounded">add_location_alt</span></button></div>' +
      '    <div class="np-field"><input id="npTo" autocomplete="off" /><button type="button" id="npToMap" class="np-icon" title=""><span class="material-symbols-rounded">add_location_alt</span></button></div>' +
      '  </div>' +
      '  <button type="button" id="npSwap" class="np-icon np-swap"><span class="material-symbols-rounded">swap_vert</span></button>' +
      '</div>' +
      '<div class="np-msg" id="npMsg" hidden></div>' +
      '<div class="np-suggest" id="npSuggest" role="listbox"></div>' +
      '<div class="np-foot"><label class="np-check"><input type="checkbox" id="npAccess"><span id="npAccessLbl"></span></label><button type="button" id="npGo" class="np-go"></button></div>';
    document.body.appendChild(el);
    P.el = el;

    const from = $('npFrom'), to = $('npTo');
    const refresh = which => {
      P.active = which;
      const q = which === 'from' ? from.value : to.value;
      renderSuggest(which, which === 'from' && from.dataset.mine === '1' ? '' : q);
    };
    [['from', from], ['to', to]].forEach(([which, inp]) => {
      inp.addEventListener('focus', () => { inp.select(); refresh(which); });
      inp.addEventListener('input', () => { inp.dataset.mine = '0'; if (which === 'from') P.from = undefined; else P.to = null; refresh(which); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const first = $('npSuggest').querySelector('.np-item'); if (first) first.click(); else go(); }
        if (e.key === 'Escape') closePicker();
      });
    });
    $('npClose').onclick = closePicker;
    $('npMyLoc').onclick = () => { P.from = null; syncPicker(); $('npTo').focus(); };
    $('npFromMap').onclick = async () => { el.classList.add('picking'); const p = await pickOnMap('nav_pickPrompt'); el.classList.remove('picking'); if (p) { P.from = { name: tr('nav_chooseOnMap'), lat: p.lat, lng: p.lng, floor: p.floor, type: 'point', source: 'picked' }; syncPicker(); } };
    $('npToMap').onclick = async () => { el.classList.add('picking'); const p = await pickOnMap('nav_pickPrompt'); el.classList.remove('picking'); if (p) { P.to = { name: tr('nav_chooseOnMap'), lat: p.lat, lng: p.lng, floor: p.floor, type: 'point' }; syncPicker(); } };
    $('npSwap').onclick = () => {
      const f = P.from, d = P.to;
      P.from = d ? Object.assign({}, d, { source: 'picked' }) : undefined; P.to = f === null ? { name: tr('nav_myLocation'), mine: true } : f || null;
      if (P.to && P.to.mine) { /* swapping "my location" into the destination: use the live position as a point */ const p = tracker.pos; P.to = p ? { name: tr('nav_myLocation'), lat: p.lat, lng: p.lng, floor: userFloor(), type: 'point' } : null; }
      syncPicker();
    };
    $('npAccess').onchange = e => { S.accessible = e.target.checked; lsSet('nav_accessible', S.accessible ? '1' : '0'); const b = $('navAccessBtn'); if (b) b.classList.toggle('on', S.accessible); };
    $('npGo').onclick = go;
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
  }

  function renderSuggest(which, q) {
    const box = $('npSuggest'); if (!box) return;
    const items = searchAll(q);
    if (!q.trim()) { box.innerHTML = ''; return; }
    box.innerHTML = items.length
      ? items.map((it, i) => '<button type="button" class="np-item" role="option" data-i="' + i + '"><span class="material-symbols-rounded">' + (it.type === 'place' ? 'place' : 'pin_drop') + '</span><span class="np-name">' + esc(it.name) + '</span><span class="np-sub">' + esc(it.sub || '') + '</span></button>').join('')
      : '<div class="np-empty">' + esc(tr('nav_noResults')) + '</div>';
    box.querySelectorAll('.np-item').forEach(b => b.addEventListener('click', () => {
      const it = items[+b.dataset.i];
      if (which === 'from') { const n = normalizeDest(it, userFloor()); P.from = Object.assign({}, it, { lat: n.lat, lng: n.lng, floorNum: n.floor, source: 'picked' }); }
      else P.to = it;
      box.innerHTML = '';
      syncPicker();
      if (which === 'to') { if (P.from !== undefined) go(); else $('npFrom').focus(); }
      else if (P.to) go(); else $('npTo').focus();
    }));
  }

  function syncPicker() {
    const from = $('npFrom'), to = $('npTo');
    from.value = P.from === null ? tr('nav_myLocation') : (P.from ? P.from.name : '');
    from.dataset.mine = P.from === null ? '1' : '0';
    from.placeholder = tr('nav_searchStart');
    to.value = P.to ? P.to.name : '';
    to.placeholder = tr('nav_searchDest');
    $('npTitle').textContent = tr('nav_directions');
    $('npGo').textContent = tr('nav_getRoute');
    $('npAccessLbl').textContent = tr('nav_avoidStairs');
    $('npAccess').checked = S.accessible;
    $('npMyLoc').title = tr('nav_myLocation'); $('npFromMap').title = tr('nav_chooseOnMap'); $('npToMap').title = tr('nav_chooseOnMap'); $('npSwap').title = tr('nav_swap');
  }

  function msg(text) { const m = $('npMsg'); if (!m) return; m.hidden = !text; m.textContent = text || ''; }

  function openPicker(opts) {
    opts = opts || {};
    buildPicker();
    if (typeof closeAllSidebars === 'function') closeAllSidebars();
    if (S.mode === 'preview') cleanupRoute(false);
    P.from = opts.from !== undefined ? opts.from : null;
    P.to = opts.to || null;
    syncPicker(); msg(opts.message || '');
    $('npSuggest').innerHTML = '';
    P.el.classList.add('open');
    document.body.classList.add('nav-picker-open');
    setTimeout(() => { (opts.focus === 'from' ? $('npFrom') : $('npTo')).focus(); }, 60);
  }
  function closePicker() {
    if (!P.el) return;
    P.el.classList.remove('open', 'picking');
    document.body.classList.remove('nav-picker-open');
  }

  async function go() {
    if (P.to == null || !P.to.name) { msg(tr('nav_needDest')); $('npTo').focus(); return; }
    if (P.from === undefined) { msg(tr('nav_needStart')); $('npFrom').focus(); return; }
    msg('');
    await navigateTo(P.to, { from: P.from });
  }

  // ------------------------------------------------------------------ public entry point
  /**
   * navigateTo(dest, {from?, autoStart?})
   * dest: place / pin / search result / {lat,lng,name}.  from: same shape, or null/undefined = my location.
   */
  async function navigateTo(destRaw, opts) {
    opts = opts || {};
    let start;
    if (opts.from) {
      const n = normalizeDest(opts.from, userFloor());
      start = { lat: n.lat, lng: n.lng, floor: opts.from.floorNum || n.floor, name: opts.from.name, source: 'picked' };
    } else {
      const pos = await acquirePosition();
      if (!pos) {
        openPicker({ to: destRaw, from: undefined, focus: 'from', message: tr('nav_outside') });
        return false;
      }
      start = { lat: pos.lat, lng: pos.lng, floor: userFloor(), name: tr('nav_myLocation'), accuracy: pos.accuracy, source: pos.source === 'manual' ? 'manual' : pos.source === 'sim' ? 'sim' : 'gps' };
      updateUserMarker(pos); updateGpsBtn();
    }
    const ok = await startRoute(start, destRaw, opts);
    if (!ok && P.el && P.el.classList.contains('open')) msg(tr('nav_noRoute'));
    return ok;
  }

  // ------------------------------------------------------------------ legacy facade (script.js)
  const legacy = {
    currentDestinationId: null,
    get isNavigating() { return S.mode === 'preview' || S.mode === 'navigating'; },
    navigateToLocation(dest) { return navigateTo(dest, {}); },
    onFloorChange() { onFloorChange(); },
    endNavigation() { end(); }
  };

  // ------------------------------------------------------------------ wiring
  function addSearchNavButtons() {
    const orig = window.displaySearchResults;
    if (typeof orig !== 'function' || orig.__navWrapped) return;
    const wrapped = function (results) {
      orig(results);
      document.querySelectorAll('#searchRecommendations .search-result-item').forEach((item, i) => {
        if (!results[i] || item.classList.contains('not-found') || item.querySelector('.nav-to-btn')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'nav-to-btn'; b.title = tr('navigateTo'); b.setAttribute('aria-label', tr('navigateTo'));
        b.innerHTML = '<span class="material-symbols-rounded">directions</span>';
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          const sr = $('searchRecommendations'); if (sr) sr.classList.remove('active');
          const si = $('searchInput'); if (si) si.value = '';
          if (window.SearchHistory) window.SearchHistory.add(results[i]);
          navigateTo(results[i], {});
        });
        item.appendChild(b);
      });
    };
    wrapped.__navWrapped = true;
    window.displaySearchResults = wrapped;
  }

  function hookFloorSwitch() {
    const orig = window.switchFloor;
    if (typeof orig !== 'function' || orig.__navHooked) return;
    const hooked = function (i) {
      orig.apply(this, arguments);
      onFloorChange();
      if (typeof renderPlaces === 'function') renderPlaces();
    };
    hooked.__navHooked = true;
    window.switchFloor = hooked;
  }

  function wireDom() {
    const gps = $('gpsBtn');
    if (gps) gps.addEventListener('click', onGpsButton);
    const dir = document.querySelector('.gm-search-directions');
    if (dir) dir.addEventListener('click', e => { e.stopPropagation(); openPicker({ focus: 'to' }); });

    $('navCloseBtn').addEventListener('click', end);
    $('endNavBtn').addEventListener('click', end);
    $('startNavBtn').addEventListener('click', begin);
    $('navMinBtn').addEventListener('click', () => setMinimized(!S.minimized));
    $('navToggleSteps').addEventListener('click', () => {
      const p = $('navigationPanel'); if (S.minimized && !p.classList.contains('steps-open')) setMinimized(false);
      const open = p.classList.toggle('steps-open');
      $('navToggleSteps').setAttribute('aria-expanded', open ? 'true' : 'false');
      requestAnimationFrame(setPanelHeightVar); setTimeout(setPanelHeightVar, 350);
    });
    $('navPrevBtn').addEventListener('click', () => { if (S.rp) stepTo(Math.max(0, S.rp.upcomingStep() - 1)); });
    $('navNextBtn').addEventListener('click', () => { if (S.rp) stepTo(Math.min(S.route.steps.length - 1, S.rp.upcomingStep() + 1)); });
    $('navLocBtn').addEventListener('click', chooseManualLocation);
    $('navVoiceBtn').addEventListener('click', () => {
      S.voice = !S.voice; lsSet('nav_voice', S.voice ? '1' : '0');
      renderPanel(); toast(tr(S.voice ? 'nav_voiceOn' : 'nav_voiceOff'), 'info', { duration: 1200 });
      if (S.voice && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) { /* unlock audio on gesture */ } }
    });
    $('navAccessBtn').addEventListener('click', async () => {
      S.accessible = !S.accessible; lsSet('nav_accessible', S.accessible ? '1' : '0'); renderPanel();
      if (S.dest && S.start) {
        const pos = (S.mode === 'navigating' && S.lastPos) ? S.lastPos : null;
        const start = pos ? { lat: pos.lat, lng: pos.lng, floor: userFloor(), source: S.start.source, name: S.start.name } : S.start;
        const mode = S.mode;
        const res = await computeRoute(start, S.dest);
        if (!res.route) { toast(res.error, 'error'); S.accessible = !S.accessible; lsSet('nav_accessible', S.accessible ? '1' : '0'); renderPanel(); return; }
        S.start = start; S.baseNotice = res.notice ? { text: res.notice, kind: 'warn' } : null;
        installRoute(res.route); if (mode === 'navigating') { S.rp.reset(res.route); }
        fitRoute();
      }
    });
    $('navDemoBtn').addEventListener('click', startDemo);
    window.addEventListener('resize', setPanelHeightVar);

    const map = mapObj();
    map.on('dragstart', e => { if (e.originalEvent && S.follow) { S.follow = false; } });
    map.on('styledata', () => { if (S.layersReady && !map.getSource(SRC_ROUTE)) { S.layersReady = false; if (ensureLayers()) { drawRoute(); if (S.lastPos) updateUserMarker(S.lastPos); } } });

    tracker.on((ev, pos) => {
      if (ev === 'position') { onPosition(pos); updateGpsBtn(); }
      else if (ev === 'heading') { if (S.markers.user && tracker.pos) updateUserMarker(tracker.pos); }
      else if (ev === 'status') { updateGpsBtn(); if (!tracker.pos) updateUserMarker(null); }
      else if (ev && ev.type === 'error') { updateGpsBtn(); if (!tracker.pos) updateUserMarker(null); }
    });
    updateStaticLabels();
  }

  // language / dev-mode changes re-render the panel text
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.lang-option, [data-lang], #languageSelect')) setTimeout(() => { if (S.route) renderPanel(); updateStaticLabels(); if (P.el) syncPicker(); }, 120); }, true);

  function init() {
    if (!mapObj() || !$('navigationPanel')) { setTimeout(init, 100); return; }
    loadCampus();
    wireDom();
    hookFloorSwitch();
    addSearchNavButtons();
    const waitLayers = () => { if (!ensureLayers()) setTimeout(waitLayers, 200); };
    waitLayers();
    ensureGraph();
    console.log('🧭 Navigation system ready');
  }

  window.NavSystem = {
    navigateTo, openPicker, closePicker, end, begin, stepTo, tracker, S,
    reloadGraph: () => { graphPromise = null; return ensureGraph(true); },
    getGraph: () => S.graph, ensureGraph, setManualLocation, chooseManualLocation, pickOnMap,
    computeRoute, startDemo, normalizeDest, searchAll, userFloor, inCampus
  };
  navigationController = legacy;      // declared with `let` in script.js

  init();
}());
