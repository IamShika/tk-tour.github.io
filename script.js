// =================== CONFIG ===================
const APP_VERSION = 'BETA Jun2.1H';
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
  } catch(e) {}

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
  } catch(e) {}

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

  map.on = function (event, handler) {
    const wrappedHandler = (e) => {
      if (e && e.lngLat) {
        e.latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      }
      handler(e);
    };
    const key = event + '_' + (handler.name || '') + '_' + handler.toString().slice(0, 50);
    _handlerMap.set(key, wrappedHandler);
    handler._wrappedCompat = wrappedHandler;
    _origOn(event, wrappedHandler);
    return map;
  };

  map.off = function (event, handler) {
    if (handler && handler._wrappedCompat) {
      _origOff(event, handler._wrappedCompat);
    } else {
      try { _origOff(event, handler); } catch (e) { }
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

  // map.panTo compat (accept [lat,lng] array)
  map.panTo = function (latLng) { mapEngine.panTo(latLng); };

  // map.getZoom is native to MapLibre, no patch needed
  // map.dragging compat
  map.dragging = {
    disable: () => mapEngine.disableDragging(),
    enable: () => mapEngine.enableDragging()
  };

  // map.invalidateSize compat
  map.invalidateSize = function () { mapEngine.resize(); };
})();

// =================== GLOBALS ===================
let allPins = [];
let markers = [];
let viewerInstance = null;
let drawingMode = false;
let currentPathCoords = [];
let currentPolyline = null;
let savedPaths = [];
let drawnPathLayers = [];

// Enhanced pathmaker globals
let pathPointMarkers = []; // Visual markers at each waypoint

// =================== SIDEBAR LOGIC ===================
const menuToggle = document.getElementById('menuToggle');
const mainSidebar = document.getElementById('mainSidebar');
const closeMainBtn = document.getElementById('closeSidebarBtn');

window.devMode = false;

// Re-fetch config.json to populate devMode correctly
fetch('config.json')
  .then(r => r.json())
  .then(cfg => {
    window.devMode = !!cfg.devMode;
  })
  .catch(() => { });

function closeAllSidebars() {
  if (mainSidebar) mainSidebar.classList.remove('open');
  // Accessibility: release focus trap and restore focus
  if (window._sidebarFocusTrap) {
    window._sidebarFocusTrap();
    window._sidebarFocusTrap = null;
  }
  if (mainSidebar) mainSidebar.setAttribute('aria-hidden', 'true');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
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
  }
});

document.addEventListener('click', (e) => {
  const clickedInMain = mainSidebar && mainSidebar.contains(e.target);
  const clickedToggle = menuToggle && menuToggle.contains(e.target);

  if (!clickedInMain && !clickedToggle) {
    closeAllSidebars();
  }
});

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
        const markerId = mapEngine.addMarker([pin.lat, pin.lng], {
          id: `pin_marker_${pin.id}`,
          floor: pinFloor,
          className: 'custom-pin-icon',
          html: '<i class="fa-solid fa-map-pin" style="font-size:32px;color:#0a84ff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>',
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
      });
      mapEngine.updateMarkerVisibility(currentFloor);
    })
    .catch(err => {
      allPins = [];
    })
    .finally(() => {
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
    });
}

loadPins();

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
              map.panTo(poly.getBounds().getCenter());
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
              map.panTo(poly.getBounds().getCenter());
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
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerClose = document.getElementById('viewerClose');

