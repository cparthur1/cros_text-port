/**
 * @constructor
 */
function WindowController(editor, settings, tabs) {
  this.editor_ = editor;
  this.settings_ = settings;
  this.tabs_ = tabs;

  var closeButton = document.getElementById('window-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      this.close();
    });
  }
  var minimizeButton = document.getElementById('window-minimize');
  if (minimizeButton) {
    minimizeButton.addEventListener('click', this.minimize_.bind(this));
  }
  var maximizeButton = document.getElementById('window-maximize');
  if (maximizeButton) {
    maximizeButton.addEventListener('click', this.maximize_.bind(this));
  }
  var toggleSidebarBtn = document.getElementById('toggle-sidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', this.toggleSidebar_.bind(this));
  }
  var sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('transitionend', this.updateSidebarVisibility_.bind(this));
  }
  var resizer = document.getElementById('sidebar-resizer');
  if (resizer) {
    resizer.addEventListener('mousedown', this.resizeStart_.bind(this));
  }

  window.addEventListener('error', this.onError_.bind(this));
  document.addEventListener('filesystemerror', this.onFileSystemError.bind(this));
  document.addEventListener('loadingfile', this.onLoadingFile.bind(this));
  document.addEventListener('switchtab', (e) => this.onChangeTab_(this.resolveTab_(e)));
  document.addEventListener('tabchange', (e) => this.onTabChange_(this.resolveTab_(e)));
  document.addEventListener('tabpathchange', (e) => this.onTabPathChange(this.resolveTab_(e)));
  document.addEventListener('tabrenamed', (e) => this.onChangeTab_(this.resolveTab_(e)));
  document.addEventListener('tabsave', (e) => this.onTabChange_(this.resolveTab_(e)));
  document.addEventListener('tabsaving', (e) => this.updateAutosaveIndicator_(this.resolveTab_(e)));
  document.addEventListener('tabsaveerror', (e) => this.updateAutosaveIndicator_(this.resolveTab_(e)));
  document.addEventListener('tabmissingchange', (e) => this.onTabMissingChange_(this.resolveTab_(e)));
  document.addEventListener('settingschange', (e) => {
    var key = e.detail && e.detail.key !== undefined ? e.detail.key : (Array.isArray(e.detail) ? e.detail[0] : null);
    var value = e.detail && e.detail.value !== undefined ? e.detail.value : (Array.isArray(e.detail) ? e.detail[1] : null);
    if (key !== null) this.onSettingsChange_(e, key, value);
  });

  this.ensureAutosaveIndicatorDom_();
  this.initFileDrop_();
  this.initUI_();
}

/**
 * Resolves Tab instance whether passed as an event or direct argument.
 * @param {*=} opt_e
 * @param {*=} opt_tab
 * @return {Tab}
 * @private
 */
WindowController.prototype.resolveTab_ = function(opt_e, opt_tab) {
  if (opt_tab) return opt_tab;
  if (opt_e && opt_e.detail) return opt_e.detail;
  return opt_e;
};

/**
 * Performs all the required initialization for the UI.
 * @private
 */
WindowController.prototype.initUI_ = function() {
  for (const element of document.querySelectorAll('.mdc-icon-button')) {
    const ripple = mdc.ripple.MDCRipple.attachTo(element);
    ripple.unbounded = true;
    new ResizeObserver(() => {
      ripple.layout();
    }).observe(element);
  }
  for (const element of document.querySelectorAll('.mdc-switch')) {
    new mdc.switchControl.MDCSwitch(element);
  }
  for (const element of document.querySelectorAll('.mdc-radio')) {
    const formField = new mdc.formField.MDCFormField(element.parentElement);
    formField.input = new mdc.radio.MDCRadio(element);
  }
  if (this.settings_.isReady()) {
    this.initSidebar_();
  } else {
    document.addEventListener('settingsready', this.initSidebar_.bind(this));
  }
};

