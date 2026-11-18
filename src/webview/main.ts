import * as Blockly from 'blockly';
import { buildToolbox, defineBlocks, hooks, ITEM_TYPES, makeTheme, VAR_TYPES } from './blocks';
import { generate, meta, setMeta } from './generator';
import { initConsole } from './console';

interface VsApi {
  postMessage(msg: unknown): void;
}
declare function acquireVsCodeApi(): VsApi;
const vscode: VsApi =
  typeof acquireVsCodeApi === 'function'
    ? acquireVsCodeApi()
    : {
        postMessage: (m) => {
          (window as unknown as { __last: unknown }).__last = m;
          console.log('[to extension]', (m as { type: string }).type);
        },
      };

let nodeTypes = true;
let codeStyle: { indent: string; quote: 'single' | 'double' } | undefined;
let loading = false;
let selectingFromEditor = false;
let spanIds = new Set<string>();
/** Type picked in the "make a variable" dialog, until a let block carries it. */
const pendingTypes = new Map<string, string>();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- theme

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

function isDark(): boolean {
  const c = document.body.classList;
  if (c.contains('vscode-light') || c.contains('vscode-high-contrast-light')) return false;
  if (c.contains('vscode-dark') || c.contains('vscode-high-contrast')) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function currentTheme(): Blockly.Theme {
  const dark = isDark();
  return makeTheme({
    dark,
    bg: cssVar('--vscode-editor-background', dark ? '#1b1d23' : '#f7f7fa'),
    panel: cssVar('--vscode-sideBar-background', dark ? '#22252c' : '#eceef3'),
    fg: cssVar('--vscode-foreground', dark ? '#d7dae0' : '#30333a'),
    font: cssVar('--vscode-font-family', '"Segoe UI", system-ui, sans-serif'),
  });
}

// ---------------------------------------------------------------- dialogs

type DialogResult = { action: 'ok' | 'danger'; name: string; type: string; code: string } | null;

function openDialog(opts: {
  title: string;
  message?: string;
  input?: string;
  types?: readonly string[];
  type?: string;
  code?: string;
  okText?: string;
  cancel?: boolean;
  danger?: string;
}): Promise<DialogResult> {
  const modal = $('modal');
  const input = $<HTMLInputElement>('mInput');
  const area = $<HTMLTextAreaElement>('mCode');
  const typeRow = $('mTypes');
  const ok = $<HTMLButtonElement>('mOk');
  const cancel = $<HTMLButtonElement>('mCancel');
  const danger = $<HTMLButtonElement>('mDanger');

  $('mTitle').textContent = opts.title;
  $('mMsg').textContent = opts.message ?? '';
  $('mMsg').hidden = !opts.message;
  input.hidden = opts.input === undefined;
  input.value = opts.input ?? '';
  area.hidden = opts.code === undefined;
  area.value = opts.code ?? '';
  modal.classList.toggle('wide', opts.code !== undefined);
  typeRow.hidden = !opts.types;
  let chosen = opts.type ?? opts.types?.[0] ?? '';
  typeRow.innerHTML = '';
  for (const t of opts.types ?? []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (t === chosen ? ' on' : '');
    b.textContent = t;
    b.onclick = () => {
      chosen = t;
      typeRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
      if (!input.hidden) input.focus(); // so Enter still means "OK"
    };
    typeRow.appendChild(b);
  }
  ok.textContent = opts.okText ?? 'OK';
  cancel.hidden = opts.cancel === false;
  danger.hidden = !opts.danger;
  danger.textContent = opts.danger ?? '';
  modal.hidden = false;
  // Blockly moves focus back to the workspace right after a flyout button click, so wait a beat.
  setTimeout(() => (opts.code !== undefined ? area.focus() : opts.input !== undefined ? input.select() : ok.focus()), 80);

  return new Promise((resolve) => {
    const done = (r: DialogResult) => {
      modal.hidden = true;
      ok.onclick = cancel.onclick = danger.onclick = null;
      modal.onkeydown = null;
      resolve(r);
    };
    const result = (action: 'ok' | 'danger') => ({ action, name: input.value.trim(), type: chosen, code: area.value });
    ok.onclick = () => done(result('ok'));
    danger.onclick = () => done(result('danger'));
    cancel.onclick = () => done(null);
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') done(null);
      const t = e.target as HTMLElement;
      if (e.key === 'Enter' && t !== cancel && t !== danger && t !== ok && t !== area) {
        e.preventDefault();
        ok.click();
      }
      if (e.key === 'Enter' && t === area && (e.ctrlKey || e.metaKey)) ok.click();
      if (e.key === 'Tab' && t === area) {
        e.preventDefault();
        area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
      }
    };
  });
}

