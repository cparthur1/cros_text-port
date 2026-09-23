/**
 * @fileoverview HotBar text snippets controller.
 * Supports saving snippets to 10 compartments (1-9, 0) via Alt+C,
 * displaying a horizontal bar with squares containing the first 10 letters of saved snippets,
 * allowing user to click a slot number to overwrite or paste (via Alt+V).
 */

'use strict';

/**
 * @constructor
 * @param {EditorCodeMirror} editor
 */
function HotbarController(editor) {
  this.editor_ = editor;
  this.slots_ = {};
  this.mode_ = 'paste'; // 'save' or 'paste'
  this.pendingSaveText_ = '';

  this.overlay_ = null;
  this.bar_ = null;
  this.squaresContainer_ = null;
  this.modeBadge_ = null;
  this.titleEl_ = null;
  this.descEl_ = null;
  this.bannerEl_ = null;
  this.switchModeBtn_ = null;

  this.boundOnKeydown_ = this.onKeydown_.bind(this);

  this.initSlots_();
  this.initDom_();
  this.attachListeners_();
}

HotbarController.STORAGE_KEY = 'textapp_hotbar_slots';
HotbarController.SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Initializes slots from localStorage.
 * @private
 */
HotbarController.prototype.initSlots_ = function() {
  this.slots_ = {
    '1': '', '2': '', '3': '', '4': '', '5': '',
    '6': '', '7': '', '8': '', '9': '', '0': ''
  };

  try {
    var raw = localStorage.getItem(HotbarController.STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (var i = 0; i < HotbarController.SLOT_KEYS.length; i++) {
          var k = HotbarController.SLOT_KEYS[i];
          if (typeof parsed[k] === 'string') {
            this.slots_[k] = parsed[k];
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load HotBar slots from localStorage:', e);
  }
};

/**
 * Saves current slots to localStorage.
 * @private
 */
HotbarController.prototype.saveSlots_ = function() {
  try {
    localStorage.setItem(HotbarController.STORAGE_KEY, JSON.stringify(this.slots_));
  } catch (e) {
    console.warn('Failed to save HotBar slots to localStorage:', e);
  }
};

/**
 * Gets the text snippet stored in a slot.
 * @param {string|number} key
 * @return {string}
 */
HotbarController.prototype.getSlot = function(key) {
  return this.slots_[String(key)] || '';
};

/**
 * Sets the text snippet for a slot and persists it.
 * @param {string|number} key
 * @param {string} text
 */
HotbarController.prototype.setSlot = function(key, text) {
  var k = String(key);
  if (!HotbarController.SLOT_KEYS.includes(k)) return;
  this.slots_[k] = String(text || '');
  this.saveSlots_();
  this.renderSquares_();
};

/**
 * Clears a specific slot.
 * @param {string|number} key
 */
HotbarController.prototype.clearSlot = function(key) {
  var k = String(key);
  if (!HotbarController.SLOT_KEYS.includes(k)) return;
  this.slots_[k] = '';
  this.saveSlots_();
  this.renderSquares_();
};

/**
 * Clears all compartments.
 */
HotbarController.prototype.clearAll = function() {
  for (var i = 0; i < HotbarController.SLOT_KEYS.length; i++) {
    this.slots_[HotbarController.SLOT_KEYS[i]] = '';
  }
  this.saveSlots_();
  this.renderSquares_();
};

/**
 * Gets first 10 letters of snippet for display in square.
 * @param {string} snippet
 * @return {string}
 * @private
 */
HotbarController.prototype.getPreviewText_ = function(snippet) {
  if (!snippet) return '';
  var clean = snippet.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  var chars = Array.from(clean);
  if (chars.length > 10) {
    return chars.slice(0, 10).join('');
  }
  return clean;
};

/**
 * Truncates string for toast previews.
 * @param {string} str
 * @param {number} maxLen
 * @return {string}
 * @private
 */
HotbarController.prototype.truncate_ = function(str, maxLen) {
  if (!str) return '';
  var oneLine = str.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.substring(0, maxLen - 1) + '…';
};

/**
 * Returns whether the hotbar overlay is currently open.
 * @return {boolean}
 */
HotbarController.prototype.isOpen = function() {
  return !!(this.overlay_ && this.overlay_.classList.contains('open'));
};

/**
 * Builds the HotBar horizontal bar DOM structure.
 * @private
 */
HotbarController.prototype.initDom_ = function() {
  var existing = document.getElementById('hotbar-overlay');
  if (existing) {
    this.overlay_ = existing;
    this.bar_ = document.getElementById('hotbar-bar');
    this.squaresContainer_ = document.getElementById('hotbar-squares-row');
    this.modeBadge_ = document.getElementById('hotbar-mode-badge');
    this.titleEl_ = document.getElementById('hotbar-bar-title');
    this.descEl_ = document.getElementById('hotbar-bar-desc');
    this.bannerEl_ = document.getElementById('hotbar-banner');
    this.switchModeBtn_ = document.getElementById('hotbar-mode-switch-btn');
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'hotbar-overlay';
  overlay.className = 'hotbar-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hotbar-bar-title');

  var backdrop = document.createElement('div');
  backdrop.className = 'hotbar-backdrop';
  backdrop.addEventListener('click', this.closeBar.bind(this));
  overlay.appendChild(backdrop);

  var bar = document.createElement('div');
  bar.id = 'hotbar-bar';
  bar.className = 'hotbar-bar mode-paste';

  // Header
  var header = document.createElement('div');
  header.className = 'hotbar-bar-header';

  var titleWrap = document.createElement('div');
  titleWrap.className = 'hotbar-bar-title-wrap';

  var modeBadge = document.createElement('span');
  modeBadge.id = 'hotbar-mode-badge';
  modeBadge.className = 'hotbar-mode-badge paste';
  modeBadge.textContent = 'Alt + V';

  var title = document.createElement('h2');
  title.id = 'hotbar-bar-title';
  title.className = 'hotbar-bar-title';
  title.textContent = 'Paste from HotBar';

  var desc = document.createElement('span');
  desc.id = 'hotbar-bar-desc';
  desc.className = 'hotbar-bar-desc';
  desc.textContent = 'Click slot 1–0 to paste';

  titleWrap.appendChild(modeBadge);
  titleWrap.appendChild(title);
  titleWrap.appendChild(desc);

  var actionsWrap = document.createElement('div');
  actionsWrap.className = 'hotbar-bar-actions';

  var switchModeBtn = document.createElement('button');
  switchModeBtn.type = 'button';
  switchModeBtn.id = 'hotbar-mode-switch-btn';
  switchModeBtn.className = 'hotbar-mode-switch-btn';
  switchModeBtn.textContent = 'Switch to Save (Alt+C)';
  switchModeBtn.addEventListener('click', function() {
    this.setMode(this.mode_ === 'save' ? 'paste' : 'save');
  }.bind(this));

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.id = 'hotbar-close-btn';
  closeBtn.className = 'hotbar-close-btn';
  closeBtn.setAttribute('aria-label', 'Close HotBar');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', this.closeBar.bind(this));

  actionsWrap.appendChild(switchModeBtn);
  actionsWrap.appendChild(closeBtn);

  header.appendChild(titleWrap);
  header.appendChild(actionsWrap);
  bar.appendChild(header);

  // Status / selection preview banner
  var banner = document.createElement('div');
  banner.id = 'hotbar-banner';
  banner.className = 'hotbar-banner';
  bar.appendChild(banner);

  // Horizontal Squares Row
  var squaresContainer = document.createElement('div');
  squaresContainer.id = 'hotbar-squares-row';
  squaresContainer.className = 'hotbar-squares-row';
  bar.appendChild(squaresContainer);

  // Footer
  var footer = document.createElement('div');
  footer.className = 'hotbar-bar-footer';

  var hints = document.createElement('span');
  hints.className = 'hotbar-footer-hints';
  hints.textContent = 'Press 1–0 on keyboard or click slot number • Esc to cancel';

  var footerActions = document.createElement('div');
  footerActions.className = 'hotbar-footer-actions';

  var clearAllBtn = document.createElement('button');
  clearAllBtn.type = 'button';
  clearAllBtn.className = 'hotbar-clear-all-link';
  clearAllBtn.textContent = 'Clear All';
  clearAllBtn.addEventListener('click', function() {
    this.clearAll();
    util.showToast('All HotBar slots cleared');
  }.bind(this));

  footerActions.appendChild(clearAllBtn);
  footer.appendChild(hints);
  footer.appendChild(footerActions);
  bar.appendChild(footer);

  overlay.appendChild(bar);
  document.body.appendChild(overlay);

  this.overlay_ = overlay;
  this.bar_ = bar;
  this.squaresContainer_ = squaresContainer;
  this.modeBadge_ = modeBadge;
  this.titleEl_ = title;
  this.descEl_ = desc;
  this.bannerEl_ = banner;
  this.switchModeBtn_ = switchModeBtn;
};

/**
 * Escapes text for HTML content safely.
 * @param {string} str
 * @return {string}
 * @private
 */
HotbarController.prototype.escapeHtml_ = function(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Updates the header and banner for current mode.
 * @private
 */
HotbarController.prototype.updateHeader_ = function() {
  if (!this.bar_) return;

  var isSave = this.mode_ === 'save';

  this.bar_.className = 'hotbar-bar ' + (isSave ? 'mode-save' : 'mode-paste');

  if (this.modeBadge_) {
    this.modeBadge_.className = 'hotbar-mode-badge ' + (isSave ? 'save' : 'paste');
    this.modeBadge_.textContent = isSave ? 'Alt + C' : 'Alt + V';
  }

  if (this.titleEl_) {
    this.titleEl_.textContent = isSave ? 'Save to HotBar' : 'Paste from HotBar';
  }

  if (this.descEl_) {
    this.descEl_.textContent = isSave ?
        'Click a slot number to overwrite' :
        'Click a slot number to paste';
  }

  if (this.switchModeBtn_) {
    this.switchModeBtn_.textContent = isSave ?
        'Switch to Paste (Alt+V)' :
        'Switch to Save (Alt+C)';
  }

  if (this.bannerEl_) {
    this.bannerEl_.innerHTML = '';
    var textEl = document.createElement('span');
    textEl.className = 'hotbar-banner-text';

    if (isSave) {
      if (this.pendingSaveText_) {
        textEl.innerHTML = 'Snippet to save: <code class="hotbar-banner-snippet">' +
            this.escapeHtml_(this.truncate_(this.pendingSaveText_, 50)) + '</code>';
      } else {
        textEl.className += ' hotbar-banner-warning';
        textEl.textContent = '⚠ No text selected in editor (select text to save, or click a slot)';
      }
    } else {
      textEl.textContent = 'Click any slot square with text to insert it into the document.';
    }
    this.bannerEl_.appendChild(textEl);
  }
};

/**
 * Renders the 10 square slots in the horizontal bar.
 * @private
 */
HotbarController.prototype.renderSquares_ = function() {
  if (!this.squaresContainer_) return;
  this.squaresContainer_.innerHTML = '';

  var isSave = this.mode_ === 'save';

  for (var i = 0; i < HotbarController.SLOT_KEYS.length; i++) {
    var key = HotbarController.SLOT_KEYS[i];
    var snippet = this.slots_[key] || '';
    var hasSnippet = !!snippet;
    var preview = this.getPreviewText_(snippet);

    var square = document.createElement('button');
    square.type = 'button';
    square.className = 'hotbar-square' + (hasSnippet ? ' has-content' : ' is-empty');
    square.setAttribute('data-slot', key);
    square.setAttribute('aria-label', 'Slot ' + key + (hasSnippet ? ': ' + snippet.substring(0, 30) : ' empty'));

    var tooltip = 'Slot ' + key;
    if (hasSnippet) {
      tooltip += ':\n' + snippet;
    } else {
      tooltip += ' (Empty)';
    }
    square.title = tooltip;

    // Number badge at top
    var num = document.createElement('span');
    num.className = 'hotbar-square-num';
    num.textContent = key;
    square.appendChild(num);

    // Delete button (on hover for slots with content)
    if (hasSnippet) {
      var delBtn = document.createElement('span');
      delBtn.className = 'hotbar-square-del';
      delBtn.title = 'Clear slot ' + key;
      delBtn.setAttribute('aria-label', 'Clear slot ' + key);
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', function(slotKey, e) {
        e.stopPropagation();
        e.preventDefault();
        this.clearSlot(slotKey);
        util.showToast('HotBar [' + slotKey + '] cleared');
      }.bind(this, key));
      square.appendChild(delBtn);
    }

    // First 10 letters preview in the middle
    var textSpan = document.createElement('span');
    textSpan.className = 'hotbar-square-text' + (hasSnippet ? '' : ' hotbar-square-empty');
    textSpan.textContent = hasSnippet ? preview : '—';
    square.appendChild(textSpan);

    // Action indicator at bottom
    var actionSpan = document.createElement('span');
    actionSpan.className = 'hotbar-square-action';
    if (isSave) {
      actionSpan.textContent = 'Save';
    } else {
      actionSpan.textContent = hasSnippet ? 'Paste' : 'Empty';
    }
    square.appendChild(actionSpan);

    // Click on square executes slot action
    square.addEventListener('click', this.handleSlotClick_.bind(this, key));

    // Right-click to clear slot
    square.addEventListener('contextmenu', function(slotKey, e) {
      if (this.getSlot(slotKey)) {
        e.preventDefault();
        this.clearSlot(slotKey);
        util.showToast('HotBar [' + slotKey + '] cleared');
      }
    }.bind(this, key));

    this.squaresContainer_.appendChild(square);
  }
};

/**
 * Handles click on a square slot.
 * @param {string} key
 * @param {!MouseEvent} e
 * @private
 */
HotbarController.prototype.handleSlotClick_ = function(key, e) {
  if (e && e.target && e.target.classList.contains('hotbar-square-del')) {
    return;
  }
  this.handleSlotAction(key);
};

/**
 * Executes the slot action (save or paste) for the given digit key.
 * @param {string|number} digit
 */
HotbarController.prototype.handleSlotAction = function(digit) {
  var key = String(digit);
  if (!HotbarController.SLOT_KEYS.includes(key)) return;

  if (this.mode_ === 'save') {
    var textToSave = this.pendingSaveText_;
    if (!textToSave && this.editor_) {
      textToSave = this.editor_.getSelectedText();
    }
    if (!textToSave) {
      var wSel = window.getSelection();
      if (wSel) textToSave = wSel.toString();
    }

    if (textToSave) {
      this.setSlot(key, textToSave);
      util.showToast('HotBar [' + key + '] saved: "' + this.truncate_(textToSave, 30) + '"');
      this.closeBar();
    } else {
      util.showToast('HotBar [' + key + ']: No text selected to save');
    }
  } else {
    // paste mode
    var snippet = this.getSlot(key);
    if (snippet) {
      if (this.editor_) {
        this.editor_.insertText(snippet);
      }
      this.closeBar();
      util.showToast('HotBar [' + key + '] pasted: "' + this.truncate_(snippet, 30) + '"');
    } else {
      util.showToast('HotBar [' + key + '] is empty');
    }
  }
};

/**
 * Changes active mode ('save' or 'paste') and re-renders.
 * @param {string} mode
 */
HotbarController.prototype.setMode = function(mode) {
  this.mode_ = mode === 'save' ? 'save' : 'paste';
  if (this.mode_ === 'save' && !this.pendingSaveText_) {
    this.captureSelection_();
  }
  this.updateHeader_();
  this.renderSquares_();
};

/**
 * Captures current editor selection for saving.
 * @private
 */
HotbarController.prototype.captureSelection_ = function() {
  var sel = '';
  if (this.editor_ && typeof this.editor_.getSelectedText === 'function') {
    sel = this.editor_.getSelectedText();
  }
  if (!sel) {
    var winSel = window.getSelection();
    if (winSel) sel = winSel.toString();
  }
  this.pendingSaveText_ = sel;
};

/**
 * Sets up listeners for shortcuts and sidebar button.
 * @private
 */
HotbarController.prototype.attachListeners_ = function() {
  // Capture phase ensures we intercept before CM6 or other handlers consume keys
  document.addEventListener('keydown', this.boundOnKeydown_, true);

  var openBtn = document.getElementById('open-hotbar');
  if (openBtn) {
    openBtn.addEventListener('click', this.toggleBar.bind(this, null));
  }

  // Also support custom events triggered by HotkeysController
  document.addEventListener('openhotbarcopy', function() {
    this.triggerCopy_();
  }.bind(this));

  document.addEventListener('openhotbarpaste', function() {
    this.triggerPaste_();
  }.bind(this));
};

/**
 * Extracts digit 0-9 from a keyboard event.
 * @param {!KeyboardEvent} e
 * @return {string|null}
 * @private
 */
HotbarController.prototype.getDigit_ = function(e) {
  if (e.key && /^[0-9]$/.test(e.key)) return e.key;
  var mCode = e.code && e.code.match(/^Digit([0-9])$/);
  if (mCode) return mCode[1];
  var mNum = e.code && e.code.match(/^Numpad([0-9])$/);
  if (mNum) return mNum[1];
  return null;
};

/**
 * Triggers Alt+C (save mode) hotbar opening.
 * @private
 */
HotbarController.prototype.triggerCopy_ = function() {
  if (this.isOpen() && this.mode_ === 'save') {
    this.closeBar();
    return;
  }
  this.captureSelection_();
  this.openBar('save');
};

/**
 * Triggers Alt+V (paste mode) hotbar opening.
 * @private
 */
HotbarController.prototype.triggerPaste_ = function() {
  if (this.isOpen() && this.mode_ === 'paste') {
    this.closeBar();
    return;
  }
  this.openBar('paste');
};

/**
 * Main keydown handler for hotbar opening, slot actions, and modal navigation.
 * @param {!KeyboardEvent} e
 * @private
 */
HotbarController.prototype.onKeydown_ = function(e) {
  var isPureAlt = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

  // 1. If hotbar is already open:
  if (this.isOpen()) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeBar();
      return;
    }

    // Toggle with Alt+C while open
    if (isPureAlt && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      e.preventDefault();
      e.stopPropagation();
      if (this.mode_ === 'save') {
        this.closeBar();
      } else {
        this.captureSelection_();
        this.setMode('save');
      }
      return;
    }

    // Toggle with Alt+V while open
    if (isPureAlt && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
      e.preventDefault();
      e.stopPropagation();
      if (this.mode_ === 'paste') {
        this.closeBar();
      } else {
        this.setMode('paste');
      }
      return;
    }

    // Number keys [1-9, 0] trigger slot action
    var digit = this.getDigit_(e);
    if (digit !== null) {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotAction(digit);
      return;
    }

    return;
  }

  // 2. If hotbar is closed:
  if (isPureAlt) {
    // Alt+C: Open horizontal bar to save / overwrite snippet
    if (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') {
      e.preventDefault();
      e.stopPropagation();
      this.triggerCopy_();
      return;
    }

    // Alt+V: Open horizontal bar to paste snippet
    if (e.key === 'v' || e.key === 'V' || e.code === 'KeyV') {
      e.preventDefault();
      e.stopPropagation();
      this.triggerPaste_();
      return;
    }
  }
};

