/**
 * Blocks for the rest of everyday TypeScript (found in real school assignments):
 * calling any function or method, new, arrow functions, template text, try/catch,
 * do-while, a general for loop, Set/Map access, imports, union types ...
 *
 * Many of them have a growing list of slots (+ / -), like the array block.
 */
import * as Blockly from 'blockly';
import { tr } from '../i18n';
import { ICONS } from './blocks';
import { TypeDropdown, typeMenu, NO_TYPE } from './types';

// ------------------------------------------------------------------ an open dropdown

/** A dropdown with ready choices that also keeps any other value it is given (e.g. from a file). */
export class OpenDropdown extends Blockly.FieldDropdown {
  // (filled in after super(); Blockly asks for the menu already inside super())
  private extra!: string[];
  private choices!: [string, string][];
  /** onPick runs only when the user picks a choice in the menu (not when a file is loaded). */
  constructor(choices: [string, string][], value?: string, private onPick?: (field: OpenDropdown, value: string) => void) {
    super(function (this: OpenDropdown) {
      return OpenDropdown.prototype.menu.call(this, choices);
    } as unknown as Blockly.MenuGenerator);
    this.choices = choices;
    this.extra = [];
    if (value !== undefined) this.setValue(value);
  }
  private menu(choices = this.choices): Blockly.MenuOption[] {
    const base = choices.map(([label, v]) => [label, v] as Blockly.MenuOption);
    const known = new Set(choices.map(([, v]) => v));
    for (const e of this.extra ?? []) if (!known.has(e)) base.push([e, e]);
    return base;
  }
  protected override doClassValidation_(value?: string): string | null {
    if (typeof value !== 'string' || !value) return null;
    this.extra ??= [];
    if (!(this.choices ?? []).some(([, v]) => v === value) && !this.extra.includes(value)) this.extra.push(value);
    return value;
  }
  protected override onItemSelected_(menu: Blockly.Menu, item: Blockly.MenuItem): void {
    super.onItemSelected_(menu, item);
    this.onPick?.(this, String(this.getValue()));
  }
  /** The block shows just the name; the explanation is in the menu. */
  protected override getText_(): string | null {
    return String(this.getValue() ?? '');
  }
}

// ------------------------------------------------------------------ choices

/** Functions you call by name. Value -> [label, number of slots]. */
export const FUNCTIONS: [string, string, number][] = [
  ['Math.floor', 'Math.floor - round down', 1],
  ['Math.ceil', 'Math.ceil - round up', 1],
  ['Math.round', 'Math.round - round', 1],
  ['Math.trunc', 'Math.trunc - cut off the decimals', 1],
  ['Math.abs', 'Math.abs - distance from 0 (no minus)', 1],
  ['Math.sqrt', 'Math.sqrt - square root', 1],
  ['Math.pow', 'Math.pow - power (a to the b)', 2],
  ['Math.max', 'Math.max - the biggest', 2],
  ['Math.min', 'Math.min - the smallest', 2],
  ['Math.random', 'Math.random - random number 0 to 1', 0],
  ['parseInt', 'parseInt - text to a whole number', 1],
  ['parseFloat', 'parseFloat - text to a decimal number', 1],
  ['isNaN', 'isNaN - is it "not a number"?', 1],
  ['Number.isNaN', 'Number.isNaN - is it NaN?', 1],
  ['Number.isInteger', 'Number.isInteger - is it a whole number?', 1],
  ['String.fromCodePoint', 'String.fromCodePoint - code to a character', 1],
  ['String.fromCharCode', 'String.fromCharCode - code to a character', 1],
  ['Array.from', 'Array.from - make an array', 1],
  ['Array.isArray', 'Array.isArray - is it an array?', 1],
  ['Object.keys', 'Object.keys - list of the keys', 1],
  ['Object.values', 'Object.values - list of the values', 1],
  ['Object.entries', 'Object.entries - list of [key, value] pairs', 1],
  ['Object.fromEntries', 'Object.fromEntries - pairs to an object', 1],
  ['JSON.stringify', 'JSON.stringify - value to text', 1],
  ['JSON.parse', 'JSON.parse - text to a value', 1],
  ['console.error', 'console.error - print an error', 1],
  ['process.stdout.write', 'process.stdout.write - print without a new line', 1],
];

