/**
 * @constructor
 * @param {number} id
 * @param {window.CodeMirror.state.EditorState} session Edit session.
 * @param {string} lineEndings What character(s) to use as the line ending.
 * @param {FileEntry} entry
 */
function Tab(id, session, lineEndings, entry, dialogController, opt_isMissing, opt_cachedName, opt_cachedPath) {
  this.id_ = id;
  /** @type {window.CodeMirror.state.EditorState} */
  this.session_ = session;
  /** @type {string} Separator between lines. */
  this.lineEndings_ = lineEndings;
  /** @type {FileEntry} */
  this.entry_ = entry;
  this.saved_ = true;
  this.path_ = opt_cachedPath || null;
  this.name_ = opt_cachedName || null;
  this.isMissing_ = !!opt_isMissing;
  this.dialogController_ = dialogController;
  this.autoSaveTimeout_ = null;
  this.isSaving_ = false;
  this.savePending_ = false;
  this.pendingSaveCallbacks_ = [];
  this.handleId_ = (entry && entry.handleId) || null;
  if (this.entry_) {
    this.updatePath_();
    if (this.entry_.isMissing) {
      this.isMissing_ = true;
    }
  }
};

Tab.prototype.getId = function() {
  return this.id_;
};

Tab.prototype.getName = function() {
  if (this.entry_ && this.entry_.name) {
    return this.entry_.name;
  } else if (this.name_) {
    return this.name_;
  } else {
    // TODO: i18n 'Untitled' text
    return 'Untitled ' + this.id_;
  }
};

Tab.prototype.isMissing = function() {
  return !!this.isMissing_;
};

Tab.prototype.setMissing = function(isMissing) {
  if (this.isMissing_ !== isMissing) {
    this.isMissing_ = isMissing;
    $.event.trigger('tabmissingchange', this);
    $.event.trigger('tabrenamed', this);
  }
};

/**
 * @return {string?} Filename extension or null.
 */
Tab.prototype.getExtension = function() {
  var name = this.getName();
  if (!name || name.indexOf('Untitled ') === 0)
    return null;

  return util.getExtension(name);
};

Tab.prototype.getSession = function() {
  return this.session_;
};

Tab.prototype.setSession = function(session) {
  return this.session_ = session;
};

/**
 * @param {FileEntry} entry
 */
Tab.prototype.setEntry = function(entry) {
  var nameChanged = this.getName() != (entry ? entry.name : '');
  this.entry_ = entry;
  if (entry) {
    this.handleId_ = entry.handleId || this.handleId_;
    if (!entry.isMissing) {
      this.setMissing(false);
    }
  }
  if (nameChanged)
    $.event.trigger('tabrenamed', this);
  this.updatePath_();
};

Tab.prototype.getEntry = function() {
  return this.entry_;
};

Tab.prototype.getPath = function() {
  return this.path_;
};

Tab.prototype.updatePath_ = function() {
  if (!this.entry_) return;
  chrome.fileSystem.getDisplayPath(this.entry_, function(path) {
    this.path_ = path;
    $.event.trigger('tabpathchange', this);
  }.bind(this));
};

/** Get the contents of the file in the tab. */
Tab.prototype.getContent_ = function() {
  // Files with mixed line endings will get normalized to whatever we guessed.
  // We could set the EditorState.lineSeparator facet to make round-trips work,
  // but other GUI Linux text editors also seem to normalize.
  return this.session_.doc.toString().split('\n').join(this.lineEndings_);
};

