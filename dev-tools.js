console.log("DevTools script has successfully been loaded by the browser!");
// =================== DEV TOOLS (V4 — 2D Flat + UX Overhaul) ===================
// Clean, modular dev tool for Buildings, 360 Pins, and Nav Pathways
// Fixed: stale-index bugs, memory leaks, bulk upload optimization

class DevTools {
  constructor(mapEngine) {
    this.mapEngine = mapEngine;
    this.map = mapEngine.map;
    
    let container = document.getElementById('newDevToolsContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'newDevToolsContainer';
      document.body.appendChild(container);
    }
    this.container = container;
    
    this.isVisible = false;
    this.activeTab = 'buildings';
    
    const safeParse = (key) => {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : [];
      } catch (e) {
        console.warn(`DevTools: cleared corrupted localStorage key: ${key}`);
        localStorage.removeItem(key);
        return [];
      }
    };
    
    // Tools State
    this.state = {
      // Common
      drawingMode: false,
      
      // Buildings
      buildingPoints: [],
      buildingMarkers: [],
      buildingPolylineId: null,
      buildingPreviewId: null,
      savedBuildings: safeParse('dev_buildings'),
      
      // Bulk Pins
      pinQueue: [],
      currentPinIndex: -1,
      placingPinMode: false,
      savedPins: [], // Loaded from server (data/pins.json)
      
      // Pathways
      pathPoints: [],
      pathMarkers: [],
      pathPolylineId: null,
      savedPaths: safeParse('dev_paths'),
      
      // Places
      placePoints: [],
      placeMarkers: [],
      placePolylineId: null,
      placePreviewId: null
    };

    this.initUI();
    this.bindEvents();
    