function openViewer(idOrName) {
  // Try finding by ID first, then fallback to name
  const pin = allPins.find(p => p.id === idOrName) || allPins.find(p => p.name === idOrName);
  if (!pin) {
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
    const src = pin.local ? pin.image : `images/streetview/${pin.image}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      panorama: src,
      caption: pin.name + (pin.local ? ' (Local)' : '')
    });
    
    // Catch loading errors to provide a helpful message about missing physical files
    viewerInstance.addEventListener('error', (e) => {
      if (!pin.image.startsWith('blob:')) {
        showToast(`Image not found! Make sure '${pin.image}' is inside the images/streetview/ folder.`, 'error');
      }
    });

  } catch (err) {
    showToast('Cannot open 360°', 'error');
    viewerOverlay.style.display = 'none';
  }
}

if (viewerClose) {
  viewerClose.addEventListener('click', () => {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch (e) { }
      viewerInstance = null;
    }
    // Also clean up dev-tools 360° preview viewer
    if (window._devPreviewViewer) {
      try { window._devPreviewViewer.destroy(); } catch (e) { }
      window._devPreviewViewer = null;
    }
    viewerOverlay.style.display = 'none';
  });
}

window.openViewer = openViewer;

// Open panorama viewer for path 360° photos
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
    const src = panorama.local ? panorama.image : `images/streetview/${panorama.image}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      panorama: src,
      caption: panorama.name || '360° View'
    });
  } catch (err) {
    console.error('Panorama viewer error:', err);
    showToast('Cannot open 360°', 'error');
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

// =================== SEARCH FUNCTIONALITY ===================
const searchInput = document.getElementById('searchInput');
const searchRecommendations = document.getElementById('searchRecommendations');

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
      name: pin.name,
      floor: pin.floor || 1,
      lat: pin.lat,
      lng: pin.lng,
      type: 'pin'
    }));

    results = results.concat(pinResults);
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
      } else if (result.floor) {
        infoText = `${t('floor')} ${result.floor}`;
      }

      resultDiv.innerHTML = `
        <span style="margin-right:8px;">${icon}</span>
        <strong>${result.name}</strong>
        <span style="color:var(--muted);font-size:12px;margin-left:8px;">${infoText}</span>
      `;

      resultDiv.addEventListener('click', () => {
        playRandomSound(); // Play sound on click

        // For buildings, just zoom to location
        if (result.type === 'building') {
          mapEngine.setView([result.lat, result.lng], 19, { animate: true });
        } else {
          // For regular locations, switch floor if needed
          if (result.floor && result.floor - 1 !== currentFloor) {
            switchFloor(result.floor - 1);
          }
          mapEngine.setView([result.lat, result.lng], 19, { animate: true });
        }

        // Close search dropdown
        searchRecommendations.classList.remove('active');
        searchInput.value = '';

        showToast(`${t('searchResults')}: ${result.name}`, 'success');
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
      return;
    }

    const results = searchLocations(query);
    (window.displaySearchResults || displaySearchResults)(results);
    searchInput.setAttribute('aria-expanded', searchRecommendations.classList.contains('active') ? 'true' : 'false');
  }, 200);

  searchInput.addEventListener('input', (e) => {
    updateClearButton();
    debouncedSearch(e.target.value);
  });

  // Digital glitch particle effect
  const createSnapEffect = (text) => {
    const container = searchInput.parentElement;
    const inputStyle = getComputedStyle(searchInput);
    const paddingLeft = parseFloat(inputStyle.paddingLeft);
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
    wipeRect.style.left = `${paddingLeft}px`;
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
        const xPos = paddingLeft + Math.random() * textWidth;
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
      updateClearButton();
      searchInput.focus();
    });
  }

  // Mobile/Phone mode: expand search bar on focus, collapse on blur
  const topbar = document.getElementById('topbar');
  if (topbar) {
    searchInput.addEventListener('focus', () => {
      // Check for phone display mode OR actual small screen width
      const isPhoneMode = document.body.getAttribute('data-display') === 'phone';
      const isSmallScreen = window.innerWidth <= 768;
      if (isPhoneMode || isSmallScreen) {
        topbar.classList.add('search-focused');
        // Also expand search recommendations
        if (searchRecommendations) {
          searchRecommendations.classList.add('expanded');
        }
      }
    });

    searchInput.addEventListener('blur', () => {
      topbar.classList.remove('search-focused');
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

      if (!clickedInSearch && !clickedInResults) {
        searchRecommendations.classList.remove('active');
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

// =================== GPS & NAVIGATION SYSTEM ===================

// Navigation Graph Data
let navGraph = { nodes: {}, edges: [], transitions: [] };

// GPS Tracker Class
class GPSTracker {
  constructor(mapInstance) {
    this.map = mapInstance;
    this.currentPosition = null;
    this.watchId = null;
    this.userMarker = null;
    this.accuracyCircle = null;
    this.isTracking = false;
    this.manualMode = false;
    this.currentFloor = 1;
    this.callbacks = [];
  }

  isGPSAvailable() {
    return 'geolocation' in navigator;
  }

  startTracking() {
    if (!this.isGPSAvailable()) {
      showToast(t('gpsUnavailable'), 'error');
      return false;
    }

    this.isTracking = true;
    document.getElementById('gpsBtn')?.classList.add('active');

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000  // Reduced for more frequent updates
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.handleError(err),
      options
    );

    // Watch position updates
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.handleError(err),
      options
    );

    return true;
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.manualMode = false;
    document.getElementById('gpsBtn')?.classList.remove('active', 'manual-mode');
  }

  handlePosition(pos) {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;

    // Check if within school bounds
    if (!this.isWithinBounds(latitude, longitude)) {
      // Stop tracking when out of bounds (only show toast once)
      if (this.isTracking) {
        showToast(t('gpsOutOfBounds'), 'error');
        this.stopTracking();
      }
      return;
    }

    this.currentPosition = {
      lat: latitude,
      lng: longitude,
      accuracy: accuracy,
      floor: this.currentFloor,
      source: 'gps',
      timestamp: Date.now(),
      heading: heading,
      speed: speed
    };

    this.updateMarker();
    this.notifyCallbacks();
  }

  handleError(err) {
    console.warn('GPS Error:', err.message);
    if (err.code === err.PERMISSION_DENIED) {
      showToast(t('gpsPermissionDenied'), 'error');
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      showToast(t('gpsUnavailable'), 'error');
    }
  }

  setManualPosition(latlng, floor) {
    this.currentPosition = {
      lat: latlng.lat,
      lng: latlng.lng,
      accuracy: 5,
      floor: floor || currentFloor + 1,
      source: 'manual',
      timestamp: Date.now()
    };

    this.manualMode = true;
    document.getElementById('gpsBtn')?.classList.remove('active');
    document.getElementById('gpsBtn')?.classList.add('manual-mode');

    this.updateMarker();
    this.notifyCallbacks();
    showToast(t('locationSet'), 'success');
  }

  updateMarker() {
    if (!this.currentPosition) return;

    const { lat, lng, accuracy } = this.currentPosition;

    // Create user location icon
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-marker-outer">
          <div class="user-marker-pulse"></div>
          <div class="user-marker-inner"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Update or create marker
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
    }

    // Update or create accuracy circle
    if (accuracy && accuracy > 10) {
      if (this.accuracyCircle) {
        this.accuracyCircle.setLatLng([lat, lng]);
        this.accuracyCircle.setRadius(accuracy);
      } else {
        this.accuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          className: 'user-accuracy-circle',
          interactive: false
        }).addTo(this.map);
      }
    } else if (this.accuracyCircle) {
      this.accuracyCircle.remove();
      this.accuracyCircle = null;
    }
  }

  removeMarker() {
    if (this.userMarker) {
      this.userMarker.remove();
      this.userMarker = null;
    }
    if (this.accuracyCircle) {
      this.accuracyCircle.remove();
      this.accuracyCircle = null;
    }
  }

  isWithinBounds(lat, lng) {
    return lat >= 14.083915 && lat <= 14.086142 &&
      lng >= 100.606071 && lng <= 100.610199;
  }

  centerOnUser() {
    if (this.currentPosition) {
      mapEngine.setView([this.currentPosition.lat, this.currentPosition.lng], 20);
    }
  }

  onPositionUpdate(callback) {
    this.callbacks.push(callback);
  }

  notifyCallbacks() {
    this.callbacks.forEach(cb => cb(this.currentPosition));
  }

  setFloor(floor) {
    this.currentFloor = floor;
    if (this.currentPosition) {
      this.currentPosition.floor = floor;
    }
  }
}

