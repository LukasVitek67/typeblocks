/**
 * "What does this block do?" - right-click any block (also on the left side) and a window explains it:
 * plain words, a small example you can change, the TypeScript it makes (live) and a Run button.
 */
import * as Blockly from 'blockly';
import { tr } from '../i18n';
import { highlight } from '../highlight';
import { generate, generateJs, LineSpan } from './generator';
import DATA from './help.data.json';
import { collectTypes } from './types';

type Lang = 'cs' | 'en';
interface Entry {
  cs: { title: string; text: string; tip: string };
  en: { title: string; text: string; tip: string };
  code: string;
  run: boolean;
  workspace: Record<string, unknown>;
}
const data = DATA as unknown as Record<string, Entry>;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<void>;
class StopSignal extends Error {}
const ANSI: Record<number, string> = { 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan' };

function fmt(v: unknown, top = true): string {
  if (typeof v === 'string') return top ? v : JSON.stringify(v);
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[ ${v.map((x) => fmt(x, false)).join(', ')} ]`;
  if (v instanceof Map) return `Map(${v.size}) { ${[...v].map(([k, x]) => `${fmt(k, false)} => ${fmt(x, false)}`).join(', ')} }`;
  if (v instanceof Set) return `Set(${v.size}) { ${[...v].map((x) => fmt(x, false)).join(', ')} }`;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'function') return '[Function]';
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${fmt(x, false)}`).join(', ')} }`;
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
  return String(v);
}

export function initBlockHelp(theme: () => Blockly.Theme, media: string): void {
  const lang: Lang = (window as unknown as { TB_LANG?: string }).TB_LANG === 'cs' ? 'cs' : 'en';

  // Blockly's own "Help" item opens a web page - ours explains the block right here
  try {
    Blockly.ContextMenuRegistry.registry.unregister('blockHelp');
  } catch {
    /* not registered */
  }
  Blockly.ContextMenuRegistry.registry.register({
    id: 'tb_block_help',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: -40,
    displayText: () => tr('What does this block do?'),
    preconditionFn: (scope) => (scope.block ? 'enabled' : 'hidden'),
    callback: (scope) => open(scope.block as Blockly.BlockSvg),
  });

  // ------------------------------------------------------------ window
  const overlay = document.createElement('div');
  overlay.id = 'tbHelp';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="hpCard" role="dialog" aria-modal="true" aria-labelledby="hpTitle">
      <header class="hpHead">
        <span class="hpSwatch" aria-hidden="true"></span>
        <h2 id="hpTitle"></h2>
        <button type="button" class="hpClose" title="${tr('Close')}" aria-label="${tr('Close')}">×</button>
      </header>
      <p class="hpText"></p>
      <div class="hpLab">
        <section class="hpBlocksWrap">
          <div class="hpLabel">${tr('Example - you can change it')}</div>
          <div class="hpBlocks"></div>
        </section>
        <section class="hpCodeWrap">
          <div class="hpLabel">${tr('The TypeScript it makes')}</div>
          <pre class="hpCode"></pre>
        </section>
      </div>
      <div class="hpBar">
        <button type="button" class="hpRun">▶ ${tr('Run')}</button>
        <button type="button" class="hpReset">↺ ${tr('Back to the original')}</button>
        <p class="hpTip"></p>
      </div>
      <div class="hpOut" hidden>
        <pre class="hpOutText"></pre>
        <form class="hpAsk" hidden><input type="text" autocomplete="off" spellcheck="false" aria-label="${tr('Your answer')}"><button type="submit">↵</button></form>
      </div>
      <p class="hpNoRun" hidden>${tr('This example needs another file, so it cannot run here. Look at the blocks and the code.')}</p>
    </div>`;
  document.body.appendChild(overlay);
  const $ = <T extends HTMLElement>(s: string) => overlay.querySelector<T>(s)!;
  const blocksHost = $('.hpBlocks');
  const codeEl = $('.hpCode');
  const outBox = $('.hpOut');
  const outText = $('.hpOutText');
  const askForm = $<HTMLFormElement>('.hpAsk');
  const askInput = askForm.querySelector('input')!;
  // keep Blockly's document-wide keyboard shortcuts away from the window
  for (const t of ['keydown', 'keyup']) overlay.addEventListener(t, (e) => e.stopPropagation());

  let ws: Blockly.WorkspaceSvg | null = null;
  let entry: Entry | null = null;
  let type = '';
  let spans: LineSpan[] = [];
  let runId = 0;
  let timers: number[] = [];
  let lastFocus: Element | null = null;

  function open(block: Blockly.BlockSvg) {
    type = block.type;
    entry = data[type] ?? null;
    lastFocus = document.activeElement;
    const t = entry?.[lang];
    $('#hpTitle').textContent = t?.title ?? block.toString(40);
    $('.hpText').textContent = t?.text ?? String(block.getTooltip?.() ?? '');
    $('.hpTip').innerHTML = t?.tip ? `<b>${tr('Try:')}</b> ` : '';
    if (t?.tip) $('.hpTip').append(t.tip);
    $('.hpSwatch').style.background = block.getColour?.() ?? '#888';
    const hasExample = !!entry;
    $('.hpLab').hidden = !hasExample;
    $('.hpRun').hidden = !entry?.run;
    $('.hpReset').hidden = !hasExample;
    $('.hpNoRun').hidden = !entry || entry.run;
    outBox.hidden = true;
    overlay.hidden = false;
    if (hasExample) {
      if (!ws) {
        ws = Blockly.inject(blocksHost, {
          renderer: 'zelos',
          theme: theme(),
          media,
          sounds: false,
          trashcan: false,
          zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 1.6, minScale: 0.4 },
          move: { scrollbars: true, drag: true, wheel: false },
        });
        let timer: number | undefined;
        ws.addChangeListener((e: Blockly.Events.Abstract) => {
          if (e.type === Blockly.Events.SELECTED) return mark((e as Blockly.Events.Selected).newElementId ?? null);
          if (e.isUiEvent) return;
          clearTimeout(timer);
          timer = window.setTimeout(refresh, 120);
        });
      } else ws.setTheme(theme());
      load();
    }
    $<HTMLButtonElement>('.hpClose').focus();
  }

  function close() {
    stop();
    overlay.hidden = true;
    (lastFocus as HTMLElement | null)?.focus?.();
  }

  function load() {
    if (!ws || !entry) return;
    stop();
    collectTypes(entry.workspace); // the example's own types belong in the lists
    Blockly.Events.disable();
    try {
      ws.clear();
      Blockly.serialization.workspaces.load(entry.workspace, ws);
      ws.cleanUp();
    } finally {
      Blockly.Events.enable();
    }
    requestAnimationFrame(() => {
      if (!ws) return;
      Blockly.svgResize(ws);
      ws.scrollCenter();
      const b = ws.getTopBlocks(true)[0];
      if (b) ws.scroll(20 - b.getRelativeToSurfaceXY().x * ws.scale, 20 - b.getRelativeToSurfaceXY().y * ws.scale);
      // show which block this window is about
      const me = (ws.getAllBlocks(true).find((x) => x.type === type) ?? ws.getAllBlocks(true).find((x) => x.type === 'procedures_defnoreturn')) as Blockly.BlockSvg | undefined;
      me?.select();
    });
    refresh();
  }

  function refresh() {
    if (!ws) return;
    const out = generate(ws, true, { indent: '  ', quote: 'double' });
    spans = out.spans;
    const lines = out.ts.split('\n// ---- TypeBlocks helpers')[0].replace(/\n+$/, '').split('\n');
    codeEl.innerHTML = lines.map((l, i) => `<span class="ln" data-i="${i}">${highlight(l) || ' '}</span>`).join('\n');
    const sel = Blockly.getSelected() as Blockly.Block | null;
    if (sel && sel.workspace === ws) mark(sel.id);
  }

  function mark(id: string | null) {
    codeEl.querySelectorAll('.ln.on').forEach((e) => e.classList.remove('on'));
    let b: Blockly.Block | null = id && ws ? ws.getBlockById(id) : null;
    while (b && !spans.some((sp) => sp.id === b!.id)) b = b.getParent();
    const span = b ? spans.find((sp) => sp.id === b!.id) : undefined;
    if (!span) return;
    for (let i = span.start; i <= span.end; i++) codeEl.querySelector(`.ln[data-i="${i}"]`)?.classList.add('on');
  }

  // ------------------------------------------------------------ running the example right here
  function stop() {
    runId++;
    for (const t of timers) clearInterval(t);
    timers = [];
    askForm.hidden = true;
  }

  async function run() {
    if (!ws) return;
    stop();
    const id = runId;
    outBox.hidden = false;
    outText.textContent = '';
    const print = (text: string, cls?: string, newline = true) => {
      if (id !== runId) return;
      const span = document.createElement('span');
      if (cls) span.className = cls;
      span.textContent = text + (newline ? '\n' : '');
      outText.appendChild(span);
      outText.scrollTop = outText.scrollHeight;
    };
    const join = (a: unknown[]) => a.map((x) => fmt(x)).join(' ');
    const con = { log: (...a: unknown[]) => print(join(a)), info: (...a: unknown[]) => print(join(a)), error: (...a: unknown[]) => print(join(a), 'err'), warn: (...a: unknown[]) => print(join(a), 'warn'), table: (...a: unknown[]) => print(join(a)) };
    const ask = (q: string) =>
      new Promise<string>((resolve) => {
        print(String(q) + ' ', 'q', false);
        askForm.hidden = false;
        askInput.value = '';
        askInput.focus();
        askForm.onsubmit = (e) => {
          e.preventDefault();
          print(askInput.value, 'echo');
          askForm.hidden = true;
          resolve(askInput.value);
        };
      });
    const sleep = (s: number) => new Promise<void>((r) => setTimeout(r, Number(s) * 1000));
    const sayColored = (v: unknown, c: number) => print(fmt(v), 'c-' + (ANSI[c] ?? ''));
    const proc = { exit: () => { stop(); throw new StopSignal(); }, stdout: { write: (t: unknown) => print(String(t), undefined, false) }, argv: [] as string[] };
    const every = (f: () => unknown, ms: number) => {
      const t = window.setInterval(async () => {
        try {
          await f();
        } catch (err) {
          if (!(err instanceof StopSignal)) print(String((err as Error)?.message ?? err), 'err');
        }
      }, ms);
      timers.push(t);
      return t;
    };
    // errors inside async functions (e.g. main()) arrive as unhandled rejections
    const onReject = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      if (!(e.reason instanceof StopSignal)) print(String(e.reason?.message ?? e.reason), 'err');
    };
    window.addEventListener('unhandledrejection', onReject);
    setTimeout(() => window.removeEventListener('unhandledrejection', onReject), 30000);
    try {
      const fn = new AsyncFunction('console', 'ask', 'sleep', 'sayColored', 'process', 'setInterval', `"use strict";\n${generateJs(ws)}`);
      await fn(con, ask, sleep, sayColored, proc, every);
    } catch (err) {
      if (!(err instanceof StopSignal)) print(String((err as Error)?.message ?? err), 'err');
    }
  }

  $('.hpClose').addEventListener('click', close);
  $('.hpReset').addEventListener('click', () => {
    load();
    outBox.hidden = true;
  });
  $('.hpRun').addEventListener('click', () => void run());
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  new ResizeObserver(() => ws && Blockly.svgResize(ws)).observe(blocksHost);
}
