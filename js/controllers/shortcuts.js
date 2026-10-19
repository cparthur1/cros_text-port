/**
 * Controller for the Keyboard Shortcuts popup dialog.
 * @constructor
 * @param {EditorCodeMirror} editor
 */
function ShortcutsController(editor) {
  this.editor_ = editor;
  this.dialog_ = null;
  this.searchInput_ = null;
  this.content_ = null;
  this.platformHint_ = null;
  this.lastFocusedElement_ = null;

  this.isMac_ = typeof navigator !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  this.initDom_();
  document.addEventListener('openshortcuts', this.open.bind(this));
}

/**
 * List of available shortcuts grouped by category.
 */
ShortcutsController.SHORTCUT_GROUPS = [
  {
    category: 'File Operations',
    shortcuts: [
      { label: 'New tab', keys: ['Ctrl', 'N'] },
      { label: 'New window', keys: ['Ctrl', 'Shift', 'N'] },
      { label: 'Open file', keys: ['Ctrl', 'O'] },
      { label: 'Save file', keys: ['Ctrl', 'S'] },
      { label: 'Save as...', keys: ['Ctrl', 'Shift', 'S'] },
      { label: 'Print document', keys: ['Ctrl', 'P'] },
      { label: 'Close current tab', keys: ['Ctrl', 'W'] },
      { label: 'Close window', keys: ['Ctrl', 'Shift', 'W'] }
    ]
  },
  {
    category: 'Tabs & Navigation',
    shortcuts: [
      { label: 'Next tab', keys: ['Ctrl', 'Tab'] },
      { label: 'Previous tab', keys: ['Ctrl', 'Shift', 'Tab'] },
      { label: 'Toggle sidebar', keys: ['Alt', 'Space'] },
      { label: 'Focus sidebar', keys: ['Ctrl', 'E'] }
    ]
  },
  {
    category: 'Search & Replace',
    shortcuts: [
      { label: 'Find in document', keys: ['Ctrl', 'F'] },
      { label: 'Replace in document', keys: ['Ctrl', 'H'] },
      { label: 'Find next match', keys: ['Enter'], context: 'in search' },
      { label: 'Find previous match', keys: ['Shift', 'Enter'], context: 'in search' },
      { label: 'Replace match', keys: ['Enter'], context: 'in replace' },
      { label: 'Replace all matches', keys: ['Ctrl', 'Enter'], context: 'in replace' }
    ]
  },
  {
    category: 'Text Editing',
    shortcuts: [
      { label: 'Undo', keys: ['Ctrl', 'Z'] },
      { label: 'Redo', keys: ['Ctrl', 'Y'], altKeys: ['Ctrl', 'Shift', 'Z'] },
      { label: 'Cut', keys: ['Ctrl', 'X'] },
      { label: 'Copy', keys: ['Ctrl', 'C'] },
      { label: 'Paste', keys: ['Ctrl', 'V'] },
      { label: 'Select all', keys: ['Ctrl', 'A'] },
      { label: 'Indent line / selection', keys: ['Tab'] },
      { label: 'Outdent / Dedent line', keys: ['Shift', 'Tab'] }
    ]
  },
  {
    category: 'View & Zoom',
    shortcuts: [
      { label: 'Zoom in (increase font size)', keys: ['Ctrl', '+'] },
      { label: 'Zoom out (decrease font size)', keys: ['Ctrl', '-'] },
      { label: 'Reset zoom (default font size)', keys: ['Ctrl', '0'] }
    ]
  },
  {
    category: 'Tools & Productivity',
    shortcuts: [
      { label: 'Quick symbols & emoji palette', keys: ['Alt', 'S'] },
      { label: 'HotBar save selected text to slot', keys: ['Alt', 'C'], context: 'then 0–9' },
      { label: 'HotBar paste snippet from slot', keys: ['Alt', 'V'], context: 'then 0–9' },
      { label: 'Show keyboard shortcuts', keys: ['Ctrl', '/'] },
      { label: 'Close dialog / Cancel', keys: ['Esc'] }
    ]
  }
];

/**
 * Initializes the DOM structure for the shortcuts popup.
 * @private
 */
