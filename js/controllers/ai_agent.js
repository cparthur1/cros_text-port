'use strict';

/**
 * AI Agent Controller powered by gemini-flash-lite-latest.
 * Provides a retrotech terminal side panel on the left with agent tools for editing code/text.
 *
 * @constructor
 * @param {EditorCodeMirror} editor
 * @param {Tabs} tabs
 * @param {Settings} settings
 */
function AiAgentController(editor, tabs, settings) {
  this.editor_ = editor;
  this.tabs_ = tabs;
  this.settings_ = settings;

  this.panel_ = document.getElementById('ai-panel');
  this.resizer_ = document.getElementById('ai-panel-resizer');
  this.terminalOutput_ = document.getElementById('ai-terminal-output');
  this.terminalInput_ = document.getElementById('ai-terminal-input');
  this.sendBtn_ = document.getElementById('ai-terminal-send');
  this.statusBtn_ = document.getElementById('status-ai');
  this.statusIcon_ = document.getElementById('status-ai-icon');
  this.statusIndicator_ = document.getElementById('ai-status-indicator');

  this.keyModal_ = document.getElementById('ai-key-modal');
  this.keyInput_ = document.getElementById('ai-key-input');
  this.keyRemember_ = document.getElementById('ai-key-remember');
  this.keySaveBtn_ = document.getElementById('ai-key-save');
  this.keyCancelBtn_ = document.getElementById('ai-key-cancel');
  this.keyClearBtn_ = document.getElementById('ai-key-clear');
  this.keyCloseBtn_ = document.getElementById('ai-key-close');
  this.keyToggleVisBtn_ = document.getElementById('ai-key-toggle-vis');

  this.btnKey_ = document.getElementById('ai-btn-key');
  this.btnClear_ = document.getElementById('ai-btn-clear');
  this.btnClose_ = document.getElementById('ai-btn-close');

  this.isOpen_ = false;
  this.isBusy_ = false;
  this.chatHistory_ = [];
  this.commandHistory_ = [];
  this.historyIndex_ = -1;

  this.init_();
}

/**
 * Tool definitions conforming to Google Gemini Function Calling schema.
 */
AiAgentController.TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'remove_lines',
        description: 'Removes a specific line or range of lines from the active document.',
        parameters: {
          type: 'OBJECT',
          properties: {
            start_line: {
              type: 'INTEGER',
              description: '1-based starting line number to remove'
            },
            end_line: {
              type: 'INTEGER',
              description: '1-based ending line number to remove (inclusive). Defaults to start_line if omitted.'
            }
          },
          required: ['start_line']
        }
      },
      {
        name: 'replace_lines',
        description: 'Replaces a specific line or range of lines with new content in the active document.',
        parameters: {
          type: 'OBJECT',
          properties: {
            start_line: {
              type: 'INTEGER',
              description: '1-based starting line number to replace'
            },
            end_line: {
              type: 'INTEGER',
              description: '1-based ending line number to replace (inclusive). Defaults to start_line if omitted.'
            },
            new_content: {
              type: 'STRING',
              description: 'The new text to replace the specified line(s) with'
            }
          },
          required: ['start_line', 'new_content']
        }
      },
      {
        name: 'add_lines',
        description: 'Inserts new lines at a specific line position in the active document.',
        parameters: {
          type: 'OBJECT',
          properties: {
            line_number: {
              type: 'INTEGER',
              description: '1-based reference line number'
            },
            content: {
              type: 'STRING',
              description: 'Content of the line or lines to add'
            },
            position: {
              type: 'STRING',
              enum: ['before', 'after'],
              description: 'Whether to insert before or after the line_number. Defaults to after.'
            }
          },
          required: ['line_number', 'content']
        }
      },
      {
        name: 'find_and_replace',
        description: 'Finds specific text and replaces it with new text throughout the active document.',
        parameters: {
          type: 'OBJECT',
          properties: {
            find_text: {
              type: 'STRING',
              description: 'The target string to find'
            },
            replace_text: {
              type: 'STRING',
              description: 'The replacement string'
            },
            match_case: {
              type: 'BOOLEAN',
              description: 'Whether search is case-sensitive. Defaults to true.'
            },
            replace_all: {
              type: 'BOOLEAN',
              description: 'Whether to replace all occurrences or just the first. Defaults to true.'
            }
          },
          required: ['find_text', 'replace_text']
        }
      },
      {
        name: 'read_document',
        description: 'Reads line range or whole document with line numbers.',
        parameters: {
          type: 'OBJECT',
          properties: {
            start_line: {
              type: 'INTEGER',
              description: '1-based start line (optional)'
            },
            end_line: {
              type: 'INTEGER',
              description: '1-based end line (optional)'
            }
          }
        }
      }
    ]
  }
];