WindowController.prototype.initSidebar_ = function() {
  var sidebar = document.getElementById('sidebar');
  var toggleBtn = document.getElementById('toggle-sidebar');
  if (this.settings_.get('sidebaropen')) {
    if (sidebar) {
      sidebar.style.width = this.settings_.get('sidebarwidth') + 'px';
      sidebar.style.borderRightWidth = '2px';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('title', chrome.i18n.getMessage('closeSidebarButton'));
    }
  } else {
    if (sidebar) {
      sidebar.style.width = '0';
      sidebar.style.borderRightWidth = '0';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('title', chrome.i18n.getMessage('openSidebarButton'));
    }
  }
  this.updateSidebarVisibility_();
};

WindowController.prototype.windowControlsVisible = function(show) {
  var header = document.querySelector('header');
  if (header) {
    header.classList.toggle('hide-controls', !show);
  }
};

/**
 * @param {string} theme
 */
WindowController.prototype.setTheme = function(theme) {
  document.body.setAttribute('theme', theme);
};

/**
 * Close app window after warning user of all unsaved progress if present.
 */
WindowController.prototype.close = function() {
  this.tabs_.promptAllUnsaved(window.close);
};

WindowController.prototype.focus_ = function() {
  window.chrome.app.window.current().focus();
};

WindowController.prototype.minimize_ = function() {
  window.chrome.app.window.current().minimize();
};

WindowController.prototype.maximize_ = function() {
  var maximized = window.chrome.app.window.current().isMaximized();

  var maxBtn = document.getElementById('window-maximize');
  if (maximized) {
    window.chrome.app.window.current().restore();
    if (maxBtn) maxBtn.setAttribute('title', chrome.i18n.getMessage('maximizeButton'));
  } else {
    window.chrome.app.window.current().maximize();
    if (maxBtn) maxBtn.setAttribute('title', chrome.i18n.getMessage('restoreButton'));
  }
};

WindowController.prototype.setAlwaysOnTop = function(isAlwaysOnTop) {
  window.chrome.app.window.current().setAlwaysOnTop(isAlwaysOnTop);
};

/** Opens the sidebar if it is closed. */
WindowController.prototype.openSidebar = function() {
  this.settings_.set('sidebaropen', true);
  var sidebar = document.getElementById('sidebar');
  if (sidebar) {
    var width = this.settings_.get('sidebarwidth') || 220;
    sidebar.style.visibility = 'visible';
    sidebar.style.width = width + 'px';
    sidebar.style.borderRightWidth = '2px';
  }
  var toggleBtn = document.getElementById('toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.setAttribute('title', chrome.i18n.getMessage('closeSidebarButton') || 'Close sidebar');
  }
};

/** Closes the sidebar if it is open. */
WindowController.prototype.closeSidebar = function() {
  this.settings_.set('sidebaropen', false);
  var sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.style.width = '0px';
    sidebar.style.borderRightWidth = '0px';
  }
  var toggleBtn = document.getElementById('toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.setAttribute('title', chrome.i18n.getMessage('openSidebarButton') || 'Open sidebar');
  }
};

WindowController.prototype.toggleSidebar_ = function() {
  var sidebar = document.getElementById('sidebar');
  var isOpen = !!this.settings_.get('sidebaropen');
  if (sidebar && parseInt(sidebar.style.width || '0', 10) > 0) {
    isOpen = true;
  }
  if (isOpen) {
    this.closeSidebar();
  } else {
    this.openSidebar();
  }
};