// MinHeap for A* algorithm
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return min;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].f <= this.heap[index].f) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.heap[leftChild].f < this.heap[smallest].f) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].f < this.heap[smallest].f) {
        smallest = rightChild;
      }

      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  contains(id) {
    return this.heap.some(item => item.id === id);
  }
}

// Pathfinder Class (A* Algorithm)
class Pathfinder {
  constructor(graph) {
    this.nodes = graph.nodes || {};
    this.edges = graph.edges || [];
    this.transitions = graph.transitions || [];
  }

  findPath(startNodeId, endNodeId, options = {}) {
    const { preferElevator = false, avoidStairs = false } = options;

    if (!this.nodes[startNodeId] || !this.nodes[endNodeId]) {
      console.warn('Invalid start or end node');
      return null;
    }

    const openSet = new MinHeap();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const closedSet = new Set();

    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, this.heuristic(startNodeId, endNodeId));
    openSet.push({ id: startNodeId, f: fScore.get(startNodeId) });

    while (!openSet.isEmpty()) {
      const current = openSet.pop();

      if (current.id === endNodeId) {
        return this.reconstructPath(cameFrom, current.id);
      }

      if (closedSet.has(current.id)) continue;
      closedSet.add(current.id);

      const neighbors = this.getNeighbors(current.id, { avoidStairs, preferElevator });

      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor.id)) continue;

        const tentativeG = gScore.get(current.id) + neighbor.cost;

        if (tentativeG < (gScore.get(neighbor.id) || Infinity)) {
          cameFrom.set(neighbor.id, {
            node: current.id,
            edge: neighbor.edge,
            transition: neighbor.transition
          });
          gScore.set(neighbor.id, tentativeG);
          fScore.set(neighbor.id, tentativeG + this.heuristic(neighbor.id, endNodeId));

          if (!openSet.contains(neighbor.id)) {
            openSet.push({ id: neighbor.id, f: fScore.get(neighbor.id) });
          }
        }
      }
    }

    return null; // No path found
  }

  heuristic(nodeAId, nodeBId) {
    const a = this.nodes[nodeAId];
    const b = this.nodes[nodeBId];
    if (!a || !b) return Infinity;

    const horizontalDist = this.haversineDistance(a.lat, a.lng, b.lat, b.lng);
    const floorPenalty = Math.abs((a.floor || 1) - (b.floor || 1)) * 30;
    return horizontalDist + floorPenalty;
  }

  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  getNeighbors(nodeId, options = {}) {
    const neighbors = [];
    const node = this.nodes[nodeId];
    if (!node) return neighbors;

    // Get neighbors from edges
    for (const edge of this.edges) {
      let neighborId = null;
      if (edge.from === nodeId) neighborId = edge.to;
      else if (edge.to === nodeId && edge.bidirectional !== false) neighborId = edge.from;

      if (neighborId && this.nodes[neighborId]) {
        neighbors.push({
          id: neighborId,
          cost: edge.distance || edge.walkTime || 10,
          edge: edge
        });
      }
    }

    // Get neighbors from transitions (stairs/elevators)
    for (const trans of this.transitions) {
      if (options.avoidStairs && trans.type === 'staircase') continue;

      const nodeIndex = trans.nodes?.indexOf(nodeId);
      if (nodeIndex !== -1 && trans.nodes) {
        // Connect to adjacent floors
        if (nodeIndex > 0) {
          const neighborId = trans.nodes[nodeIndex - 1];
          if (this.nodes[neighborId]) {
            let cost = trans.timeBetweenFloors || 30;
            if (options.preferElevator && trans.type === 'elevator') cost *= 0.5;
            neighbors.push({ id: neighborId, cost, transition: trans });
          }
        }
        if (nodeIndex < trans.nodes.length - 1) {
          const neighborId = trans.nodes[nodeIndex + 1];
          if (this.nodes[neighborId]) {
            let cost = trans.timeBetweenFloors || 30;
            if (options.preferElevator && trans.type === 'elevator') cost *= 0.5;
            neighbors.push({ id: neighborId, cost, transition: trans });
          }
        }
      }
    }

    return neighbors;
  }

  reconstructPath(cameFrom, endNodeId) {
    const path = [];
    let currentId = endNodeId;

    while (currentId) {
      const node = this.nodes[currentId];
      if (node) {
        path.unshift({ ...node, id: currentId });
      }
      const prev = cameFrom.get(currentId);
      currentId = prev ? prev.node : null;
    }

    return path;
  }

  findNearestNode(lat, lng, floor) {
    let nearest = null;
    let minDist = Infinity;

    for (const [id, node] of Object.entries(this.nodes)) {
      // Prefer same floor
      const floorMatch = (node.floor || 1) === floor;
      const dist = this.haversineDistance(lat, lng, node.lat, node.lng);
      const adjustedDist = floorMatch ? dist : dist + 100; // Penalty for different floor

      if (adjustedDist < minDist) {
        minDist = adjustedDist;
        nearest = { ...node, id };
      }
    }

    return nearest;
  }
}

