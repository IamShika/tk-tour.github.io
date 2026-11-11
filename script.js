// =================== CONFIG ===================
const APP_VERSION = 'BETA NOV1.5 26';
// version identifer [release] {month Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec}{howmanyversionnow}{is "H"alf a month}
const CENTER = [14.085933, 100.608844];
const FLOORS = [
  {
    id: 'floor1',
    name: 'Floor 1',
    img: 'images/floor_1.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  },
  {
    id: 'floor2',
    name: 'Floor 2',
    img: 'images/floor_2.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  },
  {
    id: 'floor3',
    name: 'Floor 3',
    img: 'images/floor_3.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  },
  {
    id: 'floor4',
    name: 'Floor 4',
    img: 'images/floor_4.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  },
  {
    id: 'floor5',
    name: 'Floor 5',
    img: 'images/floor_5.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  },
  {
    id: 'floor6',
    name: 'Floor 6',
    img: 'images/floor_6.png',
    bounds: [[14.086142, 100.606071], [14.083915, 100.610199]]
  }
];

// =================== SEARCH CONFIG ===================
const SEARCH_MAX_RESULTS = 4; // Adjustable: How many search results to show

// Locations from JSON file
let locationsFromFile = [];

// Load locations.json
fetch('locations.json')
  .then(r => r.json())
  .then(data => {
    locationsFromFile = Array.isArray(data) ? data : (data.locations || []);
    console.log('Loaded', locationsFromFile.length, 'locations from file');
  })
  .catch(err => console.warn('locations.json not found, using pins only'));

// Initialize savedBuildings (used by search, may be populated by dev-tools)
let savedBuildings = [];

// =================== ACCESSIBILITY HELPERS ===================

// Focus trap for modal/sidebar — returns cleanup function
function trapFocus(container) {
  const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"][tabindex]';
  const focusables = container.querySelectorAll(focusableSelectors);
  if (focusables.length === 0) return null;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handler);
  first.focus();
  return () => container.removeEventListener('keydown', handler);
}

// Debounce utility
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Sanitize text for safe innerHTML usage
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =================== SOUND EFFECTS SYSTEM ===================
let soundEffectsEnabled = localStorage.getItem('soundEffects') !== 'false';
let soundFiles = [];
let currentSound = null;

// Load sound files from sounds/ folder
async function loadSoundFiles() {
  // List of potential sound files (you can add more)
  const soundFileNames = [
    'sound1.ogg', 'sound2.ogg', 'sound3.ogg',
    'sound4.ogg', 'sound5.ogg', 'sound6.ogg',
    'sound7.ogg', 'sound8.ogg', 'sound9.ogg',
    'sound10.ogg', 'sound11.ogg', 'sound12.ogg',
    'sound14.ogg', 'sound15.ogg', 'sound16.ogg'
  ];

  soundFiles = soundFileNames.map(name => `sounds/${name}`);
}

function playRandomSound() {
  if (!soundEffectsEnabled || currentLanguage !== 't-th') return;
  if (soundFiles.length === 0) return;

  try {
    // Stop current sound if playing
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
    }

    // Pick random sound
    const randomIndex = Math.floor(Math.random() * soundFiles.length);
    currentSound = new Audio(soundFiles[randomIndex]);
    currentSound.volume = 0.3; // 30% volume
    currentSound.play().catch(err => {
      // Silently fail if sound doesn't exist or can't play
      console.debug('Sound play failed:', err);
    });
  } catch (err) {
    console.debug('Sound error:', err);
  }
}

// Initialize sounds
loadSoundFiles();

// =================== GLITCH SOUND SYSTEM ===================
const glitchSoundFiles = [
  'sounds/Glitch/Glitch1.mp3',
  'sounds/Glitch/Glitch2.mp3',
  'sounds/Glitch/Glitch3.mp3',
  'sounds/Glitch/Glitch4.mp3',
  'sounds/Glitch/Glitch5.mp3'
];
let currentGlitchSound = null;

function playGlitchSound() {
  // Glitch sounds play on search clear regardless of language
  // But in t-th mode, the regular sounds will play over it
  if (currentLanguage === 't-th' && soundEffectsEnabled) return; // t-th plays over it

  try {
    if (currentGlitchSound) {
      currentGlitchSound.pause();
      currentGlitchSound.currentTime = 0;
    }

    const randomIndex = Math.floor(Math.random() * glitchSoundFiles.length);
    currentGlitchSound = new Audio(glitchSoundFiles[randomIndex]);
    currentGlitchSound.volume = 0.25;
    currentGlitchSound.playbackRate = 1.5; // Make the glitch sound play faster
    currentGlitchSound.play().catch(err => {
      console.debug('Glitch sound play failed:', err);
    });
  } catch (err) {
    console.debug('Glitch sound error:', err);
  }
}

// =================== SETTINGS & TRANSLATIONS ===================
let currentLanguage = localStorage.getItem('language') || 'th';
let currentTheme = localStorage.getItem('theme') || 'light';
let displayMode = localStorage.getItem('displayMode') || 'auto';
let translations = {};

// Load translations
fetch('translations.json')
  .then(r => r.json())
  .then(data => {
    translations = data;
    applyTranslations();
  })
  .catch(err => console.warn('translations.json not found'));

function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

function applyTranslations() {
  // Update all elements with data-translate attribute
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    const translation = t(key);

    // For option elements, update textContent
    if (el.tagName === 'OPTION') {
      el.textContent = translation;
    }
    // For other elements, replace textContent
    else {
      el.textContent = translation;
    }
  });

  // Update all translatable elements
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.placeholder = t('searchPlaceholder');

  // Update sidebar titles
  const mainSidebarTitle = document.querySelector('#mainSidebar .sidebar-title');
  if (mainSidebarTitle) mainSidebarTitle.textContent = t('menu').toUpperCase();

  const devSidebarTitle = document.querySelector('#devSidebar .sidebar-title');
  if (devSidebarTitle) devSidebarTitle.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> ' + t('devTools');

  // Update close button titles
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.title = t('close');
  });

  // Update menu items
  document.querySelectorAll('.menu-item').forEach(item => {
    const modalId = item.getAttribute('data-modal');
    const action = item.getAttribute('data-action');
    const textSpan = item.querySelector('.menu-text') || item;

    if (modalId === 'about') textSpan.textContent = t('about');
    if (modalId === 'howto') textSpan.textContent = t('howto');
    if (modalId === 'settings') textSpan.textContent = t('settings');
    if (modalId === 'donate') textSpan.textContent = t('donate');
    if (action === 'feedback') textSpan.textContent = t('feedback');
  });

  // Update route creator sections
  const pathSectionHeaders = document.querySelectorAll('.path-section h4');
  if (pathSectionHeaders[0]) pathSectionHeaders[0].textContent = t('routeCreator');
  if (pathSectionHeaders[1]) pathSectionHeaders[1].textContent = t('add360Pin');

  document.querySelectorAll('.step-title').forEach((el, i) => {
    const titles = [t('nameYourRoute'), t('drawYourRoute'), t('saveYourRoute'),
    t('placePinOnMap'), t('addPinDetails'), t('savePin')];
    if (titles[i]) el.textContent = titles[i];
  });

  // Buttons
  const btnTexts = {
    'startPathBtn': 'startDrawing',
    'undoPointBtn': 'undo',
    'clearPathBtn': 'clear',
    'finishPathBtn': 'finish',
    'savePathBtn': 'saveRoute',
    'startPlacingPin': 'placePin',
    'confirmPinLocation': 'confirmLocation',
    'savePin': 'savePin',
    'cancelPin': 'cancel'
  };

  Object.entries(btnTexts).forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (btn && btn.querySelector('.btn-icon')) {
      const icon = btn.querySelector('.btn-icon').outerHTML;
      let translatedText = t(key);
      if (typeof translatedText === 'string') {
        translatedText = translatedText.replace(/^[^\w\s]+\s/, '');
      }
      btn.innerHTML = icon + ' ' + translatedText;
    }
  });

  // Update saved routes headers
  const savedRoutesHeaders = document.querySelectorAll('.saved-routes-header h4');
  if (savedRoutesHeaders[0]) savedRoutesHeaders[0].textContent = t('savedRoutes');
  if (savedRoutesHeaders[1]) savedRoutesHeaders[1].textContent = t('savedPins');

  // Update floor pill
  initFloorPill();

  // Update current floor display
  const currentFloorNum = document.getElementById('currentFloorNum');
  if (currentFloorNum) {
    currentFloorNum.textContent = currentFloor + 1;
  }

  // Update placeholders
  const pathName = document.getElementById('pathName');
  if (pathName) pathName.placeholder = t('routeNamePlaceholder');

  const pinName = document.getElementById('pinName');
  if (pinName) pinName.placeholder = t('locationNamePlaceholder');

  // Update path status
  const pathStatus = document.getElementById('pathStatus');
  if (pathStatus && !drawingMode) pathStatus.textContent = t('readyToDraw');

  const pinPlacingStatus = document.getElementById('pinPlacingStatus');
  if (pinPlacingStatus) pinPlacingStatus.textContent = t('readyToPlace');
}

function changeLanguage(lang) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('languageLoadingOverlay');
    const loadingText = document.getElementById('languageLoadingText');

    // Stop all currently playing sounds
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
      currentSound = null;
    }

    if (loadingText) loadingText.textContent = t('changingLanguage');
    if (overlay) overlay.classList.add('active');

    setTimeout(() => {
      currentLanguage = lang;
      localStorage.setItem('language', lang);
      applyTranslations();

      // Dispatch language change event
      window.dispatchEvent(new Event('languagechange'));

      setTimeout(() => {
        if (overlay) overlay.classList.remove('active');

        // Play sound8 when switching TO t-th
        if (lang === 't-th' && soundEffectsEnabled) {
          if (currentSound) {
            currentSound.pause();
            currentSound.currentTime = 0;
          }
          currentSound = new Audio('sounds/sound8.ogg');
          currentSound.volume = 0.3;
          currentSound.play().catch(err => console.debug('Sound play failed:', err));
        }

        resolve();
      }, 1500);
    }, 100);
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  currentTheme = theme;
  localStorage.setItem('theme', theme);
}

function applyDisplayMode(mode) {
  displayMode = mode;
  localStorage.setItem('displayMode', mode);

  // Auto-detect if mode is auto
  if (mode === 'auto') {
    const width = window.innerWidth;
    if (width <= 768) {
      document.body.setAttribute('data-display', 'phone');
    } else if (width <= 1024) {
      document.body.setAttribute('data-display', 'tablet');
    } else {
      document.body.setAttribute('data-display', 'desktop');
    }
  } else {
    document.body.setAttribute('data-display', mode);
  }
}

// Initialize settings
applyTheme(currentTheme);
applyDisplayMode(displayMode);