Blockly.dialog.setPrompt((message, def, cb) => {
  openDialog({ title: message, input: def }).then((r) => cb(r ? r.name : null));
});
Blockly.dialog.setConfirm((message, cb) => {
  openDialog({ title: message }).then((r) => cb(!!r));
});
Blockly.dialog.setAlert((message, cb) => {
  openDialog({ title: message, cancel: false }).then(() => cb?.());
});

hooks.editCode = (block) => {
  if (block.isInFlyout) return;
  const b = block as Blockly.Block & { code: string; updateShape(): void };
  void openDialog({ title: 'Edit TypeScript', code: b.code, okText: 'Save', message: 'Ctrl+Enter saves.' }).then((r) => {
    if (!r) return;
    const before = JSON.stringify({ code: b.code });
    b.code = r.code.replace(/\s+$/, '');
    b.updateShape();
    (b as unknown as Blockly.BlockSvg).render?.();
    Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(b, 'mutation', null, before, JSON.stringify({ code: b.code })));
  });
};

// ---------------------------------------------------------------- variables & arrays

const IDENT = /^[A-Za-z_$][\w$]*$/;

function letBlockOf(ws: Blockly.Workspace, id: string): Blockly.Block | undefined {
  return ws.getBlocksByType('ts_let', false).find((b) => b.getFieldValue('VAR') === id);
}

function typeOf(ws: Blockly.Workspace, id: string): string {
  const b = letBlockOf(ws, id);
  const t = b ? String(b.getFieldValue('TYPE') ?? '') : '';
  return t || pendingTypes.get(id) || '';
}

function isArrayVar(ws: Blockly.Workspace, id: string): boolean {
  if (/\[\]$|^Array</.test(typeOf(ws, id))) return true;
  const b = letBlockOf(ws, id);
  const v = b?.getInputTargetBlock('VALUE');
  if (v && (v.type === 'ts_list_literal' || v.type === 'ts_list_split')) return true;
  return ws.getAllBlocks(false).some((x) => x.type.startsWith('ts_list_') && x.getField('LIST') && x.getFieldValue('LIST') === id);
}

async function makeVariable(ws: Blockly.WorkspaceSvg, array: boolean) {
  const r = await openDialog({
    title: array ? 'New array' : 'New variable',
    message: array ? 'What will the array hold? (an array of strings is written string[])' : 'What kind of value will it hold?',
    input: '',
    types: array ? ITEM_TYPES : VAR_TYPES,
    okText: 'Create',
  });
  if (!r || !r.name) return;
  const name = r.name.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase());
  if (!IDENT.test(name)) {
    await openDialog({ title: `"${r.name}" can't be a name`, message: 'Use letters, digits and _ (no spaces, not starting with a digit).', cancel: false });
    return;
  }
  if (Blockly.Variables.nameUsedWithAnyType(name, ws)) {
    await openDialog({ title: `"${name}" already exists.`, cancel: false });
    return;
  }
  const v = ws.getVariableMap().createVariable(name);
  pendingTypes.set(v.getId(), array ? `${r.type}[]` : r.type);
  ws.refreshToolboxSelection();
}

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const defaultFor = (t: string) =>
  t === 'string' ? txt('') : t === 'boolean' ? { block: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } } : t === 'number' ? num(0) : undefined;