// Directions Generator Class
class DirectionsGenerator {
  constructor(graph) {
    this.nodes = graph.nodes || {};
    this.edges = graph.edges || [];
    this.transitions = graph.transitions || [];
  }

  generateDirections(path) {
    if (!path || path.length < 2) return null;

    const steps = [];
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 0; i < path.length; i++) {
      const currentNode = path[i];
      const nextNode = path[i + 1];
      const prevNode = path[i - 1];

      if (!nextNode) {
        // Final destination
        steps.push({
          index: i,
          instruction: this.formatInstruction('arrive', { name: currentNode.name }),
          icon: '🏁',
          distance: 0,
          time: 0,
          node: currentNode,
          floor: currentNode.floor || 1,
          isDestination: true
        });
        break;
      }

      const instruction = this.generateInstruction(prevNode, currentNode, nextNode);
      const edge = this.findEdge(currentNode.id, nextNode.id);
      const distance = edge?.distance || this.calculateDistance(currentNode, nextNode);
      const time = edge?.walkTime || Math.round(distance / 1.4); // ~1.4 m/s walking speed

      totalDistance += distance;
      totalTime += time;

      steps.push({
        index: i,
        instruction: instruction.text,
        icon: instruction.icon,
        distance: distance,
        time: time,
        node: currentNode,
        floor: currentNode.floor || 1,
        isFloorChange: (currentNode.floor || 1) !== (nextNode.floor || 1)
      });
    }

