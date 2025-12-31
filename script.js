// =================== CONFIG ===================
const APP_VERSION = 'BETA dec1.2.0-h';
// version identifer [release] {month Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec}{howmanyversionnow}{is "H"alf a month}
const CENTER = [14.085933, 100.608844];
const FLOORS = [
  {
    id: 'floor1',
    name: 'Floor 1',
    img: 'images/floor_1.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
  },
  {
    id: 'floor2',
    name: 'Floor 2',
    img: 'images/floor_2.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
  },
  {
    id: 'floor3',
    name: 'Floor 3',
    img: 'images/floor_3.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
  },
  {
    id: 'floor4',
    name: 'Floor 4',
    img: 'images/floor_4.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
  },
  {
    id: 'floor5',
    name: 'Floor 5',
    img: 'images/floor_5.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
  },
  {
    id: 'floor6',
    name: 'Floor 6',
    img: 'images/floor_6.png',
    bounds: [[14.086142,100.606071],[14.083915,100.610199]]
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
    locationsFromFile = data.locations || [];
    console.log('✅ Loaded', locationsFromFile.length, 'locations from file');
  })
  .catch(err => console.warn('⚠️ locations.json not found, using pins only'));

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
  .catch(err => console.warn('⚠️ translations.json not found'));

function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

function applyTranslations() {
  // Update all translatable elements
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.placeholder = t('searchPlaceholder');
  
  // Update sidebar titles
  const mainSidebarTitle = document.querySelector('#mainSidebar .sidebar-title');
  if (mainSidebarTitle) mainSidebarTitle.textContent = t('menu').toUpperCase();
  
  const devSidebarTitle = document.querySelector('#devSidebar .sidebar-title');
  if (devSidebarTitle) devSidebarTitle.textContent = t('devTools');
  
  // Update close button titles
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.title = t('close');
  });
  
  // Update menu items
  document.querySelectorAll('.menu-item').forEach(item => {
    const modalId = item.getAttribute('data-modal');
    const action = item.getAttribute('data-action');
    
    if (modalId === 'about') item.textContent = t('about');
    if (modalId === 'howto') item.textContent = t('howto');
    if (modalId === 'settings') item.textContent = t('settings');
    if (modalId === 'donate') item.textContent = t('donate');
    if (action === 'feedback') item.textContent = t('feedback');
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
      btn.innerHTML = icon + ' ' + t(key);
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
  if (pinPlacingStatus && !placingPinMode) pinPlacingStatus.textContent = t('readyToPlace');
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

// =================== DEV MODE CONFIG ===================
let devMode = false;

fetch('config.json')
  .then(r => {
    if (!r.ok) throw new Error('config.json not found');
    return r.json();
  })
  .then(cfg => {
    devMode = !!cfg.devMode;
    const devBtn = document.getElementById('devModeBtn');
    console.log('✅ Config loaded! Dev mode:', devMode);
    
    if (devBtn) {
      if (devMode) {
        devBtn.style.display = 'block';
        devBtn.title = 'Dev Mode: ON';
        console.log('✅ Dev button is now visible');
      } else {
        devBtn.style.display = 'none';
      }
    }
  })
  .catch(err => {
    console.warn('⚠️ config.json not found - dev mode disabled');
    const devBtn = document.getElementById('devModeBtn');
    if (devBtn) devBtn.style.display = 'none';
  });

// =================== TOAST SYSTEM ===================
const toastContainer = document.getElementById('toastContainer');

function showToast(message, type='info', options={}) {
  const duration = options.duration ?? 3000;
  const t = document.createElement('div');
  t.className = `toast ${type}`;

  const msg = document.createElement('div');
  msg.className = 'message';
  msg.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.innerHTML = '×';
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
  setTimeout(() => { try { el.remove(); } catch(e){} }, 300);
}

// =================== MAP INIT ===================
console.log('Initializing map...');

// Set map boundaries (school area only)
const SCHOOL_BOUNDS = [[14.083915, 100.606071], [14.086142, 100.610199]]; //set bounds bruh

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  maxBounds: SCHOOL_BOUNDS, // Lock to school area
  maxBoundsViscosity: 1.0 // Completely prevent moving outside
}).setView(CENTER, 19);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & Carto',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

let currentFloor = 0;
const floorOverlay = L.imageOverlay(FLOORS[currentFloor].img, FLOORS[currentFloor].bounds).addTo(map);

setTimeout(() => {
  map.invalidateSize();
  console.log('Map initialized with boundary lock');
}, 200);