// =================== TOAST SYSTEM ===================
const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'info', options = {}) {
  const duration = options.duration ?? 3000;
  const t = document.createElement('div');
  t.className = `toast ${type}`;

  const msg = document.createElement('div');
  msg.className = 'message';
  msg.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.onclick = () => hideToast(t);

  t.appendChild(msg);
  t.appendChild(closeBtn);
  toastContainer.appendChild(t);

  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => hideToast(t), duration);

  return t;
}

function hideToast(el) {
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => { try { el.remove(); } catch (e) { } }, 300);
}

// =================== MAP INIT (MapLibre GL JS) ===================
console.log('Initializing map with MapLibre...');

// School config loaded from data/config.json later, using defaults first
const mapEngine = new MapEngine('map', {
  center: CENTER,
  zoom: 17,
  bounds: FLOORS[0].bounds, // [[lat1,lng1],[lat2,lng2]] — fitBounds on load
  maxZoom: 21,
  minZoom: 14,
  pitch: 0,
  bearing: 0
});

// Raw MapLibre map for direct API access
const map = mapEngine.map;
window.mapEngine = mapEngine;

let currentFloor = 0;

// Load floor overlay and 3D buildings once map is ready
mapEngine._ready.then(() => {
  // Floor overlay
  const overlayBounds = {
    topLeft: FLOORS[currentFloor].bounds[0],
    topRight: [FLOORS[currentFloor].bounds[0][0], FLOORS[currentFloor].bounds[1][1]],
    bottomRight: FLOORS[currentFloor].bounds[1],
    bottomLeft: [FLOORS[currentFloor].bounds[1][0], FLOORS[currentFloor].bounds[0][1]]
  };
  mapEngine.setFloorOverlay(FLOORS[currentFloor].img, overlayBounds);

  // Load 3D buildings
  mapEngine.loadBuildings('data/buildings.geojson');

  // Load custom dev buildings so they show up and are searchable
  try {
    const customBldgs = JSON.parse(localStorage.getItem('dev_buildings') || '[]');
    customBldgs.forEach(bldg => {
      // Add to map
      mapEngine.addBuildingFromCoords(bldg.id, bldg.coords, bldg);
      // Make it searchable (search code expects labelPosition)
      bldg.labelPosition = bldg.coords[0];
      bldg.floors = 1; // Default
      savedBuildings.push(bldg);
    });
  } catch (e) { }

  // Load custom dev paths so they show up
  try {
    const customPaths = JSON.parse(localStorage.getItem('dev_paths') || '[]');
    customPaths.forEach(path => {
      mapEngine.addLine('saved_path_' + path.id, path.coords, {
        color: '#0a84ff', weight: 5
      });
      // Optionally add to savedPaths if paths ever become searchable
      if (typeof savedPaths !== 'undefined') {
        savedPaths.push(path);
      }
    });
  } catch (e) { }

  console.log('Map initialized with MapLibre GL JS');
});

setTimeout(() => {
  mapEngine.resize();
}, 200);

window.addEventListener('resize', () => {
  mapEngine.resize();
  if (displayMode === 'auto') applyDisplayMode('auto');
});

// ---- Leaflet Compat: patch map methods immediately ----
(function patchMapCompat() {
  // Store handler mappings for map.off compatibility
  const _handlerMap = new Map();

  // Wrap map.on to convert MapLibre e.lngLat → Leaflet e.latlng
  const _origOn = map.on.bind(map);
  const _origOff = map.off.bind(map);

  map.on = function (event, arg1, arg2) {
    let layerId = null;
    let handler = null;

    if (typeof arg1 === 'function') {
      handler = arg1;
    } else {
      layerId = arg1;
      handler = arg2;
    }

    if (typeof handler !== 'function') {
      return _origOn.apply(map, arguments); // fallback just in case
    }

    const wrappedHandler = (e) => {
      if (e && e.lngLat) {
        e.latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      }
      handler(e);
    };

    const key = event + '_' + (layerId || '') + '_' + (handler.name || '') + '_' + handler.toString().slice(0, 50);
    _handlerMap.set(key, wrappedHandler);
    handler._wrappedCompat = wrappedHandler;

    if (layerId) {
      _origOn(event, layerId, wrappedHandler);
    } else {
      _origOn(event, wrappedHandler);
    }
    return map;
  };

  map.off = function (event, arg1, arg2) {
    let layerId = null;
    let handler = null;

    if (typeof arg1 === 'function') {
      handler = arg1;
    } else {
      layerId = arg1;
      handler = arg2;
    }

    if (handler && handler._wrappedCompat) {
      if (layerId) {
        _origOff(event, layerId, handler._wrappedCompat);
      } else {
        _origOff(event, handler._wrappedCompat);
      }
    } else {
      try { _origOff.apply(map, arguments); } catch (e) { }
    }
    return map;
  };

  // map.removeLayer compat
  map.removeLayer = function (layer) {
    if (layer && typeof layer.remove === 'function') layer.remove();
  };

  // map.hasLayer compat
  map.hasLayer = function (layer) {
    return !!(layer && layer._id);
  };

  // map.closePopup compat
  map.closePopup = function () { mapEngine.closePopup(); };

  // map.fitBounds with L.latLngBounds compat
  const _origFit = map.fitBounds.bind(map);
  map.fitBounds = function (bounds, options = {}) {
    if (bounds && bounds._sw) {
      const sw = [bounds._sw.lng, bounds._sw.lat];
      const ne = [bounds._ne.lng, bounds._ne.lat];
      const pad = options.padding ? options.padding[0] || 50 : 50;
      _origFit([sw, ne], { padding: pad });
    } else if (Array.isArray(bounds)) {
      mapEngine.fitBounds(bounds, options);
    } else {
      _origFit(bounds, options);
    }
  };

  // map.panTo compat removed to prevent infinite recursion

  // map.getZoom is native to MapLibre, no patch needed
  // map.dragging compat
  map.dragging = {
    disable: () => mapEngine.disableDragging(),
    enable: () => mapEngine.enableDragging()
  };

  // map.invalidateSize compat
  map.invalidateSize = function () { mapEngine.resize(); };
})();

// =================== GLOBAL CONFIG & STATE ===================
window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert('JS Error: ' + msg + '\nLine: ' + lineNo + '\nFile: ' + url);
  return false;
};

// State variables
let allPins = [];
let markers = [];
let viewerInstance = null;
let drawingMode = false;
let currentPathCoords = [];
let currentPolyline = null;
let savedPaths = [];
let drawnPathLayers = [];

// Enhanced pathmaker globals
// Enhanced pathmaker globals
let pathPointMarkers = []; // Visual markers at each waypoint

// =================== PLACES ===================
let allPlaces = [];
let placeMarkers = [];
let savedPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');

// =================== SIDEBAR LOGIC ===================
const menuToggle = document.getElementById('menuToggle');
const mainSidebar = document.getElementById('mainSidebar');
const closeMainBtn = document.getElementById('closeSidebarBtn');

window.devMode = false;
// Re-fetch config.json to populate devMode and API proxy settings
fetch('config.json')
  .then(r => {
    console.log('[Config] config.json fetch status:', r.status, r.ok ? 'OK' : 'FAILED');
    if (!r.ok) throw new Error(`config.json returned ${r.status}`);
    return r.json();
  })
  .then(cfg => {
    window.devMode = !!cfg.devMode;

    // Show 3D toggle only in dev mode
    const toggle3dEl = document.getElementById('toggle3dOption');
    if (toggle3dEl) toggle3dEl.style.display = window.devMode ? '' : 'none';

    // Cloudflare Worker proxy URL (preferred — keeps API keys server-side)
    if (cfg.workerUrl) {
      mapEngine.setWorkerUrl(cfg.workerUrl);
      console.log('[Config] Worker proxy URL set successfully');
    }

    // Legacy fallback: direct API keys (local dev with server.py only)
    if (cfg.gistdaApiKey) {
      mapEngine.setGistdaApiKey(cfg.gistdaApiKey);
      console.log('[Config] GISTDA API key set (direct/legacy)');
    }

    if (cfg.googleMapsApiKey) {
      mapEngine.setGoogleMapsApiKey(cfg.googleMapsApiKey);
      console.log('[Config] Google Maps API key set (direct/legacy)');
    }

    if (cfg.satelliteProvider) {
      mapEngine.setSatelliteProvider(cfg.satelliteProvider);
    }

    // User's localStorage preference overrides config.json default
    const savedProvider = localStorage.getItem('satelliteProvider');
    if (savedProvider) {
      mapEngine.setSatelliteProvider(savedProvider);
    }

    const savedMapProvider = localStorage.getItem('mapProvider');
    if (savedMapProvider) {
      mapEngine.setMapProvider(savedMapProvider);
    }

    // Restore saved base layer state
    const savedBaseLayer = localStorage.getItem('baseMapType');
    if (savedBaseLayer) {
      mapEngine.switchBaseLayer(savedBaseLayer);

      // Update UI active states for layer switcher panel
      if (layerSwitcherPanel) {
        layerSwitcherPanel.querySelectorAll('.layer-option').forEach(opt => {
          opt.classList.remove('active');
          opt.setAttribute('aria-selected', 'false');
          if (opt.getAttribute('data-layer') === savedBaseLayer) {
            opt.classList.add('active');
            opt.setAttribute('aria-selected', 'true');
          }
        });
      }
    }
  })
  .catch(err => {
    console.error('[Config] Failed to load config.json:', err);
  });

function closeAllSidebars() {
  if (mainSidebar) mainSidebar.classList.remove('open');
  if (mainSidebar) {
    mainSidebar.classList.remove('active');
    mainSidebar.setAttribute('aria-hidden', 'true');
    if (mainSidebar.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }
  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  const placeSidebar = document.getElementById('placeSidebar');
  if (placeSidebar) placeSidebar.classList.remove('open');
  // Accessibility: release focus trap and restore focus
  if (window._sidebarFocusTrap) {
    window._sidebarFocusTrap();
    window._sidebarFocusTrap = null;
  }
  if (window._sidebarPreviousFocus) {
    window._sidebarPreviousFocus.focus();
    window._sidebarPreviousFocus = null;
  }
}

if (menuToggle) {
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mainSidebar.classList.contains('open');
    closeAllSidebars();
    if (!isOpen) {
      mainSidebar.classList.add('open');
      mainSidebar.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
      window._sidebarPreviousFocus = document.activeElement;
      window._sidebarFocusTrap = trapFocus(mainSidebar);
    }
  });
}