WindowController.prototype.ensureAutosaveIndicatorDom_ = function() {
  var container = document.getElementById('title-filename');
  if (!container) return;

  var indicator = document.getElementById('autosave-indicator');
  var textSpan = document.getElementById('title-filename-text');

  if (!indicator) {
    indicator = document.createElement('button');
    indicator.id = 'autosave-indicator';
    indicator.className = 'autosave-indicator';
    indicator.style.display = 'none';
    indicator.setAttribute('aria-label', 'Autosave status');

    var icon = document.createElement('img');
    icon.id = 'autosave-indicator-icon';
    icon.className = 'autosave-indicator-icon';
    icon.src = 'assets/autosaved.svg';
    icon.alt = 'Autosave status';
    indicator.appendChild(icon);

    if (container.firstChild) {
      container.insertBefore(indicator, container.firstChild);
    } else {
      container.appendChild(indicator);
    }
  }

  if (!textSpan) {
    textSpan = document.createElement('span');
    textSpan.id = 'title-filename-text';
    container.appendChild(textSpan);
  }

  indicator.onclick = this.onAutosaveIndicatorClick_.bind(this);
};

WindowController.prototype.setTitleText_ = function(text) {
  this.ensureAutosaveIndicatorDom_();
  var textSpan = document.getElementById('title-filename-text');
  if (textSpan) {
    textSpan.textContent = text;
  }
};

WindowController.prototype.onAutosaveIndicatorClick_ = function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  var currentTab = this.tabs_.getCurrentTab();
  if (!currentTab) return;

  if (!currentTab.isSaved() || currentTab.isMissing() || currentTab.saveError_) {
    this.tabs_.save(currentTab);
  }
};

WindowController.prototype.updateAutosaveIndicator_ = function() {
  this.ensureAutosaveIndicatorDom_();
  var indicator = document.getElementById('autosave-indicator');
  var icon = document.getElementById('autosave-indicator-icon');
  if (!indicator || !icon) return;

  var currentTab = this.tabs_.getCurrentTab();
  if (!currentTab) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = '';
  indicator.className = 'autosave-indicator';

  if (currentTab.isMissing()) {
    indicator.classList.add('status-missing');
    icon.setAttribute('src', 'assets/sync_error.svg');
    indicator.setAttribute('title', chrome.i18n.getMessage('missingFileIndicator') || 'File is missing in location - click to Save As');
    indicator.setAttribute('aria-label', 'File missing in location');
  } else if (currentTab.saveError_) {
    indicator.classList.add('status-error');
    icon.setAttribute('src', 'assets/sync_error.svg');
    indicator.setAttribute('title', chrome.i18n.getMessage('saveErrorIndicator') || 'Error saving changes - click to retry');
    indicator.setAttribute('aria-label', 'Error saving changes');
  } else if (currentTab.isSaving_ || currentTab.autoSaveTimeout_) {
    indicator.classList.add('status-saving');
    icon.setAttribute('src', 'assets/auto_saving.svg');
    indicator.setAttribute('title', chrome.i18n.getMessage('savingIndicator') || 'Saving changes...');
    indicator.setAttribute('aria-label', 'Saving changes');
  } else if (currentTab.isSaved()) {
    indicator.classList.add('status-saved');
    icon.setAttribute('src', 'assets/autosaved.svg');
    indicator.setAttribute('title', chrome.i18n.getMessage('savedIndicator') || 'All changes saved');
    indicator.setAttribute('aria-label', 'All changes saved');
  } else {
    indicator.classList.add('status-unsaved');
    icon.setAttribute('src', 'assets/save.svg');
    indicator.setAttribute('title', chrome.i18n.getMessage('unsavedIndicator') || 'Unsaved changes - click to save');
    indicator.setAttribute('aria-label', 'Unsaved changes');
  }
};

WindowController.prototype.onLoadingFile = function(e) {
  this.setTitleText_(chrome.i18n.getMessage('loadingTitle'));
  var indicator = document.getElementById('autosave-indicator');
  if (indicator) indicator.style.display = 'none';
};

WindowController.prototype.onFileSystemError = function(e) {
  this.setTitleText_(chrome.i18n.getMessage('errorTitle'));
  var indicator = document.getElementById('autosave-indicator');
  if (indicator) indicator.style.display = 'none';
};