/**
 * Opens the HotBar horizontal bar.
 * @param {string=} opt_mode 'save' or 'paste'
 */
HotbarController.prototype.openBar = function(opt_mode) {
  if (!this.overlay_) this.initDom_();
  if (opt_mode) {
    this.mode_ = opt_mode === 'save' ? 'save' : 'paste';
  }
  this.updateHeader_();
  this.renderSquares_();
  this.overlay_.classList.add('open');
};

/**
 * Closes the HotBar horizontal bar.
 */
HotbarController.prototype.closeBar = function() {
  if (this.overlay_) {
    this.overlay_.classList.remove('open');
  }
  this.pendingSaveText_ = '';
  if (this.editor_ && typeof this.editor_.focus === 'function') {
    this.editor_.focus();
  }
};

/**
 * Toggles the horizontal bar open or closed.
 * @param {string=} opt_mode
 */
HotbarController.prototype.toggleBar = function(opt_mode) {
  if (this.isOpen()) {
    this.closeBar();
  } else {
    var mode = opt_mode;
    if (!mode) {
      var sel = this.editor_ ? this.editor_.getSelectedText() : '';
      if (!sel) {
        var winSel = window.getSelection();
        if (winSel) sel = winSel.toString();
      }
      if (sel) {
        this.pendingSaveText_ = sel;
        mode = 'save';
      } else {
        mode = 'paste';
      }
    }
    this.openBar(mode);
  }
};

// Aliases for compatibility
HotbarController.prototype.openModal = function() {
  this.openBar('paste');
};
HotbarController.prototype.closeModal = function() {
  this.closeBar();
};
HotbarController.prototype.toggleModal = function() {
  this.toggleBar();
};
