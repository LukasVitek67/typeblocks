import * as Blockly from 'blockly';
import { javascriptGenerator, JavascriptGenerator, Order } from 'blockly/javascript';

const RESERVED =
  'break,case,catch,class,const,continue,debugger,default,delete,do,else,enum,export,extends,false,finally,for,function,if,import,in,instanceof,new,null,return,super,switch,this,throw,true,try,typeof,var,void,while,with,yield,let,static,implements,interface,package,private,protected,public,await,async,of,as,any,boolean,number,string,symbol,type,unknown,never,object,declare,namespace,module,readonly,keyof,infer,is,' +
  'console,process,Math,String,Number,Boolean,Array,Object,JSON,Date,Promise,Symbol,Error,Map,Set,RegExp,Buffer,require,exports,globalThis,undefined,NaN,Infinity,setTimeout,setInterval,clearTimeout,clearInterval,arguments,eval,' +
  'sleep,ask,readline,sayColored';

const HATS = new Set(['ts_on_start', 'ts_every']);

// Special precedence values for the two sides of + - * / % ** (see ts_arith).
const ADD_LEFT = 6.21 as Order;
const ADD_RIGHT = 6.09 as Order;
const MUL_LEFT = 5.31 as Order;
const MUL_RIGHT = 5.09 as Order;
const POW_LEFT = 5.01 as Order;
const POW_RIGHT = 5.02 as Order;
const AWAITING = new Set(['ts_wait', 'ts_ask', 'ts_ask_number']);
const DEFS = ['procedures_defnoreturn', 'procedures_defreturn'];
const MARK = '\u0001%1\u0001\n';
/** Put in front of a comment that belongs at the end of the previous code line. */
const SAME_LINE = '\u0002';
const ANSI: Record<string, number> = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36 };

interface Meta {
  same?: boolean;
  nospace?: boolean;
  ptype?: string;
  atype?: string;
  noInit?: boolean;
  blank?: boolean;
  incr?: boolean;
  kind?: string;
  async?: boolean;
  exported?: boolean;
  ret?: string;
  types?: string[];
  bare?: boolean;
  noVar?: boolean;
  hasFinally?: boolean;
}

export function meta(block: Blockly.Block): Meta {
  try {
    return block.data ? (JSON.parse(block.data) as Meta) : {};
  } catch {
    return {};
  }
}

export function setMeta(block: Blockly.Block, patch: Meta): void {
  const m = { ...meta(block), ...patch };
  block.data = JSON.stringify(m);
}

export function safeName(name: string): string {
  let n = name.trim().replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/[^\w$]/g, '_');
  if (!n) n = 'unnamed';
  if (/^\d/.test(n)) n = '_' + n;
  return n;
}

export class TsGenerator extends JavascriptGenerator {
  /** Is @types/node available next to the .ts file? If not, declare what we use. */
  nodeTypes = true;
  usesProcess = false;
  usesRequire = false;
  asyncFns = new Set<string>();
  private helpers: Record<string, string> = {};

  /** false = plain JavaScript without types (used by the guide to run examples in the browser) */
  typed = true;
  /** false = leave out the ask/sleep/sayColored helpers (the guide provides its own) */
  emitHelpers = true;

  /** In the browser (no helpers written) "wait" and "ask" are async; in a real file they are plain calls. */
  get helpersWait(): boolean {
    return !this.emitHelpers;
  }

  constructor() {
    super('TypeScript');
    Object.assign(this.forBlock, javascriptGenerator.forBlock, OVERRIDES);
    // Parentheses for math: which inner operations need none on the left / right side.
    this.ORDER_OVERRIDES.push(
      [ADD_LEFT, Order.ADDITION],
      [ADD_LEFT, Order.SUBTRACTION],
      [MUL_LEFT, Order.MULTIPLICATION],
      [MUL_LEFT, Order.DIVISION],
      [MUL_LEFT, Order.MODULUS],
      [MUL_LEFT, Order.EXPONENTIATION],
      [MUL_RIGHT, Order.EXPONENTIATION],
      [POW_RIGHT, Order.EXPONENTIATION],
      // const f = (x) => x * 2  needs no ( ) around the arrow function
      [Order.ASSIGNMENT, Order.ASSIGNMENT],
    );
    // Browser globals (name, status, ...) are fine in a Node program, so use our own list.
    this.RESERVED_WORDS_ = '';
    this.addReservedWords(RESERVED);
  }

  private ws?: Blockly.Workspace;

  override init(ws: Blockly.Workspace): void {
    this.ws = ws;
    super.init(ws);
    delete this.definitions_['variables']; // variables are declared by "let" blocks
    this.usesProcess = false;
    this.usesRequire = false;
    this.helpers = {};
    this.asyncFns = computeAsync(ws, this.helpersWait);
  }

  /** Variables keep exactly the name they have in the code. */
  override getVariableName(id: string): string {
    const v = this.ws?.getVariableMap().getVariableById(id) ?? null;
    return v ? safeName(v.getName()) : super.getVariableName(id);
  }

  override getProcedureName(name: string): string {
    return safeName(name);
  }

  /** "double" or 'single' quotes, whatever the file already uses. */
  quoteStyle: 'single' | 'double' = 'double';

  override quote_(text: string): string {
    if (this.quoteStyle === 'double') return JSON.stringify(text);
    return "'" + JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";
  }

  override workspaceToCode(ws?: Blockly.Workspace): string {
    if (!ws) return '';
    this.init(ws);
    const parts: string[] = [];
    let prevComments = false;
    for (const block of ws.getTopBlocks(true)) {
      if (block.outputConnection) continue; // a loose value block is just lying around
      let line = this.blockToCode(block);
      if (Array.isArray(line)) line = line[0];
      if (!line) continue;
      if (parts.length && (!prevComments || meta(block).blank)) parts.push('\n');
      parts.push(line);
      prevComments = onlyComments(block);
    }
    return this.finish(parts.join(''))
      .replace(/^\s+\n/, '')
      .replace(/\n\s+$/, '\n')
      .replace(/[ \t]+\n/g, '\n');
  }

