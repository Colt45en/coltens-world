/**
 * CodeEditor – lightweight in-browser code editor with basic JS syntax
 * highlighting and a sandboxed eval runner.
 *
 * Usage (browser):
 *   const editor = new CodeEditor(document.getElementById('editor-root'));
 *   editor.mount();
 *   editor.onRun = (code) => console.log('run:', code);
 */

/** Rudimentary tokeniser for JS-flavoured highlighting. */
function highlight(code) {
  const keywords = /\b(const|let|var|function|class|return|if|else|for|while|new|import|export|default|from|async|await|try|catch|throw|typeof|instanceof)\b/g;
  const strings  = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
  const numbers  = /\b(\d+\.?\d*)\b/g;
  const comments = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
  const ops      = /([=><!&|+\-*/%^~?:;,{}[\]().])/g;

  // Escape HTML first, then re-apply spans
  const esc = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return esc
    .replace(comments, '<span class="ce-comment">$1</span>')
    .replace(strings,  '<span class="ce-string">$&</span>')
    .replace(numbers,  '<span class="ce-number">$1</span>')
    .replace(keywords, '<span class="ce-keyword">$1</span>')
    .replace(ops,      '<span class="ce-op">$1</span>');
}

export class CodeEditor {
  /**
   * @param {HTMLElement} container
   * @param {{ value?: string, language?: string }} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this._value    = opts.value    ?? '// Write your code here\n';
    this._language = opts.language ?? 'javascript';

    /** Called with the current code string when the user presses Run. */
    this.onRun = null;

    /** Called with (code, result) after a successful sandboxed run. */
    this.onResult = null;

    this._textarea   = null;
    this._highlight  = null;
    this._outputEl   = null;
    this._mounted    = false;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Attach the editor DOM into the container element. */
  mount() {
    if (this._mounted) return;

    this.container.innerHTML = `
      <style>
        .ce-root { display:flex; flex-direction:column; height:100%; font-family:monospace; }
        .ce-toolbar { display:flex; gap:6px; padding:4px 6px; background:#1e1e2e; }
        .ce-btn { background:#313244; color:#cdd6f4; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; }
        .ce-btn:hover { background:#45475a; }
        .ce-editor-wrap { position:relative; flex:1; overflow:auto; background:#1e1e2e; }
        .ce-textarea { position:absolute; inset:0; width:100%; height:100%; background:transparent;
          color:transparent; caret-color:#cdd6f4; font:13px/1.5 'Fira Code',monospace;
          border:none; outline:none; resize:none; padding:10px; box-sizing:border-box;
          tab-size:2; white-space:pre; overflow-wrap:normal; overflow-x:auto; z-index:2; }
        .ce-highlight { position:absolute; inset:0; pointer-events:none;
          font:13px/1.5 'Fira Code',monospace; padding:10px; box-sizing:border-box;
          color:#cdd6f4; white-space:pre; overflow-wrap:normal; overflow-x:auto; z-index:1; }
        .ce-keyword { color:#cba6f7; font-weight:bold; }
        .ce-string  { color:#a6e3a1; }
        .ce-number  { color:#fab387; }
        .ce-comment { color:#6c7086; font-style:italic; }
        .ce-op      { color:#89dceb; }
        .ce-output  { max-height:120px; overflow-y:auto; background:#11111b; color:#a6e3a1;
          font:12px/1.4 monospace; padding:6px 10px; border-top:1px solid #313244; }
      </style>
      <div class="ce-root">
        <div class="ce-toolbar">
          <button class="ce-btn" id="ce-run">▶ Run</button>
          <button class="ce-btn" id="ce-clear">✕ Clear</button>
          <span style="flex:1"></span>
          <span style="color:#6c7086;font-size:11px;align-self:center">${this._language}</span>
        </div>
        <div class="ce-editor-wrap">
          <div class="ce-highlight" id="ce-hl"></div>
          <textarea class="ce-textarea" id="ce-ta" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
        </div>
        <div class="ce-output" id="ce-out"></div>
      </div>
    `;

    this._textarea  = this.container.querySelector('#ce-ta');
    this._highlight = this.container.querySelector('#ce-hl');
    this._outputEl  = this.container.querySelector('#ce-out');

    this._textarea.value = this._value;
    this._updateHighlight();

    this._textarea.addEventListener('input',   () => this._onInput());
    this._textarea.addEventListener('keydown',  (e) => this._onKeyDown(e));
    this._textarea.addEventListener('scroll',   () => this._syncScroll());
    this.container.querySelector('#ce-run').addEventListener('click',  () => this.run());
    this.container.querySelector('#ce-clear').addEventListener('click', () => this.clearOutput());

    this._mounted = true;
  }

  /** Current code value. */
  get value() {
    return this._textarea ? this._textarea.value : this._value;
  }
  set value(v) {
    this._value = v;
    if (this._textarea) {
      this._textarea.value = v;
      this._updateHighlight();
    }
  }

  /**
   * Execute the current code in a sandboxed Function scope.
   * @returns {{ ok:boolean, result:any, error:string|null }}
   */
  run() {
    const code = this.value;
    if (this.onRun) this.onRun(code);
    let result, error = null, ok = true;
    try {
      const lines = [];
      const fakeConsole = { log: (...a) => lines.push(a.map(String).join(' ')) };
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', code);
      result = fn(fakeConsole);
      const out = lines.join('\n');
      this._print(out || (result !== undefined ? String(result) : '(no output)'), false);
      if (this.onResult) this.onResult(code, result);
    } catch (e) {
      error = e.message;
      ok = false;
      this._print(`Error: ${e.message}`, true);
    }
    return { ok, result, error };
  }

  /** Clear the output panel. */
  clearOutput() {
    if (this._outputEl) this._outputEl.innerHTML = '';
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _onInput() {
    this._value = this._textarea.value;
    this._updateHighlight();
  }

  _onKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = this._textarea.selectionStart;
      const v = this._textarea.value;
      this._textarea.value = v.slice(0, s) + '  ' + v.slice(this._textarea.selectionEnd);
      this._textarea.selectionStart = this._textarea.selectionEnd = s + 2;
      this._updateHighlight();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.run();
    }
  }

  _syncScroll() {
    this._highlight.scrollTop  = this._textarea.scrollTop;
    this._highlight.scrollLeft = this._textarea.scrollLeft;
  }

  _updateHighlight() {
    this._highlight.innerHTML = highlight(this._textarea.value) + '\n';
  }

  _print(text, isError) {
    if (!this._outputEl) return;
    const line = document.createElement('div');
    line.textContent = text;
    if (isError) line.style.color = '#f38ba8';
    this._outputEl.appendChild(line);
    this._outputEl.scrollTop = this._outputEl.scrollHeight;
  }
}