if (closeMainBtn) {
  closeMainBtn.addEventListener('click', () => mainSidebar.classList.remove('open'));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllSidebars();
    // Close modal if open
    if (modalOverlay && modalOverlay.classList.contains('active')) {
      closeModal();
    }
    // Close floor pill if open
    const floorPillEl = document.getElementById('floorPill');
    if (floorPillEl && floorPillEl.classList.contains('expanded')) {
      floorPillEl.classList.remove('expanded');
    }
    // Close search recommendations if open
    const searchRecs = document.getElementById('searchRecommendations');
    if (searchRecs && searchRecs.classList.contains('active')) {
      searchRecs.classList.remove('active');
    }
    // Close layer switcher panel if open
    const layerPanel = document.getElementById('layerSwitcherPanel');
    if (layerPanel && layerPanel.classList.contains('open')) {
      layerPanel.classList.remove('open');
      const layerBtn = document.getElementById('layerSwitcherBtn');
      if (layerBtn) layerBtn.setAttribute('aria-expanded', 'false');
    }
  }
});

document.addEventListener('click', (e) => {
  const clickedInMain = mainSidebar && mainSidebar.contains(e.target);
  const clickedToggle = menuToggle && menuToggle.contains(e.target);

  if (!clickedInMain && !clickedToggle) {
    // Only close main sidebar, don't use closeAllSidebars() which aggressively closes placeSidebar too
    if (mainSidebar) mainSidebar.classList.remove('open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  }
});

// Close place sidebar when clicking empty map space
if (mapEngine && mapEngine._ready) {
  mapEngine._ready.then(() => {
    mapEngine.map.on('click', (e) => {
      const features = mapEngine.map.queryRenderedFeatures(e.point);
      const clickedPlace = features.some(f => f.layer.id.startsWith('poly-fill-'));
      if (!clickedPlace) {
        const placeSidebar = document.getElementById('placeSidebar');
        if (placeSidebar) placeSidebar.classList.remove('open');
      }
    });
  });
}

// =================== MODAL SYSTEM ===================
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function generateSettingsHTML() {
  const showSoundToggle = currentLanguage === 't-th';

  return `
    <div style="padding: 10px 0;">
      <!-- Language Setting -->
      <div class="settings-row">
        <span class="settings-label"><b>${t('language')}</b></span>
        <select class="settings-select" id="languageSelect">
          <option value="th" ${currentLanguage === 'th' ? 'selected' : ''}>ภาษาไทย</option>
          <option value="t-th" ${currentLanguage === 't-th' ? 'selected' : ''}>ภาษาไทยเดิม</option>
          <option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>

      ${showSoundToggle ? `
      <!-- Traditional Thai Sound Effects (only in t-th) -->
      <div class="theme-toggle-container">
        <span class="theme-toggle-label">
          <span class="material-symbols-rounded theme-icon">volume_up</span>
          <b>${t('traditionalThaiSounds')}</b>
          <span class="material-symbols-rounded info-tooltip" data-tooltip="${t('soundsTooltip')}" style="margin-left:8px;cursor:help;color:var(--accent);">help</span>
        </span>
        <div class="theme-toggle ${soundEffectsEnabled ? 'active' : ''}" id="soundEffectsToggle">
          <div class="theme-toggle-slider" style="display:flex;align-items:center;justify-content:center;">
            <span class="material-symbols-rounded">${soundEffectsEnabled ? 'volume_up' : 'volume_off'}</span>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Theme Setting -->
      <div class="theme-toggle-container">
        <span class="theme-toggle-label">
          <span class="material-symbols-rounded theme-icon">${currentTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
          <b>${t('theme')}</b>
        </span>
        <div class="theme-toggle ${currentTheme === 'dark' ? 'active' : ''}" id="themeToggle">
          <div class="theme-toggle-slider" style="display:flex;align-items:center;justify-content:center;">
            <span class="material-symbols-rounded">${currentTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
          </div>
        </div>
      </div>

      <!-- Display Mode Setting -->
      <div class="settings-row">
        <span class="settings-label"><b>${t('displayMode')}</b></span>
        <select class="settings-select" id="displayModeSelect">
          <option value="auto" ${displayMode === 'auto' ? 'selected' : ''}>${t('auto')}</option>
          <option value="phone" ${displayMode === 'phone' ? 'selected' : ''}>${t('phone')}</option>
          <option value="tablet" ${displayMode === 'tablet' ? 'selected' : ''}>${t('tablet')}</option>
          <option value="desktop" ${displayMode === 'desktop' ? 'selected' : ''}>${t('desktop')}</option>
        </select>
      </div>

      <!-- Map Provider Setting -->
      <div class="settings-row">
        <span class="settings-label"><b>${t('mapProvider')}</b></span>
        <select class="settings-select" id="mapProviderSelect">
          <option value="osm" ${(localStorage.getItem('mapProvider') || mapEngine._mapProvider || 'osm') === 'osm' ? 'selected' : ''}>${t('osm')}</option>
          <option value="google" ${(localStorage.getItem('mapProvider') || mapEngine._mapProvider || 'osm') === 'google' ? 'selected' : ''}>${t('google')}</option>
        </select>
      </div>

      <!-- Satellite Provider Setting -->
      <div class="settings-row">
        <span class="settings-label"><b>${t('satelliteProvider')}</b></span>
        <select class="settings-select" id="satelliteProviderSelect">
          <option value="google" ${(localStorage.getItem('satelliteProvider') || mapEngine._satelliteProvider || 'google') === 'google' ? 'selected' : ''}>${t('google')}</option>
          <option value="gistda" ${(localStorage.getItem('satelliteProvider') || mapEngine._satelliteProvider || 'google') === 'gistda' ? 'selected' : ''}>${t('gistda')}</option>
        </select>
      </div>
    </div>
  `;
}

const modalContent = {
  about: {
    get title() { return t('aboutTitle'); },
    get body() { return t('aboutContent').replace(/{{VERSION}}/g, APP_VERSION); }
  },
  howto: {
    get title() { return t('howtoTitle'); },
    get body() { return t('howtoContent'); }
  },
  settings: {
    get title() { return t('settings'); },
    body: generateSettingsHTML()
  },
  donate: {
    get title() { return t('donateTitle'); },
    get body() { return t('donateContent'); }
  },
  saved: {
    get title() { return 'Saved Places'; },
    get body() { return '<div id="savedPlacesList">Loading...</div>'; }
  }
};

function openModal(modalId) {
  if (modalId && modalContent[modalId]) {
    modalTitle.textContent = modalContent[modalId].title;

    if (modalId === 'settings') {
      modalBody.innerHTML = generateSettingsHTML();

      // Attach event listeners for settings
      const languageSelect = document.getElementById('languageSelect');
      const themeToggle = document.getElementById('themeToggle');
      const displayModeSelect = document.getElementById('displayModeSelect');

      if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
          changeLanguage(e.target.value).then(() => {
            // Regenerate settings modal with new language
            modalBody.innerHTML = generateSettingsHTML();
            // Reattach listeners
            setTimeout(() => openModal('settings'), 0);
          });
        });
      }

      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          const newTheme = currentTheme === 'light' ? 'dark' : 'light';
          applyTheme(newTheme);
          themeToggle.classList.toggle('active');

          // Update icon
          const slider = themeToggle.querySelector('.theme-toggle-slider');
          const icon = themeToggle.closest('.theme-toggle-container').querySelector('.theme-icon');
          if (slider && icon) {
            slider.innerHTML = `<span class="material-symbols-rounded">${newTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>`;
            icon.innerHTML = `<span class="material-symbols-rounded">${newTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>`;
          }
        });
      }

      // Sound Effects Toggle (only in t-th mode)
      const soundEffectsToggle = document.getElementById('soundEffectsToggle');
      if (soundEffectsToggle) {
        soundEffectsToggle.addEventListener('click', () => {
          soundEffectsEnabled = !soundEffectsEnabled;
          localStorage.setItem('soundEffects', soundEffectsEnabled);
          soundEffectsToggle.classList.toggle('active');

          // Update icon
          const slider = soundEffectsToggle.querySelector('.theme-toggle-slider');
          if (slider) {
            slider.innerHTML = `<span class="material-symbols-rounded">${soundEffectsEnabled ? 'volume_up' : 'volume_off'}</span>`;
          }

          if (soundEffectsEnabled) {
            // Play sound to confirm it's on
            playRandomSound();
          } else {
            // Stop any currently playing sound
            if (currentSound) {
              currentSound.pause();
              currentSound.currentTime = 0;
              currentSound = null;
            }
          }

          showToast(soundEffectsEnabled ? t('soundOn') : t('soundOff'), 'info');
        });
      }

      // Tooltip tap handler for mobile
      const tooltips = document.querySelectorAll('.info-tooltip');
      tooltips.forEach(tooltip => {
        tooltip.addEventListener('click', (e) => {
          e.stopPropagation();
          tooltip.classList.toggle('show');
          // Hide after 3 seconds
          setTimeout(() => tooltip.classList.remove('show'), 3000);
        });
      });

      // Hide tooltips when clicking elsewhere
      document.addEventListener('click', () => {
        tooltips.forEach(t => t.classList.remove('show'));
      });

      if (displayModeSelect) {
        displayModeSelect.addEventListener('change', (e) => {
          applyDisplayMode(e.target.value);
          showToast(t('displayMode') + ': ' + t(e.target.value), 'success');
        });
      }

      // Map Provider selector
      const mapProviderSelect = document.getElementById('mapProviderSelect');
      if (mapProviderSelect) {
        mapProviderSelect.addEventListener('change', (e) => {
          const provider = e.target.value;
          localStorage.setItem('mapProvider', provider);
          mapEngine.setMapProvider(provider);

          // If map view is currently active, re-switch to apply the new provider
          if (mapEngine.getCurrentBaseLayer() === 'osm') {
            mapEngine._hideMapLayers();
            mapEngine.switchBaseLayer('osm');
          }

          showToast(t('mapProvider') + ': ' + t(provider), 'success');
        });
      }

      // Satellite Provider selector
      const satelliteProviderSelect = document.getElementById('satelliteProviderSelect');
      if (satelliteProviderSelect) {
        satelliteProviderSelect.addEventListener('change', (e) => {
          const provider = e.target.value;
          localStorage.setItem('satelliteProvider', provider);
          mapEngine.setSatelliteProvider(provider);

          // If satellite view is currently active, re-switch to apply the new provider
          if (mapEngine.getCurrentBaseLayer() === 'satellite') {
            // Reset layer state so it re-creates with the new provider
            mapEngine._hideSatelliteLayers();
            mapEngine.switchBaseLayer('satellite');
          }

          showToast(t('satelliteProvider') + ': ' + t(provider), 'success');
        });
      }
    } else if (modalId === 'saved') {
      modalBody.innerHTML = modalContent[modalId].body;
      const container = document.getElementById('savedPlacesList');
      const savedPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');
      if (savedPlaces.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">No places saved yet.</p>';
      } else {
        container.innerHTML = '';
        savedPlaces.forEach(id => {
          const place = allPlaces.find(p => p.id === id);
          if (place) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:12px; border-bottom:1px solid #333; cursor:pointer; display:flex; align-items:center; gap:10px;';

            const floorStr = Array.isArray(place.floor) ? (place.floor.includes('all') ? 'All floors' : `Floor ${place.floor.join(',')}`) : `Floor ${place.floor || 'G'}`;

            item.innerHTML = `
              <div style="width:40px;height:40px;border-radius:8px;background:#333;background-image:url('images/streetview/${place.image || ''}');background-size:cover;background-position:center;"></div>
              <div style="flex:1;">
                <div style="font-weight:600;">${place.name}</div>
                <div style="font-size:12px;color:var(--muted);">${t(place.category) || place.category} • ${floorStr}</div>
              </div>
              <span class="material-symbols-rounded" style="color:var(--primary);">chevron_right</span>
            `;
            item.onclick = () => {
              closeModal();
              openPlaceSidebar(place);
            };
            container.appendChild(item);
          }
        });
      }
    } else {
      modalBody.innerHTML = modalContent[modalId].body;
    }

    modalOverlay.classList.add('active');
    // Accessibility: trap focus inside modal
    window._modalPreviousFocus = document.activeElement;
    window._modalFocusTrap = trapFocus(document.querySelector('.modal-content'));
  }
}

document.querySelectorAll('.menu-item').forEach(item => {
  const handleMenuAction = (e) => {
    e.stopPropagation();
    const modalId = item.getAttribute('data-modal');
    const action = item.getAttribute('data-action');

    if (action === 'feedback') {
      // Open feedback form in new tab
      window.open('https://forms.gle/o3W4wVamF4PA1AFy9', '_blank');
    } else if (modalId) {
      openModal(modalId);
    }
  };

  item.addEventListener('click', handleMenuAction);

  // Keyboard support: Enter and Space activate menu items
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMenuAction(e);
    }
  });
});

function closeModal() {
  if (modalOverlay) {
    // Accessibility: release focus trap and restore focus
    if (window._modalFocusTrap) {
      window._modalFocusTrap();
      window._modalFocusTrap = null;
    }
    modalOverlay.classList.add('closing');
    const onTransitionEnd = () => {
      modalOverlay.classList.remove('active', 'closing');
      modalOverlay.removeEventListener('transitionend', onTransitionEnd);
    };
    modalOverlay.addEventListener('transitionend', onTransitionEnd);
    // Fallback in case transitionend doesn't fire
    setTimeout(() => {
      modalOverlay.classList.remove('active', 'closing');
    }, 300);
    // Restore focus after close transition
    if (window._modalPreviousFocus) {
      setTimeout(() => {
        if (window._modalPreviousFocus) {
          window._modalPreviousFocus.focus();
          window._modalPreviousFocus = null;
        }
      }, 310);
    }
  }
}

if (modalClose) {
  modalClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      e.stopPropagation();
      closeModal();
    }
  });
}

// =================== LOAD PINS ===================
let mainPathPolyline = null;

function loadPins() {
  // Try server API first (local dev with server.py), fall back to static file (GitHub Pages)
  fetch('/get_pins')
    .then(r => { if (!r.ok) throw new Error('API not available'); return r.json(); })
    .catch(() => fetch('data/pins.json').then(r => r.json()))
    .then(pins => {
      console.log('Loaded pins from server:', pins?.length || 0);

      (pins || []).forEach(pin => {
        if (!pin.id) {
          pin.id = `pin_${pin.name.toLowerCase().replace(/\s+/g, '_')}_${pin.lat.toFixed(5)}_${pin.lng.toFixed(5)}`;
        }
      });

      allPins = pins || [];

      // Clear existing markers
      markers.forEach(id => mapEngine.removeMarker(id));
      markers = [];

      if (mainPathPolyline) {
        mapEngine.removeLine('main-path');
        mainPathPolyline = null;
      }

      allPins.forEach(pin => {
        const pinFloor = pin.floor !== undefined ? pin.floor : 0;

        // Only draw text pins if Developer Tools are active
        if (window.devMode) {
          const markerId = mapEngine.addMarker([pin.lat, pin.lng], {
            id: `pin_marker_${pin.id}`,
            floor: pinFloor,
            className: 'custom-pin-text',
            html: `<div style="
              font-family: 'Kanit', sans-serif;
              font-weight: 600;
              font-size: 14px;
              color: #0a84ff;
              text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
              white-space: nowrap;
              transform: translate(-50%, -50%);
              cursor: pointer;
              pointer-events: auto;
            ">${pin.name}</div>`,
            popup: `<div style="text-align:center;">
              <strong>${pin.name}</strong><br>
              <button onclick='openViewer("${pin.id}")'
                      style="margin-top:10px;padding:8px 16px;background:#0a84ff;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Kanit,sans-serif;">
                ดูสตรีทวิว 360°
              </button>
            </div>`,
            onClick: () => mapEngine.panTo([pin.lat, pin.lng])
          });
          markers.push(markerId);
        }
      });
      mapEngine.updateMarkerVisibility(currentFloor);
      drawStreetViewPaths();
    })
    .catch(err => {
      allPins = [];
    })
    .finally(() => {
      // Optional: do something after load
    });
}

