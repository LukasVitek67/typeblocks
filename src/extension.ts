import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as ts from 'typescript';
import { pageHtml } from './page';
import { tsToBlocks } from './convert/tsToBlocks';
import { STARTER_TS } from './starter';
import { guidePageHtml } from './guide/page';
import { activateUpdater } from './updater';

const VIEW_TYPE = 'typeblocks.editor';

interface Span {
  id: string;
  start: number;
  end: number;
  color: string;
}

export function activate(ctx: vscode.ExtensionContext): void {
  const provider = new BlocksEditorProvider(ctx);
  ctx.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand('typeblocks.openBlocks', (uri?: vscode.Uri) => openBlocks(uri)),
    vscode.commands.registerCommand('typeblocks.openCode', () => provider.active?.openCode()),
    vscode.commands.registerCommand('typeblocks.new', newProgram),
    vscode.commands.registerCommand('typeblocks.run', () => provider.active?.run()),
    vscode.commands.registerCommand('typeblocks.stop', () => provider.active?.stop()),
    vscode.commands.registerCommand('typeblocks.guide', () => openGuide(ctx)),
    vscode.window.onDidChangeTextEditorSelection((e) => provider.onTextSelection(e)),
    vscode.window.onDidChangeVisibleTextEditors(() => provider.redecorateAll()),
    vscode.window.onDidCloseTerminal((t) => provider.onTerminalClosed(t)),
  );
  activateUpdater(ctx, currentLang);
}

export function deactivate(): void {}

/** Shows a .ts file as blocks, in place of its text editor tab. */
async function openBlocks(uri?: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const target = uri ?? editor?.document.uri;
  if (!target) {
    void vscode.window.showInformationMessage('TypeBlocks: open a .ts file first.');
    return;
  }
  const column = editor && editor.document.uri.toString() === target.toString() ? editor.viewColumn : vscode.ViewColumn.Active;
  await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, column);
  // close the text tab we came from, so the blocks take its place
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn !== column) continue;
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === target.toString()) await vscode.window.tabGroups.close(tab, true);
    }
  }
}

let guidePanel: vscode.WebviewPanel | undefined;

/** The interactive guide (Czech), in its own tab next to the editor. */
function openGuide(ctx: vscode.ExtensionContext): void {
  if (guidePanel) {
    guidePanel.reveal(vscode.ViewColumn.Beside);
    return;
  }
  const media = vscode.Uri.joinPath(ctx.extensionUri, 'media');
  guidePanel = vscode.window.createWebviewPanel('typeblocks.guide', 'TypeBlocks - průvodce', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [media],
  });
  guidePanel.iconPath = vscode.Uri.joinPath(media, 'icon.png');
  const w = guidePanel.webview;
  const u = (p: string) => w.asWebviewUri(vscode.Uri.joinPath(media, p)).toString();
  const nonce = [...Array(24)].map(() => Math.random().toString(36)[2]).join('');
  // 'unsafe-eval': the "Spustit" buttons run the examples inside the page
  const csp = [`default-src 'none'`, `img-src ${w.cspSource} data:`, `style-src ${w.cspSource} 'unsafe-inline'`, `font-src ${w.cspSource}`, `script-src 'nonce-${nonce}' 'unsafe-eval'`].join('; ');
  const lang = currentLang();
  w.html = guidePageHtml({ csp, nonce, lang, css: [u('guide.css')], scripts: [u(`guide-data.${lang}.js`), u('guide.js')], blocklyMedia: u('blockly') + '/' });
  guidePanel.title = lang === 'cs' ? 'TypeBlocks - průvodce' : 'TypeBlocks - guide';
  const sub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('typeblocks.language') && guidePanel) {
      const l = currentLang();
      guidePanel.title = l === 'cs' ? 'TypeBlocks - průvodce' : 'TypeBlocks - guide';
      w.html = guidePageHtml({ csp, nonce, lang: l, css: [u('guide.css')], scripts: [u(`guide-data.${l}.js`), u('guide.js')], blocklyMedia: u('blockly') + '/' });
    }
  });
  guidePanel.onDidDispose(() => {
    sub.dispose();
    guidePanel = undefined;
  });
}

async function newProgram(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: folder ? vscode.Uri.joinPath(folder, 'program.ts') : undefined,
    filters: { TypeScript: ['ts'] },
    saveLabel: 'Create',
  });
  if (!uri) return;
  await vscode.workspace.fs.writeFile(uri, new Uint8Array());
  await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
}

/**
 * Is @types/node installed between the file's folder and the opened workspace folder?
 * (VS Code's TypeScript does not look above the workspace folder for loose files.)
 */
