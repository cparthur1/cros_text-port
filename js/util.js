var util = {};

/**
 * @param {Event} e
 * @return {string} Human-readable error description.
 */
util.fsErrorStr = function(e) {
  if (!e) return 'Unknown Error';
  if (typeof FileError !== 'undefined' && e.code) {
    switch (e.code) {
      case FileError.QUOTA_EXCEEDED_ERR:
        return 'Quota exceeded';
      case FileError.NOT_FOUND_ERR:
        return 'File not found';
      case FileError.SECURITY_ERR:
        return 'Security error';
      case FileError.INVALID_MODIFICATION_ERR:
        return 'Invalid modification';
      case FileError.INVALID_STATE_ERR:
        return 'Invalid state';
    }
  }
  return e.message || e.name || 'Unknown Error';
};

util.handleFSError = function(e) {
  util.triggerEvent('filesystemerror');
  console.warn('FS Error:', util.fsErrorStr(e), e);
};

/**
 * @param {FileEntry} entry
 * @param {string} content
 * @param {Function} onsuccess
 * @param {Function?} opt_onerror
 * Truncate the file and write the content.
 */
util.writeFile = function(entry, content, onsuccess, opt_onerror) {
  var blob = new Blob([content], {type: 'text/plain'});
  entry.createWriter(function(writer) {
    writer.onerror = opt_onerror ? opt_onerror : util.handleFSError;
    writer.onwrite = util.writeToWriter_.bind(null, writer, blob, onsuccess);
    writer.truncate(blob.size);
  });
};

/**
 * @param {FileWriter} writer
 * @param {!Blob} blob
 * @param {Function} onsuccess
 */
util.writeToWriter_ = function(writer, blob, onsuccess) {
  writer.onwrite = onsuccess;
  writer.write(blob);
};

/**
 * @param {string} fileName
 * @return {string} Sanitized File name.
 * Returns a sanitized version of a File Name.
 */
util.sanitizeFileName = function(fileName) {
  return fileName.replace(/[^a-z0-9\-]/gi, ' ').substr(0, 50).trim();
}

/**
 * @param {string} fileName
 * @return {?string} Extension.
 * Returns the extension of a File Name or null if there's none.
 */
util.getExtension = function(fileName) {
  var match = /\.([^.\\\/]+)$/.exec(fileName);

  if (match) {
    return match[1];
  } else {
    return null;
  }
};

/**
 * @param {?string} [text] Text content.
 * @return {string} Line endings.
 * Returns guessed line endings or LF if not successful.
 */
util.guessLineEndings = function(text) {
  if (!text) {
    return '\n';
  }
  var indexOfLF = text.indexOf('\n');
  var hasCRLF = (indexOfLF > 0) && (text[indexOfLF - 1] === '\r');

  return (hasCRLF ? '\r\n' : '\n');
};

/**
 * Displays a lightweight toast notification.
 * @param {string} message
 * @param {number=} opt_duration
 */
util.showToast = function(message, opt_duration) {
  var toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (util.toastTimeout_) {
    clearTimeout(util.toastTimeout_);
  }
  util.toastTimeout_ = setTimeout(function() {
    toast.classList.remove('show');
  }, opt_duration || 3000);
};

/**
 * Dispatches a CustomEvent on document for modern vanilla DOM event bus.
 * @param {string} eventName
 * @param {*=} detail
 */
util.triggerEvent = function(eventName, detail) {
  document.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
};