Tab.prototype.save = function(opt_callbackDone, opt_isAutosave) {
  if (this.autoSaveTimeout_) {
    clearTimeout(this.autoSaveTimeout_);
    this.autoSaveTimeout_ = null;
  }

  if (this.isSaving_) {
    this.savePending_ = true;
    if (opt_callbackDone) {
      this.pendingSaveCallbacks_.push(opt_callbackDone);
    }
    return;
  }

  this.isSaving_ = true;
  this.saveError_ = false;
  $.event.trigger('tabsaving', this);
  var contentToSave = this.getContent_();

  util.writeFile(
    this.entry_, contentToSave,
    function() {
      this.isSaving_ = false;
      this.saveError_ = false;

      var callbacks = this.pendingSaveCallbacks_.slice();
      this.pendingSaveCallbacks_ = [];
      if (opt_callbackDone) {
        callbacks.push(opt_callbackDone);
      }

      if (this.savePending_) {
        this.savePending_ = false;
        this.save(function() {
          callbacks.forEach(function(cb) { cb(); });
        }, opt_isAutosave);
      } else {
        if (this.getContent_() === contentToSave) {
          this.saved_ = true;
          $.event.trigger('tabsave', this);
        }
        callbacks.forEach(function(cb) { cb(); });
      }
    }.bind(this),
    function(e) {
      this.isSaving_ = false;
      this.savePending_ = false;
      this.saveError_ = true;
      $.event.trigger('tabsaveerror', this);
      var callbacks = this.pendingSaveCallbacks_.slice();
      this.pendingSaveCallbacks_ = [];

      if (!opt_isAutosave) {
        this.reportWriteError_(e);
      } else {
        console.warn('Autosave error for ' + this.getName() + ':', e);
      }

      callbacks.forEach(function(cb) { cb(); });
    }.bind(this));
};

Tab.prototype.reportWriteError_ = function(e) {
  this.dialogController_.setText(
      // TODO: Replace this with i18n message
      'Error saving file: ' + util.fsErrorStr(e));
  this.dialogController_.resetButtons();
  this.dialogController_.addButton('ok',
      chrome.i18n.getMessage('okDialogButton'));
  this.dialogController_.show();
};

Tab.prototype.isSaved = function() {
  return this.saved_;
};

Tab.prototype.changed = function() {
  this.saveError_ = false;
  if (this.saved_) {
    this.saved_ = false;
    $.event.trigger('tabchange', this);
  }
};


/**
 * @constructor
 * @param {EditorCodeMirror} editor
 */
function Tabs(editor, dialogController, settings) {
  /** @type {EditorCodeMirror} */
  this.editor_ = editor;
  this.dialogController_ = dialogController;
  this.settings_ = settings;
  /** @type {Tab[]} */
  this.tabs_ = [];
  /** @type {Tab|null} Current selected tab, or initially null. */
  this.currentTab_ = null;

  this.sessionSaveTimeout_ = null;

  $(document).bind('docchange', this.onDocChanged_.bind(this));
  $(document).bind('settingschange', this.onSettingsChanged_.bind(this));
  $(window).bind('blur', this.onWindowBlur_.bind(this));
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      this.saveSession_();
      this.onWindowBlur_();
    }
  }.bind(this));
  window.addEventListener('beforeunload', function(e) {
    this.saveSession_();
    if (this.settings_.get('autosave')) {
      this.onWindowBlur_();
    }
    if (this.hasUnsavedTabs()) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  }.bind(this));
}

/**
 * @type {Object} params
 * @type {function(FileEntry)} callback
 * Open a file in the system file picker. The FileEntry is copied to be stored
 * in background page, so it isn't destroyed when the window is closed.
 */
Tabs.prototype.chooseEntry = function(params, callback) {
  // TODO: Remove this when crbug.com/326523 is fixed.
  if (params.acceptsMultiple) {
    console.error('acceptsMultiple is not supported when saving a file');
    return;
  }
  chrome.fileSystem.chooseEntry(
      params,
      function(entry) {
        if (entry) {
          chrome.runtime.getBackgroundPage(function(bg) {
            bg.background.copyFileEntry(entry, callback);
          });
        }
      });
};

/**
 * @type {Object} params
 * @type {function(FileEntry)} callback
 * @type {function()} opt_oncancel
 * Open one or multiple files in the system file picker. File Entries are
 * copied to be stored in background page, so they aren't destroyed when the
 * window is closed. Callback is called once for each File Entry.
 */