/**
 * Initializes listeners, saved dimensions, and welcome screen.
 * @private
 */
AiAgentController.prototype.init_ = function() {
  if (this.statusBtn_) {
    this.statusBtn_.addEventListener('click', this.togglePanel.bind(this));
  }

  if (this.btnClose_) {
    this.btnClose_.addEventListener('click', this.closePanel.bind(this));
  }

  if (this.btnClear_) {
    this.btnClear_.addEventListener('click', this.clearTerminal.bind(this));
  }

  if (this.btnKey_) {
    this.btnKey_.addEventListener('click', this.openKeyModal_.bind(this));
  }

  if (this.sendBtn_) {
    this.sendBtn_.addEventListener('click', this.onSendClicked_.bind(this));
  }

  if (this.terminalInput_) {
    this.terminalInput_.addEventListener('keydown', this.onInputKeyDown_.bind(this));
    this.terminalInput_.addEventListener('input', this.autoResizeInput_.bind(this));
  }

  this.initKeyModalListeners_();
  this.initResizer_();
  this.showWelcomeBanner_();
  this.updateStatusIndicator_();
};

/**
 * Shows the retrotech ASCII welcome banner in the terminal output.
 * @private
 */
AiAgentController.prototype.showWelcomeBanner_ = function() {
  if (!this.terminalOutput_) return;
  this.terminalOutput_.innerHTML = '';

  var banner = document.createElement('div');
  banner.className = 'ai-banner';
  banner.textContent =
    '╔══════════════════════════════════════════════════════╗\n' +
    '║  CROS TEXT // RETROTECH AI AGENT TERMINAL           ║\n' +
    '║  MODEL: gemini-flash-lite-latest                     ║\n' +
    '║  TOOLS: remove_lines, replace_lines, add_lines,      ║\n' +
    '║         find_and_replace, read_document              ║\n' +
    '╚══════════════════════════════════════════════════════╝\n' +
    'Commands: Ask in plain English or code instructions.\n' +
    'Shortcuts: /key <api-key> | /clear | /help | /reset';

  this.terminalOutput_.appendChild(banner);
};

/**
 * Toggles the AI Agent side panel open/closed.
 */
AiAgentController.prototype.togglePanel = function() {
  if (this.isOpen_) {
    this.closePanel();
  } else {
    this.openPanel();
  }
};

/**
 * Opens the AI Agent side panel on the left.
 */
AiAgentController.prototype.openPanel = function() {
  this.isOpen_ = true;

  if (this.panel_) {
    this.panel_.classList.add('open');
    this.panel_.style.visibility = 'visible';
    var savedWidth = localStorage.getItem('ai_panel_width') || '350';
    this.panel_.style.width = savedWidth + 'px';
  }

  if (this.statusBtn_) {
    this.statusBtn_.classList.add('active');
    this.statusBtn_.setAttribute('aria-pressed', 'true');
    this.statusBtn_.title = 'AI Agent Panel: Active (Click to close)';
  }

  if (this.terminalInput_) {
    setTimeout(() => this.terminalInput_.focus(), 220);
  }

  if (this.editor_ && this.editor_.editorView_ && typeof this.editor_.editorView_.requestMeasure === 'function') {
    setTimeout(() => this.editor_.editorView_.requestMeasure(), 230);
  }
};

/**
 * Closes the AI Agent side panel.
 */