ShortcutsController.prototype.initDom_ = function() {
  var dialog = document.getElementById('shortcuts-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'shortcuts-dialog';
    dialog.className = 'shortcuts-dialog';
    dialog.setAttribute('closedby', 'any');
    dialog.setAttribute('aria-labelledby', 'shortcuts-dialog-title');

    var inner = document.createElement('div');
    inner.className = 'shortcuts-dialog-inner';

    var header = document.createElement('header');
    header.className = 'shortcuts-header';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'shortcuts-title-wrap';

    var headerIcon = document.createElement('span');
    headerIcon.className = 'shortcuts-header-icon material-icons';
    headerIcon.textContent = 'keyboard';

    var title = document.createElement('h2');
    title.id = 'shortcuts-dialog-title';
    title.className = 'shortcuts-title';
    title.textContent = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage('menuShortcuts')) || 'Keyboard shortcuts';

    titleWrap.appendChild(headerIcon);
    titleWrap.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'shortcuts-close-button';
    closeBtn.className = 'shortcuts-close-button material-icons';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = 'close';

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    var searchRow = document.createElement('div');
    searchRow.className = 'shortcuts-search-row';

    var searchIcon = document.createElement('span');
    searchIcon.className = 'shortcuts-search-icon material-icons';
    searchIcon.textContent = 'search';

    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'shortcuts-search-input';
    searchInput.className = 'shortcuts-search-input';
    searchInput.placeholder = 'Search shortcuts...';
    searchInput.setAttribute('aria-label', 'Search keyboard shortcuts');
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('spellcheck', 'false');

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);

    var content = document.createElement('div');
    content.id = 'shortcuts-content';
    content.className = 'shortcuts-content';
    content.setAttribute('tabindex', '0');

    var footer = document.createElement('footer');
    footer.className = 'shortcuts-footer';

    var footerHint = document.createElement('span');
    footerHint.className = 'shortcuts-footer-hint';
    footerHint.innerHTML = 'Press <kbd class="shortcut-key">Esc</kbd> or click outside to dismiss';

    var platformHint = document.createElement('span');
    platformHint.id = 'shortcuts-platform-hint';
    platformHint.className = 'shortcuts-platform-hint';

    footer.appendChild(footerHint);
    footer.appendChild(platformHint);

    inner.appendChild(header);
    inner.appendChild(searchRow);
    inner.appendChild(content);
    inner.appendChild(footer);

    dialog.appendChild(inner);
    document.body.appendChild(dialog);
  }

  this.dialog_ = dialog;
  this.searchInput_ = dialog.querySelector('#shortcuts-search-input');
  this.content_ = dialog.querySelector('#shortcuts-content');
  this.platformHint_ = dialog.querySelector('#shortcuts-platform-hint');

  if (this.platformHint_) {
    this.platformHint_.textContent = this.isMac_ ?
        'Platform: macOS (Cmd / Option)' :
        'Platform: ChromeOS / PC (Ctrl / Alt)';
  }

  var closeButton = dialog.querySelector('#shortcuts-close-button');
  if (closeButton) {
    closeButton.addEventListener('click', this.close.bind(this));
  }

  if (this.searchInput_) {
    this.searchInput_.addEventListener('input', this.onSearchInput_.bind(this));
  }

  // Modern web guidance fallback: light-dismiss for browsers lacking closedBy
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    this.dialog_.addEventListener('click', function(event) {
      if (event.target !== this.dialog_) return;
      var rect = this.dialog_.getBoundingClientRect();
      var isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        this.close();
      }
    }.bind(this));
  }

  this.dialog_.addEventListener('close', this.onDialogClosed_.bind(this));
};

/**
 * Maps key names for the active platform (macOS vs PC/ChromeOS).
 * @param {string} key
 * @return {string}
 * @private
 */
ShortcutsController.prototype.formatKey_ = function(key) {
  if (this.isMac_) {
    if (key === 'Ctrl') return 'Cmd';
    if (key === 'Alt') return 'Option';
  }
  return key;
};

/**
 * Handles live filtering as the user types in the search input.
 * @private
 */
ShortcutsController.prototype.onSearchInput_ = function() {
  var query = (this.searchInput_ ? this.searchInput_.value : '').trim().toLowerCase();
  this.renderShortcuts_(query);
};

/**
 * Renders the shortcut items, optionally filtered by a query string.
 * @param {string} query
 * @private
 */
