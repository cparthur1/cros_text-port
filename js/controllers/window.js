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
    $(minimizeButton).click(this.minimize_.bind(this));
  }
  var maximizeButton = document.getElementById('window-maximize');
  if (maximizeButton) {
    $(maximizeButton).click(this.maximize_.bind(this));
  }
  $('#toggle-sidebar').click(this.toggleSidebar_.bind(this));
  $('#sidebar').on('transitionend', this.updateSidebarVisibility_.bind(this));
  $('#sidebar-resizer').mousedown(this.resizeStart_.bind(this));
  $(window).bind('error', this.onError_.bind(this));
  $(document).bind('filesystemerror', this.onFileSystemError.bind(this));
  $(document).bind('loadingfile', this.onLoadingFile.bind(this));
  $(document).bind('switchtab', this.onChangeTab_.bind(this));
  $(document).bind('tabchange', this.onTabChange_.bind(this));
  $(document).bind('tabpathchange', this.onTabPathChange.bind(this));
  $(document).bind('tabrenamed', this.onChangeTab_.bind(this));
  $(document).bind('tabsave', this.onTabChange_.bind(this));
  $(document).bind('tabsaving', this.updateAutosaveIndicator_.bind(this));
  $(document).bind('tabsaveerror', this.updateAutosaveIndicator_.bind(this));
  $(document).bind('tabmissingchange', this.onTabMissingChange_.bind(this));
  $(document).bind('settingschange', this.onSettingsChange_.bind(this));

  this.ensureAutosaveIndicatorDom_();
  this.initFileDrop_();
  this.initUI_();
}

/**
 * Performs all the required initialization for the UI.
 * @private
 */
WindowController.prototype.initUI_ = function() {
  for (const element of document.querySelectorAll('.mdc-icon-button')) {
    const ripple = mdc.ripple.MDCRipple.attachTo(element);
    ripple.unbounded = true;
    // Required due to issue
    // https://github.com/material-components/material-components-web/issues/3984
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
    $(document).bind('settingsready', this.initSidebar_.bind(this));
  }
};

WindowController.prototype.initSidebar_ = function() {
  // FIXME: move this to CSS where possible (init code)
  if (this.settings_.get('sidebaropen')) {
    $('#sidebar').css('width', this.settings_.get('sidebarwidth') + 'px');
    $('#sidebar').css('border-right-width', '2px');
    $('#toggle-sidebar')
        .attr('title', chrome.i18n.getMessage('closeSidebarButton'));
  } else {
    $('#sidebar').css('width', '0');
    $('#sidebar').css('border-right-width', '0');
    $('#toggle-sidebar')
        .attr('title', chrome.i18n.getMessage('openSidebarButton'));
  }
  this.updateSidebarVisibility_();
};

WindowController.prototype.windowControlsVisible = function(show) {
  if (show) {
    $('header').removeClass('hide-controls');
  } else {
    $('header').addClass('hide-controls');
  }
};

/**
 * @param {string} theme
 */
WindowController.prototype.setTheme = function(theme) {
  $('body').attr('theme', theme);
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

  if (maximized) {
    window.chrome.app.window.current().restore();
    $('#window-maximize')
        .attr('title', chrome.i18n.getMessage('maximizeButton'));
  } else {
    window.chrome.app.window.current().maximize();
    $('#window-maximize')
        .attr('title', chrome.i18n.getMessage('restoreButton'));
  }
};

WindowController.prototype.setAlwaysOnTop = function(isAlwaysOnTop) {
  window.chrome.app.window.current().setAlwaysOnTop(isAlwaysOnTop);
};

/** Opens the sidebar if it is closed. */
WindowController.prototype.openSidebar = function() {
  if (this.settings_.get('sidebaropen')) return;
  this.settings_.set('sidebaropen', true);
    $('#sidebar').css('width', this.settings_.get('sidebarwidth') + 'px');
    $('#sidebar').css('border-right-width', '2px');
    $('#sidebar').css('visibility', 'visible');
    $('#toggle-sidebar')
        .attr('title', chrome.i18n.getMessage('closeSidebarButton'));
};

