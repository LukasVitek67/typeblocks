// Tests for the updater: version compare, picking the .vsix, checksum handling,
// and (needs internet) a real download of the latest GitHub release verified against GitHub's checksum.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const out = await esbuild.build({ entryPoints: [path.join(root, 'src/updaterCore.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const file = path.join(root, '.test-tmp', 'updaterCore.cjs');
fs.writeFileSync(file, out.outputFiles[0].text);
const { isNewer, cleanVersion, pickUpdate, isGithubUrl, downloadVerified, sha256 } = require(file);

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

eq('0.6.0 newer than 0.5.0', isNewer('0.6.0', '0.5.0'), true);
eq('v0.10.0 newer than 0.9.9', isNewer('v0.10.0', '0.9.9'), true);
eq('same version is not newer', isNewer('0.5.0', '0.5.0'), false);
eq('older is not newer', isNewer('0.4.9', '0.5.0'), false);
eq('junk is never newer', isNewer('latest', '0.5.0'), false);
eq('cleanVersion', [cleanVersion('v1.2.3'), cleanVersion('1.2.3-beta'), cleanVersion('../../x')], ['1.2.3', undefined, undefined]);

const digest = 'a'.repeat(64);
const rel = { tag_name: 'v0.6.0', html_url: 'https://github.com/x/y/releases/tag/v0.6.0', assets: [{ name: 'notes.txt', browser_download_url: 'https://github.com/n', size: 1 }, { name: 'typeblocks-0.6.0.vsix', browser_download_url: 'https://github.com/x/y/releases/download/v0.6.0/typeblocks-0.6.0.vsix', size: 10, digest: 'sha256:' + digest }] };
eq('pickUpdate', pickUpdate(rel)?.sha256, digest);
eq('no digest -> undefined sha256', pickUpdate({ ...rel, assets: [{ ...rel.assets[1], digest: null }] })?.sha256, undefined);
eq('bad digest ignored', pickUpdate({ ...rel, assets: [{ ...rel.assets[1], digest: 'md5:abc' }] })?.sha256, undefined);
eq('no vsix -> undefined', pickUpdate({ ...rel, assets: [rel.assets[0]] }), undefined);
eq('bad tag -> undefined', pickUpdate({ ...rel, tag_name: 'nightly' }), undefined);
eq('only github urls', [isGithubUrl('https://github.com/a/b'), isGithubUrl('https://objects.githubusercontent.com/x'), isGithubUrl('https://evil.example/x'), isGithubUrl('http://github.com/x'), isGithubUrl('https://github.com.evil.example/x')], [true, true, false, false, false]);

let refused = '';
try {
  await downloadVerified('https://evil.example/a.vsix', digest);
} catch (e) {
  refused = e.message;
}
eq('refuses non-GitHub download', refused, 'not a GitHub address');

// ---- live: real release, real checksum ----
try {
  const res = await fetch('https://api.github.com/repos/LukasVitek67/typeblocks/releases/latest', { headers: { 'User-Agent': 'typeblocks-updater' } });
  const info = pickUpdate(await res.json());
  if (!info) throw new Error('no release found');
  eq('live: GitHub publishes a sha256 digest', typeof info.sha256, 'string');
  const data = await downloadVerified(info.url, info.sha256);
  eq('live: download matches checksum', sha256(data), info.sha256);
  let bad = '';
  try {
    await downloadVerified(info.url, '0'.repeat(64));
  } catch (e) {
    bad = e.message;
  }
  eq('live: wrong checksum is rejected', bad.startsWith('checksum does not match'), true);
} catch (e) {
  console.log('skip live test (no internet?):', e.message);
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
