/**
 * Auto-update from GitHub Releases.
 * Checks at start-up (at most every 6 hours), downloads the .vsix of a newer release,
 * verifies its SHA-256 against the checksum GitHub published, then installs it.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { downloadVerified, isNewer, pickUpdate, Release, UpdateInfo } from './updaterCore';
import { tr, trf, setLang } from './i18n';

const REPO = 'LukasVitek67/typeblocks';
const EVERY_MS = 6 * 60 * 60 * 1000;
const LAST_CHECK = 'typeblocks.lastUpdateCheck';
const SKIPPED = 'typeblocks.skippedVersion';

export function activateUpdater(ctx: vscode.ExtensionContext, lang: () => 'cs' | 'en'): void {
  const say = <T>(fn: () => T): T => {
    setLang(lang());
    return fn();
  };
  const run = (manual: boolean) => void check(ctx, manual, say);

  ctx.subscriptions.push(vscode.commands.registerCommand('typeblocks.checkUpdate', () => run(true)));

  const mode = () => vscode.workspace.getConfiguration('typeblocks').get<string>('autoUpdate', 'auto');
  if (mode() === 'off') return;
  const last = ctx.globalState.get<number>(LAST_CHECK, 0);
  const wait = Math.max(8_000, last + EVERY_MS - Date.now());
  const t = setTimeout(() => run(false), wait);
  ctx.subscriptions.push({ dispose: () => clearTimeout(t) });
}

async function latest(): Promise<UpdateInfo | undefined> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'User-Agent': 'typeblocks-updater', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return pickUpdate((await res.json()) as Release);
}

async function check(ctx: vscode.ExtensionContext, manual: boolean, say: <T>(fn: () => T) => T): Promise<void> {
  try {
    await ctx.globalState.update(LAST_CHECK, Date.now());
    const current = String(ctx.extension.packageJSON.version);
    const info = await latest();
    if (!info || !isNewer(info.version, current)) {
      if (manual) void vscode.window.showInformationMessage(say(() => trf('TypeBlocks {0} is up to date.', current)));
      return;
    }
    if (!manual && ctx.globalState.get<string>(SKIPPED) === info.version) return;

    const mode = vscode.workspace.getConfiguration('typeblocks').get<string>('autoUpdate', 'auto');
    if (mode === 'ask' || !info.sha256) {
      // Without a published checksum nothing is installed on its own.
      const labels = say(() => ({ update: tr('Update'), later: tr('Later'), skip: tr('Skip this version'), page: tr('Open release page') }));
      const buttons = info.sha256 ? [labels.update, labels.later, labels.skip] : [labels.page, labels.later];
      const pick = await vscode.window.showInformationMessage(
        say(() => trf('TypeBlocks {0} is available (you have {1}).', info.version, current)),
        ...buttons,
      );
      if (pick === labels.skip) await ctx.globalState.update(SKIPPED, info.version);
      if (pick === labels.page && info.page) void vscode.env.openExternal(vscode.Uri.parse(info.page));
      if (pick !== labels.update) return;
    }
    await install(ctx, info, say);
  } catch (err) {
    if (manual) void vscode.window.showWarningMessage(say(() => trf('Could not check for updates: {0}', String((err as Error).message ?? err))));
  }
}

async function install(ctx: vscode.ExtensionContext, info: UpdateInfo, say: <T>(fn: () => T) => T): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: say(() => trf('Updating TypeBlocks to {0} ...', info.version)) },
    async () => {
      const data = await downloadVerified(info.url, info.sha256!);
      await vscode.workspace.fs.createDirectory(ctx.globalStorageUri);
      const file = vscode.Uri.joinPath(ctx.globalStorageUri, `typeblocks-${info.version}.vsix`); // version is digits and dots only
      await vscode.workspace.fs.writeFile(file, data);
      try {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', file);
      } finally {
        fs.rm(file.fsPath, { force: true }, () => undefined);
      }
    },
  );
  const reload = say(() => tr('Reload'));
  const pick = await vscode.window.showInformationMessage(say(() => trf('TypeBlocks was updated to {0}. Reload VS Code to start using it.', info.version)), reload);
  if (pick === reload) void vscode.commands.executeCommand('workbench.action.reloadWindow');
}
