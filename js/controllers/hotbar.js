/**
 * @fileoverview HotBar text snippets controller.
 * Supports saving snippets to 10 compartments (1-9, 0) via Shift+C+[0-9],
 * and pasting snippets from compartments via Shift+V+[0-9].
 * Provides a HotBar Status modal accessible from the sidebar button.
 */

'use strict';

/**
 * @constructor
 * @param {EditorCodeMirror} editor
 */
function HotbarController(editor) {
  this.editor_ = editor;
  this.slots_ = {};
  this.pending_ = null;
  this.pendingTimer_ = null;
  this.modal_ = null;
  this.slotsContainer_ = null;

  this.boundOnKeydown_ = this.onKeydown_.bind(this);
  this.boundOnMousedown_ = this.onMousedown_.bind(this);

  this.initSlots_();
  this.initDom_();
  this.attachListeners_();
}

HotbarController.STORAGE_KEY = 'textapp_hotbar_slots';
HotbarController.SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
HotbarController.CHORD_TIMEOUT_MS = 1500;

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
  this.renderModalSlots_();
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
  this.renderModalSlots_();
};

/**
 * Clears all compartments.
 */
HotbarController.prototype.clearAll = function() {
  for (var i = 0; i < HotbarController.SLOT_KEYS.length; i++) {
    this.slots_[HotbarController.SLOT_KEYS[i]] = '';
  }
  this.saveSlots_();
  this.renderModalSlots_();
};

/**
 * Sets up listeners for shortcuts and sidebar button.
 * @private
 */
