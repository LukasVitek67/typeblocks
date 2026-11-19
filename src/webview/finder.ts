/**
 * Finding blocks:
 *  - a search box above the categories: type ".filter" (or "filtr", "pole", ...) and the
 *    matching blocks appear on the left; a suggestion list under the box inserts the block
 *    you pick right where it makes sense (under the selected block, into its empty slot, ...)
 *  - right-click a block -> "Show what fits here": the left side shows only blocks that fit
 *    into the empty slot you clicked next to; click one to put it in, or drag it
 */
import * as Blockly from 'blockly';
import { tr, trf } from '../i18n';
import { COLORS } from './blocks';
import { codeSnippet } from './generator';

type Def = Record<string, unknown> & { kind?: string; type?: string };

interface Entry {
  def: Def;
  label: string;
  code: string;
  category: string;
  color: string;
  hay: string;
  output: boolean;
  outputCheck: string[] | null;
  previous: boolean;
}

export interface FinderOptions {
  toolbox: () => Blockly.utils.toolbox.ToolboxDefinition;
  /** contents of the categories that are built on the fly (variables, arrays, functions) */
  custom: (name: string) => Def[];
}

const STYLE_COLOR: Record<string, string> = Object.fromEntries(Object.entries(COLORS));

export function initFinder(ws: Blockly.WorkspaceSvg, opts: FinderOptions): { focus(): void } {
  const toolbox = ws.getToolbox() as Blockly.Toolbox;
  const flyout = () => toolbox.getFlyout() as Blockly.IFlyout | null;

  // ------------------------------------------------------------ catalog of all blocks

  let catalog: Entry[] = [];

  function stateOf(def: Def): Blockly.serialization.blocks.State {
    const { kind: _k, 'web-class': _w, ...rest } = def as Record<string, unknown>;
    return rest as unknown as Blockly.serialization.blocks.State;
  }

  function buildCatalog(): Entry[] {
    const tmp = new Blockly.Workspace();
    for (const v of ws.getVariableMap().getAllVariables()) tmp.getVariableMap().createVariable(v.getName(), v.getType(), v.getId());
    const out: Entry[] = [];
    const seen = new Set<string>();
    const add = (defs: Def[], category: string, color: string) => {
      for (const def of defs) {
        if (def.kind !== 'block' || !def.type) continue;
        try {
          Blockly.Events.disable();
          const b = Blockly.serialization.blocks.append(stateOf(def), tmp, { recordUndo: false });
          const label = b.toString(60);
          let code = '';
          try {
            code = codeSnippet(b);
          } catch {
            /* not every block can be generated alone */
          }
          const key = label + '|' + code;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({
              def,
              label,
              code,
              category,
              color,
              hay: `${label} ${code} ${def.type} ${category}`.toLowerCase(),
              output: !!b.outputConnection,
              outputCheck: b.outputConnection?.getCheck() ?? null,
              previous: !!b.previousConnection,
            });
          }
          b.dispose(false);
        } catch {
          /* skip blocks that cannot be made here */
        } finally {
          Blockly.Events.enable();
        }
      }
    };
    const tb = opts.toolbox() as unknown as { contents: Record<string, unknown>[] };
    for (const cat of tb.contents) {
      if (cat.kind !== 'category') continue;
      const name = String(cat.name ?? '');
      const color = STYLE_COLOR[String(cat.categorystyle ?? '')] ?? '#888';
      const defs = cat.custom ? opts.custom(String(cat.custom)) : ((cat.contents as Def[]) ?? []);
      add(defs, name, color);
    }
    tmp.dispose();
    return out;
  }

  const refreshCatalog = () => (catalog = buildCatalog());

  // ------------------------------------------------------------ search

  function search(query: string): Entry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.replace(/^\./, '').split(/\s+/).filter(Boolean);
    const scored: [number, Entry][] = [];
    for (const e of catalog) {
      let score = 0;
      if (q.startsWith('.') && e.code.toLowerCase().includes(q)) score += 100; // ".filter" -> .filter(...)
      for (const w of words) {
        if (!e.hay.includes(w)) {
          score = -1;
          break;
        }
        if (e.label.toLowerCase().startsWith(w)) score += 30;
        if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(e.hay)) score += 10;
        score += 5;
      }
      if (score > 0) scored.push([score - e.label.length / 100, e]);
    }
    return scored.sort((a, b) => b[0] - a[0]).map(([, e]) => e);
  }

  // ------------------------------------------------------------ "fits here"

  let fitTarget: Blockly.RenderedConnection | null = null;

  function setFitTarget(c: Blockly.RenderedConnection | null) {
    try {
      fitTarget?.unhighlight();
    } catch {
      /* block is gone */
    }
    fitTarget = c;
    try {
      c?.highlight();
    } catch {
      /* not rendered */
    }
  }

  const compatible = (a: string[] | null, b: string[] | null) => !a || !b || a.some((x) => b.includes(x));

  function fits(e: Entry, target: Blockly.Connection): boolean {
    if (target.type === Blockly.ConnectionType.INPUT_VALUE) return e.output && compatible(target.getCheck(), e.outputCheck);
    return e.previous; // statement slot or "below this block"
  }

  /** The empty slot nearest to where the user right-clicked. */
  function slotNear(block: Blockly.BlockSvg, ev: Event | undefined): Blockly.RenderedConnection | null {
    const conns: Blockly.RenderedConnection[] = [];
    for (const input of block.inputList) {
      const c = input.connection as Blockly.RenderedConnection | null;
      if (!c) continue;
      const t = c.targetBlock();
      if (!t || t.isShadow()) conns.push(c);
    }
    if (block.nextConnection && !block.nextConnection.targetBlock()) conns.push(block.nextConnection as Blockly.RenderedConnection);
    if (!conns.length) {
      // no empty slot: offer what could stand in this block's place
      const parent = block.outputConnection?.targetConnection ?? block.previousConnection?.targetConnection;
      return (parent as Blockly.RenderedConnection) ?? null;
    }
    const pe = ev as PointerEvent | undefined;
    if (!pe || typeof pe.clientX !== 'number') return conns[0];
    const p = Blockly.utils.svgMath.screenToWsCoordinates(ws, new Blockly.utils.Coordinate(pe.clientX, pe.clientY));
    let best = conns[0];
    let bestD = Infinity;
    for (const c of conns) {
      // holes (value slots) win over "below" / statement spots when both are close
      const d = Math.hypot(c.x - p.x, c.y - p.y) + (c.type === Blockly.ConnectionType.INPUT_VALUE ? 0 : 40);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function showInFlyout(entries: Entry[], header: string, hint?: string) {
    const items: Def[] = [{ kind: 'label', text: header, 'web-class': 'tbHint' }];
    if (hint) items.push({ kind: 'label', text: hint, 'web-class': 'tbHint' });
    for (const e of entries.slice(0, 40)) items.push(e.def);
    toolbox.clearSelection();
    flyout()?.show(items as unknown as Blockly.utils.toolbox.FlyoutDefinition);
  }

  function showFits(block: Blockly.BlockSvg, ev: Event | undefined) {
    refreshCatalog();
    const target = slotNear(block, ev);
    if (!target) {
      showInFlyout([], tr('This block has no empty slot.'), tr('Right-click a block with a free hole or a free spot below it.'));
      return;
    }
    setFitTarget(target);
    const list = catalog.filter((e) => fits(e, target));
    const where = block.toString(28);
    if (!list.length) showInFlyout([], trf('Nothing fits here.'));
    else showInFlyout(list, trf('Fits into: {0}', where), tr('Click a block to put it in, or drag it.'));
  }

  Blockly.ContextMenuRegistry.registry.register({
    id: 'tb_fits_here',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: -20,
    displayText: () => tr('Show what fits here'),
    preconditionFn: (scope) => (scope.block && !scope.block.isInFlyout ? 'enabled' : 'hidden'),
    callback: (scope, menuOpenEvent) => showFits(scope.block as Blockly.BlockSvg, menuOpenEvent),
  });
  Blockly.ContextMenuRegistry.registry.register({
    id: 'tb_search_blocks',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    weight: -20,
    displayText: () => tr('Search blocks...'),
    preconditionFn: () => 'enabled',
    callback: () => setTimeout(() => api.focus(), 50),
  });

  // One click on a block on the left = put it in (into the "fits here" slot, under the selected
  // block, into its empty hole, or in the middle of the view). Dragging works as usual.
  let inserting = false;
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.type === Blockly.Events.TOOLBOX_ITEM_SELECT) setFitTarget(null);
    if (e.type === Blockly.Events.BLOCK_DRAG && !(e as Blockly.Events.BlockDrag).isStart && fitTarget) setTimeout(() => setFitTarget(null), 0);
  });
  let down: { x: number; y: number; id: string } | null = null;
  const flyoutSvg = () => (flyout() as unknown as { svgGroup_?: SVGElement } | null)?.svgGroup_ ?? null;
  document.addEventListener(
    'pointerdown',
    (ev) => {
      const fs = flyoutSvg();
      const g = (ev.target as Element | null)?.closest?.('g[data-id]');
      down = fs && g && fs.contains(g) && ev.button === 0 ? { x: ev.clientX, y: ev.clientY, id: g.getAttribute('data-id')! } : null;
    },
    true,
  );
  document.addEventListener(
    'pointerup',
    (ev) => {
      const d = down;
      down = null;
      if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) return;
      const fws = flyout()?.getWorkspace();
      const b = fws?.getBlockById(d.id)?.getRootBlock();
      if (!b) return;
      const state = Blockly.serialization.blocks.save(b, { addCoordinates: false });
      if (!state) return;
      setTimeout(() => {
        insertState(state);
        flyout()?.hide();
        toolbox.clearSelection();
      }, 0);
    },
    true,
  );

  // ------------------------------------------------------------ inserting a block

  function connect(target: Blockly.Connection, b: Blockly.BlockSvg): boolean {
    const own = target.type === Blockly.ConnectionType.INPUT_VALUE ? b.outputConnection : b.previousConnection;
    if (!own) return false;
    try {
      target.connect(own);
      b.select();
      return true;
    } catch {
      return false;
    }
  }

  /** Where a new block would make sense: under the selected block, or into its empty slot. */
  function smartTarget(b: Blockly.BlockSvg): Blockly.Connection | null {
    const sel = Blockly.getSelected() as Blockly.BlockSvg | null;
    if (!sel || sel.workspace !== ws || !(sel instanceof Blockly.BlockSvg)) return null;
    if (b.previousConnection && sel.nextConnection) return sel.nextConnection;
    if (b.outputConnection) {
      for (const input of sel.inputList) {
        const c = input.connection;
        if (!c || c.type !== Blockly.ConnectionType.INPUT_VALUE) continue;
        const t = c.targetBlock();
        if ((!t || t.isShadow()) && compatible(c.getCheck(), b.outputConnection.getCheck())) return c;
      }
    }
    return null;
  }

  function insert(e: Entry) {
    insertState(stateOf(e.def));
  }

  function insertState(state: Blockly.serialization.blocks.State) {
    inserting = true;
    Blockly.Events.setGroup(true);
    try {
      const b = Blockly.serialization.blocks.append(state, ws) as Blockly.BlockSvg;
      const target = fitTarget ?? smartTarget(b);
      if (!target || !connect(target, b)) {
        const view = ws.getMetricsManager().getViewMetrics(true);
        const size = b.getHeightWidth();
        b.moveBy(view.left + view.width / 2 - size.width / 2, view.top + view.height / 3);
        b.select();
      }
      setFitTarget(null);
      // move the view only when the new block is off-screen (no jumping around)
      const sb = (ws as unknown as { scrollBoundsIntoView?: (r: Blockly.utils.Rect) => void }).scrollBoundsIntoView;
      if (sb) sb.call(ws, b.getBoundingRectangle());
      else ws.centerOnBlock(b.id);
    } finally {
      Blockly.Events.setGroup(false);
      inserting = false;
    }
  }

  // ------------------------------------------------------------ search box + suggestions

  const box = document.createElement('div');
  box.className = 'tbFind';
  box.innerHTML = `<input type="search" spellcheck="false" autocomplete="off"><ul class="tbSuggest" role="listbox" hidden></ul>`;
  const input = box.querySelector('input')!;
  const list = box.querySelector('ul')!;
  input.placeholder = tr('Search... (.filter)');
  input.setAttribute('aria-label', tr('Search blocks...'));
  const host = (toolbox as unknown as { HtmlDiv: HTMLElement | null }).HtmlDiv;
  host?.insertBefore(box, host.firstChild);
  // the toolbox has its own keyboard / click handling - keep our typing and clicks to ourselves
  for (const t of ['keydown', 'keyup', 'pointerdown', 'mousedown', 'click', 'wheel']) box.addEventListener(t, (ev) => ev.stopPropagation());

  let results: Entry[] = [];
  let active = 0;

  function renderSuggestions() {
    list.innerHTML = '';
    const top = results.slice(0, 8);
    list.hidden = !input.value.trim();
    if (!top.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = trf('Nothing found for "{0}"', input.value.trim());
      list.appendChild(li);
    }
    top.forEach((e, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = i === active ? 'on' : '';
      li.innerHTML = '<i></i><span class="l"></span><code></code>';
      (li.querySelector('i') as HTMLElement).style.background = e.color;
      li.querySelector('.l')!.textContent = e.label;
      li.querySelector('code')!.textContent = e.code.length > 38 ? e.code.slice(0, 37) + '...' : e.code;
      li.onmousedown = (ev) => {
        ev.preventDefault();
        pick(i);
      };
      li.onmousemove = () => {
        if (active !== i) {
          active = i;
          renderSuggestions();
        }
      };
      list.appendChild(li);
    });
    // place the list next to the box (wider than the toolbox)
    const r = input.getBoundingClientRect();
    list.style.left = `${r.left}px`;
    list.style.top = `${r.bottom + 4}px`;
  }

  function update() {
    const q = input.value;
    if (!q.trim()) {
      results = [];
      list.hidden = true;
      flyout()?.hide();
      return;
    }
    if (!catalog.length) refreshCatalog();
    results = search(q);
    active = 0;
    renderSuggestions();
    if (results.length) showInFlyout(results, trf('{0} blocks for "{1}"', results.length, q.trim()), tr('Enter puts the first one in. Or drag one.'));
    else flyout()?.hide();
  }

  function pick(i: number) {
    const e = results[i];
    if (!e) return;
    insert(e);
    input.value = '';
    update();
    input.blur();
  }

  input.addEventListener('focus', () => {
    refreshCatalog();
    setFitTarget(null);
    if (input.value.trim()) update();
  });
  input.addEventListener('input', update);
  input.addEventListener('blur', () => setTimeout(() => (list.hidden = true), 150));
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      active = Math.min(active + 1, Math.min(results.length, 8) - 1);
      renderSuggestions();
      ev.preventDefault();
    } else if (ev.key === 'ArrowUp') {
      active = Math.max(active - 1, 0);
      renderSuggestions();
      ev.preventDefault();
    } else if (ev.key === 'Enter') {
      pick(active);
      ev.preventDefault();
    } else if (ev.key === 'Escape') {
      input.value = '';
      update();
      input.blur();
    }
  });

  const api = {
    focus() {
      input.focus();
      input.select();
    },
  };
  return api;
}