/** Methods you call on a value. */
export const METHODS: [string, string, number][] = [
  // text
  ['slice', '.slice(from, to) - cut out a part', 2],
  ['substring', '.substring(from, to) - cut out a part', 2],
  ['indexOf', '.indexOf(what) - where is it? (-1 = nowhere)', 1],
  ['lastIndexOf', '.lastIndexOf(what) - where is it, from the end', 1],
  ['includes', '.includes(what) - is it there?', 1],
  ['trim', '.trim() - remove spaces at both ends', 0],
  ['padStart', '.padStart(length, filler) - fill from the left', 2],
  ['padEnd', '.padEnd(length, filler) - fill from the right', 2],
  ['repeat', '.repeat(n) - repeat n times', 1],
  ['replace', '.replace(what, with) - replace the first one', 2],
  ['charAt', '.charAt(i) - character at position i', 1],
  ['charCodeAt', '.charCodeAt(i) - code of the character at i', 1],
  ['codePointAt', '.codePointAt(i) - code of the character at i', 1],
  ['split', '.split(separator) - cut into an array', 1],
  ['concat', '.concat(other) - join together', 1],
  ['toUpperCase', '.toUpperCase() - CAPITAL LETTERS', 0],
  ['toLowerCase', '.toLowerCase() - small letters', 0],
  ['normalize', '.normalize("NFD") - split letters and accents', 1],
  ['match', '.match(pattern) - find by a pattern', 1],
  ['test', '.test(text) - does the pattern match?', 1],
  ['toString', '.toString() - to text (toString(16) = hex)', 1],
  ['toFixed', '.toFixed(digits) - text with fixed decimals', 1],
  ['localeCompare', '.localeCompare(other) - compare texts for sorting', 1],
  // arrays
  ['join', '.join(separator) - array to text', 1],
  ['reverse', '.reverse() - turn around', 0],
  ['sort', '.sort(compare) - sort', 1],
  ['push', '.push(item) - add to the end', 1],
  ['pop', '.pop() - take the last one away', 0],
  ['shift', '.shift() - take the first one away', 0],
  ['unshift', '.unshift(item) - add to the start', 1],
  ['splice', '.splice(index, count) - remove from the middle', 2],
  ['fill', '.fill(value) - fill everything', 1],
  ['flat', '.flat() - flatten nested arrays', 0],
  ['map', '.map(function) - change every item', 1],
  ['filter', '.filter(function) - keep some items', 1],
  ['forEach', '.forEach(function) - do something with every item', 1],
  ['some', '.some(function) - is any item ...?', 1],
  ['every', '.every(function) - is every item ...?', 1],
  ['find', '.find(function) - find the first one', 1],
  ['reduce', '.reduce(function, start) - fold into one value', 2],
  // Set / Map
  ['add', '.add(value) - put into a Set', 1],
  ['has', '.has(value) - is it in the Set / Map?', 1],
  ['delete', '.delete(key) - remove', 1],
  ['get', '.get(key) - value for a key (Map)', 1],
  ['set', '.set(key, value) - store a value (Map)', 2],
  ['clear', '.clear() - remove everything', 0],
  ['keys', '.keys() - all keys', 0],
  ['values', '.values() - all values', 0],
  ['entries', '.entries() - all [key, value] pairs', 0],
  // Date
  ['getFullYear', '.getFullYear() - year', 0],
  ['getMonth', '.getMonth() - month (0 = January)', 0],
  ['getDate', '.getDate() - day of the month', 0],
  ['getDay', '.getDay() - day of the week (0 = Sunday)', 0],
  ['getTime', '.getTime() - milliseconds since 1970', 0],
];

export const CLASSES: [string, string, number][] = [
  ['Set', 'Set - each value only once', 1],
  ['Map', 'Map - key -> value', 0],
  ['Date', 'Date - date and time', 0],
  ['Error', 'Error - an error with a message', 1],
  ['Array', 'Array - an array of a length', 1],
  ['RegExp', 'RegExp - a pattern from text', 1],
];