AiAgentController.prototype.closePanel = function() {
  this.isOpen_ = false;

  if (this.panel_) {
    this.panel_.classList.remove('open');
    this.panel_.style.width = '0';
    setTimeout(() => {
      if (!this.isOpen_ && this.panel_) {
        this.panel_.style.visibility = 'hidden';
      }
    }, 210);
  }

  if (this.statusBtn_) {
    this.statusBtn_.classList.remove('active');
    this.statusBtn_.setAttribute('aria-pressed', 'false');
    this.statusBtn_.title = 'AI Agent Panel (gemini-flash-lite)';
  }

  if (this.editor_ && this.editor_.focus) {
    this.editor_.focus();
  }

  if (this.editor_ && this.editor_.editorView_ && typeof this.editor_.editorView_.requestMeasure === 'function') {
    setTimeout(() => this.editor_.editorView_.requestMeasure(), 230);
  }
};

/**
 * Clears terminal messages and resets conversation history.
 */
AiAgentController.prototype.clearTerminal = function() {
  this.chatHistory_ = [];
  this.showWelcomeBanner_();
  this.appendSystemMessage_('Session history cleared. Terminal reset.');
};

/**
 * Resizes the command textarea based on content.
 * @private
 */
AiAgentController.prototype.autoResizeInput_ = function() {
  if (!this.terminalInput_) return;
  this.terminalInput_.style.height = 'auto';
  var scrollH = this.terminalInput_.scrollHeight;
  this.terminalInput_.style.height = Math.min(scrollH, 96) + 'px';
};

/**
 * Handles input key events (Enter to submit, Shift+Enter for newline, Up/Down for command history).
 * @param {KeyboardEvent} e
 * @private
 */
AiAgentController.prototype.onInputKeyDown_ = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    this.onSendClicked_();
  } else if (e.key === 'ArrowUp') {
    if (this.commandHistory_.length > 0 && this.terminalInput_.selectionStart === 0) {
      e.preventDefault();
      if (this.historyIndex_ < this.commandHistory_.length - 1) {
        this.historyIndex_++;
        this.terminalInput_.value = this.commandHistory_[this.commandHistory_.length - 1 - this.historyIndex_];
        this.autoResizeInput_();
      }
    }
  } else if (e.key === 'ArrowDown') {
    if (this.historyIndex_ > 0) {
      e.preventDefault();
      this.historyIndex_--;
      this.terminalInput_.value = this.commandHistory_[this.commandHistory_.length - 1 - this.historyIndex_];
      this.autoResizeInput_();
    } else if (this.historyIndex_ === 0) {
      e.preventDefault();
      this.historyIndex_ = -1;
      this.terminalInput_.value = '';
      this.autoResizeInput_();
    }
  }
};

/**
 * Dispatches command from the input.
 * @private
 */
AiAgentController.prototype.onSendClicked_ = function() {
  if (this.isBusy_ || !this.terminalInput_) return;
  var text = this.terminalInput_.value.trim();
  if (!text) return;

  this.commandHistory_.push(text);
  this.historyIndex_ = -1;

  this.terminalInput_.value = '';
  this.autoResizeInput_();

  this.appendUserMessage_(text);

  // Handle slash commands
  if (text.startsWith('/')) {
    this.handleSlashCommand_(text);
    return;
  }

  this.callGemini_(text);
};

/**
 * Handles terminal slash commands.
 * @param {string} cmd
 * @private
 */
AiAgentController.prototype.handleSlashCommand_ = function(cmd) {
  var parts = cmd.split(' ');
  var action = parts[0].toLowerCase();
  var arg = parts.slice(1).join(' ').trim();

  switch (action) {
    case '/key':
      if (arg) {
        this.setApiKey_(arg, true);
        this.appendSystemMessage_('Gemini API key saved to localStorage.');
      } else {
        this.openKeyModal_();
      }
      break;

    case '/clear':
      this.clearTerminal();
      break;

    case '/reset':
      this.chatHistory_ = [];
      this.appendSystemMessage_('Multi-turn context cleared.');
      break;

    case '/model':
      this.appendSystemMessage_('Current active model: gemini-flash-lite-latest (Google Gemini API).');
      break;

    case '/help':
      this.appendSystemMessage_(
        'CROS TEXT AI AGENT CAPABILITIES:\n' +
        '• "Replace line 10 with console.log(\'debug\')"\n' +
        '• "Remove lines 5 to 8"\n' +
        '• "Add a JSDoc comment before line 1"\n' +
        '• "Find \'var\' and replace with \'const\'"\n' +
        '• "Review this file for syntax errors or improvements"\n\n' +
        'Terminal Commands:\n' +
        '/key <your-api-key>  - Configure Gemini API Key\n' +
        '/clear              - Clear terminal window\n' +
        '/reset              - Reset agent conversation context\n' +
        '/model              - Display model version'
      );
      break;

    default:
      this.appendErrorMessage_(`Unknown command: ${action}. Type /help for assistance.`);
      break;
  }
};