function sortedVars(ws: Blockly.Workspace) {
  return ws
    .getVariableMap()
    .getAllVariables()
    .slice()
    .sort((a, b) => a.getName().localeCompare(b.getName()));
}

function variablesFlyout(ws: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const items: object[] = [{ kind: 'button', text: '+ Make a variable', callbackKey: 'TS_NEW_VAR' }];
  const vars = sortedVars(ws).filter((v) => !isArrayVar(ws, v.getId()));
  if (vars.length) {
    items.push({ kind: 'label', text: 'Create it (once):', 'web-class': 'tbHint' });
    for (const v of vars) {
      const t = typeOf(ws, v.getId());
      items.push({ kind: 'block', type: 'ts_let', fields: { KIND: 'let', VAR: { id: v.getId() }, TYPE: t }, inputs: clean({ VALUE: defaultFor(t) }) });
    }
    items.push({ kind: 'label', text: 'Use it:', 'web-class': 'tbHint' });
    for (const v of vars) items.push({ kind: 'block', type: 'variables_get', fields: { VAR: { id: v.getId() } } });
    const first = vars[0];
    items.push({ kind: 'sep', gap: 16 });
    items.push({ kind: 'block', type: 'variables_set', fields: { VAR: { id: first.getId() } }, inputs: clean({ VALUE: defaultFor(typeOf(ws, first.getId())) ?? num(0) }) });
    items.push({ kind: 'block', type: 'math_change', fields: { VAR: { id: first.getId() } }, inputs: { DELTA: num(1) } });
  }
  return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function listsFlyout(ws: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const items: object[] = [{ kind: 'button', text: '+ Make an array', callbackKey: 'TS_NEW_LIST' }];
  const lists = sortedVars(ws).filter((v) => isArrayVar(ws, v.getId()));
  items.push({ kind: 'label', text: 'An array is a numbered row of values. The first one is number 0.', 'web-class': 'tbHint' });
  if (!lists.length) {
    items.push({ kind: 'block', type: 'ts_list_literal', extraState: { itemCount: 3 }, inputs: { ITEM0: txt('apple'), ITEM1: txt('banana'), ITEM2: txt('cherry') } });
    return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
  }
  const L = { LIST: { id: lists[0].getId() } };
  items.push({ kind: 'label', text: 'Create it (once):', 'web-class': 'tbHint' });
  for (const v of lists) {
    const t = typeOf(ws, v.getId()) || 'string[]';
    const isNum = t.startsWith('number');
    items.push({
      kind: 'block',
      type: 'ts_let',
      fields: { KIND: 'let', VAR: { id: v.getId() }, TYPE: t },
      inputs: {
        VALUE: {
          block: {
            type: 'ts_list_literal',
            extraState: { itemCount: 2 },
            inputs: isNum ? { ITEM0: num(1), ITEM1: num(2) } : { ITEM0: txt('apple'), ITEM1: txt('banana') },
          },
        },
      },
    });
  }
  items.push({ kind: 'label', text: 'Change it:', 'web-class': 'tbHint' });
  items.push(
    { kind: 'block', type: 'ts_list_add', fields: L, inputs: { ITEM: txt('kiwi') } },
    { kind: 'block', type: 'ts_list_add_front', fields: L, inputs: { ITEM: txt('kiwi') } },
    { kind: 'block', type: 'ts_list_insert', fields: L, inputs: { ITEM: txt('kiwi'), INDEX: num(1) } },
    { kind: 'block', type: 'ts_list_replace', fields: L, inputs: { INDEX: num(0), ITEM: txt('kiwi') } },
    { kind: 'block', type: 'ts_list_remove', fields: L, inputs: { INDEX: num(0) } },
    { kind: 'block', type: 'ts_list_pop', fields: { ...L, END: 'pop' } },
    { kind: 'block', type: 'ts_list_sort', fields: { ...L, HOW: 'sort' } },
  );
  items.push({ kind: 'label', text: 'Look inside it:', 'web-class': 'tbHint' });
  items.push(
    { kind: 'block', type: 'ts_foreach', inputs: { LIST: { block: { type: 'variables_get', fields: { VAR: { id: lists[0].getId() } } } } } },
    { kind: 'block', type: 'ts_list_item', fields: L, inputs: { INDEX: num(0) } },
    { kind: 'block', type: 'ts_list_last', fields: L },
    { kind: 'block', type: 'ts_list_length', fields: L },
    { kind: 'block', type: 'ts_list_contains', fields: L, inputs: { ITEM: txt('apple') } },
    { kind: 'block', type: 'ts_list_indexof', fields: L, inputs: { ITEM: txt('apple') } },
    { kind: 'block', type: 'ts_list_join', fields: L, inputs: { SEP: txt(', ') } },
  );
  const theList = () => ({ block: { type: 'variables_get', fields: { VAR: { id: lists[0].getId() } } } });
  const item = (prop?: string) =>
    prop ? { block: { type: 'ts_prop', fields: { PROP: prop }, inputs: { OBJ: { block: { type: 'variables_get', fields: { VAR: { name: 'item' } } } } } } } : { block: { type: 'variables_get', fields: { VAR: { name: 'item' } } } };
  items.push({ kind: 'label', text: 'Do something with every item (item = the one it is looking at now):', 'web-class': 'tbHint' });
  items.push(
    { kind: 'block', type: 'ts_arr_foreach', inputs: { LIST: theList() } },
    { kind: 'block', type: 'ts_arr_map', inputs: { LIST: theList(), VALUE: { block: { type: 'ts_case', inputs: { TEXT: item() } } } } },
    { kind: 'block', type: 'ts_arr_filter', inputs: { LIST: theList(), COND: { block: { type: 'ts_compare', fields: { OP: '!==' }, inputs: { A: item(), B: txt('banana') } } } } },
    { kind: 'block', type: 'ts_arr_some', inputs: { LIST: theList(), COND: { block: { type: 'ts_compare', fields: { OP: '===' }, inputs: { A: item(), B: txt('apple') } } } } },
    { kind: 'block', type: 'ts_arr_every', inputs: { LIST: theList(), COND: { block: { type: 'ts_compare', fields: { OP: '>' }, inputs: { A: { block: { type: 'ts_length', inputs: { VALUE: item() } } }, B: num(2) } } } } },
    { kind: 'block', type: 'ts_arr_find', inputs: { LIST: theList(), COND: { block: { type: 'ts_compare', fields: { OP: '>' }, inputs: { A: { block: { type: 'ts_length', inputs: { VALUE: item() } } }, B: num(5) } } } } },
    { kind: 'block', type: 'ts_arr_findindex', inputs: { LIST: theList(), COND: { block: { type: 'ts_compare', fields: { OP: '===' }, inputs: { A: item(), B: txt('kiwi') } } } } },
    {
      kind: 'block',
      type: 'ts_arr_reduce',
      inputs: {
        LIST: theList(),
        INIT: num(0),
        VALUE: { block: { type: 'ts_arith', fields: { OP: '+' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { name: 'total' } } } }, B: { block: { type: 'ts_length', inputs: { VALUE: item() } } } } } },
      },
    },
  );

  items.push({ kind: 'label', text: 'The whole array:', 'web-class': 'tbHint' });
  for (const v of lists) items.push({ kind: 'block', type: 'variables_get', fields: { VAR: { id: v.getId() } } });
  items.push({ kind: 'block', type: 'ts_list_literal', extraState: { itemCount: 2 }, inputs: { ITEM0: txt('a'), ITEM1: txt('b') } });
  return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function functionsFlyout(ws: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const items = Blockly.Procedures.flyoutCategory(ws).filter((i) => (i as { type?: string }).type !== 'procedures_ifreturn');
  const at = items.findIndex((i) => (i as { type?: string }).type === 'procedures_defreturn');
  items.splice(at + 1, 0, { kind: 'block', type: 'ts_return' } as never);
  items.unshift({ kind: 'label', text: 'Right-click a function block to set its types.', 'web-class': 'tbHint' } as never);
  return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// "Set types..." on function blocks
Blockly.ContextMenuRegistry.registry.register({
  id: 'tb_function_types',
  scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
  weight: -10,
  displayText: 'Set parameter & return types...',
  preconditionFn: (scope) => (scope.block && scope.block.type.startsWith('procedures_def') && !scope.block.isInFlyout ? 'enabled' : 'hidden'),
  callback: async (scope) => {
    const block = scope.block!;
    const m = meta(block);
    const params = block.getVarModels();
    const types = params.map((_, i) => (m.types && i < m.types.length ? m.types[i] : 'any'));
    for (let i = 0; i < params.length; i++) {
      const r = await openDialog({ title: `Type of parameter "${params[i].getName()}"`, input: types[i], message: 'e.g. number, string, boolean, string[]' });
      if (!r) return;
      types[i] = r.name;
    }
    const r = await openDialog({ title: `What does ${block.getFieldValue('NAME')} give back?`, input: m.ret ?? '', message: 'Leave empty to let TypeScript work it out.' });
    if (!r) return;
    const before = block.data;
    setMeta(block, { types, ret: r.name });
    Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(block, 'data', null, before, block.data));
  },
});