WindowController.prototype.onChangeTab_ = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (tab) {
    this.setTitleText_(tab.getName());
    this.onTabPathChange(opt_e, tab);
  }
  this.onTabChange_();
};

WindowController.prototype.onTabPathChange = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  var path = (tab && tab.getPath()) || '';
  if (tab && tab.isMissing()) {
    path = path ? (path + ' (File missing)') : 'File missing';
  }
  var titleEl = document.getElementById('title-filename');
  if (titleEl) titleEl.setAttribute('title', path);
};

WindowController.prototype.onTabChange_ = function(opt_e, opt_tab) {
  var currentTab = this.tabs_.getCurrentTab();
  var titleEl = document.getElementById('title-filename');
  if (titleEl) {
    if (currentTab && currentTab.isSaved()) {
      titleEl.classList.remove('unsaved');
    } else {
      titleEl.classList.add('unsaved');
    }
  }
  this.updateAutosaveIndicator_();
};

WindowController.prototype.onTabMissingChange_ = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  this.onTabPathChange(opt_e, tab);
  this.updateAutosaveIndicator_();
};

WindowController.prototype.onSettingsChange_ = function(e, key, value) {
  if (key === 'autosave') {
    this.updateAutosaveIndicator_();
  }
};

WindowController.prototype.resizeStart_ = function(e) {
  this.resizeMouseStartX_ = e.clientX;
  var sidebar = document.getElementById('sidebar');
  this.resizeStartWidth_ = sidebar ? parseInt(window.getComputedStyle(sidebar).width, 10) : 220;
  this.boundResizeOnMouseMove_ = this.resizeOnMouseMove_.bind(this);
  this.boundResizeFinish_ = this.resizeFinish_.bind(this);
  document.addEventListener('mousemove', this.boundResizeOnMouseMove_);
  document.addEventListener('mouseup', this.boundResizeFinish_);
  document.body.style.cursor = 'e-resize';
  if (sidebar) sidebar.style.transition = 'none';
};

WindowController.prototype.resizeOnMouseMove_ = function(e) {
  var change = e.clientX - this.resizeMouseStartX_;
  var sidebarWidth = this.resizeStartWidth_ + change;
  if (sidebarWidth < 20) sidebarWidth = 20;
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.width = sidebarWidth + 'px';
  return sidebarWidth;
};

WindowController.prototype.resizeFinish_ = function(e) {
  var sidebarWidth = this.resizeOnMouseMove_(e);
  this.settings_.set('sidebarwidth', sidebarWidth);
  document.removeEventListener('mousemove', this.boundResizeOnMouseMove_);
  document.removeEventListener('mouseup', this.boundResizeFinish_);
  document.body.style.cursor = '';
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.transition = 'width 0.2s ease-in-out';
};

WindowController.prototype.updateSidebarVisibility_ = function() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (parseInt(sidebar.style.width || '0', 10) === 0 || sidebar.offsetWidth === 0) {
    sidebar.style.visibility = 'hidden';
  } else {
    sidebar.style.visibility = 'visible';
  }
};

WindowController.prototype.onError_ = function(event) {
  var message = (event && event.message) || (event && event.originalEvent && event.originalEvent.message);
  var errorStack = (event && event.error && event.error.stack) || (event && event.originalEvent && event.originalEvent.error && event.originalEvent.error.stack);
};

/**
 * Initializes drag and drop file opening listeners.
 * @private
 */
