/**
 * Auto-update from GitHub Releases.
 * Checks at start-up (at most every 6 hours), downloads the .vsix of a newer release,
 * verifies its SHA-256 against the checksum GitHub published, then installs it.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { downloadVerified, isNewer, pickUpdate, Release, UpdateInfo } from './updaterCore';
import { tr, trf, setLang } from './i18n';

const REPO = 'LukasVitek67/typeblocks';
const EVERY_MS = 6 * 60 * 60 * 1000;
const LAST_CHECK = 'typeblocks.lastUpdateCheck';
const SKIPPED = 'typeblocks.skippedVersion';

let log: vscode.OutputChannel | undefined;
const note = (m: string) => log?.appendLine(`[${new Date().toLocaleTimeString()}] ${m}`);

export function activateUpdater(ctx: vscode.ExtensionContext, lang: () => 'cs' | 'en'): void {
  log = vscode.window.createOutputChannel('TypeBlocks');
  ctx.subscriptions.push(log);
  const say = <T>(fn: () => T): T => {
    setLang(lang());
    return fn();
  };
  const run = (manual: boolean) => void check(ctx, manual, say);

  ctx.subscriptions.push(vscode.commands.registerCommand('typeblocks.checkUpdate', () => run(true)));

  const mode = () => vscode.workspace.getConfiguration('typeblocks').get<string>('autoUpdate', 'auto');
  note(`TypeBlocks ${ctx.extension.packageJSON.version} started, autoUpdate = ${mode()}`);
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
    note(`checking GitHub (installed ${current})`);
    const info = await latest();
    note(info ? `latest release: ${info.version}, checksum ${info.sha256 ? 'published' : 'MISSING'}` : 'no usable release found');
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
    note(`update check failed: ${String((err as Error).stack ?? err)}`);
    if (manual) void vscode.window.showWarningMessage(say(() => trf('Could not check for updates: {0}', String((err as Error).message ?? err))));
  }
}

/** The "code" command line next to the running VS Code (code.cmd on Windows). */
function findCodeCli(): string | undefined {
  const exe = process.execPath;
  const dirs = [path.join(path.dirname(exe), 'bin'), path.join(path.dirname(exe), '..', 'Resources', 'app', 'bin'), path.join(vscode.env.appRoot, 'bin')];
  const names = process.platform === 'win32' ? ['code.cmd', 'code-insiders.cmd', 'codium.cmd'] : ['code', 'code-insiders', 'codium'];
  for (const d of dirs) for (const n of names) if (fs.existsSync(path.join(d, n))) return path.join(d, n);
  return undefined;
}

function installWithCli(vsix: string): Promise<void> {
  const cli = findCodeCli();
  if (!cli) return Promise.reject(new Error('the code command was not found'));
  return new Promise((resolve, reject) => {
    // a path to a .cmd file needs a shell on Windows; the paths are ours (VS Code folder, extension storage)
    const quote = (p: string) => '"' + p.replace(/"/g, '') + '"';
    const proc = spawn(quote(cli), ['--install-extension', quote(vsix), '--force'], { shell: true, windowsHide: true });
    let out = '';
    proc.stdout?.on('data', (d: Buffer) => (out += d.toString()));
    proc.stderr?.on('data', (d: Buffer) => (out += d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      note(`code --install-extension: exit ${code}`);
      if (code === 0) resolve();
      else reject(new Error(out.split('\n').find((l) => l.trim()) ?? `exit ${code}`));
    });
  });
}

async function install(ctx: vscode.ExtensionContext, info: UpdateInfo, say: <T>(fn: () => T) => T): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: say(() => trf('Updating TypeBlocks to {0} ...', info.version)) },
    async () => {
      note(`downloading ${info.url}`);
      const data = await downloadVerified(info.url, info.sha256!);
      note(`checksum ok (${data.length} bytes), installing`);
      await vscode.workspace.fs.createDirectory(ctx.globalStorageUri);
      const file = vscode.Uri.joinPath(ctx.globalStorageUri, `typeblocks-${info.version}.vsix`); // version is digits and dots only
      await vscode.workspace.fs.writeFile(file, data);
      try {
        try {
          await vscode.commands.executeCommand('workbench.extensions.installExtension', file);
        } catch (err) {
          note(`built-in install failed (${String((err as Error).message ?? err)}), using the code command`);
          await installWithCli(file.fsPath);
        }
      } finally {
        fs.rm(file.fsPath, { force: true }, () => undefined);
      }
    },
  );
  note(`installed ${info.version}`);
  const reload = say(() => tr('Reload'));
  const pick = await vscode.window.showInformationMessage(say(() => trf('TypeBlocks was updated to {0}. Reload VS Code to start using it.', info.version)), reload);
  if (pick === reload) void vscode.commands.executeCommand('workbench.action.reloadWindow');
}
