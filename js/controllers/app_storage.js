/**
 * @fileoverview Controller for In-App WebApp Storage and Unsaved Temp Recovery.
 * Manages:
 * 1. "Save on the app" functionality (up to 5 saved files, max 1MB each).
 * 2. Sidebar App Storage Folder view (list, open, delete, save).
 * 3. Temp save for currently open file that is not autosaved on device storage,
 *    with automatic recovery prompt to fix/save to device storage.
 */

/**
 * @constructor
 * @param {EditorCodeMirror} editor
 * @param {Tabs} tabs
 * @param {DialogController} dialogController
 */
function AppStorageController(editor, tabs, dialogController) {
  this.editor_ = editor;
  this.tabs_ = tabs;
  this.dialogController_ = dialogController;

  this.db_ = null;
  this.dbPromise_ = null;
  this.isFolderOpen_ = false;

  this.tempSaveTimer_ = null;

  this.initElements_();
  this.initDatabase_().then(() => {
    this.updateFolderCount_();
    this.checkTempSaveRecovery_();
  });
  this.bindEvents_();
}

AppStorageController.DB_NAME = 'TextAppStorageDB';
AppStorageController.DB_VERSION = 1;
AppStorageController.STORE_SAVED = 'saved_files';
AppStorageController.STORE_TEMP = 'temp_saves';
AppStorageController.MAX_SAVES = 5;
AppStorageController.MAX_FILE_SIZE = 1048576; // 1 MB (1024 * 1024 bytes)
AppStorageController.TEMP_SAVE_KEY = 'temp_active_tab';

/**
 * Finds and binds sidebar elements.
 * @private
 */
AppStorageController.prototype.initElements_ = function() {
  this.appFolderBtn_ = document.getElementById('file-menu-appfolder');
  this.appFolderItem_ = document.getElementById('app-storage-folder-item');
  this.folderContent_ = document.getElementById('app-storage-folder-content');
  this.fileListEl_ = document.getElementById('app-storage-file-list');
  this.countBadge_ = document.getElementById('app-storage-count');
  this.saveCurrentBtn_ = document.getElementById('app-storage-save-current');

  if (this.appFolderBtn_) {
    this.appFolderBtn_.addEventListener('click', () => this.toggleFolder());
  }

  if (this.saveCurrentBtn_) {
    this.saveCurrentBtn_.addEventListener('click', this.saveActiveTabToApp.bind(this));
  }
};

/**
 * Opens or initializes the IndexedDB database.
 * @return {Promise<IDBDatabase>}
 * @private
 */
AppStorageController.prototype.initDatabase_ = function() {
  if (this.dbPromise_) return this.dbPromise_;

  this.dbPromise_ = new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, using in-memory / fallback storage');
      resolve(null);
      return;
    }

    const req = indexedDB.open(AppStorageController.DB_NAME, AppStorageController.DB_VERSION);

    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(AppStorageController.STORE_SAVED)) {
        db.createObjectStore(AppStorageController.STORE_SAVED, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AppStorageController.STORE_TEMP)) {
        db.createObjectStore(AppStorageController.STORE_TEMP, { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => {
      this.db_ = e.target.result;
      resolve(this.db_);
    };

    req.onerror = (e) => {
      console.error('Failed to open TextAppStorageDB:', e);
      resolve(null);
    };
  });

  return this.dbPromise_;
};

/**
 * Subscribes to editor and tab events for temp saves.
 * @private
 */
AppStorageController.prototype.bindEvents_ = function() {
  document.addEventListener('docchange', this.onDocChange_.bind(this));
  document.addEventListener('tabsave', this.onTabSave_.bind(this));
  document.addEventListener('switchtab', this.onSwitchTab_.bind(this));
  document.addEventListener('tabclosed', this.onTabClosed_.bind(this));
};

/**
 * Formats byte size into human readable string.
 * @param {number} bytes
 * @return {string}
 * @private
 */