    // Render initial saved data
    this.renderSavedBuildings();
    this.loadPinsFromServer(); // Load pins from server instead of localStorage
    this.renderSavedPaths();
    this.renderSavedPlaces();
    this.updateTabBadges();
  }

  // =================== TOAST (replaces alert()) ===================
  _toast(message, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(message, type, { duration: 2500 });
    } else {
      console.log(`[DevTools ${type}] ${message}`);
    }
  }

  // =================== UI INIT ===================
  initUI() {
    this.container.innerHTML = `
      <div class="dev-panel hidden" id="devPanel">
        <!-- Sidebar Icon Rail (like LETS TRIP collapsed sidebar) -->
        <div class="dev-rail" id="devRail">
          <div class="dev-rail-logo" title="Dev Tools">
            <i class="fa-solid fa-wrench"></i>
          </div>
          
          <div class="dev-rail-nav">
            <button class="dev-rail-btn active" data-tab="buildings" title="Buildings">
              <i class="fa-solid fa-building"></i>
              <span class="dev-rail-badge" id="railBadgeBuildings"></span>
            </button>
            <button class="dev-rail-btn" data-tab="pins" title="360° Pins">
              <i class="fa-solid fa-map-pin"></i>
              <span class="dev-rail-badge" id="railBadgePins"></span>
            </button>
            <button class="dev-rail-btn" data-tab="paths" title="Pathways">
              <i class="fa-solid fa-route"></i>
              <span class="dev-rail-badge" id="railBadgePaths"></span>
            </button>
            <button class="dev-rail-btn" data-tab="places" title="Places">
              <i class="fa-solid fa-map-location-dot"></i>
              <span class="dev-rail-badge" id="railBadgePlaces"></span>
            </button>
          </div>

          <div class="dev-rail-bottom">
            <button class="dev-rail-btn" id="btnRailImport" title="Import JSON">
              <i class="fa-solid fa-file-import"></i>
            </button>
            <button class="dev-rail-btn" id="btnRailExport" title="Export JSON">
              <i class="fa-solid fa-download"></i>
            </button>
            <button class="dev-rail-btn danger" id="btnRailClear" title="Clear All">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <!-- Main Content Panel -->
        <div class="dev-main">
          <!-- Header -->
          <div class="dev-header" id="devPanelHeader">
            <div class="dev-header-title">
              <span class="dev-header-label" id="devHeaderLabel">BUILDINGS</span>
              <span class="dev-shortcut-hint">Ctrl+Shift+X</span>
            </div>
            <div class="dev-header-actions">
              <div class="dev-3d-toggle" id="dev3dToggle" title="Toggle 2D/3D mode">
                <span class="dev-3d-label" id="dev3dLabel">3D</span>
                <div class="dev-3d-switch active" id="dev3dSwitch">
                  <div class="dev-3d-switch-thumb"></div>
                </div>
              </div>
              <button class="dev-close-btn" id="closeDevPanelBtn">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          
          <!-- Content Area -->
          <div class="dev-content" id="devBody">
            <!-- Buildings Tab -->
            <div class="dev-section" id="tab-buildings">
              <!-- Step Guide Card -->
              <div class="dev-card dev-step-guide">
                <div class="step-indicator">
                  <div class="step-dot active" data-step="1">1</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="2">2</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="3">3</div>
                </div>
                <p class="step-text" id="bldgStepText">Name your building, then click <b>Draw</b></p>
              </div>

              <!-- Form Card -->
              <div class="dev-card">
                <div class="dev-card-row">
                  <label>Building Name</label>
                  <input type="text" id="bldgName" class="dev-input" placeholder="e.g. Science Building">
                </div>
                <div class="dev-card-row">
                  <label>Fill Color</label>
                  <div class="dev-color-picker">
                    <input type="color" id="bldgColor" value="#4A90E2">
                    <span class="dev-color-swatch" id="bldgColorPreview" style="background:#4A90E2"></span>
                    <span class="dev-color-hex" id="bldgColorHex">#4A90E2</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="dev-action-bar">
                <button class="dev-btn primary" id="btnDrawBldg">
                  <i class="fa-solid fa-draw-polygon"></i> Draw Footprint
                </button>
                <button class="dev-btn ghost" id="btnUndoBldg" disabled>
                  <i class="fa-solid fa-rotate-left"></i> Undo
                </button>
              </div>

              <!-- Status -->
              <div class="dev-status" id="statusBldg">
                <i class="fa-solid fa-circle-info"></i>
                <span>Ready — draw at least 3 points</span>
              </div>

              <!-- Saved Section -->
              <div class="dev-section-label">
                <span>SAVED</span>
                <span class="dev-count-badge" id="countBldg">0</span>
              </div>
              <div class="dev-saved-list" id="listBldg"></div>
            </div>
            
            <!-- Pins Tab -->
            <div class="dev-section" id="tab-pins" style="display:none;">
              <div class="dev-card dev-step-guide">
                <div class="step-indicator">
                  <div class="step-dot active" data-step="1">1</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="2">2</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="3">3</div>
                </div>
                <p class="step-text" id="pinStepText">Drop or browse 360° images to begin</p>
              </div>

              <div class="dev-card dev-dropzone" id="pinDropZone">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>Drop 360° Images Here</p>
                <span>or click to browse</span>
                <input type="file" id="pinFileInput" multiple accept="image/*" style="display:none;">
              </div>
              
              <!-- Queue Progress -->
              <div class="dev-queue-header" id="queueHeaderArea" style="display:none;">
                <div class="dev-queue-progress-info">
                  <span id="queueProgressText">0 / 0 placed</span>
                  <button class="dev-btn-mini danger" id="btnClearQueue" title="Clear Queue">
                    <i class="fa-solid fa-xmark"></i> Clear
                  </button>
                </div>
                <div class="dev-progress-bar">
                  <div class="dev-progress-fill" id="queueProgressBar" style="width:0%"></div>
                </div>
              </div>

              <div class="bulk-queue" id="pinQueueList"></div>
              
              <div class="dev-status" id="statusPins">
                <i class="fa-solid fa-circle-info"></i>
                <span>Drop images to start</span>
              </div>

              <div class="dev-section-label">
                <span>SAVED</span>
                <span class="dev-count-badge" id="countPins">0</span>
              </div>
              <div class="dev-saved-list" id="listPins"></div>
            </div>
            
            <!-- Pathways Tab -->
            <div class="dev-section" id="tab-paths" style="display:none;">
              <div class="dev-card dev-step-guide">
                <div class="step-indicator">
                  <div class="step-dot active" data-step="1">1</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="2">2</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="3">3</div>
                </div>
                <p class="step-text" id="pathStepText">Name your route, then click <b>Start Drawing</b></p>
              </div>

              <div class="dev-card">
                <div class="dev-card-row">
                  <label>Route Name</label>
                  <input type="text" id="pathName" class="dev-input" placeholder="e.g. Main Entrance to Library">
                </div>
              </div>

              <div class="dev-action-bar">
                <button class="dev-btn primary" id="btnDrawPath">
                  <i class="fa-solid fa-pen"></i> Start Drawing
                </button>
                <button class="dev-btn ghost" id="btnUndoPath" disabled>
                  <i class="fa-solid fa-rotate-left"></i> Undo
                </button>
              </div>

              <div class="dev-status" id="statusPath">
                <i class="fa-solid fa-circle-info"></i>
                <span>Ready — draw at least 2 waypoints</span>
              </div>

              <div class="dev-section-label">
                <span>SAVED</span>
                <span class="dev-count-badge" id="countPath">0</span>
              </div>
              <div class="dev-saved-list" id="listPath"></div>
            </div>
            
            <!-- Places Tab -->
            <div class="dev-section" id="tab-places" style="display:none;">
              <div class="dev-card dev-step-guide">
                <div class="step-indicator">
                  <div class="step-dot active" data-step="1">1</div>
                  <div class="step-line"></div>
                  <div class="step-dot" data-step="2">2</div>
                </div>
                <p class="step-text" id="placeStepText">Fill details and draw area</p>
              </div>

              <div class="dev-card">
                <div class="dev-card-row">
                  <label>Place Name</label>
                  <input type="text" id="placeName" class="dev-input" placeholder="e.g. Main Library">
                </div>
                <div class="dev-card-row">
                  <label>Category</label>
                  <select id="placeCategory" class="dev-input" style="background:#2d2d2d;border:none;padding:8px;border-radius:4px;color:white;width:100%;font-size:13px;margin-bottom:8px;">
                    <option value="library">Library (ห้องสมุด)</option>
                    <option value="cafeteria">Cafeteria (โรงอาหาร)</option>
                    <option value="restroom">Restroom (ห้องน้ำ)</option>
                    <option value="lab">Laboratory (ห้องปฏิบัติการ)</option>
                    <option value="academic">Academic (อาคารเรียน)</option>
                    <option value="other">Other / Custom</option>
                  </select>
                  <input type="text" id="placeCustomCategory" class="dev-input" placeholder="Custom category..." style="display:none;">
                </div>
                <div class="dev-card-row">
                  <label>Floor</label>
                  <input type="number" id="placeFloor" class="dev-input" value="1">
                </div>
                <div class="dev-card-row">
                  <label>Image Upload</label>
                  <input type="file" id="placeImage" accept="image/*" class="dev-input" style="font-size:11px;background:#2d2d2d;color:white;padding:5px;">
                </div>
                <div class="dev-card-row">
                  <label>Linked 360° (Optional)</label>
                  <select id="placePanoramaId" class="dev-input" style="background:#2d2d2d;border:none;padding:8px;border-radius:4px;color:white;width:100%;font-size:13px;">
                    <option value="">-- None --</option>
                  </select>
                </div>
              </div>

              <div class="dev-action-bar">
                <button class="dev-btn primary" id="btnDrawPlace">
                  <i class="fa-solid fa-draw-polygon"></i> Draw Box
                </button>
                <button class="dev-btn ghost" id="btnUndoPlace" disabled>
                  <i class="fa-solid fa-rotate-left"></i> Undo
                </button>
              </div>

              <div class="dev-status" id="statusPlace">
                <i class="fa-solid fa-circle-info"></i>
                <span>Ready</span>
              </div>

              <div class="dev-section-label">
                <span>SAVED PLACES</span>
                <span class="dev-count-badge" id="countPlaces">0</span>
              </div>
              <div class="dev-saved-list" id="listPlaces"></div>
            </div>

          </div>
          
          <!-- Footer (modal-style action tray) -->
          <div class="dev-footer">
            <button class="dev-btn ghost" id="btnCancelAction">Cancel</button>
            <button class="dev-btn primary" id="btnSaveAction" disabled>
              <i class="fa-solid fa-check"></i> Save
            </button>
          </div>
        </div>

        <input type="file" id="importJSONInput" accept=".json" style="display:none;">
      </div>
    `;

    // Make panel draggable
    this.makeDraggable(document.getElementById('devPanel'), document.getElementById('devPanelHeader'));
  }

  // =================== EVENT BINDING ===================
  bindEvents() {
    // Show/Hide Toggle
    const devBtn = document.getElementById('devModeBtn');
    if (devBtn) {
      devBtn.addEventListener('click', () => {
        this.togglePanel();
        const sidebar = document.getElementById('mainSidebar');
        if (sidebar) sidebar.classList.remove('open');
      });
    }
    
    document.getElementById('closeDevPanelBtn').addEventListener('click', () => this.togglePanel(false));
    
    // Hook into floor changes to filter pins
    const originalSwitchFloor = window.switchFloor;
    if (originalSwitchFloor && !window._devFloorHooked) {
      window._devFloorHooked = true;
      window.switchFloor = (floorIndex) => {
        originalSwitchFloor(floorIndex);
        if (this.activeTab === 'pins') this.renderSavedPins();
      };
    }
    
    // Rail Navigation (sidebar icon tabs)
    const railBtns = document.querySelectorAll('.dev-rail-btn[data-tab]');
    railBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        railBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const target = e.currentTarget.getAttribute('data-tab');
        this.switchTab(target);
      });
    });

    // --- Buildings ---
    const colorInput = document.getElementById('bldgColor');
    colorInput.addEventListener('input', (e) => {
      document.getElementById('bldgColorPreview').style.background = e.target.value;
      const hexEl = document.getElementById('bldgColorHex');
      if (hexEl) hexEl.textContent = e.target.value.toUpperCase();
    });
    
    document.getElementById('btnDrawBldg').addEventListener('click', () => this.startDrawingBuilding());
    document.getElementById('btnUndoBldg').addEventListener('click', () => this.undoBuildingPoint());

    // --- Pins ---
    const dropZone = document.getElementById('pinDropZone');
    const fileInput = document.getElementById('pinFileInput');
    
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) this.handlePinFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.handlePinFiles(e.target.files);
      e.target.value = '';
    });

    // Clear queue
    document.getElementById('btnClearQueue').addEventListener('click', () => this.clearPinQueue());

    // --- Paths ---
    document.getElementById('btnDrawPath').addEventListener('click', () => this.startDrawingPath());
    document.getElementById('btnUndoPath').addEventListener('click', () => this.undoPathPoint());

    // --- Places ---
    document.getElementById('btnDrawPlace').addEventListener('click', () => this.startDrawingPlace());

    // --- 2D/3D Toggle ---
    const dev3dSwitch = document.getElementById('dev3dSwitch');
    if (dev3dSwitch) {
      dev3dSwitch.addEventListener('click', () => {
        const is3D = this.mapEngine.is3DMode();
        this.mapEngine.set3DMode(!is3D);
        this._update3DToggleUI(!is3D);
      });
    }
    document.getElementById('btnUndoPlace').addEventListener('click', () => this.undoPlacePoint());
    
    // Map Click Intercept
    this.map.on('click', (e) => this.handleMapClick(e));
    
    // Map Right-Click (Context Menu) for undoing points
    this.map.on('contextmenu', (e) => {
      if (!this.isVisible || !this.state.drawingMode) return;
      e.originalEvent.preventDefault();
      if (this.activeTab === 'buildings') this.undoBuildingPoint();
      else if (this.activeTab === 'paths') this.undoPathPoint();
      else if (this.activeTab === 'places') this.undoPlacePoint();
    });

    // Keyboard Shortcuts for drawing
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible || !this.state.drawingMode) return;
      if (e.key === 'Escape') {
        this.cancelAllActions();
      } else if (e.key === 'Enter') {
        const saveBtn = document.getElementById('btnSaveAction');
        if (saveBtn && !saveBtn.disabled) {
          this._handleSave();
        }
      } else if (e.key === 'z' && e.ctrlKey) {
        if (this.activeTab === 'buildings') this.undoBuildingPoint();
        else if (this.activeTab === 'paths') this.undoPathPoint();
        else if (this.activeTab === 'places') this.undoPlacePoint();
      }
    });

    // --- Footer Save/Cancel (modal-style) ---
    document.getElementById('btnSaveAction').addEventListener('click', () => this._handleSave());
    document.getElementById('btnCancelAction').addEventListener('click', () => this.cancelAllActions());

    // --- Rail bottom actions ---
    document.getElementById('btnRailExport').addEventListener('click', () => this.downloadAllJSON());
    document.getElementById('btnRailImport').addEventListener('click', () => document.getElementById('importJSONInput').click());
    document.getElementById('importJSONInput').addEventListener('change', (e) => this.importJSON(e));
    document.getElementById('btnRailClear').addEventListener('click', () => {
      if (confirm('Clear ALL locally saved Dev Tools data? This cannot be undone.')) {
        localStorage.removeItem('dev_buildings');
        localStorage.removeItem('dev_paths');
        location.reload();
      }
    });
  }

  // Unified save handler — routes to correct save based on active tab
  _handleSave() {
    if (this.activeTab === 'buildings') this.saveBuilding();
    else if (this.activeTab === 'paths') this.savePath();
    else if (this.activeTab === 'places') this.savePlace();
  }

  // =================== PANEL & TABS ===================
  togglePanel(force) {
    this.isVisible = force !== undefined ? force : !this.isVisible;
    const panel = document.getElementById('devPanel');
    if (this.isVisible) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
      this.cancelAllActions();
    }
  }

  switchTab(tabId) {
    this.cancelAllActions();
    this.activeTab = tabId;
    document.getElementById('tab-buildings').style.display = tabId === 'buildings' ? 'block' : 'none';
    document.getElementById('tab-pins').style.display = tabId === 'pins' ? 'block' : 'none';
    document.getElementById('tab-paths').style.display = tabId === 'paths' ? 'block' : 'none';
    document.getElementById('tab-places').style.display = tabId === 'places' ? 'block' : 'none';
    
    // Update header label
    const label = document.getElementById('devHeaderLabel');
    if (label) {
      const labels = { buildings: 'BUILDINGS', pins: '360° PINS', paths: 'PATHWAYS', places: 'PLACES / POIS' };
      label.textContent = labels[tabId] || tabId.toUpperCase();
    }
    
    // Update footer save button text
    const saveBtn = document.getElementById('btnSaveAction');
    if (saveBtn) {
      if (tabId === 'pins') {
        saveBtn.style.display = 'none'; // Pins auto-save on click
      } else {
        saveBtn.style.display = '';
        saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save ${tabId === 'buildings' ? 'Building' : tabId === 'places' ? 'Place' : 'Route'}`;
      }
    }
  }

  updateTabBadges() {
    // Rail badges
    const bBadge = document.getElementById('railBadgeBuildings');
    const pBadge = document.getElementById('railBadgePins');
    const rBadge = document.getElementById('railBadgePaths');
    
    const bCount = this.state.savedBuildings.length;
    const pCount = this.state.savedPins.length;
    const rCount = this.state.savedPaths.length;
    
    if (bBadge) { bBadge.textContent = bCount; bBadge.style.display = bCount ? 'flex' : 'none'; }
    if (pBadge) { pBadge.textContent = pCount; pBadge.style.display = pCount ? 'flex' : 'none'; }
    if (rBadge) { rBadge.textContent = rCount; rBadge.style.display = rCount ? 'flex' : 'none'; }
  }

  _updateStepGuide(tabPrefix, step, text) {
    const dots = document.querySelectorAll(`#tab-${tabPrefix} .step-dot`);
    dots.forEach(d => {
      const s = parseInt(d.dataset.step);
      d.classList.toggle('active', s <= step);
      d.classList.toggle('completed', s < step);
    });
    const textEl = document.getElementById(`${tabPrefix === 'buildings' ? 'bldg' : tabPrefix === 'pins' ? 'pin' : 'path'}StepText`);
    if (textEl) textEl.innerHTML = text;
  }

  cancelAllActions() {
    this.state.drawingMode = false;
    this.state.placingPinMode = false;
    
    // Reset Building
    this.state.buildingPoints = [];
    if (this.state.buildingPolylineId) this.mapEngine.removeLine(this.state.buildingPolylineId);
    if (this.state.buildingPreviewId) this.mapEngine.removeBuildingById(this.state.buildingPreviewId);
    this.state.buildingPolylineId = null;
    this.state.buildingPreviewId = null;
    this._clearDrawingMarkers('building');
    const btnDraw = document.getElementById('btnDrawBldg');
    if (btnDraw) {
      btnDraw.classList.remove('active-tool');
      btnDraw.innerHTML = '<i class="fa-solid fa-draw-polygon"></i> Draw Footprint';
    }
    const btnUndo = document.getElementById('btnUndoBldg');
    if (btnUndo) btnUndo.disabled = true;
    const statusBldg = document.getElementById('statusBldg');
    if (statusBldg) statusBldg.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>Ready — draw at least 3 points</span>';
    this._updateStepGuide('buildings', 1, 'Name your building, then click <b>Draw</b>');

    // Reset Path
    this.state.pathPoints = [];
    if (this.state.pathPolylineId) this.mapEngine.removeLine(this.state.pathPolylineId);
    this.state.pathPolylineId = null;
    this._clearDrawingMarkers('path');
    const btnDrawPath = document.getElementById('btnDrawPath');
    if (btnDrawPath) {
      btnDrawPath.classList.remove('active-tool');
      btnDrawPath.innerHTML = '<i class="fa-solid fa-pen"></i> Start Drawing';
    }
    const btnUndoPath = document.getElementById('btnUndoPath');
    if (btnUndoPath) btnUndoPath.disabled = true;
    const statusPath = document.getElementById('statusPath');
    if (statusPath) statusPath.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>Ready — draw at least 2 waypoints</span>';
    this._updateStepGuide('paths', 1, 'Name your route, then click <b>Start Drawing</b>');
    
    // Reset footer save button
    const saveBtn = document.getElementById('btnSaveAction');
    if (saveBtn) saveBtn.disabled = true;
    
    // Reset Places
    this.state.placePoints = [];
    if (this.state.placePolylineId) this.mapEngine.removeLine(this.state.placePolylineId);
    if (this.state.placePreviewId) {
      if (this.mapEngine.removePolygon) this.mapEngine.removePolygon(this.state.placePreviewId);
    }
    this.state.placePolylineId = null;
    this.state.placePreviewId = null;
    this._clearDrawingMarkers('place');
    const btnDrawPlace = document.getElementById('btnDrawPlace');
    if (btnDrawPlace) {
      btnDrawPlace.classList.remove('active-tool');
      btnDrawPlace.innerHTML = '<i class="fa-solid fa-draw-polygon"></i> Draw Box';
    }
    const btnUndoPlace = document.getElementById('btnUndoPlace');
    if (btnUndoPlace) btnUndoPlace.disabled = true;
    const statusPlace = document.getElementById('statusPlace');
    if (statusPlace) statusPlace.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>Ready</span>';

    // Reset panel state
    const panel = document.getElementById('devPanel');
    if (panel) panel.classList.remove('drawing-active');
    
    // Reset map cursor
    this.map.getCanvas().style.cursor = '';

    // Restore 3D mode after drawing
    this.mapEngine.exitDrawingMode();
    this._update3DToggleUI(this.mapEngine.is3DMode());
  }

  _update3DToggleUI(is3D) {
    const label = document.getElementById('dev3dLabel');
    const switchEl = document.getElementById('dev3dSwitch');
    if (label) label.textContent = is3D ? '3D' : '2D';
    if (switchEl) {
      if (is3D) switchEl.classList.add('active');
      else switchEl.classList.remove('active');
    }
  }

  handleMapClick(e) {
    if (!this.isVisible) return;
    const latlng = [e.lngLat.lat, e.lngLat.lng];

    if (this.activeTab === 'buildings' && this.state.drawingMode) {
      this.state.buildingPoints.push(latlng);
      this._addDrawingMarker('building', latlng, this.state.buildingPoints.length);
      this.updateBuildingLine();
      document.getElementById('btnUndoBldg').disabled = false;
      document.getElementById('btnSaveAction').disabled = this.state.buildingPoints.length < 3;
      
      const n = this.state.buildingPoints.length;
      document.getElementById('statusBldg').innerHTML = `<i class="fa-solid fa-crosshairs"></i><span>Point ${n} placed${n >= 3 ? ' — ready to save!' : ' — need ' + (3 - n) + ' more'}</span>`;
      this._updateStepGuide('buildings', 2, `Drawing footprint — <b>${n} point${n !== 1 ? 's' : ''}</b> placed`);
    } 
    else if (this.activeTab === 'paths' && this.state.drawingMode) {
      this.state.pathPoints.push(latlng);
      this._addDrawingMarker('path', latlng, this.state.pathPoints.length);
      this.updatePathLine();
      document.getElementById('btnUndoPath').disabled = false;
      document.getElementById('btnSaveAction').disabled = this.state.pathPoints.length < 2;
      
      const n = this.state.pathPoints.length;
      document.getElementById('statusPath').innerHTML = `<i class="fa-solid fa-crosshairs"></i><span>Waypoint ${n} placed${n >= 2 ? ' — ready to save!' : ''}</span>`;
      this._updateStepGuide('paths', 2, `Drawing route — <b>${n} waypoint${n !== 1 ? 's' : ''}</b>`);
    }
    else if (this.activeTab === 'places' && this.state.drawingMode) {
      this.state.placePoints.push(latlng);
      this._addDrawingMarker('place', latlng, this.state.placePoints.length);
      this.updatePlaceLine();
      document.getElementById('btnUndoPlace').disabled = false;
      document.getElementById('btnSaveAction').disabled = this.state.placePoints.length < 3;
      
      const n = this.state.placePoints.length;
      document.getElementById('statusPlace').innerHTML = `<i class="fa-solid fa-crosshairs"></i><span>Point ${n} placed${n >= 3 ? ' — ready to save!' : ' — need ' + (3 - n) + ' more'}</span>`;
      this._updateStepGuide('places', 2, `Drawing area — <b>${n} point${n !== 1 ? 's' : ''}</b> placed`);
    }
    else if (this.activeTab === 'pins' && this.state.placingPinMode) {
      this.placeCurrentPin(latlng);
    }
  }

  // =================== BUILDINGS ===================
  startDrawingBuilding() {
    this.cancelAllActions();
    this.activeTab = 'buildings';
    this.state.drawingMode = true;

    // Force 2D for accurate polygon drawing
    this.mapEngine.enterDrawingMode();
    this._update3DToggleUI(false);
    
    const btn = document.getElementById('btnDrawBldg');
    btn.classList.add('active-tool');
    btn.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> Drawing...';
    document.getElementById('statusBldg').innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Click on map to place corners';
    document.getElementById('devPanel').classList.add('drawing-active');
    this.map.getCanvas().style.cursor = 'crosshair';
    
    this._updateStepGuide('buildings', 2, 'Click on the map to draw building corners');
  }

  undoBuildingPoint() {
    if (this.state.buildingPoints.length > 0) {
      this.state.buildingPoints.pop();
      this._removeLastDrawingMarker('building');
      this.updateBuildingLine();
      if (this.state.buildingPoints.length === 0) {
        document.getElementById('btnUndoBldg').disabled = true;
      }
      document.getElementById('btnSaveAction').disabled = this.state.buildingPoints.length < 3;
    }
  }

  updateBuildingLine() {
    if (this.state.buildingPolylineId) this.mapEngine.removeLine(this.state.buildingPolylineId);
    
    if (this.state.buildingPoints.length > 0) {
      const coords = [...this.state.buildingPoints];
      if (coords.length > 1) coords.push(coords[0]); // close preview ring
      
      this.state.buildingPolylineId = this.mapEngine.addLine('dev-bldg-line', coords, {
        color: '#ff4757', weight: 3, dashArray: '5,5'
      });
      
      if (this.state.buildingPoints.length > 2) {
        this.previewBuilding();
      }
    }
  }

  previewBuilding() {
    const name = document.getElementById('bldgName').value || 'Preview';
    const color = document.getElementById('bldgColor').value;
    
    const id = 'dev_preview_bldg';
    this.state.buildingPreviewId = id;
    
    this.mapEngine.addBuildingFromCoords(id, this.state.buildingPoints, {
      name: name,
      color: color,
      type: 'building'
    });
  }

  saveBuilding() {
    if (this.state.buildingPoints.length < 3) {
      this._toast('Draw at least 3 points for a building footprint', 'warning');
      return;
    }
    
    const bldg = {
      id: 'bldg_' + Date.now(),
      name: document.getElementById('bldgName').value || 'New Building',
      color: document.getElementById('bldgColor').value,
      type: 'building',
      coords: [...this.state.buildingPoints]
    };
    
    this.state.savedBuildings.push(bldg);
    localStorage.setItem('dev_buildings', JSON.stringify(this.state.savedBuildings));
    
    // Commit to map
    this.mapEngine.addBuildingFromCoords(bldg.id, bldg.coords, bldg);
    
    document.getElementById('devPanel').classList.remove('drawing-active');
    this.cancelAllActions();
    this.renderSavedBuildings();
    this.updateTabBadges();
    this._toast(`Building "${bldg.name}" saved!`, 'success');
    this._updateStepGuide('buildings', 3, 'Building saved successfully!');
    
    // Clear input for next use
    document.getElementById('bldgName').value = '';
  }

  renderSavedBuildings() {
    try {
      document.getElementById('countBldg').textContent = this.state.savedBuildings.length;
      const list = document.getElementById('listBldg');
      list.innerHTML = '';
      
      if (this.state.savedBuildings.length === 0) {
        list.innerHTML = '<div class="dev-empty-state"><i class="fa-solid fa-building"></i><span>No buildings yet</span></div>';
        return;
      }

      this.state.savedBuildings.forEach((b) => {
        if (!b || !b.coords) return;
        // Ensure it's on map
        this.mapEngine.addBuildingFromCoords(b.id, b.coords, b);
        
        const div = document.createElement('div');
        div.className = 'dev-saved-item';
        div.innerHTML = `
          <div class="dev-saved-item-info">
            <span class="dev-saved-color" style="background:${b.color || '#4A90E2'}"></span>
            <span class="dev-saved-name">${b.name}</span>
            <span class="dev-saved-meta">${b.coords.length} pts</span>
          </div>
          <button class="dev-delete-btn" title="Delete"><i class="fa-solid fa-xmark"></i></button>
        `;
        // FIX: Use b.id to find/remove instead of stale index
        div.querySelector('.dev-delete-btn').onclick = () => {
          this.mapEngine.removeBuildingById(b.id);
          this.state.savedBuildings = this.state.savedBuildings.filter(x => x.id !== b.id);
          localStorage.setItem('dev_buildings', JSON.stringify(this.state.savedBuildings));
          this.renderSavedBuildings();
          this.updateTabBadges();
          this._toast('Building deleted', 'info');
        };
        list.appendChild(div);
      });
    } catch(e) {
      console.warn("Cleared invalid dev_buildings data", e);
      this.state.savedBuildings = [];
      localStorage.removeItem('dev_buildings');
    }
  }

  // =================== PINS (360° Streetview) ===================
  handlePinFiles(files) {
    let addedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        // Create a small thumbnail instead of full-res preview
        const thumbUrl = this._createThumbnail(file);
        
        this.state.pinQueue.push({
          file: file,
          name: file.name.replace(/\.[^/.]+$/, ''), // Strip extension for clean name
          previewUrl: thumbUrl,
          size: file.size,
          status: 'queued' // queued | placing | placed | skipped
        });
        addedCount++;
      }
    }
    
    if (addedCount === 0) {
      this._toast('No valid image files found', 'warning');
      return;
    }
    
    this._toast(`${addedCount} image${addedCount > 1 ? 's' : ''} added to queue`, 'info');
    this.renderPinQueue();
    this.updateQueueProgress();
    
    if (this.state.pinQueue.length > 0 && !this.state.placingPinMode) {
      this.startPlacingNextPin();
    }
  }

  _createThumbnail(file) {
    // Use object URL for now — revoke after placement
    return URL.createObjectURL(file);
  }

  _formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  clearPinQueue() {
    // Revoke all preview URLs to prevent memory leaks
    this.state.pinQueue.forEach(pin => {
      if (pin.previewUrl) {
        URL.revokeObjectURL(pin.previewUrl);
      }
    });
    
    this.state.pinQueue = [];
    this.state.currentPinIndex = -1;
    this.state.placingPinMode = false;
    this.map.getCanvas().style.cursor = '';
    
    this.renderPinQueue();
    this.updateQueueProgress();
    document.getElementById('statusPins').innerHTML = '<i class="fa-solid fa-circle-info"></i> Queue cleared — drop more images';
    this._updateStepGuide('pins', 1, 'Drop or browse 360° images to begin');
    this._toast('Queue cleared', 'info');
  }

  updateQueueProgress() {
    const headerArea = document.getElementById('queueHeaderArea');
    const total = this.state.pinQueue.length;
    
    if (total === 0) {
      if (headerArea) headerArea.style.display = 'none';
      return;
    }
    
    headerArea.style.display = 'block';
    
    const placed = this.state.pinQueue.filter(p => p.status === 'placed').length;
    const skipped = this.state.pinQueue.filter(p => p.status === 'skipped').length;
    const done = placed + skipped;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    
    document.getElementById('queueProgressText').textContent = `${placed} / ${total} placed${skipped ? ` (${skipped} skipped)` : ''}`;
    document.getElementById('queueProgressBar').style.width = pct + '%';
  }

  renderPinQueue() {
    const list = document.getElementById('pinQueueList');
    list.innerHTML = '';
    
    this.state.pinQueue.forEach((pin, i) => {
      const isCurrent = i === this.state.currentPinIndex;
      const isPlaced = pin.status === 'placed';
      const isSkipped = pin.status === 'skipped';
      
      const item = document.createElement('div');
      item.className = `queue-item ${isCurrent ? 'current' : ''} ${isPlaced ? 'placed' : ''} ${isSkipped ? 'skipped' : ''}`;
      
      item.innerHTML = `
        <div class="queue-img-wrap">
          <img src="${pin.previewUrl}" alt="${pin.name}" loading="lazy">
          ${pin.previewUrl ? '<span class="queue-preview-badge" title="Click image to preview 360°"><i class="fa-solid fa-expand"></i></span>' : ''}
        </div>
        <div class="queue-info">
          ${isCurrent ? `<input type="text" class="dev-input dev-pin-name-input" value="${pin.name}" data-index="${i}" style="width:100%;margin-bottom:4px;" placeholder="Name this pin">` : `<b>${pin.name}</b>`}
          <span class="queue-meta">${this._formatFileSize(pin.size)}</span>
        </div>
        <div class="queue-actions">
          ${isPlaced ? '<span class="queue-badge placed"><i class="fa-solid fa-check"></i></span>' :
            isSkipped ? '<span class="queue-badge skipped">Skipped</span>' :
            isCurrent ? '<i class="fa-solid fa-location-crosshairs queue-placing-icon"></i>' :
            `<button class="dev-btn-mini" data-action="skip" data-index="${i}" title="Skip"><i class="fa-solid fa-forward"></i></button>
             <button class="dev-btn-mini danger" data-action="remove" data-index="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>`
          }
        </div>
      `;
      
      // Click on image thumbnail to preview 360°
      const img = item.querySelector('img');
      if (img && pin.previewUrl) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          this._preview360(pin.previewUrl, pin.name);
        });
      }
      
      list.appendChild(item);
    });

    // Bind queue action buttons
    list.querySelectorAll('[data-action="skip"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.skipQueueItem(idx);
      });
    });
    list.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.removeQueueItem(idx);
      });
    });
  }

  skipQueueItem(index) {
    if (index >= 0 && index < this.state.pinQueue.length) {
      const pin = this.state.pinQueue[index];
      pin.status = 'skipped';
      // Revoke URL to free memory
      if (pin.previewUrl) {
        URL.revokeObjectURL(pin.previewUrl);
        pin.previewUrl = '';
      }
      
      // If we skipped the current one, move to next
      if (index === this.state.currentPinIndex) {
        this.startPlacingNextPin();
      } else {
        this.renderPinQueue();
        this.updateQueueProgress();
      }
    }
  }

  removeQueueItem(index) {
    if (index >= 0 && index < this.state.pinQueue.length) {
      const pin = this.state.pinQueue[index];
      // Revoke URL to free memory
      if (pin.previewUrl) URL.revokeObjectURL(pin.previewUrl);
      
      this.state.pinQueue.splice(index, 1);
      
      // Adjust currentPinIndex if needed
      if (index < this.state.currentPinIndex) {
        this.state.currentPinIndex--;
      } else if (index === this.state.currentPinIndex) {
        this.state.currentPinIndex--;
        this.startPlacingNextPin();
        return;
      }
      
      this.renderPinQueue();
      this.updateQueueProgress();
    }
  }

  startPlacingNextPin() {
    // Find next unprocessed pin
    let nextIdx = -1;
    for (let i = 0; i < this.state.pinQueue.length; i++) {
      if (this.state.pinQueue[i].status === 'queued') {
        nextIdx = i;
        break;
      }
    }
    
    this.state.currentPinIndex = nextIdx;

    if (this.state.currentPinIndex === -1 || this.state.currentPinIndex >= this.state.pinQueue.length) {
      // Done!
      this.state.placingPinMode = false;
      this.map.getCanvas().style.cursor = '';
      
      const placed = this.state.pinQueue.filter(p => p.status === 'placed').length;
      document.getElementById('statusPins').innerHTML = `<i class="fa-solid fa-check-circle"></i> All done! ${placed} pin${placed !== 1 ? 's' : ''} placed`;
      this._updateStepGuide('pins', 3, `All ${placed} pins placed!`);
      
      // Do NOT revoke previewUrls immediately here, so the 'Test 360 View' button 
      // still has access to the Blob in memory during this session.
      // They will be cleared when the user clicks 'Clear Queue' or refreshes.
      
      this.renderPinQueue();
      this.updateQueueProgress();
      this._toast(`${placed} pin${placed !== 1 ? 's' : ''} placed successfully!`, 'success');
      return;
    }

    this.state.placingPinMode = true;
    this.state.pinQueue[this.state.currentPinIndex].status = 'placing';
    this.map.getCanvas().style.cursor = 'crosshair';
    this.renderPinQueue();
    this.updateQueueProgress();
    
    const currentPin = this.state.pinQueue[this.state.currentPinIndex];
    const remaining = this.state.pinQueue.filter(p => p.status === 'queued' || p.status === 'placing').length;
    document.getElementById('statusPins').innerHTML = `<i class="fa-solid fa-crosshairs"></i> Click map to place: <b>${currentPin.name}</b> (${remaining} remaining)`;
    this._updateStepGuide('pins', 2, `Click on map to place <b>${currentPin.name}</b>`);
  }

  async placeCurrentPin(latlng) {
    const currentPin = this.state.pinQueue[this.state.currentPinIndex];
    
    // Check if they renamed it in the UI
    const nameInput = document.querySelector('.dev-pin-name-input');
    const finalName = nameInput ? nameInput.value.trim() || currentPin.name : currentPin.name;
    
    const pinId = 'pin_' + Date.now();
    
    // Upload to server — image goes to images/streetview/, pin data to data/pins.json
    const formData = new FormData();
    formData.append('name', finalName);
    formData.append('lat', latlng[0]);
    formData.append('lng', latlng[1]);
    formData.append('floor', typeof currentFloor !== 'undefined' ? currentFloor : 0);
    formData.append('id', pinId);
    formData.append('image', currentPin.file);
    
    try {
      const response = await fetch('/save_pin', { method: 'POST', body: formData });
      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.msg || 'Server error');
      }
      // Use server-returned values (secure_filename may alter the name)
      var serverImage = result.image || currentPin.file.name;
      var serverId = result.id || pinId;
    } catch (e) {
      this._toast('Failed to save pin: ' + e.message + '. Is server.py running?', 'error');
      currentPin.status = 'queued'; // Allow retry
      this.state.placingPinMode = false;
      this.map.getCanvas().style.cursor = '';
      this.renderPinQueue();
      this.updateQueueProgress();
      return;
    }
    
    const pinData = {
      id: serverId,
      name: finalName,
      lat: latlng[0],
      lng: latlng[1],
      floor: typeof currentFloor !== 'undefined' ? currentFloor : 0,
      image: serverImage
    };
    
    this.state.savedPins.push(pinData);
    
    // Mark as placed
    currentPin.status = 'placed';
    
    // Inject into the global allPins array so the pin works immediately
    if (typeof allPins !== 'undefined') {
      allPins.push({
        ...pinData,
        image: pinData.image // Server-saved filename, loads from images/streetview/
      });
    }
    
    // Add to map visually
    this.addPinMarker(pinData);
    
    this.renderSavedPins();
    this.updateTabBadges();
    this.startPlacingNextPin();
  }

  addPinMarker(pin) {
    const pinFloor = pin.floor !== undefined ? pin.floor : 0;
    this.mapEngine.addMarker([pin.lat, pin.lng], {
      id: 'dev_pin_' + pin.id,
      floor: pinFloor,
      draggable: true,
      onDragEnd: async (pos) => {
        pin.lat = pos.lat;
        pin.lng = pos.lng;
        // update UI coordinates silently if it's open
        const list = document.getElementById('listPins');
        if (list) {
            const meta = list.querySelector(`[data-id="${pin.id}"] .dev-saved-meta`);
            if (meta) meta.textContent = `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
        }
        // update server
        try {
          await fetch('/update_pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pin.id, lat: pos.lat, lng: pos.lng })
          });
          this._toast('Pin location updated', 'success');
          
          if (typeof allPins !== 'undefined') {
            const globalPin = allPins.find(x => x.id === pin.id);
            if (globalPin) {
               globalPin.lat = pos.lat;
               globalPin.lng = pos.lng;
               if (window.mapEngine) window.mapEngine.updateMarkerPosition('pin_marker_' + pin.id, pos);
            }
          }
        } catch(e) {
          this._toast('Failed to update location', 'error');
        }
      },
      html: '<i class="fa-solid fa-map-pin" style="font-size:24px;color:#2ed573;"></i>',
      popup: `<div style="text-align:center;">
        <strong>${pin.name}</strong><br>
        <button onclick='openViewer("${pin.id}")'
                style="margin-top:10px;padding:8px 16px;background:#0a84ff;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Kanit,sans-serif;">
          Test 360° View
        </button>
      </div>`
    });
  }

  renderSavedPins() {
    try {
      const currentFloorInt = typeof currentFloor !== 'undefined' ? currentFloor : 0;
      const floorPins = this.state.savedPins.filter(p => (p.floor || 0) === currentFloorInt);
      
      document.getElementById('countPins').textContent = floorPins.length;
      const list = document.getElementById('listPins');
      list.innerHTML = '';
      
      if (floorPins.length === 0) {
        list.innerHTML = `<div class="dev-empty-state"><i class="fa-solid fa-map-pin"></i><span>No pins on floor ${currentFloorInt}</span></div>`;
        return;
      }

      floorPins.forEach((p) => {
        if (!p || typeof p.lat === 'undefined') return;
        
        const div = document.createElement('div');
        div.className = 'dev-saved-item';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        
        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.justifyContent = 'space-between';
        topRow.style.width = '100%';
        topRow.innerHTML = `
          <div class="dev-saved-item-info">
            <span class="dev-saved-color" style="background:#2ed573"></span>
            <input type="text" class="dev-edit-name" value="${p.name}" style="background:transparent; border:none; color:inherit; font-weight:bold; width:120px;" title="Edit pin name">
          </div>
          <div>
            <button class="dev-btn-mini preview-btn" title="Preview 360" style="margin-right:4px;"><i class="fa-solid fa-eye"></i></button>
            <button class="dev-delete-btn" title="Delete"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `;
        
        const bottomRow = document.createElement('div');
        bottomRow.style.marginTop = '8px';
        bottomRow.style.fontSize = '12px';
        bottomRow.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;">
            <span>North Heading:</span>
            <span>
              <input type="number" class="yaw-val" value="${Math.round((p.yawOffset || 0)*180/Math.PI)}" style="width:45px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:white; border-radius:4px; padding:2px; text-align:center;" min="0" max="360">°
            </span>
          </div>
          <input type="range" class="yaw-slider" min="0" max="360" value="${Math.round((p.yawOffset || 0)*180/Math.PI)}" style="width:100%;">
          <div class="dev-saved-meta" style="margin-top:4px; color:var(--muted); font-size:10px;">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
        `;
        
        div.appendChild(topRow);
        div.appendChild(bottomRow);

        topRow.querySelector('.dev-delete-btn').onclick = () => this.deletePin(p);
        topRow.querySelector('.preview-btn').onclick = () => {
          if (typeof openViewer === 'function') openViewer(p.id);
        };
        
        const nameInput = topRow.querySelector('.dev-edit-name');
        nameInput.addEventListener('change', async (e) => {
          const newName = e.target.value.trim();
          if (!newName) return;
          p.name = newName;
          try {
            await fetch('/update_pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: p.id, name: newName })
            });
            this._toast('Pin name updated', 'success');
            if (typeof allPins !== 'undefined') {
              const globalPin = allPins.find(x => x.id === p.id);
              if (globalPin) {
                globalPin.name = newName;
                if (window.mapEngine) {
                  window.mapEngine.setMarkerElement('pin_marker_' + p.id, '<i class="fa-solid fa-map-pin" style="font-size:24px;color:#ff4757;"></i>');
                  window.mapEngine.setMarkerPopup('pin_marker_' + p.id, `<b>${newName}</b><br><button onclick='openViewer("${p.id}")' style="margin-top:10px;padding:8px 16px;background:#0a84ff;color:white;border:none;border-radius:8px;cursor:pointer;">View 360°</button>`);
                }
              }
            }
          } catch(err) {
            this._toast('Failed to update name', 'error');
          }
        });

        const slider = bottomRow.querySelector('.yaw-slider');
        const yawVal = bottomRow.querySelector('.yaw-val');
        
        const updateHeading = (val) => {
          let deg = parseInt(val);
          if (isNaN(deg)) return;
          if (deg < 0) deg = 0;
          if (deg > 360) deg = 360;
          slider.value = deg;
          yawVal.value = deg;
          
          const rad = (deg * Math.PI) / 180;
          if (typeof viewerInstance !== 'undefined' && viewerInstance) {
            try {
              const plugin = viewerInstance.getPlugin(PhotoSphereViewer.VirtualTourPlugin);
              if (plugin && plugin.getCurrentNode() && plugin.getCurrentNode().id === p.id) {
                 viewerInstance.setOption('sphereCorrection', { pan: rad });
              }
            } catch(err){}
          }
        };

        slider.addEventListener('input', (e) => updateHeading(e.target.value));
        yawVal.addEventListener('input', (e) => updateHeading(e.target.value));
        
        const saveHeading = async (val) => {
          let deg = parseInt(val);
          if (isNaN(deg)) return;
          const rad = (deg * Math.PI) / 180;
          p.yawOffset = rad;
          try {
            await fetch('/update_pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: p.id, yawOffset: rad })
            });
            this._toast('Heading updated', 'success');
            if (typeof allPins !== 'undefined') {
              const globalPin = allPins.find(x => x.id === p.id);
              if (globalPin) globalPin.yawOffset = rad;
            }
          } catch(err) {}
        };

        slider.addEventListener('change', (e) => saveHeading(e.target.value));
        yawVal.addEventListener('change', (e) => saveHeading(e.target.value));

        list.appendChild(div);
      });
    } catch(e) {
      console.warn("Error rendering saved pins", e);
      this.state.savedPins = [];
    }
  }

  // Load pins from server (data/pins.json) instead of localStorage
  async loadPinsFromServer() {
    try {
      const response = await fetch('/get_pins').catch(() => null);
      let pins;
      if (response && response.ok) {
        pins = await response.json();
      } else {
        // Fall back to static file (GitHub Pages)
        const fallback = await fetch('data/pins.json');
        pins = await fallback.json();
      }
      this.state.savedPins = Array.isArray(pins) ? pins : [];
      // Generate IDs for pins that don't have them
      this.state.savedPins.forEach(pin => {
        if (!pin.id) {
          pin.id = `pin_${pin.name.toLowerCase().replace(/\s+/g, '_')}_${pin.lat.toFixed(5)}_${pin.lng.toFixed(5)}`;
        }
      });
    } catch (e) {
      this.state.savedPins = [];
    }
    this.renderSavedPins();
    this.updateTabBadges();
  }

  // Delete pin from server
  async deletePin(pin) {
    try {
      const response = await fetch('/delete_pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pin.id, name: pin.name, lat: pin.lat, lng: pin.lng })
      });
      const result = await response.json();
      if (result.status !== 'success') {
        this._toast('Failed to delete pin from server', 'error');
        return;
      }
    } catch (e) {
      this._toast('Server not reachable. Is server.py running?', 'error');
      return;
    }
    
    // Remove markers from map (both dev-tools and script.js markers)
    this.mapEngine.removeMarker('dev_pin_' + pin.id);
    this.mapEngine.removeMarker('pin_marker_' + pin.id);
    
    // Remove from state
    this.state.savedPins = this.state.savedPins.filter(x => x.id !== pin.id);
    
    // Remove from global allPins if present
    if (typeof allPins !== 'undefined') {
      const idx = allPins.findIndex(p => p.id === pin.id);
      if (idx !== -1) allPins.splice(idx, 1);
    }
    
    this.renderSavedPins();
    this.updateTabBadges();
    this._toast('Pin deleted', 'info');
  }

  // Preview 360° image in the viewer overlay
  _preview360(imageUrl, name) {
    const overlay = document.getElementById('viewerOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    
    const container = document.getElementById('viewer');
    container.innerHTML = '';
    
    // Clean up any existing dev preview viewer
    if (window._devPreviewViewer) {
      try { window._devPreviewViewer.destroy(); } catch(e) {}
      window._devPreviewViewer = null;
    }
    
    try {
      window._devPreviewViewer = new PhotoSphereViewer.Viewer({
        container: container,
        panorama: imageUrl,
        caption: name || 'Preview'
      });
    } catch(e) {
      this._toast('Cannot preview this image as 360°', 'warning');
      overlay.style.display = 'none';
    }
  }

  // =================== PLACES ===================
  startDrawingPlace() {
    this.cancelAllActions();
    this.activeTab = 'places';
    this.state.drawingMode = true;

    // Force 2D for accurate polygon drawing
    this.mapEngine.enterDrawingMode();
    this._update3DToggleUI(false);
    
    const btn = document.getElementById('btnDrawPlace');
    btn.classList.add('active-tool');
    btn.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> Drawing...';
    document.getElementById('statusPlace').innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Click on map to place corners';
    document.getElementById('devPanel').classList.add('drawing-active');
    this.map.getCanvas().style.cursor = 'crosshair';
    
    this._updateStepGuide('places', 2, 'Click on the map to draw place corners');
  }

  undoPlacePoint() {
    if (this.state.placePoints.length > 0) {
      this.state.placePoints.pop();
      this._removeLastDrawingMarker('place');
      this.updatePlaceLine();
      if (this.state.placePoints.length === 0) {
        document.getElementById('btnUndoPlace').disabled = true;
      }
      document.getElementById('btnSaveAction').disabled = this.state.placePoints.length < 3;
    }
  }

  updatePlaceLine() {
    if (this.state.placePolylineId) this.mapEngine.removeLine(this.state.placePolylineId);
    if (this.state.placePreviewId) {
      if (this.mapEngine.removePolygon) this.mapEngine.removePolygon(this.state.placePreviewId);
    }
    
    if (this.state.placePoints.length > 0) {
      const coords = [...this.state.placePoints];
      if (coords.length > 1) coords.push(coords[0]); // close preview ring
      
      this.state.placePolylineId = this.mapEngine.addLine('dev-place-line', coords, {
        color: '#1a73e8', weight: 3, dashArray: '5,5'
      });
      
      if (coords.length > 3) {
        // Show fill preview
        this.state.placePreviewId = 'dev-place-preview';
        if (this.mapEngine.addPolygon) {
          this.mapEngine.addPolygon(this.state.placePreviewId, coords, {
            color: '#1a73e8', fillOpacity: 0.3, opacity: 0
          });
        }
      }
    }
  }

  async savePlace() {
    if (this.state.placePoints.length < 3) {
      this._toast('Draw at least 3 points for a place area', 'warning');
      return;
    }
    
    const nameEl = document.getElementById('placeName');
    const name = nameEl.value.trim();
    if (!name) {
      this._toast('Please enter a place name', 'warning');
      nameEl.focus();
      return;
    }
    
    const catEl = document.getElementById('placeCategory');
    const customCatEl = document.getElementById('placeCustomCategory');
    const category = catEl.value === 'other' ? customCatEl.value.trim() : catEl.value;
    
    if (!category) {
      this._toast('Please provide a category', 'warning');
      return;
    }
    
    const floor = parseInt(document.getElementById('placeFloor').value) || (typeof currentFloor !== 'undefined' ? currentFloor : 1);
    const panoramaId = document.getElementById('placePanoramaId').value;
    
    const place = {
      name: name,
      category: category,
      floor: floor,
      coords: this.state.placePoints.map(p => [p[0], p[1]])
    };
    if (panoramaId) place.panoramaId = panoramaId;

    // Handle Image Upload
    const imageInput = document.getElementById('placeImage');
    if (imageInput.files && imageInput.files[0]) {
      const file = imageInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/upload_image', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (response.ok && result.filename) {
          place.image = result.filename;
        } else {
          this._toast('Image upload failed: ' + (result.error || 'Unknown error'), 'warning');
        }
      } catch (err) {
        this._toast('Error uploading image', 'error');
        console.error(err);
      }
    }

    try {
      const res = await fetch('/save_place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(place)
      });
      const result = await res.json();
      
      if (res.ok) {
        this._toast('Place saved to server!', 'success');
        this.cancelAllActions();
        
        nameEl.value = '';
        customCatEl.value = '';
        imageInput.value = '';
        
        if (typeof loadPlaces === 'function') {
          loadPlaces(); // Reload data from server
        }
        
        // Wait a bit, then render our saved places list
        setTimeout(() => this.renderSavedPlaces(), 500);
      } else {
        this._toast('Failed to save place: ' + (result.error || 'Server error'), 'error');
      }
    } catch (err) {
      this._toast('Cannot reach server', 'error');
      console.error(err);
    }
  }
  
  async renderSavedPlaces() {
    try {
      const res = await fetch('/get_places');
      const places = await res.json();
      
      const countEl = document.getElementById('countPlaces');
      const listEl = document.getElementById('listPlaces');
      if (!listEl) return;
      
      if (countEl) countEl.textContent = places.length;
      listEl.innerHTML = '';
      
      if (places.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No places saved yet</div>';
        return;
      }
      
      places.forEach(p => {
        const item = document.createElement('div');
        item.className = 'dev-saved-item';
        
        const catStr = p.category ? ` • ${p.category}` : '';
        item.innerHTML = `
          <div class="dev-saved-info">
            <div class="dev-saved-title">${p.name}</div>
            <div class="dev-saved-meta">Floor: ${p.floor}${catStr}</div>
          </div>
          <div class="dev-saved-actions">
            <button class="icon-btn danger" title="Delete Place">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
        
        item.querySelector('.danger').onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Delete place "${p.name}"?`)) {
            this.deletePlace(p.id);
          }
        };
        
        listEl.appendChild(item);
      });
    } catch (e) {
      console.error("Failed to render places", e);
    }
  }
  
  async deletePlace(id) {
    try {
      const res = await fetch('/delete_place/' + id, { method: 'DELETE' });
      if (res.ok) {
        this._toast('Place deleted', 'success');
        if (typeof loadPlaces === 'function') loadPlaces();
        this.renderSavedPlaces();
      } else {
        this._toast('Failed to delete place', 'error');
      }
    } catch(e) {
      this._toast('Cannot reach server', 'error');
    }
  }

  // =================== PATHWAYS ===================
  startDrawingPath() {
    this.cancelAllActions();
    this.activeTab = 'paths';
    this.state.drawingMode = true;

    // Force 2D for accurate path drawing
    this.mapEngine.enterDrawingMode();
    this._update3DToggleUI(false);
    
    const btn = document.getElementById('btnDrawPath');
    btn.classList.add('active-tool');
    btn.innerHTML = '<i class="fa-solid fa-pen"></i> Drawing...';
    document.getElementById('statusPath').innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Click on map to add waypoints';
    document.getElementById('devPanel').classList.add('drawing-active');
    this.map.getCanvas().style.cursor = 'crosshair';
    
    this._updateStepGuide('paths', 2, 'Click on the map to place waypoints');
  }

  undoPathPoint() {
    if (this.state.pathPoints.length > 0) {
      this.state.pathPoints.pop();
      this._removeLastDrawingMarker('path');
      this.updatePathLine();
      if (this.state.pathPoints.length === 0) {
        document.getElementById('btnUndoPath').disabled = true;
      }
      document.getElementById('btnSaveAction').disabled = this.state.pathPoints.length < 2;
    }
  }

  updatePathLine() {
    if (this.state.pathPolylineId) this.mapEngine.removeLine(this.state.pathPolylineId);
    
    if (this.state.pathPoints.length > 0) {
      const coords = [...this.state.pathPoints];
      this.state.pathPolylineId = this.mapEngine.addLine('dev-path-line', coords, {
        color: '#0a84ff', weight: 4, dashArray: '10,10'
      });
    }
  }

  savePath() {
    if (this.state.pathPoints.length < 2) {
      this._toast('Draw at least 2 waypoints for a route', 'warning');
      return;
    }
    
    const path = {
      id: 'path_' + Date.now(),
      name: document.getElementById('pathName').value || 'New Route',
      coords: [...this.state.pathPoints]
    };
    
    this.state.savedPaths.push(path);
    localStorage.setItem('dev_paths', JSON.stringify(this.state.savedPaths));
    
    // Commit to map permanently
    this.mapEngine.addLine('saved_path_' + path.id, path.coords, {
      color: '#0a84ff', weight: 5
    });
    
    document.getElementById('devPanel').classList.remove('drawing-active');
    this.cancelAllActions();
    this.renderSavedPaths();
    this.updateTabBadges();
    this._toast(`Route "${path.name}" saved!`, 'success');
    this._updateStepGuide('paths', 3, 'Route saved successfully!');
    
    // Clear input for next use
    document.getElementById('pathName').value = '';
  }

  renderSavedPaths() {
    try {
      document.getElementById('countPath').textContent = this.state.savedPaths.length;
      const list = document.getElementById('listPath');
      list.innerHTML = '';
      
      if (this.state.savedPaths.length === 0) {
        list.innerHTML = '<div class="dev-empty-state"><i class="fa-solid fa-route"></i><span>No routes yet</span></div>';
        return;
      }

      this.state.savedPaths.forEach((p) => {
        if (!p || !p.coords) return;
        // Ensure on map
        this.mapEngine.addLine('saved_path_' + p.id, p.coords, { color: '#0a84ff', weight: 5 });
        
        const div = document.createElement('div');
        div.className = 'dev-saved-item';
        div.innerHTML = `
          <div class="dev-saved-item-info">
            <span class="dev-saved-color" style="background:#0a84ff"></span>
            <span class="dev-saved-name">${p.name}</span>
            <span class="dev-saved-meta">${p.coords.length} waypoints</span>
          </div>
          <button class="dev-delete-btn" title="Delete"><i class="fa-solid fa-xmark"></i></button>
        `;
        // FIX: Use p.id to find/remove instead of stale index
        div.querySelector('.dev-delete-btn').onclick = () => {
          this.mapEngine.removeLine('saved_path_' + p.id);
          this.state.savedPaths = this.state.savedPaths.filter(x => x.id !== p.id);
          localStorage.setItem('dev_paths', JSON.stringify(this.state.savedPaths));
          this.renderSavedPaths();
          this.updateTabBadges();
          this._toast('Route deleted', 'info');
        };
        list.appendChild(div);
      });
    } catch(e) {
      console.warn("Cleared invalid dev_paths data", e);
      this.state.savedPaths = [];
      localStorage.removeItem('dev_paths');
    }
  }

  // =================== IMPORT / EXPORT ===================
  downloadAllJSON() {
    const data = {
      buildings: this.state.savedBuildings,
      pins: this.state.savedPins,
      paths: this.state.savedPaths
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dev_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this._toast('JSON exported!', 'success');
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let imported = 0;
        
        if (data.buildings && Array.isArray(data.buildings)) {
          data.buildings.forEach(b => {
            if (b.coords && b.id) {
              // Avoid duplicate IDs
              if (!this.state.savedBuildings.find(x => x.id === b.id)) {
                this.state.savedBuildings.push(b);
                this.mapEngine.addBuildingFromCoords(b.id, b.coords, b);
                imported++;
              }
            }
          });
          localStorage.setItem('dev_buildings', JSON.stringify(this.state.savedBuildings));
        }
        
        if (data.pins && Array.isArray(data.pins)) {
          // Import pins to server via individual save calls
          for (const p of data.pins) {
            if (p.id && typeof p.lat !== 'undefined') {
              if (!this.state.savedPins.find(x => x.id === p.id)) {
                this.state.savedPins.push(p);
                this.addPinMarker(p);
                imported++;
              }
            }
          }
          // Note: imported pins metadata only — images must be in images/streetview/ manually
        }
        
        if (data.paths && Array.isArray(data.paths)) {
          data.paths.forEach(p => {
            if (p.id && p.coords) {
              if (!this.state.savedPaths.find(x => x.id === p.id)) {
                this.state.savedPaths.push(p);
                this.mapEngine.addLine('saved_path_' + p.id, p.coords, { color: '#0a84ff', weight: 5 });
                imported++;
              }
            }
          });
          localStorage.setItem('dev_paths', JSON.stringify(this.state.savedPaths));
        }
        
        this.renderSavedBuildings();
        this.renderSavedPins();
        this.renderSavedPaths();
        this.updateTabBadges();
        this._toast(`Imported ${imported} items!`, 'success');
      } catch (err) {
        this._toast('Invalid JSON file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  }

  // =================== DRAWING MARKERS ===================
  _addDrawingMarker(type, latlng, index) {
    const color = type === 'building' ? '#ff4757' : type === 'place' ? '#1a73e8' : '#0a84ff';
    const markerId = this.mapEngine.addMarker(latlng, {
      id: `dev_draw_${type}_${index}_${Date.now()}`,
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${index}</div>`,
      anchor: 'center'
    });
    const markers = type === 'building' ? this.state.buildingMarkers : type === 'place' ? this.state.placeMarkers : this.state.pathMarkers;
    markers.push(markerId);
  }

  _removeLastDrawingMarker(type) {
    const markers = type === 'building' ? this.state.buildingMarkers : type === 'place' ? this.state.placeMarkers : this.state.pathMarkers;
    if (markers.length > 0) {
      const id = markers.pop();
      this.mapEngine.removeMarker(id);
    }
  }

  _clearDrawingMarkers(type) {
    const markers = type === 'building' ? this.state.buildingMarkers : type === 'place' ? this.state.placeMarkers : this.state.pathMarkers;
    markers.forEach(id => this.mapEngine.removeMarker(id));
    markers.length = 0;
  }

  // =================== UTILS ===================
  makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      // Don't drag if clicking buttons inside the header
      if (e.target.closest('button') || e.target.closest('.dev-shortcut-hint')) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      let newTop = el.offsetTop - pos2;
      let newLeft = el.offsetLeft - pos1;
      
      // Bounds
      if (newTop < 0) newTop = 0;
      if (newLeft < 0) newLeft = 0;
      if (newTop + el.offsetHeight > window.innerHeight) newTop = window.innerHeight - el.offsetHeight;
      if (newLeft + el.offsetWidth > window.innerWidth) newLeft = window.innerWidth - el.offsetWidth;
      
      el.style.top = newTop + "px";
      el.style.left = newLeft + "px";
      el.style.bottom = "auto";
      el.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
}

