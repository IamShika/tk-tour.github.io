// =================== MAP ENGINE (MapLibre GL JS) ===================
// Wraps MapLibre GL JS with a clean API for the school tour project.
// Handles [lat,lng] ↔ [lng,lat] conversion automatically.
// All public methods accept [lat, lng] order (like Leaflet).

class MapEngine {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this._markers = new Map();
    this._popups = new Map();
    this._sourceCounter = 0;
    this._markerCounter = 0;
    this._activePopup = null;
    this._floorSourceId = null;
    this._floorLayerId = null;
    this._buildingsLoaded = false;
    this._eventHandlers = {};
    this._currentBaseLayer = 'osm';
    this._gistdaApiKey = null;
    this._gistdaLayerAdded = false;

    const center = options.center || [14.085933, 100.608844];
    // Start at a safe zoom that definitely has tiles, then fitBounds after load
    const zoom = options.zoom || 17;
    const bounds = options.bounds || null;

    // Calculate maxBounds from school bounds with padding
    const schoolBounds = bounds || [[14.083915, 100.606071], [14.086142, 100.610199]];
    const latPad = 0.003;
    const lngPad = 0.004;
    const maxBoundsArr = [
      [schoolBounds[0][1] - lngPad, schoolBounds[0][0] - latPad], // SW [lng, lat]
      [schoolBounds[1][1] + lngPad, schoolBounds[1][0] + latPad]  // NE [lng, lat]
    ];

    this.map = new maplibregl.Map({
      container: containerId,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19, // OSM tiles max at z19 — MapLibre will overscale beyond this
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        },
        layers: [{
          id: 'osm-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 22 // Allow rendering up to z22 by overscaling
        }]
      },
      center: this._toMapLibre(center),
      zoom: zoom,
      maxZoom: options.maxZoom || 21,
      minZoom: options.minZoom || 14,
      maxBounds: maxBoundsArr,
      pitch: 0,
      maxPitch: 0,
      bearing: 0,
      antialias: true
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