window.addEventListener('resize', () => {
  map.invalidateSize();
  if (displayMode === 'auto') applyDisplayMode('auto');
});

// =================== GLOBALS ===================
let allPins = [];
let markers = [];
let viewerInstance = null;
let drawingMode = false;
let currentPathCoords = [];
let currentPolyline = null;
let savedPaths = [];
let drawnPathLayers = [];

// =================== SIDEBAR LOGIC ===================
const menuToggle = document.getElementById('menuToggle');
const mainSidebar = document.getElementById('mainSidebar');
const devSidebar = document.getElementById('devSidebar');
const closeMainBtn = document.getElementById('closeSidebarBtn');
const closeDevBtn = document.getElementById('closeDevBtn');
const devBtn = document.getElementById('devModeBtn');

function closeAllSidebars() {
  if (mainSidebar) mainSidebar.classList.remove('open');
  if (devSidebar) devSidebar.classList.remove('open');
}

if (menuToggle) {
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mainSidebar.classList.contains('open');
    closeAllSidebars();
    if (!isOpen) mainSidebar.classList.add('open');
  });
}

if (closeMainBtn) {
  closeMainBtn.addEventListener('click', () => mainSidebar.classList.remove('open'));
}

if (closeDevBtn) {
  closeDevBtn.addEventListener('click', () => devSidebar.classList.remove('open'));
}

if (devBtn) {
  devBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!devMode) {
      showToast('Dev mode is disabled. Enable it in config.json', 'info', { duration: 3500 });
      return;
    }
    const isOpen = devSidebar.classList.contains('open');
    closeAllSidebars();
    if (!isOpen) devSidebar.classList.add('open');
  });
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
  const clickedInDev = devSidebar && devSidebar.contains(e.target);
  const clickedToggle = menuToggle && menuToggle.contains(e.target);
  const clickedDevBtn = devBtn && devBtn.contains(e.target);

  if (!clickedInMain && !clickedInDev && !clickedToggle && !clickedDevBtn) {
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
        <span class="settings-label">${t('language')}</span>
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
          <span class="theme-icon">🔊</span>
          ${t('traditionalThaiSounds')}
          <span class="info-tooltip" title="${t('soundsTooltip')}" style="margin-left:8px;cursor:help;color:var(--accent);">❓</span>
        </span>
        <div class="theme-toggle ${soundEffectsEnabled ? 'active' : ''}" id="soundEffectsToggle">
          <div class="theme-toggle-slider">
            ${soundEffectsEnabled ? '🔊' : '🔇'}
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Theme Setting -->
      <div class="theme-toggle-container">
        <span class="theme-toggle-label">
          <span class="theme-icon">${currentTheme === 'dark' ? '🌙' : '☀️'}</span>
          ${t('theme')}
        </span>
        <div class="theme-toggle ${currentTheme === 'dark' ? 'active' : ''}" id="themeToggle">
          <div class="theme-toggle-slider">
            ${currentTheme === 'dark' ? '🌙' : '☀️'}
          </div>
        </div>
      </div>

      <!-- Display Mode Setting -->
      <div class="settings-row">
        <span class="settings-label">${t('displayMode')}</span>
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
    get body() { return t('aboutContent'); }
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
            slider.textContent = newTheme === 'dark' ? '🌙' : '☀️';
            icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
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
            slider.textContent = soundEffectsEnabled ? '🔊' : '🔇';
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
  }
}

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const modalId = item.getAttribute('data-modal');
    const action = item.getAttribute('data-action');
    
    if (action === 'feedback') {
      // Open feedback form in new tab
      window.open('https://forms.gle/o3W4wVamF4PA1AFy9', '_blank');
    } else if (modalId) {
      openModal(modalId);
    }
  });
});