  override finish(code: string): string {
    super.finish('');
    const out = [code.trimEnd()];
    // helpers are written with 2 spaces; use the file's own indentation
    const helperCode = (this.emitHelpers ? Object.values(this.helpers) : []).map((h) => h.replace(/^((?:  )+)/gm, (m) => this.INDENT.repeat(m.length / 2)));
    if (helperCode.length) {
      const shim: string[] = [];
      if (!this.nodeTypes && this.usesProcess) shim.push('declare const process: any;');
      if (!this.nodeTypes && this.usesRequire) shim.push('declare function require(name: string): any;');
      out.push('// ---- TypeBlocks helpers (used by the blocks above) ----\n' + [shim.join('\n'), ...helperCode].filter(Boolean).join('\n\n'));
    } else if (!this.nodeTypes && this.usesProcess) {
      out.push('declare const process: any;');
    }
    return out.filter(Boolean).join('\n\n') + '\n';
  }

  override scrub_(block: Blockly.Block, code: string, thisOnly = false): string {
    const prev = block.previousConnection?.targetBlock();
    if (meta(block).blank && prev && prev.getNextBlock() === block) code = '\n' + code;
    return super.scrub_(block, code, thisOnly || HATS.has(block.type));
  }

  /** Statement marker used to map blocks -> lines. */
  mark(block: Blockly.Block): string {
    return this.STATEMENT_PREFIX ? this.injectId(this.STATEMENT_PREFIX, block) : '';
  }

  /** "wait": pause(seconds) stops the program for a while - a plain call, no await needed (works in CommonJS and ES modules). */
  helperSleep(): string {
    if (this.helpersWait) return 'sleep'; // the browser gives its own async sleep
    this.helpers['pause'] =
      'function pause(seconds: number): void {\n' +
      '  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);\n' +
      '}';
    return 'pause';
  }

  /** "ask": ask(question) waits for a line typed in the console and gives it back - a plain call, like askString in school projects. */
  helperAsk(): string {
    if (this.helpersWait) return 'ask'; // the browser gives its own async ask
    this.usesProcess = true;
    if (!this.nodeTypes) this.usesRequire = true;
    this.helpers['ask'] =
      'function ask(question: string): string {\n' +
      '  // works both in CommonJS (require) and in ES modules (getBuiltinModule)\n' +
      '  const load = (name: string) => (typeof require === "function" ? require(name) : (process as any).getBuiltinModule(name));\n' +
      '  const fs = load("node:fs");\n' +
      '  process.stdout.write(question + " ");\n' +
      '  const bytes: number[] = [];\n' +
      '  const one = new Uint8Array(1);\n' +
      '  for (;;) {\n' +
      '    let n = 0;\n' +
      '    try {\n' +
      '      n = fs.readSync(0, one, 0, 1, null);\n' +
      '    } catch (e) {\n' +
      '      const code = (e as { code?: string }).code;\n' +
      '      if (code === "EAGAIN") {\n' +
      '        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);\n' +
      '        continue;\n' +
      '      }\n' +
      '      if (code === "EOF") break;\n' +
      '      throw e;\n' +
      '    }\n' +
      '    if (n === 0 || one[0] === 10) break;\n' +
      '    if (one[0] !== 13) bytes.push(one[0]);\n' +
      '  }\n' +
      '  return load("node:buffer").Buffer.from(bytes).toString("utf8");\n' +
      '}';
    return 'ask';
  }

  helperColor(): string {
    this.helpers['color'] =
      'function sayColored(value: unknown, color: number): void {\n' + '  console.log(`\\x1b[${color}m${String(value)}\\x1b[0m`);\n}';
    return 'sayColored';
  }

  varName(block: Blockly.Block, field: string): string {
    return this.getVariableName(block.getFieldValue(field));
  }
}

function onlyComments(block: Blockly.Block): boolean {
  for (let b: Blockly.Block | null = block; b; b = b.getNextBlock()) {
    const code = b.type === 'ts_code_stmt' ? ((b as unknown as { code: string }).code ?? '').trim() : '';
    const isBlockComment = code.startsWith('/*') && code.endsWith('*/') && !code.slice(2, -2).includes('*/');
    if (b.type !== 'ts_comment' && !isBlockComment) return false;
  }
  return true;
}

const FUNCTION_LIKE = new Set(['ts_arrow', 'ts_arrow_block', ...DEFS]);

/** What decides whether code has to wait: the async functions, and whether "wait" / "ask" blocks wait. */
export interface WaitCtx {
  asyncFns: Set<string>;
  /** true only in the browser (guide, help window): there "wait" and "ask" must await. In a real file they are plain calls. */
  helpersWait: boolean;
}

/** Does this block (or something in it) wait - await, call an async function (in the browser also wait / ask)? Not counting inner functions. */
export function waits(block: Blockly.Block, ctx: WaitCtx): boolean {
  if (block.type === 'ts_await' || (ctx.helpersWait && AWAITING.has(block.type))) return true;
  if (block.type.startsWith('procedures_call') && ctx.asyncFns.has(block.getFieldValue('NAME'))) return true;
  if ((block.type === 'ts_code_stmt' || block.type === 'ts_code_expr') && /\bawait\b/.test(String((block as unknown as { code?: string }).code ?? block.getFieldValue('CODE') ?? ''))) return true;
  for (const input of block.inputList) {
    const child = input.connection?.targetBlock();
    if (!child || FUNCTION_LIKE.has(child.type)) continue;
    // methods of an object are functions of their own
    if (block.type === 'ts_object' && input.type === Blockly.inputs.inputTypes.STATEMENT) continue;
    if (chainWaits(child, ctx)) return true;
  }
  return false;
}

export function chainWaits(block: Blockly.Block | null, ctx: WaitCtx): boolean {
  for (let b: Blockly.Block | null = block; b; b = b.getNextBlock()) if (waits(b, ctx)) return true;
  return false;
}