// Initialize when map is ready
(function initDevTools() {
  const tryInit = () => {
    if (window.mapEngine && window.mapEngine._ready) {
      window.mapEngine._ready.then(() => {
        try {
          window.devTools = new DevTools(window.mapEngine);
          console.log("DevTools successfully created and attached to DOM!");
          
          // Auto-open if devMode is on
          fetch('config.json?t=' + Date.now())
            .then(r => r.json())
            .then(cfg => {
              if (cfg.devMode) {
                console.log("DevMode config is true, popping up panel...");
                const devBtn = document.getElementById('devModeBtn');
                if (devBtn) devBtn.style.display = 'flex';
                window.devTools.togglePanel(true);
              } else {
                console.log("ℹ️ DevMode config is false.");
              }
            })
            .catch(e => console.warn('DevTools: Could not load config.json', e));
        } catch (initErr) {
          console.error("❌ FATAL: DevTools failed to initialize!", initErr);
        }
      });
    } else {
      setTimeout(tryInit, 100);
    }
  };
  tryInit();
})();

// Secret Hotkey to forcefully open Dev Tools (Ctrl + Shift + X)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
    e.preventDefault();
    
    if (!window.devTools) {
      if (!window.mapEngine) {
        console.error("🚨 CRITICAL: mapEngine is totally missing!");
        return;
      }
      try {
        window.devTools = new DevTools(window.mapEngine);
        console.log("Forced DevTools initialization via hotkey.");
      } catch (err) {
        console.error("💥 CRASH during DevTools initialization:", err);
        return;
      }
    }
    
    if (window.devTools) {
      window.devTools.togglePanel(true);
      const devBtn = document.getElementById('devModeBtn');
      if (devBtn) devBtn.style.display = 'flex';
    }
  }
});
