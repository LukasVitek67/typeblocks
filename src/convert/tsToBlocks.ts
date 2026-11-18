/**
 * TypeScript source -> Blockly workspace JSON.
 *
 * Everything that has a matching block becomes that block. Everything else becomes a
 * "TS code" block holding the original text, so converting never loses code.
 */
import * as ts from 'typescript';

export interface CodeStyle {
  indent: string;
  quote: 'single' | 'double';
}

type BJ = Record<string, unknown> & { type: string; next?: { block: BJ } };
type Input = { block: BJ } | { shadow: BJ };

export interface Converted {
  workspace: { blocks: { languageVersion: 0; blocks: BJ[] }; variables: { name: string; id: string }[] };
  rawCount: number;
  /** How the file is written, so the blocks write it back the same way. */
  style: CodeStyle;
  blockCount: number;
}

const HELPERS = ['ask', 'sleep', 'sayColored'] as const;
const COLOR_CODES: Record<number, string> = { 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan' };
const ARITH = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.PlusToken, '+'],
  [ts.SyntaxKind.MinusToken, '-'],
  [ts.SyntaxKind.AsteriskToken, '*'],
  [ts.SyntaxKind.SlashToken, '/'],
  [ts.SyntaxKind.PercentToken, '%'],
  [ts.SyntaxKind.AsteriskAsteriskToken, '**'],
]);
const COMPARE = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.EqualsEqualsEqualsToken, '==='],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, '!=='],
  [ts.SyntaxKind.EqualsEqualsToken, '=='],
  [ts.SyntaxKind.ExclamationEqualsToken, '!='],
  [ts.SyntaxKind.LessThanToken, '<'],
  [ts.SyntaxKind.LessThanEqualsToken, '<='],
  [ts.SyntaxKind.GreaterThanToken, '>'],
  [ts.SyntaxKind.GreaterThanEqualsToken, '>='],
]);
const LOGIC = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.AmpersandAmpersandToken, '&&'],
  [ts.SyntaxKind.BarBarToken, '||'],
  [ts.SyntaxKind.QuestionQuestionToken, '??'],
]);

export function tsToBlocks(text: string, fileName = 'file.ts'): Converted {
  return new Converter(text, fileName).run();
}

class Converter {
  private sf: ts.SourceFile;
  private vars = new Map<string, string>();
  private funcs = new Map<string, { params: string[] }>();
  private arrays = new Set<string>();
  /** Names declared in this file as variables or parameters (others, like Math or process, stay as code). */
  private declared = new Set<string>();
  private helperNodes = new Set<ts.Node>();
  private helpersAvailable = new Set<string>();
  private rawCount = 0;
  /** Absolute positions of comments that already became blocks. */
  private handled = new Set<number>();
  private blockCount = 0;
  private idSeq = 0;

  constructor(private text: string, fileName: string) {
    this.sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }

  run(): Converted {
    const stmts = [...this.sf.statements];
    this.scanTopLevel(stmts);

    const top: BJ[] = [];
    let run: ts.Statement[] = [];
    const flush = () => {
      if (!run.length) return;
      const chain = this.chain(run, this.sf.endOfFileToken);
      if (chain) top.push(chain);
      run = [];
    };
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (this.helperNodes.has(s)) continue;
      const own = this.topLevelBlock(s, stmts[i + 1]);
      if (own) {
        flush();
        const lead = this.commentBlocks(s, false);
        if (lead.length) {
          top.push(linkAll(lead)!);
          if (this.blankAfterComments(s)) {
            const m = own.block.data ? JSON.parse(own.block.data as string) : {};
            own.block.data = JSON.stringify({ ...m, blank: true });
          }
        }
        top.push(own.block);
        if (own.skipNext) i++;
        continue;
      }
      run.push(s);
    }
    flush();
    // trailing comments at the very end of the file
    if (!run.length) {
      const tail = this.commentsAt(this.sf.endOfFileToken.getFullStart(), this.sf.endOfFileToken.getStart());
      if (tail.length) top.push(linkAll(tail)!);
    }
    top.forEach((b, i) => {
      b.x = 20;
      b.y = i * 100;
    });
    return {
      workspace: {
        blocks: { languageVersion: 0, blocks: top },
        variables: [...this.vars].map(([name, id]) => ({ name, id })),
      },
      rawCount: this.rawCount,
      style: this.detectStyle(),
      blockCount: this.blockCount,
    };
  }

  /** Indentation (2 spaces, 4 spaces or a tab) and quote style used by the file. */
  private detectStyle(): CodeStyle {
    const lines = this.text.split(/\r?\n/);
    let tabs = 0;
    const sizes = new Map<number, number>();
    for (let i = 1; i < lines.length; i++) {
      const m = /^([ \t]+)\S/.exec(lines[i]);
      if (!m) continue;
      if (m[1].includes('\t')) {
        tabs++;
        continue;
      }
      const prev = /^([ ]*)\S/.exec(lines[i - 1] ?? '');
      const diff = m[1].length - (prev ? prev[1].length : 0);
      if (diff > 0) sizes.set(diff, (sizes.get(diff) ?? 0) + 1);
    }
    let indent = '  ';
    const spaceVotes = [...sizes.values()].reduce((a, b) => a + b, 0);
    if (tabs > spaceVotes) indent = '\t';
    else if (sizes.size) indent = ' '.repeat([...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    let single = 0;
    let double = 0;
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteral(n)) n.getText(this.sf).startsWith("'") ? single++ : double++;
      ts.forEachChild(n, visit);
    };
    visit(this.sf);
    return { indent, quote: single > double ? 'single' : 'double' };
  }

  // ---------------------------------------------------------------- scanning

  private scanTopLevel(stmts: ts.Statement[]) {
    for (const s of stmts) {
      if (ts.isFunctionDeclaration(s) && s.name && s.body) {
        const name = s.name.text;
        if ((HELPERS as readonly string[]).includes(name) && this.isOurHelper(name, s)) {
          this.helperNodes.add(s);
          this.helpersAvailable.add(name);
          continue;
        }
        if (this.simpleParams(s)) this.funcs.set(name, { params: s.parameters.map((p) => (p.name as ts.Identifier).text) });
      }
      const t = s.getText(this.sf).trim();
      if (t === 'declare const process: any;' || t === 'declare function require(name: string): any;') this.helperNodes.add(s);
    }
    // Calls to ask/sleep/sayColored count as helper blocks unless the file has its own function with that name.
    for (const h of HELPERS) if (!this.funcs.has(h)) this.helpersAvailable.add(h);
    // Remember which variables hold arrays (for the array blocks).
    const visit = (n: ts.Node) => {
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) this.declared.add(n.name.text);
      if (ts.isCatchClause(n) && n.variableDeclaration && ts.isIdentifier(n.variableDeclaration.name)) this.declared.add(n.variableDeclaration.name.text);
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
        const t = n.type?.getText(this.sf) ?? '';
        if (/\[\]$|^Array</.test(t) || (n.initializer && ts.isArrayLiteralExpression(n.initializer))) this.arrays.add(n.name.text);
      }
      if (ts.isParameter(n) && ts.isIdentifier(n.name) && /\[\]$|^Array</.test(n.type?.getText(this.sf) ?? '')) this.arrays.add(n.name.text);
      ts.forEachChild(n, visit);
    };
    visit(this.sf);
  }

  private isOurHelper(name: string, fn: ts.FunctionDeclaration): boolean {
    const t = fn.getText(this.sf);
    if (name === 'ask') return t.includes('readline') && t.includes('rl.question(');
    if (name === 'sleep') return t.includes('setTimeout(resolve, seconds * 1000)');
    if (name === 'sayColored') return t.includes('\\x1b[');
    return false;
  }

  private simpleParams(fn: ts.FunctionLikeDeclaration): boolean {
    return fn.parameters.every((p) => ts.isIdentifier(p.name) && !p.initializer && !p.dotDotDotToken && !p.questionToken);
  }

  // ---------------------------------------------------------------- helpers

  private id(): string {
    return 'b' + (this.idSeq++).toString(36);
  }

  private varRef(name: string) {
    let id = this.vars.get(name);
    if (!id) {
      id = 'v_' + name;
      this.vars.set(name, id);
    }
    return { id };
  }

  private block(type: string, rest: Record<string, unknown> = {}): BJ {
    this.blockCount++;
    return { type, id: this.id(), ...rest };
  }

  private textOf(node: ts.Node): string {
    return this.text.slice(node.getStart(this.sf), node.end);
  }

  /** Original text of a node with its indentation removed (keeps relative indentation). */
  private dedented(node: ts.Node, start = node.getStart(this.sf)): string {
    const raw = this.text.slice(start, node.end);
    const lineStart = this.text.lastIndexOf('\n', start - 1) + 1;
    const indent = this.text.slice(lineStart, start).match(/^\s*/)![0].length;
    return raw
      .split(/\r?\n/)
      .map((l, i) => (i === 0 ? l : l.slice(Math.min(indent, l.length - l.trimStart().length))))
      .join('\n');
  }

  private rawStmt(node: ts.Node): BJ {
    this.rawCount++;
    return this.block('ts_code_stmt', { extraState: { code: this.dedented(node) } });
  }

  private rawExpr(node: ts.Node): BJ {
    this.rawCount++;
    return this.block('ts_code_expr', { fields: { CODE: this.textOf(node) } });
  }

  private commentsAt(from: number, to: number): BJ[] {
    const out: BJ[] = [];
    const slice = this.text.slice(from, to);
    const re = /\/\/([^\n]*)|\/\*[\s\S]*?\*\//g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(slice))) {
      if (this.handled.has(from + m.index)) {
        last = m.index + m[0].length;
        continue;
      }
      this.handled.add(from + m.index);
      const before = slice.slice(last, m.index);
      const blank = out.length > 0 && /\n[ \t]*\r?\n/.test(before);
      // a comment on the same line as the code before it (e.g. right after a {) stays on that line
      const same = from > 0 && !before.includes('\n') && !slice.slice(0, m.index).includes('\n') && this.text[from - 1] !== '\n';
      if (m[1] !== undefined) out.push(this.withBlank(this.comment(m[1], same), blank));
      else {
        this.rawCount++;
        out.push(this.withBlank(this.block('ts_code_stmt', { extraState: { code: m[0] } }), blank));
      }
      last = m.index + m[0].length;
    }
    return out;
  }

  /** Comment blocks for the comments in front of a statement (and blank-line info). */
  private commentBlocks(s: ts.Node, includeTrailing: boolean): BJ[] {
    const lead = this.commentsAt(s.getFullStart(), s.getStart(this.sf));
    if (includeTrailing) lead.push(...this.trailing(s));
    return lead;
  }

  /** Same-line comments after a statement:  x = 1; // like this */
  private trailing(s: ts.Node): BJ[] {
    const out: BJ[] = [];
    for (const r of ts.getTrailingCommentRanges(this.text, s.end) ?? []) {
      if (this.handled.has(r.pos)) continue;
      const t = this.text.slice(r.pos, r.end);
      if (!t.startsWith('//')) continue;
      this.handled.add(r.pos);
      out.push(this.comment(t.slice(2), true));
    }
    return out;
  }

  private withBlank(b: BJ, blank: boolean): BJ {
    if (blank) b.data = JSON.stringify({ ...(b.data ? JSON.parse(b.data as string) : {}), blank: true });
    return b;
  }

  /** A // comment block; remembers whether there was a space after // and whether it sat at the end of a code line. */
  private comment(raw: string, sameLine: boolean): BJ {
    const text = raw.replace(/\r$/, '');
    const meta: Record<string, boolean> = {};
    if (text && !text.startsWith(' ')) meta.nospace = true;
    if (sameLine) meta.same = true;
    return this.block('ts_comment', {
      fields: { TEXT: text.replace(/^ /, '') },
      data: Object.keys(meta).length ? JSON.stringify(meta) : undefined,
    });
  }

  /** Is there an empty line between the last comment in front of a statement and the statement? */
  private blankAfterComments(s: ts.Node): boolean {
    const trivia = this.text.slice(s.getFullStart(), s.getStart(this.sf));
    const lastEnd = Math.max(trivia.lastIndexOf('*/') + 2, (() => {
      const m = [...trivia.matchAll(/\/\/[^\n]*/g)].pop();
      return m ? m.index! + m[0].length : 0;
    })());
    return lastEnd > 0 && /\n[ \t]*\r?\n/.test(trivia.slice(lastEnd));
  }

  private blankBefore(s: ts.Node): boolean {
    const trivia = this.text
      .slice(s.getFullStart(), s.getStart(this.sf))
      .replace(/^[ \t]*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/, ''); // a same-line comment of the previous statement
    const firstComment = trivia.search(/\/\/|\/\*/);
    const head = firstComment >= 0 ? trivia.slice(0, firstComment) : trivia;
    return /\n[ \t]*\r?\n/.test(head);
  }

  // ---------------------------------------------------------------- statements

  /** Converts a list of statements into one linked chain of blocks. */
  private chain(stmts: readonly ts.Statement[], closer?: ts.Node): BJ | undefined {
    const blocks: BJ[] = [];
    stmts.forEach((s, i) => {
      const lead = this.commentsAt(s.getFullStart(), s.getStart(this.sf));
      const converted = this.statement(s);
      const list = Array.isArray(converted) ? converted : [converted];
      const group = [...lead, ...list];
      if (i > 0 && this.blankBefore(s) && group[0]) this.withBlank(group[0], true);
      if (lead.length && list[0] && this.blankAfterComments(s)) this.withBlank(list[0], true);
      blocks.push(...group);
      blocks.push(...this.trailing(s));
    });
    if (closer) blocks.push(...this.commentsAt(closer.getFullStart(), closer.getStart(this.sf)));
    return linkAll(blocks);
  }

  private body(node: ts.Statement | undefined): Input | undefined {
    if (!node) return undefined;
    if (ts.isBlock(node)) {
      const c = this.chain(node.statements, node.getLastToken(this.sf));
      return c ? { block: c } : undefined;
    }
    const c = this.chain([node]);
    return c ? { block: c } : undefined;
  }

  /** Top-level statements that become their own hat/definition block. */
  private topLevelBlock(s: ts.Statement, next: ts.Statement | undefined): { block: BJ; skipNext?: boolean } | undefined {
    // async function main() { ... }  main();   ->  "when Run clicked"
    if (
      ts.isFunctionDeclaration(s) && s.name?.text === 'main' && s.body && !s.parameters.length && hasModifier(s, ts.SyntaxKind.AsyncKeyword) &&
      next && ts.isExpressionStatement(next) && next.expression.getText(this.sf) === 'main()'
    ) {
      const b = this.block('ts_on_start');
      const body = this.chain(s.body.statements, s.body.getLastToken(this.sf));
      if (body) b.next = { block: body };
      return { block: b, skipNext: true };
    }
    // setInterval(async () => { ... }, N * 1000);  ->  "every N seconds"
    if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText(this.sf) === 'setInterval') {
      const [fn, ms] = s.expression.arguments;
      if (
        fn && ms && ts.isArrowFunction(fn) && !fn.parameters.length && ts.isBlock(fn.body) &&
        ts.isBinaryExpression(ms) && ms.operatorToken.kind === ts.SyntaxKind.AsteriskToken && ms.right.getText(this.sf) === '1000'
      ) {
        const b = this.block('ts_every', { inputs: { SECS: { block: this.expr(ms.left) } } });
        const body = this.chain(fn.body.statements, fn.body.getLastToken(this.sf));
        if (body) b.next = { block: body };
        return { block: b };
      }
    }
    // function name(a: T, b: U): R { ... }
    if (ts.isFunctionDeclaration(s) && s.name && s.body && this.funcs.has(s.name.text) && !s.typeParameters && !s.asteriskToken) {
      const mods = (ts.getModifiers(s) ?? []).map((m) => m.kind);
      if (mods.some((k) => k !== ts.SyntaxKind.AsyncKeyword && k !== ts.SyntaxKind.ExportKeyword)) return undefined;
      const params = s.parameters.map((p) => ({ name: (p.name as ts.Identifier).text, id: this.varRef((p.name as ts.Identifier).text).id }));
      const meta = {
        async: mods.includes(ts.SyntaxKind.AsyncKeyword),
        exported: mods.includes(ts.SyntaxKind.ExportKeyword),
        ret: s.type?.getText(this.sf) ?? '',
        types: s.parameters.map((p) => p.type?.getText(this.sf) ?? ''),
      };
      const b = this.block('procedures_defnoreturn', {
        fields: { NAME: s.name.text },
        extraState: params.length ? { params } : undefined,
        data: JSON.stringify(meta),
      });
      const body = this.chain(s.body.statements, s.body.getLastToken(this.sf));
      if (body) b.inputs = { STACK: { block: body } };
      return { block: b };
    }
    return undefined;
  }

  private statement(s: ts.Statement): BJ | BJ[] {
    try {
      return this.statementInner(s) ?? this.rawStmt(s);
    } catch {
      return this.rawStmt(s);
    }
  }

  private statementInner(s: ts.Statement): BJ | BJ[] | undefined {
    if (ts.isVariableStatement(s)) {
      const mods = (ts.getModifiers(s) ?? []).map((m) => m.kind);
      if (mods.some((k) => k !== ts.SyntaxKind.ExportKeyword)) return undefined;
      const exported = mods.includes(ts.SyntaxKind.ExportKeyword);
      const flags = s.declarationList.flags;
      const kind = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
      const decls = s.declarationList.declarations;
      if (!decls.every((d) => ts.isIdentifier(d.name) && !d.exclamationToken)) return undefined;
      return decls.map((d) => {
        const b = this.block('ts_let', {
          fields: { KIND: kind, VAR: this.varRef((d.name as ts.Identifier).text), TYPE: d.type?.getText(this.sf) ?? '' },
        });
        if (d.initializer) b.inputs = { VALUE: { block: this.expr(d.initializer) } };
        if (exported) b.data = JSON.stringify({ exported: true });
        return b;
      });
    }

    if (ts.isExpressionStatement(s)) return this.expressionStatement(s.expression);

    if ((ts.isTypeAliasDeclaration(s) && ts.isTypeLiteralNode(s.type) && !s.typeParameters) || (ts.isInterfaceDeclaration(s) && !s.typeParameters && !s.heritageClauses)) {
      const mods = (ts.getModifiers(s) ?? []).map((m) => m.kind);
      if (mods.some((k) => k !== ts.SyntaxKind.ExportKeyword)) return undefined;
      const members = ts.isTypeAliasDeclaration(s) ? (s.type as ts.TypeLiteralNode).members : s.members;
      const simple = members.every(
        (m) => ts.isPropertySignature(m) && m.type && !ts.getModifiers(m)?.length && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) && !m.type.getText(this.sf).includes('\n'),
      );
      if (!simple) return undefined;
      const fields: Record<string, string> = { NAME: s.name.text };
      members.forEach((m, i) => {
        const p = m as ts.PropertySignature;
        fields['N' + i] = p.name.getText(this.sf) + (p.questionToken ? '?' : '');
        fields['T' + i] = p.type!.getText(this.sf);
      });
      return this.block('ts_type', {
        extraState: { count: members.length, kind: ts.isInterfaceDeclaration(s) ? 'interface' : 'type', exported: mods.includes(ts.SyntaxKind.ExportKeyword) },
        fields,
      });
    }

    if (ts.isIfStatement(s)) {
      const inputs: Record<string, Input | undefined> = {};
      let n = 0;
      let cur: ts.IfStatement = s;
      let hasElse = false;
      for (;;) {
        inputs['IF' + n] = { block: this.expr(cur.expression) };
        inputs['DO' + n] = this.body(cur.thenStatement);
        n++;
        const e = cur.elseStatement;
        if (!e) break;
        if (ts.isIfStatement(e)) {
          cur = e;
          continue;
        }
        inputs['ELSE'] = this.body(e);
        hasElse = true;
        break;
      }
      const extraState: Record<string, unknown> = {};
      if (n > 1) extraState.elseIfCount = n - 1;
      if (hasElse) extraState.hasElse = true;
      return this.block('controls_if', { extraState: Object.keys(extraState).length ? extraState : undefined, inputs: clean(inputs) });
    }

    if (ts.isWhileStatement(s)) {
      if (s.expression.kind === ts.SyntaxKind.TrueKeyword) return this.block('ts_forever', { inputs: clean({ DO: this.body(s.statement) }) });
      const neg = ts.isPrefixUnaryExpression(s.expression) && s.expression.operator === ts.SyntaxKind.ExclamationToken;
      const cond = neg ? (s.expression as ts.PrefixUnaryExpression).operand : s.expression;
      return this.block('controls_whileUntil', {
        fields: { MODE: neg ? 'UNTIL' : 'WHILE' },
        inputs: clean({ BOOL: { block: this.expr(cond) }, DO: this.body(s.statement) }),
      });
    }

    if (ts.isForStatement(s)) return this.forStatement(s);

    if (ts.isForOfStatement(s) && !s.awaitModifier) {
      const init = s.initializer;
      if (ts.isVariableDeclarationList(init) && init.declarations.length === 1 && ts.isIdentifier(init.declarations[0].name) && !init.declarations[0].type) {
        const name = (init.declarations[0].name as ts.Identifier).text;
        const kind = init.flags & ts.NodeFlags.Const ? 'const' : 'let';
        return this.block('ts_foreach', {
          fields: { VAR: this.varRef(name) },
          inputs: clean({ LIST: { block: this.expr(s.expression) }, DO: this.body(s.statement) }),
          data: kind === 'let' ? JSON.stringify({ kind }) : undefined,
        });
      }
      return undefined;
    }

    if (ts.isBreakStatement(s) && !s.label) return this.block('controls_flow_statements', { fields: { FLOW: 'BREAK' } });
    if (ts.isContinueStatement(s) && !s.label) return this.block('controls_flow_statements', { fields: { FLOW: 'CONTINUE' } });

    if (ts.isReturnStatement(s)) {
      const b = this.block('ts_return');
      if (s.expression) b.inputs = { VALUE: { block: this.expr(s.expression) } };
      return b;
    }

    return undefined;
  }

  private forStatement(s: ts.ForStatement): BJ | undefined {
    const init = s.initializer;
    const single =
      init && ts.isVariableDeclarationList(init) && init.flags & ts.NodeFlags.Let && init.declarations.length === 1 &&
      ts.isIdentifier(init.declarations[0].name) && !init.declarations[0].type && init.declarations[0].initializer
        ? init.declarations[0]
        : undefined;
    if (single && s.condition && s.incrementor && ts.isBinaryExpression(s.condition)) {
      const v = (single.name as ts.Identifier).text;
      const cond = s.condition;
      const inc = s.incrementor;
      const isInc =
        (ts.isPostfixUnaryExpression(inc) || ts.isPrefixUnaryExpression(inc)) && inc.operator === ts.SyntaxKind.PlusPlusToken && inc.operand.getText(this.sf) === v;
      if (isInc && cond.left.getText(this.sf) === v) {
        const from = single.initializer!;
        // repeat N times: for (let i = 0; i < N; i++) with i unused inside
        if (cond.operatorToken.kind === ts.SyntaxKind.LessThanToken && from.getText(this.sf) === '0' && !usesIdentifier(s.statement, v)) {
          return this.block('ts_repeat', { inputs: clean({ TIMES: { block: this.expr(cond.right) }, DO: this.body(s.statement) }) });
        }
        if (cond.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken) {
          return this.block('ts_count', {
            fields: { VAR: this.varRef(v) },
            inputs: clean({ FROM: { block: this.expr(from) }, TO: { block: this.expr(cond.right) }, DO: this.body(s.statement) }),
          });
        }
      }
    }
    // any other for loop: keep the header as text, the body as blocks
    const open = s.getChildren(this.sf).find((c) => c.kind === ts.SyntaxKind.OpenParenToken);
    const close = s.getChildren(this.sf).find((c) => c.kind === ts.SyntaxKind.CloseParenToken);
    if (!open || !close) return undefined;
    const head = this.text.slice(open.end, close.getStart(this.sf)).replace(/\s+/g, ' ').trim();
    return this.block('ts_for_raw', { fields: { HEAD: head }, inputs: clean({ DO: this.body(s.statement) }) });
  }

  private expressionStatement(e: ts.Expression): BJ | undefined {
    // x = v, x += v, x -= 5, arr[i] = v
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (ts.isIdentifier(e.left)) {
        const name = e.left.text;
        if (op === ts.SyntaxKind.EqualsToken) return this.block('variables_set', { fields: { VAR: this.varRef(name) }, inputs: { VALUE: { block: this.expr(e.right) } } });
        if (op === ts.SyntaxKind.PlusEqualsToken) return this.block('math_change', { fields: { VAR: this.varRef(name) }, inputs: { DELTA: { block: this.expr(e.right) } } });
        if (op === ts.SyntaxKind.MinusEqualsToken && ts.isNumericLiteral(e.right))
          return this.block('math_change', { fields: { VAR: this.varRef(name) }, inputs: { DELTA: { block: this.block('math_number', { fields: { NUM: -Number(e.right.text) } }) } } });
      }
      if (op === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(e.left) && ts.isIdentifier(e.left.name) && !this.isGlobal(e.left.expression)) {
        return this.block('ts_prop_set', {
          fields: { PROP: e.left.name.text },
          inputs: { OBJ: { block: this.expr(e.left.expression) }, VALUE: { block: this.expr(e.right) } },
        });
      }
      if (op === ts.SyntaxKind.EqualsToken && ts.isElementAccessExpression(e.left) && ts.isIdentifier(e.left.expression)) {
        return this.block('ts_list_replace', {
          fields: { LIST: this.varRef(e.left.expression.text) },
          inputs: { INDEX: { block: this.expr(e.left.argumentExpression) }, ITEM: { block: this.expr(e.right) } },
        });
      }
      return undefined;
    }
    // x++ / x--
    if ((ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) && ts.isIdentifier(e.operand)) {
      if (e.operator === ts.SyntaxKind.PlusPlusToken || e.operator === ts.SyntaxKind.MinusMinusToken) {
        const d = e.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1;
        return this.block('math_change', {
          fields: { VAR: this.varRef(e.operand.text) },
          inputs: { DELTA: { block: this.block('math_number', { fields: { NUM: d } }) } },
          data: JSON.stringify({ incr: true }),
        });
      }
    }
    // await sleep(x) / await myFunction(...)
    let awaited = false;
    if (ts.isAwaitExpression(e)) {
      awaited = true;
      e = e.expression;
    }
    if (!ts.isCallExpression(e)) return undefined;
    const callee = e.expression.getText(this.sf);
    const args = e.arguments;

    if (awaited && callee === 'sleep' && this.helpersAvailable.has('sleep') && args.length === 1) {
      return this.block('ts_wait', { inputs: { SECS: { block: this.expr(args[0]) } } });
    }
    if (!awaited && callee === 'console.log' && args.length === 1) return this.block('ts_say', { inputs: { TEXT: { block: this.expr(args[0]) } } });
    if (!awaited && callee === 'sayColored' && this.helpersAvailable.has('sayColored') && args.length === 2 && ts.isNumericLiteral(args[1]) && COLOR_CODES[Number(args[1].text)]) {
      return this.block('ts_say_color', { fields: { COLOR: COLOR_CODES[Number(args[1].text)] }, inputs: { TEXT: { block: this.expr(args[0]) } } });
    }
    if (!awaited && callee === 'process.exit' && args.length === 1 && args[0].getText(this.sf) === '0') return this.block('ts_stop');

    // list.forEach((item) => { ... })
    if (!awaited && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'forEach' && args.length === 1) {
      const fn = args[0];
      if (ts.isArrowFunction(fn) && !fn.type && !hasModifier(fn, ts.SyntaxKind.AsyncKeyword) && fn.parameters.length === 1 && this.simpleParam(fn.parameters[0])) {
        const p = fn.parameters[0];
        let body: Input | undefined;
        if (ts.isBlock(fn.body)) body = this.body(fn.body);
        else body = { block: this.expressionStatement(fn.body) ?? this.block('ts_code_stmt', { extraState: { code: this.textOf(fn.body) + ';' } }) };
        return this.block('ts_arr_foreach', {
          fields: { VAR: this.varRef((p.name as ts.Identifier).text) },
          inputs: clean({ LIST: { block: this.expr(e.expression.expression) }, DO: body }),
          data: p.type ? JSON.stringify({ ptype: p.type.getText(this.sf) }) : undefined,
        });
      }
    }

    // array methods on a plain variable: list.push(x) ...
    if (!awaited && ts.isPropertyAccessExpression(e.expression) && ts.isIdentifier(e.expression.expression)) {
      const list = e.expression.expression.text;
      const method = e.expression.name.text;
      const L = { LIST: this.varRef(list) };
      if (method === 'push' && args.length === 1) return this.block('ts_list_add', { fields: L, inputs: { ITEM: { block: this.expr(args[0]) } } });
      if (method === 'unshift' && args.length === 1) return this.block('ts_list_add_front', { fields: L, inputs: { ITEM: { block: this.expr(args[0]) } } });
      if ((method === 'pop' || method === 'shift') && !args.length) return this.block('ts_list_pop', { fields: { ...L, END: method } });
      if ((method === 'sort' || method === 'reverse') && !args.length) return this.block('ts_list_sort', { fields: { ...L, HOW: method } });
      if (method === 'splice' && args.length === 2 && args[1].getText(this.sf) === '1')
        return this.block('ts_list_remove', { fields: L, inputs: { INDEX: { block: this.expr(args[0]) } } });
      if (method === 'splice' && args.length === 3 && args[1].getText(this.sf) === '0')
        return this.block('ts_list_insert', { fields: L, inputs: { INDEX: { block: this.expr(args[0]) }, ITEM: { block: this.expr(args[2]) } } });
    }

    // call of a function defined in this file
    if (ts.isIdentifier(e.expression) && this.funcs.has(callee)) {
      const params = this.funcs.get(callee)!.params;
      if (params.length === args.length) {
        const inputs: Record<string, Input> = {};
        args.forEach((a, i) => (inputs['ARG' + i] = { block: this.expr(a) }));
        return this.block('procedures_callnoreturn', { extraState: { name: callee, params }, inputs });
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------- expressions

  private expr(node: ts.Expression): BJ {
    try {
      return this.exprInner(node) ?? this.rawExpr(node);
    } catch {
      return this.rawExpr(node);
    }
  }

  private exprInner(n: ts.Expression): BJ | undefined {
    if (ts.isParenthesizedExpression(n)) return this.expr(n.expression);
    if (ts.isNumericLiteral(n) && /^[\d.]+$/.test(n.text)) return this.block('math_number', { fields: { NUM: Number(n.text) } });
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand) && /^[\d.]+$/.test(n.operand.text))
      return this.block('math_number', { fields: { NUM: -Number(n.operand.text) } });
    if (ts.isStringLiteral(n)) return this.block('text', { fields: { TEXT: n.text } });
    if (n.kind === ts.SyntaxKind.TrueKeyword) return this.block('logic_boolean', { fields: { BOOL: 'TRUE' } });
    if (n.kind === ts.SyntaxKind.FalseKeyword) return this.block('logic_boolean', { fields: { BOOL: 'FALSE' } });
    if (ts.isIdentifier(n)) {
      if (n.text === 'undefined' || n.text === 'NaN' || n.text === 'Infinity') return undefined;
      if (this.isGlobal(n)) return undefined;
      return this.block('variables_get', { fields: { VAR: this.varRef(n.text) } });
    }

    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      const random = this.randomPattern(n);
      if (random) return random;
      if (ARITH.has(k)) return this.block('ts_arith', { fields: { OP: ARITH.get(k) }, inputs: { A: { block: this.expr(n.left) }, B: { block: this.expr(n.right) } } });
      if (COMPARE.has(k)) {
        // typeof x === "number"
        if (k === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isTypeOfExpression(n.left) && ts.isStringLiteral(n.right) && ['number', 'string', 'boolean', 'object', 'undefined'].includes(n.right.text))
          return this.block('ts_is_type', { fields: { TYPE: n.right.text }, inputs: { VALUE: { block: this.expr(n.left.expression) } } });
        return this.block('ts_compare', { fields: { OP: COMPARE.get(k) }, inputs: { A: { block: this.expr(n.left) }, B: { block: this.expr(n.right) } } });
      }
      if (LOGIC.has(k)) return this.block('ts_logic', { fields: { OP: LOGIC.get(k) }, inputs: { A: { block: this.expr(n.left) }, B: { block: this.expr(n.right) } } });
      return undefined;
    }
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) return this.block('ts_not', { inputs: { A: { block: this.expr(n.operand) } } });
    if (ts.isConditionalExpression(n))
      return this.block('logic_ternary', { inputs: { IF: { block: this.expr(n.condition) }, THEN: { block: this.expr(n.whenTrue) }, ELSE: { block: this.expr(n.whenFalse) } } });
    if (ts.isTypeOfExpression(n)) return this.block('ts_typeof', { inputs: { VALUE: { block: this.expr(n.expression) } } });
    if (ts.isAsExpression(n)) return this.block('ts_as', { fields: { TYPE: n.type.getText(this.sf) }, inputs: { VALUE: { block: this.expr(n.expression) } } });

    if (ts.isArrayLiteralExpression(n)) {
      if (n.elements.some((el) => ts.isSpreadElement(el) || ts.isOmittedExpression(el))) return undefined;
      const inputs: Record<string, Input> = {};
      n.elements.forEach((el, i) => (inputs['ITEM' + i] = { block: this.expr(el) }));
      return this.block('ts_list_literal', { extraState: { itemCount: n.elements.length }, inputs });
    }

    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const list = n.expression.text;
      const arg = n.argumentExpression;
      if (arg.getText(this.sf).replace(/\s+/g, '') === `${list}.length-1`) return this.block('ts_list_last', { fields: { LIST: this.varRef(list) } });
      return this.block('ts_list_item', { fields: { LIST: this.varRef(list) }, inputs: { INDEX: { block: this.expr(arg) } } });
    }

    if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') {
      if (ts.isIdentifier(n.expression) && this.arrays.has(n.expression.text)) return this.block('ts_list_length', { fields: { LIST: this.varRef(n.expression.text) } });
      if (this.isGlobal(n.expression)) return undefined;
      return this.block('ts_length', { inputs: { VALUE: { block: this.expr(n.expression) } } });
    }

    if (ts.isPropertyAccessExpression(n) && !n.questionDotToken && ts.isIdentifier(n.name)) {
      if (this.isGlobal(n.expression)) return undefined; // Math.PI, process.argv, ...
      return this.block('ts_prop', { fields: { PROP: n.name.text }, inputs: { OBJ: { block: this.expr(n.expression) } } });
    }

    if (ts.isObjectLiteralExpression(n)) {
      const props = n.properties;
      const ok = props.every((p) => (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) || ts.isShorthandPropertyAssignment(p));
      if (!ok) return undefined;
      const fields: Record<string, string> = {};
      const inputs: Record<string, Input> = {};
      props.forEach((p, i) => {
        fields['K' + i] = (p.name as ts.Identifier | ts.StringLiteral).text;
        inputs['V' + i] = { block: ts.isShorthandPropertyAssignment(p) ? this.expr(p.name) : this.expr((p as ts.PropertyAssignment).initializer) };
      });
      return this.block('ts_object', { extraState: { count: props.length }, fields, inputs });
    }

    let awaited = false;
    let inner: ts.Expression = n;
    if (ts.isAwaitExpression(n)) {
      awaited = true;
      inner = n.expression;
    }
    if (ts.isCallExpression(inner)) return this.callExpr(inner, awaited);
    return undefined;
  }

  private callExpr(c: ts.CallExpression, awaited: boolean): BJ | undefined {
    const callee = c.expression.getText(this.sf);
    const args = c.arguments;
    if (awaited && callee === 'ask' && this.helpersAvailable.has('ask') && args.length === 1) return this.block('ts_ask', { inputs: { TEXT: { block: this.expr(args[0]) } } });
    if (awaited) {
      if (ts.isIdentifier(c.expression) && this.funcs.has(callee)) return this.userCall(c);
      return undefined;
    }
    if (callee === 'Number' && args.length === 1) {
      const a = args[0];
      if (ts.isAwaitExpression(a) && ts.isCallExpression(a.expression) && a.expression.expression.getText(this.sf) === 'ask' && this.helpersAvailable.has('ask') && a.expression.arguments.length === 1)
        return this.block('ts_ask_number', { inputs: { TEXT: { block: this.expr(a.expression.arguments[0]) } } });
      return this.block('ts_to_number', { inputs: { VALUE: { block: this.expr(a) } } });
    }
    if (callee === 'String' && args.length === 1) return this.block('ts_to_text', { inputs: { VALUE: { block: this.expr(args[0]) } } });

    const arrowCall = this.arrowMethod(c);
    if (arrowCall) return arrowCall;

    if (ts.isPropertyAccessExpression(c.expression)) {
      const target = c.expression.expression;
      const method = c.expression.name.text;
      if ((method === 'toUpperCase' || method === 'toLowerCase') && !args.length) return this.block('ts_case', { fields: { CASE: method }, inputs: { TEXT: { block: this.expr(target) } } });
      if (method === 'split' && args.length === 1) return this.block('ts_list_split', { inputs: { TEXT: { block: this.expr(target) }, SEP: { block: this.expr(args[0]) } } });
      const isArrayVar = ts.isIdentifier(target) && this.arrays.has(target.text);
      if (isArrayVar) {
        const L = { LIST: this.varRef((target as ts.Identifier).text) };
        if (method === 'includes' && args.length === 1) return this.block('ts_list_contains', { fields: L, inputs: { ITEM: { block: this.expr(args[0]) } } });
        if (method === 'indexOf' && args.length === 1) return this.block('ts_list_indexof', { fields: L, inputs: { ITEM: { block: this.expr(args[0]) } } });
        if (method === 'join' && args.length === 1) return this.block('ts_list_join', { fields: L, inputs: { SEP: { block: this.expr(args[0]) } } });
      }
      if (method === 'includes' && args.length === 1) return this.block('ts_contains', { inputs: { TEXT: { block: this.expr(target) }, PART: { block: this.expr(args[0]) } } });
    }
    if (ts.isIdentifier(c.expression) && this.funcs.has(callee)) return this.userCall(c);
    return undefined;
  }