HotbarController.prototype.attachListeners_ = function() {
  // Capture phase ensures we intercept before CM6 or other handlers consume keys
  document.addEventListener('keydown', this.boundOnKeydown_, true);
  document.addEventListener('mousedown', this.boundOnMousedown_, true);

  var openBtn = document.getElementById('open-hotbar');
  if (openBtn) {
    openBtn.addEventListener('click', this.toggleModal.bind(this));
  }
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
 * Main keydown handler for chord detection and modal navigation.
 * @param {!KeyboardEvent} e
 * @private
 */
HotbarController.prototype.onKeydown_ = function(e) {
  // Handle Escape to close modal if open
  if (this.modal_ && this.modal_.classList.contains('open')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeModal();
      return;
    }
    return;
  }

  // Ignore keystrokes in standalone input fields (e.g. search, replace)
  var target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }

  var isShift = e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

  // 1. Check for Shift+C (Copy chord initiation)
  if (isShift && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
    var inEditor = !!(this.editor_ && this.editor_.editorView_ && (
      this.editor_.editorView_.hasFocus ||
      (this.editor_.editorView_.dom && this.editor_.editorView_.dom.contains(document.activeElement))
    ));

    var sel = '';
    if (this.editor_ && typeof this.editor_.getSelectedText === 'function') {
      sel = this.editor_.getSelectedText();
    }
    if (!sel) {
      var winSel = window.getSelection();
      if (winSel) sel = winSel.toString();
    }

    if (this.pending_ && this.pending_.inEditor && this.editor_ && typeof this.editor_.undo === 'function') {
      this.editor_.undo();
    }

    this.pending_ = {
      action: 'copy',
      time: Date.now(),
      text: sel,
      inEditor: inEditor
    };
    this.startPendingTimer_();
    // Do not preventDefault: normal typing of capital 'C' proceeds if no number follows
    return;
  }

  // 2. Check for Shift+V (Paste chord initiation)
  if (isShift && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
    var inEditor = !!(this.editor_ && this.editor_.editorView_ && (
      this.editor_.editorView_.hasFocus ||
      (this.editor_.editorView_.dom && this.editor_.editorView_.dom.contains(document.activeElement))
    ));

    if (this.pending_ && this.pending_.inEditor && this.editor_ && typeof this.editor_.undo === 'function') {
      this.editor_.undo();
    }

    this.pending_ = {
      action: 'paste',
      time: Date.now(),
      inEditor: inEditor
    };
    this.startPendingTimer_();
    // Do not preventDefault: normal typing of capital 'V' proceeds if no number follows
    return;
  }

  // 3. If a HotBar chord is pending:
  if (this.pending_) {
    var digit = this.getDigit_(e);
    if (digit !== null) {
      var action = this.pending_.action;
      var pending = this.pending_;

      // If copy action had no selected text and Shift was not held on digit, treat as normal typing (e.g. typing "C1")
      if (action === 'copy' && !pending.text && !e.shiftKey) {
        this.clearPending_();
        return;
      }

      // If paste action has empty slot and Shift was not held on digit, treat as normal typing (e.g. typing "V1")
      if (action === 'paste' && !this.getSlot(digit) && !e.shiftKey) {
        this.clearPending_();
        return;
      }

      // Consume the digit key
      e.preventDefault();
      e.stopPropagation();
      this.clearPending_();

      if (action === 'copy') {
        if (pending.inEditor && this.editor_ && typeof this.editor_.undo === 'function') {
          // Revert the 'C' that replaced the selection or was typed
          this.editor_.undo();
        }

        var textToSave = pending.text;
        if (!textToSave && this.editor_) {
          textToSave = this.editor_.getSelectedText();
        }
        if (!textToSave) {
          var wSel = window.getSelection();
          if (wSel) textToSave = wSel.toString();
        }

        if (textToSave) {
          this.setSlot(digit, textToSave);
          util.showToast('HotBar [' + digit + '] saved: "' + this.truncate_(textToSave, 30) + '"');
        } else {
          util.showToast('HotBar [' + digit + ']: No text selected to save');
        }
      } else if (action === 'paste') {
        if (pending.inEditor && this.editor_ && typeof this.editor_.undo === 'function') {
          // Revert the 'V' that was typed
          this.editor_.undo();
        }
        var snippet = this.getSlot(digit);
        if (snippet) {
          if (this.editor_) {
            this.editor_.insertText(snippet);
          }
          util.showToast('HotBar [' + digit + '] pasted: "' + this.truncate_(snippet, 30) + '"');
        } else {
          util.showToast('HotBar [' + digit + '] is empty');
        }
      }
      return;
    } else {
      // Modifier keys alone (Control, Meta, Shift, Alt) do not cancel chord
      if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift' || e.key === 'Alt') {
        return;
      }
      // Any other regular key cancels the pending chord immediately
      this.clearPending_();
    }
  }
};

/**
 * Mouse clicks cancel pending chord.
 * @param {!MouseEvent} e
 * @private
 */
HotbarController.prototype.onMousedown_ = function(e) {
  if (this.pending_) {
    this.clearPending_();
  }
};

/**
 * Starts countdown timer for pending chord.
 * @private
 */
HotbarController.prototype.startPendingTimer_ = function() {
  if (this.pendingTimer_) clearTimeout(this.pendingTimer_);
  this.pendingTimer_ = setTimeout(function() {
    this.pending_ = null;
    this.pendingTimer_ = null;
  }.bind(this), HotbarController.CHORD_TIMEOUT_MS);
};

/**
 * Clears pending chord state.
 * @private
 */
HotbarController.prototype.clearPending_ = function() {
  if (this.pendingTimer_) {
    clearTimeout(this.pendingTimer_);
    this.pendingTimer_ = null;
  }
  this.pending_ = null;
};

/**
 * Builds the HotBar Status modal DOM structure.
 * @private
 */
