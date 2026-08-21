// =================== LEAFLET COMPATIBILITY SHIM ===================
// Provides L.* API backed by MapLibre GL JS via MapEngine.
// This allows existing code to work with minimal changes during migration.
// IMPORTANT: This is a transitional layer. Over time, code should use
// MapEngine directly and this file can be removed.

const L = {
  // ---- Utilities ----
  latLng: function(lat, lng) {
    if (Array.isArray(lat)) { lng = lat[1]; lat = lat[0]; }
    if (typeof lat === 'object' && lat.lat !== undefined) { lng = lat.lng; lat = lat.lat; }
    return {
      lat: lat,
      lng: lng,
      distanceTo: function(other) {
        return MapEngine.distance(lat, lng, other.lat, other.lng);
      }
    };
  },

  latLngBounds: function(corner1, corner2) {
    const sw = L.latLng(corner1);
    const ne = L.latLng(corner2);
    return {
      _sw: sw,
      _ne: ne,
      getSouthWest: () => sw,
      getNorthEast: () => ne,
      getCenter: () => L.latLng((sw.lat + ne.lat) / 2, (sw.lng + ne.lng) / 2),
      contains: (ll) => {
        const p = L.latLng(ll);
        return p.lat >= sw.lat && p.lat <= ne.lat && p.lng >= sw.lng && p.lng <= ne.lng;
      },
      extend: function(ll) {
        const p = L.latLng(ll);
        this._sw = L.latLng(Math.min(this._sw.lat, p.lat), Math.min(this._sw.lng, p.lng));
        this._ne = L.latLng(Math.max(this._ne.lat, p.lat), Math.max(this._ne.lng, p.lng));
        return this;
      }
    };
  },

  DomEvent: {
    stopPropagation: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
    preventDefault: (e) => { if (e && e.preventDefault) e.preventDefault(); }
  },

  // ---- Markers ----
  marker: function(latlng, options = {}) {
    const pos = L.latLng(latlng);
    let _markerId = null;
    let _popup = null;
    let _popupContent = '';
    let _popupOptions = {};
    let _clickHandlers = [];
    let _dragEndHandlers = [];
    let _added = false;

    const marker = {
      _latlng: pos,
      getLatLng: () => marker._latlng,
      setLatLng: (ll) => {
        marker._latlng = L.latLng(ll);
        if (_markerId) mapEngine.updateMarkerPosition(_markerId, [marker._latlng.lat, marker._latlng.lng]);
        return marker;
      },
      addTo: (mapObj) => {
        const iconOpts = options.icon || {};
        _markerId = mapEngine.addMarker([pos.lat, pos.lng], {
          className: iconOpts._className || 'compat-marker',
          html: iconOpts._html || '<i class="fa-solid fa-map-pin" style="font-size:28px;color:#0a84ff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>',
          draggable: options.draggable || false,
          popup: _popupContent || undefined,
          onClick: (m, e) => _clickHandlers.forEach(fn => fn({ latlng: marker._latlng })),
          onDragEnd: (newPos) => {
            marker._latlng = L.latLng(newPos.lat, newPos.lng);
            _dragEndHandlers.forEach(fn => fn({ target: marker }));
          }
        });
        _added = true;
        return marker;
      },
      remove: () => {
        if (_markerId) { mapEngine.removeMarker(_markerId); _markerId = null; }
        if (_popup) { _popup.remove(); _popup = null; }
        return marker;
      },
      bindPopup: (content, popupOpts = {}) => {
        _popupContent = content;
        _popupOptions = popupOpts;
        if (_markerId) {
          // Remove existing popup first
          const markerObj = mapEngine.getMarker(_markerId);
          if (markerObj) {
            const popup = new maplibregl.Popup({
              offset: 25,
              closeButton: popupOpts.closeButton !== false,
              closeOnClick: popupOpts.closeOnClick !== false,
              className: popupOpts.className || ''
            }).setHTML(content);
            markerObj.setPopup(popup);
            _popup = popup;
          }
        }
        return marker;
      },
      openPopup: () => {
        if (_markerId) {
          const markerObj = mapEngine.getMarker(_markerId);
          if (markerObj) {
            if (!markerObj.getPopup() && _popupContent) {
              // Create popup if not yet bound
              const popup = new maplibregl.Popup({
                offset: 25,
                closeButton: _popupOptions.closeButton !== false,
                closeOnClick: _popupOptions.closeOnClick !== false,
                className: _popupOptions.className || ''
              }).setHTML(_popupContent);
              markerObj.setPopup(popup);
              _popup = popup;
            }
            markerObj.togglePopup();
          }
        }
        return marker;
      },
      on: (event, fn) => {
        if (event === 'click') _clickHandlers.push(fn);
        if (event === 'dragend') _dragEndHandlers.push(fn);
        return marker;
      },
      _engineId: () => _markerId,
      setZIndexOffset: () => marker,
      setIcon: () => marker,
      bindTooltip: () => marker,
      closeTooltip: () => marker
    };
    return marker;
  },

  divIcon: function(options = {}) {
    return {
      _className: options.className || '',
      _html: options.html || '',
      _iconSize: options.iconSize,
      _iconAnchor: options.iconAnchor
    };
  },

  // ---- Polyline ----
  polyline: function(latlngs, options = {}) {
    const id = `compat_line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let _coords = (latlngs || []).map(ll => Array.isArray(ll) ? ll : [ll.lat, ll.lng]);
    let _added = false;
    let _clickHandlers = [];

    const poly = {
      _id: id,
      addTo: (mapObj) => {
        mapEngine._ready.then(() => {
          try {
            if (_coords.length >= 2) {
              mapEngine.addLine(id, _coords, {
                color: options.color || '#0a84ff',
                weight: options.weight || 5,
                opacity: options.opacity || 1,
                dashArray: options.dashArray,
                onClick: (e) => {
                  const pos = MapEngine.eventLatLng(e);
                  _clickHandlers.forEach(fn => fn({ latlng: L.latLng(pos.lat, pos.lng) }));
                }
              });
            }
          } catch (err) { console.warn('Polyline addTo error:', err); }
        });
        _added = true;
        return poly;
      },
      setLatLngs: (newCoords) => {
        _coords = (newCoords || []).map(ll => Array.isArray(ll) ? ll : [ll.lat, ll.lng]);
        if (_added && _coords.length >= 2) {
          if (!mapEngine.map.getSource(`line-src-${id}`)) {
            try {
              mapEngine.addLine(id, _coords, {
                color: options.color || '#0a84ff',
                weight: options.weight || 5,
                opacity: options.opacity || 1,
                dashArray: options.dashArray,
                onClick: (e) => {
                  const pos = MapEngine.eventLatLng(e);
                  _clickHandlers.forEach(fn => fn({ latlng: L.latLng(pos.lat, pos.lng) }));
                }
              });
            } catch (err) { console.warn('Polyline deferred addTo error:', err); }
          } else {
            try { mapEngine.updateLine(id, _coords); } catch (e) { }
          }
        }
        return poly;
      },
      remove: () => {
        try { mapEngine.removeLine(id); } catch (e) { }
        _added = false;
        return poly;
      },
      getBounds: () => {
        if (_coords.length === 0) return L.latLngBounds([0, 0], [0, 0]);
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        _coords.forEach(c => {
          minLat = Math.min(minLat, c[0]); maxLat = Math.max(maxLat, c[0]);
          minLng = Math.min(minLng, c[1]); maxLng = Math.max(maxLng, c[1]);
        });
        return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
      },
      on: (event, fn) => {
        if (event === 'click') _clickHandlers.push(fn);
        return poly;
      },
      getLatLngs: () => _coords.map(c => L.latLng(c)),
      setStyle: (style) => {
        try { mapEngine.setLineStyle(id, style); } catch (e) { }
        return poly;
      }
    };
    return poly;
  },

  // ---- Polygon ----
  polygon: function(latlngs, options = {}) {
    const id = `compat_poly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let _coords = (latlngs || []).map(ll => Array.isArray(ll) ? ll : [ll.lat, ll.lng]);
    let _added = false;
    let _clickHandlers = [];
    let _tooltip = null;

    const poly = {
      _id: id,
      addTo: (mapObj) => {
        mapEngine._ready.then(() => {
          try {
            if (_coords.length >= 3) {
              mapEngine.addPolygon(id, _coords, {
                color: options.color || '#4A90E2',
                fillColor: options.fillColor || options.color || '#4A90E2',
                fillOpacity: options.fillOpacity || 0.4,
                weight: options.weight || 2,
                onClick: (e) => {
                  const pos = MapEngine.eventLatLng(e);
                  _clickHandlers.forEach(fn => fn({ latlng: L.latLng(pos.lat, pos.lng) }));
                }
              });
            }
          } catch (err) { console.warn('Polygon addTo error:', err); }
        });
        _added = true;
        return poly;
      },
      setLatLngs: (newCoords) => {
        _coords = (newCoords || []).map(ll => Array.isArray(ll) ? ll : [ll.lat, ll.lng]);
        if (_added && _coords.length >= 3) {
          if (!mapEngine.map.getSource(`poly-src-${id}`)) {
            try {
              mapEngine.addPolygon(id, _coords, {
                color: options.color || '#4A90E2',
                fillColor: options.fillColor || options.color || '#4A90E2',
                fillOpacity: options.fillOpacity || 0.4,
                weight: options.weight || 2,
                onClick: (e) => {
                  const pos = MapEngine.eventLatLng(e);
                  _clickHandlers.forEach(fn => fn({ latlng: L.latLng(pos.lat, pos.lng) }));
                }
              });
            } catch (err) { console.warn('Polygon deferred addTo error:', err); }
          } else {
            try { mapEngine.updatePolygon(id, _coords); } catch (e) { }
          }
        }
        return poly;
      },
      remove: () => {
        try { mapEngine.removePolygon(id); } catch (e) { }
        if (_tooltip) try { _tooltip.remove(); } catch (e) { }
        _added = false;
        return poly;
      },
      getBounds: () => {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        _coords.forEach(c => {
          minLat = Math.min(minLat, c[0]); maxLat = Math.max(maxLat, c[0]);
          minLng = Math.min(minLng, c[1]); maxLng = Math.max(maxLng, c[1]);
        });
        return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
      },
      setStyle: (style) => {
        try { mapEngine.setPolygonStyle(id, style); } catch (e) { }
        return poly;
      },
      bindTooltip: (content, opts) => {
        // Tooltips handled via Tippy or custom labels
        return poly;
      },
      on: (event, fn) => {
        if (event === 'click') _clickHandlers.push(fn);
        return poly;
      }
    };
    return poly;
  },

  // ---- Circle / CircleMarker ----
  circleMarker: function(latlng, options = {}) {
    const pos = L.latLng(latlng);
    const r = options.radius || 6;
    const fillColor = options.fillColor || options.color || '#0a84ff';
    const borderColor = options.color || fillColor;
    let _markerId = null;
    let _tooltipContent = '';
    let _tooltipOpts = {};
    let _tooltipPopup = null;
    let _eventHandlers = {};
    let _currentStyle = { radius: r, fillColor: fillColor, color: borderColor, fillOpacity: options.fillOpacity || 0.9, weight: options.weight || 1 };

    function buildHTML(style) {
      const sz = (style.radius || r) * 2;
      return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${style.fillColor || fillColor};opacity:${style.fillOpacity || 0.9};border:${style.weight || 1}px solid ${style.color || borderColor};cursor:pointer;"></div>`;
    }

    const cm = {
      _latlng: pos,
      _pointIndex: undefined,
      getLatLng: () => cm._latlng,
      setLatLng: (ll) => {
        cm._latlng = L.latLng(ll);
        if (_markerId) mapEngine.updateMarkerPosition(_markerId, [cm._latlng.lat, cm._latlng.lng]);
        return cm;
      },
      addTo: (mapObj) => {
        _markerId = mapEngine.addMarker([pos.lat, pos.lng], {
          html: buildHTML(_currentStyle),
          className: options.className || 'circle-marker-compat',
          anchor: 'center'
        });
        // Attach mousedown handler to the marker element
        if (_eventHandlers['mousedown']) {
          const markerObj = mapEngine.getMarker(_markerId);
          if (markerObj) {
            const el = markerObj.getElement();
            if (el) {
              el.addEventListener('mousedown', (e) => {
                _eventHandlers['mousedown'].forEach(fn => fn({ originalEvent: e, latlng: cm._latlng }));
              });
            }
          }
        }
        return cm;
      },
      remove: () => {
        if (_markerId) { mapEngine.removeMarker(_markerId); _markerId = null; }
        if (_tooltipPopup) { _tooltipPopup.remove(); _tooltipPopup = null; }
        return cm;
      },
      setStyle: (style) => {
        Object.assign(_currentStyle, style);
        if (_markerId) {
          mapEngine.setMarkerElement(_markerId, buildHTML(_currentStyle));
          // Re-attach mousedown after element rebuild
          if (_eventHandlers['mousedown']) {
            const markerObj = mapEngine.getMarker(_markerId);
            if (markerObj) {
              const el = markerObj.getElement();
              if (el) {
                el.addEventListener('mousedown', (e) => {
                  _eventHandlers['mousedown'].forEach(fn => fn({ originalEvent: e, latlng: cm._latlng }));
                });
              }
            }
          }
        }
        return cm;
      },
      bindTooltip: (content, opts = {}) => {
        _tooltipContent = content;
        _tooltipOpts = opts;
        return cm;
      },
      openTooltip: () => {
        if (_tooltipContent && cm._latlng && !_tooltipPopup) {
          _tooltipPopup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: _tooltipOpts.className || 'compat-tooltip',
            offset: _tooltipOpts.offset || [0, -10],
            anchor: 'bottom'
          })
            .setLngLat([cm._latlng.lng, cm._latlng.lat])
            .setHTML(`<div class="compat-tooltip">${_tooltipContent}</div>`)
            .addTo(mapEngine.map);
        }
        return cm;
      },
      closeTooltip: () => {
        if (_tooltipPopup) { _tooltipPopup.remove(); _tooltipPopup = null; }
        return cm;
      },
      on: (event, fn) => {
        if (!_eventHandlers[event]) _eventHandlers[event] = [];
        _eventHandlers[event].push(fn);
        // If already added to map, attach mousedown immediately
        if (event === 'mousedown' && _markerId) {
          const markerObj = mapEngine.getMarker(_markerId);
          if (markerObj) {
            const el = markerObj.getElement();
            if (el) {
              el.addEventListener('mousedown', (e) => {
                fn({ originalEvent: e, latlng: cm._latlng });
              });
            }
          }
        }
        return cm;
      },
      bindPopup: () => cm
    };
    return cm;
  },

  circle: function(latlng, options = {}) {
    const pos = L.latLng(latlng);
    const id = `compat_circle_${Date.now()}`;
    let _added = false;

    const c = {
      addTo: (mapObj) => {
        mapEngine._ready.then(() => {
          try {
            mapEngine.addCircle(id, [pos.lat, pos.lng], options.radius || 50, {
              color: options.color || 'rgba(10, 132, 255, 0.15)',
              outlineColor: options.color || 'rgba(10, 132, 255, 0.4)'
            });
          } catch (e) { }
        });
        _added = true;
        return c;
      },
      setLatLng: (ll) => {
        // Would need to rebuild circle; simplified for now
        return c;
      },
      setRadius: () => c,
      remove: () => {
        try { mapEngine.removeCircle(id); } catch (e) { }
        return c;
      }
    };
    return c;
  },

  // ---- Rectangle ----
  rectangle: function(bounds, options = {}) {
    const b = Array.isArray(bounds[0]) ? bounds : [bounds[0], bounds[1]];
    const coords = [
      b[0],
      [b[0][0], b[1][1]],
      b[1],
      [b[1][0], b[0][1]]
    ];
    const poly = L.polygon(coords, options);
    poly.setBounds = function(newBounds) {
      const nb = Array.isArray(newBounds[0]) ? newBounds : [newBounds[0], newBounds[1]];
      this.setLatLngs([
        nb[0],
        [nb[0][0], nb[1][1]],
        nb[1],
        [nb[1][0], nb[0][1]]
      ]);
      return this;
    };
    return poly;
  },

  // ---- Popup ----
  popup: function(options = {}) {
    let _content = '';
    let _latlng = null;

    const p = {
      setLatLng: (ll) => { _latlng = L.latLng(ll); return p; },
      setContent: (html) => { _content = html; return p; },
      openOn: (mapObj) => {
        if (_latlng) {
          mapEngine.showPopup([_latlng.lat, _latlng.lng], _content, options);
        }
        return p;
      },
      remove: () => { mapEngine.closePopup(); return p; }
    };
    return p;
  },

  // ---- Tooltip (as popup-like element) ----
  tooltip: function(options = {}) {
    // MapLibre doesn't have native tooltips like Leaflet.
    // We use a maplibregl.Popup with closeButton:false as a label.
    const id = `compat_tooltip_${Date.now()}`;
    let _popup = null;

    const t = {
      setLatLng: (ll) => {
        const pos = L.latLng(ll);
        if (_popup) _popup.setLngLat([pos.lng, pos.lat]);
        t._latlng = pos;
        return t;
      },
      setContent: (html) => {
        t._content = html;
        if (_popup) _popup.setHTML(`<div class="compat-tooltip">${html}</div>`);
        return t;
      },
      addTo: (mapObj) => {
        if (t._latlng) {
          _popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: options.permanent ? 'permanent-tooltip' : 'hover-tooltip',
            offset: options.offset || [0, 0]
          })
            .setLngLat([t._latlng.lng, t._latlng.lat])
            .setHTML(`<div class="compat-tooltip">${t._content || ''}</div>`)
            .addTo(mapEngine.map);
        }
        return t;
      },
      remove: () => {
        if (_popup) { _popup.remove(); _popup = null; }
        return t;
      }
    };
    return t;
  }
};

