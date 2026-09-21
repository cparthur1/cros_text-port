'use strict';

/**
 * @constructor
 * @param {EditorCodeMirror} editor
 * @param {Tabs} tabs
 */
function StatusController(editor, tabs) {
  this.editor_ = editor;
  this.tabs_ = tabs;

  this.cursorEl_ = document.getElementById('status-cursor');
  this.selectionEl_ = document.getElementById('status-selection');
  this.statsEl_ = document.getElementById('status-stats');
  this.lineEndingEl_ = document.getElementById('status-line-ending');
  this.modeEl_ = document.getElementById('status-mode');
  this.encodingEl_ = document.getElementById('status-encoding');

  document.addEventListener('cursoractivity', (e) => this.onCursorActivity_(e.detail || e));
  document.addEventListener('switchtab', (e) => this.onTabSwitched_(e.detail || e));
  document.addEventListener('tabrenamed', (e) => this.onTabSwitched_(e.detail || e));
  document.addEventListener('tabpathchange', (e) => this.onTabSwitched_(e.detail || e));

  if (this.lineEndingEl_) {
    this.lineEndingEl_.addEventListener('click', this.toggleLineEnding_.bind(this));
  }
}

/**
 * Handles cursor position, selection, and document stats changes.
 * @param {Event|Object} e
 * @param {Object=} opt_data
 * @private
 */
StatusController.prototype.onCursorActivity_ = function(e, opt_data) {
  var data = opt_data || (e && e.detail) || e;
  if (!data) return;

  if (this.cursorEl_) {
    this.cursorEl_.textContent = 'Ln ' + data.line + ', Col ' + data.col;
  }

  if (this.selectionEl_) {
    if (data.selection) {
      this.selectionEl_.textContent = '(' + data.selection + ')';
      this.selectionEl_.style.display = 'inline-flex';
    } else {
      this.selectionEl_.style.display = 'none';
      this.selectionEl_.textContent = '';
    }
  }

  if (this.statsEl_) {
    var words = data.words || 0;
    var chars = data.chars || 0;
    var wordLabel = words === 1 ? 'word' : 'words';
    var charLabel = chars === 1 ? 'char' : 'chars';
    this.statsEl_.textContent = words.toLocaleString() + ' ' + wordLabel + ', ' +
                                chars.toLocaleString() + ' ' + charLabel;
  }
};

/**
 * Formats a mode name for display in the status bar.
 * @param {string} mode
 * @return {string}
 * @private
 */
StatusController.prototype.formatModeName_ = function(mode) {
  var modeNames = {
    'javascript': 'JavaScript',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'markdown': 'Markdown',
    'python': 'Python',
    'cpp': 'C++',
    'c': 'C',
    'java': 'Java',
    'xml': 'XML',
    'sql': 'SQL',
    'php': 'PHP',
    'rust': 'Rust',
    'go': 'Go',
    'yaml': 'YAML',
    'shell': 'Shell'
  };
  return modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
};

/**
 * Handles tab switch and updates tab-specific status bar values.
 * @param {Event} e
 * @param {Tab=} opt_tab
 * @private
 */
StatusController.prototype.onTabSwitched_ = function(opt_e, opt_tab) {
  var currentTab = opt_tab || (opt_e && opt_e.detail) || (this.tabs_ && this.tabs_.getCurrentTab());
  if (!currentTab || typeof currentTab.getExtension !== 'function') {
    currentTab = this.tabs_ && this.tabs_.getCurrentTab();
  }
  if (!currentTab) return;

  if (this.lineEndingEl_) {
    var endings = currentTab.lineEndings_ || '\n';
    this.lineEndingEl_.textContent = endings === '\r\n' ? 'CRLF' : 'LF';
  }

  if (this.modeEl_) {
    var ext = currentTab.getExtension();
    var mode = ext && EditorCodeMirror.EXTENSION_TO_MODE && EditorCodeMirror.EXTENSION_TO_MODE[ext];
    this.modeEl_.textContent = mode ? this.formatModeName_(mode) : 'Plain Text';
  }

  if (this.encodingEl_) {
    this.encodingEl_.textContent = 'UTF-8';
  }

  if (this.editor_ && this.editor_.updateStatus_) {
    this.editor_.updateStatus_();
  }
};

/**
 * Toggles line endings between LF and CRLF for the current tab.
 * @private
 */
StatusController.prototype.toggleLineEnding_ = function() {
  var currentTab = this.tabs_ && this.tabs_.getCurrentTab();
  if (!currentTab) return;

  var current = currentTab.lineEndings_ || '\n';
  currentTab.lineEndings_ = current === '\r\n' ? '\n' : '\r\n';

  if (this.lineEndingEl_) {
    this.lineEndingEl_.textContent = currentTab.lineEndings_ === '\r\n' ? 'CRLF' : 'LF';
  }

  currentTab.changed();
  this.tabs_.saveSession_();
};