function hasNodeTypes(file: vscode.Uri): boolean {
  const stop = vscode.workspace.getWorkspaceFolder(file)?.uri.fsPath;
  for (let d = path.dirname(file.fsPath); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'node_modules', '@types', 'node', 'package.json'))) return true;
    if (!stop || path.relative(stop, d) === '' || path.dirname(d) === d) return false;
  }
}

/** 'cs' or 'en': setting typeblocks.language, "auto" follows the VS Code display language. */
function currentLang(): 'cs' | 'en' {
  const v = vscode.workspace.getConfiguration('typeblocks').get<string>('language', 'auto');
  if (v === 'cs' || v === 'en') return v;
  return vscode.env.language.toLowerCase().startsWith('cs') ? 'cs' : 'en';
}

/** The nearest package.json (up to the workspace folder) that has a "test" script. */
function findTests(file: vscode.Uri): { dir: string; label: string } | undefined {
  const stop = vscode.workspace.getWorkspaceFolder(file)?.uri.fsPath;
  for (let d = path.dirname(file.fsPath); ; d = path.dirname(d)) {
    const pkg = path.join(d, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const script = JSON.parse(fs.readFileSync(pkg, 'utf8'))?.scripts?.test;
        if (typeof script === 'string' && script.trim()) return { dir: d, label: 'npm test' + (stop && d !== stop ? ' (' + path.basename(d) + ')' : '') };
      } catch {
        /* broken package.json */
      }
    }
    if (!stop || path.relative(stop, d) === '' || path.dirname(d) === d) return undefined;
  }
}

class BlocksEditorProvider implements vscode.CustomTextEditorProvider {
  readonly sessions = new Set<Session>();
  active?: Session;

  constructor(readonly ctx: vscode.ExtensionContext) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const s = new Session(this, document, panel);
    this.sessions.add(s);
    this.active = s;
    panel.onDidDispose(() => {
      this.sessions.delete(s);
      if (this.active === s) this.active = undefined;
    });
    panel.onDidChangeViewState(() => {
      if (panel.active) this.active = s;
    });
  }

  onTextSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse && e.kind !== vscode.TextEditorSelectionChangeKind.Keyboard) return;
    for (const s of this.sessions) if (s.uri.toString() === e.textEditor.document.uri.toString()) s.selectFromLine(e.selections[0].active.line);
  }

  redecorateAll(): void {
    for (const s of this.sessions) s.decorate();
  }

  onTerminalClosed(t: vscode.Terminal): void {
    for (const s of this.sessions) s.terminalClosed(t);
  }
}

