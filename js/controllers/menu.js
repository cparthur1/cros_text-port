/**
 * @constructor
 */
function MenuController(tabs) {
  this.tabs_ = tabs;
  this.dragItem_ = null;

  var newBtn = document.getElementById('file-menu-new');
  if (newBtn) newBtn.addEventListener('click', this.newTab_.bind(this));

  var openBtn = document.getElementById('file-menu-open');
  if (openBtn) openBtn.addEventListener('click', this.open_.bind(this));

  var saveBtn = document.getElementById('file-menu-save');
  if (saveBtn) saveBtn.addEventListener('click', this.save_.bind(this));

  var saveasBtn = document.getElementById('file-menu-saveas');
  if (saveasBtn) saveasBtn.addEventListener('click', this.saveas_.bind(this));

  var shortcutsBtn = document.getElementById('open-shortcuts');
  if (shortcutsBtn) shortcutsBtn.addEventListener('click', this.openShortcuts_.bind(this));

  document.addEventListener('newtab', (e) => this.addNewTab_(this.resolveTab_(e)));
  document.addEventListener('switchtab', (e) => this.onSwitchTab(this.resolveTab_(e)));
  document.addEventListener('tabchange', (e) => this.onTabChange(this.resolveTab_(e)));
  document.addEventListener('tabclosed', (e) => this.onTabClosed(this.resolveTab_(e)));
  document.addEventListener('tabpathchange', (e) => this.onTabPathChange(this.resolveTab_(e)));
  document.addEventListener('tabrenamed', (e) => this.onTabRenamed(this.resolveTab_(e)));
  document.addEventListener('tabmissingchange', (e) => this.onTabMissingChange(this.resolveTab_(e)));
  document.addEventListener('tabsave', (e) => this.onTabSave(this.resolveTab_(e)));
}

/**
 * Resolves Tab instance whether passed as an event or direct argument.
 * @param {*=} opt_e
 * @param {*=} opt_tab
 * @return {Tab}
 * @private
 */
MenuController.prototype.resolveTab_ = function(opt_e, opt_tab) {
  if (opt_tab) return opt_tab;
  if (opt_e && opt_e.detail) return opt_e.detail;
  return opt_e;
};

/**
 * Adds a new draggable file tab to the UI.
 * @param {!Event|!Tab} e The newtab event or tab.
 * @param {!Tab=} opt_tab The new tab to be added.
 * @private
 */
MenuController.prototype.addNewTab_ = function(e, opt_tab) {
  const tab = this.resolveTab_(e, opt_tab);
  if (!tab) return;

  const id = tab.getId();
  const tabElement = document.createElement('li');
  tabElement.setAttribute('draggable', 'true');
  const filenameElement = document.createElement('button');
  filenameElement.id = 'tab' + id;
  filenameElement.className = 'filename sidebar-button';
  if (tab.isMissing()) {
    filenameElement.classList.add('missing-file');
    filenameElement.setAttribute('title', tab.getPath() ? (tab.getPath() + ' (File missing)') : 'File missing');
  }

  const missingIcon = document.createElement('img');
  missingIcon.className = 'missing-file-icon';
  missingIcon.src = 'assets/missing_file.svg';
  missingIcon.alt = 'Missing file';
  missingIcon.title = 'File is missing in the previously opened location';
  if (!tab.isMissing()) {
    missingIcon.style.display = 'none';
  }
  filenameElement.appendChild(missingIcon);

  const textSpan = document.createElement('span');
  textSpan.className = 'tab-text';
  textSpan.textContent = tab.getName();
  filenameElement.appendChild(textSpan);

  tabElement.appendChild(filenameElement);
  const closeElement = document.createElement('button');
  closeElement.textContent = 'close';
  closeElement.setAttribute('title', (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('closeFileButton')) || 'Close file');
  closeElement.classList.add('close', 'mdc-icon-button', 'material-icons');
  mdc.ripple.MDCRipple.attachTo(closeElement).unbounded = true;
  tabElement.appendChild(closeElement);
  document.getElementById('tabs-list').appendChild(tabElement);

  tabElement.addEventListener(
      'dragstart', () => { this.onDragStart_(tabElement); });
  tabElement.addEventListener(
      'dragover', (event) => { this.onDragOver_(tabElement, event); });
  tabElement.addEventListener(
      'dragend', (event) => { this.onDragEnd_(tabElement, event); });
  tabElement.addEventListener(
      'drop', (event) => { this.onDrop_(event); });
  filenameElement.addEventListener(
      'click', () => { this.tabButtonClicked_(id); });
  closeElement.addEventListener(
      'click', (event) => { this.closeTab_(event, id); });
};

