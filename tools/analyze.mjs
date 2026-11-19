// Analyse .ts files: how much becomes blocks, which code stays raw, is the round trip stable?
// usage: node tools/analyze.mjs <file.ts> [...]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const require = createRequire(path.join(root, 'package.json'));
const bundle = await esbuild.build({
  stdin: { contents: "export * from './src/webview/generator'; export * from './src/webview/blocks'; export * from './src/convert/tsToBlocks';", resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['blockly', 'blockly/*', 'typescript'],
});
const modFile = path.join(root, '.test-tmp', 'analyze.cjs');
fs.writeFileSync(modFile, bundle.outputFiles[0].text);
const Blockly = require('blockly');
const { generate, defineBlocks, tsToBlocks } = require(modFile);
defineBlocks();

for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8');
  const conv = tsToBlocks(src, path.basename(f));
  const raws = [];
  const walk = (b) => {
    if (!b || typeof b !== 'object') return;
    if (Array.isArray(b)) return b.forEach(walk);
    if (b.type === 'ts_code_stmt' || b.type === 'ts_code_expr' || b.type === 'ts_for_raw') raws.push(b.type + ' ' + JSON.stringify(b.fields ?? b.extraState ?? {}).slice(0, 140));
    for (const v of Object.values(b)) walk(v);
  };
  walk(conv.workspace.blocks);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(conv.workspace, ws);
  const out = generate(ws, true, conv.style).ts;
  ws.dispose();
  const conv2 = tsToBlocks(out, path.basename(f));
  const ws2 = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(conv2.workspace, ws2);
  const out2 = generate(ws2, true, conv2.style).ts;
  ws2.dispose();
  console.log(`\n### ${f}\nblocks ${conv.blockCount}, raw ${conv.rawCount}, stable ${out === out2}`);
  for (const r of raws) console.log('  RAW: ' + r);
}
