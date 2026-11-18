// Every runnable guide example (Czech + English): converts fully into blocks, runs without errors,
// and both languages have the same chapters.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const b = await esbuild.build({
  stdin: { contents: "export * from './src/guide/content'; export * from './src/guide/content.en'; export * from './src/convert/tsToBlocks';", resolveDir: root, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['typescript'],
});
const file = path.join(root, '.test-tmp', 'guide-test.cjs');
fs.writeFileSync(file, b.outputFiles[0].text);
const { SECTIONS_CS, SECTIONS_EN, tsToBlocks } = require(file);
const ts = require('typescript');

let failed = 0;
const fail = (m) => {
  failed++;
  console.log('FAIL ' + m);
};

const ids = (l) => l.map((s) => s.id).join(',');
if (ids(SECTIONS_CS) !== ids(SECTIONS_EN)) fail('Czech and English guides have different chapters');

for (const [lang, sections] of [['cs', SECTIONS_CS], ['en', SECTIONS_EN]]) {
  let ran = 0;
  for (const s of sections) {
    if (!s.code) continue;
    const conv = tsToBlocks(s.code);
    if (s.id !== 'kod' && conv.rawCount) fail(`${lang}/${s.id}: ${conv.rawCount} part(s) became raw code blocks`);
    if (!s.run) continue;
    const js = ts.transpileModule(s.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const out = [];
    const sandbox = {
      console: { log: (...a) => out.push(a.join(' ')) },
      ask: async (q) => (/old|let|Kolik/i.test(q) ? '12' : 'Ann'),
      sleep: async () => {},
      sayColored: (v) => out.push(String(v)),
      process: { exit: () => {} },
    };
    try {
      await vm.runInNewContext(`(async () => { ${js}\n })()`, sandbox, { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 20));
      if (!out.length) fail(`${lang}/${s.id}: printed nothing`);
      else ran++;
    } catch (e) {
      fail(`${lang}/${s.id}: ${e.message}`);
    }
  }
  console.log(`${failed ? '    ' : 'ok  '} ${lang}: ${ran} examples ran`);
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