/** Which functions must be `async`: only those that really await (or call such a function). */
export function computeAsync(ws: Blockly.Workspace, helpersWait = false): Set<string> {
  const defs = DEFS.flatMap((t) => ws.getBlocksByType(t, false));
  const set = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of defs) {
      const name = d.getFieldValue('NAME');
      if (set.has(name)) continue;
      const body = d.getInputTargetBlock('STACK');
      const ret = d.getInputTargetBlock('RETURN');
      const ctx = { asyncFns: set, helpersWait };
      const needs = chainWaits(body, ctx) || (!!ret && chainWaits(ret, ctx));
      if (needs) {
        set.add(name);
        changed = true;
      }
    }
  }
  return set;
}

type Gen = (block: Blockly.Block, g: TsGenerator) => string | [string, Order] | null;
const G = (fn: Gen) => fn as unknown as (block: Blockly.Block, g: Blockly.CodeGenerator) => string | [string, number] | null;
const val = (g: TsGenerator, b: Blockly.Block, name: string, order: Order, fallback: string) => g.valueToCode(b, name, order) || fallback;

const ARITH_ORDER: Record<string, Order> = {
  '+': Order.ADDITION,
  '-': Order.SUBTRACTION,
  '*': Order.MULTIPLICATION,
  '/': Order.DIVISION,
  '%': Order.MODULUS,
  '**': Order.EXPONENTIATION,
};

function chainBody(block: Blockly.Block, g: TsGenerator): string {
  const next = block.getNextBlock();
  return next ? g.prefixLines(g.blockToCode(next) as string, g.INDENT) : '';
}