HotbarController.prototype.initDom_ = function() {
  var existing = document.getElementById('hotbar-modal');
  if (existing) {
    this.modal_ = existing;
    this.slotsContainer_ = document.getElementById('hotbar-slots-container');
    return;
  }

  var modal = document.createElement('div');
  modal.id = 'hotbar-modal';
  modal.className = 'hotbar-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'hotbar-modal-title');

  var backdrop = document.createElement('div');
  backdrop.className = 'hotbar-modal-backdrop';
  backdrop.addEventListener('click', this.closeModal.bind(this));
  modal.appendChild(backdrop);

  var windowEl = document.createElement('div');
  windowEl.className = 'hotbar-modal-window';

  // Header
  var header = document.createElement('div');
  header.className = 'hotbar-modal-header';

  var titleWrap = document.createElement('div');
  titleWrap.className = 'hotbar-modal-title-wrap';

  var title = document.createElement('h2');
  title.id = 'hotbar-modal-title';
  title.textContent = 'HotBar Status';

  var subtitle = document.createElement('span');
  subtitle.className = 'hotbar-subtitle';
  subtitle.textContent = '10 Quick compartments for repeating text snippets';

  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  var closeBtn = document.createElement('button');
  closeBtn.id = 'hotbar-close-btn';
  closeBtn.className = 'hotbar-close-btn';
  closeBtn.setAttribute('aria-label', 'Close HotBar');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', this.closeModal.bind(this));

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  windowEl.appendChild(header);

  // Shortcut Instructions Banner
  var helpBanner = document.createElement('div');
  helpBanner.className = 'hotbar-help-banner';

  var helpSave = document.createElement('div');
  helpSave.className = 'hotbar-help-item';
  helpSave.innerHTML = '<span class="hotbar-help-kbd">Shift + C + [0-9]</span><span class="hotbar-help-desc">Save selection to slot</span>';

  var helpDiv = document.createElement('div');
  helpDiv.className = 'hotbar-help-divider';

  var helpPaste = document.createElement('div');
  helpPaste.className = 'hotbar-help-item';
  helpPaste.innerHTML = '<span class="hotbar-help-kbd">Shift + V + [0-9]</span><span class="hotbar-help-desc">Paste snippet to file</span>';

  helpBanner.appendChild(helpSave);
  helpBanner.appendChild(helpDiv);
  helpBanner.appendChild(helpPaste);
  windowEl.appendChild(helpBanner);

  // Slots Container
  var slotsContainer = document.createElement('div');
  slotsContainer.id = 'hotbar-slots-container';
  slotsContainer.className = 'hotbar-slots-container';
  windowEl.appendChild(slotsContainer);
  this.slotsContainer_ = slotsContainer;

  // Footer
  var footer = document.createElement('div');
  footer.className = 'hotbar-modal-footer';

  var clearAllBtn = document.createElement('button');
  clearAllBtn.id = 'hotbar-clear-all-btn';
  clearAllBtn.className = 'hotbar-footer-btn';
  clearAllBtn.textContent = 'Clear All';
  clearAllBtn.addEventListener('click', function() {
    this.clearAll();
    util.showToast('All HotBar slots cleared');
  }.bind(this));

  var footerCloseBtn = document.createElement('button');
  footerCloseBtn.id = 'hotbar-footer-close-btn';
  footerCloseBtn.className = 'hotbar-footer-btn hotbar-footer-close';
  footerCloseBtn.textContent = 'Close';
  footerCloseBtn.addEventListener('click', this.closeModal.bind(this));

  footer.appendChild(clearAllBtn);
  footer.appendChild(footerCloseBtn);
  windowEl.appendChild(footer);

  modal.appendChild(windowEl);
  document.body.appendChild(modal);

  this.modal_ = modal;
};

/**
 * Renders the 10 compartment rows in the modal.
 * @private
 */