function closeModal() {
  if (modalOverlay) {
    modalOverlay.classList.add('closing');
    setTimeout(() => {
      // Force hide before removing classes to prevent flash
      modalOverlay.style.display = 'none';
      modalOverlay.style.opacity = '0';
      modalOverlay.classList.remove('active', 'closing');
      // Clear inline styles so CSS takes over again
      setTimeout(() => {
        modalOverlay.style.display = '';
        modalOverlay.style.opacity = '';
      }, 10);
    }, 250); // Match animation duration exactly
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

// =================== PATH DRAWING ===================
const startPathBtn = document.getElementById('startPathBtn');
const finishPathBtn = document.getElementById('finishPathBtn');
const undoPointBtn = document.getElementById('undoPointBtn');
const clearPathBtn = document.getElementById('clearPathBtn');
const savePathBtn = document.getElementById('savePathBtn');
const pathNameInput = document.getElementById('pathName');
const pathStatus = document.getElementById('pathStatus');
const pathsList = document.getElementById('pathsList');
const drawingTools = document.getElementById('drawingTools');
const routeCount = document.getElementById('routeCount');

function updatePathStatus(text, isActive = false) {
  if (pathStatus) {
    pathStatus.textContent = text;
    pathStatus.className = 'path-status' + (isActive ? ' active' : '');
  }
}

function updateRouteCount() {
  if (routeCount) routeCount.textContent = savedPaths.length;
}

if (startPathBtn) {
  startPathBtn.addEventListener('click', () => {
    if (drawingMode) {
      showToast('Already in drawing mode', 'info');
      return;
    }

    drawingMode = true;
    currentPathCoords = [];
    document.body.classList.add('drawing-path');

    if (drawingTools) drawingTools.style.display = 'grid';
    if (startPathBtn) startPathBtn.style.display = 'none';

    if (currentPolyline) map.removeLayer(currentPolyline);

    currentPolyline = L.polyline([], {
      color: '#667eea',
      weight: 5,
      opacity: 0.8,
      dashArray: '10, 10'
    }).addTo(map);

    updatePathStatus('🖱️ Click on map to add waypoints', true);
    showToast('Click on map to add waypoints', 'info', { duration: 2500 });
  });
}

if (finishPathBtn) finishPathBtn.addEventListener('click', finishPath);

function finishPath() {
  if (!drawingMode) {
    showToast('Not in drawing mode', 'info');
    return;
  }

  if (currentPathCoords.length < 2) {
    showToast('Need at least 2 waypoints', 'error');
    return;
  }

  drawingMode = false;
  document.body.classList.remove('drawing-path');

  if (drawingTools) drawingTools.style.display = 'none';
  if (startPathBtn) startPathBtn.style.display = 'flex';

  const pathName = pathNameInput.value.trim() || `Route ${savedPaths.length + 1}`;

  const pathObj = {
    id: 'path_' + Date.now(),
    name: pathName,
    coords: currentPathCoords.slice(),
    createdAt: new Date().toISOString()
  };

  if (currentPolyline) {
    map.removeLayer(currentPolyline);
    currentPolyline = null;
  }

  const poly = L.polyline(pathObj.coords, {
    color: '#0a84ff',
    weight: 5
  }).addTo(map);

  poly.on('click', () => {
    map.panTo(poly.getBounds().getCenter());
    showToast(`Route: ${pathObj.name}`, 'info');
  });

  pathObj.polyline = poly;
  drawnPathLayers.push(poly);
  savedPaths.push(pathObj);
  currentPathCoords = [];
  if (pathNameInput) pathNameInput.value = '';

  renderPathsList();
  updateRouteCount();
  updatePathStatus('✅ Route created! Click "Save Route"');
  showToast('Route created!', 'success');
}

if (undoPointBtn) {
  undoPointBtn.addEventListener('click', () => {
    if (!drawingMode || currentPathCoords.length === 0) {
      showToast('No waypoints to undo', 'info');
      return;
    }

    currentPathCoords.pop();
    if (currentPolyline) currentPolyline.setLatLngs(currentPathCoords);

    updatePathStatus(`🖱️ ${currentPathCoords.length} waypoints`, true);
    showToast('Waypoint removed', 'info');
  });
}

if (clearPathBtn) {
  clearPathBtn.addEventListener('click', () => {
    if (!drawingMode && currentPathCoords.length === 0) {
      showToast('Nothing to clear', 'info');
      return;
    }

    if (currentPolyline) {
      map.removeLayer(currentPolyline);
      currentPolyline = null;
    }

    currentPathCoords = [];
    drawingMode = false;
    document.body.classList.remove('drawing-path');

    if (drawingTools) drawingTools.style.display = 'none';
    if (startPathBtn) startPathBtn.style.display = 'flex';

    updatePathStatus('Ready to draw');
    showToast('Cleared', 'info');
  });
}

if (savePathBtn) {
  savePathBtn.addEventListener('click', () => {
    if (savedPaths.length === 0) {
      showToast('No routes to save', 'info');
      return;
    }

    const pathsToSave = savedPaths.map(p => ({
      id: p.id,
      name: p.name,
      coords: p.coords,
      createdAt: p.createdAt
    }));

    fetch('/save_path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: pathsToSave })
    })
    .then(r => r.json())
    .then(res => {
      if (res.status === 'success') {
        showToast('Routes saved ✓', 'success');
      } else throw new Error('Server error');
    })
    .catch(err => {
      try {
        localStorage.setItem('saved_paths', JSON.stringify(pathsToSave));
        showToast('Routes saved locally ✓', 'success');
      } catch (e) {
        showToast('Failed to save', 'error');
      }
    });
  });
}

function deletePath(pathId) {
  const idx = savedPaths.findIndex(p => p.id === pathId);
  if (idx === -1) return;

  const path = savedPaths[idx];
  if (path.polyline) map.removeLayer(path.polyline);

  savedPaths.splice(idx, 1);
  
  try {
    const ps = savedPaths.map(p => ({
      id: p.id, name: p.name, coords: p.coords, createdAt: p.createdAt
    }));
    localStorage.setItem('saved_paths', JSON.stringify(ps));
  } catch (e) {}

  renderPathsList();
  updateRouteCount();
  showToast('Route deleted', 'success');
}

map.on('click', (e) => {
  if (drawingMode) {
    currentPathCoords.push([e.latlng.lat, e.latlng.lng]);
    if (currentPolyline) currentPolyline.setLatLngs(currentPathCoords);
    updatePathStatus(`🖱️ ${currentPathCoords.length} waypoints`, true);
  }
});

map.on('dblclick', () => {
  if (drawingMode && currentPathCoords.length >= 2) finishPath();
});

function renderPathsList() {
  if (!pathsList) return;
  pathsList.innerHTML = '';
  if (savedPaths.length === 0) return;

  savedPaths.forEach(path => {
    const item = document.createElement('div');
    item.className = 'path-item';
    
    const content = document.createElement('div');
    content.className = 'path-item-content';
    content.innerHTML = `
      <div class="path-item-name">${path.name}</div>
      <div class="path-item-info">
        <span class="path-item-badge">${path.coords.length} pts</span>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'path-item-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-view';
    viewBtn.innerHTML = '👁️';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      map.setView([path.coords[0][0], path.coords[0][1]], 19, { animate: true });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${path.name}"?`)) deletePath(path.id);
    };

    actions.appendChild(viewBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(content);
    item.appendChild(actions);
    
    item.onclick = () => map.setView([path.coords[0][0], path.coords[0][1]], 19, { animate: true });
    pathsList.appendChild(item);
  });
}

