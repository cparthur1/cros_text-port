/**
 * @constructor
 * @param {HTMLElement|string} container
 * @param {Editor} editor
 */
function DialogController(container, editor) {
  this.container_ = (container && container.jquery) ?
      container[0] :
      (typeof container === 'string' ? document.querySelector(container) : container);
  this.editor_ = editor;
  this.disabledElements_ = [];
  this.boundOnKeydown_ = this.onKeydown_.bind(this);
};

/**
 * Checks whether the dialog is currently visible.
 * @return {boolean}
 */
DialogController.prototype.isOpen = function() {
  return this.container_ ? this.container_.classList.contains('open') : false;
};

/**
 * The callback will be called when any of the buttons will be clicked, or Esc
 * is pressed. In case of button click, the button id is passed to callback. In
 * case of Esc, 'cancel' is passed.
 * @param {function(string)} callback
 */
DialogController.prototype.show = function(callback) {
  if (this.isOpen()) {
    console.error('Trying to open dialog when it is already visible.');
    console.error(new Error());
    return;
  }
  this.callback_ = callback;
  this.container_.classList.add('open');

  this.disableEverything_();

  document.addEventListener('keydown', this.boundOnKeydown_);
  var firstButton = this.container_.querySelector('.dialog-button');
  if (firstButton) {
    firstButton.focus();
  }
};

/**
 * Disables keyboard tabbing to all UI elements outside of the dialog box.
 * @private
 */
DialogController.prototype.disableEverything_ = function() {
  this.editor_.disable();
  const inputs = document.querySelectorAll('input, textarea, .mdc-icon-button');
  for (var i = 0; i < inputs.length; i++) {
    this.disabledElements_.push({'element': inputs[i],
                               'index': inputs[i].tabIndex});
    inputs[i].tabIndex = -1;
  }
};

/**
 * Re-enables keyboard tabbing to all UI elements previously disabled due to the
 * dialog box.
 * @private
 */
DialogController.prototype.reenableEverything_ = function() {
  for (var i = 0; i < this.disabledElements_.length; i++) {
    this.disabledElements_[i]['element'].tabIndex =
        this.disabledElements_[i]['index'];
  }
  this.editor_.enable();
};

DialogController.prototype.resetButtons = function() {
  var buttonsContainer = this.container_.querySelector('.dialog-buttons');
  if (buttonsContainer) {
    buttonsContainer.innerHTML = '';
  }
};

DialogController.prototype.addButton = function(id, text) {
  var button = document.createElement('button');
  button.className = 'dialog-button';
  button.id = id;
  button.textContent = text;
  button.addEventListener('click', this.onClick_.bind(this, id));
  button.addEventListener('keydown', this.boundOnKeydown_);
  var buttonsContainer = this.container_.querySelector('.dialog-buttons');
  if (buttonsContainer) {
    buttonsContainer.appendChild(button);
  }
};

/**
 * Adds text to the dialog box, with each string passed displayed on a separate
 * line.
 * @param {...string} var_args The strings to add to the dialog box.
 */
DialogController.prototype.setText = function(var_args) {
  var dialogText = this.container_.querySelector('.dialog-text');
  if (!dialogText) return;
  dialogText.innerHTML = '';
  dialogText.appendChild(document.createTextNode(arguments[0] || ''));
  for (var i = 1; i < arguments.length; i++) {
    dialogText.appendChild(document.createElement('br'));
    dialogText.appendChild(document.createTextNode(arguments[i]));
  }
};

DialogController.prototype.onClick_ = function(id) {
  document.removeEventListener('keydown', this.boundOnKeydown_);
  this.container_.classList.remove('open');
  this.reenableEverything_();
  if (this.callback_)
    this.callback_(id);
};

/**
 * Focus the next or previous button.
 * @param {number} delta +1 for next, -1 for previous.
 */
DialogController.prototype.next_ = function(delta) {
  var buttons = Array.from(this.container_.querySelectorAll('.dialog-button'));
  if (buttons.length === 0) return;
  var currentIndex = buttons.indexOf(document.activeElement);
  var newIndex = currentIndex + delta;
  if (newIndex < 0)
    newIndex += buttons.length;
  if (newIndex >= buttons.length)
    newIndex -= buttons.length;
  buttons[newIndex].focus();
};

DialogController.prototype.onKeydown_ = function(e) {
  e.stopPropagation();
  switch (e.keyCode) {
     case 27:  // Escape
       this.onClick_('cancel');
       return false;

     case 37:  // <-
       this.next_(-1);
       return false;
       break;

     case 39:  // ->
       this.next_(1);
       return false;
       break;
  }
};