    return {
      steps,
      totalDistance: Math.round(totalDistance),
      totalTime: Math.round(totalTime),
      startNode: path[0],
      endNode: path[path.length - 1]
    };
  }

  generateInstruction(prevNode, currentNode, nextNode) {
    // Check for floor transition
    if ((currentNode.floor || 1) !== (nextNode.floor || 1)) {
      const direction = (nextNode.floor || 1) > (currentNode.floor || 1) ? 'up' : 'down';
      const transitionType = currentNode.type || 'staircase';

      if (transitionType === 'elevator') {
        return {
          text: this.formatInstruction('takeElevator', { floor: nextNode.floor }),
          icon: '🛗'
        };
      } else {
        return {
          text: this.formatInstruction(direction === 'up' ? 'goStairsUp' : 'goStairsDown', { floor: nextNode.floor }),
          icon: direction === 'up' ? '⬆️' : '⬇️'
        };
      }
    }

    // Calculate turn direction
    if (prevNode) {
      const turn = this.calculateTurn(prevNode, currentNode, nextNode);
      if (turn === 'left') {
        return { text: t('turnLeft'), icon: '↰' };
      } else if (turn === 'right') {
        return { text: t('turnRight'), icon: '↱' };
      }
    }

    // Default: go straight or start
    if (!prevNode) {
      return { text: this.formatInstruction('startAt', { name: currentNode.name || t('yourLocation') }), icon: '<span class="material-symbols-rounded">location_on</span>' };
    }

    return { text: t('goStraight'), icon: '↑' };
  }

  calculateTurn(prevNode, currentNode, nextNode) {
    const bearing1 = this.calculateBearing(prevNode.lat, prevNode.lng, currentNode.lat, currentNode.lng);
    const bearing2 = this.calculateBearing(currentNode.lat, currentNode.lng, nextNode.lat, nextNode.lng);

    let turnAngle = bearing2 - bearing1;
    if (turnAngle > 180) turnAngle -= 360;
    if (turnAngle < -180) turnAngle += 360;

    if (turnAngle > 30) return 'right';
    if (turnAngle < -30) return 'left';
    return 'straight';
  }

  calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    return Math.atan2(y, x) * 180 / Math.PI;
  }

  calculateDistance(nodeA, nodeB) {
    const R = 6371e3;
    const phi1 = nodeA.lat * Math.PI / 180;
    const phi2 = nodeB.lat * Math.PI / 180;
    const deltaPhi = (nodeB.lat - nodeA.lat) * Math.PI / 180;
    const deltaLambda = (nodeB.lng - nodeA.lng) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  findEdge(fromId, toId) {
    return this.edges.find(e =>
      (e.from === fromId && e.to === toId) ||
      (e.to === fromId && e.from === toId && e.bidirectional !== false)
    );
  }

  formatInstruction(key, params = {}) {
    let text = t(key) || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  }
}

// Navigation Controller
class NavigationController {
  constructor(mapInstance) {
    this.map = mapInstance;
    this.gpsTracker = new GPSTracker(mapInstance);
    this.pathfinder = null;
    this.directionsGenerator = null;

    this.currentRoute = null;
    this.routePolylines = [];
    this.destinationMarker = null;
    this.transitionMarkers = [];
    this.isNavigating = false;
    this.currentStepIndex = 0;

    this.init();
  }

  async init() {
    await this.loadNavGraph();
    this.pathfinder = new Pathfinder(navGraph);
    this.directionsGenerator = new DirectionsGenerator(navGraph);
    this.setupEventListeners();
  }

  async loadNavGraph() {
    try {
      const response = await fetch('data/navgraph.json');
      navGraph = await response.json();
    } catch (err) {
      console.warn('Could not load navgraph.json:', err);
      navGraph = { nodes: {}, edges: [], transitions: [] };
    }
  }

