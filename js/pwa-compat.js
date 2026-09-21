(function() {
  if (typeof chrome === 'undefined') {
    window.chrome = {};
  }

  // --- chrome.runtime ---
  if (!chrome.runtime) chrome.runtime = {};
  chrome.runtime.lastError = null;
  chrome.runtime.onInstalled = { addListener: function() {} };
  chrome.runtime.getBackgroundPage = function(callback) {
    // In PWA, we don't have a background page.
    setTimeout(function() {
      callback(window);
    }, 0);
  };

  // --- chrome.app.runtime ---
  if (!chrome.app) chrome.app = {};
  if (!chrome.app.runtime) chrome.app.runtime = {};

  var onLaunchedCallbacks = [];
  var pendingLaunchData = null;
  var launched = false;

  function triggerLaunch(data) {
    if (launched && (!data || !data.items)) return;
    launched = true;
    onLaunchedCallbacks.forEach(function(cb) { cb(data); });
  }

  chrome.app.runtime.onLaunched = {
    addListener: function(callback) {
      onLaunchedCallbacks.push(callback);
      if (pendingLaunchData) {
        callback(pendingLaunchData);
        pendingLaunchData = null;
        launched = true;
      }
    }
  };

  // --- chrome.app.window ---
  if (!chrome.app.window) chrome.app.window = {};
  chrome.app.window.create = function(url, options, callback) {
    // If we are already in standalone mode and this is index.html, we might just want to focus.
    // However, Chrome Apps usually open a NEW window.
    // In PWA, we'll open a new tab/window if it's not the initial launch.
    if (launched && url === 'index.html') {
       console.log('App already launched, ignoring request to open another index.html window to avoid loops.');
       if (callback) callback(chrome.app.window.current());
       return;
    }

    console.warn('chrome.app.window.create called. Opening in new tab.');
    var win = window.open(url, '_blank');
    if (callback) callback(win);
  };

  chrome.app.window.current = function() {
    var isMaximized = false;
    return {
      minimize: function() { console.log('Minimize not supported'); },
      maximize: function() { 
        console.log('Maximize');
        isMaximized = true;
        var maxBtn = document.getElementById('window-maximize');
        if (maxBtn && window.i18nTemplate) {
          maxBtn.title = chrome.i18n.getMessage('restoreButton');
        }
      },
      restore: function() { 
        console.log('Restore');
        isMaximized = false;
        var maxBtn = document.getElementById('window-maximize');
        if (maxBtn && window.i18nTemplate) {
          maxBtn.title = chrome.i18n.getMessage('maximizeButton');
        }
      },
      isMaximized: function() { return isMaximized; },
      setAlwaysOnTop: function(v) { console.log('Always on top:', v); },
      focus: function() { window.focus(); },
      close: function() { window.close(); },
      onClosed: { addListener: function() {} }
    };
  };

  // --- chrome.storage ---
  if (!chrome.storage) chrome.storage = {};
  var createStorageArea = function(areaName) {
    return {
      get: function(keys, callback) {
        var result = {};
        var searchKeys = [];
        if (typeof keys === 'string') {
          searchKeys = [keys];
        } else if (Array.isArray(keys)) {
          searchKeys = keys;
        } else if (typeof keys === 'object') {
          searchKeys = Object.keys(keys);
          result = Object.assign({}, keys);
        }

        searchKeys.forEach(function(key) {
          var val = localStorage.getItem(areaName + '.' + key);
          if (val !== null) {
            try {
              result[key] = JSON.parse(val);
            } catch (e) {
              result[key] = val;
            }
          }
        });

        if (callback) callback(result);
      },
      set: function(items, callback) {
        var changes = {};
        Object.keys(items).forEach(function(key) {
          localStorage.setItem(areaName + '.' + key, JSON.stringify(items[key]));
          changes[key] = { newValue: items[key] };
        });
        document.dispatchEvent(new CustomEvent('storageOnChanged', {
          detail: { changes: changes, areaName: areaName }
        }));
        if (callback) {
          callback();
        }
      },
      remove: function(keys, callback) {
        if (typeof keys === 'string') keys = [keys];
        keys.forEach(function(key) {
          localStorage.removeItem(areaName + '.' + key);
        });
        if (callback) callback();
      },
      clear: function(callback) {
        Object.keys(localStorage).forEach(function(key) {
          if (key.indexOf(areaName + '.') === 0) {
            localStorage.removeItem(key);
          }
        });
        if (callback) callback();
      }
    };
  };

  chrome.storage.local = createStorageArea('local');
  chrome.storage.sync = createStorageArea('sync');
  chrome.storage.onChanged = {
    addListener: function(callback) {
      document.addEventListener('storageOnChanged', function(e) {
        if (e.detail) {
          callback(e.detail.changes, e.detail.areaName);
        }
      });
    }
  };

  // --- chrome.i18n ---
  if (!chrome.i18n) chrome.i18n = {};
  var messages = {
    "appDesc": { "message": "A text editor for Chrome OS and Chrome." },
    "fileMenuNew": { "message": "New" },
    "fileMenuOpen": { "message": "Open" },
    "fileMenuSave": { "message": "Save" },
    "fileMenuSaveas": { "message": "Save as" },
    "menuSettings": { "message": "Settings" },
    "menuShortcuts": { "message": "Keyboard shortcuts" },
    "autosaveSetting": { "message": "Auto save" },
    "fontsizeSetting": { "message": "Font size" },
    "fontsizeTooltip": { "message": "Set with Ctrl- and Ctrl+" },
    "spacestabSetting": { "message": "Tabs to spaces" },
    "tabsizeSetting": { "message": "Tab size" },
    "wraplinesSetting": { "message": "Wrap lines" },
    "linenumbersSetting": { "message": "Show line numbers" },
    "smartindentSetting": { "message": "Smart indent" },
    "themeSetting": { "message": "Themes" },
    "alwaysOnTopSetting": { "message": "Always on top" },
    "deviceThemeOption": { "message": "Use device theme" },
    "lightThemeOption": { "message": "Light" },
    "darkThemeOption": { "message": "Dark" },
    "helpSection": { "message": "Help" },
    "closeSettings": { "message": "Back" },
    "openSidebarButton": { "message": "Open sidebar" },
    "closeSidebarButton": { "message": "Close sidebar" },
    "searchPlaceholder": { "message": "Find..." },
    "searchNextButton": { "message": "Next" },
    "searchPreviousButton": { "message": "Previous" },
    "toggleReplaceButton": { "message": "Toggle replace (Ctrl+H)" },
    "replacePlaceholder": { "message": "Replace..." },
    "replaceButton": { "message": "Replace" },
    "replaceButtonTitle": { "message": "Replace (Enter)" },
    "replaceAllButton": { "message": "All" },
    "replaceAllButtonTitle": { "message": "Replace all" },
    "errorTitle": { "message": "Error" },
    "loadingTitle": { "message": "Loading..." },
    "yesDialogButton": { "message": "Yes" },
    "noDialogButton": { "message": "No" },
    "cancelDialogButton": { "message": "Cancel" },
    "okDialogButton": { "message": "OK" },
    "closeFileButton": { "message": "Close file" },
    "savingIndicator": { "message": "Saving changes..." },
    "savedIndicator": { "message": "All changes saved" },
    "unsavedIndicator": { "message": "Unsaved changes - click to save" },
    "saveErrorIndicator": { "message": "Error saving changes - click to retry" },
    "missingFileIndicator": { "message": "File is missing in location - click to Save As" },
    "dropFilesToOpen": { "message": "Drop files here to open" },
    "externalModificationPromptLine1": { "message": "$1 has been modified by another program." },
    "externalModificationPromptLine2": { "message": "Do you want to reload it and lose your unsaved changes?" },
    "reloadDialogButton": { "message": "Reload" },
    "keepLocalDialogButton": { "message": "Keep Local Changes" },
    "fileReloadedToast": { "message": "$1 reloaded (modified externally)" },
    "saveFilenamePrompt": { "message": "Save file as:" }
  };
  var locale = navigator.language.replace('-', '_');
  var defaultLocale = 'en';

  function loadLocale(lang, callback) {
    if (window.location.protocol === 'file:') {
      console.warn('Protocol is file://, skipping fetch for locales to avoid CORS errors. Using embedded fallback.');
      if (callback) callback();
      return;
    }
    var url = '_locales/' + lang + '/messages.json';
    fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('Locale not found: ' + lang);
        return res.json();
      })
      .then(function(data) {
        messages = Object.assign(messages, data);
        if (callback) callback();
      })
      .catch(function(err) {
        console.warn('Failed to load locale ' + lang, err.message);
        if (callback) callback();
      });
  }

  // Initialize i18n
  loadLocale(defaultLocale, function() {
    if (locale !== defaultLocale && window.location.protocol !== 'file:') {
      loadLocale(locale, function() {
        document.dispatchEvent(new CustomEvent('i18n-ready'));
      });
    } else {
      document.dispatchEvent(new CustomEvent('i18n-ready'));
    }
  });

  chrome.i18n.getMessage = function(messageName, substitutions) {
    var entry = messages[messageName];
    if (!entry) return '';
    var message = entry.message;
    if (substitutions) {
      if (!Array.isArray(substitutions)) substitutions = [substitutions];
      substitutions.forEach(function(sub, i) {
        message = message.replace('$' + (i + 1), sub);
      });
    }
    return message;
  };

  // --- chrome.fileSystem ---
  if (!chrome.fileSystem) chrome.fileSystem = {};

  // --- IndexedDB Handle Store ---
  var dbPromise = null;
  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise(function(resolve) {
        if (!window.indexedDB) {
          resolve(null);
          return;
        }
        var req = indexedDB.open('TextAppHandlesDB', 1);
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('file_handles')) {
            db.createObjectStore('file_handles', { keyPath: 'id' });
          }
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
      });
    }
    return dbPromise;
  }

  function storeHandle(id, handle) {
    return getDB().then(function(db) {
      if (!db || !handle) return;
      return new Promise(function(resolve) {
        try {
          var tx = db.transaction('file_handles', 'readwrite');
          tx.objectStore('file_handles').put({ id: id, handle: handle, name: handle.name });
          tx.oncomplete = function() { resolve(); };
          tx.onerror = function() { resolve(); };
        } catch(e) {
          resolve();
        }
      });
    });
  }

  function retrieveHandle(id) {
    return getDB().then(function(db) {
      if (!db || !id) return null;
      return new Promise(function(resolve) {
        try {
          var tx = db.transaction('file_handles', 'readonly');
          var req = tx.objectStore('file_handles').get(id);
          req.onsuccess = function() {
            resolve(req.result ? req.result.handle : null);
          };
          req.onerror = function() { resolve(null); };
        } catch(e) {
          resolve(null);
        }
      });
    });
  }

  chrome.fileSystem.storeHandle = storeHandle;
  chrome.fileSystem.getStoredHandle = retrieveHandle;

  function FileEntryPolyfill(handle, opt_id, opt_file, opt_name) {
    this.handle = handle || null;
    this.fileObj = opt_file || null;
    this.name = (handle && handle.name) || opt_name || (opt_file && opt_file.name) || 'untitled.txt';
    this.isFile = true;
    this.isDirectory = false;
    this.isFallback = !handle;
    this.handleId = opt_id || ('handle_' + (this.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    if (this.handle) {
      storeHandle(this.handleId, this.handle);
    }
  }
  window.FileEntryPolyfill = FileEntryPolyfill;

  FileEntryPolyfill.prototype.file = function(callback) {
    if (this.handle) {
      this.handle.getFile().then(callback).catch(function(err) {
        console.warn('Could not read file from handle:', err);
        callback(null);
      });
    } else if (this.fileObj) {
      callback(this.fileObj);
    } else {
      var f = new File([], this.name, { type: 'text/plain', lastModified: Date.now() });
      this.fileObj = f;
      callback(f);
    }
  };

  FileEntryPolyfill.prototype.createWriter = function(callback) {
    var self = this;
    var writer = {
      onerror: null,
      onwrite: null,
      isAutosave: false,
      truncate: function(size) {
        this.write_requested_size = size;
        if (this.onwrite) this.onwrite();
      },
      write: function(blob) {
        if (self.handle) {
          self.handle.createWritable().then(function(writable) {
            writable.write(blob).then(function() {
              writable.close().then(function() {
                if (writer.onwrite) writer.onwrite();
              });
            });
          }).catch(function(err) {
            if (writer.onerror) writer.onerror(err);
          });
        } else {
          // Safari / Firefox / non-Chromium fallback
          var modTime = Date.now();
          self.fileObj = new File([blob], self.name, {
            type: blob.type || 'text/plain',
            lastModified: modTime
          });
          // Only trigger browser file download for user-initiated explicit save (not automatic background autosave)
          if (!writer.isAutosave) {
            try {
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = self.name || 'document.txt';
              document.body.appendChild(a);
              a.click();
              setTimeout(function() {
                if (a.parentNode) {
                  document.body.removeChild(a);
                }
                URL.revokeObjectURL(url);
              }, 1500);
            } catch (e) {
              console.warn('Fallback download trigger error:', e);
            }
          }
          if (writer.onwrite) {
            writer.onwrite();
          }
        }
      }
    };
    callback(writer);
  };

  function openFileInputFallback(options, callback) {
    if (options && options.mockFiles && options.mockFiles.length) {
      var mockEntries = options.mockFiles.map(function(f) {
        return new FileEntryPolyfill(null, null, f, f.name);
      });
      callback(options.acceptsMultiple ? mockEntries : mockEntries[0]);
      return;
    }

    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!options.acceptsMultiple;
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    input.style.left = '-1000px';
    input.style.opacity = '0';
    input.tabIndex = -1;
    document.body.appendChild(input);

    var handled = false;
    function cleanup() {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    }

    input.addEventListener('change', function() {
      handled = true;
      var files = Array.from(input.files || []);
      cleanup();
      if (!files.length) {
        callback();
        return;
      }
      var entries = files.map(function(file) {
        return new FileEntryPolyfill(null, null, file, file.name);
      });
      callback(options.acceptsMultiple ? entries : entries[0]);
    });

    input.addEventListener('cancel', function() {
      handled = true;
      cleanup();
      callback();
    });

    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus);
      setTimeout(function() {
        if (!handled) {
          cleanup();
          callback();
        }
      }, 1000);
    }, { once: true });

    input.click();
  }

  function saveFilePickerFallback(options, callback) {
    var defaultName = options.suggestedName || 'untitled.txt';
    var promptMsg = (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('saveFilenamePrompt')) ||
                    'Save file as:';
    var fileName = window.prompt(promptMsg, defaultName);
    if (!fileName || !fileName.trim()) {
      callback();
      return;
    }
    fileName = fileName.trim();
    var entry = new FileEntryPolyfill(null, null, null, fileName);
    callback(entry);
  }

  chrome.fileSystem.chooseEntry = function(options, callback) {
    if (options.type === 'openFile' || options.type === 'openWritableFile') {
      if (typeof window.showOpenFilePicker === 'function') {
        window.showOpenFilePicker({
          multiple: options.acceptsMultiple || false
        }).then(async function(handles) {
          if (options.type === 'openWritableFile') {
            for (var i = 0; i < handles.length; i++) {
              try {
                if (handles[i].requestPermission) {
                  var perm = await handles[i].queryPermission({ mode: 'readwrite' });
                  if (perm !== 'granted') {
                    await handles[i].requestPermission({ mode: 'readwrite' });
                  }
                }
              } catch (e) {
                console.warn('Could not query/request readwrite permission:', e);
              }
            }
          }
          var entries = handles.map(function(h) { return new FileEntryPolyfill(h); });
          callback(options.acceptsMultiple ? entries : entries[0]);
        }).catch(function(err) {
          console.log('User cancelled or error:', err);
          callback();
        });
      } else {
        openFileInputFallback(options, callback);
      }
    } else if (options.type === 'saveFile') {
      if (typeof window.showSaveFilePicker === 'function') {
        window.showSaveFilePicker({
          suggestedName: options.suggestedName
        }).then(function(handle) {
          callback(new FileEntryPolyfill(handle));
        }).catch(function(err) {
          console.log('User cancelled or error:', err);
          callback();
        });
      } else {
        saveFilePickerFallback(options, callback);
      }
    }
  };

  chrome.fileSystem.getDisplayPath = function(entry, callback) {
    if (entry && entry.name) {
      callback(entry.name);
    } else {
      callback('Unknown');
    }
  };

  chrome.fileSystem.getWritableEntry = function(entry, callback) {
    callback(entry);
  };

  chrome.fileSystem.retainEntry = function(entry) {
    if (entry && entry.handleId && entry.handle) {
      storeHandle(entry.handleId, entry.handle);
      return entry.handleId;
    }
    return 'mock-id-' + (entry ? entry.name : 'file');
  };
  chrome.fileSystem.restoreEntry = function(id, callback) {
    retrieveHandle(id).then(function(handle) {
      if (!handle) {
        callback(null);
        return;
      }
      handle.getFile().then(function(file) {
        var entry = new FileEntryPolyfill(handle, id);
        callback(entry);
      }).catch(function(err) {
        console.warn('File handle found in IndexedDB but getFile failed (missing file):', err);
        var entry = new FileEntryPolyfill(handle, id);
        entry.isMissing = true;
        callback(entry);
      });
    }).catch(function(err) {
      callback(null);
    });
  };

  // --- File Handling API ---
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(function(launchParams) {
      if (!launchParams || !launchParams.files || !launchParams.files.length) return;

      var entries = launchParams.files.map(function(handle) {
        return new FileEntryPolyfill(handle);
      });

      var launchData = {
        items: entries.map(function(entry) {
          return { entry: entry };
        })
      };

      if (!launched && onLaunchedCallbacks.length > 0) {
        triggerLaunch(launchData);
      } else if (launched && window.textApp && window.textApp.tabs_) {
        // App is already running and focused (client_mode: "focus-existing").
        // Open the received file entries directly as tabs.
        for (var i = 0; i < entries.length; i++) {
          window.textApp.tabs_.openFileEntry(entries[i]);
        }
      } else {
        pendingLaunchData = launchData;
      }
    });
  }

  // Trigger normal launch if not handled by launchQueue
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!launched) triggerLaunch();
    }, 500);
  });

})();