const OVERRIDES: Record<string, ReturnType<typeof G>> = {
  // ---------- Events ----------
  ts_on_start: G((block, g) => {
    const fn = g.nameDB_!.getDistinctName('main', Blockly.Names.NameType.PROCEDURE);
    const isAsync = chainWaits(block.getNextBlock(), g);
    const ret = g.typed ? (isAsync ? ': Promise<void>' : ': void') : '';
    return `${isAsync ? 'async ' : ''}function ${fn}()${ret} {\n${chainBody(block, g)}}\n${fn}();\n`;
  }),
  ts_every: G((block, g) => {
    const secs = val(g, block, 'SECS', Order.MULTIPLICATION, '1');
    return `setInterval(${chainWaits(block.getNextBlock(), g) ? 'async ' : ''}() => {\n${chainBody(block, g)}}, ${secs} * 1000);\n`;
  }),

  // ---------- Control ----------
  ts_wait: G((block, g) => `${g.helpersWait ? 'await ' : ''}${g.helperSleep()}(${val(g, block, 'SECS', Order.NONE, '1')});\n`),
  ts_repeat: G((block, g) => {
    const times = val(g, block, 'TIMES', Order.RELATIONAL, '0');
    const i = g.nameDB_!.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
    return `for (let ${i} = 0; ${i} < ${times}; ${i}++) {\n${g.statementToCode(block, 'DO')}}\n`;
  }),
  ts_count: G((block, g) => {
    const v = g.varName(block, 'VAR');
    return `for (let ${v} = ${val(g, block, 'FROM', Order.ASSIGNMENT, '0')}; ${v} <= ${val(g, block, 'TO', Order.RELATIONAL, '0')}; ${v}++) {\n${g.statementToCode(block, 'DO')}}\n`;
  }),
  ts_forever: G((block, g) => `while (true) {\n${g.statementToCode(block, 'DO')}}\n`),
  ts_for_raw: G((block, g) => `for (${String(block.getFieldValue('HEAD') ?? '').trim()}) {\n${g.statementToCode(block, 'DO')}}\n`),
  ts_return: G((block, g) => {
    const v = g.valueToCode(block, 'VALUE', Order.NONE);
    return v ? `return ${v};\n` : 'return;\n';
  }),
  ts_stop: G((_, g) => {
    g.usesProcess = true;
    return 'process.exit(0);\n';
  }),
  ts_foreach: G((block, g) => {
    const kind = meta(block).kind === 'let' ? 'let' : 'const';
    return `for (${kind} ${g.varName(block, 'VAR')} of ${val(g, block, 'LIST', Order.NONE, '[]')}) {\n${g.statementToCode(block, 'DO')}}\n`;
  }),

  // ---------- Console ----------
  ts_say: G((block, g) => `console.log(${val(g, block, 'TEXT', Order.NONE, '""')});\n`),
  ts_say_color: G((block, g) => `${g.helperColor()}(${val(g, block, 'TEXT', Order.NONE, '""')}, ${ANSI[block.getFieldValue('COLOR')] ?? 0});\n`),
  ts_ask: G((block, g) =>
    g.helpersWait
      ? [`await ${g.helperAsk()}(${val(g, block, 'TEXT', Order.NONE, '""')})`, Order.AWAIT]
      : [`${g.helperAsk()}(${val(g, block, 'TEXT', Order.NONE, '""')})`, Order.FUNCTION_CALL],
  ),
  ts_ask_number: G((block, g) => [`Number(${g.helpersWait ? 'await ' : ''}${g.helperAsk()}(${val(g, block, 'TEXT', Order.NONE, '""')}))`, Order.FUNCTION_CALL]),
  ts_comment: G((block) => {
    const m = meta(block);
    const text = `//${m.nospace ? '' : ' '}${String(block.getFieldValue('TEXT') ?? '')}`.trimEnd();
    return (m.same ? SAME_LINE : '') + text + '\n';
  }),

  // ---------- Variables ----------
  ts_let: G((block, g) => {
    const raw = String(block.getFieldValue('TYPE') ?? '').trim();
    const type = g.typed && raw !== '-' ? raw : '';
    const v = g.valueToCode(block, 'VALUE', Order.ASSIGNMENT);
    const exp = meta(block).exported && g.typed ? 'export ' : '';
    return `${exp}${block.getFieldValue('KIND')} ${g.varName(block, 'VAR')}${type ? ': ' + type : ''}${v ? ' = ' + v : ''};\n`;
  }),
  variables_set: G((block, g) => `${g.varName(block, 'VAR')} = ${val(g, block, 'VALUE', Order.ASSIGNMENT, 'undefined')};\n`),
  math_change: G((block, g) => {
    const name = g.varName(block, 'VAR');
    const delta = val(g, block, 'DELTA', Order.ASSIGNMENT, '1');
    if (meta(block).incr && (delta === '1' || delta === '-1')) return `${name}${delta === '1' ? '++' : '--'};\n`;
    return /^-[\d.]+$/.test(delta) ? `${name} -= ${delta.slice(1)};\n` : `${name} += ${delta};\n`;
  }),

  // ---------- Operators ----------
  ts_arith: G((block, g) => {
    const op = block.getFieldValue('OP') as string;
    const order = ARITH_ORDER[op] ?? Order.ADDITION;
    // Parentheses exactly where they change the meaning:
    //   "Age: " + (age + 10)  keeps its ( ), because without them + would join text.
    //   (a + b) + c and a * b / c need none.
    // (Blockly compares precedence by whole numbers; the special orders below have
    //  their own exceptions in ORDER_OVERRIDES, see the constructor.)
    let left: number;
    let right: number;
    if (op === '+' || op === '-') {
      left = ADD_LEFT; // a + b - c
      right = ADD_RIGHT; // a - (b + c)
    } else if (op === '**') {
      left = POW_LEFT; // (a ** b) ** c
      right = POW_RIGHT; // a ** b ** c
    } else {
      left = MUL_LEFT; // a * b / c
      right = MUL_RIGHT; // a / (b * c)
    }
    const a = val(g, block, 'A', left, '0');
    const b = val(g, block, 'B', right, '0');
    return [`${a} ${op} ${b}`, order];
  }),
  ts_compare: G((block, g) => {
    const op = block.getFieldValue('OP') as string;
    const order = op.includes('=') && !op.startsWith('<') && !op.startsWith('>') ? Order.EQUALITY : Order.RELATIONAL;
    return [`${val(g, block, 'A', order, '0')} ${op} ${val(g, block, 'B', order, '0')}`, order];
  }),
  ts_logic: G((block, g) => {
    const op = block.getFieldValue('OP') as string;
    const order = op === '&&' ? Order.LOGICAL_AND : Order.LOGICAL_OR;
    return [`${val(g, block, 'A', order, 'false')} ${op} ${val(g, block, 'B', order, 'false')}`, order];
  }),
  ts_not: G((block, g) => [`!${val(g, block, 'A', Order.LOGICAL_NOT, 'false')}`, Order.LOGICAL_NOT]),
  ts_random: G((block, g) => {
    const a = val(g, block, 'FROM', Order.ADDITION, '0');
    const a2 = val(g, block, 'FROM', Order.SUBTRACTION, '0');
    const b = val(g, block, 'TO', Order.SUBTRACTION, '0');
    return [`Math.floor(Math.random() * (${b} - ${a2} + 1)) + ${a}`, Order.ADDITION];
  }),

  // ---------- Text ----------
  ts_contains: G((block, g) => [`${val(g, block, 'TEXT', Order.MEMBER, '""')}.includes(${val(g, block, 'PART', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_starts: G((block, g) => [`${val(g, block, 'TEXT', Order.MEMBER, '""')}.${block.getFieldValue('HOW')}(${val(g, block, 'PART', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_length: G((block, g) => [`${val(g, block, 'VALUE', Order.MEMBER, '""')}.length`, Order.MEMBER]),
  ts_to_number: G((block, g) => [`Number(${val(g, block, 'VALUE', Order.NONE, '0')})`, Order.FUNCTION_CALL]),
  ts_to_text: G((block, g) => [`String(${val(g, block, 'VALUE', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_case: G((block, g) => [`${val(g, block, 'TEXT', Order.MEMBER, '""')}.${block.getFieldValue('CASE')}()`, Order.FUNCTION_CALL]),

  // ---------- Arrays ----------
  ts_list_literal: G((block, g) => {
    const n = (block as unknown as { itemCount: number }).itemCount ?? 0;
    const items = Array.from({ length: n }, (_, i) => val(g, block, 'ITEM' + i, Order.COMMA, 'undefined'));
    const one = `[${items.join(', ')}]`;
    // a long array (e.g. of objects) gets one item per line
    if (one.length <= 80 && !one.includes('\n')) return [one, Order.ATOMIC];
    return [`[\n${items.map((it) => g.prefixLines(it, g.INDENT) + ',').join('\n')}\n]`, Order.ATOMIC];
  }),
  ts_list_add: G((block, g) => `${g.varName(block, 'LIST')}.push(${val(g, block, 'ITEM', Order.NONE, '""')});\n`),
  ts_list_add_front: G((block, g) => `${g.varName(block, 'LIST')}.unshift(${val(g, block, 'ITEM', Order.NONE, '""')});\n`),
  ts_list_insert: G((block, g) => `${g.varName(block, 'LIST')}.splice(${val(g, block, 'INDEX', Order.NONE, '0')}, 0, ${val(g, block, 'ITEM', Order.NONE, '""')});\n`),
  ts_list_remove: G((block, g) => `${g.varName(block, 'LIST')}.splice(${val(g, block, 'INDEX', Order.NONE, '0')}, 1);\n`),
  ts_list_pop: G((block, g) => `${g.varName(block, 'LIST')}.${block.getFieldValue('END')}();\n`),
  ts_list_replace: G((block, g) => `${g.varName(block, 'LIST')}[${val(g, block, 'INDEX', Order.NONE, '0')}] = ${val(g, block, 'ITEM', Order.ASSIGNMENT, '""')};\n`),
  ts_list_sort: G((block, g) => `${g.varName(block, 'LIST')}.${block.getFieldValue('HOW')}();\n`),
  ts_list_item: G((block, g) => [`${g.varName(block, 'LIST')}[${val(g, block, 'INDEX', Order.NONE, '0')}]`, Order.MEMBER]),
  ts_list_last: G((block, g) => {
    const l = g.varName(block, 'LIST');
    return [`${l}[${l}.length - 1]`, Order.MEMBER];
  }),
  ts_list_length: G((block, g) => [`${g.varName(block, 'LIST')}.length`, Order.MEMBER]),
  ts_list_contains: G((block, g) => [`${g.varName(block, 'LIST')}.includes(${val(g, block, 'ITEM', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_list_indexof: G((block, g) => [`${g.varName(block, 'LIST')}.indexOf(${val(g, block, 'ITEM', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_list_join: G((block, g) => [`${g.varName(block, 'LIST')}.join(${val(g, block, 'SEP', Order.NONE, '", "')})`, Order.FUNCTION_CALL]),
  ts_list_split: G((block, g) => [`${val(g, block, 'TEXT', Order.MEMBER, '""')}.split(${val(g, block, 'SEP', Order.NONE, '","')})`, Order.FUNCTION_CALL]),

  // ---------- Arrays: map / filter / some / every / find / reduce / forEach ----------
  ts_arr_map: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_filter: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_some: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_every: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_find: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_findindex: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_reduce: G((block, g) => [chain(g, block), Order.FUNCTION_CALL]),
  ts_arr_foreach: G((block, g) => chain(g, block) + ';\n'),

  // ---------- Objects ----------
  ts_prop: G((block, g) => [`${val(g, block, 'OBJ', Order.MEMBER, '{}')}.${propName(block.getFieldValue('PROP'))}`, Order.MEMBER]),
  ts_prop_set: G((block, g) => `${val(g, block, 'OBJ', Order.MEMBER, '{}')}.${propName(block.getFieldValue('PROP'))} = ${val(g, block, 'VALUE', Order.ASSIGNMENT, 'undefined')};\n`),
  ts_object: G((block, g) => {
    const n = (block as unknown as { count: number }).count ?? 0;
    const entries = Array.from({ length: n }, (_, i) => `${keyName(block.getFieldValue('K' + i))}: ${val(g, block, 'V' + i, Order.COMMA, 'undefined')}`);
    if (!entries.length) return ['{}', Order.ATOMIC];
    const one = `{ ${entries.join(', ')} }`;
    if (one.length <= 80 && !one.includes('\n')) return [one, Order.ATOMIC];
    return [`{\n${entries.map((e) => g.prefixLines(e, g.INDENT) + ',').join('\n')}\n}`, Order.ATOMIC];
  }),
  ts_type: G((block, g) => {
    const b = block as unknown as { count: number; kind: string; exported: boolean };
    if (!g.typed) return '';
    const rows = Array.from({ length: b.count ?? 0 }, (_, i) => `${g.INDENT}${String(block.getFieldValue('N' + i) ?? '').trim()}: ${String(block.getFieldValue('T' + i) ?? 'any').trim() || 'any'};`);
    const name = safeName(String(block.getFieldValue('NAME') ?? 'Thing'));
    const exp = b.exported ? 'export ' : '';
    const body = rows.length ? `{\n${rows.join('\n')}\n}` : '{}';
    return b.kind === 'interface' ? `${exp}interface ${name} ${body}\n` : `${exp}type ${name} = ${body};\n`;
  }),

  // ---------- Types ----------
  ts_typeof: G((block, g) => [`typeof ${val(g, block, 'VALUE', Order.TYPEOF, 'undefined')}`, Order.TYPEOF]),
  ts_is_type: G((block, g) => [`typeof ${val(g, block, 'VALUE', Order.TYPEOF, 'undefined')} === ${g.quote_(String(block.getFieldValue('TYPE')))}`, Order.EQUALITY]),
  ts_as: G((block, g) =>
    g.typed
      ? [`${val(g, block, 'VALUE', Order.RELATIONAL, 'undefined')} as ${String(block.getFieldValue('TYPE') ?? 'any').trim() || 'any'}`, Order.RELATIONAL]
      : [val(g, block, 'VALUE', Order.NONE, 'undefined'), Order.NONE],
  ),

  // ---------- Code ----------
  ts_code_stmt: G((block) => ((block as unknown as { code: string }).code ?? '').replace(/\s+$/, '') + '\n'),
  ts_code_expr: G((block) => [String(block.getFieldValue('CODE') ?? '').trim() || 'undefined', Order.ATOMIC]),

  // ---------- Functions ----------
  procedures_defnoreturn: G(defineFunction),
  procedures_defreturn: G(defineFunction),
  procedures_callreturn: G((block, g) => {
    const raw = block.getFieldValue('NAME');
    const call = `${g.getProcedureName(raw)}(${callArgs(block, g)})`;
    return g.asyncFns.has(raw) ? [`await ${call}`, Order.AWAIT] : [call, Order.FUNCTION_CALL];
  }),
  procedures_callnoreturn: G((block, g) => {
    const raw = block.getFieldValue('NAME');
    return `${g.asyncFns.has(raw) ? 'await ' : ''}${g.getProcedureName(raw)}(${callArgs(block, g)});\n`;
  }),
  procedures_ifreturn: G((block, g) => {
    const cond = val(g, block, 'CONDITION', Order.NONE, 'false');
    const hasValue = (block as unknown as { hasReturnValue_: boolean }).hasReturnValue_;
    const ret = hasValue ? `return ${val(g, block, 'VALUE', Order.NONE, 'undefined')};` : 'return;';
    return `if (${cond}) {\n${g.INDENT}${ret}\n}\n`;
  }),
};

/** "(item)" or "(item: Type)" for an arrow function's parameter. */
function arrow(g: TsGenerator, block: Blockly.Block, field: string, typeKey: 'ptype'): string {
  const t = meta(block)[typeKey];
  return `(${g.varName(block, field)}${t && g.typed ? ': ' + t : ''})`;
}

/** The ".method(...)" part of each array-method block. */
const CALLS: Record<string, (g: TsGenerator, b: Blockly.Block) => string> = {
  ts_arr_map: (g, b) => `map(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'VALUE', Order.ASSIGNMENT, 'undefined')})`,
  ts_arr_filter: (g, b) => `filter(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'COND', Order.ASSIGNMENT, 'true')})`,
  ts_arr_some: (g, b) => `some(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'COND', Order.ASSIGNMENT, 'true')})`,
  ts_arr_every: (g, b) => `every(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'COND', Order.ASSIGNMENT, 'true')})`,
  ts_arr_find: (g, b) => `find(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'COND', Order.ASSIGNMENT, 'true')})`,
  ts_arr_findindex: (g, b) => `findIndex(${arrow(g, b, 'VAR', 'ptype')} => ${val(g, b, 'COND', Order.ASSIGNMENT, 'true')})`,
  ts_arr_reduce: (g, b) => {
    const m = meta(b);
    const acc = g.varName(b, 'ACC') + (m.atype && g.typed ? ': ' + m.atype : '');
    const item = g.varName(b, 'VAR') + (m.ptype && g.typed ? ': ' + m.ptype : '');
    const init = m.noInit ? '' : `, ${val(g, b, 'INIT', Order.COMMA, '0')}`;
    return `reduce((${acc}, ${item}) => ${val(g, b, 'VALUE', Order.ASSIGNMENT, g.varName(b, 'ACC'))}${init})`;
  },
  ts_arr_foreach: (g, b) => `forEach(${arrow(g, b, 'VAR', 'ptype')} => {\n${g.statementToCode(b, 'DO')}})`,
};

/**
 * list.filter(...).map(...) - written on one line when it is short,
 * otherwise every method goes on its own line:
 *   list
 *     .filter(...)
 *     .map(...)
 */
function chain(g: TsGenerator, block: Blockly.Block): string {
  const calls: string[] = [];
  let b: Blockly.Block = block;
  for (;;) {
    calls.unshift(CALLS[b.type](g, b));
    const inner = b.getInputTargetBlock('LIST');
    if (inner && CALLS[inner.type] && inner.type !== 'ts_arr_foreach') b = inner;
    else break;
  }
  const base = val(g, b, 'LIST', Order.MEMBER, '[]');
  const one = base + calls.map((c) => '.' + c).join('');
  const firstLine = one.split('\n')[0];
  if (calls.length < 2 || firstLine.length <= 80) return one;
  return base + calls.map((c) => `\n${g.INDENT}.${g.prefixLines(c, g.INDENT).slice(g.INDENT.length)}`).join('');
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const propName = (p: unknown) => {
  const s = String(p ?? '').trim();
  return IDENT_RE.test(s) ? s : safeName(s);
};
const keyName = (k: unknown) => {
  const s = String(k ?? '').trim();
  return IDENT_RE.test(s) ? s : JSON.stringify(s);
};

function callArgs(block: Blockly.Block, g: TsGenerator): string {
  return block
    .getVarModels()
    .map((_, i) => val(g, block, 'ARG' + i, Order.NONE, 'undefined'))
    .join(', ');
}

function defineFunction(block: Blockly.Block, g: TsGenerator): string {
  const raw = block.getFieldValue('NAME');
  const m = meta(block);
  const name = g.getProcedureName(raw);
  const body = block.getInput('STACK') ? g.statementToCode(block, 'STACK') : '';
  let ret = block.getInput('RETURN') ? g.valueToCode(block, 'RETURN', Order.NONE) : '';
  if (ret) ret = `${g.INDENT}return ${ret};\n`;
  const params = block.getVarModels().map((v, i) => {
    const t = m.types ? (i < m.types.length ? m.types[i] : 'any') : 'any';
    return g.getVariableName(v.getId()) + (t && g.typed ? ': ' + t : '');
  });
  const isAsync = g.asyncFns.has(raw);
  // a function that was async only because it waited (now a plain pause) returns the plain value
  let retType = m.ret ?? '';
  const promised = /^Promise<([\s\S]+)>$/.exec(retType.trim());
  if (!isAsync && promised) retType = promised[1];
  const head = `${m.exported && g.typed ? 'export ' : ''}${isAsync ? 'async ' : ''}function ${name}(${params.join(', ')})${retType && g.typed ? ': ' + retType : ''}`;
  return g.mark(block) + `${head} {\n${body}${ret}}\n`;
}

export interface LineSpan {
  id: string;
  start: number;
  end: number;
  color: string;
}

export interface Output {
  ts: string;
  spans: LineSpan[];
}

// ---------------------------------------------------------------- more blocks (blocksMore.ts)

/** The values in the ARG0..ARGn slots of a block with a growing list of slots. */
function slotArgs(g: TsGenerator, b: Blockly.Block, order: Order = Order.COMMA): string[] {
  const n = (b as unknown as { count?: number }).count ?? 0;
  return Array.from({ length: n }, (_, i) => val(g, b, 'ARG' + i, order, 'undefined'));
}

/** "a: number, b: string" -> "a, b" (for the plain JavaScript the guide runs). */
export function stripParamTypes(params: string): string {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of params) {
    if ('<([{'.includes(ch)) depth++;
    if ('>)]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts
    .map((p) => {
      let d = 0;
      for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if ('<([{'.includes(ch)) d++;
        if ('>)]}'.includes(ch)) d--;
        if (ch === ':' && d === 0) return p.slice(0, i).replace(/\?$/, '').trim();
      }
      return p.trim();
    })
    .join(', ');
}

const params = (g: TsGenerator, raw: unknown) => {
  const p = String(raw ?? '').trim();
  return g.typed ? p : stripParamTypes(p);
};

/** `text` - a backtick that is not escaped would end the text early. */
const tplPart = (s: unknown) => String(s ?? '').replace(/(^|[^\\])`/g, '$1\\`');

Object.assign(OVERRIDES, {
  ts_say_many: G((b, g) => `console.${b.getFieldValue('FN') || 'log'}(${slotArgs(g, b).join(', ')});\n`),
  ts_template: G((b, g) => {
    const n = (b as unknown as { count?: number }).count ?? 0;
    let out = '`' + tplPart(b.getFieldValue('S0'));
    for (let i = 0; i < n; i++) out += '${' + val(g, b, 'V' + i, Order.NONE, '""') + '}' + tplPart(b.getFieldValue('S' + (i + 1)));
    return [out + '`', Order.ATOMIC];
  }),
  ts_call: G((b, g) => [`${String(b.getFieldValue('NAME') || 'f').trim()}(${slotArgs(g, b).join(', ')})`, Order.FUNCTION_CALL]),
  ts_call_stmt: G((b, g) => `${String(b.getFieldValue('NAME') || 'f').trim()}(${slotArgs(g, b).join(', ')});\n`),
  ts_method: G((b, g) => [`${val(g, b, 'OBJ', Order.MEMBER, '""')}.${String(b.getFieldValue('METHOD') || 'toString').trim()}(${slotArgs(g, b).join(', ')})`, Order.FUNCTION_CALL]),
  ts_method_stmt: G((b, g) => `${val(g, b, 'OBJ', Order.MEMBER, '""')}.${String(b.getFieldValue('METHOD') || 'toString').trim()}(${slotArgs(g, b).join(', ')});\n`),
  ts_new: G((b, g) => {
    const cls = String(b.getFieldValue('CLASS') || 'Object').trim();
    return [`new ${g.typed ? cls : cls.replace(/<[\s\S]*>$/, '')}(${slotArgs(g, b).join(', ')})`, Order.ATOMIC]; // new X(...) needs no ( ) around it, even before .method()
  }),
  ts_arrow: G((b, g) => {
    const m = meta(b);
    let v = val(g, b, 'VALUE', Order.ASSIGNMENT, 'undefined');
    if (v.startsWith('{')) v = `(${v})`;
    const p = params(g, b.getFieldValue('PARAMS'));
    const head = m.bare && /^[A-Za-z_$][\w$]*$/.test(p) ? p : `(${p})`;
    const inner = b.getInputTargetBlock('VALUE');
    const isAsync = m.async || (!!inner && !FUNCTION_LIKE.has(inner.type) && chainWaits(inner, g));
    return [`${isAsync ? 'async ' : ''}${head} => ${v}`, Order.ASSIGNMENT];
  }),
  ts_arrow_block: G((b, g) => {
    const m = meta(b);
    const p = params(g, b.getFieldValue('PARAMS'));
    const head = m.bare && /^[A-Za-z_$][\w$]*$/.test(p) ? p : `(${p})`;
    const inner = b.getInputTargetBlock('DO');
    const isAsync = m.async || (!!inner && chainWaits(inner, g));
    return [`${isAsync ? 'async ' : ''}${head} => {\n${g.statementToCode(b, 'DO')}}`, Order.ASSIGNMENT];
  }),
  ts_index: G((b, g) => [`${val(g, b, 'OBJ', Order.MEMBER, '[]')}[${val(g, b, 'KEY', Order.NONE, '0')}]`, Order.MEMBER]),
  ts_set_any: G((b, g) => {
    const op = String(b.getFieldValue('OP') || '=');
    const t = val(g, b, 'TARGET', Order.MEMBER, 'x');
    if (op === '++' || op === '--') return `${t}${op};\n`;
    return `${t} ${op} ${val(g, b, 'VALUE', Order.ASSIGNMENT, 'undefined')};\n`;
  }),
  ts_try: G((b, g) => {
    const head = meta(b).noVar ? 'catch' : `catch (${g.varName(b, 'VAR')})`;
    return `try {\n${g.statementToCode(b, 'TRY')}} ${head} {\n${g.statementToCode(b, 'CATCH')}}\n`;
  }),
  ts_throw: G((b, g) => `throw ${val(g, b, 'VALUE', Order.NONE, 'new Error("Error")')};\n`),
  ts_do_while: G((b, g) => `do {\n${g.statementToCode(b, 'DO')}} while (${val(g, b, 'COND', Order.NONE, 'false')});\n`),
  ts_for: G((b, g) => {
    const v = g.varName(b, 'VAR');
    return `for (let ${v} = ${val(g, b, 'FROM', Order.ASSIGNMENT, '0')}; ${v} ${b.getFieldValue('OP')} ${val(g, b, 'TO', Order.RELATIONAL, '0')}; ${v}${b.getFieldValue('STEP')}) {\n${g.statementToCode(b, 'DO')}}\n`;
  }),
  ts_foreach_pair: G((b, g) => {
    const kind = meta(b).kind === 'let' ? 'let' : 'const';
    return `for (${kind} [${g.varName(b, 'K')}, ${g.varName(b, 'V')}] of ${val(g, b, 'LIST', Order.NONE, '[]')}) {\n${g.statementToCode(b, 'DO')}}\n`;
  }),
  ts_literal: G((b) => [String(b.getFieldValue('VALUE') || 'undefined'), Order.ATOMIC]),
  ts_global: G((b) => [String(b.getFieldValue('NAME') || 'Math.PI').trim(), Order.MEMBER]),
  ts_neg: G((b, g) => [`-${val(g, b, 'VALUE', Order.UNARY_NEGATION, '0')}`, Order.UNARY_NEGATION]),
  ts_regex: G((b) => [`/${String(b.getFieldValue('PATTERN') ?? '')}/${String(b.getFieldValue('FLAGS') ?? '').trim()}`, Order.ATOMIC]),
  ts_spread: G((b, g) => [`...${val(g, b, 'VALUE', Order.ASSIGNMENT, '[]')}`, Order.ATOMIC]),
  ts_await: G((b, g) => [`await ${val(g, b, 'VALUE', Order.AWAIT, 'undefined')}`, Order.AWAIT]),
  ts_import: G((b, g) => (g.typed ? `import ${String(b.getFieldValue('WHAT') ?? '').trim()} from ${g.quote_(String(b.getFieldValue('FROM') ?? ''))};\n` : '')),
  ts_type_alias: G((b, g) => {
    if (!g.typed) return '';
    const exp = meta(b).exported ? 'export ' : '';
    return `${exp}type ${safeName(String(b.getFieldValue('NAME') ?? 'T'))} = ${String(b.getFieldValue('TYPE') ?? 'any').trim() || 'any'};\n`;
  }),
  ts_type_union: G((b, g) => {
    if (!g.typed) return '';
    const exp = meta(b).exported ? 'export ' : '';
    const items = slotArgs(g, b, Order.NONE);
    return `${exp}type ${safeName(String(b.getFieldValue('NAME') ?? 'T'))} = ${items.join(' | ') || 'never'};\n`;
  }),
  ts_type: G((block, g) => {
    const b = block as unknown as { count: number; kind: string; exported: boolean };
    if (!g.typed) return '';
    const rows = Array.from({ length: b.count ?? 0 }, (_, i) => `${g.INDENT}${String(block.getFieldValue('N' + i) ?? '').trim()}: ${String(block.getFieldValue('T' + i) ?? 'any').trim() || 'any'};`);
    const name = safeName(String(block.getFieldValue('NAME') ?? 'Thing'));
    const base = String(block.getFieldValue('BASE') ?? '-').trim();
    const exp = b.exported ? 'export ' : '';
    const body = rows.length ? `{\n${rows.join('\n')}\n}` : '{}';
    if (b.kind === 'interface') return `${exp}interface ${name}${base && base !== '-' ? ' extends ' + base : ''} ${body}\n`;
    return `${exp}type ${name} = ${base && base !== '-' ? base + ' & ' : ''}${body};\n`;
  }),
  ts_object: G((block, g) => {
    const b = block as unknown as { count: number; methods?: Record<number, string> };
    const n = b.count ?? 0;
    const methods = b.methods ?? {};
    const entries = Array.from({ length: n }, (_, i) => {
      const key = keyName(block.getFieldValue('K' + i));
      if (i in methods) return `${key}(${params(g, block.getFieldValue('P' + i) ?? methods[i])}) {\n${g.statementToCode(block, 'V' + i)}}`;
      return `${key}: ${val(g, block, 'V' + i, Order.COMMA, 'undefined')}`;
    });
    if (!entries.length) return ['{}', Order.ATOMIC];
    const one = `{ ${entries.join(', ')} }`;
    if (one.length <= 80 && !one.includes('\n')) return [one, Order.ATOMIC];
    return [`{\n${entries.map((e) => g.prefixLines(e, g.INDENT) + ',').join('\n')}\n}`, Order.ATOMIC];
  }),
});

const gen = new TsGenerator();

/** The first line of TypeScript one block makes (shown next to search results). */
export function codeSnippet(block: Blockly.Block): string {
  const g = new TsGenerator();
  g.STATEMENT_PREFIX = null;
  g.init(block.workspace);
  let c = g.blockToCode(block, true);
  if (Array.isArray(c)) c = c[0];
  return String(c ?? '').trim().split('\n')[0];
}

/** Plain JavaScript without types or helpers - the guide runs this in the browser. */
export function generateJs(ws: Blockly.Workspace): string {
  const js = new TsGenerator();
  js.typed = false;
  js.emitHelpers = false;
  js.STATEMENT_PREFIX = null;
  return js.workspaceToCode(ws);
}

export function generate(ws: Blockly.Workspace, nodeTypes = true, style?: { indent: string; quote: 'single' | 'double' }): Output {
  gen.nodeTypes = nodeTypes;
  gen.INDENT = style?.indent ?? '  ';
  gen.quoteStyle = style?.quote ?? 'double';
  gen.STATEMENT_PREFIX = MARK;
  const raw = gen.workspaceToCode(ws);

  // Strip markers, remembering the first line each block id lands on.
  const starts = new Map<string, number>();
  const outLines: string[] = [];
  for (const line of raw.split('\n')) {
    const only = /^[ \t]*\u0001'(.*)'\u0001$/.exec(line);
    if (only) {
      if (!starts.has(only[1])) starts.set(only[1], outLines.length);
      continue;
    }
    const same = /^[ \t]*\u0002(.*)$/.exec(line);
    if (same) {
      let k = outLines.length - 1;
      while (k >= 0 && outLines[k].trim() === '') k--;
      if (k >= 0) {
        outLines[k] += ' ' + same[1];
        for (const [id, at] of starts) if (at === outLines.length) starts.set(id, k);
        continue;
      }
      outLines.push(same[1]);
      continue;
    }
    outLines.push(line.replace(/\u0001'.*?'\u0001/g, '').replace(/\u0002/g, ''));
  }

  const spans: LineSpan[] = [];
  for (const [id, start] of starts) {
    const block = ws.getBlockById(id);
    if (!block || start >= outLines.length) continue;
    let end: number;
    if (block.type === 'ts_on_start') end = Math.min(blockEnd(outLines, start) + 1, outLines.length - 1);
    else end = blockEnd(outLines, start);
    spans.push({ id, start, end, color: (block as Blockly.BlockSvg).getColour?.() ?? '#888' });
  }
  return { ts: outLines.join('\n'), spans };
}

const indentOf = (l: string) => l.length - l.trimStart().length;

/** A statement spans its first line plus every following deeper-indented line (and the closing brace). */
function blockEnd(lines: string[], start: number): number {
  const base = indentOf(lines[start]);
  let i = start + 1;
  while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > base)) i++;
  if (i < lines.length && indentOf(lines[i]) === base && /^\s*[})\]]/.test(lines[i])) {
    // "} else {" continues the same statement
    while (i < lines.length && /^\s*}\s*else\b.*{\s*$/.test(lines[i])) {
      i++;
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > base)) i++;
    }
    return i;
  }
  // trailing blank lines are not part of the statement
  let end = i - 1;
  while (end > start && lines[end].trim() === '') end--;
  return end;
}