export const GLOBALS: [string, string][] = [
  ['Math.PI', 'Math.PI - 3.14159...'],
  ['Number.MAX_SAFE_INTEGER', 'Number.MAX_SAFE_INTEGER - the biggest safe whole number'],
  ['Infinity', 'Infinity - infinitely big'],
  ['process.argv', 'process.argv - command line words'],
];

/** Our dropdowns as plain Blockly fields (their value type is a bit stricter). */
const field = (f: Blockly.FieldDropdown) => f as unknown as Blockly.Field;
const arity = (list: [string, string, number][]) => new Map(list.map(([v, , n]) => [v, n]));
const ARITY = { fn: arity(FUNCTIONS), method: arity(METHODS), cls: arity(CLASSES) };
const menu = (list: [string, string, ...unknown[]][]): [string, string][] => list.map(([v, label]) => [tr(label), v]);

// ------------------------------------------------------------------ blocks with a growing list of slots

type VarBlock = Blockly.BlockSvg & { count: number; min: number; updateShape(): void; resize(d: number): void; setCount(n: number): void };

interface VariadicCfg {
  style: string;
  output?: boolean;
  statement?: boolean;
  min?: number;
  start?: number;
  tooltip: string;
  /** builds the fixed front part (inputs before the slots) */
  head(b: Blockly.Block): void;
  /** text in front of slot i (default "," between slots) */
  slotLabel?(i: number): string;
  /** text after the last slot */
  tail?: string;
  /** extra state kept with the block */
  extraKeys?: string[];
}

function variadic(type: string, cfg: VariadicCfg): void {
  Blockly.Blocks[type] = {
    init(this: VarBlock) {
      this.min = cfg.min ?? 0;
      this.count = cfg.start ?? this.min;
      if (cfg.output) this.setOutput(true, null);
      if (cfg.statement) {
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
      this.setStyle(cfg.style);
      this.setInputsInline(true);
      this.setTooltip(tr(cfg.tooltip));
      cfg.head(this);
      this.updateShape();
    },
    saveExtraState(this: VarBlock) {
      return { count: this.count };
    },
    loadExtraState(this: VarBlock, s: { count?: number }) {
      this.count = Math.max(this.min ?? 0, s.count ?? 0);
      this.updateShape();
    },
    updateShape(this: VarBlock) {
      if (this.getInput('TAIL')) this.removeInput('TAIL');
      let i = 0;
      while (this.getInput('ARG' + i)) {
        if (i >= this.count) {
          this.getInputTargetBlock('ARG' + i)?.unplug(false);
          this.removeInput('ARG' + i);
        }
        i++;
      }
      for (let k = 0; k < this.count; k++) {
        if (this.getInput('ARG' + k)) continue;
        const input = this.appendValueInput('ARG' + k);
        const label = cfg.slotLabel ? cfg.slotLabel(k) : k ? ',' : '';
        if (label) input.appendField(label);
      }
      const tail = this.appendDummyInput('TAIL');
      if (cfg.tail) tail.appendField(cfg.tail);
      tail.appendField(new Blockly.FieldImage(ICONS.plus, 16, 16, tr('add a slot'), () => this.resize(1)));
      if (this.count > this.min) tail.appendField(new Blockly.FieldImage(ICONS.minus, 16, 16, tr('remove the last slot'), () => this.resize(-1)));
    },
    resize(this: VarBlock, d: number) {
      this.setCount(this.count + d);
    },
    setCount(this: VarBlock, n: number) {
      if (this.isInFlyout || this.isDeadOrDying()) return;
      const next = Math.max(this.min, n);
      if (next === this.count) return;
      const before = JSON.stringify({ count: this.count });
      Blockly.Events.setGroup(true);
      this.count = next;
      this.updateShape();
      Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(this, 'mutation', null, before, JSON.stringify({ count: this.count })));
      Blockly.Events.setGroup(false);
    },
  };
}

/** When a known function / method is picked, give it the right number of slots. */
function arityValidator(map: Map<string, number>) {
  return (field: OpenDropdown, v: string) => {
    const b = field.getSourceBlock() as VarBlock | null;
    const n = map.get(v);
    if (b && n !== undefined && !b.isInFlyout) b.setCount?.(n);
  };
}

// ------------------------------------------------------------------ definitions

