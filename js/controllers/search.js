/**
 * @constructor
 */
function SearchController(search) {
  this.search_ = search;

  // When there is an active text selection, focusing the search box with the
  // mouse seems to trigger a recursive focus/focusout pair. It would be good
  // to understand why but for now drop the extra events to prevent errors.
  this.activating_ = false;

  this.searchInput_ = document.getElementById('search-input');
  this.replaceInput_ = document.getElementById('replace-input');
  this.searchCounting_ = document.getElementById('search-counting');
  this.searchContainer_ = document.querySelector('.search-container');
  this.header_ = document.querySelector('header');

  if (this.searchInput_) {
    this.searchInput_.addEventListener('focus', () => { this.activateSearch_(); });
    this.searchInput_.addEventListener('input', this.onChange_.bind(this));
    this.searchInput_.addEventListener('keydown', this.onKeydown_.bind(this));
  }

  // Prevent search deactivation when search count is clicked
  if (this.searchCounting_) {
    this.searchCounting_.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  var nextBtn = document.getElementById('search-next-button');
  if (nextBtn) nextBtn.addEventListener('click', this.onFindNext_.bind(this));

  var prevBtn = document.getElementById('search-previous-button');
  if (prevBtn) prevBtn.addEventListener('click', this.onFindPrevious_.bind(this));

  var toggleReplaceBtn = document.getElementById('search-toggle-replace');
  if (toggleReplaceBtn) toggleReplaceBtn.addEventListener('click', this.toggleReplace_.bind(this));

  if (this.replaceInput_) {
    this.replaceInput_.addEventListener('input', this.onReplaceChange_.bind(this));
    this.replaceInput_.addEventListener('keydown', this.onReplaceKeydown_.bind(this));
  }

  var replaceBtn = document.getElementById('replace-button');
  if (replaceBtn) replaceBtn.addEventListener('click', this.onReplaceNext_.bind(this));

  var replaceAllBtn = document.getElementById('replace-all-button');
  if (replaceAllBtn) replaceAllBtn.addEventListener('click', this.onReplaceAll_.bind(this));

  if (this.searchContainer_) {
    this.searchContainer_.addEventListener('focusout', this.deactivateSearch_.bind(this));
  }

  document.addEventListener('opensearch', this.activateSearch_.bind(this));
  document.addEventListener('openreplace', this.activateReplace_.bind(this));
}

/** @return {number} Number of search results. */
SearchController.prototype.updateSearchCount_ = function() {
  if (!this.searchInput_ || this.searchInput_.value.length === 0) {
    if (this.searchCounting_) this.searchCounting_.textContent = '';
    return 0;
  }
  var searchCount = this.search_.getResultsCount();
  var searchIndex = this.search_.getCurrentIndex();
  if (this.searchCounting_) {
    this.searchCounting_.textContent = chrome.i18n.getMessage('searchCounting',
        [searchIndex, searchCount]);
    if (searchCount === 0) {
      this.searchCounting_.classList.add('nomatches');
    } else {
      this.searchCounting_.classList.remove('nomatches');
    }
  }
  return searchCount;
};

SearchController.prototype.findNext_ = function(opt_reverse) {
  if (this.search_.getQuery()) {
    this.search_.findNext(opt_reverse);
    this.updateSearchCount_(opt_reverse);
  }
};

/**
 * Moves focus to the search input and shows all search UI elements.
 * @private
 */
SearchController.prototype.activateSearch_ = function() {
  if (this.activating_) {
    return;
  }

  this.activating_ = true;
  this.search_.activate();
  if (this.searchInput_) {
    this.searchInput_.select();
  }
  if (this.header_) {
    this.header_.classList.add('search-active');
  }
  this.activating_ = false;
};

/**
 * Opens search and activates replace mode.
 * @private
 */
SearchController.prototype.activateReplace_ = function() {
  this.activateSearch_();
  if (this.searchContainer_) {
    this.searchContainer_.classList.add('replace-active');
  }
  if (this.searchInput_ && this.searchInput_.value.length > 0) {
    if (this.replaceInput_) {
      this.replaceInput_.focus();
      this.replaceInput_.select();
    }
  } else if (this.searchInput_) {
    this.searchInput_.focus();
  }
};

/**
 * Toggles replace mode on or off.
 * @private
 */
SearchController.prototype.toggleReplace_ = function() {
  if (this.searchContainer_ && this.searchContainer_.classList.contains('replace-active')) {
    this.searchContainer_.classList.remove('replace-active');
    if (this.searchInput_) this.searchInput_.focus();
  } else {
    this.activateReplace_();
  }
};

SearchController.prototype.deactivateSearch_ = function(e) {
  if (this.activating_) {
    return;
  }

  // relatedTarget is null if the element clicked on can't receive focus
  if (!e.relatedTarget || !e.relatedTarget.closest('.search-container')) {
    if (this.searchInput_) this.searchInput_.value = '';
    if (this.replaceInput_) this.replaceInput_.value = '';
    if (this.searchCounting_) this.searchCounting_.textContent = '';
    if (this.header_) this.header_.classList.remove('search-active');
    if (this.searchContainer_) this.searchContainer_.classList.remove('replace-active');
    var navBtns = document.querySelectorAll('.search-navigation-button');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.remove('has-results');
    }
    this.search_.setReplaceText('');
    this.search_.deactivate();
  }
};

SearchController.prototype.onChange_ = function() {
  var searchString = this.searchInput_ ? this.searchInput_.value : '';
  if (searchString === this.search_.getQuery())
    return;

  this.search_.find(searchString);
  const numResults = this.updateSearchCount_();

  // Only show the Prev and Next buttons if there are search results.
  var navBtns = document.querySelectorAll('.search-navigation-button');
  for (var i = 0; i < navBtns.length; i++) {
    if (numResults > 0) {
      navBtns[i].classList.add('has-results');
    } else {
      navBtns[i].classList.remove('has-results');
    }
  }
};

SearchController.prototype.onReplaceChange_ = function() {
  if (this.replaceInput_) {
    this.search_.setReplaceText(this.replaceInput_.value);
  }
};

SearchController.prototype.onKeydown_ = function(e) {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation();
      this.findNext_(e.shiftKey /* reverse */);
      break;

    case 'Escape':
      e.stopPropagation();
      this.search_.unfocus();
      break;
  }
};

SearchController.prototype.onReplaceKeydown_ = function(e) {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation();
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || (e.altKey && e.ctrlKey)) {
        this.onReplaceAll_();
      } else {
        this.onReplaceNext_();
      }
      break;

    case 'Escape':
      e.stopPropagation();
      this.search_.unfocus();
      break;
  }
};

SearchController.prototype.onFindNext_ = function() {
  this.findNext_();
};

SearchController.prototype.onFindPrevious_ = function() {
  this.findNext_(true /* reverse */);
};

SearchController.prototype.onReplaceNext_ = function() {
  this.search_.replaceNext();
  const numResults = this.updateSearchCount_();
  var navBtns = document.querySelectorAll('.search-navigation-button');
  for (var i = 0; i < navBtns.length; i++) {
    if (numResults > 0) {
      navBtns[i].classList.add('has-results');
    } else {
      navBtns[i].classList.remove('has-results');
    }
  }
};

SearchController.prototype.onReplaceAll_ = function() {
  this.search_.replaceAll();
  this.updateSearchCount_();
  var navBtns = document.querySelectorAll('.search-navigation-button');
  for (var i = 0; i < navBtns.length; i++) {
    navBtns[i].classList.remove('has-results');
  }
};