// ---------------------------------------------------------------- workspace

defineBlocks();

// Undo/redo goes through VS Code (the .ts text document), so Blockly must not also handle Ctrl+Z.
for (const n of [Blockly.ShortcutItems.names.UNDO, Blockly.ShortcutItems.names.REDO]) {
  try {
    Blockly.ShortcutRegistry.registry.unregister(n);
  } catch {
    /* not registered */
  }
}

const ws = Blockly.inject($('blockly'), {
  renderer: 'zelos',
  theme: currentTheme(),
  toolbox: buildToolbox(),
  media: (window as unknown as { BLOCKLY_MEDIA?: string }).BLOCKLY_MEDIA ?? 'media/blockly/',
  sounds: false,
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.3, scaleSpeed: 1.15 },
  grid: { spacing: 32, length: 2, colour: isDark() ? '#ffffff14' : '#00000012', snap: false },
  move: { scrollbars: true, drag: true, wheel: false },
});

// Turn Blockly's colored category borders into round dots.
for (const el of document.querySelectorAll<HTMLElement>('.blocklyToolboxCategory')) {
  const c = el.style.borderLeftColor;
  if (c) el.style.setProperty('--cat', c);
}

ws.registerToolboxCategoryCallback('TS_VARIABLES', variablesFlyout);
ws.registerToolboxCategoryCallback('TS_LISTS', listsFlyout);
ws.registerToolboxCategoryCallback('TS_FUNCTIONS', functionsFlyout);
ws.registerButtonCallback('TS_NEW_VAR', () => void makeVariable(ws, false));
ws.registerButtonCallback('TS_NEW_LIST', () => void makeVariable(ws, true));