renderPathsList();
updateRouteCount();

// =================== LOAD PINS ===================
let mainPathPolyline = null;

function loadPins() {
  fetch('data/pins.json')
    .then(r => r.json())
    .then(pins => {
      allPins = pins || [];
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      
      if (mainPathPolyline) {
        map.removeLayer(mainPathPolyline);
        mainPathPolyline = null;
      }

      allPins.forEach(pin => {
        const m = L.marker([pin.lat, pin.lng]).addTo(map);
        m.bindPopup(`
          <div style="text-align:center;">
            <strong>${pin.name}</strong><br>
            <button onclick='openViewer("${pin.name}")'
                    style="margin-top:10px;padding:8px 16px;background:#0a84ff;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Kanit,sans-serif;">
              ดูสตรีทวิว 360°
            </button>
          </div>
        `);
        markers.push(m);
        m.on('click', () => map.panTo([pin.lat, pin.lng]));
      });
    })
    .catch(err => {
      allPins = [];
    })
    .finally(() => {
      try {
        const local = JSON.parse(localStorage.getItem('saved_pins') || '[]');
        local.forEach(pin => {
          allPins.push(pin);
          const m = L.marker([pin.lat, pin.lng], {
            icon: L.divIcon({
              className: 'custom-pin-icon',
              html: '<div style="background:#ff6b6b;width:25px;height:25px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
              iconSize: [25, 25],
              iconAnchor: [12, 12]
            })
          }).addTo(map);
          
          m.bindPopup(`
            <div style="text-align:center;">
              <strong>${pin.name}</strong><br>
              <span style="font-size:12px;color:#ff6b6b;">📍 Local</span><br>
              <button onclick='openViewer("${pin.name}")'
                      style="margin-top:10px;padding:8px 16px;background:#0a84ff;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Kanit,sans-serif;">
                ดูสตรีทวิว 360°
              </button>
            </div>
          `);
          markers.push(m);
        });
      } catch (e) {}
      
      const all = allPins.map(p => [p.lat, p.lng]);
      if (all.length > 1) {
        mainPathPolyline = L.polyline(all, { color: '#0a84ff', weight: 6 }).addTo(map);
        mainPathPolyline.on('click', (ev) => {
          let nearest = null, minD = Infinity;
          allPins.forEach(p => {
            const d = ev.latlng.distanceTo(L.latLng(p.lat, p.lng));
            if (d < minD) { minD = d; nearest = p; }
          });
          if (nearest) openViewer(nearest.name);
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
          poly.on('click', () => {
            map.panTo(poly.getBounds().getCenter());
            showToast(`Path: ${p.name}`, 'info');
          });
          p.polyline = poly;
          drawnPathLayers.push(poly);
          savedPaths.push(p);
        });
        renderPathsList();
        updateRouteCount();
      }
    })
    .catch(() => {})
    .finally(() => {
      try {
        const local = JSON.parse(localStorage.getItem('saved_paths') || '[]');
        local.forEach(p => {
          const poly = L.polyline(p.coords, { color: '#ff6b6b', weight: 5, dashArray: '10, 5' }).addTo(map);
          poly.on('click', () => {
            map.panTo(poly.getBounds().getCenter());
            showToast(`Local: ${p.name}`, 'info');
          });
          p.polyline = poly;
          drawnPathLayers.push(poly);
          savedPaths.push(p);
        });
        renderPathsList();
        updateRouteCount();
      } catch (e) {}
    });
}