WindowController.prototype.initFileDrop_ = function() {
  var self = this;
  var dragCounter = 0;

  var overlay = document.getElementById('drag-drop-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'drag-drop-overlay';
    overlay.className = 'drag-drop-overlay';

    var content = document.createElement('div');
    content.className = 'drag-drop-content';

    var icon = document.createElement('span');
    icon.className = 'material-icons drag-drop-icon';
    icon.textContent = 'note_add';

    var text = document.createElement('span');
    text.className = 'drag-drop-text';
    text.textContent = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('dropFilesToOpen')) || 'Drop files here to open';

    content.appendChild(icon);
    content.appendChild(text);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  window.addEventListener('dragenter', function(e) {
    if (self.isDraggingFiles_(e)) {
      dragCounter++;
      overlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', function(e) {
    if (self.isDraggingFiles_(e)) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      overlay.classList.add('active');
    }
  });

  window.addEventListener('dragleave', function(e) {
    if (self.isDraggingFiles_(e)) {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('active');
      }
    }
  });

  window.addEventListener('drop', function(e) {
    if (!self.isDraggingFiles_(e)) return;
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');

    self.handleDroppedFiles_(e.dataTransfer);
  });
};

/**
 * Checks whether a drag event contains external files (not internal tab dragging).
 * @param {DragEvent} e
 * @return {boolean}
 * @private
 */
WindowController.prototype.isDraggingFiles_ = function(e) {
  if (!e || !e.dataTransfer) return false;
  var types = e.dataTransfer.types;
  if (!types) return false;
  // If tabs are being dragged internally, don't trigger file drop
  if (document.querySelector('#tabs-list li.dragging')) {
    return false;
  }
  for (var i = 0; i < types.length; i++) {
    if (types[i] === 'Files' || types[i] === 'public.file-url') return true;
  }
  return false;
};

/**
 * Handles dropped files via File System Access API or HTML5 Files fallback.
 * @param {DataTransfer} dataTransfer
 * @private
 */
WindowController.prototype.handleDroppedFiles_ = async function(dataTransfer) {
  if (!dataTransfer) return;

  var entries = [];

  // Modern Chromium: File System Access API from drag and drop
  if (dataTransfer.items && dataTransfer.items.length > 0 && typeof dataTransfer.items[0].getAsFileSystemHandle === 'function') {
    for (var i = 0; i < dataTransfer.items.length; i++) {
      var item = dataTransfer.items[i];
      if (item.kind === 'file') {
        try {
          var handle = await item.getAsFileSystemHandle();
          if (handle && handle.kind === 'file') {
            entries.push(new window.FileEntryPolyfill(handle));
          }
        } catch (err) {
          console.warn('Could not get FileSystemHandle from drop item:', err);
        }
      }
    }
  }

  if (entries.length > 0) {
    for (var j = 0; j < entries.length; j++) {
      this.tabs_.openFileEntry(entries[j]);
    }
    return;
  }

  // Fallback for Safari/Firefox or when getAsFileSystemHandle is unsupported
  var files = dataTransfer.files;
  if (files && files.length > 0) {
    for (var k = 0; k < files.length; k++) {
      this.openDroppedFileFallback_(files[k]);
    }
  }
};

/**
 * Fallback to read and open a dropped File object.
 * @param {File} file
 * @private
 */
WindowController.prototype.openDroppedFileFallback_ = function(file) {
  if (!file) return;
  var self = this;
  var reader = new FileReader();
  reader.onload = function(e) {
    var content = e.target.result;
    var entry = new window.FileEntryPolyfill(null, null, file, file.name);
    var tab = self.tabs_.newTab(content, entry, false, file.name);
    tab.lineEndings_ = util.guessLineEndings(content);
    tab.lastModified_ = file.lastModified;

    // If there was only 1 blank Untitled tab before opening, close it
    if (self.tabs_.tabs_.length === 2 &&
        !self.tabs_.tabs_[0].getEntry() &&
        self.tabs_.tabs_[0].isSaved() &&
        self.tabs_.tabs_[0].getName().indexOf('Untitled ') === 0 &&
        self.tabs_.tabs_[0].getContent_() === '') {
      self.tabs_.close(self.tabs_.tabs_[0].getId());
    }
  };
  reader.readAsText(file);
};