/**
 * Appends a user message to terminal.
 * @param {string} text
 * @private
 */
AiAgentController.prototype.appendUserMessage_ = function(text) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-user';

  var prompt = document.createElement('span');
  prompt.className = 'ai-term-prompt';
  prompt.textContent = '❯';

  var cmd = document.createElement('span');
  cmd.className = 'ai-term-cmd';
  cmd.textContent = text;

  row.appendChild(prompt);
  row.appendChild(cmd);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Appends a system notification to terminal.
 * @param {string} text
 * @private
 */
AiAgentController.prototype.appendSystemMessage_ = function(text) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-system';

  var prefix = document.createElement('span');
  prefix.className = 'ai-sys-prefix';
  prefix.textContent = '[SYS]';

  var body = document.createElement('span');
  body.textContent = text;

  row.appendChild(prefix);
  row.appendChild(body);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Appends an error message to terminal.
 * @param {string} text
 * @private
 */
AiAgentController.prototype.appendErrorMessage_ = function(text) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-error';

  var prefix = document.createElement('span');
  prefix.className = 'ai-err-prefix';
  prefix.textContent = '[ERR]';

  var body = document.createElement('span');
  body.textContent = text;

  row.appendChild(prefix);
  row.appendChild(body);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Appends a tool execution call to terminal.
 * @param {string} name
 * @param {Object} args
 * @private
 */
AiAgentController.prototype.appendToolInvocationMessage_ = function(name, args) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-tool';

  var header = document.createElement('div');
  header.className = 'ai-tool-header';
  header.innerHTML = '<span class="material-icons ai-tool-icon">terminal</span> <span>[TOOL CALL] ' +
                     this.escapeHtml_(name) + '</span>';

  var argsSummary = document.createElement('div');
  argsSummary.className = 'ai-tool-body';
  argsSummary.textContent = JSON.stringify(args);

  row.appendChild(header);
  row.appendChild(argsSummary);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Appends a tool execution result to terminal.
 * @param {string} name
 * @param {Object} result
 * @private
 */
AiAgentController.prototype.appendToolResultMessage_ = function(name, result) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-tool';

  var header = document.createElement('div');
  header.className = 'ai-tool-header';
  var icon = result.success ? 'check_circle' : 'cancel';
  header.innerHTML = '<span class="material-icons ai-tool-icon" style="color: ' +
                     (result.success ? '#34d399' : '#f87171') + '">' + icon + '</span> ' +
                     '<span>[RESULT: ' + this.escapeHtml_(name) + ']</span>';

  var body = document.createElement('div');
  body.className = 'ai-tool-body';
  body.textContent = result.message || result.error || JSON.stringify(result);

  row.appendChild(header);
  row.appendChild(body);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Appends the model text response.
 * @param {string} text
 * @private
 */
AiAgentController.prototype.appendModelMessage_ = function(text) {
  if (!this.terminalOutput_) return;
  var row = document.createElement('div');
  row.className = 'ai-msg ai-msg-model';

  var content = document.createElement('div');
  content.className = 'ai-model-content';

  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      content.innerHTML = window.marked.parse(text, { gfm: true, breaks: true });
    } catch (e) {
      content.textContent = text;
    }
  } else {
    content.textContent = text;
  }

  row.appendChild(content);
  this.terminalOutput_.appendChild(row);
  this.scrollToBottom_();
};

/**
 * Sets busy state and displays pulsing terminal indicator.
 * @param {boolean} busy
 * @private
 */
AiAgentController.prototype.setBusy_ = function(busy) {
  this.isBusy_ = busy;
  if (this.sendBtn_) {
    this.sendBtn_.disabled = busy;
  }
  if (this.terminalInput_) {
    this.terminalInput_.disabled = busy;
  }

  if (busy) {
    this.showTypingIndicator_();
  } else {
    this.hideTypingIndicator_();
  }

  this.updateStatusIndicator_();
};

