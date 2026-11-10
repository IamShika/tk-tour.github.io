// =================== NAV CORE (pure routing engine) ===================
// No DOM / map code in here, so it can be unit-tested in Node and reused anywhere.
//   Browser: window.NavCore      Node: require('./nav-core.js')
//
// Floors are 1-indexed everywhere in this file (floor 1 = ground).
// NOTE: data/pins.json stores 0-indexed floors; NavGraph.addPins() converts them.
//
// What lives here:
//   - geometry helpers (distance, bearing, projection, polygons)
//   - NavGraph      : walkway graph (manual data + auto-derived from 360° pins), A* routing
//   - buildSteps    : turns a point list into turn-by-turn maneuvers
//   - RouteProgress : projects live GPS fixes onto a route (progress, off-route, arrival)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NavCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R = 6371008.8;
  const D2R = Math.PI / 180;

  const DEFAULTS = {
    walkSpeed: 1.35,            // m/s
    stairsSecondsPerFloor: 22,
    elevatorSeconds: 30,
    elevatorSecondsPerFloor: 5,
    stairsCostPerFloor: 18,     // routing cost (metres-equivalent) of one flight of stairs
    elevatorCost: 12,
    joinDistance: 4,            // auto-link separate walkway pieces closer than this (m)
    maxPinEdge: 90,             // never auto-link two 360° pins further apart than this (m)
    maxSnap: 70,                // max distance from start/destination to the nearest walkway (m)
    turnMin: 25,                // degrees: below this a bend is "straight on"
    stairNamePattern: /stair|บันได/i,
    elevatorNamePattern: /elevator|\blift\b|ลิฟต์|ลิฟท์/i
  };

  // ------------------------------------------------------------------ geometry
  function distance(a, b) {
    const dLat = (b.lat - a.lat) * D2R;
    const dLng = (b.lng - a.lng) * D2R * Math.cos(((a.lat + b.lat) / 2) * D2R);
    return Math.sqrt(dLat * dLat + dLng * dLng) * R;
  }

  /** Compass bearing a→b in degrees, 0..360 (0 = north, 90 = east). */
  function bearing(a, b) {
    const dy = b.lat - a.lat;
    const dx = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * D2R);
    return (Math.atan2(dx, dy) / D2R + 360) % 360;
  }

  /** Signed turn from heading `from` to heading `to`: + = clockwise (right), range -180..180. */
  function angleDiff(from, to) {
    return ((to - from + 540) % 360) - 180;
  }

  /** Closest point to p on segment a-b. Returns {lat,lng,t,dist(m)}. */
  function project(p, a, b) {
    const k = Math.cos(a.lat * D2R);
    const bx = (b.lng - a.lng) * k, by = b.lat - a.lat;
    const px = (p.lng - a.lng) * k, py = p.lat - a.lat;
    const l2 = bx * bx + by * by;
    let t = l2 === 0 ? 0 : (px * bx + py * by) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = bx * t, qy = by * t;
    return { lat: a.lat + qy, lng: a.lng + qx / k, t, dist: Math.hypot(px - qx, py - qy) * D2R * R };
  }

  function lerp(a, b, t) {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  /** coords: [[lat,lng],...] */
  function pointInPolygon(p, coords) {
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const yi = coords[i][0], xi = coords[i][1], yj = coords[j][0], xj = coords[j][1];
      if (((yi > p.lat) !== (yj > p.lat)) && (p.lng < (xj - xi) * (p.lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function polygonCentroid(coords) {
    if (!coords || !coords.length) return null;
    const lat0 = coords[0][0], lng0 = coords[0][1], k = Math.cos(lat0 * D2R);
    let a2 = 0, cx = 0, cy = 0;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const x1 = (coords[j][1] - lng0) * k, y1 = coords[j][0] - lat0;
      const x2 = (coords[i][1] - lng0) * k, y2 = coords[i][0] - lat0;
      const f = x1 * y2 - x2 * y1;
      a2 += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
    }
    if (Math.abs(a2) < 1e-14) {
      let la = 0, lo = 0;
      coords.forEach(c => { la += c[0]; lo += c[1]; });
      return { lat: la / coords.length, lng: lo / coords.length };
    }
    const c = { lat: lat0 + cy / (3 * a2), lng: lng0 + cx / (3 * a2) / k };
    // A concave footprint can put the centroid outside — fall back to the vertex mean then.
    if (!pointInPolygon(c, coords)) {
      let la = 0, lo = 0;
      coords.forEach(q => { la += q[0]; lo += q[1]; });
      const m = { lat: la / coords.length, lng: lo / coords.length };
      return pointInPolygon(m, coords) ? m : { lat: coords[0][0], lng: coords[0][1] };
    }
    return c;
  }

  /** 0 when inside, else metres to the nearest edge. */
  function distanceToPolygon(p, coords) {
    if (pointInPolygon(p, coords)) return 0;
    let best = Infinity;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const d = project(p, { lat: coords[j][0], lng: coords[j][1] }, { lat: coords[i][0], lng: coords[i][1] }).dist;
      if (d < best) best = d;
    }
    return best;
  }

  /** Nearest point on a polygon's boundary to p (used to aim at a building's edge). */
  function nearestPointOnPolygon(p, coords) {
    let best = null;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const q = project(p, { lat: coords[j][0], lng: coords[j][1] }, { lat: coords[i][0], lng: coords[i][1] });
      if (!best || q.dist < best.dist) best = q;
    }
    return best;
  }

  // ------------------------------------------------------------------ binary heap
  class MinHeap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(pri, val) {
      const a = this.a; a.push([pri, val]);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        [a[p], a[i]] = [a[i], a[p]]; i = p;
      }
    }
    pop() {
      const a = this.a;
      if (!a.length) return null;
      const top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]]; i = m;
        }
      }
      return top;
    }
  }

  const edgeKey = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

  // ------------------------------------------------------------------ NavGraph
  class NavGraph {
    constructor(options) {
      this.opts = Object.assign({}, DEFAULTS, options || {});
      this.nodes = new Map();      // id -> {id,lat,lng,floor,name,type,placeId?,pinId?,assumed?,source}
      this.adj = new Map();        // id -> [{to,cost,len,kind,seconds}]
      this.edges = [];             // walkable (same-floor) segments, used for snapping
      this.transitions = [];       // {id,type,nodes:[ids by floor]}
      this._edgeKeys = new Set();
      this.stats = { manualNodes: 0, pinNodes: 0, syntheticStairs: 0, joins: 0 };
    }

    // ---- construction
    addNode(n) {
      const node = Object.assign({ type: 'corridor', floor: 1, name: '', source: 'manual' }, n);
      node.floor = Math.round(Number(node.floor)) || 1;
      this.nodes.set(node.id, node);
      if (!this.adj.has(node.id)) this.adj.set(node.id, []);
      return node;
    }

    addEdge(a, b, o) {
      o = o || {};
      const A = this.nodes.get(a), B = this.nodes.get(b);
      if (!A || !B || a === b || A.floor !== B.floor) return false;
      const key = edgeKey(a, b);
      if (this._edgeKeys.has(key)) return false;
      this._edgeKeys.add(key);
      const len = distance(A, B);
      this.edges.push({ a, b, len, source: o.source || 'manual' });
      const base = { cost: len, len, kind: 'walk', seconds: len / this.opts.walkSpeed };
      this.adj.get(a).push(Object.assign({ to: b }, base));
      if (o.bidirectional !== false) this.adj.get(b).push(Object.assign({ to: a }, base));
      return true;
    }

    /** nodes: node ids; ordering is irrelevant, they are sorted by floor. */
    addTransition(tr) {
      const type = /elev|lift/i.test(tr.type || '') ? 'elevator' : 'stairs';
      const ids = (tr.nodes || []).filter(id => this.nodes.has(id))
        .sort((x, y) => this.nodes.get(x).floor - this.nodes.get(y).floor);
      if (ids.length < 2) return false;
      this.transitions.push({ id: tr.id || ('tr_' + this.transitions.length), type, nodes: ids });
      for (let i = 0; i < ids.length - 1; i++) {
        const A = this.nodes.get(ids[i]), B = this.nodes.get(ids[i + 1]);
        const floors = Math.abs(B.floor - A.floor) || 1;
        const secs = type === 'elevator'
          ? this.opts.elevatorSeconds + this.opts.elevatorSecondsPerFloor * floors
          : this.opts.stairsSecondsPerFloor * floors;
        const cost = type === 'elevator'
          ? this.opts.elevatorCost + 2 * floors
          : this.opts.stairsCostPerFloor * floors;
        this.adj.get(ids[i]).push({ to: ids[i + 1], cost, len: 0, kind: type, seconds: secs });
        this.adj.get(ids[i + 1]).push({ to: ids[i], cost, len: 0, kind: type, seconds: secs });
      }
      return true;
    }

    static build(input) {
      input = input || {};
      let manual = input.manual;
      if (!manual || Array.isArray(manual) || typeof manual !== 'object') manual = {};
      const g = new NavGraph(manual.settings);

      Object.entries(manual.nodes || {}).forEach(([id, n]) => {
        if (n && isFinite(n.lat) && isFinite(n.lng)) { g.addNode(Object.assign({}, n, { id, source: 'manual' })); g.stats.manualNodes++; }
      });
      // pins go in before manual edges so a hand-drawn edge may end on a pin node ("pin:<id>")
      if (manual.autoFromPins !== false) g.addPins(input.pins || []);
      (manual.edges || []).forEach(e => g.addEdge(e.from, e.to, { bidirectional: e.bidirectional, source: 'manual' }));
      (manual.transitions || []).forEach(tr => g.addTransition(tr));
      g.joinNearby();
      return g;
    }

    /** 360° pins are placed along corridors, so they double as a walkway skeleton. */
    addPins(pins) {
      const byFloor = new Map();
      (pins || []).forEach(p => {
        if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
        const floor = (Number(p.floor) || 0) + 1;                // pins are 0-indexed
        const name = String(p.name || '');
        const type = this.opts.elevatorNamePattern.test(name) ? 'elevator'
          : this.opts.stairNamePattern.test(name) ? 'stairs' : 'corridor';
        const id = 'pin:' + (p.id || (name + '_' + p.lat + '_' + p.lng));
        this.addNode({ id, lat: p.lat, lng: p.lng, floor, name, type, pinId: p.id, source: 'pin' });
        this.stats.pinNodes++;
        if (!byFloor.has(floor)) byFloor.set(floor, []);
        byFloor.get(floor).push(id);
      });

      // Minimum spanning tree per floor (Prim). For pins along a corridor this is just the chain.
      byFloor.forEach(ids => {
        if (ids.length < 2) return;
        const inTree = new Set([ids[0]]);
        const best = new Map();
        const upd = from => ids.forEach(o => {
          if (inTree.has(o)) return;
          const d = distance(this.nodes.get(from), this.nodes.get(o));
          if (!best.has(o) || d < best.get(o).d) best.set(o, { d, from });
        });
        upd(ids[0]);
        while (inTree.size < ids.length) {
          let pick = null;
          best.forEach((v, k) => { if (!inTree.has(k) && (!pick || v.d < pick.d)) pick = { k, d: v.d, from: v.from }; });
          if (!pick) break;
          if (pick.d <= this.opts.maxPinEdge) this.addEdge(pick.from, pick.k, { source: 'pin' });
          inTree.add(pick.k); best.delete(pick.k); upd(pick.k);
        }
      });

      this._deriveStairColumns(byFloor);
    }

    /**
     * Pins named "Stair…"/"Lift…" mark a vertical connection, but only on the floor where someone
     * placed the pin. Stairs stack, so we assume the same column exists on every floor from 1 up to the
     * highest floor that has pins and add (flagged `assumed`) nodes for the missing floors.
     */
    _deriveStairColumns(byFloor) {
      const maxFloor = Math.max(1, ...Array.from(byFloor.keys()));
      const vertical = [];
      byFloor.forEach(ids => ids.forEach(id => { const n = this.nodes.get(id); if (n.type !== 'corridor') vertical.push(n); }));
      const used = new Set();
      const manualVertical = Array.from(this.nodes.values()).filter(n => n.source === 'manual' && n.type !== 'corridor');

      vertical.forEach(seed => {
        if (used.has(seed.id)) return;
        const cluster = [seed]; used.add(seed.id);
        for (let i = 0; i < cluster.length; i++) {
          vertical.forEach(o => {
            if (!used.has(o.id) && o.type === seed.type && distance(cluster[i], o) <= 8) { used.add(o.id); cluster.push(o); }
          });
        }
        const c = { lat: cluster.reduce((s, n) => s + n.lat, 0) / cluster.length, lng: cluster.reduce((s, n) => s + n.lng, 0) / cluster.length };
        // The admin already modelled this staircase by hand — don't second-guess it.
        if (manualVertical.some(m => distance(m, c) <= 10)) return;

        const have = new Map(cluster.map(n => [n.floor, n.id]));
        const ids = [];
        for (let f = 1; f <= maxFloor; f++) {
          if (have.has(f)) { ids.push(have.get(f)); continue; }
          const id = 'stair:' + seed.id + ':F' + f;
          this.addNode({ id, lat: c.lat, lng: c.lng, floor: f, name: seed.name, type: seed.type, assumed: true, source: 'pin' });
          this.stats.syntheticStairs++;
          ids.push(id);
          // hook the assumed stair onto that floor's corridor if there is one close by
          let near = null, nd = 20;
          (byFloor.get(f) || []).forEach(o => { const d = distance(c, this.nodes.get(o)); if (d < nd) { nd = d; near = o; } });
          if (near) this.addEdge(id, near, { source: 'pin' });
        }
        if (ids.length >= 2) this.addTransition({ id: 'auto_' + seed.id, type: seed.type, nodes: ids });
      });
    }

    /** Link separate walkway pieces that touch (within joinDistance), splitting edges for T-junctions. */
    joinNearby() {
      const J = this.opts.joinDistance;
      if (!(J > 0)) return;
      for (let guard = 0, max = this.nodes.size + 5; guard < max; guard++) {
        const comp = this._components();           // walk links only: stairs must not hide a gap on a floor
        let best = null;
        const nodes = Array.from(this.nodes.values());
        // 1) node ↔ node
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (a.floor !== b.floor || comp.get(a.id) === comp.get(b.id)) continue;
          const d = distance(a, b);
          if (d <= J && (!best || d < best.d)) best = { d, kind: 'nn', a: a.id, b: b.id };
        }
        // 2) node ↔ middle of someone else's edge (T-junction)
        for (const n of nodes) for (const e of this.edges) {
          const A = this.nodes.get(e.a), B = this.nodes.get(e.b);
          if (A.floor !== n.floor || comp.get(n.id) === comp.get(e.a)) continue;
          const p = project(n, A, B);
          if (p.t <= 0 || p.t >= 1) continue;
          if (p.dist <= J && (!best || p.dist < best.d - 1e-6)) best = { d: p.dist, kind: 'nt', n: n.id, e, p };
        }
        if (!best) break;
        if (best.kind === 'nn') this.addEdge(best.a, best.b, { source: 'join' });
        else {
          const A = this.nodes.get(best.e.a), B = this.nodes.get(best.e.b);
          const jid = 'join:' + best.n + ':' + this.nodes.size;
          this.addNode({ id: jid, lat: best.p.lat, lng: best.p.lng, floor: A.floor, type: 'corridor', source: 'join' });
          this._removeEdge(best.e);
          this.addEdge(best.e.a, jid, { source: best.e.source });
          this.addEdge(jid, best.e.b, { source: best.e.source });
          this.addEdge(best.n, jid, { source: 'join' });
        }
        this.stats.joins++;
      }
    }

    _removeEdge(e) {
      this.edges = this.edges.filter(x => x !== e);
      this._edgeKeys.delete(edgeKey(e.a, e.b));
      const strip = (from, to) => { const l = this.adj.get(from); const i = l.findIndex(x => x.to === to && x.kind === 'walk'); if (i >= 0) l.splice(i, 1); };
      strip(e.a, e.b); strip(e.b, e.a);
    }

    /** Connected components over same-floor walk links. */
    _components() {
      const comp = new Map(); let c = 0;
      this.nodes.forEach((_, id) => {
        if (comp.has(id)) return;
        const stack = [id]; comp.set(id, c);
        while (stack.length) {
          const u = stack.pop();
          this.adj.get(u).forEach(e => { if (e.kind === 'walk' && !comp.has(e.to)) { comp.set(e.to, c); stack.push(e.to); } });
        }
        c++;
      });
      return comp;
    }

    get isEmpty() { return this.nodes.size === 0; }
    hasFloor(floor) { for (const n of this.nodes.values()) if (n.floor === floor) return true; return false; }

    // ---- snapping
    /** Closest point of the walkway network (same floor) to p. */
    snap(p, floor) {
      let best = null;
      for (const e of this.edges) {
        const A = this.nodes.get(e.a), B = this.nodes.get(e.b);
        if (A.floor !== floor) continue;
        const q = project(p, A, B);
        if (!best || q.dist < best.dist) best = { edge: e, t: q.t, point: { lat: q.lat, lng: q.lng }, dist: q.dist };
      }
      // isolated nodes (no walk edge) can still be reached, e.g. a lone stairs node
      this.nodes.forEach(n => {
        if (n.floor !== floor || this.adj.get(n.id).some(x => x.kind === 'walk')) return;
        const d = distance(p, n);
        if (!best || d < best.dist) best = { node: n.id, point: { lat: n.lat, lng: n.lng }, dist: d };
      });
      return best;
    }

    /** Nodes explicitly bound to a place (door/entrance nodes created in the editor). */
    doorFor(placeId, floor) {
      let found = null;
      this.nodes.forEach(n => { if (n.placeId === placeId && (!floor || n.floor === floor || !found)) found = n; });
      return found;
    }

    // ---- routing
    /**
     * start/end: {lat,lng,floor, placeId?}.  Returns a route or null when the graph can't connect them
     * (callers then fall back to a direct line).
     */
    findRoute(start, end, options) {
      options = options || {};
      const accessible = !!options.accessible;
      const maxSnap = options.maxSnap != null ? options.maxSnap : this.opts.maxSnap;
      if (this.isEmpty) return null;

      const sSnap = this.snap(start, start.floor);
      let eSnap = null;
      const door = end.placeId ? this.doorFor(end.placeId, end.floor) : null;
      if (door) { end = Object.assign({}, end, { floor: door.floor }); eSnap = { node: door.id, point: { lat: door.lat, lng: door.lng }, dist: 0 }; }
      else eSnap = this.snap(end, end.floor);
      if (!sSnap || !eSnap || sSnap.dist > maxSnap || eSnap.dist > maxSnap) return null;

      const ends = s => s.edge
        ? [{ id: s.edge.a, extra: s.t * s.edge.len }, { id: s.edge.b, extra: (1 - s.t) * s.edge.len }]
        : [{ id: s.node, extra: 0 }];
      const sources = ends(sSnap).map(x => ({ id: x.id, g: x.extra }));
      const targets = new Map(ends(eSnap).map(x => [x.id, x.extra]));

      let nodePath = this._astar(sources, targets, end, accessible);
      let cost = nodePath ? nodePath.cost : Infinity;
      let sameEdge = false;
      if (sSnap.edge && eSnap.edge && sSnap.edge === eSnap.edge) {
        const direct = Math.abs(sSnap.t - eSnap.t) * sSnap.edge.len;
        if (direct <= cost) { sameEdge = true; cost = direct; }
      }
      if (!sameEdge && !nodePath) return null;

      // A connector (user → walkway) of a few metres is noise, not a "walk west 3 m, then turn" step: fold it in.
      const SHORT = 5;
      const dS = distance(start, sSnap.point), dE = distance(end, eSnap.point);
      const pts = [];
      if (dS <= SHORT) pts.push({ lat: sSnap.point.lat, lng: sSnap.point.lng, floor: start.floor, kind: 'start' });
      else {
        pts.push({ lat: start.lat, lng: start.lng, floor: start.floor, kind: 'start', connectorNext: true });
        pts.push({ lat: sSnap.point.lat, lng: sSnap.point.lng, floor: start.floor, kind: 'snap' });
      }
      if (!sameEdge) {
        nodePath.ids.forEach((id, i) => {
          const n = this.nodes.get(id);
          const prev = i > 0 ? this.nodes.get(nodePath.ids[i - 1]) : null;
          if (prev && prev.floor !== n.floor) {
            const e = this.adj.get(prev.id).find(x => x.to === id && x.kind !== 'walk');
            pts[pts.length - 1].via = e ? e.kind : 'stairs';        // the hop *leaving* the previous point
          }
          pts.push({ lat: n.lat, lng: n.lng, floor: n.floor, kind: 'node', nodeId: id, nodeType: n.type, name: n.name });
        });
      }
      if (dE <= SHORT) pts.push({ lat: eSnap.point.lat, lng: eSnap.point.lng, floor: end.floor, kind: 'end', destName: end.name || '' });
      else {
        pts.push({ lat: eSnap.point.lat, lng: eSnap.point.lng, floor: end.floor, kind: 'snap', connectorNext: true });
        pts.push({ lat: end.lat, lng: end.lng, floor: end.floor, kind: 'end', destName: end.name || '' });
      }
      return finalizeRoute(tidyPoints(pts), 'graph', this.opts, { snapStart: sSnap.dist, snapEnd: eSnap.dist, door: !!door });
    }

    _astar(sources, targets, endPoint, accessible) {
      const T = '\u0000T';
      const g = new Map(), prev = new Map(), closed = new Set();
      const open = new MinHeap();
      const h = id => distance(this.nodes.get(id), endPoint);
      sources.forEach(s => { if (!g.has(s.id) || s.g < g.get(s.id)) { g.set(s.id, s.g); open.push(s.g + h(s.id), s.id); } });
      while (open.size) {
        const [, u] = open.pop();
        if (u === T) {
          const ids = []; let cur = prev.get(T);
          while (cur != null) { ids.push(cur); cur = prev.get(cur); }
          return { ids: ids.reverse(), cost: g.get(T) };
        }
        if (closed.has(u)) continue;
        closed.add(u);
        if (targets.has(u)) {
          const tg = g.get(u) + targets.get(u);
          if (!g.has(T) || tg < g.get(T)) { g.set(T, tg); prev.set(T, u); open.push(tg, T); }
        }
        for (const e of this.adj.get(u)) {
          if (accessible && e.kind === 'stairs') continue;
          if (closed.has(e.to)) continue;
          const ng = g.get(u) + e.cost;
          if (!g.has(e.to) || ng < g.get(e.to)) { g.set(e.to, ng); prev.set(e.to, u); open.push(ng + h(e.to), e.to); }
        }
      }
      return null;
    }
  }

  // ------------------------------------------------------------------ route assembly
  function tidyPoints(pts) {
    const out = [];
    pts.forEach(p => {
      const last = out[out.length - 1];
      if (last && last.floor === p.floor && distance(last, p) < 0.8) {
        // collapse near-duplicates (the later point's outgoing segment becomes the merged point's)
        if (p.kind === 'end') { last.kind = 'end'; last.destName = p.destName; }
        if (p.nodeId && !last.nodeId) { last.nodeId = p.nodeId; last.nodeType = p.nodeType; last.name = p.name; }
        last.via = p.via;
        last.connectorNext = p.connectorNext;
        return;
      }
      out.push(Object.assign({}, p));
    });
    if (out.length === 1) out.push(Object.assign({}, out[0], { kind: 'end' }));
    out[0].kind = 'start';
    out[out.length - 1].kind = 'end';
    out[out.length - 1].connectorNext = false;
    return out;
  }

  function segmentInfo(pts) {
    const segs = []; let cum = 0;
    for (let i = 0; i < pts.length; i++) {
      pts[i].cum = cum;
      if (i === pts.length - 1) break;
      const p = pts[i], q = pts[i + 1];
      const vertical = p.floor !== q.floor;
      const len = vertical ? 0 : distance(p, q);
      segs.push({ idx: i, vertical, len, floor: p.floor, toFloor: q.floor, kind: vertical ? (p.via || 'stairs') : 'walk', connector: !vertical && !!p.connectorNext, heading: vertical ? null : bearing(p, q), cum0: cum, cum1: cum + len });
      cum += len;
    }
    return { segs, total: cum };
  }

  function finalizeRoute(pts, mode, opts, meta) {
    const { segs, total } = segmentInfo(pts);
    let seconds = 0;
    segs.forEach(s => {
      if (!s.vertical) seconds += s.len / opts.walkSpeed;
      else {
        const f = Math.abs(s.toFloor - s.floor);
        seconds += s.kind === 'elevator' ? opts.elevatorSeconds + opts.elevatorSecondsPerFloor * f : opts.stairsSecondsPerFloor * f;
      }
    });
    const route = {
      mode, points: pts, segments: segs, total, seconds,
      startFloor: pts[0].floor, endFloor: pts[pts.length - 1].floor,
      steps: buildSteps(pts, segs, opts),
      meta: meta || {}
    };
    return route;
  }

  /** A straight line, used when there is no walkway data covering start/destination. */
  function directRoute(start, end, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (start.floor !== end.floor) return null;
    const pts = tidyPoints([
      { lat: start.lat, lng: start.lng, floor: start.floor, kind: 'start', connectorNext: true },
      { lat: end.lat, lng: end.lng, floor: end.floor, kind: 'end', destName: end.name || '' }
    ]);
    pts[0].connectorNext = true;
    return finalizeRoute(pts, 'direct', opts, {});
  }

  /**
   * Heading of the route over ~minLen metres before (dir<0) / after (dir>0) point i. Short kinks are
   * smoothed by looking further along, but never across a real bend (>40°), or that bend would be
   * double-counted as a second turn.
   */
  function smoothHeading(pts, segs, i, dir, minLen) {
    let k = dir < 0 ? i - 1 : i;
    if (k < 0 || k >= segs.length || segs[k].vertical) return null;
    const h0 = segs[k].heading;
    let acc = 0, far = null;
    while (k >= 0 && k < segs.length && !segs[k].vertical && Math.abs(angleDiff(h0, segs[k].heading)) < 40) {
      far = dir < 0 ? pts[k] : pts[k + 1];
      acc += segs[k].len;
      if (acc >= minLen) break;
      k += dir;
    }
    if (!far) return h0;
    return dir < 0 ? bearing(far, pts[i]) : bearing(pts[i], far);
  }

  function classifyTurn(deg, turnMin) {
    const a = Math.abs(deg);
    if (a < turnMin) return null;
    const side = deg > 0 ? 'right' : 'left';
    if (a < 55) return 'slight_' + side;
    if (a < 125) return side;
    if (a < 172) return 'sharp_' + side;
    return 'uturn';
  }

  /**
   * Maneuver list. Each step: {type:'head'|'turn'|'vertical'|'arrive', dir?, heading?, kind?, fromFloor?,
   * toFloor?, idx, cum, distance, floor, point}.  `distance` = length of the walk *after* the maneuver.
   */
  function buildSteps(pts, segs, opts) {
    opts = opts || DEFAULTS;
    const men = [];
    const n = pts.length;
    const verticalRun = i => {                 // vertical run starting at point i
      let j = i, kind = segs[i].kind;
      while (j < segs.length && segs[j].vertical && segs[j].kind === kind) j++;
      return { end: j, kind };
    };
    let i = 0;
    while (i < n - 1) {
      const seg = segs[i];
      const prevSeg = i > 0 ? segs[i - 1] : null;
      if (seg.vertical) {
        if (!prevSeg || !prevSeg.vertical || prevSeg.kind !== seg.kind) {
          const run = verticalRun(i);
          const toFloor = pts[run.end].floor;
          men.push({ type: 'vertical', kind: run.kind, fromFloor: pts[i].floor, toFloor, up: toFloor > pts[i].floor, idx: i });
          i = run.end;
          continue;
        }
      } else if (!prevSeg || prevSeg.vertical) {
        men.push({ type: 'head', heading: smoothHeading(pts, segs, i, +1, 6) ?? seg.heading, idx: i });
      } else {
        const hin = smoothHeading(pts, segs, i, -1, 8), hout = smoothHeading(pts, segs, i, +1, 8);
        if (hin != null && hout != null) {
          const dir = classifyTurn(angleDiff(hin, hout), opts.turnMin);
          if (dir) men.push({ type: 'turn', dir, angle: angleDiff(hin, hout), idx: i });
        }
      }
      i++;
    }
    men.push({ type: 'arrive', idx: n - 1 });

    men.forEach((m, k) => {
      const p = pts[m.idx];
      const nextIdx = k + 1 < men.length ? men[k + 1].idx : m.idx;
      m.cum = p.cum;
      m.floor = p.floor;
      m.point = { lat: p.lat, lng: p.lng };
      m.distance = Math.max(0, (pts[nextIdx].cum) - p.cum);
      m.name = m.type === 'arrive' ? (pts[n - 1].destName || '') : (p.name || '');
    });
    return men;
  }

  // ------------------------------------------------------------------ route helpers
  /** Position (and floor) at `d` metres along the route — used by the demo walker and tests. */
  function pointAt(route, d) {
    const pts = route.points;
    d = Math.max(0, Math.min(route.total, d));
    for (const s of route.segments) {
      if (s.vertical) continue;
      if (d <= s.cum1 + 1e-9) {
        const t = s.len ? (d - s.cum0) / s.len : 0;
        const p = lerp(pts[s.idx], pts[s.idx + 1], t);
        return { lat: p.lat, lng: p.lng, floor: s.floor };
      }
    }
    const last = pts[pts.length - 1];
    return { lat: last.lat, lng: last.lng, floor: last.floor };
  }

  /**
   * Route as drawable polylines: [{floor, coords:[[lng,lat],...], passed, connector}].
   * `passed` parts (behind `progress`) are split off so the UI can grey them out.
   */
  function routeLines(route, progress) {
    const out = [];
    const add = (floor, A, B, passed, connector) => {
      const last = out[out.length - 1];
      if (last && last.floor === floor && last.passed === passed && last.connector === connector) last.coords.push([B.lng, B.lat]);
      else out.push({ floor, passed, connector, coords: [[A.lng, A.lat], [B.lng, B.lat]] });
    };
    route.segments.forEach(s => {
      if (s.vertical) return;
      const a = route.points[s.idx], b = route.points[s.idx + 1];
      if (progress == null || progress <= s.cum0 + 1e-6) add(s.floor, a, b, false, s.connector);
      else if (progress >= s.cum1 - 1e-6) add(s.floor, a, b, true, s.connector);
      else {
        const m = lerp(a, b, (progress - s.cum0) / s.len);
        add(s.floor, a, m, true, s.connector);
        add(s.floor, m, b, false, s.connector);
      }
    });
    return out;
  }

  // ------------------------------------------------------------------ live progress
  class RouteProgress {
    constructor(route, options) {
      this.opts = Object.assign({}, DEFAULTS, options || {});
      this.destPolygon = (options && options.destPolygon) || null;
      this.reset(route);
    }

    reset(route) {
      this.route = route;
      this.progress = 0;
      this.segIdx = route.segments.findIndex(s => !s.vertical && s.len > 0);
      if (this.segIdx < 0) this.segIdx = 0;
      this.offCount = 0;
    }

    /** Index of the next maneuver the user has not passed yet (the one to show in the banner). */
    upcomingStep() {
      const steps = this.route.steps;
      const s = this.segIdx, p = this.progress;
      for (let j = 0; j < steps.length; j++) {
        const m = steps[j];
        if (m.idx > s) return j;
        if (m.idx === s && p - m.cum < 4) return j;
      }
      return steps.length - 1;
    }

    /** Jump to the start of maneuver `j` (manual stepping when GPS is unavailable/inaccurate). */
    setStep(j) {
      const m = this.route.steps[Math.max(0, Math.min(this.route.steps.length - 1, j))];
      this.progress = m.cum;
      // segment that starts at this maneuver (or the last walk segment before it)
      let k = this.route.segments.findIndex(s => s.idx >= m.idx && !s.vertical && s.len > 0);
      if (k < 0) k = Math.max(0, this.route.segments.length - 1);
      this.segIdx = this.route.segments[k] ? this.route.segments[k].idx : 0;
      if (m.type === 'vertical') {          // wait at the foot of the stairs
        let q = this.route.segments.slice(0, m.idx).reverse().find(s => !s.vertical && s.len > 0);
        if (q) this.segIdx = q.idx;
      }
      this.offCount = 0;
      return m;
    }

    expectedFloor() {
      const s = this.route.segments[this.segIdx];
      return s ? s.floor : this.route.startFloor;
    }

    /**
     * pos: {lat,lng,floor,accuracy}. Returns
     * {status:'ok'|'off'|'arrived'|'wrongFloor', progress, remaining, distToRoute, stepIndex, expectedFloor}
     */
    update(pos) {
      const r = this.route, acc = Math.max(0, pos.accuracy || 0);
      const offLimit = Math.max(25, Math.min(acc * 1.2, 60));
      const arriveR = Math.max(10, Math.min(acc * 0.6, 25));
      const end = r.points[r.points.length - 1];
      const out = (status, extra) => Object.assign({
        status, progress: this.progress, remaining: Math.max(0, r.total - this.progress),
        distToRoute: 0, stepIndex: this.upcomingStep(), expectedFloor: this.expectedFloor()
      }, extra || {});

      if (pos.floor === end.floor) {
        const dEnd = distance(pos, end);
        const inside = this.destPolygon && pointInPolygon(pos, this.destPolygon) && this.progress >= r.total - 80;
        if (dEnd <= arriveR || inside) {
          this.progress = r.total; this.segIdx = Math.max(this.segIdx, r.segments.length - 1);
          return out('arrived', { distToRoute: dEnd, stepIndex: r.steps.length - 1, remaining: 0 });
        }
      }

      const walk = r.segments.filter(s => !s.vertical && s.len > 0 && s.floor === pos.floor && s.idx >= this.segIdx - 2);
      if (!walk.length) return out('wrongFloor');

      const best = list => {
        let b = null;
        list.forEach(s => {
          const q = project(pos, r.points[s.idx], r.points[s.idx + 1]);
          if (!b || q.dist < b.dist - 1) b = { s, q, dist: q.dist };     // ties (≤1 m) go to the earlier segment
        });
        return b;
      };
      const near = walk.filter(s => s.idx <= this.segIdx + 10);
      let hit = best(near);
      if (!hit || hit.dist > offLimit) {
        const far = best(walk.filter(s => s.idx > this.segIdx + 10));
        if (far && (!hit || far.dist < hit.dist)) hit = far;
      }
      if (!hit || hit.dist > offLimit) {
        this.offCount++;
        return out('off', { distToRoute: hit ? hit.dist : Infinity, offCount: this.offCount });
      }
      this.offCount = 0;
      this.progress = Math.max(this.progress, hit.s.cum0 + hit.q.t * hit.s.len);
      this.segIdx = Math.max(this.segIdx, hit.s.idx);
      return out('ok', { distToRoute: hit.dist });
    }

    /** Remaining time (s) from current progress. */
    remainingSeconds() {
      const o = this.opts; let secs = 0;
      this.route.segments.forEach(s => {
        if (s.vertical) {
          if (s.idx >= this.segIdx + 1 || (s.idx > this.segIdx)) {
            const f = Math.abs(s.toFloor - s.floor);
            secs += s.kind === 'elevator' ? o.elevatorSeconds + o.elevatorSecondsPerFloor * f : o.stairsSecondsPerFloor * f;
          }
        } else if (s.cum1 > this.progress) secs += (s.cum1 - Math.max(s.cum0, this.progress)) / o.walkSpeed;
      });
      return secs;
    }
  }

  return {
    DEFAULTS, distance, bearing, angleDiff, project, lerp, pointInPolygon, polygonCentroid,
    distanceToPolygon, nearestPointOnPolygon, MinHeap, NavGraph, directRoute, buildSteps, pointAt,
    routeLines, RouteProgress, classifyTurn
  };
}));
