// =================== CONFIG ===================
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
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  
  // Update menu items
  document.querySelectorAll('.menu-item').forEach(item => {
    const modalId = item.getAttribute('data-modal');
    if (modalId === 'about') item.textContent = t('about');
    if (modalId === 'howto') item.textContent = t('howto');
    if (modalId === 'settings') item.textContent = t('settings');
  });
  
  // Update dev sidebar
  const devTitle = document.querySelector('#devSidebar .sidebar-title');
  if (devTitle) devTitle.textContent = t('devTools');
  
  // Update route creator
  const routeHeaders = [
    { selector: '.path-section h4', keys: ['routeCreator', 'add360Pin'] },
  ];
  
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
  
  // Update floor dropdown
  const floorTitle = document.querySelector('.floor-dropdown-title');
  if (floorTitle) floorTitle.textContent = t('floor');
  
  // Update placeholders
  const pathName = document.getElementById('pathName');
  if (pathName) pathName.placeholder = t('routeNamePlaceholder');
  
  const pinName = document.getElementById('pinName');
  if (pinName) pinName.placeholder = t('locationNamePlaceholder');
}

function changeLanguage(lang) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('languageLoadingOverlay');
    const loadingText = document.getElementById('languageLoadingText');
    
    if (loadingText) loadingText.textContent = t('changingLanguage');
    if (overlay) overlay.classList.add('active');
    
    setTimeout(() => {
      currentLanguage = lang;
      localStorage.setItem('language', lang);
      applyTranslations();
      
      setTimeout(() => {
        if (overlay) overlay.classList.remove('active');
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

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true
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
  console.log('Map initialized');
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
  if (e.key === 'Escape') closeAllSidebars();
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
    title: '📘 About / Credits',
    body: `
      <h3>Project Absolute TK Map</h3>
      <p>An interactive school map with 360° street view functionality.</p>
      <h4>Credits:</h4>
      <ul>
        <li>Map powered by Leaflet & OpenStreetMap</li>
        <li>360° viewer by Photo Sphere Viewer</li>
        <li>Created for school final project</li>
        <li>You! Thank you for using this website!</li>
      </ul>
      <p style="margin-top:20px;color:#666;font-size:14px;">
        Made with ❤️ by 5/16 ;) + Claude AI
      </p>
    `
  },
  howto: {
    title: '❔ How to Use',
    body: `
      <h3>Navigation:</h3>
      <ul>
        <li><strong>Search:</strong> Type room name or number in the search box</li>
        <li><strong>Zoom:</strong> Use mouse wheel or +/- buttons</li>
        <li><strong>Pan:</strong> Click and drag the map</li>
        <li><strong>Floor:</strong> Use the floor selector button to switch between floors</li>
      </ul>
      <h3>360° Views:</h3>
      <ul>
        <li>Click on any pin marker to view location</li>
        <li>Click the blue path to view nearest 360° location</li>
        <li>Drag inside the 360° viewer to look around</li>
      </ul>
      <h3>Tips:</h3>
      <ul>
        <li>Press ESC to close any open panel</li>
        <li>Use the search bar for quick navigation</li>
        <li>Change theme in settings for comfortable viewing</li>
      </ul>
    `
  },
  settings: {
    title: '⚙️ Settings',
    body: generateSettingsHTML()
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
    openModal(modalId);
  });
});

if (modalClose) {
  modalClose.addEventListener('click', (e) => {
    e.stopPropagation();
    modalOverlay.classList.remove('active');
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      e.stopPropagation();
      modalOverlay.classList.remove('active');
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

// =================== SEARCH ===================
const searchInput = document.getElementById('searchInput');

if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return;

    const found = allPins.find(p => p.name.toLowerCase().includes(q));
    if (found) {
      map.setView([found.lat, found.lng], 19, { animate: true });
      const m = markers.find(mk => {
        const ll = mk.getLatLng();
        return Math.abs(ll.lat - found.lat) < 0.00001 && Math.abs(ll.lng - found.lng) < 0.00001;
      });
      if (m) m.openPopup();
      showToast(`Found: ${found.name}`, 'success');
    } else {
      showToast('Not found', 'error');
    }
  });
}

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

// =================== FLOOR SELECTOR ===================
const floorSelectorBtn = document.getElementById('floorSelector');
const floorDropdown = document.getElementById('floorDropdown');
const floorList = document.getElementById('floorList');
const currentFloorText = document.getElementById('currentFloorText');

// Initialize floor list
function initFloorSelector() {
  if (!floorList) return;
  
  floorList.innerHTML = '';
  FLOORS.forEach((floor, index) => {
    const item = document.createElement('div');
    item.className = 'floor-item' + (index === currentFloor ? ' active' : '');
    item.textContent = `${t('floor')} ${index + 1}`;
    item.onclick = () => switchFloor(index);
    floorList.appendChild(item);
  });
}

// Switch floor
function switchFloor(floorIndex) {
  if (floorIndex === currentFloor) {
    floorDropdown.classList.remove('active');
    floorSelectorBtn.classList.remove('active');
    return;
  }
  
  currentFloor = floorIndex;
  
  // Update overlay
  floorOverlay.setUrl(FLOORS[floorIndex].img);
  floorOverlay.setBounds(FLOORS[floorIndex].bounds);
  
  // Update UI
  if (currentFloorText) {
    currentFloorText.textContent = `${t('floor')} ${floorIndex + 1}`;
  }
  
  // Update active state in dropdown
  document.querySelectorAll('.floor-item').forEach((item, i) => {
    item.classList.toggle('active', i === floorIndex);
  });
  
  // Close dropdown
  floorDropdown.classList.remove('active');
  floorSelectorBtn.classList.remove('active');
  
  showToast(`${t('floor')} ${floorIndex + 1}`, 'info');
  
  // TODO: Load floor-specific pins and paths here
  // This is where you'd filter and show only pins/paths for this floor
}

// Floor selector button click
if (floorSelectorBtn) {
  floorSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = floorDropdown.classList.contains('active');
    floorDropdown.classList.toggle('active', !isActive);
    floorSelectorBtn.classList.toggle('active', !isActive);
  });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (floorDropdown && floorSelectorBtn) {
    const clickedInDropdown = floorDropdown.contains(e.target);
    const clickedButton = floorSelectorBtn.contains(e.target);
    
    if (!clickedInDropdown && !clickedButton) {
      floorDropdown.classList.remove('active');
      floorSelectorBtn.classList.remove('active');
    }
  }
});

// Initialize floor selector
initFloorSelector();

// Update floor selector when language changes
window.addEventListener('languagechange', () => {
  initFloorSelector();
  if (currentFloorText) {
    currentFloorText.textContent = `${t('floor')} ${currentFloor + 1}`;
  }
});