HotbarController.prototype.renderModalSlots_ = function() {
  if (!this.slotsContainer_) return;
  this.slotsContainer_.innerHTML = '';

  for (var i = 0; i < HotbarController.SLOT_KEYS.length; i++) {
    var key = HotbarController.SLOT_KEYS[i];
    var snippet = this.slots_[key] || '';
    var row = document.createElement('div');
    row.className = 'hotbar-slot-row' + (snippet ? ' has-content' : ' is-empty');
    row.setAttribute('data-slot', key);

    // Badge
    var badge = document.createElement('div');
    badge.className = 'hotbar-slot-badge';

    var num = document.createElement('span');
    num.className = 'hotbar-slot-num';
    num.textContent = key;

    var chord = document.createElement('span');
    chord.className = 'hotbar-slot-chord';
    chord.textContent = 'Shift+C/V+' + key;

    badge.appendChild(num);
    badge.appendChild(chord);
    row.appendChild(badge);

    // Content preview
    var contentWrap = document.createElement('div');
    contentWrap.className = 'hotbar-slot-content';

    if (snippet) {
      var pre = document.createElement('pre');
      pre.className = 'hotbar-snippet-preview';
      pre.textContent = snippet;
      contentWrap.appendChild(pre);
    } else {
      var emptyNotice = document.createElement('span');
      emptyNotice.className = 'hotbar-empty-placeholder';
      emptyNotice.textContent = '(Empty - select text and press Shift+C+' + key + ')';
      contentWrap.appendChild(emptyNotice);
    }
    row.appendChild(contentWrap);

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'hotbar-slot-actions';

    if (snippet) {
      // Paste button
      var pasteBtn = document.createElement('button');
      pasteBtn.className = 'hotbar-action-btn hotbar-paste-btn';
      pasteBtn.title = 'Paste snippet into editor';
      pasteBtn.textContent = 'Paste';
      pasteBtn.addEventListener('click', this.handleActionPaste_.bind(this, key));
      actions.appendChild(pasteBtn);

      // Copy button
      var copyBtn = document.createElement('button');
      copyBtn.className = 'hotbar-action-btn hotbar-copy-btn';
      copyBtn.title = 'Copy snippet to system clipboard';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', this.handleActionCopy_.bind(this, key));
      actions.appendChild(copyBtn);

      // Clear button
      var clearBtn = document.createElement('button');
      clearBtn.className = 'hotbar-action-btn hotbar-clear-btn';
      clearBtn.title = 'Clear this slot';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', this.handleActionClear_.bind(this, key));
      actions.appendChild(clearBtn);
    }

    row.appendChild(actions);
    this.slotsContainer_.appendChild(row);
  }
};

/**
 * Handles modal paste action.
 * @param {string} key
 * @private
 */
HotbarController.prototype.handleActionPaste_ = function(key) {
  var snippet = this.getSlot(key);
  if (snippet && this.editor_) {
    this.editor_.insertText(snippet);
    this.closeModal();
    util.showToast('HotBar [' + key + '] pasted');
  }
};

/**
 * Handles modal copy action.
 * @param {string} key
 * @private
 */
HotbarController.prototype.handleActionCopy_ = function(key) {
  var snippet = this.getSlot(key);
  if (snippet) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(snippet).then(function() {
        util.showToast('HotBar [' + key + '] copied to clipboard');
      }).catch(function() {
        util.showToast('HotBar [' + key + '] copied');
      });
    } else {
      util.showToast('HotBar [' + key + '] copied');
    }
  }
};

/**
 * Handles modal clear action.
 * @param {string} key
 * @private
 */
HotbarController.prototype.handleActionClear_ = function(key) {
  this.clearSlot(key);
  util.showToast('HotBar [' + key + '] cleared');
};

/**
 * Opens the HotBar Status modal.
 */
HotbarController.prototype.openModal = function() {
  if (!this.modal_) this.initDom_();
  this.renderModalSlots_();
  this.modal_.classList.add('open');
};

/**
 * Closes the HotBar Status modal.
 */
HotbarController.prototype.closeModal = function() {
  if (this.modal_) {
    this.modal_.classList.remove('open');
  }
  if (this.editor_ && typeof this.editor_.focus === 'function') {
    this.editor_.focus();
  }
};

/**
 * Toggles the modal open or closed.
 */
HotbarController.prototype.toggleModal = function() {
  if (this.modal_ && this.modal_.classList.contains('open')) {
    this.closeModal();
  } else {
    this.openModal();
  }
};