function getPolygonCenter(coords) {
  if (!coords || coords.length === 0) return [0, 0];
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (let c of coords) {
    if (c[0] < minLat) minLat = c[0];
    if (c[0] > maxLat) maxLat = c[0];
    if (c[1] < minLng) minLng = c[1];
    if (c[1] > maxLng) maxLng = c[1];
  }
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

function loadPlaces() {
  fetch('/get_places')
    .then(r => { if (!r.ok) throw new Error('API not available'); return r.json(); })
    .catch(() => fetch('data/places.json').then(r => r.json()))
    .then(places => {
      allPlaces = places || [];
      renderPlaces();
    })
    .catch(err => {
      console.log('No places data found');
      allPlaces = [];
    });
}

function renderPlaces() {
  // Clear old markers
  placeMarkers.forEach(m => m.remove());
  placeMarkers = [];

  allPlaces.forEach(p => {
    // Support p.floor being a single number, 'all', or an array
    const floorMatch = Array.isArray(p.floor)
      ? (p.floor.includes('all') || p.floor.includes(currentFloor) || p.floor.includes(0))
      : (p.floor === 'all' || p.floor === currentFloor || p.floor === 0);

    if (!floorMatch) return;
    if (!p.coords || p.coords.length < 3) return;

    // Visibility logic
    let fillOpacity = 0;
    let strokeOpacity = 0;
    if (window.devMode) {
      fillOpacity = 0.3;
      strokeOpacity = 1;
    } else if (navigationController && navigationController.isNavigating && navigationController.currentDestinationId === p.id) {
      strokeOpacity = 1;
    }

    // Single addPolygon call — includes label, hover, visibility, and click handler
    mapEngine.addPolygon(p.id, p.coords, {
      color: '#1a73e8',
      fillColor: '#1a73e8',
      fillOpacity: fillOpacity,
      opacity: strokeOpacity,
      weight: 2,
      label: p.name,
      interactiveHover: true,
      onClick: (e) => {
        openPlaceSidebar(p);
      }
    });


  });
}

// MapEngine might need a quick addPolygon/removePolygon helper since map-engine.js's native removeLine/Polygon is messy.
// Actually mapEngine.addPolygon exists. 
// For removing:
if (!mapEngine.removePolygon) {
  mapEngine.removePolygon = function (id) {
    const layerIdFill = `poly-fill-${id}`;
    const layerIdOutline = `poly-outline-${id}`;
    const sourceId = `poly-src-${id}`;
    if (this.map.getLayer(layerIdFill)) this.map.removeLayer(layerIdFill);
    if (this.map.getLayer(layerIdOutline)) this.map.removeLayer(layerIdOutline);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }
}

function openPlaceSidebar(place) {
  closeAllSidebars(); // Helper to close others
  const sidebar = document.getElementById('placeSidebar');
  if (!sidebar) return;

  // Set content
  document.getElementById('placeTitle').textContent = place.name;

  const catTrans = t(place.category) || place.category;
  document.getElementById('placeCategory').textContent = catTrans;

  const floorDisplay = Array.isArray(place.floor)
    ? (place.floor.includes('all') ? 'ชั้นทั้งหมด' : `ชั้น ${place.floor.join(', ')}`)
    : `ชั้น ${place.floor || 'G'}`;
  document.getElementById('placeLocationText').textContent = floorDisplay;

  // Build image carousel
  const images = place.images || (place.image ? [place.image] : []);
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  const counter = document.getElementById('carouselCounter');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const carousel = document.getElementById('placeImageCarousel');
  track.innerHTML = '';
  dots.innerHTML = '';

  // Add image slides
  images.forEach(img => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.style.backgroundImage = `url('images/streetview/${img}')`;
    track.appendChild(slide);
  });

  // Add 360° slide if panoramaId exists
  if (place.panoramaId) {
    const slide360 = document.createElement('div');
    slide360.className = 'carousel-slide-360';
    const viewerContainer = document.createElement('div');
    viewerContainer.style.cssText = 'width:100%;height:100%;position:relative;';
    viewerContainer.id = 'carousel360Viewer';
    slide360.appendChild(viewerContainer);

    // Overlay button to expand to full viewer
    const expandBtn = document.createElement('div');
    expandBtn.className = 'slide-360-expand';
    expandBtn.innerHTML = '<span class="material-symbols-rounded">fullscreen</span>';
    expandBtn.title = 'ขยาย 360°';
    slide360.appendChild(expandBtn);

    // Determine the panorama source
    const pin = allPins.find(p => p.id === place.panoramaId) || allPins.find(p => p.name === place.panoramaId);
    const panoSrc = pin
      ? `images/streetview/${pin.image}`
      : `images/streetview/${place.panoramaId}`;

    // Load mini viewer when slide becomes visible
    let miniViewer = null;
    const initMiniViewer = () => {
      if (miniViewer) return;
      try {
        miniViewer = new PhotoSphereViewer.Viewer({
          container: viewerContainer,
          panorama: panoSrc,
          navbar: false,
          defaultZoomLvl: 0,
          mousewheel: false,
          touchmoveTwoFingers: true,
        });
      } catch (e) {
        console.warn('Mini 360 viewer failed:', e);
        viewerContainer.innerHTML = '<div class="slide-360-label"><span class="material-symbols-rounded">360</span><span>360° ไม่สามารถโหลดได้</span></div>';
      }
    };

    // Init viewer when scrolled into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          initMiniViewer();
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });
    observer.observe(slide360);

    // Expand to full viewer on button click
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (miniViewer) { try { miniViewer.destroy(); } catch(e){} miniViewer = null; }
      sidebar.classList.remove('open');
      if (pin) {
        openViewer(place.panoramaId);
      } else {
        // Direct image — open a standalone viewer
        _openDirectPanorama(panoSrc, place.name);
      }
    });

    track.appendChild(slide360);
  }

  // If no images and no 360, show placeholder
  if (images.length === 0 && !place.panoramaId) {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.style.backgroundImage = `url('https://via.placeholder.com/380x220?text=No+Image')`;
    track.appendChild(slide);
  }

  const totalSlides = track.children.length;
  let currentSlide = 0;

  // Build dots
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dots.appendChild(dot);
  }

  // Counter
  const updateCounter = () => {
    counter.textContent = totalSlides > 1 ? `${currentSlide + 1} / ${totalSlides}` : '';
  };
  updateCounter();

  // Show/hide arrows
  const updateArrows = () => {
    prevBtn.style.display = totalSlides > 1 ? '' : 'none';
    nextBtn.style.display = totalSlides > 1 ? '' : 'none';
    // Always show controls on touch devices
    if (totalSlides > 1) carousel.classList.add('show-controls');
    else carousel.classList.remove('show-controls');
  };
  updateArrows();

  function goToSlide(idx) {
    currentSlide = idx;
    track.children[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    updateCounter();
  }

  prevBtn.onclick = () => goToSlide(currentSlide > 0 ? currentSlide - 1 : totalSlides - 1);
  nextBtn.onclick = () => goToSlide(currentSlide < totalSlides - 1 ? currentSlide + 1 : 0);

  // Sync dots on scroll (for swipe)
  track.addEventListener('scroll', () => {
    const scrollLeft = track.scrollLeft;
    const slideWidth = track.offsetWidth;
    const idx = Math.round(scrollLeft / slideWidth);
    if (idx !== currentSlide && idx >= 0 && idx < totalSlides) {
      currentSlide = idx;
      dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      updateCounter();
    }
  });

  // Populate Hours
  const hoursRow = document.getElementById('placeHoursRow');
  const hoursText = document.getElementById('placeHoursText');
  if (place.hours) {
    let text = '';
    if (typeof place.hours === 'string' && place.hours.trim() !== '') {
      text = place.hours;
    } else if (typeof place.hours === 'object') {
      const days = (place.hours.days && place.hours.days.length > 0) ? place.hours.days.join(', ') : '';
      const open = place.hours.open || '';
      const close = place.hours.close || '';

      if (days || open || close) {
        text = days;
        if (open && close) {
          text += text ? ` ${open} - ${close}` : `${open} - ${close}`;
        } else if (open) {
          text += text ? ` เปิด (Open) ${open}` : `เปิด (Open) ${open}`;
        } else if (close) {
          text += text ? ` ปิด (Close) ${close}` : `ปิด (Close) ${close}`;
        }
      }
    }

    if (text.trim() !== '') {
      hoursText.textContent = text.trim();
      hoursRow.style.display = 'flex';
    } else {
      hoursRow.style.display = 'none';
    }
  } else {
    hoursRow.style.display = 'none';
  }

  // Populate About Text
  const aboutText = document.getElementById('placeAboutText');
  aboutText.textContent = place.about || 'ไม่มีข้อมูลเพิ่มเติม (No additional info)';

  // Setup Tabs
  const tabs = document.querySelectorAll('.place-tab');
  const contents = document.querySelectorAll('.place-tab-content');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const targetId = 'placeTab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.style.display = 'block';
    };
  });
  // Reset to first tab
  if (tabs.length > 0) tabs[0].click();

  // 360 View Button
  const view360Btn = document.getElementById('placeView360Btn');
  if (place.panoramaId) {
    view360Btn.style.display = 'flex';
    view360Btn.onclick = () => {
      sidebar.classList.remove('open');
      openViewer(place.panoramaId, place.name);
    };
  } else {
    view360Btn.style.display = 'none';
  }

  // Save button
  const saveBtn = document.getElementById('placeSaveBtn');
  const updateSaveIcon = () => {
    const isSaved = savedPlaces.includes(place.id);
    saveBtn.innerHTML = `<div class="action-icon ${isSaved ? 'primary' : ''}"><span class="material-symbols-rounded">${isSaved ? 'bookmark' : 'bookmark_border'}</span></div><span>บันทึก</span>`;
  };
  updateSaveIcon();

  saveBtn.onclick = () => {
    if (savedPlaces.includes(place.id)) {
      savedPlaces = savedPlaces.filter(id => id !== place.id);
    } else {
      savedPlaces.push(place.id);
    }
    localStorage.setItem('saved_places', JSON.stringify(savedPlaces));
    updateSaveIcon();
  };

  // Nav button
  const navBtn = document.getElementById('placeNavBtn');
  navBtn.onclick = () => {
    sidebar.classList.remove('open');
    if (window.NavSystem) {
      window.NavSystem.navigateTo({
        type: 'place',
        id: place.id,
        name: place.name,
        coords: place.coords,
        floor: place.floor
      });
    } else {
      showToast(t('gpsError'), 'error');
    }
  };

  // Close btn
  document.getElementById('closePlaceSidebarBtn').onclick = () => {
    sidebar.classList.remove('open');
  };

  // DevTools Edit Button
  const editBtn = document.getElementById('placeEditDevBtn');
  if (window.devTools && window.devTools.isVisible) {
    editBtn.style.display = 'flex';
    editBtn.onclick = () => {
      sidebar.classList.remove('open');
      window.devTools.editPlace(place.id);
    };
  } else {
    editBtn.style.display = 'none';
  }

  // Slide in
  sidebar.classList.add('open');

  // Pan map
  const center = getPolygonCenter(place.coords);
  mapEngine.panTo([center[0], center[1]]);
}
const all = allPins.map(p => [p.lat, p.lng]);
if (all.length > 1) {
  mapEngine._ready.then(() => {
    mapEngine.addLine('main-path', all, {
      color: '#0a84ff',
      weight: 6,
      onClick: (ev) => {
        const clickPos = MapEngine.eventLatLng(ev);
        let nearest = null, minD = Infinity;
        allPins.forEach(p => {
          const d = MapEngine.distance(clickPos.lat, clickPos.lng, p.lat, p.lng);
          if (d < minD) { minD = d; nearest = p; }
        });
        if (nearest) openViewer(nearest.name);
      }
    });
    mainPathPolyline = true;
  });
}