loadSavedPaths();

// =================== VIEWER ===================
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerClose = document.getElementById('viewerClose');

function openViewer(name) {
  const pin = allPins.find(p => p.name === name);
  if (!pin) {
    showToast('Pin not found', 'error');
    return;
  }

  viewerOverlay.style.display = 'flex';

  try {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch(e) {}
      viewerInstance = null;
    }

    document.getElementById('viewer').innerHTML = '';
    const src = pin.local ? pin.image : `images/streetview/${pin.image}`;

    viewerInstance = new PhotoSphereViewer.Viewer({
      container: document.getElementById('viewer'),
      panorama: src,
      caption: pin.name + (pin.local ? ' (Local)' : '')
    });
  } catch (err) {
    showToast('Cannot open 360°', 'error');
    viewerOverlay.style.display = 'none';
  }
}

if (viewerClose) {
  viewerClose.addEventListener('click', () => {
    if (viewerInstance) {
      try { viewerInstance.destroy(); } catch(e) {}
      viewerInstance = null;
    }
    viewerOverlay.style.display = 'none';
  });
}

window.openViewer = openViewer;

// =================== PIN SAVING ===================
const savePinBtn = document.getElementById('savePin');
const cancelPinBtn = document.getElementById('cancelPin');
const pinNameInput = document.getElementById('pinName');
const upload360Input = document.getElementById('upload360');
const startPlacingPinBtn = document.getElementById('startPlacingPin');
const confirmPinLocationBtn = document.getElementById('confirmPinLocation');
const pinPlacingTools = document.getElementById('pinPlacingTools');
const pinPlacingStatus = document.getElementById('pinPlacingStatus');
const pinDetailsStep = document.getElementById('pinDetailsStep');
const pinSaveStep = document.getElementById('pinSaveStep');
const savedPinsList = document.getElementById('savedPinsList');
const pinCountEl = document.getElementById('pinCount');

let placingPinMode = false;
let tempPinMarker = null;
let tempPinLocation = null;
let previewMarker = null;

function updatePinStatus(text, isActive = false) {
  if (pinPlacingStatus) {
    pinPlacingStatus.textContent = text;
    pinPlacingStatus.className = 'path-status' + (isActive ? ' active' : '');
  }
}

function updatePinCount() {
  if (pinCountEl) {
    pinCountEl.textContent = allPins.length;
  }
}

// Start placing pin mode
if (startPlacingPinBtn) {
  startPlacingPinBtn.addEventListener('click', () => {
    if (placingPinMode) {
      showToast('Already in pin placing mode', 'info');
      return;
    }

    placingPinMode = true;
    document.body.classList.add('placing-pin');

    if (pinPlacingTools) pinPlacingTools.style.display = 'none';
    if (startPlacingPinBtn) startPlacingPinBtn.style.display = 'none';
    if (pinDetailsStep) pinDetailsStep.style.display = 'none';
    if (pinSaveStep) pinSaveStep.style.display = 'none';

    // Create preview marker that follows mouse
    map.on('mousemove', onMouseMovePreview);

    updatePinStatus('🖱️ Click on map to place pin', true);
    showToast('Click on the map to place your pin', 'info', { duration: 2500 });
  });
}

