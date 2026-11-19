/**
 * Interactive guide: every chapter has a small block editor, the TypeScript it makes (live),
 * and a "Spustit" button that runs the example right in the page.
 */
import * as Blockly from 'blockly';
import { defineBlocks, makeTheme } from '../webview/blocks';
import { generate, generateJs, LineSpan } from '../webview/generator';
import type { Section } from './content';
import { highlight } from '../highlight';

interface GuideUi {
  tryTitle: string;
  reset: string;
  resetTitle: string;
  run: string;
  output: string;
  answer: string;
  tryPrefix: string;
  why: string;
}

interface GuideData {
  ui: GuideUi;
  sections: Section[];
  workspaces: Record<string, object>;
}

const data = (window as unknown as { GUIDE_DATA: GuideData }).GUIDE_DATA;
const media = (window as unknown as { BLOCKLY_MEDIA?: string }).BLOCKLY_MEDIA ?? 'blockly/';

defineBlocks();

// ------------------------------------------------------------------ theme

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}
function isDark(): boolean {
  const c = document.body.classList;
  if (c.contains('vscode-light') || c.contains('vscode-high-contrast-light')) return false;
  if (c.contains('vscode-dark') || c.contains('vscode-high-contrast')) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function theme(): Blockly.Theme {
  const dark = isDark();
  return makeTheme({
    dark,
    bg: cssVar('--ex-bg', dark ? '#16181d' : '#f6f7f9'),
    panel: cssVar('--ex-bg', dark ? '#16181d' : '#f6f7f9'),
    fg: cssVar('--fg', dark ? '#d7dae0' : '#30333a'),
    font: cssVar('--font', '"Segoe UI", system-ui, sans-serif'),
  });
}

// ------------------------------------------------------------------ page

const toc = document.getElementById('toc')!;
const main = document.getElementById('content')!;
let lastGroup = '';

for (const s of data.sections) {
  if (s.group !== lastGroup) {
    lastGroup = s.group;
    const g = document.createElement('div');
    g.className = 'tocGroup';
    g.textContent = s.group;
    toc.appendChild(g);
  }
  const a = document.createElement('a');
  a.href = '#' + s.id;
  a.textContent = s.title;
  a.dataset.id = s.id;
  toc.appendChild(a);

  const sec = document.createElement('section');
  sec.id = s.id;
  sec.className = 'chapter';
  sec.innerHTML = `<div class="kicker"></div><h2></h2><div class="body"></div>`;
  sec.querySelector('.kicker')!.textContent = s.group;
  sec.querySelector('h2')!.textContent = s.title;
  sec.querySelector('.body')!.innerHTML = s.body;
  if (s.why) {
    const why = document.createElement('aside');
    why.className = 'why';
    why.innerHTML = '<b></b> <span></span>';
    why.querySelector('b')!.textContent = data.ui.why;
    why.querySelector('span')!.textContent = s.why;
    sec.appendChild(why);
  }
  if (s.code && data.workspaces[s.id]) sec.appendChild(exampleShell(s));
  main.appendChild(sec);
}

// highlight the chapter you are reading in the table of contents
const tocLinks = [...toc.querySelectorAll<HTMLAnchorElement>('a')];
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) tocLinks.forEach((l) => l.classList.toggle('on', l.dataset.id === (e.target as HTMLElement).id));
  },
  { rootMargin: '-15% 0px -75% 0px' },
);
document.querySelectorAll('.chapter').forEach((c) => io.observe(c));

// ------------------------------------------------------------------ examples

function exampleShell(s: Section): HTMLElement {
  const box = document.createElement('div');
  box.className = 'example';
  box.innerHTML = `
    <div class="exHead">
      <span class="exTitle">${data.ui.tryTitle}</span>
      <span class="grow"></span>
      <button class="ghost reset" title="${data.ui.resetTitle}">${data.ui.reset}</button>
      ${s.run ? `<button class="run"><i class="tri"></i>${data.ui.run}</button>` : ''}
    </div>
    <div class="exPanes">
      <div class="exBlocks"></div>
      <pre class="exCode"></pre>
    </div>
    ${s.tryIt ? '<div class="exTry"></div>' : ''}
    <div class="exOut" hidden><div class="outHead">${data.ui.output}</div><pre class="outText"></pre><form class="outAsk" hidden><span class="caret">&rsaquo;</span><input placeholder="${data.ui.answer}"></form></div>`;
  if (s.tryIt) box.querySelector('.exTry')!.textContent = data.ui.tryPrefix + s.tryIt;
  // inject Blockly only when the example scrolls into view (pages with many editors stay fast)
  const lazy = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      lazy.disconnect();
      setupExample(box, s);
    }
  }, { rootMargin: '400px 0px' });
  lazy.observe(box);
  return box;
}

const editors: Blockly.WorkspaceSvg[] = [];