new MutationObserver(() => ws.setTheme(currentTheme())).observe(document.body, { attributes: true, attributeFilter: ['class'] });
new ResizeObserver(() => Blockly.svgResize(ws)).observe($('blockly'));

function emit(kind: 'change' | 'code') {
  const out = generate(ws, nodeTypes, codeStyle);
  spanIds = new Set(out.spans.map((s) => s.id));
  renderArrays();
  vscode.postMessage({ type: kind, ts: out.ts, spans: out.spans });
}

let timer: number | undefined;
function scheduleChange() {
  clearTimeout(timer);
  timer = window.setTimeout(() => emit('change'), 180);
}

ws.addChangeListener((e: Blockly.Events.Abstract) => {
  if (loading) return;
  if (e.type === Blockly.Events.SELECTED) {
    if (selectingFromEditor) return;
    const id = (e as Blockly.Events.Selected).newElementId;
    vscode.postMessage({ type: 'select', id: id ? mappedAncestor(id) : null });
    return;
  }
  if (e.isUiEvent) return;
  // creating/renaming a variable alone does not change the code
  if (e.type === Blockly.Events.VAR_CREATE || e.type === Blockly.Events.VAR_RENAME) {
    ws.refreshToolboxSelection();
    if (e.type === Blockly.Events.VAR_CREATE) return;
  }
  scheduleChange();
});

