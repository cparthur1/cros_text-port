/**
 * @constructor
 * @param {EditorCodeMirror} editor
 */
function SymbolsController(editor) {
  this.editor_ = editor;
  this.modal_ = null;
  this.searchInput_ = null;
  this.gridContainer_ = null;
  this.boundOnKeydown_ = this.onKeydown_.bind(this);
  this.activeCategory_ = 'all';

  this.initDom_();
  document.addEventListener('opensymbols', this.toggle.bind(this));
}

SymbolsController.CATEGORIES = [
  { id: 'all', label: 'All Symbols' },
  { id: 'common', label: 'Quick Common' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'math', label: 'Math' },
  { id: 'greek', label: 'Greek' },
  { id: 'shapes', label: 'Shapes & Gender' },
  { id: 'typography', label: 'Punctuation' }
];

SymbolsController.SYMBOLS = [
  // User specified common symbols
  { char: '♂', name: 'male sign', category: 'shapes', tags: 'male gender mars boy' },
  { char: '♀', name: 'female sign', category: 'shapes', tags: 'female gender venus girl' },
  { char: '↑', name: 'up arrow', category: 'arrows', tags: 'up north arrow' },
  { char: '↓', name: 'down arrow', category: 'arrows', tags: 'down south arrow' },
  { char: '→', name: 'right arrow', category: 'arrows', tags: 'right east arrow' },
  { char: '←', name: 'left arrow', category: 'arrows', tags: 'left west arrow' },
  { char: '↔', name: 'left right arrow', category: 'arrows', tags: 'horizontal bidirectional arrow' },
  { char: 'α', name: 'alpha', category: 'greek', tags: 'alpha greek letter' },
  { char: 'ß', name: 'sharp s', category: 'greek', tags: 'eszett german beta' },
  { char: 'γ', name: 'gamma', category: 'greek', tags: 'gamma greek letter' },
  { char: 'Δ', name: 'delta', category: 'greek', tags: 'delta triangle greek capital' },
  { char: 'Φ', name: 'phi', category: 'greek', tags: 'phi greek capital circle slash' },
  { char: 'Ω', name: 'omega', category: 'greek', tags: 'omega ohm greek capital' },
  { char: '◌', name: 'dotted circle', category: 'shapes', tags: 'dotted circle placeholder' },
  { char: '○', name: 'white circle', category: 'shapes', tags: 'circle hollow round' },
  { char: '●', name: 'black circle', category: 'shapes', tags: 'circle filled solid dot' },
  { char: '◐', name: 'circle left half black', category: 'shapes', tags: 'half circle pie moon' },
  { char: '≃', name: 'asymptotically equal', category: 'math', tags: 'similar equal approx asymptotic' },
  { char: '≠', name: 'not equal', category: 'math', tags: 'not equal different neq' },
  { char: '≼', name: 'precedes or equal', category: 'math', tags: 'precedes equal partial order' },
  { char: '≽', name: 'succeeds or equal', category: 'math', tags: 'succeeds equal partial order' },
  { char: '÷', name: 'division sign', category: 'math', tags: 'divide division math obelus' },
  { char: '¼', name: 'one quarter', category: 'math', tags: 'fraction quarter one fourth fourth' },
  { char: '½', name: 'one half', category: 'math', tags: 'fraction half one second' },
  { char: '¾', name: 'three quarters', category: 'math', tags: 'fraction three fourths' },
  { char: '—', name: 'em dash', category: 'typography', tags: 'dash emdash hyphen punctuation' },
  { char: '⟲', name: 'anticlockwise open circle arrow', category: 'arrows', tags: 'undo rotate circle loop repeat counterclockwise' },
  { char: '⟳', name: 'clockwise open circle arrow', category: 'arrows', tags: 'redo rotate circle loop repeat clockwise' },

  // Additional useful arrows
  { char: '⇒', name: 'implies', category: 'arrows', tags: 'implies right double arrow' },
  { char: '⇐', name: 'implied by', category: 'arrows', tags: 'left double arrow' },
  { char: '⇔', name: 'if and only if', category: 'arrows', tags: 'iff equivalent double arrow' },
  { char: '↗', name: 'north east arrow', category: 'arrows', tags: 'diagonal up right' },
  { char: '↘', name: 'south east arrow', category: 'arrows', tags: 'diagonal down right' },
  { char: '↺', name: 'counterclockwise arrow', category: 'arrows', tags: 'undo rotate circle' },
  { char: '↻', name: 'clockwise arrow', category: 'arrows', tags: 'redo rotate circle' },

  // Additional useful math
  { char: '±', name: 'plus minus', category: 'math', tags: 'plus minus sign' },
  { char: '×', name: 'multiplication sign', category: 'math', tags: 'multiply times math' },
  { char: '≈', name: 'almost equal', category: 'math', tags: 'approx approx equal' },
  { char: '≤', name: 'less than or equal', category: 'math', tags: 'less equal leq' },
  { char: '≥', name: 'greater than or equal', category: 'math', tags: 'greater equal geq' },
  { char: '°', name: 'degree sign', category: 'math', tags: 'degree temp temperature angle' },
  { char: '√', name: 'square root', category: 'math', tags: 'sqrt radical root' },
  { char: '∞', name: 'infinity', category: 'math', tags: 'infinity infinite loop' },
  { char: '∑', name: 'summation', category: 'math', tags: 'sum sigma math' },
  { char: '∏', name: 'product', category: 'math', tags: 'product pi math' },

  // Additional useful Greek
  { char: 'δ', name: 'delta lowercase', category: 'greek', tags: 'delta greek' },
  { char: 'ε', name: 'epsilon', category: 'greek', tags: 'epsilon greek' },
  { char: 'θ', name: 'theta', category: 'greek', tags: 'theta angle greek' },
  { char: 'λ', name: 'lambda', category: 'greek', tags: 'lambda wavelength greek' },
  { char: 'μ', name: 'mu / micro', category: 'greek', tags: 'mu micro micron greek' },
  { char: 'π', name: 'pi', category: 'greek', tags: 'pi constant circle greek' },
  { char: 'σ', name: 'sigma lowercase', category: 'greek', tags: 'sigma std dev greek' },
  { char: 'Σ', name: 'sigma capital', category: 'greek', tags: 'sigma sum greek' },

  // Additional useful shapes & symbols
  { char: '◑', name: 'circle right half black', category: 'shapes', tags: 'half circle' },
  { char: '▲', name: 'black up pointing triangle', category: 'shapes', tags: 'triangle up arrow' },
  { char: '▼', name: 'black down pointing triangle', category: 'shapes', tags: 'triangle down arrow' },
  { char: '■', name: 'black square', category: 'shapes', tags: 'square box block' },
  { char: '□', name: 'white square', category: 'shapes', tags: 'square empty hollow' },
  { char: '★', name: 'black star', category: 'shapes', tags: 'star favorite rating' },
  { char: '☆', name: 'white star', category: 'shapes', tags: 'star empty hollow' },

  // Additional punctuation & typography
  { char: '–', name: 'en dash', category: 'typography', tags: 'endash dash range' },
  { char: '…', name: 'horizontal ellipsis', category: 'typography', tags: 'ellipsis dots more' },
  { char: '•', name: 'bullet', category: 'typography', tags: 'bullet dot point list' },
  { char: '·', name: 'middle dot', category: 'typography', tags: 'interpunct centered dot' },
  { char: '«', name: 'left pointing guillemet', category: 'typography', tags: 'guillemet quote' },
  { char: '»', name: 'right pointing guillemet', category: 'typography', tags: 'guillemet quote' },
  { char: '“', name: 'left double quotation mark', category: 'typography', tags: 'quote speech' },
  { char: '”', name: 'right double quotation mark', category: 'typography', tags: 'quote speech' },
  { char: '©', name: 'copyright', category: 'typography', tags: 'copyright legal' },
  { char: '®', name: 'registered trademark', category: 'typography', tags: 'registered legal' },
  { char: '™', name: 'trade mark sign', category: 'typography', tags: 'trademark tm' },
  { char: '€', name: 'euro sign', category: 'typography', tags: 'euro currency money' },
  { char: '£', name: 'pound sign', category: 'typography', tags: 'pound sterling currency money' },
  { char: '¥', name: 'yen sign', category: 'typography', tags: 'yen yuan currency money' }
];