WindowController.prototype.toggleSidebar_ = function() {
  // FIXME: Move this to css where possible (toggle code)
  if (this.settings_.get('sidebaropen')) {
    this.settings_.set('sidebaropen', false);
    $('#sidebar').css('width', '0');
    $('#sidebar').css('border-right-width', '0');
    $('#toggle-sidebar')
        .attr('title', chrome.i18n.getMessage('openSidebarButton'));
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
  var indicator = $('#autosave-indicator');
  var icon = $('#autosave-indicator-icon');
  if (!indicator.length || !icon.length) return;

  var currentTab = this.tabs_.getCurrentTab();
  if (!currentTab) {
    indicator.hide();
    return;
  }

  indicator.show();
  indicator.removeClass('status-saved status-saving status-unsaved status-error status-missing');

  if (currentTab.isMissing()) {
    indicator.addClass('status-missing');
    icon.attr('src', 'assets/sync_error.svg');
    indicator.attr('title', chrome.i18n.getMessage('missingFileIndicator') || 'File is missing in location - click to Save As');
    indicator.attr('aria-label', 'File missing in location');
  } else if (currentTab.saveError_) {
    indicator.addClass('status-error');
    icon.attr('src', 'assets/sync_error.svg');
    indicator.attr('title', chrome.i18n.getMessage('saveErrorIndicator') || 'Error saving changes - click to retry');
    indicator.attr('aria-label', 'Error saving changes');
  } else if (currentTab.isSaving_ || currentTab.autoSaveTimeout_) {
    indicator.addClass('status-saving');
    icon.attr('src', 'assets/auto_saving.svg');
    indicator.attr('title', chrome.i18n.getMessage('savingIndicator') || 'Saving changes...');
    indicator.attr('aria-label', 'Saving changes');
  } else if (currentTab.isSaved()) {
    indicator.addClass('status-saved');
    icon.attr('src', 'assets/autosaved.svg');
    indicator.attr('title', chrome.i18n.getMessage('savedIndicator') || 'All changes saved');
    indicator.attr('aria-label', 'All changes saved');
  } else {
    indicator.addClass('status-unsaved');
    icon.attr('src', 'assets/save.svg');
    indicator.attr('title', chrome.i18n.getMessage('unsavedIndicator') || 'Unsaved changes - click to save');
    indicator.attr('aria-label', 'Unsaved changes');
  }
};

WindowController.prototype.onLoadingFile = function(e) {
  this.setTitleText_(chrome.i18n.getMessage('loadingTitle'));
  $('#autosave-indicator').hide();
};

WindowController.prototype.onFileSystemError = function(e) {
  this.setTitleText_(chrome.i18n.getMessage('errorTitle'));
  $('#autosave-indicator').hide();
};

WindowController.prototype.onChangeTab_ = function(e, tab) {
  if (tab) {
    this.setTitleText_(tab.getName());
    this.onTabPathChange(e, tab);
  }
  this.onTabChange_();
};

WindowController.prototype.onTabPathChange = function(e, tab) {
  var path = (tab && tab.getPath()) || '';
  if (tab && tab.isMissing()) {
    path = path ? (path + ' (File missing)') : 'File missing';
  }
  $('#title-filename').attr('title', path);
};

WindowController.prototype.onTabChange_ = function(e, tab) {
  var currentTab = this.tabs_.getCurrentTab();
  if (currentTab && currentTab.isSaved()) {
    $('#title-filename').removeClass('unsaved');
  } else {
    $('#title-filename').addClass('unsaved');
  }
  this.updateAutosaveIndicator_();
};

WindowController.prototype.onTabMissingChange_ = function(e, tab) {
  this.onTabPathChange(e, tab);
  this.updateAutosaveIndicator_();
};

WindowController.prototype.onSettingsChange_ = function(e, key, value) {
  if (key === 'autosave') {
    this.updateAutosaveIndicator_();
  }
};

WindowController.prototype.resizeStart_ = function(e) {
  this.resizeMouseStartX_ = e.clientX;
  this.resizeStartWidth_ = parseInt($('#sidebar').css('width'), 10);
  $(document).on('mousemove.sidebar', this.resizeOnMouseMove_.bind(this));
  $(document).on('mouseup.sidebar', this.resizeFinish_.bind(this));
  $(document).css('cursor', 'e-resize !important');
  $('#sidebar').css('-webkit-transition', 'none');
};

WindowController.prototype.resizeOnMouseMove_ = function(e) {
  var change = e.clientX - this.resizeMouseStartX_;
  var sidebarWidth = this.resizeStartWidth_ + change;
  if (sidebarWidth < 20) sidebarWidth = 20;
  $('#sidebar').css('width', sidebarWidth + 'px');
  return sidebarWidth;
};

WindowController.prototype.resizeFinish_ = function(e) {
  var sidebarWidth = this.resizeOnMouseMove_(e);
  this.settings_.set('sidebarwidth', sidebarWidth);
  $(document).off('mousemove.sidebar');
  $(document).off('mouseup.sidebar');
  $(document).css('cursor', 'default');
  $('#sidebar').css('-webkit-transition', 'width 0.2s ease-in-out');
};

WindowController.prototype.updateSidebarVisibility_ = function() {
  const sidebar = $('#sidebar');
  if (sidebar.width() === 0) {
    sidebar.css('visibility', 'hidden');
  } else {
    sidebar.css('visibility', 'visible');
  }
};

WindowController.prototype.onError_ = function(event) {
  var message = event.originalEvent.message;
  var errorStack = event.originalEvent.error.stack;
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
    if (types[i] === 'Files') return true;
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
    var tab = self.tabs_.newTab(content, null, false, file.name);
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