    // Wait for map to be ready, then fit to school bounds
    this._ready = new Promise(resolve => {
      let isResolved = false;
      const finish = () => {
        if (isResolved) return;
        isResolved = true;
        // Fit to school bounds on initial load for reliable positioning
        if (bounds) {
          const sw = this._toMapLibre(bounds[0]);
          const ne = this._toMapLibre(bounds[1]);
          this.map.fitBounds([sw, ne], {
            padding: { top: 60, bottom: 20, left: 20, right: 20 },
            duration: 0 // Instant on first load
          });
        }
        resolve();
      };

      this.map.on('load', finish);
      
      // Fallback: If map is stuck loading an asset, force resolve after 2 seconds
      setTimeout(finish, 2000);
    });
  }

  // ---- Coordinate Conversion ----
  // Input: [lat, lng] (user/data format)
  // Output: [lng, lat] (MapLibre format)
  _toMapLibre(latLng) {
    if (Array.isArray(latLng)) return [latLng[1], latLng[0]];
    if (latLng.lng !== undefined) return [latLng.lng, latLng.lat];
    return latLng;
  }

  _toLatLng(lngLat) {
    if (Array.isArray(lngLat)) return [lngLat[1], lngLat[0]];
    return { lat: lngLat.lat, lng: lngLat.lng };
  }

  _genId(prefix) {
    return `${prefix}_${++this._sourceCounter}`;
  }

  // ---- View Controls ----
  setView(latLng, zoom, options = {}) {
    this.map.flyTo({
      center: this._toMapLibre(latLng),
      zoom: zoom,
      duration: options.animate === false ? 0 : 1000
    });
  }

  panTo(latLng) {
    this.map.panTo(this._toMapLibre(latLng));
  }

  flyTo(latLng, zoom, options = {}) {
    this.map.flyTo({
      center: this._toMapLibre(latLng),
      zoom: zoom || this.map.getZoom(),
      pitch: options.pitch,
      bearing: options.bearing,
      duration: options.duration || 1500
    });
  }

  fitBounds(bounds, options = {}) {
    // bounds: [[lat1,lng1],[lat2,lng2]]
    const sw = this._toMapLibre(bounds[0]);
    const ne = this._toMapLibre(bounds[1]);
    this.map.fitBounds([sw, ne], {
      padding: options.padding || 50,
      duration: options.duration || 1000
    });
  }

  getZoom() { return this.map.getZoom(); }
  getCenter() { return this._toLatLng(this.map.getCenter()); }
  resize() { this.map.resize(); }

  // ---- Floor Image Overlay ----
  async setFloorOverlay(imageUrl, bounds) {
    await this._ready;
    // bounds: { topLeft, topRight, bottomRight, bottomLeft } each [lat,lng]
    const coords = [
      this._toMapLibre(bounds.topLeft),
      this._toMapLibre(bounds.topRight),
      this._toMapLibre(bounds.bottomRight),
      this._toMapLibre(bounds.bottomLeft)
    ];

    if (this._floorSourceId && this.map.getSource(this._floorSourceId)) {
      // Update existing
      this.map.getSource(this._floorSourceId).updateImage({ url: imageUrl, coordinates: coords });
    } else {
      this._floorSourceId = 'floor-overlay-source';
      this._floorLayerId = 'floor-overlay-layer';
      this.map.addSource(this._floorSourceId, {
        type: 'image',
        url: imageUrl,
        coordinates: coords
      });
      this.map.addLayer({
        id: this._floorLayerId,
        type: 'raster',
        source: this._floorSourceId,
        paint: { 'raster-opacity': 0.85 }
      });
    }
  }

  // ---- 3D Building Extrusions ----
  async loadBuildings(geojsonUrl) {
    await this._ready;
    try {
      const res = await fetch(geojsonUrl);
      const geojson = await res.json();
      // Always create the buildings layer, even if empty — structures may be added later
      this._addBuildingsLayer(geojson);
    } catch (e) {
      console.warn('Could not load buildings:', e);
      // Create an empty layer so addBuildingFromCoords can add to it
      this._addBuildingsLayer({ type: 'FeatureCollection', features: [] });
    }
  }

  _addBuildingsLayer(geojson) {
    // Protect against invalid GeoJSON (e.g. empty arrays)
    if (!geojson || Array.isArray(geojson) || !geojson.type) {
      geojson = { type: 'FeatureCollection', features: [] };
    }
    
    if (this._buildingsGeoJSON && this._buildingsGeoJSON.features && this._buildingsGeoJSON.features.length > 0) {
      const existingIds = new Set(this._buildingsGeoJSON.features.map(f => f.properties.id));
      (geojson.features || []).forEach(f => {
        if (!existingIds.has(f.properties.id)) {
          this._buildingsGeoJSON.features.push(f);
        }
      });
    } else {
      this._buildingsGeoJSON = geojson;
    }
    
    if (this.map.getSource('buildings-source')) {
      this.map.getSource('buildings-source').setData(this._buildingsGeoJSON);
      return;
    }
    this.map.addSource('buildings-source', { type: 'geojson', data: this._buildingsGeoJSON });
    
    // Add 2D Fill Layer (flat polygon)
    this.map.addLayer({
      id: 'buildings-2d',
      type: 'fill',
      source: 'buildings-source',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#00aaff'],
        'fill-opacity': 0.35
      }
    });

    // Add outline for buildings
    this.map.addLayer({
      id: 'buildings-outline',
      type: 'line',
      source: 'buildings-source',
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#0088dd'],
        'line-width': 2,
        'line-opacity': 0.8
      }
    });

    // Add Text Label Layer
    this.map.addLayer({
      id: 'buildings-labels',
      type: 'symbol',
      source: 'buildings-source',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 13,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-anchor': 'center',
        'text-justify': 'center',
        'text-allow-overlap': true,
        'symbol-placement': 'point'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1.5
      }
    });

    this._buildingsLoaded = true;
  }

  updateBuildingsData(geojson) {
    this._buildingsGeoJSON = geojson;
    const source = this.map.getSource('buildings-source');
    if (source) {
      source.setData(geojson);
    }
  }

  removeBuildingById(id) {
    if (!this._buildingsGeoJSON) return;
    const source = this.map.getSource('buildings-source');
    if (source) {
      this._buildingsGeoJSON.features = this._buildingsGeoJSON.features.filter(f => f.properties.id !== id);
      source.setData(this._buildingsGeoJSON);
    }
  }

  addBuildingFromCoords(id, coords, properties = {}) {
    // coords: array of [lat,lng] pairs
    // Convert to GeoJSON polygon coordinates [lng,lat]
    const ring = coords.map(c => this._toMapLibre(c));
    ring.push(ring[0]); // Close the ring

    const feature = {
      type: 'Feature',
      properties: { id, ...properties },
      geometry: { type: 'Polygon', coordinates: [ring] }
    };

    if (!this._buildingsGeoJSON) {
      this._buildingsGeoJSON = { type: 'FeatureCollection', features: [] };
    }
    
    // Check if building already exists and update it, or add new
    const existingIdx = this._buildingsGeoJSON.features.findIndex(f => f.properties.id === id);
    if (existingIdx !== -1) {
      this._buildingsGeoJSON.features[existingIdx] = feature;
    } else {
      this._buildingsGeoJSON.features.push(feature);
    }

    const source = this.map.getSource('buildings-source');
    if (source) {
      source.setData(this._buildingsGeoJSON);
    } else {
      this._addBuildingsLayer(this._buildingsGeoJSON);
    }
  }

  // ---- Markers ----
  addMarker(latLng, options = {}) {
    const id = options.id || `marker_${++this._markerCounter}`;
    const el = document.createElement('div');
    el.className = options.className || 'map-marker';
    el.innerHTML = options.html || '<i class="fa-solid fa-map-pin" style="font-size:32px;color:#0a84ff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>';
    if (options.style) Object.assign(el.style, options.style);

    const marker = new maplibregl.Marker({
      element: el,
      anchor: options.anchor || 'bottom',
      draggable: options.draggable || false
    }).setLngLat(this._toMapLibre(latLng));

    if (options.popup) {
      const popup = new maplibregl.Popup({ offset: options.popupOffset || 25, closeButton: true })
        .setHTML(options.popup);
      marker.setPopup(popup);
    }

    marker.addTo(this.map);
    marker._engineId = id;

    if (options.onClick) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close all other open popups
        this._markers.forEach(m => {
          const p = m.getPopup();
          if (m !== marker && p && p.isOpen()) {
            p.remove();
          }
        });

        if (marker.getPopup()) marker.togglePopup();
        options.onClick(marker, e);
      });
    }

    marker._floor = options.floor; // Store floor for visibility filtering

    if (options.draggable && options.onDragEnd) {
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        options.onDragEnd({ lat: pos.lat, lng: pos.lng }, marker);
      });
    }

    this._markers.set(id, marker);
    return id;
  }

  removeMarker(id) {
    const marker = this._markers.get(id);
    if (marker) {
      marker.remove();
      this._markers.delete(id);
    }
  }

  getMarker(id) { return this._markers.get(id); }

  setMarkerPopup(id, html) {
    const marker = this._markers.get(id);
    if (!marker) return;
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(html);
    marker.setPopup(popup);
  }

  updateMarkerVisibility(currentFloor) {
    this._markers.forEach(marker => {
      if (marker._floor !== undefined && marker._floor !== null) {
        marker.getElement().style.display = (marker._floor === currentFloor) ? 'block' : 'none';
      }
    });
  }

  openMarkerPopup(id) {
    const marker = this._markers.get(id);
    if (marker) {
      this._markers.forEach(m => {
        const p = m.getPopup();
        if (m !== marker && p && p.isOpen()) {
          p.remove();
        }
      });
      if (marker.getPopup() && !marker.getPopup().isOpen()) {
        marker.togglePopup();
      }
    }
  }

  updateMarkerPosition(id, latLng) {
    const marker = this._markers.get(id);
    if (marker) marker.setLngLat(this._toMapLibre(latLng));
  }

  setMarkerElement(id, html) {
    const marker = this._markers.get(id);
    if (marker) marker.getElement().innerHTML = html;
  }

  clearAllMarkers() {
    for (const [id, marker] of this._markers) {
      marker.remove();
    }
    this._markers.clear();
  }

  // ---- Lines (Polylines) ----
  addLine(id, coords, options = {}) {
    const sourceId = `line-src-${id}`;
    const layerId = `line-layer-${id}`;
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords.map(c => this._toMapLibre(c))
      }
    };

    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData(geojson);
      return id;
    }

    this.map.addSource(sourceId, { type: 'geojson', data: geojson });
    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': options.color || '#0a84ff',
        'line-width': options.weight || 5,
        'line-opacity': options.opacity || 1,
        'line-dasharray': options.dashArray ? options.dashArray.split(',').map(Number) : undefined
      }
    });

    if (options.onClick) {
      this.map.on('click', layerId, (e) => options.onClick(e));
      this.map.on('mouseenter', layerId, () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', layerId, () => { this.map.getCanvas().style.cursor = ''; });
    }

    return id;
  }

  updateLine(id, coords) {
    const sourceId = `line-src-${id}`;
    const source = this.map.getSource(sourceId);
    if (source) {
      source.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords.map(c => this._toMapLibre(c))
        }
      });
    }
  }

  removeLine(id) {
    const layerId = `line-layer-${id}`;
    const sourceId = `line-src-${id}`;
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }

  setLineStyle(id, style) {
    const layerId = `line-layer-${id}`;
    if (!this.map.getLayer(layerId)) return;
    if (style.color) this.map.setPaintProperty(layerId, 'line-color', style.color);
    if (style.weight) this.map.setPaintProperty(layerId, 'line-width', style.weight);
    if (style.opacity !== undefined) this.map.setPaintProperty(layerId, 'line-opacity', style.opacity);
  }

  // ---- Polygons ----
  addPolygon(id, coords, options = {}) {
    const sourceId = `poly-src-${id}`;
    const fillLayerId = `poly-fill-${id}`;
    const outlineLayerId = `poly-outline-${id}`;
    const ring = coords.map(c => this._toMapLibre(c));
    ring.push(ring[0]);

    const geojson = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] }
    };

    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData(geojson);
      return id;
    }

    this.map.addSource(sourceId, { type: 'geojson', data: geojson });
    this.map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': options.fillColor || options.color || '#4A90E2',
        'fill-opacity': options.fillOpacity || 0.4
      }
    });
    this.map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': options.color || '#4A90E2',
        'line-width': options.weight || 2,
        'line-opacity': options.opacity || 0.9
      }
    });

    if (options.onClick) {
      this.map.on('click', fillLayerId, (e) => options.onClick(e));
    }
    if (options.onMouseOver) {
      this.map.on('mouseenter', fillLayerId, (e) => {
        this.map.getCanvas().style.cursor = 'pointer';
        options.onMouseOver(e);
      });
    }
    if (options.onMouseOut) {
      this.map.on('mouseleave', fillLayerId, (e) => {
        this.map.getCanvas().style.cursor = '';
        options.onMouseOut(e);
      });
    }

    return id;
  }

  updatePolygon(id, coords) {
    const sourceId = `poly-src-${id}`;
    const ring = coords.map(c => this._toMapLibre(c));
    ring.push(ring[0]);
    const source = this.map.getSource(sourceId);
    if (source) {
      source.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] }
      });
    }
  }

  removePolygon(id) {
    [`poly-fill-${id}`, `poly-outline-${id}`].forEach(layerId => {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    });
    const sourceId = `poly-src-${id}`;
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }

  setPolygonStyle(id, style) {
    const fillId = `poly-fill-${id}`;
    const outlineId = `poly-outline-${id}`;
    if (style.fillColor && this.map.getLayer(fillId))
      this.map.setPaintProperty(fillId, 'fill-color', style.fillColor);
    if (style.fillOpacity !== undefined && this.map.getLayer(fillId))
      this.map.setPaintProperty(fillId, 'fill-opacity', style.fillOpacity);
    if (style.color && this.map.getLayer(outlineId))
      this.map.setPaintProperty(outlineId, 'line-color', style.color);
    if (style.weight && this.map.getLayer(outlineId))
      this.map.setPaintProperty(outlineId, 'line-width', style.weight);
  }

  // ---- Popups (standalone) ----
  showPopup(latLng, html, options = {}) {
    this.closePopup();
    this._activePopup = new maplibregl.Popup({
      closeButton: options.closeButton !== false,
      closeOnClick: options.closeOnClick !== false,
      offset: options.offset || 0,
      className: options.className || ''
    })
      .setLngLat(this._toMapLibre(latLng))
      .setHTML(html)
      .addTo(this.map);
    return this._activePopup;
  }

  closePopup() {
    if (this._activePopup) {
      this._activePopup.remove();
      this._activePopup = null;
    }
  }

  // ---- Circle (for GPS accuracy) ----
  addCircle(id, latLng, radiusMeters, options = {}) {
    // Approximate circle with 64-point polygon
    const center = this._toMapLibre(latLng);
    const points = 64;
    const coords = [];
    const km = radiusMeters / 1000;
    const lat = center[1];
    const lng = center[0];

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = km * Math.cos(angle) / (111.32 * Math.cos(lat * Math.PI / 180));
      const dy = km * Math.sin(angle) / 110.574;
      coords.push([lng + dx, lat + dy]);
    }

    const sourceId = `circle-src-${id}`;
    const layerId = `circle-layer-${id}`;

    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] }
      });
      return id;
    }

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
    });
    this.map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': options.color || 'rgba(10, 132, 255, 0.15)',
        'fill-outline-color': options.outlineColor || 'rgba(10, 132, 255, 0.4)'
      }
    });
    return id;
  }

  removeCircle(id) {
    const layerId = `circle-layer-${id}`;
    const sourceId = `circle-src-${id}`;
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }

  // ---- Map Interaction ----
  enableDragging() {
    this.map.dragPan.enable();
  }

  disableDragging() {
    this.map.dragPan.disable();
  }

  // ---- Events ----
  on(event, handler) {
    this.map.on(event, handler);
  }

  off(event, handler) {
    this.map.off(event, handler);
  }

  // ---- Base Layer Switching (GISTDA Satellite) ----
  setGistdaApiKey(apiKey) {
    this._gistdaApiKey = apiKey;
  }

  _ensureGistdaLayer() {
    if (this._gistdaLayerAdded || !this._gistdaApiKey) return;
    this._gistdaLayerAdded = true;

    // Add GISTDA satellite imagery (thaichote) raster tile source
    // API key must be appended as ?key= query parameter for authentication
    this.map.addSource('gistda-satellite', {
      type: 'raster',
      tiles: [
        `https://basemap.sphere.gistda.or.th/tiles/thailand_images/EPSG3857/{z}/{x}/{y}.jpeg?key=${this._gistdaApiKey}`
      ],
      tileSize: 256,
      minzoom: 1,
      maxzoom: 19,
      attribution: '&copy; <a href="https://sphere.gistda.or.th">GISTDA</a>'
    });

    // Insert satellite layer BELOW the floor overlay but above nothing
    // We insert it right after osm-layer, before any other layers
    const firstLayerAfterBase = this._getFirstNonBaseLayer();
    this.map.addLayer({
      id: 'gistda-satellite-layer',
      type: 'raster',
      source: 'gistda-satellite',
      minzoom: 0,
      maxzoom: 22,
      layout: { 'visibility': 'none' } // Hidden by default
    }, firstLayerAfterBase);
  }

  _getFirstNonBaseLayer() {
    // Find the first layer that isn't a base map layer
    const layers = this.map.getStyle().layers;
    for (const layer of layers) {
      if (layer.id !== 'osm-layer' && layer.id !== 'gistda-satellite-layer') {
        return layer.id;
      }
    }
    return undefined;
  }

  switchBaseLayer(layerType) {
    // layerType: 'osm' | 'satellite'
    this._ensureGistdaLayer();

    if (layerType === 'satellite') {
      if (this.map.getLayer('osm-layer')) {
        this.map.setLayoutProperty('osm-layer', 'visibility', 'none');
      }
      if (this.map.getLayer('gistda-satellite-layer')) {
        this.map.setLayoutProperty('gistda-satellite-layer', 'visibility', 'visible');
      }
    } else {
      // Default: OSM
      if (this.map.getLayer('osm-layer')) {
        this.map.setLayoutProperty('osm-layer', 'visibility', 'visible');
      }
      if (this.map.getLayer('gistda-satellite-layer')) {
        this.map.setLayoutProperty('gistda-satellite-layer', 'visibility', 'none');
      }
    }

    this._currentBaseLayer = layerType;
  }

  getCurrentBaseLayer() {
    return this._currentBaseLayer;
  }

  // ---- Utilities ----
  static distance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Get map click coordinates as {lat, lng}
  static eventLatLng(e) {
    return { lat: e.lngLat.lat, lng: e.lngLat.lng };
  }
}

// Export
window.MapEngine = MapEngine;