Tabs.prototype.chooseEntries = function(params, callback, opt_oncancel) {
  params.acceptsMultiple = true;
  chrome.fileSystem.chooseEntry(
      params,
      function(entries) {
        if (entries) {
          chrome.runtime.getBackgroundPage(function(bg) {
            for (var i = 0; i < entries.length; i++)
              bg.background.copyFileEntry(entries[i], callback);
          });
        } else {
          if (opt_oncancel)
            opt_oncancel();
        }
      });
};

Tabs.prototype.getTabById = function(id) {
  for (var i = 0; i < this.tabs_.length; i++) {
    if (this.tabs_[i].getId() === id)
      return this.tabs_[i];
  }
  return null;
};

Tabs.prototype.getCurrentTab = function() {
  return this.currentTab_;
};

Tabs.prototype.newWindow = function() {
  chrome.runtime.getBackgroundPage(function(bg) {
    bg.background.newWindow();
  }.bind(this));
};

/**
 * Add a new tab.
 *
 * @param {?string} opt_content What text content the tab should contain. Otherwise it starts empty.
 */
Tabs.prototype.newTab = function(opt_content, opt_entry, opt_isMissing, opt_cachedName, opt_cachedPath) {
  var id = 1;
  while (this.getTabById(id)) {
    id++;
  }

  var session = this.editor_.newState(opt_content);
  var lineEndings = util.guessLineEndings(opt_content);

  var tab = new Tab(id, session, lineEndings, opt_entry || null,
                    this.dialogController_, opt_isMissing, opt_cachedName, opt_cachedPath);
  this.tabs_.push(tab);
  $.event.trigger('newtab', tab);
  this.showTab(tab.getId());
  this.saveSession_();
  return tab;
};

/**
 * @param {number} oldIndex
 * @param {number} newIndex
 * Move a {Tab} from oldIndex to newIndex
 */
Tabs.prototype.reorder = function (oldIndex, newIndex) {
  this.tabs_.splice(
      newIndex, // specifies at what position to add items
      0, // no items will be removed
      this.tabs_.splice(oldIndex, 1)[0]); // item to be added
  this.saveSession_();
};

Tabs.prototype.getTabIndex = function(tab) {
  for (var i = 0; i < this.tabs_.length; i++) {
    if (this.tabs_[i] === tab)
      return i;
  }
  return -1;
}

Tabs.prototype.previousTab = function() {
  var currentTabIndex = this.getTabIndex(this.currentTab_);
  var previousTabIndex = currentTabIndex - 1;
  if (previousTabIndex < 0)
    previousTabIndex = this.tabs_.length - 1;
  this.showTab(this.tabs_[previousTabIndex].getId());
};

Tabs.prototype.nextTab = function() {
  var currentTabIndex = this.getTabIndex(this.currentTab_);
  var nextTabIndex = currentTabIndex + 1;
  if (nextTabIndex >= this.tabs_.length)
    nextTabIndex = 0;
  this.showTab(this.tabs_[nextTabIndex].getId());
};

Tabs.prototype.showTab = function(tabId) {
  if (this.currentTab_) {
    // Before switching tabs, write the editorView's state to the tab.
    this.updateCurrentTabState_();
    if (this.settings_.get('autosave') && !this.currentTab_.isSaved() && this.currentTab_.getEntry() && !this.currentTab_.isMissing()) {
      if (this.currentTab_.autoSaveTimeout_) {
        clearTimeout(this.currentTab_.autoSaveTimeout_);
        this.currentTab_.autoSaveTimeout_ = null;
      }
      this.save(this.currentTab_, null, true);
    }
  }

  var tab = this.getTabById(tabId);
  if (!tab) {
    console.error('Can\'t find tab', tabId);
    return;
  }
  this.currentTab_ = tab;
  this.editor_.setSession(tab.getSession(), tab.getExtension());
  $.event.trigger('switchtab', tab);
  this.editor_.focus();
  this.saveSession_();
};


