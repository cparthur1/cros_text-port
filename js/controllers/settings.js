/**
 * @constructor
 * @param {Settings} settings Settings service.
 */
function SettingsController(settings) {
  this.settings_ = settings;

  if (this.settings_.isReady()) {
    this.showAll_();
  } else {
    document.addEventListener('settingsready', this.showAll_.bind(this));
  }

  document.addEventListener('settingschange', (e) => {
    var key = e.detail && e.detail.key !== undefined ? e.detail.key : (Array.isArray(e.detail) ? e.detail[0] : null);
    var value = e.detail && e.detail.value !== undefined ? e.detail.value : (Array.isArray(e.detail) ? e.detail[1] : null);
    if (key !== null) {
      this.onSettingChange_(e, key, value);
    }
  });

  this.addInputListeners_();

  var openBtn = document.getElementById('open-settings');
  if (openBtn) openBtn.addEventListener('click', this.openSettings_.bind(this));

  var closeBtn = document.getElementById('close-settings');
  if (closeBtn) closeBtn.addEventListener('click', this.closeSettings.bind(this));
}

/**
 * Adds event listeners to settings inputs.
 * @private
 */
SettingsController.prototype.addInputListeners_ = function() {
  for (const key in Settings.SETTINGS) {
    switch (Settings.SETTINGS[key].widget) {
      case 'checkbox':
      case 'number':
        var el = document.getElementById('setting-' + key);
        if (el) {
          el.addEventListener('change', this.saveSetting_.bind(this, key));
        }
        break;
      case 'radio':
        for (const element of
            document.querySelectorAll('input[name=setting-' + key + ']')) {
          element.addEventListener('input', () => this.saveSetting_(key));
        }
        break;
    }
  }
};

SettingsController.prototype.openSettings_ = function() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('open-settings');
  // Focus the first setting.
  var firstInput = document.querySelector('#settings-list input');
  if (firstInput) firstInput.focus();
};

/** Close the settings page if it was open. */
SettingsController.prototype.closeSettings = function() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open-settings');
  // Focus the button that reopens settings.
  var openBtn = document.getElementById('open-settings');
  if (openBtn) openBtn.focus();
};

SettingsController.prototype.showAll_ = function() {
  var settings = this.settings_.getAll();
  for (var key in settings) {
    this.show_(key, settings[key]);
  }
};

/**
 * Displays a new setting value in the UI.
 * @param {string} key The unique section of the id of the switch element
 *     (after the 'setting-' prefix).
 * @param {string} value The value to set the setting to.
 * @private
 */
SettingsController.prototype.show_ = function(key, value) {
  switch (Settings.SETTINGS[key].widget) {
    case 'checkbox':
      this.setSwitch_(key, value);
      break;
    case 'number':
      var numInput = document.getElementById('setting-' + key);
      if (numInput) numInput.value = parseInt(value);
      break;
    case 'radio':
      var radioInput = document.getElementById('setting-' + key + '-' + value);
      if (radioInput) {
        radioInput.checked = true;
      }
      break;
  }
};

/**
 * Sets a switch Material Component element in the UI to active/inactive.
 * @param {string} key The unique section of the id of the switch element
 *     (after the 'setting-' prefix).
 * @param {boolean} value If true, activates the switch; if false, deactivates
 *     the switch
 * @private
 */
SettingsController.prototype.setSwitch_ = function(key, value) {
  var input = document.getElementById('setting-' + key);
  if (input) {
    input.checked = !!value;
    input.toggleAttribute('checked', !!value);
  }
  var switchEl = document.getElementById('setting-' + key + '-switch');
  if (switchEl) {
    switchEl.classList.toggle('mdc-switch--checked', !!value);
  }
};

SettingsController.prototype.onSettingChange_ = function(e, key, value) {
  this.show_(key, value);
};

/**
 * Saves the value of a setting UI widget.
 * @param {string} key The unique section of the id of the setting element
 *     (after the 'setting-' prefix).
 * @private
 */
SettingsController.prototype.saveSetting_ = function(key) {
  var value;
  switch (Settings.SETTINGS[key].widget) {
    case 'checkbox':
      var cb = document.getElementById('setting-' + key);
      value = cb ? cb.checked : false;
      break;
    case 'number':
      var num = document.getElementById('setting-' + key);
      value = num ? parseInt(num.value) : Settings.SETTINGS[key]['default'];
      break;
    case 'radio':
      var checkedRadio = document.querySelector('input[name=setting-' + key + ']:checked');
      value = checkedRadio ? checkedRadio.getAttribute('value') : Settings.SETTINGS[key]['default'];
      break;
  }

  this.settings_.set(key, value);
};