class Session {
  readonly uri: vscode.Uri;
  private spans: Span[] = [];
  /** Spans only match the file once the file text equals what the blocks produce. */
  private spansValid = false;
  private lastWebviewText?: string;
  private terminal?: vscode.Terminal;
  private pty?: RunPty;
  private runner?: PanelRunner;
  private openedBeside = false;
  private decoTypes = new Map<string, vscode.TextEditorDecorationType>();
  private selDeco = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
  });
  private readonly subs: vscode.Disposable[] = [];

  constructor(
    private readonly provider: BlocksEditorProvider,
    private readonly doc: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
  ) {
    this.uri = doc.uri;
    const media = vscode.Uri.joinPath(provider.ctx.extensionUri, 'media');
    panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
    panel.webview.html = this.html(panel.webview, media);
    panel.iconPath = vscode.Uri.joinPath(media, 'icon.png');

    this.subs.push(
      panel.webview.onDidReceiveMessage((m) => this.onMessage(m)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('typeblocks.language')) {
          this.panel.webview.html = this.html(this.panel.webview, vscode.Uri.joinPath(this.provider.ctx.extensionUri, 'media'));
        }
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document !== doc || !e.contentChanges.length) return;
        if (doc.getText() !== this.lastWebviewText) this.sendLoad(false);
      }),
    );
    panel.onDidDispose(() => {
      this.dispose();
      this.subs.forEach((d) => d.dispose());
      this.decoTypes.forEach((d) => d.dispose());
      this.selDeco.dispose();
    });
  }

  private cfg() {
    return vscode.workspace.getConfiguration('typeblocks', this.doc.uri);
  }

  private post(msg: unknown) {
    void this.panel.webview.postMessage(msg);
  }

  /** Converts the file to blocks and sends them to the webview. */
  private sendLoad(first: boolean) {
    const text = this.doc.getText();
    const fresh = first && !text.trim();
    let workspace: object | undefined;
    let style: object | undefined;
    let error: string | undefined;
    try {
      const conv = tsToBlocks(fresh ? STARTER_TS : text, path.basename(this.doc.uri.fsPath));
      workspace = conv.workspace;
      style = conv.style;
    } catch (err) {
      error = `Could not read this file as TypeScript: ${err}`;
    }
    const tests = findTests(this.doc.uri);
    this.post({ type: 'load', workspace, style, fresh, error, fileName: path.basename(this.doc.uri.fsPath), nodeTypes: hasNodeTypes(this.doc.uri), tests: tests ? { label: tests.label } : null });
  }

  private async onMessage(m: { type: string; ts?: string; spans?: Span[]; id?: string | null }) {
    switch (m.type) {
      case 'ready':
        this.sendLoad(true);
        this.post({ type: 'running', running: !!this.pty?.running || !!this.runner?.running });
        break;
      case 'change':
      case 'code': {
        const text = m.ts ?? '';
        this.spans = m.spans ?? [];
        if (m.type === 'change' && text !== this.doc.getText()) {
          this.lastWebviewText = text;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(this.doc.uri, new vscode.Range(0, 0, this.doc.lineCount, 0), text);
          await vscode.workspace.applyEdit(edit);
        }
        this.spansValid = text === this.doc.getText();
        if (!this.openedBeside && this.cfg().get<boolean>('openTsBeside', true)) {
          this.openedBeside = true;
          await vscode.window.showTextDocument(this.doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: false });
        }
        this.decorate();
        break;
      }
      case 'select':
        this.highlightBlock(m.id ?? null);
        break;
      case 'run':
        this.run();
        break;
      case 'stop':
        this.stop();
        break;
      case 'test':
        this.runTests();
        break;
      case 'stdin':
        this.runner?.write((m as { text?: string }).text ?? '');
        break;
      case 'setLang':
        await vscode.workspace.getConfiguration('typeblocks').update('language', (m as { lang?: string }).lang === 'cs' ? 'cs' : 'en', vscode.ConfigurationTarget.Global);
        break;
      case 'guide':
        void vscode.commands.executeCommand('typeblocks.guide');
        break;
      case 'openCode':
        await this.openCode();
        break;
    }
  }

  /** Back to the normal text editor, in the same place. */
  async openCode(): Promise<void> {
    const column = this.panel.viewColumn ?? vscode.ViewColumn.Active;
    await vscode.window.showTextDocument(this.doc, { viewColumn: column, preview: false });
    this.panel.dispose();
    // close the extra copy of the code that was shown next to the blocks
    if (this.openedBeside) {
      for (const group of vscode.window.tabGroups.all) {
        if (group.viewColumn === column) continue;
        for (const tab of group.tabs) {
          if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === this.uri.toString()) await vscode.window.tabGroups.close(tab, true);
        }
      }
    }
  }

  private textEditors(): readonly vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter((e) => e.document.uri.toString() === this.uri.toString());
  }

  /** Paints a colored stripe next to every line, in the color of the block that produced it. */
  decorate(): void {
    const editors = this.textEditors();
    if (!editors.length) return;
    const on = this.spansValid && this.cfg().get<boolean>('colorStripes', true);
    const byColor = new Map<string, vscode.Range[]>();
    if (on) {
      const lineColor = new Map<number, string>();
      const sorted = [...this.spans].sort((a, b) => b.end - b.start - (a.end - a.start)); // inner blocks win
      for (const s of sorted) for (let l = s.start; l <= s.end; l++) lineColor.set(l, s.color);
      for (const [line, color] of lineColor) {
        if (!byColor.has(color)) byColor.set(color, []);
        byColor.get(color)!.push(new vscode.Range(line, 0, line, 0));
      }
    }
    for (const color of byColor.keys()) {
      if (!this.decoTypes.has(color)) {
        this.decoTypes.set(
          color,
          vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            borderWidth: '0 0 0 4px',
            borderStyle: 'solid',
            borderColor: color,
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Left,
          }),
        );
      }
    }
    for (const ed of editors) for (const [color, type] of this.decoTypes) ed.setDecorations(type, byColor.get(color) ?? []);
  }

  private highlightBlock(id: string | null): void {
    const span = id && this.spansValid ? this.spans.find((s) => s.id === id) : undefined;
    for (const ed of this.textEditors()) {
      if (!span) {
        ed.setDecorations(this.selDeco, []);
        continue;
      }
      const range = new vscode.Range(span.start, 0, span.end, 0);
      ed.setDecorations(this.selDeco, [range]);
      ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
  }

  selectFromLine(line: number): void {
    if (!this.spansValid) return;
    let best: Span | undefined;
    for (const s of this.spans) {
      if (line < s.start || line > s.end) continue;
      if (!best || s.end - s.start < best.end - best.start) best = s;
    }
    if (best) {
      this.post({ type: 'select', id: best.id });
      this.highlightBlock(best.id);
    }
  }

  run(): void {
    const out = ts.transpileModule(this.doc.getText(), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: path.basename(this.doc.uri.fsPath),
    });
    const dir = path.join(os.tmpdir(), 'typeblocks');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, path.basename(this.doc.uri.fsPath).replace(/\.ts$/i, '') + '.run.cjs');
    fs.writeFileSync(file, out.outputText, 'utf8');

    const custom = this.cfg().get<string>('nodePath', '').trim();
    const cmd = custom || process.execPath;
    const env: Record<string, string> = custom ? {} : { ELECTRON_RUN_AS_NODE: '1' };
    const cwd = path.dirname(this.doc.uri.fsPath);

    if (this.cfg().get<string>('runIn', 'panel') !== 'terminal') {
      this.runner ??= new PanelRunner((msg) => this.post(msg));
      this.runner.start(cmd, [file], cwd, env);
      return;
    }
    if (!this.pty || !this.terminal) {
      this.pty = new RunPty((running) => this.post({ type: 'running', running }));
      this.terminal = vscode.window.createTerminal({
        name: `Run ${path.basename(this.doc.uri.fsPath)}`,
        pty: this.pty,
        iconPath: new vscode.ThemeIcon('play'),
        color: new vscode.ThemeColor('terminal.ansiGreen'),
      });
    }
    this.terminal.show(true);
    this.pty.start(cmd, [file], cwd, env);
  }

  /** npm test, shown in the console panel. */
  runTests(): void {
    const tests = findTests(this.doc.uri);
    this.runner ??= new PanelRunner((msg) => this.post(msg));
    if (!tests) {
      this.post({ type: 'out', text: 'No package.json with a "test" script was found next to this file.\n', stream: 'err' });
      return;
    }
    this.runner.start('npm', ['test'], tests.dir, {}, { shell: true, label: tests.label });
  }

  stop(): void {
    this.pty?.kill();
    this.runner?.kill();
  }

  dispose(): void {
    this.runner?.kill();
    this.pty?.kill();
    this.terminal?.dispose();
  }

  terminalClosed(t: vscode.Terminal): void {
    if (t !== this.terminal) return;
    this.pty?.kill();
    this.terminal = undefined;
    this.pty = undefined;
    this.post({ type: 'running', running: false });
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const nonce = [...Array(24)].map(() => Math.random().toString(36)[2]).join('');
    const u = (p: string) => webview.asWebviewUri(vscode.Uri.joinPath(media, p)).toString();
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');
    return pageHtml({ csp, nonce, css: u('editor.css'), js: u('webview.js'), blocklyMedia: u('blockly') + '/', lang: currentLang() });
  }
}