Tabs.prototype.close = function(tabId) {
  for (var i = 0; i < this.tabs_.length; i++) {
    if (this.tabs_[i].getId() == tabId)
      break;
  }

  if (i >= this.tabs_.length) {
    console.error('Can\'t find tab', tabId);
    return;
  }

  var tab = this.tabs_[i];

  if (!tab.isSaved()) {
    if (this.settings_.get('autosave') && tab.getEntry() && !tab.isMissing()) {
      if (tab.autoSaveTimeout_) {
        clearTimeout(tab.autoSaveTimeout_);
        tab.autoSaveTimeout_ = null;
      }
      this.save(tab, this.closeTab_.bind(this, tab));
      return;
    }
    this.promptSave_(tab, function(answer) {
      if (answer === 'yes') {
        this.save(tab, this.closeTab_.bind(this, tab));
      } else if (answer === 'no') {
        this.closeTab_(tab);
      }
    }.bind(this));
  } else {
    this.closeTab_(tab);
  }
};

/**
 * @param {Tab} tab
 * Close tab without checking whether it needs to be saved. The safe version
 * (invoking auto-save and, if needed, SaveAs dialog) is Tabs.close().
 */
Tabs.prototype.closeTab_ = function(tab) {
  if (tab === this.currentTab_) {
    if (this.tabs_.length > 1) {
      this.nextTab();
    } else {
      this.newTab();
    }
  }

  for (var i = 0; i < this.tabs_.length; i++) {
    if (this.tabs_[i] === tab)
      break;
  }

  this.tabs_.splice(i, 1);
  $.event.trigger('tabclosed', tab);
  this.saveSession_();
};

/**
 * This is needed because EditorState is immutable. So if you open a tab and
 * edit the contents, the EditorView's state won't match the tab's session state.
 */
Tabs.prototype.updateCurrentTabState_ = function() {
  if (!this.currentTab_) return;
  this.currentTab_.setSession(this.editor_.editorView_.state);
}

Tabs.prototype.closeCurrent = function() {
  this.close(this.currentTab_.getId());
};

Tabs.prototype.openFiles = function() {
  this.chooseEntries(
      {'type': 'openWritableFile'},
      this.openFileEntry.bind(this));
};

/**
 * @param {function()} callback
 * Invoke the save dialog for all tabs with unsaved progress. Does not close any tabs.
 */
Tabs.prototype.promptAllUnsaved = function(callback) {
  this.promptAllUnsavedFromIndex_(0, callback);
};

Tabs.prototype.promptAllUnsavedFromIndex_ = function(i, callback) {
  if (i >= this.tabs_.length) {
    callback();
    return;
  }

  var tab = this.tabs_[i];
  if (tab.isSaved()) {
    this.promptAllUnsavedFromIndex_(i + 1, callback);
  } else if (this.settings_.get('autosave') && tab.getEntry()) {
    if (tab.autoSaveTimeout_) {
      clearTimeout(tab.autoSaveTimeout_);
      tab.autoSaveTimeout_ = null;
    }
    this.save(tab, this.promptAllUnsavedFromIndex_.bind(this, i + 1, callback));
  } else {
    this.showTab(this.tabs_[i].getId());
    this.promptSave_(tab, function(answer) {
      if (answer === 'yes') {
        this.save(
          tab, this.promptAllUnsavedFromIndex_.bind(this, i + 1, callback));
      } else if (answer === 'no') {
        this.promptAllUnsavedFromIndex_(i + 1, callback);
      }
    }.bind(this));
  }
};

/**
 * Prompts the user if they want to save a file.
 * @param {!Tab} tab The tab corresponding to the file to be saved.
 * @param {function(string)} callbackShowDialog Called when the save dialog box
 *     is resolved. Takes as an argument string corresponding to the dialog
 *     button selected by the user.
 */
Tabs.prototype.promptSave_ = function(tab, callbackShowDialog) {
  this.dialogController_.setText(
      chrome.i18n.getMessage('saveFilePromptLine1', tab.getName()),
      chrome.i18n.getMessage('saveFilePromptLine2')
  );
  this.dialogController_.resetButtons();
  this.dialogController_.addButton('yes',
      chrome.i18n.getMessage('yesDialogButton'));
  this.dialogController_.addButton('no',
      chrome.i18n.getMessage('noDialogButton'));
  this.dialogController_.addButton('cancel',
      chrome.i18n.getMessage('cancelDialogButton'));
  this.dialogController_.show(callbackShowDialog);
};