/** The nearest block (itself or a parent) that owns lines in the generated code. */
function mappedAncestor(id: string): string | null {
  let b: Blockly.Block | null = ws.getBlockById(id);
  while (b && !spanIds.has(b.id)) b = b.getParent();
  return b ? b.id : null;
}

let loadedOnce = false;
function load(workspace: object, fresh: boolean) {
  const { scrollX, scrollY } = ws;
  const scale = ws.scale;
  loading = true;
  Blockly.Events.disable();
  try {
    ws.clear();
    Blockly.serialization.workspaces.load(workspace, ws);
    ws.cleanUp();
  } catch (err) {
    showBanner(`Could not show these blocks: ${(err as Error).message}`);
  } finally {
    Blockly.Events.enable();
    loading = false;
  }
  if (loadedOnce) {
    ws.setScale(scale);
    ws.scroll(scrollX, scrollY);
  } else {
    ws.scrollCenter();
    const top = ws.getTopBlocks(true)[0];
    if (top) ws.scroll(40 - top.getRelativeToSurfaceXY().x * ws.scale, 40 - top.getRelativeToSurfaceXY().y * ws.scale);
  }
  loadedOnce = true;
  emit(fresh ? 'change' : 'code');
  ws.refreshToolboxSelection();
}

function showBanner(msg: string) {
  const b = $('banner');
  b.textContent = msg;
  b.hidden = !msg;
}

// ---------------------------------------------------------------- array preview

/** Live picture of every array that is created from a list of values. */
function renderArrays() {
  const panel = $('arrays');
  const body = $('arraysBody');
  const lets = ws.getBlocksByType('ts_let', false).filter((b) => b.getInputTargetBlock('VALUE')?.type === 'ts_list_literal');
  panel.hidden = !lets.length;

  body.innerHTML = '';
  for (const b of lets) {
    const name = ws.getVariableMap().getVariableById(b.getFieldValue('VAR'))?.getName() ?? '?';
    const lit = b.getInputTargetBlock('VALUE')!;
    const n = (lit as unknown as { itemCount: number }).itemCount ?? 0;
    const row = document.createElement('div');
    row.className = 'arr';
    const head = document.createElement('div');
    head.className = 'arrHead';
    head.innerHTML = `<b></b><span></span>`;
    head.querySelector('b')!.textContent = name;
    head.querySelector("span")!.textContent = `starts with ${n} item${n === 1 ? "" : "s"}`;
    row.appendChild(head);
    const cells = document.createElement('div');
    cells.className = 'cells';
    for (let i = 0; i < n; i++) {
      const item = lit.getInputTargetBlock('ITEM' + i);
      const cell = document.createElement('div');
      cell.className = 'cell';
      const idx = document.createElement('i');
      idx.textContent = String(i);
      const v = document.createElement('span');
      let shown = '?';
      if (item?.type === 'text') shown = `"${item.getFieldValue('TEXT')}"`;
      else if (item?.type === 'math_number') shown = String(item.getFieldValue('NUM'));
      else if (item?.type === 'logic_boolean') shown = item.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false';
      else if (item?.type === 'variables_get') shown = ws.getVariableMap().getVariableById(item.getFieldValue('VAR'))?.getName() ?? '?';
      else if (!item) shown = 'empty';
      v.textContent = shown;
      if (item?.type === 'text') v.className = 'str';
      cell.append(idx, v);
      cell.title = `${name}[${i}]`;
      cell.onclick = () => item && ws.centerOnBlock(item.id);
      cells.appendChild(cell);
    }
    if (!n) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'empty array []';
      cells.appendChild(e);
    }
    row.appendChild(cells);
    body.appendChild(row);
  }
}