// Mouse move preview
function onMouseMovePreview(e) {
  if (!placingPinMode || tempPinMarker) return;

  if (previewMarker) {
    previewMarker.setLatLng(e.latlng);
  } else {
    previewMarker = L.marker(e.latlng, {
      icon: L.divIcon({
        className: 'pin-preview-marker',
        html: '<div style="background:rgba(10,132,255,0.5);width:30px;height:30px;border-radius:50%;border:3px solid #0a84ff;box-shadow:0 4px 12px rgba(10,132,255,0.4);"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(map);
  }
}

// Map click for pin placement
const originalMapClick = map.on('click', (e) => {
  if (drawingMode) {
    currentPathCoords.push([e.latlng.lat, e.latlng.lng]);
    if (currentPolyline) currentPolyline.setLatLngs(currentPathCoords);
    updatePathStatus(`🖱️ ${currentPathCoords.length} waypoints`, true);
  } else if (placingPinMode && !tempPinMarker) {
    // Remove preview marker
    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }
    map.off('mousemove', onMouseMovePreview);

    // Place temporary draggable pin
    tempPinLocation = e.latlng;
    tempPinMarker = L.marker(e.latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'temp-pin-marker',
        html: '<div style="background:#0a84ff;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(10,132,255,0.6);"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(map);

    tempPinMarker.on('dragend', (ev) => {
      tempPinLocation = ev.target.getLatLng();
      updatePinStatus('📍 Pin moved! Click "Confirm Location" when ready', true);
    });

    if (pinPlacingTools) pinPlacingTools.style.display = 'grid';
    updatePinStatus('📍 Drag pin to adjust position, then confirm', true);
    showToast('Drag the pin to adjust position', 'info');
  }
});

// Confirm pin location
if (confirmPinLocationBtn) {
  confirmPinLocationBtn.addEventListener('click', () => {
    if (!tempPinMarker || !tempPinLocation) {
      showToast('No pin placed', 'info');
      return;
    }

    placingPinMode = false;
    document.body.classList.remove('placing-pin');

    if (pinPlacingTools) pinPlacingTools.style.display = 'none';
    if (startPlacingPinBtn) startPlacingPinBtn.style.display = 'flex';
    if (pinDetailsStep) pinDetailsStep.style.display = 'block';
    if (pinSaveStep) pinSaveStep.style.display = 'block';

    updatePinStatus('✅ Location confirmed! Add details below');
    showToast('Now add pin name and 360° image', 'success');
  });
}

// Save pin
if (savePinBtn) {
  savePinBtn.addEventListener('click', () => {
    const name = pinNameInput.value.trim();
    const file = upload360Input.files[0];

    if (!tempPinMarker || !tempPinLocation) {
      showToast('Place a pin first', 'error');
      return;
    }

    if (!name || !file) {
      showToast('Enter name and select image', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('lat', tempPinLocation.lat);
    fd.append('lng', tempPinLocation.lng);
    fd.append('image', file);

    fetch('/save_pin', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'success') {
          showToast('Pin saved to server!', 'success');
          resetPinPlacement();
          loadPins();
        } else throw new Error('Server error');
      })
      .catch(err => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const local = JSON.parse(localStorage.getItem('saved_pins') || '[]');
            const newPin = {
              id: 'pin_' + Date.now(),
              name: name,
              lat: tempPinLocation.lat,
              lng: tempPinLocation.lng,
              image: e.target.result,
              imageFileName: file.name,
              local: true
            };
            local.push(newPin);
            localStorage.setItem('saved_pins', JSON.stringify(local));
            showToast('Pin saved locally!', 'success');
            resetPinPlacement();
            loadPins();
          } catch (e) {
            showToast('Failed to save', 'error');
          }
        };
        reader.readAsDataURL(file);
      });
  });
}

// Cancel pin placement
if (cancelPinBtn) {
  cancelPinBtn.addEventListener('click', () => {
    resetPinPlacement();
    showToast('Cancelled', 'info');
  });
}

function resetPinPlacement() {
  placingPinMode = false;
  document.body.classList.remove('placing-pin');
  
  if (tempPinMarker) {
    map.removeLayer(tempPinMarker);
    tempPinMarker = null;
  }
  
  if (previewMarker) {
    map.removeLayer(previewMarker);
    previewMarker = null;
  }
  
  map.off('mousemove', onMouseMovePreview);
  
  tempPinLocation = null;
  
  if (pinNameInput) pinNameInput.value = '';
  if (upload360Input) upload360Input.value = '';
  
  if (pinPlacingTools) pinPlacingTools.style.display = 'none';
  if (startPlacingPinBtn) startPlacingPinBtn.style.display = 'flex';
  if (pinDetailsStep) pinDetailsStep.style.display = 'none';
  if (pinSaveStep) pinSaveStep.style.display = 'none';
  
  updatePinStatus('Ready to place pin');
}

// Delete pin function
function deletePin(pinId) {
  // Find in allPins
  const pinIndex = allPins.findIndex(p => p.id === pinId);
  if (pinIndex === -1) return;

  const pin = allPins[pinIndex];
  
  // Remove marker from map
  const markerIndex = markers.findIndex(m => {
    const ll = m.getLatLng();
    return Math.abs(ll.lat - pin.lat) < 0.00001 && Math.abs(ll.lng - pin.lng) < 0.00001;
  });
  
  if (markerIndex !== -1) {
    map.removeLayer(markers[markerIndex]);
    markers.splice(markerIndex, 1);
  }

  // Remove from allPins
  allPins.splice(pinIndex, 1);

  // Update localStorage
  if (pin.local) {
    try {
      const localPins = JSON.parse(localStorage.getItem('saved_pins') || '[]');
      const filtered = localPins.filter(p => p.id !== pinId);
      localStorage.setItem('saved_pins', JSON.stringify(filtered));
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
  }

  // Reconnect path between remaining pins
  if (mainPathPolyline) {
    map.removeLayer(mainPathPolyline);
    mainPathPolyline = null;
  }

  const allLatlngs = allPins.map(p => [p.lat, p.lng]);
  if (allLatlngs.length > 1) {
    mainPathPolyline = L.polyline(allLatlngs, {
      color: '#0a84ff',
      weight: 6
    }).addTo(map);

    mainPathPolyline.on('click', (ev) => {
      let nearest = null, minD = Infinity;
      allPins.forEach(p => {
        const d = ev.latlng.distanceTo(L.latLng(p.lat, p.lng));
        if (d < minD) { minD = d; nearest = p; }
      });
      if (nearest) openViewer(nearest.name);
    });
  }

  renderSavedPinsList();
  updatePinCount();
  showToast('Pin deleted', 'success');
}

// Render saved pins list
function renderSavedPinsList() {
  if (!savedPinsList) return;

  savedPinsList.innerHTML = '';

  if (allPins.length === 0) {
    return;
  }

  allPins.forEach(pin => {
    const item = document.createElement('div');
    item.className = 'path-item';
    
    const content = document.createElement('div');
    content.className = 'path-item-content';
    content.innerHTML = `
      <div class="path-item-name">${pin.name}</div>
      <div class="path-item-info">
        <span style="color:#999;font-size:11px;">📍 ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}</span>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'path-item-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-view';
    viewBtn.innerHTML = '👁️';
    viewBtn.title = 'View pin';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      map.setView([pin.lat, pin.lng], 19, { animate: true });
      
      // Open popup for this pin
      const marker = markers.find(m => {
        const ll = m.getLatLng();
        return Math.abs(ll.lat - pin.lat) < 0.00001 && Math.abs(ll.lng - pin.lng) < 0.00001;
      });
      if (marker) marker.openPopup();
      
      showToast(`Viewing: ${pin.name}`, 'info');
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete pin';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete pin "${pin.name}"?`)) {
        deletePin(pin.id);
      }
    };

    actions.appendChild(viewBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(content);
    item.appendChild(actions);
    
    item.onclick = () => {
      map.setView([pin.lat, pin.lng], 19, { animate: true });
    };

    savedPinsList.appendChild(item);
  });
}

