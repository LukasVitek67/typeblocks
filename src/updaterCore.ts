/** The parts of the updater that do not need VS Code (so they can be tested). */
import { createHash } from 'node:crypto';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string | null;
}

export interface Release {
  tag_name: string;
  html_url?: string;
  assets: ReleaseAsset[];
}

export interface UpdateInfo {
  version: string;
  url: string;
  size: number;
  sha256: string | undefined;
  page: string | undefined;
}

const VERSION = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;

/** "v0.6.0" -> "0.6.0", or undefined when it does not look like a plain version. */
export function cleanVersion(tag: string): string | undefined {
  const m = VERSION.exec(tag.trim());
  return m ? `${m[1]}.${m[2]}.${m[3]}` : undefined;
}

export function isNewer(latest: string, current: string): boolean {
  const a = VERSION.exec(latest);
  const b = VERSION.exec(current);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    const d = Number(a[i]) - Number(b[i]);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The .vsix of a release, with the checksum GitHub computed for it ("sha256:<hex>"). */
export function pickUpdate(release: Release): UpdateInfo | undefined {
  const version = cleanVersion(release.tag_name);
  const asset = release.assets?.find((a) => a.name.toLowerCase().endsWith('.vsix'));
  if (!version || !asset) return undefined;
  const digest = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? '');
  return {
    version,
    url: asset.browser_download_url,
    size: asset.size,
    sha256: digest ? digest[1].toLowerCase() : undefined,
    page: release.html_url,
  };
}

export const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Only GitHub download addresses are accepted. */
export function isGithubUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname === 'api.github.com' || url.hostname.endsWith('.githubusercontent.com'));
  } catch {
    return false;
  }
}

export async function downloadVerified(url: string, expected: string, maxBytes = 60 * 1024 * 1024): Promise<Uint8Array> {
  if (!isGithubUrl(url)) throw new Error('not a GitHub address');
  const res = await fetch(url, { headers: { 'User-Agent': 'typeblocks-updater' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  if (res.url && !isGithubUrl(res.url)) throw new Error('redirected away from GitHub');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('file too large');
  if (sha256(buf) !== expected) throw new Error('checksum does not match - not installing');
  return buf;
}
