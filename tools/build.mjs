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
const page = await esbuild.build({
  stdin: {
    contents: "export * from './src/page'; export * from './src/convert/tsToBlocks'; export * from './src/starter'; export * from './src/guide/content'; export * from './src/guide/page';",
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
fs.mkdirSync(r('preview'), { recursive: true });
fs.writeFileSync(r('preview/index.html'), mod.pageHtml({ css: '../media/editor.css', js: '../media/webview.js', blocklyMedia: '../media/blockly/', previewWorkspace: mod.tsToBlocks(process.env.PREVIEW_FILE ? fs.readFileSync(process.env.PREVIEW_FILE, 'utf8') : mod.STARTER_TS).workspace }));

// ---- guide: every example converted to blocks (media/guide-data.js) + a web copy in docs/guide ----
const stamp = JSON.parse(fs.readFileSync(r('package.json'), 'utf8')).version + '-' + Date.now().toString(36);
const workspaces = {};
for (const s of mod.SECTIONS) if (s.code) workspaces[s.id] = mod.tsToBlocks(s.code).workspace;
const guideData = `window.GUIDE_DATA = ${JSON.stringify({ sections: mod.SECTIONS, workspaces }).replace(/</g, '\\u003c')};\n`;
fs.writeFileSync(r('media/guide-data.js'), guideData);
const docs = r('docs/guide');
fs.mkdirSync(path.join(docs, 'blockly'), { recursive: true });
for (const f of ['guide.js', 'guide-data.js', 'guide.css']) fs.copyFileSync(r('media', f), path.join(docs, f));
for (const f of fs.readdirSync(mediaDst)) fs.copyFileSync(path.join(mediaDst, f), path.join(docs, 'blockly', f));
fs.writeFileSync(path.join(docs, 'index.html'), mod.guidePageHtml({ css: [`guide.css?v=${stamp}`], scripts: [`guide-data.js?v=${stamp}`, `guide.js?v=${stamp}`], blocklyMedia: 'blockly/' }));

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