export function defineMoreBlocks(): void {
  // console.log(a, b, c)
  variadic('ts_say_many', {
    style: 'console_blocks',
    statement: true,
    min: 0,
    start: 2,
    tooltip: 'Prints several values on one line, separated by spaces - e.g. a label and a number.',
    head(b) {
      b.appendDummyInput('HEAD')
        .appendField(tr('print'))
        .appendField(field(new OpenDropdown([[tr('log - normal'), 'log'], [tr('error - red error'), 'error'], [tr('warn - warning'), 'warn'], [tr('table - as a table'), 'table']], 'log')), 'FN');
    },
  });

  // `text ${value} text`
  type TplBlock = Blockly.BlockSvg & { count: number; updateShape(): void; resize(d: number): void };
  Blockly.Blocks['ts_template'] = {
    init(this: TplBlock) {
      this.count = 1;
      this.setOutput(true, 'String');
      this.setStyle('text_blocks');
      this.setInputsInline(true);
      this.setTooltip(tr('Text with values inside: `Hello ${name}!` - each slot is replaced by its value.'));
      this.appendDummyInput('HEAD').appendField('`').appendField(new Blockly.FieldTextInput(''), 'S0');
      this.updateShape();
    },
    saveExtraState(this: TplBlock) {
      return { count: this.count };
    },
    loadExtraState(this: TplBlock, s: { count?: number }) {
      this.count = s.count ?? 0;
      this.updateShape();
    },
    updateShape(this: TplBlock) {
      const keep = new Map<string, string>();
      for (const input of this.inputList) for (const f of input.fieldRow) if (f.name) keep.set(f.name, String(f.getValue()));
      if (this.getInput('TAIL')) this.removeInput('TAIL');
      let i = 0;
      while (this.getInput('V' + i)) {
        if (i >= this.count) {
          this.getInputTargetBlock('V' + i)?.unplug(false);
          this.removeInput('V' + i);
          this.removeInput('T' + i);
        }
        i++;
      }
      for (let k = 0; k < this.count; k++) {
        if (this.getInput('V' + k)) continue;
        this.appendValueInput('V' + k).appendField('${');
        this.appendDummyInput('T' + k).appendField('}').appendField(new Blockly.FieldTextInput(keep.get('S' + (k + 1)) ?? ''), 'S' + (k + 1));
      }
      const tail = this.appendDummyInput('TAIL').appendField('`');
      tail.appendField(new Blockly.FieldImage(ICONS.plus, 16, 16, tr('add a value'), () => this.resize(1)));
      if (this.count > 0) tail.appendField(new Blockly.FieldImage(ICONS.minus, 16, 16, tr('remove the last value'), () => this.resize(-1)));
    },
    resize(this: TplBlock, d: number) {
      if (this.isInFlyout || this.isDeadOrDying()) return;
      const before = JSON.stringify({ count: this.count });
      Blockly.Events.setGroup(true);
      this.count = Math.max(0, this.count + d);
      this.updateShape();
      Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(this, 'mutation', null, before, JSON.stringify({ count: this.count })));
      Blockly.Events.setGroup(false);
    },
  };

  // name(a, b)  - any function: Math.floor, parseFloat, a function from another file, a parameter ...
  for (const [type, output] of [['ts_call', true], ['ts_call_stmt', false]] as const) {
    variadic(type, {
      style: 'procedure_blocks',
      output,
      statement: !output,
      tooltip: 'Calls a function by its name: Math.floor, parseFloat, a function from another file ... The slots are what you give it.',
      head(b) {
        b.appendDummyInput('HEAD').appendField(field(new OpenDropdown(menu(FUNCTIONS), 'Math.floor', arityValidator(ARITY.fn))), 'NAME').appendField('(');
      },
      tail: ')',
    });
  }

  // value.method(a, b)
  for (const [type, output] of [['ts_method', true], ['ts_method_stmt', false]] as const) {
    variadic(type, {
      style: 'text_blocks',
      output,
      statement: !output,
      tooltip: 'Calls a method of a value: text.slice(0, 3), numbers.join(", "), set.has(x), map.get(key) ...',
      head(b) {
        b.appendValueInput('OBJ');
        b.appendDummyInput('HEAD').appendField('.').appendField(field(new OpenDropdown(menu(METHODS), 'slice', arityValidator(ARITY.method))), 'METHOD').appendField('(');
      },
      tail: ')',
    });
  }

  // new Set(...), new Map(), new Date() ...
  variadic('ts_new', {
    style: 'type_blocks',
    output: true,
    tooltip: 'Makes a new object of a kind: new Set(array), new Map(), new Date(), new Error("message").',
    head(b) {
      b.appendDummyInput('HEAD').appendField('new').appendField(field(new OpenDropdown(menu(CLASSES), 'Set', arityValidator(ARITY.cls))), 'CLASS').appendField('(');
    },
    tail: ')',
  });

  // (a, b) => value
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'ts_arrow',
      message0: '( %1 ) => %2',
      args0: [{ type: 'field_input', name: 'PARAMS', text: 'x' }, { type: 'input_value', name: 'VALUE' }],
      inputsInline: true,
      output: null,
      style: 'procedure_blocks',
      tooltip: tr('A small function without a name: (x) => x * 2. Give it to map, filter, sort or your own function.'),
    },
    {
      type: 'ts_arrow_block',
      message0: '( %1 ) => {',
      args0: [{ type: 'field_input', name: 'PARAMS', text: 'x' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: '}',
      output: null,
      style: 'procedure_blocks',
      tooltip: tr('A function without a name that does several steps. Use "return" inside to give back a value.'),
    },
    {
      type: 'ts_index',
      message0: '%1 [ %2 ]',
      args0: [{ type: 'input_value', name: 'OBJ' }, { type: 'input_value', name: 'KEY' }],
      inputsInline: true,
      output: null,
      style: 'list_blocks',
      tooltip: tr('The value at a position or key: scores["Ema"], letters[i].'),
    },
    {
      type: 'ts_set_any',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'TARGET' },
        { type: 'field_dropdown', name: 'OP', options: [['=', '='], ['+=', '+='], ['-=', '-='], ['*=', '*='], ['/=', '/='], ['%=', '%='], ['++', '++'], ['--', '--'], ['??=', '??=']] },
        { type: 'input_value', name: 'VALUE' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'variable_blocks',
      tooltip: tr('Changes a value: a variable, a property (order.count) or a position (counts[letter]). += adds, ++ adds 1.'),
    },
    {
      type: 'ts_try',
      message0: tr('try'),
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'TRY' }],
      message2: tr('if it fails (error %1)'),
      args2: [{ type: 'field_variable', name: 'VAR', variable: 'e' }],
      message3: '%1',
      args3: [{ type: 'input_statement', name: 'CATCH' }],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: tr('Tries the top part. If something in it throws an error, the program does not crash - the bottom part runs instead.'),
    },
    {
      type: 'ts_throw',
      message0: tr('throw error %1'),
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      style: 'control_blocks',
      tooltip: tr('Stops with an error, e.g. new Error("Wrong letter"). A "try" block around it can catch it.'),
    },
    {
      type: 'ts_do_while',
      message0: tr('do'),
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: tr('and repeat while %1'),
      args2: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip: tr('Does the inside at least once, then again while the condition is true - good for asking until the answer is right.'),
    },
    {
      type: 'ts_for',
      message0: tr('for %1 from %2 while it is %3 %4 step %5'),
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'i' },
        { type: 'input_value', name: 'FROM' },
        { type: 'field_dropdown', name: 'OP', options: [['<', '<'], ['≤', '<='], ['>', '>'], ['≥', '>=']] },
        { type: 'input_value', name: 'TO' },
        { type: 'field_dropdown', name: 'STEP', options: [['++ (+1)', '++'], ['-- (-1)', '--']] },
      ],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip: tr('The classic for loop: start i at a value, repeat while the condition holds, add (or take) 1 each time. i < list.length goes through all positions.'),
    },
    {
      type: 'ts_foreach_pair',
      message0: tr('for each [ %1 , %2 ] in %3'),
      args0: [{ type: 'field_variable', name: 'K', variable: 'key' }, { type: 'field_variable', name: 'V', variable: 'value' }, { type: 'input_value', name: 'LIST' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip: tr('Goes through pairs: every key and value of a Map, or Object.entries(...).'),
    },
    {
      type: 'ts_literal',
      message0: '%1',
      args0: [{ type: 'field_dropdown', name: 'VALUE', options: [[tr('undefined (nothing)'), 'undefined'], [tr('null (empty on purpose)'), 'null'], [tr('NaN (not a number)'), 'NaN'], [tr('this (this object)'), 'this']] }],
      output: null,
      style: 'logic_blocks',
      tooltip: tr('Special values: undefined = nothing there, null = empty on purpose, NaN = not a number, this = the object the method belongs to.'),
    },
    {
      type: 'ts_global',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'Math.PI' }],
      output: null,
      style: 'math_blocks',
      tooltip: tr('A ready-made value: Math.PI, process.argv ...'),
      extensions: ['tb_global_dropdown'],
    },
    {
      type: 'ts_neg',
      message0: '- %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: 'Number',
      style: 'math_blocks',
      tooltip: tr('The negative value: -x.'),
    },
    {
      type: 'ts_regex',
      message0: '/ %1 / %2',
      args0: [{ type: 'field_input', name: 'PATTERN', text: '[a-z]+' }, { type: 'field_input', name: 'FLAGS', text: 'g' }],
      output: null,
      style: 'text_blocks',
      tooltip: tr('A pattern for text (regular expression), e.g. /\\d{3}/ = three digits. Flags: g = all, i = ignore case.'),
    },
    {
      type: 'ts_spread',
      message0: '... %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: null,
      style: 'list_blocks',
      tooltip: tr('Spreads out all items: [...set] makes an array, Math.max(...numbers) gives every number.'),
    },
    {
      type: 'ts_await',
      message0: tr('wait for %1'),
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: null,
      style: 'procedure_blocks',
      tooltip: tr('await: waits until the value is ready (e.g. an answer).'),
    },
    {
      type: 'ts_import',
      message0: tr('import %1 from %2'),
      args0: [{ type: 'field_input', name: 'WHAT', text: '{ askNumber }' }, { type: 'field_input', name: 'FROM', text: './libs/inputs' }],
      previousStatement: null,
      nextStatement: null,
      style: 'code_blocks',
      tooltip: tr('Uses functions from another file, e.g. { askNumber, askString } from "./libs/inputs".'),
    },
    {
      type: 'ts_type_alias',
      message0: tr('type %1 = %2'),
      args0: [{ type: 'field_input', name: 'NAME', text: 'Score' }, { type: 'field_input', name: 'TYPE', text: 'number' }],
      previousStatement: null,
      nextStatement: null,
      style: 'type_blocks',
      tooltip: tr('Gives a type a new name.'),
      extensions: ['tb_alias_dropdown'],
    },
  ]);

  // the global value and the alias type are picked from lists, any value from a file is kept
  if (!Blockly.Extensions.isRegistered('tb_global_dropdown'))
    Blockly.Extensions.register('tb_global_dropdown', function (this: Blockly.Block) {
      swapField(this, 'NAME', (v) => new OpenDropdown(GLOBALS.map(([g, l]) => [tr(l), g]), v));
    });
  if (!Blockly.Extensions.isRegistered('tb_alias_dropdown'))
    Blockly.Extensions.register('tb_alias_dropdown', function (this: Blockly.Block) {
      swapField(this, 'TYPE', (v) => {
        const f = new TypeDropdown(typeMenu(false));
        f.setValue(v === NO_TYPE ? 'number' : v);
        return f;
      });
    });

  // type Gender = "male" | "female" | "other"
  variadic('ts_type_union', {
    style: 'type_blocks',
    statement: true,
    min: 1,
    start: 2,
    tooltip: 'A type that allows only some exact values, e.g. "male" | "female" | "other". TypeScript then checks you never use anything else.',
    head(b) {
      b.appendDummyInput('HEAD').appendField('type').appendField(new Blockly.FieldTextInput('Answer'), 'NAME').appendField('=');
    },
    slotLabel: (i) => (i ? '|' : ''),
  });
}

function swapField(block: Blockly.Block, name: string, make: (value: string) => Blockly.Field) {
  for (const input of block.inputList) {
    const i = input.fieldRow.findIndex((f) => f.name === name);
    if (i < 0) continue;
    const old = String(input.fieldRow[i].getValue() ?? '');
    input.removeField(name);
    input.insertFieldAt(i, make(old) as unknown as Blockly.Field, name);
    return;
  }
}
