// Round-trip test: TypeScript -> blocks -> TypeScript.
//  - converting twice gives the same text (stable)
//  - the result type-checks with tsc --strict
//  - the result runs and prints what it should
//  - files with things blocks can't show keep that code word for word
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp', 'rt-'));
const require = createRequire(path.join(root, 'package.json'));

const bundle = await esbuild.build({
  stdin: {
    contents:
      "export * from './src/webview/generator'; export * from './src/webview/blocks'; export * from './src/convert/tsToBlocks'; export * from './src/starter';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['blockly', 'blockly/*', 'typescript'],
});
const modFile = path.join(tmp, 'all.cjs');
fs.writeFileSync(modFile, bundle.outputFiles[0].text);
const Blockly = require('blockly');
const ts = require('typescript');
const { generate, defineBlocks, tsToBlocks, STARTER_TS } = require(modFile);
defineBlocks();

function roundTrip(src, nodeTypes = true) {
  const conv = tsToBlocks(src);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(conv.workspace, ws);
  const out = generate(ws, nodeTypes, conv.style);
  ws.dispose();
  return { ts: out.ts, spans: out.spans, raw: conv.rawCount, blocks: conv.blockCount };
}

const KITCHEN = `async function main(): Promise<void> {
  let fruits: string[] = ["apple", "kiwi"];
  fruits.push("plum");
  fruits.unshift("fig");
  fruits.splice(1, 0, "pear");
  fruits[2] = "lime";
  console.log(fruits.join("|"));
  console.log(fruits[0]);
  console.log(fruits[fruits.length - 1]);
  fruits.splice(0, 1);
  fruits.pop();
  console.log(fruits.length);
  let found: boolean = fruits.includes("lime");
  if (found) {
    sayColored("has lime", 32);
  } else if (fruits.length > 5) {
    console.log("long");
  } else {
    console.log("no lime");
  }
  console.log(fruits.indexOf("lime"));
  fruits.sort();
  fruits.reverse();
  for (const fruit of fruits) {
    console.log(fruit.toUpperCase());
  }

  // numbers
  let total: number = await double(21);
  console.log("double: " + total);
  for (let n = 1; n <= 3; n++) {
    console.log(n);
  }
  for (let i = 0; i < 2; i++) {
    total++;
  }
  total -= 4;
  total += 2 * (3 + 1);
  console.log(total);
  console.log(typeof total === "number");
  console.log(typeof "x");
  console.log("banana".includes("nan"));
  console.log(Number("7") as number);
  console.log(String(5).length);
  let parts = "a,b,c".split(",");
  console.log(parts.length);
  let r: number = Math.floor(Math.random() * (5 - 5 + 1)) + 5;
  console.log(r);
  while (r < 8) {
    r++;
  }
  while (!(r > 9)) {
    r += 1;
  }
  console.log(r > 9 && r < 11 ? "ten" : "other");
  let k = 0;
  while (true) {
    k++;
    if (k > 3) {
      break;
    }
  }
  console.log(k);
  for (let j = 10; j > 8; j--) {
    console.log(j);
  }
  await sleep(0.1);
  console.log("bye");
  process.exit(0);
}
main();

async function double(n: number): Promise<number> {
  await sleep(0.01);
  return n * 2;
}

setInterval(async () => {
  console.log("tick");
}, 5 * 1000);
`;

const FOREIGN = `import * as fs from "node:fs";
// A small program written by hand.

interface Point {
  x: number;
  y: number;
}

export class Counter {
  private n = 0;
  inc(): number {
    return ++this.n;
  }
}

const greet = (who: string) => \`Hello \${who}!\`;

/* block comment */
function area(p: Point): number {
  // multiply
  const result = p.x * p.y; // inline note
  return result;
}

let points: Point[] = [{ x: 1, y: 2 }];
console.log(greet("you"), area(points[0]));
console.log(fs.existsSync("."));
`;

const BUFET = fs.readFileSync(path.join(root, 'examples', 'bufet.ts'), 'utf8');
const BUFET_CHECK = `
const o = [
  { polozka: "rohlik", pocet: 3, cenaZaKus: 4, zaplaceno: true },
  { polozka: "mleko", pocet: 1, cenaZaKus: 25, zaplaceno: false },
  { polozka: "jablko", pocet: 2, cenaZaKus: 10, zaplaceno: true },
];
console.log("some", maNezaplacene(o));
console.log("map", cenyObjednavek(o).join(","));
console.log("filter", nezaplaceneObjednavky(o).map((x) => x.polozka).join(","));
console.log("reduce", zaplacenaTrzba(o));
`;

// Array methods with arrow functions, objects, single quotes, tabs
const METHODS = `type Pet = {
	name: string;
	age: number;
};

const pets: Pet[] = [{ name: 'Rex', age: 3 }, { name: 'Mia', age: 7 }];
const names = pets.map((p) => p.name);
const old = pets.find((p) => p.age > 5);
const idx = pets.findIndex((p) => p.name === 'Mia');
const allYoung = pets.every((p) => p.age < 10);
pets.forEach((p) => {
	console.log(p.name + ' is ' + p.age);
});
pets.forEach((p) => console.log(p.age));
const total = pets.reduce((sum, p) => sum + p.age, 0);
const rex = pets[0];
rex.age = 4;
console.log(names.join('|'), old?.name, idx, allYoung, total, rex.age, Math.max(1, 2));
`;

const PARENS = [
  "let roky: number = 12;",
  "console.log(\"Za 10 let: \" + (roky + 10));",
  ...["roky - (3 - 1)", "roky - 3 - 1", "(roky + 1) * 2", "roky * 2 / 4", "roky / (2 * 3)", "2 ** 3 ** 2", "(2 ** 3) ** 2", "roky % 5 * 2", "\"a\" + 1 + 2", "1 + 2 + \"a\""].map((e) => `console.log(${e});`),
  "",
].join("\n");

const cases = [
  { name: "parentheses", src: PARENS, stdin: "", exact: true, noRaw: true, expect: ["Za 10 let: 22", "10\n8\n26\n6\n2\n512\n64\n4\na12\n3a"] },
  { name: 'bufet (screenshot)', src: BUFET, stdin: '', noRaw: true, exact: true, append: BUFET_CHECK, expect: ['some true', 'map 12,25,20', 'filter mleko', 'reduce 32'], keep: ['    return objednavky.some((objednavka) => !objednavka.zaplaceno);', 'export type Objednavka = {', '        .reduce((celkem, objednavka) => celkem + objednavka.pocet * objednavka.cenaZaKus, 0);'] },
  { name: 'array methods + tabs + single quotes', src: METHODS, stdin: '', keep: ["\tconsole.log(p.name + ' is ' + p.age);", "const pets: Pet[] = [{ name: 'Rex', age: 3 }, { name: 'Mia', age: 7 }];", 'const total = pets.reduce((sum, p) => sum + p.age, 0);'], expect: ['Rex is 3', 'Mia is 7', '3\n7', 'Rex|Mia Mia 1 true 10 4 2'] },
  { name: 'starter', src: STARTER_TS, stdin: 'Lukas\n', expect: ['Hello, Lukas', 'apple', 'kiwi', 'I know 4 fruits'] },
  { name: 'starter-no-node-types', src: STARTER_TS, nodeTypes: false, stdin: 'Ana\n', expect: ['Hello, Ana', 'I know 4 fruits'] },
  {
    name: 'kitchen-sink',
    src: KITCHEN,
    stdin: '',
    noRaw: true,
    expect: ['fig|pear|lime|kiwi|plum', 'fig', 'plum', '3', 'has lime', '1', 'PEAR', 'double: 42', '1\n2\n3', '48', 'true', 'string', 'true', '7', '1', '3', '5', 'ten', '4', '10\n9', 'bye'],
  },
  {
    name: 'foreign',
    src: FOREIGN,
    stdin: '',
    keep: ['import * as fs from "node:fs";', '// A small program written by hand.', 'interface Point {', 'export class Counter {', '    return ++this.n;', 'const greet = (who: string) => `Hello ${who}!`;', '/* block comment */', '  // multiply', '// inline note', '[{ x: 1, y: 2 }]'],
    expect: ['Hello you! 2', 'true'],
  },
];

let failed = 0;
for (const c of cases) {
  const problems = [];
  const a = roundTrip(c.src, c.nodeTypes !== false);
  const b = roundTrip(a.ts, c.nodeTypes !== false);
  if (a.ts !== b.ts) problems.push('not stable: converting the output again gives different text\n' + diff(a.ts, b.ts));
  if (c.exact && a.ts !== c.src) problems.push('not identical to the original file\n' + diff(c.src, a.ts));
  if (c.noRaw && a.raw) problems.push(`${a.raw} part(s) became raw code blocks`);
  for (const k of c.keep ?? []) if (!a.ts.includes(k)) problems.push(`lost: ${k}`);
  if (!a.spans.length) problems.push('no line spans');

  const tsFile = path.join(tmp, c.name + '.ts');
  fs.writeFileSync(tsFile, a.ts);
  if (c.name !== 'foreign') {
    try {
      execFileSync(process.execPath, [
        require.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--lib', c.nodeTypes === false ? 'es2022,dom' : 'es2022', '--moduleDetection', 'force',
        ...(c.nodeTypes === false ? ['--typeRoots', path.join(tmp, 'none')] : ['--types', 'node', '--typeRoots', path.join(root, 'node_modules/@types')]),
        tsFile,
      ], { stdio: 'pipe' });
    } catch (e) {
      problems.push(`tsc: ${e.stdout}${e.stderr}`);
    }
  }

  const js = ts.transpileModule(a.ts + (c.append ?? ''), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const jsFile = path.join(tmp, c.name + '.cjs');
  fs.writeFileSync(jsFile, js);
  const run = spawnSync(process.execPath, [jsFile], { input: c.stdin, encoding: 'utf8', timeout: 15000, cwd: tmp });
  const plain = (run.stdout + run.stderr).replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
  let pos = 0;
  for (const e of c.expect) {
    const i = plain.indexOf(e, pos);
    if (i < 0) {
      problems.push(`missing output "${e}" (after position ${pos})`);
      break;
    }
    pos = i + e.length;
  }
  if (run.status !== 0 && c.name !== 'kitchen-sink') problems.push(`exit ${run.status}`);

  if (problems.length) {
    failed++;
    console.log(`FAIL ${c.name}\n  - ${problems.join('\n  - ')}\n---- ${c.name}.ts ----\n${a.ts}\n---- output ----\n${plain}`);
  } else {
    console.log(`ok   ${c.name}  (${a.blocks} blocks, ${a.raw} raw, ${a.ts.split('\n').length} lines)`);
  }
}
console.log(failed ? `${failed} FAILED` : 'all passed');
if (!failed) fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

function diff(x, y) {
  const a = x.split('\n');
  const b = y.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return `  line ${i + 1}:\n    1st: ${a[i]}\n    2nd: ${b[i]}`;
  return '';
}