/**
 * Shows terminal typing/pulsing indicator.
 * @private
 */
AiAgentController.prototype.showTypingIndicator_ = function() {
  this.hideTypingIndicator_();
  var indicator = document.createElement('div');
  indicator.id = 'ai-typing-indicator';
  indicator.className = 'ai-typing-indicator';
  indicator.innerHTML = '<span class="ai-term-prompt">❯</span> <span>agent processing with gemini-flash-lite<span class="ai-typing-dots">...</span></span>';
  if (this.terminalOutput_) {
    this.terminalOutput_.appendChild(indicator);
    this.scrollToBottom_();
  }
};

/**
 * Hides terminal typing indicator.
 * @private
 */
AiAgentController.prototype.hideTypingIndicator_ = function() {
  var el = document.getElementById('ai-typing-indicator');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
};

/**
 * Updates status indicator text in terminal footer.
 * @private
 */
AiAgentController.prototype.updateStatusIndicator_ = function() {
  if (!this.statusIndicator_) return;
  if (this.isBusy_) {
    this.statusIndicator_.textContent = 'THINKING...';
    this.statusIndicator_.className = 'ai-status-indicator busy';
  } else {
    this.statusIndicator_.textContent = 'READY';
    this.statusIndicator_.className = 'ai-status-indicator ready';
  }
};

/**
 * Scrolls terminal output to bottom.
 * @private
 */
AiAgentController.prototype.scrollToBottom_ = function() {
  if (this.terminalOutput_) {
    this.terminalOutput_.scrollTop = this.terminalOutput_.scrollHeight;
  }
};

/**
 * Returns formatted context of the current document with line numbers.
 * @return {string}
 * @private
 */
AiAgentController.prototype.getDocumentContext_ = function() {
  if (!this.editor_ || !this.editor_.editorView_) return '[No document open]';
  var state = this.editor_.editorView_.state;
  var currentTab = this.tabs_ && this.tabs_.getCurrentTab();
  var filename = currentTab && typeof currentTab.getName === 'function' ? currentTab.getName() : 'untitled.txt';
  var totalLines = state.doc.lines;

  var maxPreviewLines = 300;
  var lines = [];
  var limit = Math.min(totalLines, maxPreviewLines);
  for (var i = 1; i <= limit; i++) {
    lines.push(i + ' | ' + state.doc.line(i).text);
  }

  var preview = 'File: "' + filename + '" (' + totalLines + ' lines total):\n' + lines.join('\n');
  if (totalLines > maxPreviewLines) {
    preview += '\n... [' + (totalLines - maxPreviewLines) + ' more lines. Use read_document tool to view further lines]';
  }
  return preview;
};

/**
 * Executes an agent tool call against CodeMirror.
 * @param {string} name
 * @param {Object} args
 * @return {Object}
 * @private
 */
