/**
 * The in-editor console: program output with colors, an input line for "ask" blocks,
 * a status dot + timer, a Test button, and four places to put it:
 * full width at the bottom, full height on the right, or a card above / below the Arrays card.
 */

type Post = (msg: unknown) => void;
export type Layout = 'bottom' | 'right' | 'float-above' | 'float-below';

const ANSI_FG: Record<number, string> = {
  30: 'black', 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
  90: 'brightBlack', 91: 'brightRed', 92: 'brightGreen', 93: 'brightYellow', 94: 'brightBlue', 95: 'brightMagenta', 96: 'brightCyan', 97: 'brightWhite',
};
const MAX_CHARS = 400_000;

export interface ConsoleApi {
  started(label?: string): void;
  output(text: string, stream: 'out' | 'err'): void;
  exited(info: { code: number | null; signal: string | null; ms: number }): void;
  show(): void;
  setTests(info: { label: string } | null): void;
}

interface Saved {
  layout?: Layout;
  h?: number; // bottom: height
  w?: number; // right: width
  fh?: number; // card: height
  folded?: boolean;
}

export function initConsole(post: Post): ConsoleApi {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const panel = $('console');
  const body = $('conBody');
  const out = $('conOut');
  const form = $<HTMLFormElement>('conForm');
  const input = $<HTMLInputElement>('conInput');
  const status = $('conStatus');
  const timer = $('conTime');
  const resizer = $('conResize');
  const menu = $('layoutMenu');
  const testBtn = $<HTMLButtonElement>('conTest');

  let running = false;
  let runLabel = 'Running';
  let startedAt = 0;
  let tick: number | undefined;
  let state = { fg: '', bold: false, dim: false };
  let pendingLine: HTMLSpanElement | null = null; // last line, for prompts printed without a newline
  let chars = 0;

  // ---------- layout, size & fold (remembered) ----------
  const saved: Saved = (() => {
    try {
      return JSON.parse(localStorage.getItem('tb.console') ?? '{}') as Saved;
    } catch {
      return {};
    }
  })();
  let layout: Layout = saved.layout ?? 'bottom';
  let size = { h: saved.h ?? 190, w: saved.w ?? 380, fh: saved.fh ?? 230 };
  let folded = saved.folded ?? true;
  const persist = () => {
    try {
      localStorage.setItem('tb.console', JSON.stringify({ layout, ...size, folded }));
    } catch {
      /* storage blocked */
    }
  };

  const relayout = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  function place() {
    const work = $('work');
    const stack = $('floatStack');
    const arrays = $('arrays');
    if (layout === 'bottom') document.body.insertBefore(panel, $('modal'));
    else if (layout === 'right') work.appendChild(panel);
    else if (layout === 'float-above') stack.insertBefore(panel, arrays);
    else stack.appendChild(panel);
    panel.dataset.layout = layout;
    document.body.dataset.console = layout;
    for (const b of menu.querySelectorAll<HTMLElement>('[data-layout]')) b.setAttribute('aria-checked', String(b.dataset.layout === layout));
    apply();
  }

  function apply() {
    panel.classList.toggle('folded', folded);
    panel.style.height = '';
    panel.style.width = '';
    if (!folded) {
      if (layout === 'bottom') panel.style.height = `${size.h}px`;
      else if (layout === 'right') panel.style.width = `${size.w}px`;
      else panel.style.height = `${size.fh}px`;
    }
    relayout();
  }
  place();

  const toggleFold = () => {
    folded = !folded;
    apply();
    persist();
  };
  $('conFold').onclick = toggleFold;
  $('conHead').ondblclick = (e) => {
    if ((e.target as HTMLElement).closest('button, #layoutMenu')) return;
    toggleFold();
  };
  $('conClear').onclick = () => {
    out.textContent = '';
    pendingLine = null;
    chars = 0;
    showEmpty();
  };

  // layout menu
  $('conLayout').onclick = (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  };
  menu.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-layout]');
    if (!b) return;
    layout = b.dataset.layout as Layout;
    menu.hidden = true;
    if (folded && layout !== 'bottom') folded = false;
    place();
    persist();
  };
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !(e.target as HTMLElement).closest('.layoutWrap')) menu.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.hidden = true;
  });

  // dragging the edge: top edge for bottom/card, left edge for right
  resizer.onpointerdown = (e) => {
    if (folded) return;
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, ...size };
    panel.classList.add('dragging');
    resizer.onpointermove = (m) => {
      if (layout === 'bottom') size.h = clamp(start.h + (start.y - m.clientY), 90, window.innerHeight - 160);
      else if (layout === 'right') size.w = clamp(start.w + (start.x - m.clientX), 240, window.innerWidth - 320);
      else size.fh = clamp(start.fh + (start.y - m.clientY), 110, window.innerHeight - 200);
      apply();
    };
    resizer.onpointerup = () => {
      resizer.onpointermove = resizer.onpointerup = null;
      panel.classList.remove('dragging');
      persist();
    };
  };

  // ---------- Test button ----------
  testBtn.onclick = () => post({ type: 'test' });

  // ---------- input for "ask" ----------
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!running) return;
    const text = input.value;
    input.value = '';
    const echo = document.createElement('span');
    echo.className = 'echo';
    echo.textContent = text + '\n';
    (pendingLine ?? out).appendChild(echo);
    pendingLine = null;
    post({ type: 'stdin', text });
    scrollDown();
  };
  body.onclick = () => {
    if (running && !window.getSelection()?.toString()) input.focus();
  };

  // ---------- output ----------
  function showEmpty() {
    if (out.childNodes.length) return;
    const e = document.createElement('div');
    e.className = 'conEmpty';
    e.textContent = 'Press Run - what your program prints shows up here.';
    out.appendChild(e);
  }
  showEmpty();

  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  const scrollDown = () => (body.scrollTop = body.scrollHeight);

  function newLine() {
    pendingLine = document.createElement('span');
    pendingLine.className = 'line';
    out.appendChild(pendingLine);
    return pendingLine;
  }

  function write(text: string, cls?: string) {
    out.querySelector('.conEmpty')?.remove();
    const stick = nearBottom();
    const clean = text
      .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '') // window-title sequences
      .replace(/\x1b\[[\d;?]*[A-Za-ln-z]/g, '') // cursor movement etc. (keep only colors: ...m)
      .replace(/\r\n?/g, '\n');
    const parts = clean.split(/\x1b\[([\d;]*)m/);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        for (const c of (parts[i] || '0').split(';').map(Number)) {
          if (c === 0) state = { fg: '', bold: false, dim: false };
          else if (c === 1) state.bold = true;
          else if (c === 2) state.dim = true;
          else if (c === 22) state.bold = state.dim = false;
          else if (c === 39) state.fg = '';
          else if (ANSI_FG[c]) state.fg = ANSI_FG[c];
        }
        continue;
      }
      const chunk = parts[i];
      if (!chunk) continue;
      const lines = chunk.split('\n');
      lines.forEach((line, j) => {
        if (line) {
          const span = document.createElement('span');
          span.textContent = line;
          const classes = [cls, state.fg && 'c-' + state.fg, state.bold && 'b', state.dim && 'd'].filter(Boolean) as string[];
          if (classes.length) span.className = classes.join(' ');
          (pendingLine ?? newLine()).appendChild(span);
        }
        if (j < lines.length - 1) {
          (pendingLine ?? newLine()).appendChild(document.createTextNode('\n'));
          pendingLine = null;
        }
      });
      chars += chunk.length;
    }
    while (chars > MAX_CHARS && out.firstChild) {
      chars -= out.firstChild.textContent?.length ?? 0;
      out.firstChild.remove();
    }
    if (stick) scrollDown();
  }

  function divider(text: string, kind: 'start' | 'ok' | 'err' | 'stop') {
    out.querySelector('.conEmpty')?.remove();
    if (pendingLine) {
      pendingLine.appendChild(document.createTextNode('\n'));
      pendingLine = null;
    }
    const d = document.createElement('div');
    d.className = `sep sep-${kind}`;
    d.textContent = text;
    out.appendChild(d);
    scrollDown();
  }

  function setStatus(kind: 'idle' | 'run' | 'ok' | 'err', label: string) {
    status.dataset.kind = kind;
    status.querySelector('span')!.textContent = label;
  }

  const fmt = (ms: number) => (ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);

  return {
    show() {
      if (folded) {
        folded = false;
        apply();
        persist();
      }
    },
    setTests(info) {
      testBtn.disabled = !info;
      testBtn.title = info ? `Run the tests: ${info.label}` : 'No package.json with a "test" script found next to this file';
    },
    started(label = '') {
      if (running) divider('restarted', 'stop');
      running = true;
      runLabel = label ? `Testing` : 'Running';
      state = { fg: '', bold: false, dim: false };
      startedAt = Date.now();
      panel.classList.add('running');
      panel.classList.toggle('testing', !!label);
      setStatus('run', runLabel);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      divider(label ? `${label}  ·  ${time}` : time, 'start');
      clearInterval(tick);
      timer.textContent = '0.0 s';
      tick = window.setInterval(() => (timer.textContent = fmt(Date.now() - startedAt)), 100);
      input.disabled = false;
      if (!label) input.focus();
      this.show();
    },
    output(text, stream) {
      write(text, stream === 'err' ? 'err' : undefined);
    },
    exited({ code, signal, ms }) {
      running = false;
      clearInterval(tick);
      timer.textContent = fmt(ms);
      panel.classList.remove('running');
      input.disabled = true;
      input.value = '';
      const what = runLabel === 'Testing' ? 'tests' : '';
      if (signal) {
        setStatus('idle', 'Stopped');
        divider(`stopped after ${fmt(ms)}`, 'stop');
      } else if (code === 0) {
        setStatus('ok', what ? 'Tests passed' : 'Finished');
        divider(what ? `tests passed in ${fmt(ms)}` : `finished in ${fmt(ms)}`, 'ok');
      } else {
        setStatus('err', what ? 'Tests failed' : 'Error');
        divider(what ? `tests failed (exit ${code}) after ${fmt(ms)}` : `ended with error ${code} after ${fmt(ms)}`, 'err');
      }
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