$('arraysToggle').onclick = () => {
  arraysToggledByUser = true;
  $('arrays').classList.toggle('collapsed');
};
// In a narrow editor the panel would cover the blocks, so it folds itself - until the user opens/closes it by hand.
let arraysToggledByUser = false;
new ResizeObserver(() => {
  if (!arraysToggledByUser) $('arrays').classList.toggle('collapsed', document.body.clientWidth < 820);
}).observe(document.body);

// ---------------------------------------------------------------- toolbar + messages

const con = initConsole((m) => vscode.postMessage(m));

$('run').onclick = () => vscode.postMessage({ type: 'run' });
$('stop').onclick = () => vscode.postMessage({ type: 'stop' });
$('showCode').onclick = () => vscode.postMessage({ type: 'openCode' });
$('showGuide').onclick = () => vscode.postMessage({ type: 'guide' });
$('cleanUp').onclick = () => ws.cleanUp();

window.addEventListener('message', (ev: MessageEvent) => {
  const m = ev.data as {
    type: string;
    workspace?: object;
    style?: { indent: string; quote: 'single' | 'double' };
    fresh?: boolean;
    fileName?: string;
    nodeTypes?: boolean;
    rawCount?: number;
    id?: string | null;
    running?: boolean;
    error?: string;
    text?: string;
    stream?: 'out' | 'err';
    code?: number | null;
    signal?: string | null;
    ms?: number;
    label?: string;
    tests?: { label: string } | null;
  };
  switch (m.type) {
    case 'load':
      if (m.nodeTypes !== undefined) nodeTypes = m.nodeTypes;
      if (m.style) codeStyle = m.style;
      if (m.tests !== undefined) con.setTests(m.tests);
      if (m.fileName) $('fileName').textContent = m.fileName;
      showBanner(m.error ?? '');
      if (m.workspace) load(m.workspace, !!m.fresh);
      break;
    case 'select': {
      const block = m.id ? ws.getBlockById(m.id) : null;
      selectingFromEditor = true;
      try {
        if (block) {
          (block as Blockly.BlockSvg).select();
          ws.centerOnBlock(block.id);
        }
      } finally {
        selectingFromEditor = false;
      }
      break;
    }
    case 'runStarted':
      con.started(m.label);
      break;
    case 'out':
      con.output(m.text ?? '', m.stream ?? 'out');
      break;
    case 'exited':
      con.exited({ code: m.code ?? null, signal: m.signal ?? null, ms: m.ms ?? 0 });
      break;
    case 'running':
      document.body.classList.toggle('running', !!m.running);
      $<HTMLButtonElement>('stop').disabled = !m.running;
      $('run').querySelector('span')!.textContent = m.running ? 'Restart' : 'Run';
      break;
  }
});

vscode.postMessage({ type: 'ready' });

// Standalone preview (no VS Code): tools/build.mjs puts a converted sample into window.PREVIEW_WORKSPACE.
const preview = (window as unknown as { PREVIEW_WORKSPACE?: object }).PREVIEW_WORKSPACE;
if (typeof acquireVsCodeApi !== 'function') {
  (window as unknown as { __tb: unknown }).__tb = { ws, Blockly, con }; // for debugging the browser preview
  if (preview) load(preview, false);
}