AiAgentController.prototype.executeTool_ = function(name, args) {
  if (!this.editor_ || !this.editor_.editorView_) {
    return { success: false, error: 'Editor is not initialized.' };
  }

  var state = this.editor_.editorView_.state;
  var totalLines = state.doc.lines;

  switch (name) {
    case 'remove_lines': {
      var start = parseInt(args.start_line, 10);
      var end = args.end_line !== undefined ? parseInt(args.end_line, 10) : start;
      if (isNaN(start) || start < 1) start = 1;
      if (isNaN(end) || end < start) end = start;
      start = Math.min(start, totalLines);
      end = Math.min(end, totalLines);

      var fromPos, toPos;
      if (end < totalLines) {
        fromPos = state.doc.line(start).from;
        toPos = state.doc.line(end + 1).from;
      } else if (start > 1) {
        fromPos = state.doc.line(start - 1).to;
        toPos = state.doc.line(end).to;
      } else {
        fromPos = 0;
        toPos = state.doc.length;
      }

      this.editor_.editorView_.dispatch({
        changes: { from: fromPos, to: toPos, insert: '' },
        scrollIntoView: true
      });

      return {
        success: true,
        message: 'Removed line(s) ' + start + ' through ' + end + ' (' + (end - start + 1) + ' line(s) deleted).',
        remaining_lines: this.editor_.editorView_.state.doc.lines
      };
    }

    case 'replace_lines': {
      var start = parseInt(args.start_line, 10);
      var end = args.end_line !== undefined ? parseInt(args.end_line, 10) : start;
      if (isNaN(start) || start < 1) start = 1;
      if (isNaN(end) || end < start) end = start;
      start = Math.min(start, totalLines);
      end = Math.min(end, totalLines);

      var fromPos = state.doc.line(start).from;
      var toPos = state.doc.line(end).to;
      var newContent = String(args.new_content ?? '');

      this.editor_.editorView_.dispatch({
        changes: { from: fromPos, to: toPos, insert: newContent },
        scrollIntoView: true
      });

      return {
        success: true,
        message: 'Replaced line(s) ' + start + ' through ' + end + '.',
        total_lines: this.editor_.editorView_.state.doc.lines
      };
    }

    case 'add_lines': {
      var lineNum = parseInt(args.line_number, 10);
      if (isNaN(lineNum)) lineNum = 1;
      lineNum = Math.max(1, Math.min(lineNum, totalLines));
      var pos = args.position === 'before' ? 'before' : 'after';
      var content = String(args.content ?? '');

      if (totalLines === 0 || (totalLines === 1 && state.doc.line(1).text === '')) {
        this.editor_.editorView_.dispatch({
          changes: { from: 0, to: state.doc.length, insert: content },
          scrollIntoView: true
        });
        return { success: true, message: 'Inserted into empty document.' };
      }

      var insertPos, insertText;
      if (pos === 'before') {
        insertPos = state.doc.line(lineNum).from;
        insertText = content + '\n';
      } else {
        if (lineNum === totalLines) {
          insertPos = state.doc.line(lineNum).to;
          insertText = '\n' + content;
        } else {
          insertPos = state.doc.line(lineNum + 1).from;
          insertText = content + '\n';
        }
      }

      this.editor_.editorView_.dispatch({
        changes: { from: insertPos, to: insertPos, insert: insertText },
        scrollIntoView: true
      });

      return {
        success: true,
        message: 'Added line(s) ' + pos + ' line ' + lineNum + '.',
        total_lines: this.editor_.editorView_.state.doc.lines
      };
    }

    case 'find_and_replace': {
      var findText = String(args.find_text ?? '');
      var replaceText = String(args.replace_text ?? '');
      var matchCase = args.match_case !== false;
      var replaceAll = args.replace_all !== false;

      if (!findText) {
        return { success: false, error: 'find_text must not be empty.' };
      }

      var docText = state.doc.toString();
      var flags = (matchCase ? '' : 'i') + (replaceAll ? 'g' : '');
      var escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp(escaped, flags);

      var changes = [];
      var match;
      if (!replaceAll) {
        match = regex.exec(docText);
        if (match) {
          changes.push({ from: match.index, to: match.index + match[0].length, insert: replaceText });
        }
      } else {
        while ((match = regex.exec(docText)) !== null) {
          changes.push({ from: match.index, to: match.index + match[0].length, insert: replaceText });
          if (match.index === regex.lastIndex) regex.lastIndex++;
        }
      }

      if (changes.length === 0) {
        return { success: false, message: 'Text "' + findText + '" was not found in document.' };
      }

      this.editor_.editorView_.dispatch({
        changes: changes,
        scrollIntoView: true
      });

      return {
        success: true,
        message: 'Successfully replaced ' + changes.length + ' occurrence(s) of "' + findText + '".',
        count: changes.length
      };
    }

    case 'read_document': {
      var start = args.start_line ? Math.max(1, parseInt(args.start_line, 10)) : 1;
      var end = args.end_line ? Math.min(totalLines, parseInt(args.end_line, 10)) : totalLines;
      var lines = [];
      for (var i = start; i <= end; i++) {
        lines.push(i + ' | ' + state.doc.line(i).text);
      }
      return {
        success: true,
        total_lines: totalLines,
        range: start + '..' + end,
        content: lines.join('\n')
      };
    }

    default:
      return { success: false, error: 'Unknown tool: ' + name };
  }
};