/**
 * Save opt_tab, or the current tab if no opt_tab is passed.
 * @param {?Tab=} opt_tab Optional tab to save.
 * @param {function()=} opt_callback
 * @param {boolean=} opt_isAutosave
 */
Tabs.prototype.save = function(opt_tab, opt_callback, opt_isAutosave) {
  var tab = opt_tab || this.currentTab_;
  if (!tab) return;

  // Clear any scheduled autosave timer for this tab.
  if (tab.autoSaveTimeout_) {
    clearTimeout(tab.autoSaveTimeout_);
    tab.autoSaveTimeout_ = null;
  }

  // Update the tab's editorState if it's the current tab.
  if (tab === this.currentTab_) {
    this.updateCurrentTabState_();
  }

  if (tab.getEntry() && !tab.isMissing()) {
    tab.save(opt_callback, opt_isAutosave);
  } else if (!opt_isAutosave) {
    this.saveAs(tab, opt_callback);
  }
};

/**
 * Save opt_tab as a new file, or the current tab if no opt_tab is passed.
 * @param {?Tab=} opt_tab
 * @param {function()=} opt_callback
 */
Tabs.prototype.saveAs = function(opt_tab, opt_callback) {
  var tab = opt_tab || this.currentTab_;
  if (tab && tab === this.currentTab_) {
    this.updateCurrentTabState_();
  }

  var suggestedName = (!tab.isMissing() && tab.getEntry() && tab.getEntry().name) ||
                      util.sanitizeFileName(tab.session_.doc.line(1).text) ||
                      tab.getName();

  if (!util.getExtension(suggestedName)) {
      suggestedName += '.txt';
  }
  this.chooseEntry(
      {'type': 'saveFile', 'suggestedName': suggestedName},
      function(entry) {
        this.saveEntry_(tab, entry, opt_callback);
        if (opt_callback) {
          opt_callback();
        }
      }.bind(this));
};

/**
 * @return {Array.<FileEntry>}
 */
Tabs.prototype.getFilesToRetain = function() {
  var toRetain = [];

  for (i = 0; i < this.tabs_.length; i++) {
    if (this.tabs_[i].getEntry() && !this.tabs_[i].isMissing()) {
      toRetain.push(this.tabs_[i].getEntry());
    }
  }

  return toRetain;
};

Tabs.prototype.openFileEntry = function(entry) {
  if (!entry) return;
  chrome.fileSystem.getDisplayPath(entry, function(path) {
    for (var i = 0; i < this.tabs_.length; i++) {
      if (this.tabs_[i].getPath() === path) {
        this.showTab(this.tabs_[i].getId());
        return;
      }
    }

    entry.file(this.readFileToNewTab_.bind(this, entry));
  }.bind(this));
};

/**
 * Sets the mode for a tab depending on its extension.
 *
 * @param {Tab} tab The tab corresponding to the file to be saved.
 */
Tabs.prototype.modeAutoSet = function(tab) {
  // Only set the mode if it's the current tab. The mode for non-current tabs
  // will update when they become the current tab.
  if (tab !== this.currentTab_) return;
  var extension = tab.getExtension();
  if (extension) {
    this.editor_.updateMode(extension);
  }
};

Tabs.prototype.readFileToNewTab_ = function(entry, file) {
  $.event.trigger('loadingfile');
  var self = this;
  if (!file) {
    self.newTab('', entry, true, entry ? entry.name : 'Unknown');
    return;
  }
  var reader = new FileReader();
  reader.onerror = util.handleFSError;
  reader.onloadend = function(e) {
    self.newTab(this.result, entry);
    if (self.tabs_.length === 2 &&
        !self.tabs_[0].getEntry() &&
        self.tabs_[0].isSaved() &&
        self.tabs_[0].getName().indexOf('Untitled ') === 0 &&
        self.tabs_[0].getContent_() === '') {
      self.close(self.tabs_[0].getId());
    }
  };
  reader.readAsText(file);
};

