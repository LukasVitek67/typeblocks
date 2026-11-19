/**
 * The "Recipes" category: a panel of ready-made little programs. Every card says what the
 * recipe does (in plain words), shows its blocks and - one click away - its TypeScript,
 * and puts the whole thing into your program with "Insert".
 */
import * as Blockly from "blockly";
import { tr } from "../i18n";
import { highlight } from "../highlight";
import DATA from "./presets.data.json";

type Lang = "cs" | "en";
type Group = "arrays" | "math" | "functions";
interface Text {
  title: string;
  text: string;
  tip: string;
  code: string;
  workspace: {
    blocks?: { blocks?: Blockly.serialization.blocks.State[] };
    variables?: { name: string; id: string; type?: string }[];
  };
}
interface Recipe {
  id: string;
  group: Group;
  cs: Text;
  en: Text;
}

const data = DATA as unknown as {
  groups: Record<Group, Record<Lang, string>>;
  presets: Recipe[];
};
export const RECIPES_ID = "tb_recipes";

export function initRecipes(
  ws: Blockly.WorkspaceSvg,
  theme: () => Blockly.Theme,
): void {
  const lang: Lang =
    (window as unknown as { TB_LANG?: string }).TB_LANG === "cs" ? "cs" : "en";
  const toolbox = ws.getToolbox() as Blockly.Toolbox;
  const stage = document.getElementById("blockly")!;
  const minis: Blockly.WorkspaceSvg[] = [];

  ws.registerToolboxCategoryCallback("TS_RECIPES", () => []);

  // ------------------------------------------------------------ panel
  const panel = document.createElement("aside");
  panel.id = "recipes";
  panel.hidden = true;
  panel.setAttribute("aria-label", tr("Recipes"));
  const groups = Object.keys(data.groups) as Group[];
  panel.innerHTML = `
    <header class="rcHead">
      <div>
        <h2>${tr("Recipes")}</h2>
        <p>${tr("Ready-made pieces of a program. Insert one, press Run, then change it.")}</p>
      </div>
      <button class="rcClose" type="button" title="${tr("Close")}" aria-label="${tr("Close")}">×</button>
    </header>
    <nav class="rcTabs" role="tablist">
      ${groups.map((g, i) => `<button type="button" role="tab" data-g="${g}" aria-selected="${i === 0}">${data.groups[g][lang]}</button>`).join("")}
    </nav>
    <div class="rcList"></div>`;
  stage.appendChild(panel);
  const list = panel.querySelector<HTMLElement>(".rcList")!;
  // Blockly listens on the document - keep clicks, keys and scrolling inside the panel to ourselves
  for (const t of [
    "pointerdown",
    "mousedown",
    "keydown",
    "wheel",
    "contextmenu",
  ])
    panel.addEventListener(t, (e) => e.stopPropagation());
  let inPanel = false;
  panel.addEventListener(
    "pointerdown",
    () => {
      inPanel = true;
      setTimeout(() => (inPanel = false), 0);
    },
    true,
  );

  for (const r of data.presets) {
    const t = r[lang];
    const card = document.createElement("article");
    card.className = "rcCard";
    card.dataset.g = r.group;
    card.innerHTML = `
      <h3>${t.title}</h3>
      <p class="rcText">${t.text}</p>
      <div class="rcBlocks" aria-hidden="true"></div>
      <p class="rcTip"><b>${tr("Try:")}</b> ${t.tip}</p>
      <pre class="rcCode" hidden>${t.code
        .replace(/\n$/, "")
        .split("\n")
        .map((l) => highlight(l) || " ")
        .join("\n")}</pre>
      <div class="rcActions">
        <button type="button" class="rcInsert">${tr("Insert")}</button>
        <button type="button" class="rcShow" aria-expanded="false">${tr("Show code")}</button>
      </div>`;
    card.querySelector(".rcInsert")!.addEventListener("click", () => insert(t));
    const show = card.querySelector<HTMLButtonElement>(".rcShow")!;
    const pre = card.querySelector<HTMLElement>(".rcCode")!;
    show.addEventListener("click", () => {
      pre.hidden = !pre.hidden;
      show.setAttribute("aria-expanded", String(!pre.hidden));
      show.textContent = pre.hidden ? tr("Show code") : tr("Hide code");
    });
    (card as HTMLElement & { recipe?: Text }).recipe = t;
    list.appendChild(card);
  }

  // block previews are drawn when a card scrolls into view
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        drawPreview(e.target as HTMLElement);
      }
    },
    { root: list, rootMargin: "200px" },
  );

  function drawPreview(host: HTMLElement) {
    const t = (host.closest(".rcCard") as HTMLElement & { recipe?: Text })
      .recipe!;
    const mini = Blockly.inject(host, {
      renderer: "zelos",
      theme: theme(),
      readOnly: true,
      sounds: false,
      zoom: { startScale: 0.62, controls: false, wheel: false },
      move: { scrollbars: false, drag: false, wheel: false },
    });
    minis.push(mini);
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(
        t.workspace as unknown as Record<string, unknown>,
        mini,
      );
      stackTopBlocks(mini.getTopBlocks(true) as Blockly.BlockSvg[], 0, 0);
    } finally {
      Blockly.Events.enable();
    }
    // shrink wide recipes so the whole thing is visible
    let b = mini.getBlocksBoundingBox();
    const fit = (host.clientWidth - 16) / Math.max(1, b.right - b.left);
    if (fit < mini.scale) {
      mini.setScale(Math.max(0.4, fit));
      b = mini.getBlocksBoundingBox();
    }
    host.style.height = `${Math.ceil((b.bottom - b.top) * mini.scale) + 16}px`;
    Blockly.svgResize(mini);
    mini.scroll(8 - b.left * mini.scale, 8 - b.top * mini.scale);
  }

  function selectTab(g: Group) {
    for (const b of panel.querySelectorAll<HTMLElement>(".rcTabs button"))
      b.setAttribute("aria-selected", String(b.dataset.g === g));
    for (const c of list.querySelectorAll<HTMLElement>(".rcCard"))
      c.hidden = c.dataset.g !== g;
    list.scrollTop = 0;
    for (const c of list.querySelectorAll<HTMLElement>(
      ".rcCard:not([hidden]) .rcBlocks:empty",
    ))
      io.observe(c);
  }
  panel.querySelector(".rcTabs")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-g]");
    if (b) selectTab(b.dataset.g as Group);
  });
  panel.querySelector(".rcClose")!.addEventListener("click", closeAll);
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  function open() {
    const tb = (toolbox as unknown as { HtmlDiv: HTMLElement | null }).HtmlDiv;
    panel.style.left = `${tb?.offsetWidth ?? 0}px`;
    panel.hidden = false;
    document.getElementById(RECIPES_ID)?.classList.add('rcOn');
    toolbox.getFlyout()?.hide();
    if (!panel.querySelector('.rcTabs [aria-selected="true"]'))
      selectTab(groups[0]);
    else
      selectTab(
        (panel.querySelector<HTMLElement>('.rcTabs [aria-selected="true"]')!
          .dataset.g as Group) ?? groups[0],
      );
  }
  function close() {
    panel.hidden = true;
    document.getElementById(RECIPES_ID)?.classList.remove('rcOn');
  }
  function closeAll() {
    close();
    toolbox.clearSelection();
  }

  // follow the category selection directly (not through the event queue - no delay, no flicker)
  const tbx = toolbox as unknown as {
    setSelectedItem(item: Blockly.ISelectableToolboxItem | null): void;
  };
  const origSelect = tbx.setSelectedItem.bind(toolbox);
  tbx.setSelectedItem = (item) => {
    origSelect(item);
    if (toolbox.getSelectedItem()?.getId() === RECIPES_ID) open();
    // the toolbox drops its selection when focus moves into the panel - that is not a reason to close
    else if (!item && (inPanel || panel.contains(document.activeElement)))
      return;
    else close();
  };
  new MutationObserver(() => minis.forEach((m) => m.setTheme(theme()))).observe(
    document.body,
    { attributes: true, attributeFilter: ["class"] },
  );

  // ------------------------------------------------------------ inserting
  /** Puts the recipe under everything that is already there, scrolls to it and selects it. */
  function insert(t: Text) {
    const vars = new Map<string, string>();
    for (const v of t.workspace.variables ?? []) {
      const have = ws.getVariableMap().getVariable(v.name);
      vars.set(
        v.id,
        (
          have ?? ws.getVariableMap().createVariable(v.name, v.type ?? "")
        ).getId(),
      );
    }
    const fix = (o: unknown): unknown => {
      if (Array.isArray(o)) return o.map(fix);
      if (!o || typeof o !== "object") return o;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o)) {
        if (k === "id" && typeof val === "string") {
          if (vars.has(val)) out.id = vars.get(val);
          // block ids are dropped so Blockly makes fresh ones
          continue;
        }
        if (k === "x" || k === "y") continue;
        out[k] = fix(val);
      }
      return out;
    };
    const content = ws.getBlocksBoundingBox();
    const empty = ws.getTopBlocks(false).length === 0;
    const x = empty ? 20 : content.left;
    let y = empty ? 20 : content.bottom + 48;
    const added: Blockly.BlockSvg[] = [];
    Blockly.Events.setGroup(true);
    try {
      for (const state of t.workspace.blocks?.blocks ?? []) {
        const b = Blockly.serialization.blocks.append(
          fix(state) as Blockly.serialization.blocks.State,
          ws,
        ) as Blockly.BlockSvg;
        added.push(b);
      }
      y = stackTopBlocks(added, x, y);
    } finally {
      Blockly.Events.setGroup(false);
    }
    closeAll();
    if (!added.length) return;
    added[0].select();
    const first = added[0].getBoundingRectangle();
    const sb = (
      ws as unknown as {
        scrollBoundsIntoView?: (r: Blockly.utils.Rect) => void;
      }
    ).scrollBoundsIntoView;
    if (sb)
      sb.call(
        ws,
        new Blockly.utils.Rect(
          first.top,
          Math.min(y, first.top + 400),
          first.left,
          first.right,
        ),
      );
    else ws.centerOnBlock(added[0].id);
    for (const b of added) flash(b);
  }

  function flash(b: Blockly.BlockSvg) {
    const root = b.getSvgRoot();
    root.classList.add("rcNew");
    setTimeout(() => root.classList.remove("rcNew"), 1400);
  }
}

/** Lays top blocks out one under another (function first, then the code that uses it). Returns the bottom. */
function stackTopBlocks(
  blocks: Blockly.BlockSvg[],
  x: number,
  y: number,
): number {
  for (const b of blocks) {
    const xy = b.getRelativeToSurfaceXY();
    b.moveBy(x - xy.x, y - xy.y);
    y += b.getHeightWidth().height + 28;
  }
  return y;
}