  setupEventListeners() {
    // GPS Button
    const gpsBtn = document.getElementById('gpsBtn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => this.handleGPSButtonClick());
    }

    // Manual location overlay
    const cancelManualBtn = document.getElementById('cancelManualBtn');
    if (cancelManualBtn) {
      cancelManualBtn.addEventListener('click', () => this.exitManualLocationMode());
    }

    // Navigation panel close
    const navCloseBtn = document.getElementById('navCloseBtn');
    if (navCloseBtn) {
      navCloseBtn.addEventListener('click', () => this.endNavigation());
    }

    // End navigation button
    const endNavBtn = document.getElementById('endNavBtn');
    if (endNavBtn) {
      endNavBtn.addEventListener('click', () => this.endNavigation());
    }

    // GPS position updates
    this.gpsTracker.onPositionUpdate((pos) => {
      if (this.isNavigating) {
        this.trackProgress(pos);
      }
    });
  }

  handleGPSButtonClick() {
    if (this.gpsTracker.isTracking || this.gpsTracker.manualMode) {
      // If already tracking or in manual mode, stop tracking (toggle off)
      this.stopGPSTracking();
    } else {
      // Try GPS first
      if (!this.gpsTracker.startTracking()) {
        // GPS failed, prompt manual mode
        this.enterManualLocationMode();
      }
    }
  }

  stopGPSTracking() {
    this.gpsTracker.stopTracking();
    this.gpsTracker.removeMarker();
  }

  enterManualLocationMode() {
    const overlay = document.getElementById('manualLocationOverlay');
    if (overlay) overlay.classList.add('active');

    document.getElementById('gpsBtn')?.classList.add('manual-mode');

    // One-time map click handler
    const mapClickHandler = (e) => {
      this.gpsTracker.setManualPosition(e.latlng, currentFloor + 1);
      this.exitManualLocationMode();
      this.map.off('click', mapClickHandler);
    };

    this.map.on('click', mapClickHandler);
    this._manualClickHandler = mapClickHandler;
  }

  exitManualLocationMode() {
    const overlay = document.getElementById('manualLocationOverlay');
    if (overlay) overlay.classList.remove('active');

    if (!this.gpsTracker.manualMode) {
      document.getElementById('gpsBtn')?.classList.remove('manual-mode');
    }

    if (this._manualClickHandler) {
      this.map.off('click', this._manualClickHandler);
      this._manualClickHandler = null;
    }
  }

  async startNavigation(destinationId, options = {}) {
    // Get current position
    const startPos = this.gpsTracker.currentPosition;
    if (!startPos) {
      showToast(t('setLocationFirst'), 'error');
      this.enterManualLocationMode();
      return;
    }

    // Find nearest node to current position
    const startNode = this.pathfinder.findNearestNode(
      startPos.lat,
      startPos.lng,
      startPos.floor || currentFloor + 1
    );

    if (!startNode) {
      showToast(t('noRouteFound'), 'error');
      return;
    }

    // Calculate path
    const path = this.pathfinder.findPath(startNode.id, destinationId, options);

    if (!path || path.length === 0) {
      showToast(t('noRouteFound'), 'error');
      return;
    }

    // Generate directions
    this.currentRoute = this.directionsGenerator.generateDirections(path);

    if (!this.currentRoute) {
      showToast(t('noRouteFound'), 'error');
      return;
    }

    // Display route on map
    this.displayRoute(path);

    // Show navigation panel
    this.showNavigationPanel();

    // Start tracking progress
    this.isNavigating = true;
    this.currentStepIndex = 0;
  }

  // Navigate to a pin or location by name/coords
  navigateToLocation(location) {
    if (!location) return;

    // Check if navigation graph is loaded
    if (!navGraph || !navGraph.nodes || Object.keys(navGraph.nodes).length === 0) {
      showToast('Navigation system not set up yet. Please create navigation graph first.', 'error');
      return;
    }

    // If location has an ID in navGraph, use it
    if (location.id && navGraph.nodes[location.id]) {
      this.startNavigation(location.id);
      return;
    }

    // Otherwise find nearest node to this location
    const nearestNode = this.pathfinder.findNearestNode(
      location.lat,
      location.lng,
      location.floor || 1
    );

    if (nearestNode) {
      this.startNavigation(nearestNode.id);
    } else {
      showToast(t('noRouteFound'), 'error');
    }
  }