/**
 * @param {!Tab} tab
 * @param {FileEntry} entry
 * @param {function()=} opt_callback
 */
Tabs.prototype.saveEntry_ = function(tab, entry, opt_callback) {
  if (!entry) {
    return;
  }

  tab.setEntry(entry);
  this.save(tab, opt_callback);
  this.saveSession_();
};

/**
 * The event handler for settings changes.
 */
Tabs.prototype.onSettingsChanged_ = function(e, key, value) {
  if (key === 'autosave') {
    if (value) {
      if (this.currentTab_) {
        this.updateCurrentTabState_();
      }
      for (var i = 0; i < this.tabs_.length; i++) {
        if (!this.tabs_[i].isSaved() && this.tabs_[i].getEntry() && !this.tabs_[i].isMissing()) {
          this.save(this.tabs_[i], null, true);
        }
      }
    } else {
      for (var i = 0; i < this.tabs_.length; i++) {
        if (this.tabs_[i].autoSaveTimeout_) {
          clearTimeout(this.tabs_[i].autoSaveTimeout_);
          this.tabs_[i].autoSaveTimeout_ = null;
        }
      }
    }
  }
};

/**
 * Saves all unsaved files on window blur if autosave is enabled.
 */
Tabs.prototype.onWindowBlur_ = function() {
  if (this.settings_.get('autosave')) {
    if (this.currentTab_) {
      this.updateCurrentTabState_();
    }
    for (var i = 0; i < this.tabs_.length; i++) {
      var tab = this.tabs_[i];
      if (!tab.isSaved() && tab.getEntry() && !tab.isMissing()) {
        if (tab.autoSaveTimeout_) {
          clearTimeout(tab.autoSaveTimeout_);
          tab.autoSaveTimeout_ = null;
        }
        this.save(tab, null, true);
      }
    }
  }
};

/**
 * Schedules debounced autosave for a tab.
 * @param {Tab} tab
 */
Tabs.prototype.scheduleAutoSave_ = function(tab) {
  if (!tab || !tab.getEntry() || tab.isMissing()) return;

  if (tab.autoSaveTimeout_) {
    clearTimeout(tab.autoSaveTimeout_);
  }

  $.event.trigger('tabsaving', tab);

  tab.autoSaveTimeout_ = setTimeout(function() {
    tab.autoSaveTimeout_ = null;
    if (!tab.isSaved() && tab.getEntry() && !tab.isMissing()) {
      this.save(tab, null, true);
    }
  }.bind(this), 1000);
};

/**
 * The event handler for the docchange event.
 */
Tabs.prototype.onDocChanged_ = function() {
  if (this.currentTab_) {
    this.updateCurrentTabState_();
    this.currentTab_.changed();
    if (this.settings_.get('autosave')) {
      this.scheduleAutoSave_(this.currentTab_);
    }
    this.scheduleSaveSession_();
  }
};

/**
 * Determines whether any tabs are open.
 * @return {boolean} True if at least one tab is open.
 */
Tabs.prototype.hasOpenTab = function() {
  return !!this.tabs_.length;
};

/**
 * @return {boolean} True if any open tab has unsaved changes.
 */
Tabs.prototype.hasUnsavedTabs = function() {
  for (var i = 0; i < this.tabs_.length; i++) {
    if (!this.tabs_[i].isSaved()) {
      return true;
    }
  }
  return false;
};

Tabs.prototype.scheduleSaveSession_ = function() {
  if (this.sessionSaveTimeout_) {
    clearTimeout(this.sessionSaveTimeout_);
  }
  this.sessionSaveTimeout_ = setTimeout(function() {
    this.sessionSaveTimeout_ = null;
    this.saveSession_();
  }.bind(this), 500);
};

/**
 * Save open tabs state to localStorage.
 */
