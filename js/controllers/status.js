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
  this.modeIconEl_ = document.getElementById('status-mode-icon');
  this.modeTextEl_ = document.getElementById('status-mode-text');
  this.encodingEl_ = document.getElementById('status-encoding');

  this.editorEl_ = document.getElementById('editor');
  this.mdPreviewContainer_ = document.getElementById('md-preview-container');
  this.mdPreviewContent_ = document.getElementById('md-preview-content');

  this.isPreviewOn_ = false;

  document.addEventListener('cursoractivity', (e) => this.onCursorActivity_(e.detail || e));
  document.addEventListener('switchtab', (e) => this.onTabSwitched_(e.detail || e));
  document.addEventListener('tabrenamed', (e) => this.onTabSwitched_(e.detail || e));
  document.addEventListener('tabpathchange', (e) => this.onTabSwitched_(e.detail || e));
  document.addEventListener('docchange', () => this.onDocChanged_());

  if (this.lineEndingEl_) {
    this.lineEndingEl_.addEventListener('click', this.toggleLineEnding_.bind(this));
  }

  if (this.modeEl_) {
    this.modeEl_.addEventListener('click', this.onModeClick_.bind(this));
  }

  if (this.mdPreviewContent_) {
    this.mdPreviewContent_.addEventListener('click', function(e) {
      var target = e.target && e.target.closest('a');
      if (target && target.getAttribute('href')) {
        var href = target.getAttribute('href');
        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  this.onTabSwitched_();
}

/**
 * Checks whether the currently active tab has markdown mode or extension.
 * @return {boolean}
 * @private
 */
StatusController.prototype.isCurrentTabMarkdown_ = function() {
  var currentTab = this.tabs_ && this.tabs_.getCurrentTab();
  if (!currentTab || typeof currentTab.getExtension !== 'function') return false;
  var ext = currentTab.getExtension();
  if (!ext) return false;
  ext = ext.toLowerCase();
  var mode = EditorCodeMirror.EXTENSION_TO_MODE && EditorCodeMirror.EXTENSION_TO_MODE[ext];
  return mode === 'markdown' || ext === 'md' || ext === 'markdown';
};

/**
 * Handles click on the Language Mode disclaimer button.
 * @private
 */
StatusController.prototype.onModeClick_ = function() {
  if (!this.isCurrentTabMarkdown_()) {
    return;
  }
  this.isPreviewOn_ = !this.isPreviewOn_;
  this.updateMarkdownState_();
};

/**
 * Updates the Language Mode disclaimer display, icon, and side-by-side preview state.
 * @private
 */
StatusController.prototype.updateMarkdownState_ = function() {
  var isMd = this.isCurrentTabMarkdown_();

  if (this.modeEl_) {
    if (isMd) {
      this.modeEl_.classList.add('status-button');
      this.modeEl_.classList.add('status-mode-md');
      this.modeEl_.setAttribute('aria-pressed', this.isPreviewOn_ ? 'true' : 'false');
      this.modeEl_.title = this.isPreviewOn_
        ? 'Markdown Live Preview: ON (Click to hide preview)'
        : 'Markdown Live Preview: OFF (Click to side-by-side render)';
      if (this.modeIconEl_) {
        this.modeIconEl_.style.display = 'inline-block';
        this.modeIconEl_.src = this.isPreviewOn_ ? 'assets/render_on.svg' : 'assets/render_off.svg';
        this.modeIconEl_.alt = this.isPreviewOn_ ? 'Preview ON' : 'Preview OFF';
      }
      if (this.modeTextEl_) {
        this.modeTextEl_.textContent = 'Markdown';
      }
    } else {
      this.modeEl_.classList.remove('status-button');
      this.modeEl_.classList.remove('status-mode-md');
      this.modeEl_.removeAttribute('aria-pressed');
      if (this.modeIconEl_) {
        this.modeIconEl_.style.display = 'none';
      }
      var currentTab = this.tabs_ && this.tabs_.getCurrentTab();
      var ext = currentTab && typeof currentTab.getExtension === 'function' ? currentTab.getExtension() : '';
      var mode = ext && EditorCodeMirror.EXTENSION_TO_MODE && EditorCodeMirror.EXTENSION_TO_MODE[ext.toLowerCase()];
      var modeName = mode ? this.formatModeName_(mode) : 'Plain Text';
      this.modeEl_.title = 'Language Mode: ' + modeName;
      if (this.modeTextEl_) {
        this.modeTextEl_.textContent = modeName;
      }
    }
  }

  var showPreview = isMd && this.isPreviewOn_;
  if (this.editorEl_) {
    this.editorEl_.classList.toggle('side-by-side-active', showPreview);
  }
  if (this.mdPreviewContainer_) {
    this.mdPreviewContainer_.style.display = showPreview ? 'flex' : 'none';
  }

  if (showPreview) {
    this.renderMarkdown_();
  }

  if (this.editor_ && this.editor_.editorView_ && typeof this.editor_.editorView_.requestMeasure === 'function') {
    this.editor_.editorView_.requestMeasure();
  }
};

/**
 * Renders the markdown content into the preview pane.
 * @private
 */
StatusController.prototype.renderMarkdown_ = function() {
  if (!this.mdPreviewContent_) return;

  var content = '';
  if (this.editor_ && this.editor_.editorView_ && this.editor_.editorView_.state) {
    content = this.editor_.editorView_.state.doc.toString();
  }

  if (!content.trim()) {
    this.mdPreviewContent_.innerHTML = '<div class="md-preview-empty">Live markdown preview will appear here as you type...</div>';
    return;
  }

  var parseFn = window.marked ? (window.marked.parse || (typeof window.marked === 'function' ? window.marked : null)) : null;
  if (parseFn) {
    try {
      this.mdPreviewContent_.innerHTML = parseFn.call(window.marked, content, { gfm: true, breaks: true });
    } catch (e) {
      console.error('Failed to parse markdown:', e);
      this.mdPreviewContent_.textContent = content;
    }
  } else {
    this.mdPreviewContent_.textContent = content;
  }
};

/**
 * Updates the preview when the document content changes.
 * @private
 */
StatusController.prototype.onDocChanged_ = function() {
  if (this.isCurrentTabMarkdown_() && this.isPreviewOn_) {
    this.renderMarkdown_();
  }
};

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

  this.updateMarkdownState_();

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