loadPins();
loadPlaces();

// getPolygonCenter is defined above (near loadPlaces) — removed duplicate here




function loadSavedPaths() {
  fetch('data/paths.json')
    .then(r => r.json())
    .then(paths => {
      if (paths && paths.length > 0) {
        paths.forEach(p => {
          const poly = L.polyline(p.coords, { color: '#0a84ff', weight: 5 }).addTo(map);

          // Click handler for 360° - find nearest panorama
          poly.on('click', (ev) => {
            if (p.panoramas && p.panoramas.length > 0) {
              // Find nearest panorama to click point
              let nearest = p.panoramas[0];
              let minDist = ev.latlng.distanceTo(L.latLng(nearest.lat, nearest.lng));

              p.panoramas.forEach(pano => {
                const dist = ev.latlng.distanceTo(L.latLng(pano.lat, pano.lng));
                if (dist < minDist) {
                  minDist = dist;
                  nearest = pano;
                }
              });

              openPanoramaViewer(nearest);
            } else {
              mapEngine.panTo(poly.getBounds().getCenter());
              showToast(`Path: ${p.name}`, 'info');
            }
          });

          // Add 360° markers along path
          if (p.panoramas && p.panoramas.length > 0) {
            p.panoramas.forEach(pano => {
              const marker = L.circleMarker([pano.lat, pano.lng], {
                radius: 6,
                fillColor: '#0a84ff',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9,
                className: 'panorama-marker'
              }).addTo(map);

              marker.bindTooltip(pano.name || '360° View', {
                direction: 'top',
                offset: [0, -8]
              });

              marker.on('click', () => {
                openPanoramaViewer(pano);
              });
            });
          }

          p.polyline = poly;
          drawnPathLayers.push(poly);
          savedPaths.push(p);
        });
      }
    })
    .catch(() => { })
    .finally(() => {
      try {
        const local = JSON.parse(localStorage.getItem('saved_paths') || '[]');
        local.forEach(p => {
          const poly = L.polyline(p.coords, { color: '#ff6b6b', weight: 5, dashArray: '10, 5' }).addTo(map);

          // Click handler for 360°
          poly.on('click', (ev) => {
            if (p.panoramas && p.panoramas.length > 0) {
              // Find nearest panorama to click point
              let nearest = p.panoramas[0];
              let minDist = ev.latlng.distanceTo(L.latLng(nearest.lat, nearest.lng));

              p.panoramas.forEach(pano => {
                const dist = ev.latlng.distanceTo(L.latLng(pano.lat, pano.lng));
                if (dist < minDist) {
                  minDist = dist;
                  nearest = pano;
                }
              });

              openPanoramaViewer(nearest);
            } else {
              mapEngine.panTo(poly.getBounds().getCenter());
              showToast(`Local: ${p.name}`, 'info');
            }
          });

          // Add 360° markers for local paths
          if (p.panoramas && p.panoramas.length > 0) {
            p.panoramas.forEach(pano => {
              const marker = L.circleMarker([pano.lat, pano.lng], {
                radius: 6,
                fillColor: '#ff6b6b',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9,
                className: 'panorama-marker'
              }).addTo(map);

              marker.bindTooltip(pano.name || '360° View', {
                direction: 'top',
                offset: [0, -8]
              });

              marker.on('click', () => {
                openPanoramaViewer(pano);
              });
            });
          }

          p.polyline = poly;
          drawnPathLayers.push(poly);
          savedPaths.push(p);
        });
      } catch (e) { }
    });
}

loadSavedPaths();

