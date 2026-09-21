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
        Object.keys(items).forEach(function(key) {
          localStorage.setItem(areaName + '.' + key, JSON.stringify(items[key]));
        });
        if (callback) {
          var changes = {};
          Object.keys(items).forEach(function(key) {
            changes[key] = { newValue: items[key] };
          });
          $.event.trigger('storageOnChanged', [changes, areaName]);
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
      $(document).bind('storageOnChanged', function(e, changes, areaName) {
        callback(changes, areaName);
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
    "errorTitle": { "message": "Error" },
    "loadingTitle": { "message": "Loading..." },
    "yesDialogButton": { "message": "Yes" },
    "noDialogButton": { "message": "No" },
    "cancelDialogButton": { "message": "Cancel" },
    "okDialogButton": { "message": "OK" },
    "closeFileButton": { "message": "Close file" }
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
        $.event.trigger('i18n-ready');
      });
    } else {
      $.event.trigger('i18n-ready');
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

  function FileEntryPolyfill(handle) {
    this.handle = handle;
    this.name = handle.name;
    this.isFile = handle.kind === 'file';
    this.isDirectory = handle.kind === 'directory';
  }

  FileEntryPolyfill.prototype.file = function(callback) {
    this.handle.getFile().then(callback);
  };

  FileEntryPolyfill.prototype.createWriter = function(callback) {
    var self = this;
    var writer = {
      onerror: null,
      onwrite: null,
      truncate: function(size) {
        this.write_requested_size = size;
        if (this.onwrite) this.onwrite();
      },
      write: function(blob) {
        self.handle.createWritable().then(function(writable) {
          writable.write(blob).then(function() {
            writable.close().then(function() {
              if (writer.onwrite) writer.onwrite();
            });
          });
        }).catch(function(err) {
          if (writer.onerror) writer.onerror(err);
        });
      }
    };
    callback(writer);
  };

  chrome.fileSystem.chooseEntry = function(options, callback) {
    if (options.type === 'openFile' || options.type === 'openWritableFile') {
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
    } else if (options.type === 'saveFile') {
      window.showSaveFilePicker({
        suggestedName: options.suggestedName
      }).then(function(handle) {
        callback(new FileEntryPolyfill(handle));
      }).catch(function(err) {
        console.log('User cancelled or error:', err);
        callback();
      });
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
    return 'mock-id-' + entry.name;
  };
  chrome.fileSystem.restoreEntry = function(id, callback) {
    callback(null);
  };

  // --- File Handling API ---
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(function(launchParams) {
      if (!launchParams.files.length) return;
      
      var entries = launchParams.files.map(function(handle) {
        return new FileEntryPolyfill(handle);
      });
      
      var launchData = {
        items: entries.map(function(entry) {
          return { entry: entry };
        })
      };

      if (onLaunchedCallbacks.length > 0) {
        triggerLaunch(launchData);
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