console.log('✅ School Map Loaded');
console.log('Dev mode:', devMode);

// =================== SOUND EFFECTS MANAGEMENT ===================
const soundMuteBtn = document.getElementById('soundMuteBtn');

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

  // Update overlay
  floorOverlay.setUrl(FLOORS[floorIndex].img);
  floorOverlay.setBounds(FLOORS[floorIndex].bounds);

  // Update current floor display
  const currentFloorNumEl = document.getElementById('currentFloorNum');
  if (currentFloorNumEl) {
    currentFloorNumEl.textContent = floorIndex + 1;
  }

  // Don't auto-close - let user close by clicking outside
  showToast(`${t('floor')} ${floorIndex + 1}`, 'info');
}

// Floor pill click - toggle expand/collapse
if (floorPillCurrent) {
  floorPillCurrent.addEventListener('click', (e) => {
    e.stopPropagation();
    if (floorPill) {
      floorPill.classList.toggle('expanded');
      // Update indicator position when expanded (after animation starts)
      if (floorPill.classList.contains('expanded')) {
        setTimeout(() => {
          updateIndicatorPosition(currentFloor, false);
        }, 50);
      }
    }
  });
}

// Close pill when clicking outside
document.addEventListener('click', (e) => {
  if (floorPill) {
    const clickedInPill = floorPill.contains(e.target);
    if (!clickedInPill) {
      floorPill.classList.remove('expanded');
    }
  }
});

