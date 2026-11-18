import * as Blockly from 'blockly';
import * as csLocale from 'blockly/msg/cs';
import { getLang, tr } from '../i18n';

/** Category palette. Vivid enough for white text, distinct from each other. */
export const COLORS = {
  events: '#E09A0B',
  control: '#EF7D1A',
  console: '#8A63E8',
  operators: '#2BA358',
  text: '#0E9E98',
  variables: '#E0503A',
  lists: '#C8396A',
  functions: '#BE52C8',
  types: '#2F7FDB',
  code: '#5F6B7A',
} as const;

export const VAR_TYPES = ['number', 'string', 'boolean', 'any'] as const;
export const ITEM_TYPES = ['string', 'number', 'boolean', 'any'] as const;

/** Set by the webview: opens the editor for a raw-code block. */
export const hooks: { editCode: (block: Blockly.Block) => void } = { editCode: () => {} };

const SQUARE = 3; // zelos output shape used for arrays

function mix(hex: string, target: number, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * f));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

const style = (c: string) => ({ colourPrimary: c, colourSecondary: mix(c, 255, 0.28), colourTertiary: mix(c, 0, 0.22) });

let themeCounter = 0;
export function makeTheme(opts: { bg: string; panel: string; fg: string; font: string; dark: boolean }): Blockly.Theme {
  return Blockly.Theme.defineTheme('typeblocks-' + themeCounter++, {
    name: 'typeblocks',
    base: Blockly.Themes.Classic,
    blockStyles: {
      event_blocks: style(COLORS.events),
      loop_blocks: style(COLORS.control),
      control_blocks: style(COLORS.control),
      console_blocks: style(COLORS.console),
      logic_blocks: style(COLORS.operators),
      math_blocks: style(COLORS.operators),
      text_blocks: style(COLORS.text),
      variable_blocks: style(COLORS.variables),
      variable_dynamic_blocks: style(COLORS.variables),
      list_blocks: style(COLORS.lists),
      procedure_blocks: style(COLORS.functions),
      type_blocks: style(COLORS.types),
      code_blocks: style(COLORS.code),
    },
    categoryStyles: Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, { colour: c }])),
    componentStyles: {
      workspaceBackgroundColour: opts.bg,
      toolboxBackgroundColour: opts.panel,
      toolboxForegroundColour: opts.fg,
      flyoutBackgroundColour: opts.panel,
      flyoutForegroundColour: opts.fg,
      flyoutOpacity: 0.97,
      scrollbarColour: opts.dark ? '#ffffff' : '#000000',
      scrollbarOpacity: 0.18,
      insertionMarkerColour: opts.dark ? '#ffffff' : '#000000',
      insertionMarkerOpacity: 0.25,
      cursorColour: '#ffcc00',
    },
    fontStyle: { family: opts.font, weight: '600', size: 12 },
    startHats: true,
  });
}

// ------------------------------------------------------------------ icons

const svg = (body: string, w = 20) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 16" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  );
const cells = (n: number, x0 = 1, filled = -1) =>
  Array.from({ length: n }, (_, i) => `<rect x="${x0 + i * 5}" y="5" width="4" height="6" rx="1"${i === filled ? ' fill="#fff"' : ''}/>`).join('');

export const ICONS = {
  play: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1f9d55" stroke="#fff" stroke-width="2"/><path d="M9.5 7.5v9l7-4.5z" fill="#fff"/></svg>'),
  pencil: svg('<path d="M3 13l1-3 7-7 2 2-7 7z"/><path d="M10 4l2 2"/>', 16),
  plus: svg('<circle cx="8" cy="8" r="6.5" fill="#ffffff33"/><path d="M8 5v6M5 8h6"/>', 16),
  minus: svg('<circle cx="8" cy="8" r="6.5" fill="#ffffff33"/><path d="M5 8h6"/>', 16),
  push: svg(cells(2) + '<path d="M15 5v6M12 8h6"/>'),
  unshift: svg('<path d="M4 5v6M1 8h6"/>' + cells(2, 9)),
  insert: svg(cells(3, 2, 1) + '<path d="M10 0v3M8.5 1.8 10 3.2l1.5-1.4"/>'),
  remove: svg(cells(2) + '<path d="M12 8h6"/>'),
  pop: svg(cells(2) + '<path d="M12 8h6M15.5 5.5 18 8l-2.5 2.5"/>'),
  item: svg(cells(3, 2, 1)),
  replace: svg(cells(3, 2, 1) + '<path d="M8 14h4"/>'),
  length: svg('<path d="M2 8h16M2 5v6M18 5v6"/>'),
  contains: svg('<circle cx="8" cy="7" r="4"/><path d="M11 10l4 4"/>'),
  index: svg('<path d="M8 2 7 14M13 2l-1 12M4 6h12M3 10h12"/>'),
  join: svg('<rect x="1" y="5" width="8" height="6" rx="3"/><rect x="11" y="5" width="8" height="6" rx="3"/><path d="M7 8h6"/>'),
  sort: svg('<path d="M4 13v-3M9 13V7M14 13V4"/>'),
  reverse: svg('<path d="M3 6h13l-3-3M17 10H4l3 3"/>'),
  each: svg('<path d="M15 8a5 5 0 1 1-2-4"/><path d="M13 1v3h3"/>'),
  last: svg(cells(3, 2, 2)),
  copy: svg('<rect x="3" y="3" width="9" height="9" rx="1.5"/><rect x="7" y="6" width="9" height="9" rx="1.5"/>'),
  map: svg('<rect x="1" y="5" width="4" height="6" rx="1"/><path d="M7 8h6M11 5.5 13.5 8 11 10.5"/><rect x="15" y="5" width="4" height="6" rx="1" fill="#fff"/>'),
  filter: svg('<path d="M3 3h14l-5.5 6v5l-3-1.5V9z"/>'),
  some: svg('<circle cx="8" cy="7" r="4"/><path d="M11 10l4 4M17 3v4M17 9v.5"/>'),
  every: svg('<path d="M2 8l2.5 2.5L9 6M9 8l2.5 2.5L16 6"/>'),
  reduce: svg('<path d="M15 3H5l5 5-5 5h10"/>'),
};