/**
 * Sends prompt and context to gemini-flash-lite-latest in an agentic tool-calling loop.
 * @param {string} userPrompt
 * @private
 */
AiAgentController.prototype.callGemini_ = async function(userPrompt) {
  var apiKey = this.getApiKey_();
  if (!apiKey) {
    this.appendSystemMessage_('Google Gemini API Key is required. Configure your key in the modal or type /key <your-api-key>.');
    this.openKeyModal_();
    return;
  }

  this.setBusy_(true);

  try {
    var currentDocContext = this.getDocumentContext_();
    var currentTab = this.tabs_ && this.tabs_.getCurrentTab();
    var filename = currentTab && typeof currentTab.getName === 'function' ? currentTab.getName() : 'untitled.txt';

    var systemPrompt =
      'You are a surgical, precise AI coding and text editing assistant integrated into Chrome OS Text App.\n' +
      'You are powered by gemini-flash-lite-latest.\n' +
      'You have direct tool access to modify the user\'s document in the editor.\n' +
      'Active document: "' + filename + '".\n\n' +
      'AVAILABLE TOOLS:\n' +
      '- remove_lines(start_line, end_line): Deletes lines from start_line to end_line.\n' +
      '- replace_lines(start_line, end_line, new_content): Replaces lines with new_content.\n' +
      '- add_lines(line_number, content, position): Inserts content "before" or "after" line_number.\n' +
      '- find_and_replace(find_text, replace_text, match_case, replace_all): Finds and replaces text.\n' +
      '- read_document(start_line, end_line): Reads lines with line numbers.\n\n' +
      'RULES:\n' +
      '1. ALWAYS execute the appropriate tools to perform requested code/text modifications directly.\n' +
      '2. Rely on the exact line numbers provided in the current document context.\n' +
      '3. Be concise and technical in your feedback.\n' +
      '4. Preserve formatting, indentation, and code style.';

    this.chatHistory_.push({
      role: 'user',
      parts: [{
        text: '[CURRENT ACTIVE DOCUMENT CONTEXT]\n' + currentDocContext + '\n\n[USER INSTRUCTION]:\n' + userPrompt
      }]
    });

    var keepRunning = true;
    var turnCount = 0;
    var maxTurns = 5;

    while (keepRunning && turnCount < maxTurns) {
      turnCount++;
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + encodeURIComponent(apiKey);
      var payload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: this.chatHistory_,
        tools: AiAgentController.TOOLS
      };

      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        var errorData = await response.json().catch(function() { return {}; });
        var errorMsg = (errorData.error && errorData.error.message) || ('HTTP ' + response.status + ' ' + response.statusText);
        throw new Error(errorMsg);
      }

      var data = await response.json();
      var candidate = data.candidates && data.candidates[0];
      if (!candidate || !candidate.content) {
        throw new Error('No candidate content received from Gemini API.');
      }

      var modelParts = candidate.content.parts || [];
      this.chatHistory_.push({
        role: 'model',
        parts: modelParts
      });

      var functionCalls = modelParts.filter(function(p) { return !!p.functionCall; });

      if (functionCalls.length > 0) {
        var functionResponseParts = [];

        for (var i = 0; i < functionCalls.length; i++) {
          var callPart = functionCalls[i];
          var name = callPart.functionCall.name;
          var args = callPart.functionCall.args || {};

          this.appendToolInvocationMessage_(name, args);
          var toolResult = this.executeTool_(name, args);
          this.appendToolResultMessage_(name, toolResult);

          functionResponseParts.push({
            functionResponse: {
              name: name,
              response: { result: toolResult }
            }
          });
        }

        this.chatHistory_.push({
          role: 'user',
          parts: functionResponseParts
        });
      } else {
        var textParts = modelParts
          .filter(function(p) { return p.text; })
          .map(function(p) { return p.text; })
          .join('\n');

        if (textParts) {
          this.appendModelMessage_(textParts);
        }
        keepRunning = false;
      }
    }

  } catch (err) {
    console.error('Gemini Agent Error:', err);
    this.appendErrorMessage_(err.message || String(err));
  } finally {
    this.setBusy_(false);
  }
};

/**
 * Retrieves the stored Gemini API key.
 * @return {string}
 * @private
 */