/** list.map((item) => ...), list.filter(...), list.reduce((total, item) => ..., start) */
  private arrowMethod(c: ts.CallExpression): BJ | undefined {
    if (!ts.isPropertyAccessExpression(c.expression)) return undefined;
    const method = c.expression.name.text;
    const target = c.expression.expression;
    if (this.isGlobal(target)) return undefined;
    const one: Record<string, [string, string]> = {
      map: ['ts_arr_map', 'VALUE'],
      filter: ['ts_arr_filter', 'COND'],
      some: ['ts_arr_some', 'COND'],
      every: ['ts_arr_every', 'COND'],
      find: ['ts_arr_find', 'COND'],
      findIndex: ['ts_arr_findindex', 'COND'],
    };
    if (one[method] && c.arguments.length === 1) {
      const fn = this.simpleArrow(c.arguments[0], 1);
      if (!fn) return undefined;
      const [type, input] = one[method];
      return this.block(type, {
        fields: { VAR: this.varRef(fn.params[0].name) },
        inputs: { LIST: { block: this.expr(target) }, [input]: { block: this.expr(fn.body) } },
        data: fn.params[0].type ? JSON.stringify({ ptype: fn.params[0].type }) : undefined,
      });
    }
    if (method === 'reduce' && (c.arguments.length === 1 || c.arguments.length === 2)) {
      const fn = this.simpleArrow(c.arguments[0], 2);
      if (!fn) return undefined;
      const meta: Record<string, unknown> = {};
      if (fn.params[0].type) meta.atype = fn.params[0].type;
      if (fn.params[1].type) meta.ptype = fn.params[1].type;
      if (c.arguments.length === 1) meta.noInit = true;
      const inputs: Record<string, Input> = { LIST: { block: this.expr(target) }, VALUE: { block: this.expr(fn.body) } };
      if (c.arguments[1]) inputs.INIT = { block: this.expr(c.arguments[1]) };
      return this.block('ts_arr_reduce', {
        fields: { ACC: this.varRef(fn.params[0].name), VAR: this.varRef(fn.params[1].name) },
        inputs,
        data: Object.keys(meta).length ? JSON.stringify(meta) : undefined,
      });
    }
    return undefined;
  }

  /** An arrow function with plain parameters whose body is one value: (a, b) => a + b  or  (a) => { return a; } */
  private simpleArrow(node: ts.Expression, count: number): { params: { name: string; type?: string }[]; body: ts.Expression } | undefined {
    if (!ts.isArrowFunction(node) || node.type || node.typeParameters || hasModifier(node, ts.SyntaxKind.AsyncKeyword)) return undefined;
    if (node.parameters.length !== count || !node.parameters.every((p) => this.simpleParam(p))) return undefined;
    let body: ts.Expression | undefined;
    if (ts.isBlock(node.body)) {
      const only = node.body.statements.length === 1 ? node.body.statements[0] : undefined;
      if (only && ts.isReturnStatement(only) && only.expression && !this.text.slice(node.body.getStart(this.sf), node.body.end).match(/\/\/|\/\*/)) body = only.expression;
    } else body = node.body;
    if (!body) return undefined;
    return { params: node.parameters.map((p) => ({ name: (p.name as ts.Identifier).text, type: p.type?.getText(this.sf) })), body };
  }

  private simpleParam(p: ts.ParameterDeclaration): boolean {
    return ts.isIdentifier(p.name) && !p.initializer && !p.dotDotDotToken && !p.questionToken;
  }

  /** A name that is not declared in this file (Math, console, process, imports ...). */
  private isGlobal(n: ts.Expression): boolean {
    return ts.isIdentifier(n) && !this.declared.has(n.text) && !this.funcs.has(n.text);
  }

  private userCall(c: ts.CallExpression): BJ | undefined {
    const name = c.expression.getText(this.sf);
    const params = this.funcs.get(name)!.params;
    if (params.length !== c.arguments.length) return undefined;
    const inputs: Record<string, Input> = {};
    c.arguments.forEach((a, i) => (inputs['ARG' + i] = { block: this.expr(a) }));
    return this.block('procedures_callreturn', { extraState: { name, params }, inputs });
  }

  /** Math.floor(Math.random() * (B - A + 1)) + A */
  private randomPattern(n: ts.BinaryExpression): BJ | undefined {
    if (n.operatorToken.kind !== ts.SyntaxKind.PlusToken) return undefined;
    const t = n.getText(this.sf).replace(/\s+/g, '');
    const m = /^Math\.floor\(Math\.random\(\)\*\((.+)-(.+)\+1\)\)\+(.+)$/.exec(t);
    if (!m || m[2] !== m[3]) return undefined;
    const left = n.left as ts.CallExpression;
    const mul = left.arguments?.[0] as ts.BinaryExpression;
    const paren = mul?.right as ts.ParenthesizedExpression;
    const plus = paren?.expression as ts.BinaryExpression;
    const minus = plus?.left as ts.BinaryExpression;
    if (!minus || !ts.isBinaryExpression(minus)) return undefined;
    return this.block('ts_random', { inputs: { FROM: { block: this.expr(n.right) }, TO: { block: this.expr(minus.left) } } });
  }
}

function hasModifier(n: ts.Node, kind: ts.SyntaxKind): boolean {
  return (ts.canHaveModifiers(n) ? ts.getModifiers(n) ?? [] : []).some((m) => m.kind === kind);
}

function usesIdentifier(node: ts.Node, name: string): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isIdentifier(n) && n.text === name) found = true;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function linkAll(blocks: BJ[]): BJ | undefined {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
