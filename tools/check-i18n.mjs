// Lists texts in the source that have no Czech translation (so they would stay English).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const b = await esbuild.build({ entryPoints: [path.join(root, 'src/i18n.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const file = path.join(root, '.test-tmp', 'i18n.cjs');
fs.writeFileSync(file, b.outputFiles[0].text);
const { tr, setLang } = require(file);
setLang('cs');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const src = read('src/webview/blocks.ts') + read('src/webview/main.ts') + read('src/webview/console.ts') + read('src/page.ts');
const same = new Set(['%1 %2 %3 ?', 'list[list.length - 1]', 'for ( %1 )', '// %1', '%1 %2 : %3 = %4', '%1 %2 %3', 'Stop', 'Test', 'OK', 'Code', 'Text', 'min', 'forever', '%1', '%1 as %2', 'doSomething', 'calculate']);
// tooltips that are just a code snippet (list.includes(item), !value ...) stay as they are
const isCode = (k) => /^[\w.!\[\](){}"=,<>\s/-]*$/.test(k) && /[.()!\[\]]/.test(k) && !/ - /.test(k) && !/ (removes|puts)/.test(k);
const unescape = (s) => s.replace(/\\'/g, "'");
const miss = new Set();
const patterns = [/(?:message\d|tooltip): '((?:[^'\\]|\\.)*)'/g, /\btrf?\('((?:[^'\\]|\\.)*)'/g, /\btrf?\("((?:[^"\\]|\\.)*)"/g];
for (const re of patterns) {
  for (const m of src.matchAll(re)) {
    const k = unescape(m[1]);
    if (k && !same.has(k) && !isCode(k) && tr(k) === k) miss.add(k);
  }
}
console.log(miss.size ? `Untranslated (${miss.size}):\n- ` + [...miss].join('\n- ') : 'all texts have a Czech translation');
process.exit(miss.size ? 1 : 0);