// =================== VIEWER ===================
function _openDirectPanorama(src, name) {
  const viewerOverlay = document.getElementById('viewerOverlay');
  viewerOverlay.style.display = 'flex';
  try {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch (e) { }
      viewerInstance = null;
    }
    document.getElementById('viewer').innerHTML = '';
    showViewerLoading();
    
    // Ensure correct path
    const fullSrc = src.includes('/') ? src : `images/streetview/${src}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      panorama: fullSrc,
      caption: name || '360\u00b0 View',
      defaultZoomLvl: 0
    });
    
    viewerInstance.once('ready', () => {
      hideViewerLoading();
    });
  } catch (e) {
    hideViewerLoading();
    if (typeof showToast === 'function') showToast('Error loading 360\u00b0 view', 'error');
    console.error(e);
  }
}
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerClose = document.getElementById('viewerClose');

// Show/hide loading spinner inside the viewer card
function showViewerLoading() {
  const viewerEl = document.getElementById('viewer');
  // Remove any existing spinner
  const existing = viewerEl.querySelector('.viewer-loading');
  if (existing) existing.remove();
  // Add spinner
  const loader = document.createElement('div');
  loader.className = 'viewer-loading';
  loader.innerHTML = '<div class="viewer-loading-spinner"></div><div class="viewer-loading-text">Loading 360\u00b0...</div>';
  viewerEl.appendChild(loader);
}

function hideViewerLoading() {
  const viewerEl = document.getElementById('viewer');
  const loader = viewerEl.querySelector('.viewer-loading');
  if (loader) loader.remove();
}

function drawStreetViewPaths() {
  if (!allPins || allPins.length === 0) return;

  const floorPins = allPins.filter(p => (p.floor || 0) === currentFloor && !p.local);

  if (floorPins.length === 0) {
    if (window.mapEngine && typeof window.mapEngine.addStreetViewLayer === 'function') {
      window.mapEngine.addStreetViewLayer({ type: 'FeatureCollection', features: [] }, window.openViewer);
    }
    return;
  }

  // Sort pins logically to form a continuous path
  const sortedPins = [...floorPins].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
    if (numA && numB) return numA - numB;
    return a.name.localeCompare(b.name);
  });

  const features = [];
  const coords = [];

  sortedPins.forEach(p => {
    coords.push([p.lng, p.lat]);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name }
    });
  });

  if (coords.length > 1) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {}
    });
  }

  const geojson = { type: 'FeatureCollection', features };
  if (window.mapEngine && typeof window.mapEngine.addStreetViewLayer === 'function') {
    window.mapEngine.addStreetViewLayer(geojson, (id) => window.openViewer(id));
  }
}

function openViewer(idOrName, directName = null) {
  // Try finding by ID first, then fallback to name
  const pin = allPins.find(p => p.id === idOrName) || allPins.find(p => p.name === idOrName);
  
  if (!pin) {
    if (idOrName && (idOrName.endsWith('.jpg') || idOrName.endsWith('.png') || idOrName.includes('/'))) {
      _openDirectPanorama(idOrName, directName || '360° View');
      return;
    }
    showToast('Pin not found', 'error');
    return;
  }

  viewerOverlay.style.display = 'flex';

  try {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch (e) { }
      viewerInstance = null;
    }

    document.getElementById('viewer').innerHTML = '';
    showViewerLoading();
    const src = pin.local ? pin.image : `images/streetview/${pin.image}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      plugins: [
        [PhotoSphereViewer.MarkersPlugin, {}],
        [PhotoSphereViewer.VirtualTourPlugin, {
          positionMode: 'gps',
          renderMode: '3d',
          transitionOptions: {
            rotation: false,
          }
        }]
      ]
    });

    const virtualTour = viewerInstance.getPlugin(PhotoSphereViewer.VirtualTourPlugin);

    if (pin.local) {
      virtualTour.setNodes([{
        id: pin.id,
        panorama: src,
        name: pin.name,
        caption: pin.name + ' (Local)',
        links: []
      }], pin.id);
    } else {
      const nodes = allPins.filter(p => !p.local).map(p => {
        let links = [];
        if (p.connections && Object.keys(p.connections).length > 0) {
          links = Object.keys(p.connections).map(targetId => ({ nodeId: targetId }));
        } else {
          // Smart sequential auto-link logic
          const sameFloorPins = allPins.filter(other => other.floor === p.floor && !other.local);

          const sortedPins = [...sameFloorPins].sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
            if (numA && numB) return numA - numB;
            return a.name.localeCompare(b.name);
          });

          const myIndex = sortedPins.findIndex(other => other.id === p.id);
          const myNum = parseInt(p.name.replace(/\D/g, '')) || 0;

          if (myIndex !== -1) {
            if (myNum > 0) {
              // I am a numbered room, link to previous and next in sorted list
              if (myIndex > 0) links.push({ nodeId: sortedPins[myIndex - 1].id });
              if (myIndex < sortedPins.length - 1) links.push({ nodeId: sortedPins[myIndex + 1].id });

              // Also link back to any unnumbered rooms that consider ME their closest node
              const unnumberedPins = sortedPins.filter(other => (parseInt(other.name.replace(/\D/g, '')) || 0) === 0);
              unnumberedPins.forEach(unnum => {
                const numberedPins = sortedPins.filter(other => (parseInt(other.name.replace(/\D/g, '')) || 0) > 0);
                const distances = numberedPins.map(other => {
                  const dx = (other.lng - unnum.lng) * 111320 * Math.cos(unnum.lat * Math.PI / 180);
                  const dy = (other.lat - unnum.lat) * 111320;
                  return { id: other.id, dist: Math.sqrt(dx * dx + dy * dy) };
                });
                distances.sort((a, b) => a.dist - b.dist);
                if (distances.length > 0 && distances[0].id === p.id) {
                  links.push({ nodeId: unnum.id });
                }
              });
            } else {
              // I am an unnumbered room, link me to my closest geographic numbered node
              const numberedPins = sortedPins.filter(other => (parseInt(other.name.replace(/\D/g, '')) || 0) > 0);
              const distances = numberedPins.map(other => {
                const dx = (other.lng - p.lng) * 111320 * Math.cos(p.lat * Math.PI / 180);
                const dy = (other.lat - p.lat) * 111320;
                return { id: other.id, dist: Math.sqrt(dx * dx + dy * dy) };
              });
              distances.sort((a, b) => a.dist - b.dist);
              if (distances.length > 0) {
                links.push({ nodeId: distances[0].id });
              }
            }
          }
        }

        return {
          id: p.id,
          panorama: `images/streetview/${p.image}`,
          name: p.name,
          caption: p.name,
          links: links,
          gps: [p.lng, p.lat, 0],
          sphereCorrection: { pan: p.yawOffset || 0 }
        };
      });
      virtualTour.setNodes(nodes, pin.id);
    }
    // Hide spinner when panorama is loaded and rendered
    viewerInstance.addEventListener('ready', () => {
      hideViewerLoading();
    });

    // Catch loading errors to provide a helpful message about missing physical files
    viewerInstance.addEventListener('error', (e) => {
      hideViewerLoading();
      if (!pin.image.startsWith('blob:')) {
        showToast(`Image not found! Make sure '${pin.image}' is inside the images/streetview/ folder.`, 'error');
      }
    });

  } catch (err) {
    showToast('Cannot open 360\u00b0', 'error');
    viewerOverlay.style.display = 'none';
  }
}

if (viewerClose) {
  viewerClose.addEventListener('click', () => {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch (e) { }
      viewerInstance = null;
    }
    // Also clean up dev-tools 360\u00b0 preview viewer
    if (window._devPreviewViewer) {
      try { window._devPreviewViewer.destroy(); } catch (e) { }
      window._devPreviewViewer = null;
    }
    viewerOverlay.style.display = 'none';
  });
}

window.openViewer = openViewer;