MenuController.prototype.onDragStart_ = function(listItem) {
  this.dragItem_ = listItem;
  listItem.classList.add('dragging');
};

MenuController.prototype.onDragEnd_ = function(listItem, e) {
  if (this.dragItem_) {
    this.dragItem_.classList.remove('dragging');
  }
  this.dragItem_ = null;
  e.preventDefault();
  e.stopPropagation();
};

MenuController.prototype.onDrop_ = function(e) {
  e.stopPropagation();
};

MenuController.prototype.onDragOver_ = function(overItem, e) {
  e.preventDefault();
  if (!this.dragItem_ || overItem === this.dragItem_) {
    return;
  }

  var parent = overItem.parentNode;
  var items = Array.from(parent.children);
  var dragIdx = items.indexOf(this.dragItem_);
  var overIdx = items.indexOf(overItem);
  if (dragIdx === -1 || overIdx === -1) return;

  if (dragIdx < overIdx) {
    overItem.after(this.dragItem_);
  } else {
    overItem.before(this.dragItem_);
  }
  this.tabs_.reorder(dragIdx, overIdx);
};

MenuController.prototype.onTabRenamed = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (!tabBtn) return;
  var textSpan = tabBtn.querySelector('.tab-text');
  if (textSpan) {
    textSpan.textContent = tab.getName();
  } else {
    tabBtn.textContent = tab.getName();
  }
  this.tabs_.modeAutoSet(tab);
};

MenuController.prototype.onTabMissingChange = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (!tabBtn) return;
  var missingIcon = tabBtn.querySelector('.missing-file-icon');
  if (tab.isMissing()) {
    tabBtn.classList.add('missing-file');
    if (missingIcon) missingIcon.style.display = '';
    tabBtn.setAttribute('title', tab.getPath() ? (tab.getPath() + ' (File missing)') : 'File missing');
  } else {
    tabBtn.classList.remove('missing-file');
    if (missingIcon) missingIcon.style.display = 'none';
    tabBtn.setAttribute('title', tab.getPath() || '');
  }
};

MenuController.prototype.onTabPathChange = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (!tabBtn) return;
  var title = tab.isMissing() ?
      (tab.getPath() ? tab.getPath() + ' (File missing)' : 'File missing') :
      (tab.getPath() || '');
  tabBtn.setAttribute('title', title);
};

MenuController.prototype.onTabChange = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (tabBtn) tabBtn.classList.add('unsaved');
};

MenuController.prototype.onTabClosed = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (tabBtn && tabBtn.parentElement) {
    tabBtn.parentElement.remove();
  }
};

MenuController.prototype.onTabSave = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (tabBtn) tabBtn.classList.remove('unsaved');
};

MenuController.prototype.onSwitchTab = function(opt_e, opt_tab) {
  var tab = this.resolveTab_(opt_e, opt_tab);
  if (!tab) return;
  var activeElements = document.querySelectorAll('#tabs-list .active');
  for (var i = 0; i < activeElements.length; i++) {
    activeElements[i].classList.remove('active');
  }
  var tabBtn = document.getElementById('tab' + tab.getId());
  if (tabBtn && tabBtn.parentElement) {
    tabBtn.parentElement.classList.add('active');
  }
};

MenuController.prototype.newTab_ = function() {
  this.tabs_.newTab();
  return false;
};

MenuController.prototype.open_ = function() {
  this.tabs_.openFiles();
  return false;
};

MenuController.prototype.save_ = function() {
  this.tabs_.save();
  return false;
};

MenuController.prototype.saveas_ = function() {
  this.tabs_.saveAs();
  return false;
};

MenuController.prototype.openShortcuts_ = function() {
  window.open('https://support.google.com/chromebook/answer/183101#textapp', '_blank');
  return false;
};

MenuController.prototype.tabButtonClicked_ = function(id) {
  this.tabs_.showTab(id);
  return false;
};

/**
 * Closes a file tab, removing it from the UI.
 * @param {!Event} e The triggering click event.
 * @param {number} id The id of the tab to close.
 */
MenuController.prototype.closeTab_ = function(e, id) {
  this.tabs_.close(id);
  e.stopPropagation();
};