/** Runs the program and streams its output to the console panel inside the blocks editor. */
class PanelRunner {
  private proc?: ChildProcess;
  private buffer: { text: string; stream: 'out' | 'err' }[] = [];
  private flushTimer?: NodeJS.Timeout;
  private startedAt = 0;

  constructor(private readonly post: (msg: unknown) => void) {}

  get running(): boolean {
    return !!this.proc;
  }

  start(cmd: string, args: string[], cwd: string, env: Record<string, string>, opts: { shell?: boolean; label?: string } = {}): void {
    if (this.proc) {
      const old = this.proc;
      this.proc = undefined;
      old.removeAllListeners('exit');
      killTree(old);
    }
    this.buffer = [];
    this.startedAt = Date.now();
    this.post({ type: 'runStarted', label: opts.label });
    this.post({ type: 'running', running: true });
    let proc: ChildProcess;
    try {
      // colors on; VS Code sets NO_COLOR, which would make Node warn about the conflict
      const fullEnv: NodeJS.ProcessEnv = { ...process.env, ...env, FORCE_COLOR: '1' };
      delete fullEnv.NO_COLOR;
      proc = spawn(cmd, args, { cwd, env: fullEnv, stdio: 'pipe', windowsHide: true, shell: opts.shell });
    } catch (err) {
      this.post({ type: 'out', text: `Could not start: ${err}\n`, stream: 'err' });
      this.post({ type: 'exited', code: 1, signal: null, ms: 0 });
      this.post({ type: 'running', running: false });
      return;
    }
    this.proc = proc;
    proc.stdout?.on('data', (d: Buffer) => this.queue(d.toString('utf8'), 'out'));
    proc.stderr?.on('data', (d: Buffer) => this.queue(d.toString('utf8'), 'err'));
    proc.on('error', (err) => this.queue(err.message + '\n', 'err'));
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = undefined;
      this.flush();
      this.post({ type: 'exited', code, signal, ms: Date.now() - this.startedAt });
      this.post({ type: 'running', running: false });
    });
  }

  write(line: string): void {
    this.proc?.stdin?.write(line + '\n');
  }

  kill(): void {
    if (this.proc) killTree(this.proc);
  }

  /** Output is sent in small batches so a fast loop cannot flood the editor. */
  private queue(text: string, stream: 'out' | 'err'): void {
    const last = this.buffer[this.buffer.length - 1];
    if (last && last.stream === stream) last.text += text;
    else this.buffer.push({ text, stream });
    const size = this.buffer.reduce((n, b) => n + b.text.length, 0);
    if (size > 200_000) {
      this.buffer = [{ text: '... (lots of output skipped) ...\n', stream: 'err' }, ...this.buffer.slice(-1).map((b) => ({ ...b, text: b.text.slice(-50_000) }))];
    }
    this.flushTimer ??= setTimeout(() => this.flush(), 30);
  }

  private flush(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    for (const b of this.buffer) this.post({ type: 'out', text: b.text, stream: b.stream });
    this.buffer = [];
  }
}

