import * as Blockly from 'blockly';
import { javascriptGenerator, JavascriptGenerator, Order } from 'blockly/javascript';

const RESERVED =
  'break,case,catch,class,const,continue,debugger,default,delete,do,else,enum,export,extends,false,finally,for,function,if,import,in,instanceof,new,null,return,super,switch,this,throw,true,try,typeof,var,void,while,with,yield,let,static,implements,interface,package,private,protected,public,await,async,of,as,any,boolean,number,string,symbol,type,unknown,never,object,declare,namespace,module,readonly,keyof,infer,is,' +
  'console,process,Math,String,Number,Boolean,Array,Object,JSON,Date,Promise,Symbol,Error,Map,Set,RegExp,Buffer,require,exports,globalThis,undefined,NaN,Infinity,setTimeout,setInterval,clearTimeout,clearInterval,arguments,eval,' +
  'sleep,ask,readline,sayColored';

const HATS = new Set(['ts_on_start', 'ts_every']);
const AWAITING = new Set(['ts_wait', 'ts_ask', 'ts_ask_number']);
const DEFS = ['procedures_defnoreturn', 'procedures_defreturn'];
const MARK = '\u0001%1\u0001\n';
const ANSI: Record<string, number> = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36 };

interface Meta {
  blank?: boolean;
  incr?: boolean;
  kind?: string;
  async?: boolean;
  exported?: boolean;
  ret?: string;
  types?: string[];
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

  constructor() {
    super('TypeScript');
    Object.assign(this.forBlock, javascriptGenerator.forBlock, OVERRIDES);
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
    this.asyncFns = computeAsync(ws);
  }

  /** Variables keep exactly the name they have in the code. */
  override getVariableName(id: string): string {
    const v = this.ws?.getVariableMap().getVariableById(id) ?? null;
    return v ? safeName(v.getName()) : super.getVariableName(id);
  }

  override getProcedureName(name: string): string {
    return safeName(name);
  }

  override quote_(text: string): string {
    return JSON.stringify(text);
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
    const helperCode = Object.values(this.helpers);
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

  helperSleep(): string {
    this.helpers['sleep'] = 'function sleep(seconds: number): Promise<void> {\n  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));\n}';
    return 'sleep';
  }

  helperAsk(): string {
    this.usesProcess = true;
    if (!this.nodeTypes) this.usesRequire = true;
    const load = this.nodeTypes ? 'const readline = await import("node:readline");' : 'const readline = require("node:readline");';
    this.helpers['ask'] =
      'async function ask(question: string): Promise<string> {\n' +
      `  ${load}\n` +
      '  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });\n' +
      '  return new Promise((resolve) => {\n' +
      '    rl.question(question + " ", (answer: string) => {\n' +
      '      rl.close();\n' +
      '      resolve(answer);\n' +
      '    });\n' +
      '  });\n}';
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

/** Which functions must be `async`: they were async, or they wait/ask/call an async function. */
export function computeAsync(ws: Blockly.Workspace): Set<string> {
  const defs = DEFS.flatMap((t) => ws.getBlocksByType(t, false));
  const set = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of defs) {
      const name = d.getFieldValue('NAME');
      if (set.has(name)) continue;
      const needs =
        meta(d).async ||
        d.getDescendants(false).some((x) => AWAITING.has(x.type) || (x.type.startsWith('procedures_call') && set.has(x.getFieldValue('NAME'))));
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
    return `async function ${fn}(): Promise<void> {\n${chainBody(block, g)}}\n${fn}();\n`;
  }),
  ts_every: G((block, g) => {
    const secs = val(g, block, 'SECS', Order.MULTIPLICATION, '1');
    return `setInterval(async () => {\n${chainBody(block, g)}}, ${secs} * 1000);\n`;
  }),

  // ---------- Control ----------
  ts_wait: G((block, g) => `await ${g.helperSleep()}(${val(g, block, 'SECS', Order.NONE, '1')});\n`),
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
  ts_ask: G((block, g) => [`await ${g.helperAsk()}(${val(g, block, 'TEXT', Order.NONE, '""')})`, Order.AWAIT]),
  ts_ask_number: G((block, g) => [`Number(await ${g.helperAsk()}(${val(g, block, 'TEXT', Order.NONE, '""')}))`, Order.FUNCTION_CALL]),
  ts_comment: G((block) => `// ${String(block.getFieldValue('TEXT') ?? '')}`.trimEnd() + '\n'),

  // ---------- Variables ----------
  ts_let: G((block, g) => {
    const type = String(block.getFieldValue('TYPE') ?? '').trim();
    const v = g.valueToCode(block, 'VALUE', Order.ASSIGNMENT);
    return `${block.getFieldValue('KIND')} ${g.varName(block, 'VAR')}${type ? ': ' + type : ''}${v ? ' = ' + v : ''};\n`;
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
    // right side of - / % ** needs parentheses when it is the same precedence
    const rightOrder = op === '+' || op === '*' ? order : order - 0.01;
    const a = val(g, block, 'A', op === '**' ? Order.EXPONENTIATION - 0.01 : order, '0');
    const b = val(g, block, 'B', rightOrder, '0');
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
  ts_length: G((block, g) => [`${val(g, block, 'VALUE', Order.MEMBER, '""')}.length`, Order.MEMBER]),
  ts_to_number: G((block, g) => [`Number(${val(g, block, 'VALUE', Order.NONE, '0')})`, Order.FUNCTION_CALL]),
  ts_to_text: G((block, g) => [`String(${val(g, block, 'VALUE', Order.NONE, '""')})`, Order.FUNCTION_CALL]),
  ts_case: G((block, g) => [`${val(g, block, 'TEXT', Order.MEMBER, '""')}.${block.getFieldValue('CASE')}()`, Order.FUNCTION_CALL]),

  // ---------- Arrays ----------
  ts_list_literal: G((block, g) => {
    const n = (block as unknown as { itemCount: number }).itemCount ?? 0;
    const items = Array.from({ length: n }, (_, i) => val(g, block, 'ITEM' + i, Order.COMMA, 'undefined'));
    return [`[${items.join(', ')}]`, Order.ATOMIC];
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

  // ---------- Types ----------
  ts_typeof: G((block, g) => [`typeof ${val(g, block, 'VALUE', Order.TYPEOF, 'undefined')}`, Order.TYPEOF]),
  ts_is_type: G((block, g) => [`typeof ${val(g, block, 'VALUE', Order.TYPEOF, 'undefined')} === "${block.getFieldValue('TYPE')}"`, Order.EQUALITY]),
  ts_as: G((block, g) => [`${val(g, block, 'VALUE', Order.RELATIONAL, 'undefined')} as ${String(block.getFieldValue('TYPE') ?? 'any').trim() || 'any'}`, Order.RELATIONAL]),

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
    return g.getVariableName(v.getId()) + (t ? ': ' + t : '');
  });
  const head = `${m.exported ? 'export ' : ''}${g.asyncFns.has(raw) ? 'async ' : ''}function ${name}(${params.join(', ')})${m.ret ? ': ' + m.ret : ''}`;
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

const gen = new TsGenerator();

export function generate(ws: Blockly.Workspace, nodeTypes = true): Output {
  gen.nodeTypes = nodeTypes;
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
    outLines.push(line.replace(/\u0001'.*?'\u0001/g, ''));
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