AiAgentController.prototype.getApiKey_ = function() {
  return localStorage.getItem('gemini_api_key') || sessionStorage.getItem('gemini_api_key') || '';
};

/**
 * Saves the Gemini API key.
 * @param {string} key
 * @param {boolean} remember
 * @private
 */
AiAgentController.prototype.setApiKey_ = function(key, remember) {
  key = String(key || '').trim();
  if (!key) {
    localStorage.removeItem('gemini_api_key');
    sessionStorage.removeItem('gemini_api_key');
    return;
  }
  if (remember) {
    localStorage.setItem('gemini_api_key', key);
    sessionStorage.removeItem('gemini_api_key');
  } else {
    sessionStorage.setItem('gemini_api_key', key);
    localStorage.removeItem('gemini_api_key');
  }
};

/**
 * Initializes listeners for the API Key dialog.
 * @private
 */
AiAgentController.prototype.initKeyModalListeners_ = function() {
  if (this.keySaveBtn_) {
    this.keySaveBtn_.addEventListener('click', () => {
      var val = this.keyInput_ ? this.keyInput_.value.trim() : '';
      var rem = this.keyRemember_ ? this.keyRemember_.checked : true;
      this.setApiKey_(val, rem);
      this.closeKeyModal_();
      if (val) {
        this.appendSystemMessage_('Gemini API key configured successfully.');
      }
    });
  }

  if (this.keyCancelBtn_) {
    this.keyCancelBtn_.addEventListener('click', this.closeKeyModal_.bind(this));
  }

  if (this.keyCloseBtn_) {
    this.keyCloseBtn_.addEventListener('click', this.closeKeyModal_.bind(this));
  }

  if (this.keyClearBtn_) {
    this.keyClearBtn_.addEventListener('click', () => {
      this.setApiKey_('', true);
      if (this.keyInput_) this.keyInput_.value = '';
      this.closeKeyModal_();
      this.appendSystemMessage_('Gemini API key removed.');
    });
  }

  if (this.keyToggleVisBtn_ && this.keyInput_) {
    this.keyToggleVisBtn_.addEventListener('click', () => {
      var isPass = this.keyInput_.type === 'password';
      this.keyInput_.type = isPass ? 'text' : 'password';
      this.keyToggleVisBtn_.textContent = isPass ? 'visibility_off' : 'visibility';
    });
  }
};

/**
 * Opens API key modal.
 * @private
 */
AiAgentController.prototype.openKeyModal_ = function() {
  if (!this.keyModal_) return;
  if (this.keyInput_) {
    this.keyInput_.value = this.getApiKey_();
  }
  if (typeof this.keyModal_.showModal === 'function') {
    this.keyModal_.showModal();
  } else {
    this.keyModal_.setAttribute('open', '');
  }
};

/**
 * Closes API key modal.
 * @private
 */
AiAgentController.prototype.closeKeyModal_ = function() {
  if (!this.keyModal_) return;
  if (typeof this.keyModal_.close === 'function') {
    this.keyModal_.close();
  } else {
    this.keyModal_.removeAttribute('open');
  }
};

/**
 * Initializes draggable panel resizer.
 * @private
 */
AiAgentController.prototype.initResizer_ = function() {
  if (!this.resizer_ || !this.panel_) return;

  var self = this;
  var isDragging = false;
  var startX = 0;
  var startWidth = 0;

  this.resizer_.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startWidth = self.panel_.offsetWidth;
    self.panel_.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      if (!isDragging) return;
      var newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth < 260) newWidth = 260;
      if (newWidth > 700) newWidth = 700;
      self.panel_.style.width = newWidth + 'px';
    }

    function onMouseUp(upEvent) {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      self.panel_.style.transition = 'width 0.2s ease-in-out';
      localStorage.setItem('ai_panel_width', self.panel_.offsetWidth);
      if (self.editor_ && self.editor_.editorView_ && typeof self.editor_.editorView_.requestMeasure === 'function') {
        self.editor_.editorView_.requestMeasure();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
};

/**
 * Escapes HTML characters for safe rendering.
 * @param {string} str
 * @return {string}
 * @private
 */
AiAgentController.prototype.escapeHtml_ = function(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