/** Stops a process and everything it started (npm runs node in a child process). */
function killTree(proc: ChildProcess): void {
  if (process.platform === 'win32' && proc.pid) {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }).on('error', () => proc.kill());
  } else {
    proc.kill();
  }
}

/**
 * A terminal the extension drives itself: output stays after the program ends,
 * and typed lines are forwarded to the program's stdin (for the "ask" blocks).
 */
class RunPty implements vscode.Pseudoterminal {
  private readonly writer = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writer.event;
  private proc?: ChildProcess;
  private line = '';
  private opened = false;
  private pending: (() => void) | undefined;

  constructor(private readonly onRunning: (running: boolean) => void) {}

  get running(): boolean {
    return !!this.proc;
  }

  open(): void {
    this.opened = true;
    const p = this.pending;
    this.pending = undefined;
    p?.();
  }

  close(): void {
    this.kill();
  }

  start(cmd: string, args: string[], cwd: string, env: Record<string, string>): void {
    if (!this.opened) {
      this.pending = () => this.start(cmd, args, cwd, env);
      return;
    }
    if (this.proc) {
      const old = this.proc;
      this.proc = undefined;
      old.removeAllListeners('exit');
      old.kill();
      this.writer.fire('\r\n\x1b[2m-- restarted --\x1b[0m\r\n');
    }
    this.line = '';
    this.writer.fire(`\x1b[1;32m> Running\x1b[0m \x1b[2m${new Date().toLocaleTimeString()}\x1b[0m\r\n`);
    let proc: ChildProcess;
    try {
      proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe', windowsHide: true });
    } catch (err) {
      this.writer.fire(`\x1b[31mCould not start: ${err}\x1b[0m\r\n`);
      return;
    }
    this.proc = proc;
    this.onRunning(true);
    proc.stdout?.on('data', (d: Buffer) => this.out(d.toString('utf8')));
    proc.stderr?.on('data', (d: Buffer) => this.out(`\x1b[31m${d.toString('utf8')}\x1b[0m`));
    proc.on('error', (err) => this.out(`\x1b[31m${err.message}\x1b[0m\n`));
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = undefined;
      const how = signal ? 'stopped' : code === 0 ? 'finished' : `ended with error (exit ${code})`;
      this.writer.fire(`\r\n\x1b[2m-- program ${how} --\x1b[0m\r\n\r\n`);
      this.onRunning(false);
    });
  }

  kill(): void {
    this.proc?.kill();
  }

  private out(s: string): void {
    this.writer.fire(s.replace(/\r?\n/g, '\r\n'));
  }

  handleInput(data: string): void {
    if (!this.proc) return;
    if (data.startsWith('\x1b')) return; // arrows etc.
    for (const ch of data) {
      if (ch === '\r') {
        this.writer.fire('\r\n');
        this.proc.stdin?.write(this.line + '\n');
        this.line = '';
      } else if (ch === '\x7f' || ch === '\b') {
        if (this.line) {
          this.line = this.line.slice(0, -1);
          this.writer.fire('\b \b');
        }
      } else if (ch === '\x03') {
        this.kill();
      } else if (ch >= ' ') {
        this.line += ch;
        this.writer.fire(ch);
      }
    }
  }
}