AppStorageController.prototype.formatBytes_ = function(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
};

/**
 * Formats a timestamp into a short date string.
 * @param {number} timestamp
 * @return {string}
 * @private
 */
AppStorageController.prototype.formatDate_ = function(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) {
    return timeStr;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
};

/**
 * Retrieves all saved files from IndexedDB.
 * @return {Promise<Array<Object>>}
 */
AppStorageController.prototype.getAllSavedFiles = function() {
  return this.initDatabase_().then((db) => {
    if (!db) {
      const stored = localStorage.getItem('textapp_saved_files_fallback');
      return stored ? JSON.parse(stored) : [];
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(AppStorageController.STORE_SAVED, 'readonly');
        const store = tx.objectStore(AppStorageController.STORE_SAVED);
        const req = store.getAll();
        req.onsuccess = () => {
          const files = req.result || [];
          files.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          resolve(files);
        };
        req.onerror = () => resolve([]);
      } catch (err) {
        console.error('Error getting saved files:', err);
        resolve([]);
      }
    });
  });
};

/**
 * Saves or updates a file in App Storage.
 * @param {string} name
 * @param {string} content
 * @param {string=} opt_id
 * @return {Promise<Object>}
 */
AppStorageController.prototype.putFile = function(name, content, opt_id) {
  const size = new Blob([content]).size;
  if (size > AppStorageController.MAX_FILE_SIZE) {
    return Promise.reject(new Error('File exceeds the 1MB limit for in-app storage. (Size: ' + this.formatBytes_(size) + ')'));
  }

  return this.getAllSavedFiles().then((existingFiles) => {
    const isUpdate = opt_id && existingFiles.some((f) => f.id === opt_id);
    if (!isUpdate && existingFiles.length >= AppStorageController.MAX_SAVES) {
      return Promise.reject(new Error('Storage limit reached: You can save up to 5 files in App Storage. Please delete an existing file to free a slot.'));
    }

    const fileRecord = {
      id: opt_id || ('app_file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
      name: name || 'untitled.txt',
      content: content,
      size: size,
      timestamp: Date.now()
    };

    return this.initDatabase_().then((db) => {
      if (!db) {
        let list = existingFiles.filter((f) => f.id !== fileRecord.id);
        list.unshift(fileRecord);
        localStorage.setItem('textapp_saved_files_fallback', JSON.stringify(list));
        return fileRecord;
      }

      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(AppStorageController.STORE_SAVED, 'readwrite');
          const store = tx.objectStore(AppStorageController.STORE_SAVED);
          store.put(fileRecord);
          tx.oncomplete = () => resolve(fileRecord);
          tx.onerror = (e) => reject(e);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
};

/**
 * Deletes a file by ID from App Storage.
 * @param {string} fileId
 * @return {Promise<void>}
 */
AppStorageController.prototype.deleteFile = function(fileId) {
  return this.initDatabase_().then((db) => {
    if (!db) {
      const stored = localStorage.getItem('textapp_saved_files_fallback');
      if (stored) {
        const list = JSON.parse(stored).filter((f) => f.id !== fileId);
        localStorage.setItem('textapp_saved_files_fallback', JSON.stringify(list));
      }
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(AppStorageController.STORE_SAVED, 'readwrite');
        const store = tx.objectStore(AppStorageController.STORE_SAVED);
        store.delete(fileId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  });
};

/**
 * Updates the folder count badge (e.g. "0/5", "3/5").
 * @return {Promise<number>}
 * @private
 */
AppStorageController.prototype.updateFolderCount_ = function() {
  return this.getAllSavedFiles().then((files) => {
    const count = files.length;
    if (this.countBadge_) {
      this.countBadge_.textContent = '(' + count + '/' + AppStorageController.MAX_SAVES + ')';
      this.countBadge_.classList.toggle('full', count >= AppStorageController.MAX_SAVES);
    }
    if (this.isFolderOpen_) {
      this.renderFolderList_(files);
    }
    return count;
  });
};

/**
 * Toggles the sidebar App Storage folder view open/closed.
 * @param {boolean=} opt_force
 * @return {Promise<Array<Object>>}
 */
AppStorageController.prototype.toggleFolder = function(opt_force) {
  this.isFolderOpen_ = typeof opt_force === 'boolean' ? opt_force : !this.isFolderOpen_;

  if (this.appFolderItem_) {
    this.appFolderItem_.classList.toggle('open', this.isFolderOpen_);
  }

  if (this.folderContent_) {
    this.folderContent_.style.display = this.isFolderOpen_ ? 'flex' : 'none';
  }

  if (this.isFolderOpen_) {
    return this.getAllSavedFiles().then((files) => {
      this.renderFolderList_(files);
      return files;
    });
  }
  return Promise.resolve([]);
};

/**
 * Renders the saved file items into the sidebar folder drawer.
 * @param {Array<Object>} files
 * @private
 */
AppStorageController.prototype.renderFolderList_ = function(files) {
  if (!this.fileListEl_) return;
  this.fileListEl_.innerHTML = '';

  if (!files || files.length === 0) {
    const emptyNotice = document.createElement('li');
    emptyNotice.className = 'app-storage-empty-notice';
    emptyNotice.textContent = 'Folder is empty (0/5 saves)';
    this.fileListEl_.appendChild(emptyNotice);
    return;
  }

  files.forEach((file) => {
    const item = document.createElement('li');
    item.className = 'app-storage-file-item';

    const icon = document.createElement('span');
    icon.className = 'app-storage-file-icon material-icons';
    icon.textContent = 'description';

    const info = document.createElement('div');
    info.className = 'app-storage-file-info';
    info.title = 'Click to open in editor';
    info.addEventListener('click', () => this.openFileInEditor_(file.id));

    const name = document.createElement('span');
    name.className = 'app-storage-file-name';
    name.textContent = file.name;

    const meta = document.createElement('div');
    meta.className = 'app-storage-file-meta';

    const size = document.createElement('span');
    size.className = 'app-storage-file-size';
    size.textContent = this.formatBytes_(file.size);

    const date = document.createElement('span');
    date.className = 'app-storage-file-date';
    date.textContent = this.formatDate_(file.timestamp);

    meta.appendChild(size);
    meta.appendChild(document.createTextNode(' • '));
    meta.appendChild(date);

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'app-storage-file-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'app-storage-file-btn open-btn';
    openBtn.title = 'Open in editor';
    openBtn.innerHTML = '<span class="material-icons">file_open</span>';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openFileInEditor_(file.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'app-storage-file-btn delete-btn';
    deleteBtn.title = 'Delete from App Storage';
    deleteBtn.innerHTML = '<span class="material-icons">delete_outline</span>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.promptDeleteFile_(file);
    });

    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(actions);

    this.fileListEl_.appendChild(item);
  });
};

/**
 * Saves the active tab's content directly to App Storage.
 */
AppStorageController.prototype.saveActiveTabToApp = function() {
  const currentTab = this.tabs_.currentTab_;
  if (!currentTab) {
    util.showToast('No active document to save.');
    return;
  }

  // Ensure editor view buffer is synced to tab state
  this.tabs_.updateCurrentTabState_();
  const content = currentTab.getContent_();
  const size = new Blob([content]).size;

  // 1MB limit check
  if (size > AppStorageController.MAX_FILE_SIZE) {
    this.dialogController_.setText(
        'Cannot save to App Storage:',
        'The file size (' + this.formatBytes_(size) + ') exceeds the 1MB limit for webapp storage.'
    );
    this.dialogController_.resetButtons();
    this.dialogController_.addButton('ok', chrome.i18n.getMessage('okDialogButton') || 'OK');
    this.dialogController_.show();
    return;
  }

  this.getAllSavedFiles().then((existingFiles) => {
    // Check if this tab is already linked to an app-stored file
    const existingLinked = currentTab.appStorageFileId ?
        existingFiles.find((f) => f.id === currentTab.appStorageFileId) : null;

    if (existingLinked) {
      this.putFile(existingLinked.name, content, existingLinked.id)
          .then((savedFile) => {
            this.updateFolderCount_();
            util.showToast('Updated "' + savedFile.name + '" in App Storage');
          })
          .catch((err) => util.showToast(err.message));
      return;
    }

    // New file: check 5 saves limit
    if (existingFiles.length >= AppStorageController.MAX_SAVES) {
      this.dialogController_.setText(
          'App Storage Limit Reached (5/5 saves):',
          'You can save up to 5 files in app storage.',
          'Please delete an existing file from the App Folder in the sidebar to save a new one.'
      );
      this.dialogController_.resetButtons();
      this.dialogController_.addButton('open-folder', 'View App Folder');
      this.dialogController_.addButton('cancel', chrome.i18n.getMessage('cancelDialogButton') || 'Cancel');
      this.dialogController_.show((btn) => {
        if (btn === 'open-folder') {
          this.toggleFolder(true);
        }
      });
      return;
    }

    // Determine default name
    let defaultName = currentTab.getName();
    if (defaultName.indexOf('Untitled ') === 0) {
      const firstLine = content.split('\n')[0].trim();
      const sanitized = util.sanitizeFileName(firstLine);
      defaultName = sanitized ? (sanitized + '.txt') : 'document.txt';
    }

    const chosenName = prompt('Enter a name for this file in App Storage:', defaultName);
    if (!chosenName || !chosenName.trim()) {
      return; // Cancelled
    }

    let finalName = chosenName.trim();
    if (!util.getExtension(finalName)) {
      finalName += '.txt';
    }

    // Check if a file with this name already exists in the 5 saves
    const duplicate = existingFiles.find((f) => f.name.toLowerCase() === finalName.toLowerCase());
    let targetId = duplicate ? duplicate.id : null;

    if (duplicate && !confirm('A file named "' + finalName + '" already exists in App Storage. Overwrite it?')) {
      return;
    }

    this.putFile(finalName, content, targetId)
        .then((savedFile) => {
          currentTab.appStorageFileId = savedFile.id;
          currentTab.name_ = savedFile.name;
          util.triggerEvent('tabrenamed', currentTab);
          this.updateFolderCount_();
          util.showToast('Saved "' + savedFile.name + '" to App Storage!');
        })
        .catch((err) => util.showToast(err.message));
  });
};

/**
 * Opens an app-stored file into a tab in the editor.
 * @param {string} fileId
 * @private
 */
AppStorageController.prototype.openFileInEditor_ = function(fileId) {
  return this.getAllSavedFiles().then((files) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      util.showToast('File not found in App Storage.');
      return null;
    }

    // Check if already open in a tab
    for (let i = 0; i < this.tabs_.tabs_.length; i++) {
      const t = this.tabs_.tabs_[i];
      if (t.appStorageFileId === file.id || (t.getName() === file.name && !t.getEntry())) {
        this.tabs_.showTab(t.getId());
        util.showToast('Switched to "' + file.name + '"');
        return t;
      }
    }

    // Open as a new tab
    const tab = this.tabs_.newTab(file.content, null, false, file.name);
    tab.appStorageFileId = file.id;
    util.showToast('Opened "' + file.name + '" from App Storage');
    return tab;
  });
};

/**
 * Confirms and deletes a saved file from App Storage.
 * @param {Object} file
 * @private
 */
AppStorageController.prototype.promptDeleteFile_ = function(file) {
  if (confirm('Delete "' + file.name + '" from App Storage?')) {
    this.deleteFile(file.id).then(() => {
      // Unlink any open tab
      this.tabs_.tabs_.forEach((t) => {
        if (t.appStorageFileId === file.id) {
          t.appStorageFileId = null;
        }
      });
      this.updateFolderCount_();
      util.showToast('Deleted "' + file.name + '" from App Storage.');
    });
  }
};

/* =========================================================================
 * TEMP SAVE & RECOVERY FOR FILES NOT AUTOSAVED ON DEVICE STORAGE
 * ========================================================================= */

/**
 * Saves active unpersisted document to temp_saves store on typing.
 * Debounced to minimize disk/IndexedDB writes.
 * @private
 */
AppStorageController.prototype.onDocChange_ = function() {
  if (this.tempSaveTimer_) {
    clearTimeout(this.tempSaveTimer_);
  }

  this.tempSaveTimer_ = setTimeout(() => {
    this.saveTempActive_();
  }, 800);
};

/**
 * Writes current active tab to temp_saves if it is not saved on device storage.
 * @private
 */
AppStorageController.prototype.saveTempActive_ = function() {
  const currentTab = this.tabs_.currentTab_;
  if (!currentTab) return;

  // Only temp-save if the file is NOT safely autosaved to disk/device storage
  const hasValidDeviceEntry = currentTab.getEntry() && !currentTab.isMissing();
  if (hasValidDeviceEntry && currentTab.isSaved()) {
    // Already safe on device storage; clear temp save
    this.clearTempSave_();
    return;
  }

  const content = currentTab.getContent_();
  if (!content || content.trim().length === 0) {
    return;
  }

  const size = new Blob([content]).size;
  if (size > AppStorageController.MAX_FILE_SIZE) {
    // Exceeds 1MB limit for temp save
    return;
  }

  const tempRecord = {
    id: AppStorageController.TEMP_SAVE_KEY,
    name: currentTab.getName() || 'Untitled',
    content: content,
    size: size,
    timestamp: Date.now(),
    tabId: currentTab.getId()
  };

  this.initDatabase_().then((db) => {
    if (!db) {
      try {
        localStorage.setItem('textapp_temp_save_fallback', JSON.stringify(tempRecord));
      } catch(e) {}
      return;
    }

    try {
      const tx = db.transaction(AppStorageController.STORE_TEMP, 'readwrite');
      tx.objectStore(AppStorageController.STORE_TEMP).put(tempRecord);
    } catch (e) {
      console.warn('Failed to write temp save:', e);
    }
  });
};

/**
 * Clears the temp save once the file is safely persisted to device storage.
 * @private
 */
AppStorageController.prototype.clearTempSave_ = function() {
  this.initDatabase_().then((db) => {
    if (!db) {
      localStorage.removeItem('textapp_temp_save_fallback');
      return;
    }

    try {
      const tx = db.transaction(AppStorageController.STORE_TEMP, 'readwrite');
      tx.objectStore(AppStorageController.STORE_TEMP).delete(AppStorageController.TEMP_SAVE_KEY);
    } catch(e) {}
  });
};

/**
 * When any tab is successfully saved on device storage.
 * @private
 */
AppStorageController.prototype.onTabSave_ = function() {
  const currentTab = this.tabs_.currentTab_;
  if (currentTab && currentTab.isSaved() && currentTab.getEntry() && !currentTab.isMissing()) {
    this.clearTempSave_();
  }
};

/**
 * When tabs are switched.
 * @private
 */
AppStorageController.prototype.onSwitchTab_ = function() {
  this.saveTempActive_();
};

/**
 * When a tab is closed.
 * @private
 */
AppStorageController.prototype.onTabClosed_ = function() {
  // If no unsaved tabs remain, clear temp save
  const hasUnsaved = this.tabs_.tabs_.some((t) => !t.isSaved() || !t.getEntry());
  if (!hasUnsaved) {
    this.clearTempSave_();
  }
};

/**
 * Checks for any temp save on app startup and prompts to fix/save on device storage.
 * @private
 */
AppStorageController.prototype.checkTempSaveRecovery_ = function() {
  this.initDatabase_().then((db) => {
    let getPromise;
    if (!db) {
      const stored = localStorage.getItem('textapp_temp_save_fallback');
      getPromise = Promise.resolve(stored ? JSON.parse(stored) : null);
    } else {
      getPromise = new Promise((resolve) => {
        try {
          const tx = db.transaction(AppStorageController.STORE_TEMP, 'readonly');
          const req = tx.objectStore(AppStorageController.STORE_TEMP).get(AppStorageController.TEMP_SAVE_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch(e) {
          resolve(null);
        }
      });
    }

    getPromise.then((tempRecord) => {
      if (!tempRecord || !tempRecord.content || tempRecord.content.trim().length === 0) {
        return;
      }

      // Check if any restored tab already has this exact content and is saved to device
      const isAlreadySavedOnDevice = this.tabs_.tabs_.some((t) => {
        return t.getContent_() === tempRecord.content && t.getEntry() && !t.isMissing() && t.isSaved();
      });

      if (isAlreadySavedOnDevice) {
        this.clearTempSave_();
        return;
      }

      // Prompt user to fix/save the recovered file to device storage
      setTimeout(() => {
        this.showRecoveryPrompt_(tempRecord);
      }, 350);
    });
  });
};

/**
 * Displays the recovery prompt to fix/save the file to device storage.
 * @param {Object} tempRecord
 * @private
 */
AppStorageController.prototype.showRecoveryPrompt_ = function(tempRecord) {
  this.dialogController_.setText(
      'Recovered Unsaved Work:',
      'We kept an unsaved file ("' + tempRecord.name + '", ' + this.formatBytes_(tempRecord.size) + ') safe in app storage because it was not autosaved to your device.',
      'Would you like to save it to your device storage now?'
  );

  const saveDeviceTxt = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('saveToDeviceButton')) || 'Save to Device';
  const saveAppTxt = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('saveOnAppButton')) || 'Save on App';
  const keepEditorTxt = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('keepInEditorButton')) || 'Keep in Editor';
  const deleteTxt = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('deleteDialogButton')) || 'Delete';

  this.dialogController_.resetButtons();
  this.dialogController_.addButton('save-device', saveDeviceTxt);
  this.dialogController_.addButton('keep-app', saveAppTxt);
  this.dialogController_.addButton('dismiss', keepEditorTxt);
  this.dialogController_.addButton('delete', deleteTxt);

  this.dialogController_.show((choice) => {
    if (choice === 'delete') {
      this.clearTempSave_();
      const recoveredTab = this.tabs_.tabs_.find((t) => t.getContent_() === tempRecord.content);
      if (recoveredTab) {
        this.tabs_.closeTab_(recoveredTab);
      }
      util.showToast('Unsaved file deleted.');
      return;
    }

    // Open a recovered tab if not already open
    let recoveredTab = this.tabs_.tabs_.find((t) => t.getContent_() === tempRecord.content);
    if (!recoveredTab) {
      recoveredTab = this.tabs_.newTab(tempRecord.content, null, false, tempRecord.name);
    } else {
      this.tabs_.showTab(recoveredTab.getId());
    }

    if (choice === 'save-device') {
      // Trigger Save As to fix storage save to device
      this.tabs_.saveAs(recoveredTab, () => {
        this.clearTempSave_();
        util.showToast('File successfully saved to your device storage!');
      });
    } else if (choice === 'keep-app') {
      this.putFile(tempRecord.name, tempRecord.content)
          .then((saved) => {
            recoveredTab.appStorageFileId = saved.id;
            this.clearTempSave_();
            this.updateFolderCount_();
            util.showToast('Saved "' + saved.name + '" to App Storage!');
          })
          .catch((err) => {
            util.showToast(err.message);
          });
    } else {
      util.showToast('Recovered file kept in active tab.');
    }
  });
};