  displayRoute(path) {
    this.clearRoute();

    if (!path || path.length < 2) return;

    // Group path by floor
    const floorSegments = [];
    let currentSegment = { floor: path[0].floor || 1, coords: [] };

    for (const node of path) {
      if ((node.floor || 1) !== currentSegment.floor) {
        if (currentSegment.coords.length > 0) {
          floorSegments.push(currentSegment);
        }
        currentSegment = { floor: node.floor || 1, coords: [] };
      }
      currentSegment.coords.push([node.lat, node.lng]);
    }
    if (currentSegment.coords.length > 0) {
      floorSegments.push(currentSegment);
    }

    // Draw polylines for each floor segment
    for (const segment of floorSegments) {
      if (segment.coords.length < 2) continue;

      const shadow = L.polyline(segment.coords, {
        color: 'rgba(10, 132, 255, 0.3)',
        weight: 12,
        lineCap: 'round',
        lineJoin: 'round'
      });

      const line = L.polyline(segment.coords, {
        color: '#0a84ff',
        weight: 6,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // Only show on current floor
      if (segment.floor === currentFloor + 1) {
        shadow.addTo(this.map);
        line.addTo(this.map);
      }

      this.routePolylines.push({ floor: segment.floor, shadow, line });
    }

    // Add destination marker
    const endNode = path[path.length - 1];
    this.destinationMarker = L.marker([endNode.lat, endNode.lng], {
      icon: L.divIcon({
        className: 'destination-marker',
        html: '<div class="destination-marker-inner">🏁</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
    });

    if ((endNode.floor || 1) === currentFloor + 1) {
      this.destinationMarker.addTo(this.map);
    }

    // Add floor transition markers
    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];

      if ((current.floor || 1) !== (next.floor || 1)) {
        const marker = L.marker([current.lat, current.lng], {
          icon: L.divIcon({
            className: 'floor-transition-marker',
            html: current.type === 'elevator' ? '🛗' : '🪜',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        });

        if ((current.floor || 1) === currentFloor + 1) {
          marker.addTo(this.map);
        }

        this.transitionMarkers.push({ floor: current.floor || 1, marker });
      }
    }

    // Fit map to route
    const allCoords = path.map(n => [n.lat, n.lng]);
    this.map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
  }

  updateVisibleRoute(floor) {
    // Show/hide polylines based on floor
    for (const polyline of this.routePolylines) {
      if (polyline.floor === floor) {
        if (!this.map.hasLayer(polyline.shadow)) {
          polyline.shadow.addTo(this.map);
          polyline.line.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(polyline.shadow)) {
          polyline.shadow.remove();
          polyline.line.remove();
        }
      }
    }

    // Show/hide destination marker
    if (this.destinationMarker && this.currentRoute) {
      const endFloor = this.currentRoute.endNode.floor || 1;
      if (endFloor === floor) {
        if (!this.map.hasLayer(this.destinationMarker)) {
          this.destinationMarker.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(this.destinationMarker)) {
          this.destinationMarker.remove();
        }
      }
    }

    // Show/hide transition markers
    for (const tm of this.transitionMarkers) {
      if (tm.floor === floor) {
        if (!this.map.hasLayer(tm.marker)) {
          tm.marker.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(tm.marker)) {
          tm.marker.remove();
        }
      }
    }
  }

  clearRoute() {
    for (const polyline of this.routePolylines) {
      polyline.shadow.remove();
      polyline.line.remove();
    }
    this.routePolylines = [];

    if (this.destinationMarker) {
      this.destinationMarker.remove();
      this.destinationMarker = null;
    }

    for (const tm of this.transitionMarkers) {
      tm.marker.remove();
    }
    this.transitionMarkers = [];
  }

  showNavigationPanel() {
    const panel = document.getElementById('navigationPanel');
    if (panel) panel.classList.add('active');

    this.updateNavigationUI();
  }

  hideNavigationPanel() {
    const panel = document.getElementById('navigationPanel');
    if (panel) panel.classList.remove('active');
  }

  updateNavigationUI() {
    if (!this.currentRoute) return;

    // Update destination
    const destEl = document.getElementById('navDestination');
    if (destEl) destEl.textContent = this.currentRoute.endNode.name || t('destination');

    // Update stats
    const distEl = document.getElementById('navDistance');
    if (distEl) {
      const dist = this.currentRoute.totalDistance;
      distEl.textContent = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    }

    const timeEl = document.getElementById('navTime');
    if (timeEl) {
      const mins = Math.ceil(this.currentRoute.totalTime / 60);
      timeEl.textContent = `${mins} ${t('minutes') || 'min'}`;
    }

    // Update current step
    const currentStep = this.currentRoute.steps[this.currentStepIndex];
    if (currentStep) {
      const iconEl = document.getElementById('navStepIcon');
      if (iconEl) iconEl.textContent = currentStep.icon;

      const instrEl = document.getElementById('navStepInstruction');
      if (instrEl) instrEl.textContent = currentStep.instruction;
    }

    // Update steps list
    const listEl = document.getElementById('navStepsList');
    if (listEl) {
      listEl.innerHTML = this.currentRoute.steps.map((step, i) => `
        <div class="nav-step-item ${i < this.currentStepIndex ? 'completed' : ''} ${i === this.currentStepIndex ? 'current' : ''} ${step.isFloorChange ? 'floor-change' : ''}">
          <div class="step-icon">${i < this.currentStepIndex ? '✓' : step.icon}</div>
          <div class="step-text">
            <div class="step-instruction">${step.instruction}</div>
            <div class="step-distance">${step.distance > 0 ? `${Math.round(step.distance)} m` : ''}</div>
          </div>
        </div>
      `).join('');
    }
  }

  trackProgress(pos) {
    if (!this.currentRoute || !this.isNavigating) return;

    const currentStep = this.currentRoute.steps[this.currentStepIndex];
    if (!currentStep || currentStep.isDestination) return;

    // Calculate distance to current step's node
    const dist = this.calculateDistance(pos.lat, pos.lng, currentStep.node.lat, currentStep.node.lng);

    // If within 10 meters, advance to next step
    if (dist < 10) {
      this.advanceStep();
    }

    // Check for floor change
    if (currentStep.isFloorChange && pos.floor !== currentStep.floor) {
      // User might have changed floors, update route visibility
      this.updateVisibleRoute(pos.floor);
    }
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  advanceStep() {
    this.currentStepIndex++;

    if (this.currentStepIndex >= this.currentRoute.steps.length) {
      this.arriveAtDestination();
      return;
    }

    this.updateNavigationUI();

    // Auto-switch floor if needed
    const step = this.currentRoute.steps[this.currentStepIndex];
    if (step && step.floor !== currentFloor + 1) {
      switchFloor(step.floor - 1);
    }
  }

  arriveAtDestination() {
    showToast(t('arrivedAtDestination'), 'success');
    this.endNavigation();
  }

  endNavigation() {
    this.isNavigating = false;
    this.currentRoute = null;
    this.currentStepIndex = 0;
    this.clearRoute();
    this.hideNavigationPanel();
  }

  // Update route visibility when floor changes
  onFloorChange(newFloor) {
    if (this.isNavigating) {
      this.updateVisibleRoute(newFloor + 1); // newFloor is 0-indexed
    }
    this.gpsTracker.setFloor(newFloor + 1);
  }
}

// Initialize Navigation Controller
let navigationController;

// Wait for map to be ready, then initialize
const initNavigation = () => {
  if (typeof map !== 'undefined' && map) {
    navigationController = new NavigationController(map);

    // Hook into floor switching to update route visibility
    const originalSwitchFloor = window.switchFloor;
    if (originalSwitchFloor) {
      window.switchFloor = function (floorIndex) {
        originalSwitchFloor(floorIndex);
        if (navigationController) {
          navigationController.onFloorChange(floorIndex);
        }
      };
    }

    console.log('🧭 Navigation system initialized!');
  } else {
    setTimeout(initNavigation, 100);
  }
};

// Start initialization
setTimeout(initNavigation, 500);

// Add navigation to search results
const originalDisplaySearchResults = window.displaySearchResults;
if (typeof displaySearchResults === 'function') {
  window.displaySearchResults = function (results) {
    if (originalDisplaySearchResults) {
      originalDisplaySearchResults(results);
    }

    // Add navigation buttons to search results
    setTimeout(() => {
      const resultItems = document.querySelectorAll('.search-result-item');
      resultItems.forEach((item, index) => {
        if (results[index] && !item.querySelector('.nav-to-btn')) {
          const navBtn = document.createElement('button');
          navBtn.className = 'nav-to-btn';
          navBtn.innerHTML = '🧭';
          navBtn.title = t('navigateTo');
          navBtn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:var(--accent);border:none;border-radius:50%;width:28px;height:28px;color:white;cursor:pointer;font-size:14px;';
          navBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (navigationController) {
              navigationController.navigateToLocation(results[index]);
            }
          });
          item.style.position = 'relative';
          item.appendChild(navBtn);
        }
      });
    }, 50);
  };
}

// =================== FLUENT EMOJI PARSER ===================
// Parse emojis to use Microsoft's Windows 11 Fluent Emojis across all platforms
console.log('App loaded!');
console.log('Sound effects:', soundEffectsEnabled ? 'enabled' : 'disabled');

