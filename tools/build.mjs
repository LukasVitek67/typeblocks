// Builds the extension host bundle, the webview bundle, copies Blockly media,
// draws the icon and writes a browser preview page (preview/index.html).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');
const r = (...p) => path.join(root, ...p);

// ---- Blockly media (cursors, sprites) ----
const mediaSrc = r('node_modules/blockly/media');
const mediaDst = r('media/blockly');
fs.mkdirSync(mediaDst, { recursive: true });
for (const f of fs.readdirSync(mediaSrc)) if (!f.endsWith('.mp3') && !f.endsWith('.wav') && !f.endsWith('.ogg')) fs.copyFileSync(path.join(mediaSrc, f), path.join(mediaDst, f));

// ---- icon.png (two snapped blocks) ----
writeIcon(r('media/icon.png'), 128);

// ---- converter module (preview page, guide and recipes use it) ----
const page = await esbuild.build({
  stdin: {
    contents: "export * from './src/page'; export * from './src/convert/tsToBlocks'; export * from './src/starter'; export * from './src/guide/content'; export * from './src/guide/content.en'; export * from './src/guide/page'; export * from './src/presets';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['typescript'],
});
fs.mkdirSync(r('.test-tmp'), { recursive: true });
const pageFile = r('.test-tmp', 'page.cjs'); // inside the project, so `typescript` resolves from node_modules
fs.writeFileSync(pageFile, page.outputFiles[0].text);
const mod = createRequire(import.meta.url)(pageFile);
// ---- recipes: every preset converted to blocks, bundled into the webview ----
const RAW = /"type":"ts_(code_expr|code_stmt|for_raw)"/;
const presetData = { groups: mod.PRESET_GROUPS, presets: mod.PRESETS.map((p) => {
  const out = { id: p.id, group: p.group };
  for (const lang of ['cs', 'en']) {
    const ws = mod.tsToBlocks(p[lang].code).workspace;
    if (RAW.test(JSON.stringify(ws))) throw new Error('recipe ' + p.id + ' (' + lang + ') has a raw-code block - the converter does not understand part of it');
    out[lang] = { ...p[lang], workspace: ws };
  }
  return out;
}) };
fs.writeFileSync(r('src/webview/presets.data.json'), JSON.stringify(presetData));

// ---- bundles ----
const common = { bundle: true, sourcemap: !minify, minify, logLevel: 'info' };
const host = { ...common, entryPoints: [r('src/extension.ts')], platform: 'node', target: 'node18', format: 'cjs', external: ['vscode'], outfile: r('dist/extension.js') };
const web = { ...common, entryPoints: [r('src/webview/main.ts')], platform: 'browser', target: 'es2022', format: 'iife', outfile: r('media/webview.js') };
const guide = { ...common, sourcemap: false, entryPoints: [r('src/guide/guide.ts')], platform: 'browser', target: 'es2022', format: 'iife', outfile: r('media/guide.js') };

if (watch) {
  for (const o of [host, web, guide]) await (await esbuild.context(o)).watch();
} else {
  await Promise.all([esbuild.build(host), esbuild.build(web), esbuild.build(guide)]);
}

// ---- preview page (open in a browser, no VS Code needed) ----
fs.mkdirSync(r('preview'), { recursive: true });
fs.writeFileSync(r('preview/index.html'), mod.pageHtml({ css: '../media/editor.css', js: '../media/webview.js', blocklyMedia: '../media/blockly/', lang: process.env.PREVIEW_LANG, previewWorkspace: mod.tsToBlocks(process.env.PREVIEW_FILE ? fs.readFileSync(process.env.PREVIEW_FILE, 'utf8') : mod.STARTER_TS).workspace }));

// ---- guide: every example converted to blocks (media/guide-data.<lang>.js) + web copies in docs/guide ----
const stamp = JSON.parse(fs.readFileSync(r('package.json'), 'utf8')).version + '-' + Date.now().toString(36);
const UI = {
  cs: { tryTitle: 'Vyzkoušej si to', reset: 'Obnovit', resetTitle: 'Vrátit příklad do původní podoby', run: 'Spustit', output: 'Výstup', answer: 'napiš odpověď a stiskni Enter', tryPrefix: 'Zkus: ', why: 'Proč?' },
  en: { tryTitle: 'Try it', reset: 'Reset', resetTitle: 'Back to the original example', run: 'Run', output: 'Output', answer: 'type an answer, then Enter', tryPrefix: 'Try: ', why: 'Why?' },
};
const SECTIONS = { cs: mod.SECTIONS_CS, en: mod.SECTIONS_EN };
for (const lang of ['cs', 'en']) {
  const workspaces = {};
  for (const s of SECTIONS[lang]) if (s.code) workspaces[s.id] = mod.tsToBlocks(s.code).workspace;
  const data = `window.GUIDE_DATA = ${JSON.stringify({ ui: UI[lang], sections: SECTIONS[lang], workspaces }).replace(/</g, '\\u003c')};\n`;
  fs.writeFileSync(r('media', `guide-data.${lang}.js`), data);
}
for (const old of ['media/guide-data.js', 'docs/guide/guide-data.js']) fs.rmSync(r(old), { force: true });
const docs = r('docs/guide');
fs.mkdirSync(path.join(docs, 'blockly'), { recursive: true });
fs.mkdirSync(path.join(docs, 'en'), { recursive: true });
for (const f of ['guide.js', 'guide-data.cs.js', 'guide-data.en.js', 'guide.css']) fs.copyFileSync(r('media', f), path.join(docs, f));
for (const f of fs.readdirSync(mediaDst)) fs.copyFileSync(path.join(mediaDst, f), path.join(docs, 'blockly', f));
// Czech at /guide/, English at /guide/en/
fs.writeFileSync(path.join(docs, 'index.html'), mod.guidePageHtml({ lang: 'cs', css: [`guide.css?v=${stamp}`], scripts: [`guide-data.cs.js?v=${stamp}`, `guide.js?v=${stamp}`], blocklyMedia: 'blockly/', alt: { href: 'en/', label: 'English' } }));
fs.writeFileSync(path.join(docs, 'en', 'index.html'), mod.guidePageHtml({ lang: 'en', css: [`../guide.css?v=${stamp}`], scripts: [`../guide-data.en.js?v=${stamp}`, `../guide.js?v=${stamp}`], blocklyMedia: '../blockly/', alt: { href: '../', label: 'Česky' } }));

function writeIcon(file, size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 128;
  const rects = [
    // [x, y, w, h, radius, color]
    [10, 18, 74, 40, 10, [0xef, 0x7d, 0x1a]],
    [26, 54, 18, 12, 4, [0xef, 0x7d, 0x1a]], // tab sticking into the block below
    [34, 66, 84, 42, 10, [0x2f, 0x7f, 0xdb]],
  ];
  const inside = (x, y, [rx, ry, w, h, rad]) => {
    rx *= s; ry *= s; w *= s; h *= s; rad *= s;
    if (x < rx || y < ry || x >= rx + w || y >= ry + h) return false;
    const cx = Math.min(Math.max(x, rx + rad), rx + w - rad);
    const cy = Math.min(Math.max(y, ry + rad), ry + h - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let c = null;
      for (const rc of rects) if (inside(x + 0.5, y + 0.5, rc)) c = rc[5];
      const i = (y * size + x) * 4;
      if (c) {
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
      }
    }
  // "TS" bars on the blue block (simple white glyph strokes)
  const white = (x0, y0, w, h) => {
    for (let y = Math.round(y0 * s); y < Math.round((y0 + h) * s); y++)
      for (let x = Math.round(x0 * s); x < Math.round((x0 + w) * s); x++) {
        const i = (y * size + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = 255;
      }
  };
  white(52, 76, 22, 5); white(60, 76, 6, 23); // T
  white(80, 76, 20, 5); white(80, 76, 6, 13); white(80, 85, 20, 5); white(94, 85, 6, 14); white(80, 94, 20, 5); // S
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return crc ^ 0xffffffff;
}