Tabs.prototype.saveSession_ = function() {
  if (!this.tabs_) return;
  if (this.currentTab_) {
    this.updateCurrentTabState_();
  }
  var tabsData = [];
  for (var i = 0; i < this.tabs_.length; i++) {
    var tab = this.tabs_[i];
    var entry = tab.getEntry();
    var handleId = (entry && entry.handleId) || tab.handleId_ || null;
    if (entry && entry.handleId && entry.handle && window.chrome && window.chrome.fileSystem && window.chrome.fileSystem.storeHandle) {
      window.chrome.fileSystem.storeHandle(entry.handleId, entry.handle);
    }
    var content = '';
    try {
      content = tab.getContent_();
    } catch (e) {
      content = '';
    }

    tabsData.push({
      id: tab.getId(),
      name: tab.getName(),
      path: tab.getPath(),
      hasEntry: !!entry || (tab.isMissing() && tab.getName().indexOf('Untitled ') !== 0),
      handleId: handleId,
      content: (content && content.length < 2000000) ? content : '',
      saved: tab.isSaved(),
      isMissing: tab.isMissing(),
      lineEndings: tab.lineEndings_ || '\n'
    });
  }

  var session = {
    activeTabId: this.currentTab_ ? this.currentTab_.getId() : null,
    tabs: tabsData,
    timestamp: Date.now()
  };

  try {
    localStorage.setItem('textapp_session_tabs', JSON.stringify(session));
  } catch (e) {
    console.warn('Could not save tabs session to localStorage:', e);
  }
};

/**
 * Restore open tabs from previous session stored in localStorage.
 * @return {Promise<boolean>} True if any tabs were restored.
 */
Tabs.prototype.restoreSession_ = async function() {
  if (this.restoringSession_) {
    return false;
  }
  this.restoringSession_ = true;
  try {
    var sessionStr = null;
    try {
      sessionStr = localStorage.getItem('textapp_session_tabs');
    } catch (e) {
      console.warn('Error reading textapp_session_tabs from localStorage:', e);
    }

    if (!sessionStr) {
      return false;
    }

    var session;
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {
      console.warn('Failed to parse textapp_session_tabs:', e);
      return false;
    }

    if (!session || !Array.isArray(session.tabs) || session.tabs.length === 0) {
      return false;
    }

    var activeId = session.activeTabId;

    for (var i = 0; i < session.tabs.length; i++) {
      var tabData = session.tabs[i];
      var entry = null;
      var isMissing = !!tabData.isMissing;
      var content = tabData.content || '';

      if (tabData.hasEntry) {
        if (tabData.handleId && window.chrome && window.chrome.fileSystem && window.chrome.fileSystem.getStoredHandle) {
          try {
            var handle = await window.chrome.fileSystem.getStoredHandle(tabData.handleId);
            if (handle) {
              try {
                var file = await handle.getFile();
                entry = new window.FileEntryPolyfill(handle, tabData.handleId);
                isMissing = false;
                try {
                  content = await file.text();
                } catch (readErr) {
                  console.warn('Could not read file text from handle:', readErr);
                }
              } catch (fileErr) {
                console.warn('File handle getFile failed - file is missing in location:', tabData.path, fileErr);
                isMissing = true;
              }
            } else {
              console.warn('Handle not found in IndexedDB - file is missing in location:', tabData.path);
              isMissing = true;
            }
          } catch (dbErr) {
            console.warn('Error querying file handle in IndexedDB:', dbErr);
            isMissing = true;
          }
        } else {
          isMissing = true;
        }
      }

      var id = tabData.id || 1;
      while (this.getTabById(id)) {
        id++;
      }
      var sessionState = this.editor_.newState(content);
      var lineEndings = tabData.lineEndings || util.guessLineEndings(content);
      var tab = new Tab(id, sessionState, lineEndings, entry, this.dialogController_, isMissing, tabData.name, tabData.path);
      tab.handleId_ = tabData.handleId;
      if (tabData.saved === false) {
        tab.changed();
      }
      this.tabs_.push(tab);
      $.event.trigger('newtab', tab);
    }

    if (activeId && this.getTabById(activeId)) {
      this.showTab(activeId);
    } else if (this.tabs_.length > 0) {
      this.showTab(this.tabs_[0].getId());
    }

    this.saveSession_();
    return true;
  } finally {
    this.restoringSession_ = false;
  }
};