// ---- Patch map methods to handle Leaflet-style calls ----
// These run after map is created in script.js, so we patch in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Use mapEngine.map directly, because 'map' might refer to the HTMLDivElement
  setTimeout(() => {
    const actualMap = window.mapEngine ? window.mapEngine.map : null;
    if (actualMap) {
      // map.removeLayer compatibility (for L.marker/polyline/polygon .remove())
      const _originalRemoveLayer = actualMap.removeLayer;
      actualMap.removeLayer = function(layer) {
        if (layer && typeof layer.remove === 'function') {
          layer.remove();
        } else if (_originalRemoveLayer) {
          _originalRemoveLayer.call(actualMap, layer);
        }
      };

      // map.hasLayer compatibility
      actualMap.hasLayer = function(layer) {
        if (layer && layer._id) {
          return mapEngine._markers.has(layer._id) || !!mapEngine.map.getSource(`line-src-${layer._id}`);
        }
        return false;
      };

      // map.closePopup compatibility
      const _origClosePopup = actualMap.closePopup;
      actualMap.closePopup = function() {
        mapEngine.closePopup();
      };

      // map.fitBounds with L.latLngBounds compatibility
      if (actualMap.fitBounds) {
        const _origFitBounds = actualMap.fitBounds.bind(actualMap);
        actualMap.fitBounds = function(bounds, options = {}) {
          if (bounds._sw) {
            // L.latLngBounds object
            const sw = [bounds._sw.lng, bounds._sw.lat];
            const ne = [bounds._ne.lng, bounds._ne.lat];
            _origFitBounds([sw, ne], { padding: options.padding ? { top: options.padding[0], bottom: options.padding[0], left: options.padding[1], right: options.padding[1] } : 50 });
          } else if (Array.isArray(bounds)) {
            // [[lat,lng],[lat,lng]]
            mapEngine.fitBounds(bounds, options);
          } else {
            _origFitBounds(bounds, options);
          }
        };
      }
    }
  }, 100);
});

    // NOTE: map.on wrapping is handled by patchMapCompat() in script.js
    // Do NOT re-wrap here or map.off() will break due to mismatched handler references
  }
});

window.L = L;