function setupExample(box: HTMLElement, s: Section) {
  const host = box.querySelector<HTMLElement>('.exBlocks')!;
  const codeEl = box.querySelector<HTMLElement>('.exCode')!;
  const ws = Blockly.inject(host, {
    renderer: 'zelos',
    theme: theme(),
    media,
    sounds: false,
    trashcan: false,
    zoom: { controls: true, wheel: false, startScale: 0.72, maxScale: 1.6, minScale: 0.35 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  editors.push(ws);
  let spans: LineSpan[] = [];
  let lines: string[] = [];

  const load = () => {
    Blockly.Events.disable();
    try {
      ws.clear();
      Blockly.serialization.workspaces.load(data.workspaces[s.id], ws);
      ws.cleanUp();
    } finally {
      Blockly.Events.enable();
    }
    fit();
    refresh();
  };

  const fit = () => {
    // make the editor as tall as the blocks need (within limits)
    const bounds = ws.getBlocksBoundingBox();
    const h = Math.max(200, Math.min(560, (bounds.bottom - bounds.top) * ws.scale + 70));
    host.style.height = `${h}px`;
    Blockly.svgResize(ws);
    ws.scroll(20 - bounds.left * ws.scale, 20 - bounds.top * ws.scale);
  };

  const refresh = () => {
    const out = generate(ws, true, { indent: '  ', quote: 'double' });
    spans = out.spans;
    lines = out.ts.replace(/\n+$/, '').split('\n');
    codeEl.innerHTML = lines.map((l, i) => `<span class="ln" data-i="${i}">${highlight(l) || ' '}</span>`).join('');
  };

  const mark = (id: string | null) => {
    codeEl.querySelectorAll('.ln.on').forEach((e) => e.classList.remove('on'));
    let b: Blockly.Block | null = id ? ws.getBlockById(id) : null;
    while (b && !spans.some((sp) => sp.id === b!.id)) b = b.getParent();
    const span = b ? spans.find((sp) => sp.id === b!.id) : undefined;
    if (!span) return;
    for (let i = span.start; i <= span.end; i++) codeEl.querySelector(`.ln[data-i="${i}"]`)?.classList.add('on');
  };

  let t: number | undefined;
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.type === Blockly.Events.SELECTED) {
      mark((e as Blockly.Events.Selected).newElementId ?? null);
      return;
    }
    if (e.isUiEvent) return;
    clearTimeout(t);
    t = window.setTimeout(refresh, 120);
  });

  codeEl.onclick = (e) => {
    const ln = (e.target as HTMLElement).closest<HTMLElement>('.ln');
    if (!ln) return;
    const i = Number(ln.dataset.i);
    let best: LineSpan | undefined;
    for (const sp of spans) if (i >= sp.start && i <= sp.end && (!best || sp.end - sp.start < best.end - best.start)) best = sp;
    if (best) {
      (ws.getBlockById(best.id) as Blockly.BlockSvg | null)?.select();
      mark(best.id);
    }
  };

  box.querySelector<HTMLButtonElement>('.reset')!.onclick = load;
  const runBtn = box.querySelector<HTMLButtonElement>('.run');
  if (runBtn) runBtn.onclick = () => runExample(box, generateJs(ws));
  load();
}

new MutationObserver(() => editors.forEach((w) => w.setTheme(theme()))).observe(document.body, { attributes: true, attributeFilter: ['class'] });

// ------------------------------------------------------------------ running examples in the page

const COLORS: Record<number, string> = { 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan' };

function fmt(v: unknown, top = true): string {
  if (typeof v === 'string') return top ? v : JSON.stringify(v);
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `[ ${v.map((x) => fmt(x, false)).join(', ')} ]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${fmt(x, false)}`).join(', ')} }`;
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
  return String(v);
}

let runId = 0;

async function runExample(box: HTMLElement, js: string) {
  const id = ++runId;
  const outBox = box.querySelector<HTMLElement>('.exOut')!;
  const outText = box.querySelector<HTMLElement>('.outText')!;
  const askForm = box.querySelector<HTMLFormElement>('.outAsk')!;
  const askInput = askForm.querySelector('input')!;
  outBox.hidden = false;
  outText.textContent = '';
  askForm.hidden = true;

  const print = (text: string, cls?: string) => {
    if (id !== runId) return;
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text + '\n';
    outText.appendChild(span);
  };
  const consoleStub = { log: (...a: unknown[]) => print(a.map((x) => fmt(x)).join(' ')) };
  const ask = (q: string) =>
    new Promise<string>((resolve) => {
      const qLine = document.createElement('span');
      qLine.textContent = q + ' ';
      outText.appendChild(qLine);
      askForm.hidden = false;
      askInput.value = '';
      askInput.focus();
      askForm.onsubmit = (e) => {
        e.preventDefault();
        const answer = askInput.value;
        const echo = document.createElement('span');
        echo.className = 'echo';
        echo.textContent = answer + '\n';
        outText.appendChild(echo);
        askForm.hidden = true;
        resolve(answer);
      };
    });
  const sleep = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));
  const sayColored = (v: unknown, c: number) => print(fmt(v), 'c-' + (COLORS[c] ?? ''));
  const processStub = { exit: () => { throw new StopSignal(); } };

  const onReject = (e: PromiseRejectionEvent) => {
    if (e.reason instanceof StopSignal) return e.preventDefault();
    print(String(e.reason?.message ?? e.reason), 'err');
    e.preventDefault();
  };
  window.addEventListener('unhandledrejection', onReject, { once: true });
  try {
    const fn = new Function('console', 'ask', 'sleep', 'sayColored', 'process', `"use strict";\n${js}`);
    fn(consoleStub, ask, sleep, sayColored, processStub);
  } catch (err) {
    if (!(err instanceof StopSignal)) print(String((err as Error).message ?? err), 'err');
  }
}

class StopSignal extends Error {}