const img = (src: string, w = 20) => ({ type: 'field_image', src, width: w, height: 16, alt: '' });
const LISTVAR = { type: 'field_variable', name: 'LIST', variable: null };

// ------------------------------------------------------------------ JSON blocks

/** Translate texts, tooltips and dropdown labels of JSON block definitions. */
function localize(defs: Record<string, unknown>[]): Record<string, unknown>[] {
  return defs.map((d) => {
    const o: Record<string, unknown> = { ...d };
    for (const k of Object.keys(o)) {
      if (/^message\d+$/.test(k) || k === 'tooltip') o[k] = tr(o[k] as string);
      if (/^args\d+$/.test(k)) {
        o[k] = (o[k] as Record<string, unknown>[]).map((a) =>
          a.type === 'field_dropdown' ? { ...a, options: (a.options as [string, string][]).map(([label, value]) => [tr(label), value]) } : a,
        );
      }
    }
    return o;
  });
}

export function defineBlocks(): void {
  if (getLang() === 'cs') Blockly.setLocale(((csLocale as unknown as { default?: object }).default ?? csLocale) as Record<string, string>);
  Blockly.common.defineBlocksWithJsonArray(localize([
    // ---- Events ----
    {
      type: 'ts_on_start',
      message0: 'when %1 Run clicked',
      args0: [{ type: 'field_image', src: ICONS.play, width: 24, height: 24, alt: 'run' }],
      nextStatement: null,
      style: 'event_blocks',
      tooltip: 'Starts here when you press Run. Becomes async function main() { ... } main();',
    },
    {
      type: 'ts_every',
      message0: 'every %1 seconds',
      args0: [{ type: 'input_value', name: 'SECS', check: 'Number' }],
      nextStatement: null,
      style: 'event_blocks',
      tooltip: 'Runs the blocks below again and again. Becomes setInterval(...).',
    },
    // ---- Control ----
    {
      type: 'ts_wait',
      message0: 'wait %1 seconds',
      args0: [{ type: 'input_value', name: 'SECS' }],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'Pause. Becomes await sleep(seconds).',
    },
    {
      type: 'ts_repeat',
      message0: 'repeat %1 times',
      args0: [{ type: 'input_value', name: 'TIMES' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'for (let i = 0; i < times; i++) { ... }',
    },
    {
      type: 'ts_count',
      message0: 'count %1 from %2 to %3',
      args0: [{ type: 'field_variable', name: 'VAR', variable: 'i' }, { type: 'input_value', name: 'FROM' }, { type: 'input_value', name: 'TO' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'for (let i = from; i <= to; i++) { ... }',
    },
    {
      type: 'ts_forever',
      message0: 'forever',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'while (true) { ... } - put a wait or a break inside!',
    },
    {
      type: 'ts_for_raw',
      message0: 'for ( %1 )',
      args0: [{ type: 'field_input', name: 'HEAD', text: 'let i = 0; i < 10; i++' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'A for loop written the TypeScript way.',
    },
    {
      type: 'ts_return',
      message0: 'return %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      style: 'procedure_blocks',
      tooltip: 'Leave the function (and give back a value, if one is plugged in).',
    },
    {
      type: 'ts_stop',
      message0: 'stop program',
      previousStatement: null,
      style: 'control_blocks',
      tooltip: 'process.exit()',
    },
    // ---- Console ----
    {
      type: 'ts_say',
      message0: 'say %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      previousStatement: null,
      nextStatement: null,
      style: 'console_blocks',
      tooltip: 'Print to the console. Becomes console.log(...).',
    },
    {
      type: 'ts_say_color',
      message0: 'say %1 in %2',
      args0: [
        { type: 'input_value', name: 'TEXT' },
        {
          type: 'field_dropdown',
          name: 'COLOR',
          options: ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].map((c) => [c, c]),
        },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'console_blocks',
      tooltip: 'Print in color.',
    },
    {
      type: 'ts_ask',
      message0: 'ask %1 and wait',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      output: 'String',
      style: 'console_blocks',
      tooltip: 'Ask a question in the terminal; gives back the answer as a string.',
    },
    {
      type: 'ts_ask_number',
      message0: 'ask number %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      output: 'Number',
      style: 'console_blocks',
      tooltip: 'Ask a question and turn the answer into a number.',
    },
    {
      type: 'ts_comment',
      message0: '// %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'note' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#7c8594',
      tooltip: 'A comment: a note for people, the computer skips it.',
    },
    // ---- Variables ----
    {
      type: 'ts_let',
      message0: '%1 %2 : %3 = %4',
      args0: [
        { type: 'field_dropdown', name: 'KIND', options: [['let', 'let'], ['const', 'const'], ['var', 'var']] },
        { type: 'field_variable', name: 'VAR', variable: null },
        { type: 'field_input', name: 'TYPE', text: 'number' },
        { type: 'input_value', name: 'VALUE' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'variable_blocks',
      tooltip: 'Create a variable. let = can change later, const = never changes. The type says what it holds (leave it empty to let TypeScript guess).',
    },
    // ---- Operators ----
    {
      type: 'ts_arith',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'field_dropdown', name: 'OP', options: [['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/'], ['mod', '%'], ['^', '**']] },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: null,
      style: 'math_blocks',
      tooltip: 'Math. + also joins text.',
    },
    {
      type: 'ts_compare',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A' },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [['=', '==='], ['≠', '!=='], ['<', '<'], ['≤', '<='], ['>', '>'], ['≥', '>='], ['== (loose)', '=='], ['!= (loose)', '!=']],
        },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'logic_blocks',
      tooltip: 'Compare two values: true or false.',
    },
    {
      type: 'ts_logic',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'field_dropdown', name: 'OP', options: [['and', '&&'], ['or', '||'], ['or else (??)', '??']] },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'logic_blocks',
      tooltip: 'and = both true, or = at least one true.',
    },
    {
      type: 'ts_not',
      message0: 'not %1',
      args0: [{ type: 'input_value', name: 'A' }],
      output: 'Boolean',
      style: 'logic_blocks',
      tooltip: '!value',
    },
    {
      type: 'ts_random',
      message0: 'pick random %1 to %2',
      args0: [{ type: 'input_value', name: 'FROM' }, { type: 'input_value', name: 'TO' }],
      inputsInline: true,
      output: 'Number',
      style: 'math_blocks',
      tooltip: 'Whole random number between the two values (both included).',
    },
    // ---- Text ----
    {
      type: 'ts_contains',
      message0: '%1 contains %2 ?',
      args0: [{ type: 'input_value', name: 'TEXT' }, { type: 'input_value', name: 'PART' }],
      inputsInline: true,
      output: 'Boolean',
      style: 'text_blocks',
      tooltip: 'value.includes(part) - works for text and arrays.',
    },
    {
      type: 'ts_starts',
      message0: '%1 %2 %3 ?',
      args0: [
        { type: 'input_value', name: 'TEXT' },
        { type: 'field_dropdown', name: 'HOW', options: [['starts with', 'startsWith'], ['ends with', 'endsWith']] },
        { type: 'input_value', name: 'PART' },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'text_blocks',
      tooltip: 'text.startsWith(part) / text.endsWith(part) - does the text begin / end with it?',
    },
    {
      type: 'ts_length',
      message0: 'length of %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: 'Number',
      style: 'text_blocks',
      tooltip: 'value.length',
    },
    {
      type: 'ts_to_number',
      message0: 'number from %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: 'Number',
      style: 'text_blocks',
      tooltip: 'Number(value)',
    },
    {
      type: 'ts_to_text',
      message0: 'text from %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: 'String',
      style: 'text_blocks',
      tooltip: 'String(value)',
    },
    {
      type: 'ts_case',
      message0: '%1 in %2',
      args0: [{ type: 'input_value', name: 'TEXT' }, { type: 'field_dropdown', name: 'CASE', options: [['UPPERCASE', 'toUpperCase'], ['lowercase', 'toLowerCase']] }],
      inputsInline: true,
      output: 'String',
      style: 'text_blocks',
      tooltip: 'text.toUpperCase() / text.toLowerCase()',
    },
    // ---- Arrays (all 0-based, like TypeScript) ----
    {
      type: 'ts_list_add',
      message0: '%1 add %2 to the end of %3',
      args0: [img(ICONS.push), { type: 'input_value', name: 'ITEM' }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.push(item) - the array gets 1 longer.',
    },
    {
      type: 'ts_list_add_front',
      message0: '%1 add %2 to the start of %3',
      args0: [img(ICONS.unshift), { type: 'input_value', name: 'ITEM' }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.unshift(item) - every other item moves up one index.',
    },
    {
      type: 'ts_list_insert',
      message0: '%1 insert %2 at index %3 of %4',
      args0: [img(ICONS.insert), { type: 'input_value', name: 'ITEM' }, { type: 'input_value', name: 'INDEX' }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.splice(index, 0, item)',
    },
    {
      type: 'ts_list_remove',
      message0: '%1 remove item at index %2 of %3',
      args0: [img(ICONS.remove), { type: 'input_value', name: 'INDEX' }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.splice(index, 1) - the first item is index 0.',
    },
    {
      type: 'ts_list_pop',
      message0: '%1 remove the %2 item of %3',
      args0: [img(ICONS.pop), { type: 'field_dropdown', name: 'END', options: [['last', 'pop'], ['first', 'shift']] }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.pop() removes the last item, list.shift() the first one.',
    },
    {
      type: 'ts_list_replace',
      message0: '%1 set item at index %2 of %3 to %4',
      args0: [img(ICONS.replace), { type: 'input_value', name: 'INDEX' }, LISTVAR, { type: 'input_value', name: 'ITEM' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list[index] = item',
    },
    {
      type: 'ts_list_sort',
      message0: '%1 %2 %3',
      args0: [img(ICONS.sort), { type: 'field_dropdown', name: 'HOW', options: [['sort', 'sort'], ['reverse', 'reverse']] }, LISTVAR],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.sort() puts items in order, list.reverse() flips the order.',
    },
    {
      type: 'ts_foreach',
      message0: '%1 for each %2 in %3',
      args0: [img(ICONS.each), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'for (const item of list) { ... } - runs once per item.',
    },
    {
      type: 'ts_list_item',
      message0: '%1 item at index %2 of %3',
      args0: [img(ICONS.item), { type: 'input_value', name: 'INDEX' }, LISTVAR],
      inputsInline: true,
      output: null,
      style: 'list_blocks',
      tooltip: 'list[index] - the first item is index 0.',
    },
    {
      type: 'ts_list_last',
      message0: '%1 last item of %2',
      args0: [img(ICONS.last), LISTVAR],
      output: null,
      style: 'list_blocks',
      tooltip: 'list[list.length - 1]',
    },
    {
      type: 'ts_list_length',
      message0: '%1 length of %2',
      args0: [img(ICONS.length), LISTVAR],
      output: 'Number',
      style: 'list_blocks',
      tooltip: 'list.length - how many items it has.',
    },
    {
      type: 'ts_list_contains',
      message0: '%1 %2 contains %3 ?',
      args0: [img(ICONS.contains), LISTVAR, { type: 'input_value', name: 'ITEM' }],
      inputsInline: true,
      output: 'Boolean',
      style: 'list_blocks',
      tooltip: 'list.includes(item)',
    },
    {
      type: 'ts_list_indexof',
      message0: '%1 index of %2 in %3',
      args0: [img(ICONS.index), { type: 'input_value', name: 'ITEM' }, LISTVAR],
      inputsInline: true,
      output: 'Number',
      style: 'list_blocks',
      tooltip: 'list.indexOf(item) - gives -1 if it is not there.',
    },
    {
      type: 'ts_list_join',
      message0: '%1 join %2 with %3',
      args0: [img(ICONS.join), LISTVAR, { type: 'input_value', name: 'SEP' }],
      inputsInline: true,
      output: 'String',
      style: 'list_blocks',
      tooltip: 'list.join(separator) - all items glued into one text.',
    },
    {
      type: 'ts_list_split',
      message0: 'split %1 by %2',
      args0: [{ type: 'input_value', name: 'TEXT' }, { type: 'input_value', name: 'SEP' }],
      inputsInline: true,
      output: null,
      outputShape: SQUARE,
      style: 'list_blocks',
      tooltip: 'text.split(separator) - cuts text into an array.',
    },
    // ---- Types ----
    {
      type: 'ts_typeof',
      message0: 'type of %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: 'String',
      style: 'type_blocks',
      tooltip: 'typeof value - "number", "string", "boolean", ...',
    },
    {
      type: 'ts_is_type',
      message0: '%1 is a %2 ?',
      args0: [
        { type: 'input_value', name: 'VALUE' },
        { type: 'field_dropdown', name: 'TYPE', options: ['number', 'string', 'boolean', 'object', 'undefined'].map((t) => [t, t]) },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'type_blocks',
      tooltip: 'typeof value === "..."',
    },
    {
      type: 'ts_as',
      message0: '%1 as %2',
      args0: [{ type: 'input_value', name: 'VALUE' }, { type: 'field_input', name: 'TYPE', text: 'number' }],
      inputsInline: true,
      output: null,
      style: 'type_blocks',
      tooltip: 'Type assertion: tells TypeScript the type. Does NOT convert the value.',
    },
    // ---- Arrays: do something with every item (map, filter, ...) ----
    {
      type: 'ts_arr_map',
      message0: '%1 from %2 make a new array: each %3 becomes %4',
      args0: [img(ICONS.map), { type: 'input_value', name: 'LIST' }, { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'VALUE' }],
      inputsInline: true,
      output: null,
      outputShape: SQUARE,
      style: 'list_blocks',
      tooltip: 'list.map(...) - like a factory: every item goes in, a changed item comes out. The new array is just as long.',
    },
    {
      type: 'ts_arr_filter',
      message0: '%1 from %2 keep only each %3 where %4',
      args0: [img(ICONS.filter), { type: 'input_value', name: 'LIST' }, { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'COND' }],
      inputsInline: true,
      output: null,
      outputShape: SQUARE,
      style: 'list_blocks',
      tooltip: 'list.filter(...) - like a sieve: only the items where the condition is true stay.',
    },
    {
      type: 'ts_arr_some',
      message0: '%1 is there any %2 in %3 where %4 ?',
      args0: [img(ICONS.some), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }, { type: 'input_value', name: 'COND' }],
      inputsInline: true,
      output: 'Boolean',
      style: 'list_blocks',
      tooltip: 'list.some(...) - true if at least ONE item matches.',
    },
    {
      type: 'ts_arr_every',
      message0: '%1 is every %2 in %3 such that %4 ?',
      args0: [img(ICONS.every), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }, { type: 'input_value', name: 'COND' }],
      inputsInline: true,
      output: 'Boolean',
      style: 'list_blocks',
      tooltip: 'list.every(...) - true only if ALL items match.',
    },
    {
      type: 'ts_arr_find',
      message0: '%1 first %2 in %3 where %4',
      args0: [img(ICONS.contains), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }, { type: 'input_value', name: 'COND' }],
      inputsInline: true,
      output: null,
      style: 'list_blocks',
      tooltip: 'list.find(...) - the first item that matches (or undefined if none does).',
    },
    {
      type: 'ts_arr_findindex',
      message0: '%1 index of the first %2 in %3 where %4',
      args0: [img(ICONS.index), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }, { type: 'input_value', name: 'COND' }],
      inputsInline: true,
      output: 'Number',
      style: 'list_blocks',
      tooltip: 'list.findIndex(...) - where the first matching item is (or -1).',
    },
    {
      type: 'ts_arr_reduce',
      message0: '%1 add up %2 starting from %3 : %4 + each %5 gives %6',
      args0: [
        img(ICONS.reduce),
        { type: 'input_value', name: 'LIST' },
        { type: 'input_value', name: 'INIT' },
        { type: 'field_variable', name: 'ACC', variable: 'total' },
        { type: 'field_variable', name: 'VAR', variable: 'item' },
        { type: 'input_value', name: 'VALUE' },
      ],
      inputsInline: true,
      output: null,
      style: 'list_blocks',
      tooltip: 'list.reduce(...) - goes through the items one by one and builds one result, e.g. a sum. "total" is the result so far.',
    },
    {
      type: 'ts_arr_foreach',
      message0: '%1 with each %2 in %3 do',
      args0: [img(ICONS.each), { type: 'field_variable', name: 'VAR', variable: 'item' }, { type: 'input_value', name: 'LIST' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'list.forEach(...) - runs the blocks inside once for every item.',
    },
    // ---- Objects ----
    {
      type: 'ts_prop',
      message0: '%1 of %2',
      args0: [{ type: 'field_input', name: 'PROP', text: 'name' }, { type: 'input_value', name: 'OBJ' }],
      inputsInline: true,
      output: null,
      style: 'type_blocks',
      tooltip: 'object.property - one value stored inside an object, e.g. "price of order" is order.price',
    },
    {
      type: 'ts_prop_set',
      message0: 'set %1 of %2 to %3',
      args0: [{ type: 'field_input', name: 'PROP', text: 'name' }, { type: 'input_value', name: 'OBJ' }, { type: 'input_value', name: 'VALUE' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'type_blocks',
      tooltip: 'object.property = value',
    },
    // ---- Code ----
    {
      type: 'ts_code_expr',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'CODE', text: 'Date.now()' }],
      output: null,
      style: 'code_blocks',
      tooltip: 'Any TypeScript value, written by hand.',
    },
  ]));

  defineListLiteral();
  defineObjectLiteral();
  defineTypeShape();
  defineRawStatement();

  // Built-in control blocks are "logic" styled by default - recolor to Control.
  for (const type of ['controls_if', 'controls_whileUntil', 'controls_flow_statements']) {
    const def = Blockly.Blocks[type];
    if (!def) continue;
    const init = def.init;
    def.init = function (this: Blockly.Block) {
      init.call(this);
      this.setStyle('control_blocks');
    };
  }

  const M = Blockly.Msg as Record<string, string>;
  M['PROCEDURES_DEFNORETURN_TITLE'] = tr('function');
  M['PROCEDURES_DEFRETURN_TITLE'] = tr('function');
  M['PROCEDURES_DEFNORETURN_PROCEDURE'] = tr('doSomething');
  M['PROCEDURES_DEFRETURN_PROCEDURE'] = tr('calculate');
  M['PROCEDURES_DEFRETURN_RETURN'] = tr('return');
  // no automatic "Describe this function..." comment (it would end up in the code)
  M['PROCEDURES_DEFNORETURN_COMMENT'] = tr('');
  M['PROCEDURES_DEFRETURN_COMMENT'] = tr('');
  M['PROCEDURES_BEFORE_PARAMS'] = tr('with:');
  M['PROCEDURES_CALL_BEFORE_PARAMS'] = tr('with:');
  M['CONTROLS_WHILEUNTIL_OPERATOR_WHILE'] = tr('repeat while');
  M['CONTROLS_WHILEUNTIL_OPERATOR_UNTIL'] = tr('repeat until');
  M['VARIABLES_SET'] = tr('set %1 to %2');
  M['MATH_CHANGE_TITLE'] = tr('change %1 by %2');
}

/** [ 0:(a) 1:(b) 2:(c) ] (+)(-) - an array literal with visible indexes. */
function defineListLiteral(): void {
  type ListBlock = Blockly.BlockSvg & { itemCount: number; updateShape(): void; resize(delta: number): void };
  Blockly.Blocks['ts_list_literal'] = {
    init(this: ListBlock) {
      this.itemCount = 2;
      this.setOutput(true, null);
      this.setOutputShape(SQUARE);
      this.setStyle('list_blocks');
      this.setInputsInline(true);
      this.setTooltip(tr('An array: a numbered row of values. The first one is index 0. Use + and - to add or remove slots.'));
      this.appendDummyInput('HEAD').appendField('[');
      this.updateShape();
    },
    saveExtraState(this: ListBlock) {
      return { itemCount: this.itemCount };
    },
    loadExtraState(this: ListBlock, state: { itemCount?: number }) {
      this.itemCount = state.itemCount ?? 0;
      this.updateShape();
    },
    updateShape(this: ListBlock) {
      if (this.getInput('TAIL')) this.removeInput('TAIL');
      let i = 0;
      while (this.getInput('ITEM' + i)) {
        if (i >= this.itemCount) {
          const child = this.getInputTargetBlock('ITEM' + i);
          if (child) child.unplug(false);
          this.removeInput('ITEM' + i);
        }
        i++;
      }
      for (let k = 0; k < this.itemCount; k++) {
        if (!this.getInput('ITEM' + k)) {
          const label = new Blockly.FieldLabel(String(k), 'tbIndex');
          this.appendValueInput('ITEM' + k).appendField(label);
        }
      }
      const tail = this.appendDummyInput('TAIL').appendField(']');
      tail.appendField(new Blockly.FieldImage(ICONS.plus, 16, 16, 'add a slot', () => this.resize(1)));
      if (this.itemCount > 0) tail.appendField(new Blockly.FieldImage(ICONS.minus, 16, 16, 'remove the last slot', () => this.resize(-1)));
    },
    resize(this: ListBlock, delta: number) {
      if (this.isInFlyout || this.isDeadOrDying()) return;
      const before = JSON.stringify(this.saveExtraState?.());
      Blockly.Events.setGroup(true);
      this.itemCount = Math.max(0, this.itemCount + delta);
      this.updateShape();
      if (delta > 0 && this.workspace.rendered) {
        // drop a default value into the new slot so it is obvious where to type
        // same kind of value as the item before it (a number array gets a number, ...)
        const prev = this.itemCount > 1 ? this.getInputTargetBlock('ITEM' + (this.itemCount - 2)) : null;
        const kind = prev && (prev.type === 'math_number' || prev.type === 'logic_boolean') ? prev.type : 'text';
        const shadow = this.workspace.newBlock(kind) as Blockly.BlockSvg;
        if (kind === 'math_number') shadow.setFieldValue(0, 'NUM');
        shadow.setShadow(true);
        shadow.initSvg();
        shadow.render();
        this.getInput('ITEM' + (this.itemCount - 1))!.connection!.connect(shadow.outputConnection!);
      }
      const after = JSON.stringify(this.saveExtraState?.());
      Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(this, 'mutation', null, before, after));
      Blockly.Events.setGroup(false);
    },
  };
}

function fireMutation(block: Blockly.Block, before: string, after: string) {
  Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(block, 'mutation', null, before, after));
}

/** { name: (value), other: (value) } - an object, one row per property. */
function defineObjectLiteral(): void {
  type ObjBlock = Blockly.Block & { count: number; updateShape(): void; resize(d: number): void };
  Blockly.Blocks['ts_object'] = {
    init(this: ObjBlock) {
      this.count = 2;
      this.setOutput(true, null);
      this.setStyle('type_blocks');
      this.setTooltip(tr('An object: named values that belong together, e.g. an order with an item name, a count and a price.'));
      this.appendDummyInput('HEAD').appendField('{');
      this.updateShape();
    },
    saveExtraState(this: ObjBlock) {
      return { count: this.count };
    },
    loadExtraState(this: ObjBlock, state: { count?: number }) {
      this.count = state.count ?? 0;
      this.updateShape();
    },
    updateShape(this: ObjBlock) {
      if (this.getInput('TAIL')) this.removeInput('TAIL');
      let i = 0;
      while (this.getInput('V' + i)) {
        if (i >= this.count) {
          this.getInputTargetBlock('V' + i)?.unplug(false);
          this.removeInput('V' + i);
        }
        i++;
      }
      for (let k = 0; k < this.count; k++) {
        if (!this.getInput('V' + k)) this.appendValueInput('V' + k).appendField(new Blockly.FieldTextInput(k ? 'key' + k : 'name'), 'K' + k).appendField(':');
      }
      const tail = this.appendDummyInput('TAIL').appendField('}');
      tail.appendField(new Blockly.FieldImage(ICONS.plus, 16, 16, 'add a property', () => this.resize(1)));
      if (this.count > 0) tail.appendField(new Blockly.FieldImage(ICONS.minus, 16, 16, 'remove the last property', () => this.resize(-1)));
    },
    resize(this: ObjBlock, delta: number) {
      if (this.isInFlyout || this.isDeadOrDying()) return;
      const before = JSON.stringify({ count: this.count });
      Blockly.Events.setGroup(true);
      this.count = Math.max(0, this.count + delta);
      this.updateShape();
      fireMutation(this, before, JSON.stringify({ count: this.count }));
      Blockly.Events.setGroup(false);
    },
  };
}

/** type Order = { item: string; count: number } - what an object looks like. */
function defineTypeShape(): void {
  type TypeBlock = Blockly.Block & { count: number; kind: 'type' | 'interface'; exported: boolean; updateShape(): void; resize(d: number): void };
  Blockly.Blocks['ts_type'] = {
    init(this: TypeBlock) {
      this.count = 2;
      this.kind = 'type';
      this.exported = false;
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('type_blocks');
      this.setTooltip(tr('Describes what an object looks like: which properties it has and what type each one is. TypeScript then checks you use it right.'));
      this.updateShape();
    },
    saveExtraState(this: TypeBlock) {
      return { count: this.count, kind: this.kind, exported: this.exported };
    },
    loadExtraState(this: TypeBlock, s: { count?: number; kind?: 'type' | 'interface'; exported?: boolean }) {
      this.count = s.count ?? 0;
      this.kind = s.kind ?? 'type';
      this.exported = !!s.exported;
      this.updateShape();
    },
    updateShape(this: TypeBlock) {
      const keep = new Map<string, string>();
      for (const input of this.inputList) for (const f of input.fieldRow) if (f.name) keep.set(f.name, String(f.getValue()));
      for (const input of [...this.inputList]) this.removeInput(input.name);
      this.appendDummyInput('HEAD')
        .appendField(`${this.exported ? 'export ' : ''}${this.kind}`)
        .appendField(new Blockly.FieldTextInput(keep.get('NAME') ?? 'Thing'), 'NAME')
        .appendField(tr('has:'));
      for (let k = 0; k < this.count; k++) {
        this.appendDummyInput('R' + k)
          .appendField('   ')
          .appendField(new Blockly.FieldTextInput(keep.get('N' + k) ?? 'name'), 'N' + k)
          .appendField(':')
          .appendField(new Blockly.FieldTextInput(keep.get('T' + k) ?? 'string'), 'T' + k);
      }
      const tail = this.appendDummyInput('TAIL');
      tail.appendField(new Blockly.FieldImage(ICONS.plus, 16, 16, 'add a property', () => this.resize(1)));
      if (this.count > 0) tail.appendField(new Blockly.FieldImage(ICONS.minus, 16, 16, 'remove the last property', () => this.resize(-1)));
    },
    resize(this: TypeBlock, delta: number) {
      if (this.isInFlyout || this.isDeadOrDying()) return;
      const before = JSON.stringify(this.saveExtraState?.());
      Blockly.Events.setGroup(true);
      this.count = Math.max(0, this.count + delta);
      this.updateShape();
      fireMutation(this, before, JSON.stringify(this.saveExtraState?.()));
      Blockly.Events.setGroup(false);
    },
  };
}

/** Raw TypeScript statement(s), shown line by line; the pencil opens an editor. */
function defineRawStatement(): void {
  type RawBlock = Blockly.Block & { code: string; updateShape(): void };
  Blockly.Blocks['ts_code_stmt'] = {
    init(this: RawBlock) {
      this.code = 'console.log("hi");';
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('code_blocks');
      this.setTooltip(tr('TypeScript written as text. Click the pencil to edit it.'));
      this.updateShape();
    },
    saveExtraState(this: RawBlock) {
      return { code: this.code };
    },
    loadExtraState(this: RawBlock, state: { code?: string }) {
      this.code = state.code ?? '';
      this.updateShape();
    },
    updateShape(this: RawBlock) {
      for (const input of [...this.inputList]) this.removeInput(input.name);
      const lines = this.code.split('\n');
      const max = 14;
      lines.slice(0, max).forEach((line, i) => {
        const input = this.appendDummyInput('L' + i);
        if (i === 0) input.appendField(new Blockly.FieldImage(ICONS.pencil, 16, 16, 'edit code', () => hooks.editCode(this)));
        const label = new Blockly.FieldLabel(line || ' ', 'tbCode');
        label.maxDisplayLength = 90;
        input.appendField(label);
      });
      if (lines.length > max) this.appendDummyInput('MORE').appendField(new Blockly.FieldLabel(`... ${lines.length - max} more lines`, 'tbCodeMore'));
    },
  };
}

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });

export function buildToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: tr('Events'),
        categorystyle: 'events',
        contents: [
          { kind: 'block', type: 'ts_on_start' },
          { kind: 'block', type: 'ts_every', inputs: { SECS: num(1) } },
        ],
      },
      {
        kind: 'category',
        name: tr('Control'),
        categorystyle: 'control',
        contents: [
          { kind: 'block', type: 'ts_wait', inputs: { SECS: num(1) } },
          { kind: 'block', type: 'ts_repeat', inputs: { TIMES: num(10) } },
          { kind: 'block', type: 'ts_count', inputs: { FROM: num(1), TO: num(10) } },
          { kind: 'block', type: 'ts_forever' },
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
          { kind: 'block', type: 'controls_whileUntil', fields: { MODE: 'UNTIL' } },
          { kind: 'block', type: 'controls_flow_statements' },
          { kind: 'block', type: 'ts_stop' },
        ],
      },
      {
        kind: 'category',
        name: tr('Console'),
        categorystyle: 'console',
        contents: [
          { kind: 'block', type: 'ts_say', inputs: { TEXT: txt('Hello!') } },
          { kind: 'block', type: 'ts_say_color', inputs: { TEXT: txt('Hello!') } },
          { kind: 'block', type: 'ts_ask', inputs: { TEXT: txt("What's your name?") } },
          { kind: 'block', type: 'ts_ask_number', inputs: { TEXT: txt('Pick a number') } },
          { kind: 'block', type: 'ts_comment' },
        ],
      },
      {
        kind: 'category',
        name: tr('Operators'),
        categorystyle: 'operators',
        contents: [
          { kind: 'block', type: 'ts_arith', fields: { OP: '+' }, inputs: { A: num(1), B: num(1) } },
          { kind: 'block', type: 'ts_arith', fields: { OP: '-' }, inputs: { A: num(5), B: num(2) } },
          { kind: 'block', type: 'ts_arith', fields: { OP: '*' }, inputs: { A: num(2), B: num(3) } },
          { kind: 'block', type: 'ts_arith', fields: { OP: '/' }, inputs: { A: num(10), B: num(2) } },
          { kind: 'block', type: 'ts_random', inputs: { FROM: num(1), TO: num(10) } },
          { kind: 'sep', gap: 24 },
          { kind: 'block', type: 'ts_compare', fields: { OP: '>' }, inputs: { B: num(50) } },
          { kind: 'block', type: 'ts_compare', fields: { OP: '<' }, inputs: { B: num(50) } },
          { kind: 'block', type: 'ts_compare', fields: { OP: '===' }, inputs: { B: num(50) } },
          { kind: 'block', type: 'ts_logic', fields: { OP: '&&' } },
          { kind: 'block', type: 'ts_logic', fields: { OP: '||' } },
          { kind: 'block', type: 'ts_not' },
          { kind: 'block', type: 'logic_boolean' },
          { kind: 'sep', gap: 24 },
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'logic_ternary' },
        ],
      },
      {
        kind: 'category',
        name: tr('Text'),
        categorystyle: 'text',
        contents: [
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'ts_arith', fields: { OP: '+' }, inputs: { A: txt('Hello, '), B: txt('world') } },
          { kind: 'block', type: 'ts_length', inputs: { VALUE: txt('apple') } },
          { kind: 'block', type: 'ts_starts', inputs: { TEXT: txt('apple'), PART: txt('ap') } },
          { kind: 'block', type: 'ts_contains', inputs: { TEXT: txt('apple'), PART: txt('a') } },
          { kind: 'block', type: 'ts_case', inputs: { TEXT: txt('hello') } },
          { kind: 'block', type: 'ts_to_number', inputs: { VALUE: txt('42') } },
          { kind: 'block', type: 'ts_to_text', inputs: { VALUE: num(42) } },
          { kind: 'block', type: 'ts_list_split', inputs: { TEXT: txt('a,b,c'), SEP: txt(',') } },
        ],
      },
      { kind: 'category', name: tr('Variables'), categorystyle: 'variables', custom: 'TS_VARIABLES' },
      { kind: 'category', name: tr('Arrays'), categorystyle: 'lists', custom: 'TS_LISTS' },
      { kind: 'category', name: tr('Functions'), categorystyle: 'functions', custom: 'TS_FUNCTIONS' },
      {
        kind: 'category',
        name: tr('Objects'),
        categorystyle: 'types',
        contents: [
          { kind: 'label', text: tr('Describe what an object looks like:'), 'web-class': 'tbHint' } as never,
          { kind: 'block', type: 'ts_type', extraState: { count: 3, kind: 'type', exported: false }, fields: { NAME: 'Order', N0: 'item', T0: 'string', N1: 'count', T1: 'number', N2: 'paid', T2: 'boolean' } },
          { kind: 'label', text: tr('Make one:'), 'web-class': 'tbHint' } as never,
          {
            kind: 'block',
            type: 'ts_object',
            extraState: { count: 3 },
            fields: { K0: 'item', K1: 'count', K2: 'paid' },
            inputs: { V0: txt('bread'), V1: num(2), V2: { block: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } } },
          },
          { kind: 'label', text: tr('Read or change a property:'), 'web-class': 'tbHint' } as never,
          { kind: 'block', type: 'ts_prop', fields: { PROP: 'count' } },
          { kind: 'block', type: 'ts_prop_set', fields: { PROP: 'paid' }, inputs: { VALUE: { block: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } } },
          { kind: 'label', text: tr('Types:'), 'web-class': 'tbHint' } as never,
          { kind: 'block', type: 'ts_typeof', inputs: { VALUE: num(42) } },
          { kind: 'block', type: 'ts_is_type', inputs: { VALUE: txt('hi') } },
          { kind: 'block', type: 'ts_as' },
        ],
      },
      {
        kind: 'category',
        name: tr('Code'),
        categorystyle: 'code',
        contents: [
          { kind: 'block', type: 'ts_code_stmt' },
          { kind: 'block', type: 'ts_code_expr' },
          { kind: 'block', type: 'ts_for_raw' },
        ],
      },
    ],
  };
}