// Initialize floor pill
initFloorPill();

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
      resultDiv.innerHTML = `
        <strong>${result.name}</strong>
        <span style="color:var(--muted);font-size:12px;margin-left:8px;">${t('floor')} ${result.floor}</span>
      `;
      
      resultDiv.addEventListener('click', () => {
        playRandomSound(); // Play sound on click
        
        // Switch to the correct floor
        if (result.floor && result.floor - 1 !== currentFloor) {
          switchFloor(result.floor - 1);
        }
        
        // Zoom to location
        map.setView([result.lat, result.lng], 19, { animate: true });
        
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

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    updateClearButton();

    if (query.trim() === '') {
      searchRecommendations.classList.remove('active');
      return;
    }

    const results = searchLocations(query);
    displaySearchResults(results);
  });

  // Digital glitch particle effect
  const createSnapEffect = (text) => {
    const container = searchInput.parentElement;
    const inputStyle = getComputedStyle(searchInput);
    const paddingLeft = parseFloat(inputStyle.paddingLeft);
    const fontSize = parseFloat(inputStyle.fontSize);

    // Calculate approximate text width (chars * ~0.6 of font size for average char width)
    const avgCharWidth = fontSize * 0.55;
    const textWidth = Math.min(text.length * avgCharWidth, searchInput.offsetWidth - paddingLeft - 40);

    // Glitch colors array
    const glitchColors = ['#0dff39', '#fffa5e', '#d7ff5e', '#5ea4ff', '#1c7eff', '#000000ff', '#fb00ff', '#ff006f'];

    // Create particles based on text length (spawn where text is)
    const particleCount = Math.min(text.length * 3, 45);

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.className = 'search-particle';

      // Random square size (2-8px)
      const size = 2 + Math.random() * 6;
      particle.style.setProperty('--size', `${size}px`);

      // Random starting color (so not all green at once)
      const startColor = glitchColors[Math.floor(Math.random() * glitchColors.length)];
      particle.style.setProperty('--start-color', startColor);

      // Position only within text area
      const xPos = paddingLeft + Math.random() * textWidth;
      particle.style.left = `${xPos}px`;
      particle.style.top = `${10 + Math.random() * 20}px`; // Centered vertically

      // Random animation values - scatter outward
      const tx = (Math.random() - 0.5) * 100;
      const ty = (Math.random() - 0.5) * 80;
      const rot = Math.random() * 360;
      const delay = Math.random() * 0.2; // Staggered start

      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      particle.style.setProperty('--rot', `${rot}deg`);
      particle.style.animationDelay = `${delay}s`;

      container.appendChild(particle);

      // Remove particle after animation (match 1.4s animation + delay)
      setTimeout(() => particle.remove(), 1600);
    }
  };

  // Clear button click handler
  if (searchClear) {
    searchClear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Create snap effect before clearing
      if (searchInput.value.length > 0) {
        createSnapEffect(searchInput.value);
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
      showToast(t('gpsOutOfBounds'), 'error');
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
          <div class="user-marker-inner">
            <div class="user-marker-direction"></div>
          </div>
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
      this.map.setView([this.currentPosition.lat, this.currentPosition.lng], 20);
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
      return { text: this.formatInstruction('startAt', { name: currentNode.name || t('yourLocation') }), icon: '📍' };
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

      // Double-click to stop tracking
      gpsBtn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.stopGPSTracking();
      });

      // Right-click/long-press: manual mode if not tracking, stop if tracking
      gpsBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.gpsTracker.isTracking || this.gpsTracker.manualMode) {
          this.stopGPSTracking();
        } else {
          this.enterManualLocationMode();
        }
      });
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
      // Already tracking - pan to current position and request fresh update
      if (this.gpsTracker.currentPosition) {
        const pos = this.gpsTracker.currentPosition;
        this.map.setView([pos.lat, pos.lng], 19);
      }
      // Request a fresh position update (with maximumAge: 0 to force new position)
      if (navigator.geolocation && this.gpsTracker.isTracking) {
        navigator.geolocation.getCurrentPosition(
          (p) => this.gpsTracker.handlePosition(p),
          () => {},
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
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
      window.switchFloor = function(floorIndex) {
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
  window.displaySearchResults = function(results) {
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

console.log('✅ All features loaded!');
console.log('🔊 Sound effects:', soundEffectsEnabled ? 'enabled' : 'disabled');