SymbolsController.prototype.initDom_ = function() {
  var modal = document.getElementById('symbols-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'symbols-modal';
    modal.className = 'symbols-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Symbols Menu');
    modal.setAttribute('aria-modal', 'true');

    var backdrop = document.createElement('div');
    backdrop.className = 'symbols-backdrop';
    backdrop.addEventListener('click', this.close.bind(this));

    var dialog = document.createElement('div');
    dialog.className = 'symbols-dialog';

    var header = document.createElement('div');
    header.className = 'symbols-header';

    var title = document.createElement('div');
    title.className = 'symbols-title';
    title.innerHTML = '<span class="material-icons symbols-header-icon">category</span><span>Insert Symbol</span> <span class="symbols-shortcut-badge">Alt+S</span>';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'symbols-close-button material-icons';
    closeBtn.textContent = 'close';
    closeBtn.title = 'Close (Esc)';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', this.close.bind(this));

    header.appendChild(title);
    header.appendChild(closeBtn);

    var searchRow = document.createElement('div');
    searchRow.className = 'symbols-search-row';

    var searchIcon = document.createElement('span');
    searchIcon.className = 'material-icons symbols-search-icon';
    searchIcon.textContent = 'search';

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'symbols-search-input';
    searchInput.placeholder = 'Search symbols or descriptions...';
    searchInput.setAttribute('aria-label', 'Search symbols');
    searchInput.addEventListener('input', this.onSearchInput_.bind(this));

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);

    var tabsRow = document.createElement('div');
    tabsRow.className = 'symbols-tabs-row';

    SymbolsController.CATEGORIES.forEach(function(cat) {
      var tabBtn = document.createElement('button');
      tabBtn.className = 'symbols-tab-button' + (cat.id === 'all' ? ' active' : '');
      tabBtn.textContent = cat.label;
      tabBtn.dataset.category = cat.id;
      tabBtn.addEventListener('click', function() {
        var siblings = tabsRow.querySelectorAll('.symbols-tab-button');
        siblings.forEach(function(b) { b.classList.remove('active'); });
        tabBtn.classList.add('active');
        this.activeCategory_ = cat.id;
        this.renderSymbols_();
      }.bind(this));
      tabsRow.appendChild(tabBtn);
    }.bind(this));

    var grid = document.createElement('div');
    grid.className = 'symbols-grid';
    grid.id = 'symbols-grid';

    var footer = document.createElement('div');
    footer.className = 'symbols-footer';
    footer.textContent = 'Click to insert • Shift+Click to insert multiple • Esc to exit';

    dialog.appendChild(header);
    dialog.appendChild(searchRow);
    dialog.appendChild(tabsRow);
    dialog.appendChild(grid);
    dialog.appendChild(footer);

    modal.appendChild(backdrop);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    this.modal_ = modal;
    this.searchInput_ = searchInput;
    this.gridContainer_ = grid;
  } else {
    this.modal_ = modal;
    this.searchInput_ = modal.querySelector('.symbols-search-input');
    this.gridContainer_ = modal.querySelector('#symbols-grid');
  }

  this.renderSymbols_();
};

