/**
 * @constructor
 * @param {EditorView} editorView
 */
function Search(editorView) {
  this.editorView_ = editorView;
  this.query_ = "";
  this.replaceText_ = "";
  // Index of the currently selected match, starting from 0.
  this.index_ = 0;
  this.resultsCount_ = 0;
};

/**
 * @param {string} query
 * Compute resultsCount_ and index_.
 */
Search.prototype.computeResultsCount_ = function(query) {
  query = query.toLowerCase();
  this.index_ = 0;
  this.resultsCount_ = 0;

  if (!query) {
    return;
  }

  let cursor = this.editorView_.state.selection.main.anchor;

  for (let line of this.editorView_.state.doc.iterLines()) {
    const lowerLine = line.toLowerCase();
    let pos = 0;
    while (true) {
      pos = lowerLine.indexOf(query, pos);
      if (pos < 0) {
        break;
      }

      this.resultsCount_++;
      if (pos < cursor) {
        this.index_++;
      }
      // Don't count overlapping matches.
      pos += query.length;
    }

    // This is correct even when the loaded file uses \r\n.
    cursor -= lowerLine.length + 1;
  }
};

/**
 * Reset selection.
 */
Search.prototype.resetSelection_ = function() {
  const cursor = this.editorView_.state.selection.main.anchor;
  this.editorView_.dispatch({
    selection: window.CodeMirror.state.EditorSelection.single(cursor),
  });
};

/**
 * Called when the user focuses the search box.
 */
Search.prototype.activate = function() {
  this.resetSelection_();
  window.CodeMirror.search.openSearchPanel(this.editorView_);
};

/**
 * Called when the user unfocuses the search box.
 */
Search.prototype.deactivate = function() {
  this.find("");
  this.setReplaceText("");
  window.CodeMirror.search.closeSearchPanel(this.editorView_);
};

/**
 * @return {integer}
 * Return current search index.
 */
Search.prototype.getCurrentIndex = function() {
  if (this.resultsCount_ === 0) {
    return 0;
  }
  return (this.index_ % this.resultsCount_) + 1;
};

/**
 * @return {integer}
 * Return total search results.
 */
Search.prototype.getResultsCount = function() {
  return this.resultsCount_;
};

/**
 * @param {string} query Search query, may be empty.
 * Initialize search. This is called every time the search string is updated.
 */
Search.prototype.find = function(query) {
  this.query_ = query;

  this.editorView_.dispatch({
    effects: window.CodeMirror.search.setSearchQuery.of(
      new window.CodeMirror.search.SearchQuery({
        search: query,
        replace: this.replaceText_,
        caseSensitive: false,
        literal: true
      })
    )
  });

  this.computeResultsCount_(query);

  this.resetSelection_();
  if (this.resultsCount_) {
    // Select the first match not before the cursor. We set index_ earlier
    // as if that match was selected.
    this.index_--;
    this.findNext(/*opt_reverse=*/false);
  }
};

/**
 * @param {boolean} opt_reverse
 * Select the next match when user presses Enter in search field or clicks on
 * "Next" and "Previous" search navigation buttons.
 */
Search.prototype.findNext = function(opt_reverse) {
  if (opt_reverse) {
    this.index_ += this.resultsCount_ - 1;
    window.CodeMirror.search.findPrevious(this.editorView_);
  } else {
    this.index_++;
    window.CodeMirror.search.findNext(this.editorView_);
  }

  if (this.resultsCount_ > 0) {
    this.index_ %= this.resultsCount_;
  }
};

/**
 * @param {string} text Replacement text.
 */
Search.prototype.setReplaceText = function(text) {
  this.replaceText_ = text;
  if (this.query_) {
    this.editorView_.dispatch({
      effects: window.CodeMirror.search.setSearchQuery.of(
        new window.CodeMirror.search.SearchQuery({
          search: this.query_,
          replace: this.replaceText_,
          caseSensitive: false,
          literal: true
        })
      )
    });
  }
};

/**
 * @return {string}
 */
Search.prototype.getReplaceText = function() {
  return this.replaceText_;
};

/**
 * Replaces the currently matched/selected occurrence and advances to next match.
 */
Search.prototype.replaceNext = function() {
  if (!this.query_ || this.resultsCount_ === 0) {
    return;
  }

  this.editorView_.dispatch({
    effects: window.CodeMirror.search.setSearchQuery.of(
      new window.CodeMirror.search.SearchQuery({
        search: this.query_,
        replace: this.replaceText_,
        caseSensitive: false,
        literal: true
      })
    )
  });

  const docBefore = this.editorView_.state.doc;
  window.CodeMirror.search.replaceNext(this.editorView_);

  // If CodeMirror only selected the match because it wasn't previously selected,
  // execute replaceNext again so that clicking "Replace" replaces immediately.
  if (this.editorView_.state.doc === docBefore) {
    window.CodeMirror.search.replaceNext(this.editorView_);
  }

  this.computeResultsCount_(this.query_);
};

/**
 * Replaces all occurrences in the document.
 */
Search.prototype.replaceAll = function() {
  if (!this.query_ || this.resultsCount_ === 0) {
    return;
  }

  this.editorView_.dispatch({
    effects: window.CodeMirror.search.setSearchQuery.of(
      new window.CodeMirror.search.SearchQuery({
        search: this.query_,
        replace: this.replaceText_,
        caseSensitive: false,
        literal: true
      })
    )
  });

  window.CodeMirror.search.replaceAll(this.editorView_);
  this.computeResultsCount_(this.query_);
};

/**
 * Get current search query.
 */
Search.prototype.getQuery = function() {
  return this.query_;
};

/**
 * Unfocus search focus the editor.
 */
Search.prototype.unfocus = function() {
  this.editorView_.focus();
};