// Open panorama viewer for path 360\u00b0 photos
function openPanoramaViewer(panorama) {
  if (!panorama) {
    showToast('Panorama not found', 'error');
    return;
  }

  viewerOverlay.style.display = 'flex';

  try {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch (e) { }
      viewerInstance = null;
    }

    document.getElementById('viewer').innerHTML = '';
    showViewerLoading();
    const src = panorama.local ? panorama.image : `images/streetview/${panorama.image}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      panorama: src,
      caption: panorama.name || '360\u00b0 View'
    });

    // Hide spinner when panorama is loaded
    viewerInstance.addEventListener('ready', () => {
      hideViewerLoading();
    });

    viewerInstance.addEventListener('error', () => {
      hideViewerLoading();
    });
  } catch (err) {
    console.error('Panorama viewer error:', err);
    showToast('Cannot open 360\u00b0', 'error');
    viewerOverlay.style.display = 'none';
  }
}

window.openPanoramaViewer = openPanoramaViewer;

// =================== SOUND EFFECTS MANAGEMENT ===================

// =================== FLOOR PILL - Unified Component ===================
const floorPill = document.getElementById('floorPill');
const floorPillCurrent = document.getElementById('floorPillCurrent');
const floorPillList = document.getElementById('floorPillList');

// Initialize floor pill - populate ALL floors with sliding indicator
function initFloorPill() {
  if (!floorPillList) return;

  floorPillList.innerHTML = '';

  // Add floating indicator (the sliding blue circle)
  const indicator = document.createElement('div');
  indicator.className = 'floor-pill-indicator';
  indicator.id = 'floorPillIndicator';
  floorPillList.appendChild(indicator);

  // Add ALL floors
  FLOORS.forEach((floor, index) => {
    const item = document.createElement('div');
    item.className = 'floor-pill-item';
    item.setAttribute('data-floor', index);
    item.innerHTML = `
      <span class="floor-num">${index + 1}</span>
      <span class="floor-label">F</span>
    `;
    item.onclick = (e) => {
      e.stopPropagation();
      switchFloor(index);
    };
    floorPillList.appendChild(item);
  });

  // Position indicator at current floor after a short delay (to get correct heights)
  requestAnimationFrame(() => {
    updateIndicatorPosition(currentFloor, false);
  });

  // Update the current floor display in the button
  const currentFloorNumEl = document.getElementById('currentFloorNum');
  if (currentFloorNumEl) {
    currentFloorNumEl.textContent = currentFloor + 1;
  }
}

// Track current indicator Y position
let currentIndicatorY = 0;

// Update the sliding indicator position with spring animation
function updateIndicatorPosition(floorIndex, animate = true) {
  const indicator = document.getElementById('floorPillIndicator');
  const items = document.querySelectorAll('.floor-pill-item');

  if (!indicator || !items.length || !items[floorIndex]) return;

  const targetItem = items[floorIndex];
  const listRect = floorPillList.getBoundingClientRect();
  const itemRect = targetItem.getBoundingClientRect();

  // Calculate position relative to the list
  const topOffset = itemRect.top - listRect.top;
  const newY = topOffset + (itemRect.height / 2) - 16; // 16 = half of indicator height (32px)

  if (animate && currentIndicatorY !== newY) {
    // Determine direction
    const movingDown = newY > currentIndicatorY;

    // Set CSS custom properties for animation
    indicator.style.setProperty('--from-y', `${currentIndicatorY}px`);
    indicator.style.setProperty('--to-y', `${newY}px`);

    // Remove any existing animation class
    indicator.classList.remove('moving-up', 'moving-down');

    // Force reflow to restart animation
    void indicator.offsetWidth;

    // Add appropriate animation class
    indicator.classList.add(movingDown ? 'moving-down' : 'moving-up');

    // Clean up after animation
    setTimeout(() => {
      indicator.classList.remove('moving-up', 'moving-down');
      indicator.style.transform = `translateX(-50%) translateY(${newY}px) scaleY(1) scaleX(1)`;
    }, 400);
  } else {
    // No animation, just set position
    indicator.style.transform = `translateX(-50%) translateY(${newY}px) scaleY(1) scaleX(1)`;
  }

  currentIndicatorY = newY;
}

// Switch floor with sliding animation
function switchFloor(floorIndex) {
  if (floorIndex === currentFloor) {
    // Same floor clicked, just close
    if (floorPill) floorPill.classList.remove('expanded');
    return;
  }

  // Slide indicator to new position
  updateIndicatorPosition(floorIndex, true);

  currentFloor = floorIndex;

  // Update floor wayfinding color
  updateFloorColor(floorIndex);

  // Update pin visibility based on floor
  mapEngine.updateMarkerVisibility(floorIndex);

  // Update street view paths
  drawStreetViewPaths();

  // Update overlay via MapEngine
  const overlayBounds = {
    topLeft: FLOORS[floorIndex].bounds[0],
    topRight: [FLOORS[floorIndex].bounds[0][0], FLOORS[floorIndex].bounds[1][1]],
    bottomRight: FLOORS[floorIndex].bounds[1],
    bottomLeft: [FLOORS[floorIndex].bounds[1][0], FLOORS[floorIndex].bounds[0][1]]
  };
  mapEngine.setFloorOverlay(FLOORS[floorIndex].img, overlayBounds);

  // Update current floor display
  const currentFloorNumEl = document.getElementById('currentFloorNum');
  if (currentFloorNumEl) {
    currentFloorNumEl.textContent = floorIndex + 1;
  }

  // Auto-close floor pill
  if (floorPill) {
    floorPill.classList.remove('expanded');
    floorPill.setAttribute('aria-expanded', 'false');
  }
  // Update ARIA label
  if (floorPill) {
    floorPill.setAttribute('aria-label', `Floor selector, current floor ${floorIndex + 1}`);
  }
  showToast(`${t('floor')} ${floorIndex + 1}`, 'info');
}

// Floor wayfinding color — updates indicator and exposes --floor-color
function updateFloorColor(floorIndex) {
  const floorNum = floorIndex + 1;
  const root = document.documentElement;
  const floorColor = getComputedStyle(root).getPropertyValue(`--floor-${floorNum}`).trim();
  if (floorColor) {
    root.style.setProperty('--floor-color', floorColor);
  }
}

window.switchFloor = switchFloor;

// Floor pill click - toggle expand/collapse
function toggleFloorPill() {
  if (floorPill) {
    floorPill.classList.toggle('expanded');
    const isExpanded = floorPill.classList.contains('expanded');
    floorPill.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    // Update indicator position when expanded (after animation starts)
    if (isExpanded) {
      setTimeout(() => {
        updateIndicatorPosition(currentFloor, false);
      }, 50);
    }
  }
}

function closeFloorPill() {
  if (floorPill) {
    floorPill.classList.remove('expanded');
    floorPill.setAttribute('aria-expanded', 'false');
  }
}

if (floorPillCurrent) {
  floorPillCurrent.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFloorPill();
  });
}

// Keyboard support for floor pill
if (floorPill) {
  floorPill.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFloorPill();
    } else if (e.key === 'Escape' && floorPill.classList.contains('expanded')) {
      e.stopPropagation();
      closeFloorPill();
    }
  });
}

// Close pill when clicking outside
document.addEventListener('click', (e) => {
  if (floorPill) {
    const clickedInPill = floorPill.contains(e.target);
    if (!clickedInPill) {
      closeFloorPill();
    }
  }
});

// Initialize floor pill
initFloorPill();
updateFloorColor(currentFloor);

// Update floor pill when language changes
window.addEventListener('languagechange', () => {
  initFloorPill();
  const currentFloorNumEl = document.getElementById('currentFloorNum');
  if (currentFloorNumEl) {
    currentFloorNumEl.textContent = currentFloor + 1;
  }
});

// =================== LAYER SWITCHER ===================
const layerSwitcherBtn = document.getElementById('layerSwitcherBtn');
const layerSwitcherPanel = document.getElementById('layerSwitcherPanel');

if (layerSwitcherBtn && layerSwitcherPanel) {
  // Toggle panel
  layerSwitcherBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = layerSwitcherPanel.classList.contains('open');
    layerSwitcherPanel.classList.toggle('open');
    layerSwitcherBtn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
  });

  // Handle layer selection
  layerSwitcherPanel.querySelectorAll('.layer-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const layerType = option.getAttribute('data-layer');

      // ── 3D toggle (independent of base layer) ──
      if (layerType === '3d') {
        const is3D = mapEngine.is3DMode();
        mapEngine.set3DMode(!is3D); // handles pitch lock + gesture enable/disable

        if (!is3D) {
          // Entering 3D: tilt map
          mapEngine.map.easeTo({ pitch: 60, duration: 600 });
          option.classList.add('active');
          option.setAttribute('aria-selected', 'true');
          const lbl = document.getElementById('toggle3dLabel');
          if (lbl) lbl.textContent = '2D';
          showToast(t('view3DEnabled') || 'View: 3D', 'info');
        } else {
          // Returning to 2D: set3DMode already snaps pitch + locks gestures
          option.classList.remove('active');
          option.setAttribute('aria-selected', 'false');
          const lbl = document.getElementById('toggle3dLabel');
          if (lbl) lbl.textContent = '3D';
          showToast(t('view2DEnabled') || 'View: 2D', 'info');
        }

        // Close panel
        layerSwitcherPanel.classList.remove('open');
        layerSwitcherBtn.setAttribute('aria-expanded', 'false');
        return; // Don't touch base layer active states
      }

      // ── Base layer switch (osm / satellite) ──
      mapEngine.switchBaseLayer(layerType);

      // Update UI active states (only among non-3D options)
      layerSwitcherPanel.querySelectorAll('.layer-option:not([data-layer="3d"])').forEach(opt => {
        opt.classList.remove('active');
        opt.setAttribute('aria-selected', 'false');
      });
      option.classList.add('active');
      option.setAttribute('aria-selected', 'true');

      // Close panel after selection
      layerSwitcherPanel.classList.remove('open');
      layerSwitcherBtn.setAttribute('aria-expanded', 'false');

      // Show toast
      const layerName = layerType === 'satellite' ? 'Satellite' : 'Map';
      showToast(`Layer: ${layerName}`, 'info');
    });

    // Keyboard support
    option.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        option.click();
      }
    });
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!layerSwitcherPanel.contains(e.target) && !layerSwitcherBtn.contains(e.target)) {
      layerSwitcherPanel.classList.remove('open');
      layerSwitcherBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// =================== SEARCH FUNCTIONALITY ===================
const searchInput = document.getElementById('searchInput');
const searchRecommendations = document.getElementById('searchRecommendations');
const searchEmptyState = document.getElementById('searchEmptyState');

function searchLocations(query) {
  if (!query || query.trim() === '') return [];

  query = query.toLowerCase().trim();
  let results = [];

  // Search in locations.json file
  const fileResults = locationsFromFile.filter(location => {
    // Search in name
    if (location.name.toLowerCase().includes(query)) return true;
    // Search in keywords if available
    if (location.keywords && Array.isArray(location.keywords)) {
      return location.keywords.some(keyword =>
        keyword.toLowerCase().includes(query)
      );
    }
    return false;
  });

  results = results.concat(fileResults);

  // Search in existing pins (allPins)
  if (allPins && allPins.length > 0) {
    const pinResults = allPins.filter(pin => {
      return pin.name && pin.name.toLowerCase().includes(query);
    }).map(pin => ({
      id: pin.id,
      name: pin.name,
      floor: pin.floor !== undefined ? pin.floor : 0,
      lat: pin.lat,
      lng: pin.lng,
      type: 'pin'
    }));

    results = results.concat(pinResults);
  }

  // Search in places (new feature)
  if (allPlaces && allPlaces.length > 0) {
    const placeResults = allPlaces.filter(place => {
      const matchName = place.name && place.name.toLowerCase().includes(query);
      const matchCategory = place.category && (t(place.category).toLowerCase().includes(query) || place.category.toLowerCase().includes(query));
      return matchName || matchCategory;
    }).map(place => {
      const center = getPolygonCenter(place.coords);
      return {
        id: place.id,
        name: place.name,
        floor: place.floor !== undefined ? place.floor : 0,
        lat: center[0],
        lng: center[1],
        type: 'place',
        category: place.category
      };
    });
    results = results.concat(placeResults);
  }

  // Search in buildings
  if (savedBuildings && savedBuildings.length > 0) {
    const buildingResults = savedBuildings.filter(building => {
      return building.name && building.name.toLowerCase().includes(query);
    }).map(building => ({
      name: building.name,
      lat: building.labelPosition[0],
      lng: building.labelPosition[1],
      type: 'building',
      buildingType: building.type,
      floors: building.floors
    }));

    results = results.concat(buildingResults);
  }

  // Remove duplicates by name
  const uniqueResults = [];
  const seen = new Set();
  for (const result of results) {
    if (!seen.has(result.name)) {
      seen.add(result.name);
      uniqueResults.push(result);
    }
  }

  // Return only max results
  return uniqueResults.slice(0, SEARCH_MAX_RESULTS);
}

// Opens a search result (from the result list or from "recent searches"): switches floor, flies there, opens its card.
function selectSearchResult(result) {
  playRandomSound(); // Play sound on click
  // For buildings, just zoom to location
  if (result.type === 'building') {
    mapEngine.setView([result.lat, result.lng], 19, { animate: true });
  } else {
    // For regular locations, switch floor if needed
    let targetFloor = result.floor;
    if (Array.isArray(result.floor)) {
      if (!result.floor.includes('all') && !result.floor.includes(currentFloor)) {
        targetFloor = result.floor[0];
      } else {
        targetFloor = currentFloor; // Stay on current floor if applicable
      }
    }
    if (targetFloor !== undefined && targetFloor !== currentFloor) {
      switchFloor(targetFloor);
    }
    mapEngine.setView([result.lat, result.lng], 19, { animate: true });

    if (result.type === 'pin' && result.id) {
      // Give the map a moment to pan before opening popup
      setTimeout(() => {
        mapEngine.openMarkerPopup(`pin_marker_${result.id}`);
      }, 100);
    } else if (result.type === 'place' && result.id) {
      const p = allPlaces.find(x => x.id === result.id);
      if (p) openPlaceSidebar(p);
    }
  }

  // Close search dropdown
  searchRecommendations.classList.remove('active');
  searchInput.value = '';
  if (searchEmptyState) searchEmptyState.style.display = 'none';
  if (searchInput.blur) searchInput.blur();

  showToast(`${t('searchResults')}: ${result.name}`, 'success');
}

function displaySearchResults(results) {
  if (!searchRecommendations) return;

  searchRecommendations.innerHTML = '';

  if (results.length === 0) {
    // Show "Not found" message
    const notFoundDiv = document.createElement('div');
    notFoundDiv.className = 'search-result-item not-found';
    notFoundDiv.textContent = t('notFound');
    searchRecommendations.appendChild(notFoundDiv);
  } else {
    // Show results
    results.forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'search-result-item';

      // Determine icon and info text based on type
      let icon = '<span class="material-symbols-rounded">location_on</span>';
      let infoText = '';

      if (result.type === 'building') {
        icon = '🏢';
        infoText = `${result.floors} floor${result.floors > 1 ? 's' : ''} • ${result.buildingType}`;
      } else if (result.floor !== undefined) {
        if (Array.isArray(result.floor)) {
          infoText = result.floor.includes('all') ? 'ชั้นทั้งหมด' : `${t('floor')} ${result.floor.join(', ')}`;
        } else {
          infoText = `${t('floor')} ${result.floor}`;
        }
      }

      resultDiv.innerHTML = `
        <span style="margin-right:8px;">${icon}</span>
        <strong>${result.name}</strong>
        <span style="color:var(--muted);font-size:12px;margin-left:8px;">${infoText}</span>
      `;

      resultDiv.addEventListener('click', () => {
        if (window.SearchHistory) window.SearchHistory.add(result);
        selectSearchResult(result);
      });

      searchRecommendations.appendChild(resultDiv);
    });
  }

  searchRecommendations.classList.add('active');
}
window.displaySearchResults = displaySearchResults;

if (searchInput) {
  const searchClear = document.getElementById('searchClear');

  // Update clear button visibility
  const updateClearButton = () => {
    if (searchClear) {
      if (searchInput.value.length > 0) {
        searchClear.classList.add('visible');
      } else {
        searchClear.classList.remove('visible');
      }
    }
  };

  const debouncedSearch = debounce((query) => {
    if (query.trim() === '') {
      searchRecommendations.classList.remove('active');
      searchInput.setAttribute('aria-expanded', 'false');
      if (searchEmptyState) searchEmptyState.style.display = 'block';
      return;
    }

    if (searchEmptyState) searchEmptyState.style.display = 'none';
    const results = searchLocations(query);
    (window.displaySearchResults || displaySearchResults)(results);
    searchInput.setAttribute('aria-expanded', searchRecommendations.classList.contains('active') ? 'true' : 'false');
  }, 200);

  searchInput.addEventListener('input', (e) => {
    updateClearButton();
    if (e.target.value.trim() === '') {
      searchRecommendations.classList.remove('active');
      if (searchEmptyState) searchEmptyState.style.display = 'block';
    } else {
      if (searchEmptyState) searchEmptyState.style.display = 'none';
    }
    debouncedSearch(e.target.value);
  });

  // Digital glitch particle effect
  const createSnapEffect = (text) => {
    const container = searchInput.parentElement;
    const inputStyle = getComputedStyle(searchInput);
    const paddingLeft = parseFloat(inputStyle.paddingLeft) || 0;
    const inputOffset = searchInput.offsetLeft || 0;
    const startX = inputOffset + paddingLeft;
    const fontSize = parseFloat(inputStyle.fontSize);

    // Calculate accurate text width using a temporary element
    const tempSpan = document.createElement('span');
    tempSpan.style.font = inputStyle.font;
    tempSpan.style.fontSize = inputStyle.fontSize;
    tempSpan.style.fontFamily = inputStyle.fontFamily;
    tempSpan.style.fontWeight = inputStyle.fontWeight;
    tempSpan.style.letterSpacing = inputStyle.letterSpacing;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.textContent = text;
    document.body.appendChild(tempSpan);
    const measuredTextWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    // Constrain width to not overflow the search input
    const paddingRight = parseFloat(inputStyle.paddingRight);
    const maxWidth = searchInput.offsetWidth - paddingLeft - paddingRight - 10; // 10px buffer
    const textWidth = Math.min(measuredTextWidth, maxWidth);

    // Updated color palette for a "data deletion" vibe
    const glitchColors = [
      '#FF3131',
      '#00F5FF',
      '#FFFFFF',
      '#8c00ff',
      '#1a1a1b',
      '#ff2d55',
      '#FF5C5C'
    ];

    // Create red neon rectangle that "eats" the text first
    const wipeRect = document.createElement('div');
    wipeRect.className = 'text-wipe-rect';
    wipeRect.style.left = `${startX}px`;
    wipeRect.style.top = '8px';
    wipeRect.style.width = `${textWidth}px`;
    wipeRect.style.height = `${searchInput.offsetHeight - 16}px`;
    container.appendChild(wipeRect);

    // Remove rectangle after brief moment and spawn particles
    setTimeout(() => {
      wipeRect.remove();
    }, 150);

    // Create particles based on text length (spawn where text is) - delayed to happen after wipe
    const particleCount = Math.min(text.length * 3, 45);

    setTimeout(() => {
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('span');
        particle.className = 'search-particle';

        // Random square size (2-8px)
        const size = 2 + Math.random() * 8;
        particle.style.setProperty('--size', `${size}px`);

        // Random starting color (so not all green at once)
        const startColor = glitchColors[Math.floor(Math.random() * glitchColors.length)];
        particle.style.setProperty('--start-color', startColor);

        // Position only within text area
        const xPos = startX + Math.random() * textWidth;
        particle.style.left = `${xPos}px`;
        particle.style.top = `${10 + Math.random() * 20}px`; // Centered vertically

        // Random animation values - scatter outward
        const tx = (Math.random() - 0.5) * 110;
        const ty = (Math.random() - 0.5) * 25;
        const delay = Math.random() * 0.2; // Staggered start

        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        //particle.style.animationDelay = `${delay}s`;                //delay of particle before moving

        // Randomly assign one of 5 color cycling animations for variety
        const colorAnimIndex = Math.floor(Math.random() * 5) + 1;
        particle.style.animationName = `glitchMove, glitchColor${colorAnimIndex}`;
        particle.style.animationDuration = '0.7s, 0.1s';  // moving, color changes
        particle.style.animationTimingFunction = 'linear, steps(1)';
        particle.style.animationIterationCount = '1, infinite';
        particle.style.animationFillMode = 'forwards, none';

        container.appendChild(particle);

        // Remove particle after animation (match 0.9s animation + buffer)
        setTimeout(() => particle.remove(), 1100);
      }
    }, 150); // Delay particle spawn to match wipe rectangle disappearance


  };

  // Clear button click handler
  if (searchClear) {
    searchClear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Create snap effect before clearing + play glitch sound
      if (searchInput.value.length > 0) {
        createSnapEffect(searchInput.value);
        playGlitchSound();
      }

      searchInput.value = '';
      searchRecommendations.classList.remove('active');
      if (searchEmptyState) searchEmptyState.style.display = 'block';
      updateClearButton();
      searchInput.focus();
    });
  }

  // Mobile/Phone mode: expand search bar on focus, collapse on blur
  const topbar = document.getElementById('topbar');
  if (topbar) {
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim() === '') {
        if (searchEmptyState) searchEmptyState.style.display = 'block';
      }

      // Check for phone display mode OR actual small screen width
      const isPhoneMode = document.body.getAttribute('data-display') === 'phone';
      const isSmallScreen = window.innerWidth <= 768;
      if (isPhoneMode || isSmallScreen) {
        topbar.classList.add('search-focused');
        const gmSearchBox = document.getElementById('gmSearchBox');
        if (gmSearchBox) gmSearchBox.classList.add('search-focused');

        // Also expand search recommendations
        if (searchRecommendations) {
          searchRecommendations.classList.add('expanded');
        }
      }
    });

    searchInput.addEventListener('blur', () => {
      topbar.classList.remove('search-focused');
      const gmSearchBox = document.getElementById('gmSearchBox');
      if (gmSearchBox) gmSearchBox.classList.remove('search-focused');
      // Collapse search recommendations after a small delay (allows clicking results)
      setTimeout(() => {
        if (searchRecommendations) {
          searchRecommendations.classList.remove('expanded');
        }
      }, 200);
    });
  }

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    if (searchRecommendations && searchInput) {
      const clickedInSearch = searchInput.contains(e.target);
      const clickedInResults = searchRecommendations.contains(e.target);
      const clickedInEmptyState = searchEmptyState && searchEmptyState.contains(e.target);

      if (!clickedInSearch && !clickedInResults && !clickedInEmptyState) {
        searchRecommendations.classList.remove('active');
        if (searchEmptyState) searchEmptyState.style.display = 'none';
      }
    }
  });
}

// =================== GLOBAL CLICK SOUND HANDLER ===================
// Add sound to all clicks when in t-th mode
document.addEventListener('click', (e) => {
  if (currentLanguage === 't-th' && soundEffectsEnabled) {
    // Check if clicked element is interactive
    const target = e.target;
    const isInteractive =
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'INPUT' ||
      target.classList.contains('menu-item') ||
      target.classList.contains('search-result-item') ||
      target.classList.contains('floor-item') ||
      target.classList.contains('floor-pill-item') ||
      target.classList.contains('floor-pill-current') ||
      target.classList.contains('path-item') ||
      target.classList.contains('btn') ||
      target.closest('button') ||
      target.closest('.menu-item') ||
      target.closest('.floor-pill') ||
      target.closest('.clickable');

    if (isInteractive) {
      playRandomSound();
    }
  }
}, true); // Use capture phase to catch all clicks

// =================== GPS & NAVIGATION ===================
// The GPS tracker, route planner, turn-by-turn panel and directions picker live in
// nav-core.js (routing engine), navigation.js (GPS + UI) and nav-editor.js (dev-only walkway editor).
// navigation.js assigns the facade below (isNavigating / currentDestinationId / navigateToLocation).
let navigationController = null;

// =================== FLUENT EMOJI PARSER ===================
// Parse emojis to use Microsoft's Windows 11 Fluent Emojis across all platforms
console.log('App loaded!');
console.log('Sound effects:', soundEffectsEnabled ? 'enabled' : 'disabled');


// (.gm-search-directions is wired in navigation.js; the suggestions/recent list is search-history.js)

// Bottom Sheet Drag Logic for Mobile
const placeSidebar = document.getElementById('placeSidebar');
const handle = document.querySelector('.bottom-sheet-handle');
let startY = 0;
let currentY = 0;
let isDragging = false;

if (placeSidebar && handle) {
  const onTouchStart = (e) => {
    if (window.innerWidth > 768) return; // Only on mobile
    startY = e.touches[0].clientY;
    isDragging = true;
    placeSidebar.style.transition = 'none';
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) { // Only allow dragging down
      placeSidebar.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const onTouchEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    placeSidebar.style.transition = ''; // Restore CSS transition
    const deltaY = currentY - startY;

    if (deltaY > 100) {
      // Dragged down enough, close it
      placeSidebar.style.transform = '';
      placeSidebar.classList.remove('open');
    } else {
      // Snap back
      placeSidebar.style.transform = '';
    }
  };

  handle.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd);
};