ShortcutsController.prototype.renderShortcuts_ = function(query) {
  if (!this.content_) return;
  this.content_.innerHTML = '';

  var matchedAny = false;

  for (var i = 0; i < ShortcutsController.SHORTCUT_GROUPS.length; i++) {
    var group = ShortcutsController.SHORTCUT_GROUPS[i];
    var matchedShortcuts = [];

    for (var j = 0; j < group.shortcuts.length; j++) {
      var item = group.shortcuts[j];
      if (!query) {
        matchedShortcuts.push(item);
      } else {
        var labelMatch = item.label.toLowerCase().includes(query);
        var contextMatch = item.context && item.context.toLowerCase().includes(query);
        var catMatch = group.category.toLowerCase().includes(query);
        var keyStrings = item.keys.map(function(k) { return this.formatKey_(k).toLowerCase(); }.bind(this));
        var keyMatch = keyStrings.some(function(k) { return k.includes(query); }) ||
                       keyStrings.join('+').includes(query) ||
                       keyStrings.join(' ').includes(query);

        if (labelMatch || contextMatch || catMatch || keyMatch) {
          matchedShortcuts.push(item);
        }
      }
    }

    if (matchedShortcuts.length > 0) {
      matchedAny = true;
      var section = document.createElement('section');
      section.className = 'shortcuts-section';

      var sectionTitle = document.createElement('h3');
      sectionTitle.className = 'shortcuts-section-title';
      sectionTitle.textContent = group.category;
      section.appendChild(sectionTitle);

      var grid = document.createElement('div');
      grid.className = 'shortcuts-grid';

      for (var k = 0; k < matchedShortcuts.length; k++) {
        var shortcut = matchedShortcuts[k];
        var row = document.createElement('div');
        row.className = 'shortcut-row';

        var labelContainer = document.createElement('div');
        labelContainer.className = 'shortcut-label';

        var labelText = document.createElement('span');
        labelText.textContent = shortcut.label;
        labelContainer.appendChild(labelText);

        if (shortcut.context) {
          var contextText = document.createElement('span');
          contextText.className = 'shortcut-context';
          contextText.textContent = '(' + shortcut.context + ')';
          labelContainer.appendChild(contextText);
        }

        var keysContainer = document.createElement('div');
        keysContainer.className = 'shortcut-keys';

        var renderKeys = function(keys) {
          var span = document.createElement('span');
          span.className = 'shortcut-key-combo';
          for (var m = 0; m < keys.length; m++) {
            if (m > 0) {
              var plus = document.createElement('span');
              plus.className = 'shortcut-plus';
              plus.textContent = '+';
              span.appendChild(plus);
            }
            var kbd = document.createElement('kbd');
            kbd.className = 'shortcut-key';
            kbd.textContent = this.formatKey_(keys[m]);
            span.appendChild(kbd);
          }
          return span;
        }.bind(this);

        keysContainer.appendChild(renderKeys(shortcut.keys));

        if (shortcut.altKeys) {
          var orSpan = document.createElement('span');
          orSpan.className = 'shortcut-plus';
          orSpan.style.margin = '0 3px';
          orSpan.textContent = '/';
          keysContainer.appendChild(orSpan);
          keysContainer.appendChild(renderKeys(shortcut.altKeys));
        }

        row.appendChild(labelContainer);
        row.appendChild(keysContainer);
        grid.appendChild(row);
      }

      section.appendChild(grid);
      this.content_.appendChild(section);
    }
  }

  if (!matchedAny) {
    var empty = document.createElement('div');
    empty.className = 'shortcuts-empty-state';

    var emptyIcon = document.createElement('span');
    emptyIcon.className = 'material-icons';
    emptyIcon.style.fontSize = '36px';
    emptyIcon.style.opacity = '0.4';
    emptyIcon.style.display = 'block';
    emptyIcon.style.margin = '0 auto 8px auto';
    emptyIcon.textContent = 'search_off';

    var emptyText = document.createElement('div');
    emptyText.textContent = 'No shortcuts matching "' + query + '"';

    empty.appendChild(emptyIcon);
    empty.appendChild(emptyText);
    this.content_.appendChild(empty);
  }
};

/**
 * Checks whether the shortcuts dialog is currently open.
 * @return {boolean}
 */
ShortcutsController.prototype.isOpen = function() {
  return Boolean(this.dialog_ && this.dialog_.open);
};

/**
 * Opens the shortcuts popup dialog.
 */
ShortcutsController.prototype.open = function() {
  if (!this.dialog_) {
    this.initDom_();
  }

  if (this.isOpen()) return;

  this.lastFocusedElement_ = document.activeElement;

  if (this.searchInput_) {
    this.searchInput_.value = '';
  }
  this.renderShortcuts_('');

  this.dialog_.showModal();

  if (this.searchInput_) {
    setTimeout(function() {
      this.searchInput_.focus();
      this.searchInput_.select();
    }.bind(this), 50);
  }
};

/**
 * Closes the shortcuts popup dialog.
 */
ShortcutsController.prototype.close = function() {
  if (this.isOpen()) {
    this.dialog_.close();
  }
};

/**
 * Handles dialog close cleanup and restores focus.
 * @private
 */
ShortcutsController.prototype.onDialogClosed_ = function() {
  if (this.lastFocusedElement_ && typeof this.lastFocusedElement_.focus === 'function') {
    this.lastFocusedElement_.focus();
  } else if (this.editor_ && typeof this.editor_.focus === 'function') {
    this.editor_.focus();
  }
};