SymbolsController.prototype.renderSymbols_ = function() {
  if (!this.gridContainer_) return;
  this.gridContainer_.innerHTML = '';

  var query = (this.searchInput_ ? this.searchInput_.value : '').trim().toLowerCase();
  var category = this.activeCategory_ || 'all';

  var filtered = SymbolsController.SYMBOLS.filter(function(item) {
    if (category !== 'all') {
      if (category === 'common') {
        // The 26 original user specified symbols
        var commonList = '♂♀↑↓→←↔αßγΔΦΩ◌○●◐≃≠≼≽÷¼½¾—';
        if (commonList.indexOf(item.char) === -1) return false;
      } else if (item.category !== category) {
        return false;
      }
    }

    if (query) {
      return item.char.toLowerCase().includes(query) ||
             item.name.toLowerCase().includes(query) ||
             item.tags.toLowerCase().includes(query);
    }
    return true;
  });

  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'symbols-empty';
    empty.textContent = 'No matching symbols found';
    this.gridContainer_.appendChild(empty);
    return;
  }

  var self = this;
  filtered.forEach(function(sym) {
    var btn = document.createElement('button');
    btn.className = 'symbol-btn';
    btn.textContent = sym.char;
    btn.title = sym.name + ' (' + sym.char + ')';
    btn.setAttribute('aria-label', sym.name);
    btn.addEventListener('click', function(e) {
      self.onSymbolClick_(sym.char, e);
    });
    self.gridContainer_.appendChild(btn);
  });
};

SymbolsController.prototype.onSearchInput_ = function() {
  this.renderSymbols_();
};

SymbolsController.prototype.onSymbolClick_ = function(char, e) {
  if (this.editor_ && typeof this.editor_.insertText === 'function') {
    this.editor_.insertText(char);
  }

  // If user holds Shift, keep menu open for inserting multiple symbols; otherwise close
  if (!e || !e.shiftKey) {
    this.close();
  }
};

SymbolsController.prototype.isOpen = function() {
  return this.modal_ ? this.modal_.classList.contains('open') : false;
};

SymbolsController.prototype.open = function() {
  if (!this.modal_) this.initDom_();
  this.modal_.classList.add('open');
  document.addEventListener('keydown', this.boundOnKeydown_, true);

  if (this.searchInput_) {
    this.searchInput_.value = '';
    this.renderSymbols_();
    setTimeout(function() {
      this.searchInput_.focus();
    }.bind(this), 50);
  }
};

SymbolsController.prototype.close = function() {
  if (!this.modal_) return;
  this.modal_.classList.remove('open');
  document.removeEventListener('keydown', this.boundOnKeydown_, true);

  if (this.editor_ && typeof this.editor_.focus === 'function') {
    this.editor_.focus();
  }
};

SymbolsController.prototype.toggle = function() {
  if (this.isOpen()) {
    this.close();
  } else {
    this.open();
  }
};

SymbolsController.prototype.onKeydown_ = function(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    this.close();
    return;
  }

  // Toggle with Alt+S while open
  if (e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    e.stopPropagation();
    this.close();
    return;
  }
};
