// Starts the real VS Code with the extension on a fresh copy of test/fixture, and drives it as a user would:
// the command palette, the Problems panel, editors, notifications, and the page inside the GSDiagram editor.

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { _electron, ElectronApplication, expect, FrameLocator, Locator, Page } from '@playwright/test';

const root = path.resolve(__dirname, '../../..');

// Where the title bar menu has what each key does.
const MENU = {
  'F1': ['View', 'Command Palette...'],
  'Control+P': ['Go', 'Go to File...'],
  'Control+G': ['Go', 'Go to Line/Column...'],
} as const;
const VERSION = '1.144.0';

const SETTINGS = {
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.enableExperiments': false,
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'window.titleBarStyle': 'custom',
  'window.restoreWindows': 'none',
  'window.commandCenter': false,
  'security.workspace.trust.enabled': false,
  // The open dialogs of Choose data folder and Set processes file show in the window, where the test can use them.
  'files.simpleDialog.enable': true,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.ignoreRecommendations': true,
  'git.enabled': false,
  'chat.disableAIFeatures': true,
  'editor.hover.delay': 200,
  'editor.minimap.enabled': false,
  'editor.autoClosingBrackets': 'never',
  'editor.autoClosingQuotes': 'never',
  'editor.autoIndent': 'none',
  'editor.formatOnType': false,
  'editor.acceptSuggestionOnEnter': 'off',
  'editor.quickSuggestions': { other: false, comments: false, strings: false },
};

export class VSCode {
  private constructor(readonly app: ElectronApplication, readonly page: Page, readonly project: string, readonly temp: string) {}

  // Each launch gets its own copy of the fixture project and its own user data, so a test may change files freely.
  static async launch(): Promise<VSCode> {
    const temp = await mkdtemp(path.join(tmpdir(), 'gsdiagram-ui-'));
    const project = path.join(temp, 'project');
    const userData = path.join(temp, 'user-data');
    await cp(path.join(root, 'test/fixture'), project, { recursive: true });
    await mkdir(path.join(userData, 'User'), { recursive: true });
    await writeFile(path.join(userData, 'User/settings.json'), JSON.stringify(SETTINGS, null, 2));

    const app = await _electron.launch({
      // The same copy of VS Code as npm run test:vscode.
      executablePath: await downloadAndUnzipVSCode({ version: VERSION, cachePath: path.join(root, '.vscode-test') }),
      args: [
        project,
        `--extensionDevelopmentPath=${root}`,
        `--user-data-dir=${userData}`,
        `--extensions-dir=${path.join(temp, 'extensions')}`,
        '--disable-extensions',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-telemetry',
        '--disable-updates',
        '--disable-gpu',
        '--new-window',
      ],
      env: cleanEnv(),
      timeout: 60_000,
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15_000);
    await page.locator('.monaco-workbench').waitFor({ timeout: 60_000 });
    const vscode = new VSCode(app, page, project, temp);
    await vscode.waitForExtension();
    return vscode;
  }

  // The extension starts once VS Code has started; its first check has run when the processes file has its lenses.
  private async waitForExtension(): Promise<void> {
    await this.open('docs/processes.md');
    await expect(this.codeLenses()).toHaveCount(3, { timeout: 30_000 });
    await this.command('View: Close All Editors');
    await this.clearNotifications();
  }

  async close(): Promise<void> {
    await this.app.close().catch(() => {});
    await rm(this.temp, { recursive: true, force: true });
  }

  // Files of the project, by their path relative to it.
  file(rel: string): string { return path.join(this.project, rel); }
  read(rel: string): Promise<string> { return readFile(this.file(rel), 'utf8'); }
  readBytes(rel: string): Promise<Buffer> { return readFile(this.file(rel)); }
  async write(rel: string, text: string): Promise<void> {
    await mkdir(path.dirname(this.file(rel)), { recursive: true });
    await writeFile(this.file(rel), text);
  }

  quickInput(): Locator { return this.page.locator('.quick-input-widget'); }
  quickInputBox(): Locator { return this.page.locator('.quick-input-widget input'); }
  quickInputRow(text: string | RegExp): Locator { return this.page.locator('.quick-input-list .monaco-list-row', { hasText: text }); }

  // Opens the quick input with its key. A webview that has the focus can swallow the key; then the same thing is
  // done from the menu in the title bar.
  private async openQuickInput(key: 'F1' | 'Control+P' | 'Control+G'): Promise<Locator> {
    const input = this.quickInputBox();
    // The last quick input may still be closing; a key pressed now would reach it.
    await expect(this.quickInput()).toBeHidden();
    await this.leaveWebview();
    await this.page.keyboard.press(key);
    try {
      await expect(input).toBeVisible({ timeout: 2_000 });
    } catch {
      const [menu, item] = MENU[key];
      await this.page.locator('.menubar-menu-button', { hasText: menu }).click();
      await this.page.locator('.monaco-menu .action-item', { hasText: item }).first().click();
      await expect(input).toBeVisible();
    }
    return input;
  }

  // Keys pressed in a webview reach VS Code only once the webview has passed them on, and not always. When the
  // focus is in one, it is moved to the Explorer's title, as a user's click would; the editor in front stays in front.
  async leaveWebview(): Promise<void> {
    if (await this.page.evaluate(() => document.activeElement?.tagName === 'IFRAME'))
      await this.page.locator('.part.sidebar .composite.title').click();
  }

  // Runs a command from the command palette, by its title as the palette shows it.
  // A command that asks something opens the quick input again; then the test answers it.
  async command(title: string, { asks = false } = {}): Promise<void> {
    const input = await this.openQuickInput('F1');
    await input.fill(`>${title}`);
    // Enter would run the row in focus, which may be another command that matches; the row of this one is clicked.
    // Its label is the title, then perhaps its key binding or category after a comma.
    const t = title.replace(/"/g, '\\"');
    const row = this.page.locator(`.quick-input-list .monaco-list-row:is([aria-label="${t}"], [aria-label^="${t}, "])`).first();
    await row.click();
    if (asks) await expect(input).not.toHaveValue(`>${title}`);
    else await expect(this.quickInput()).toBeHidden();
  }

  // Opens a file of the project by Quick Open, in the editor VS Code picks for it.
  async open(rel: string): Promise<void> {
    const input = await this.openQuickInput('Control+P');
    // A file written a moment ago may not be found yet; it is searched for again until it is.
    await expect(async () => {
      await input.fill('');
      await input.fill(rel);
      await expect(this.quickInputRow(path.basename(rel)).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await input.press('Enter');
    await expect(this.quickInput()).toBeHidden();
    await expect(this.activeTab()).toContainText(path.basename(rel));
  }

  // Reopens the editor in front with another editor: 'Text Editor' or 'GSDiagram'.
  async reopenWith(editor: string): Promise<void> {
    await this.command('View: Reopen Editor With...', { asks: true });
    await this.quickInputRow(editor).first().click();
    await expect(this.quickInput()).toBeHidden();
  }

  activeTab(): Locator { return this.page.locator('.editor-group-container.active .tabs-container .tab.active'); }
  tabs(): Locator { return this.page.locator('.tabs-container .tab'); }

  // The text editor in the active group, and its text as shown.
  textEditor(): Locator { return this.page.locator('.editor-group-container.active .monaco-editor[data-uri]').first(); }
  async editorText(): Promise<string> {
    return (await this.textEditor().locator('.view-lines').innerText()).replace(/ /g, ' ');
  }

  codeLenses(): Locator { return this.page.locator('.editor-group-container.active .codelens-decoration > :is(a, span):not(:has-text("|"))'); }
  // A lens that can be clicked. A reopened file first shows its cached lenses, as text that does nothing, until
  // the extension has answered; a click must wait for the real ones.
  codeLensLink(text: string): Locator {
    return this.page.locator('.editor-group-container.active .codelens-decoration > a', { hasText: text });
  }
  hover(): Locator { return this.page.locator('.monaco-hover:not(.hidden)').first(); }

  // The line of the text editor in front that holds the text.
  line(text: string): Locator { return this.textEditor().locator('.view-line', { hasText: text }); }

  // Puts the cursor at the end of the line (one-based) of the text editor in front.
  async goToLine(line: number): Promise<void> {
    const input = await this.openQuickInput('Control+G');
    await input.fill(`:${line}`);
    await input.press('Enter');
    await expect(this.quickInput()).toBeHidden();
    await this.page.keyboard.press('End');
  }

  // Replaces everything in the text editor in front, as a paste would.
  async replaceText(text: string): Promise<void> {
    await this.textEditor().locator('.view-lines').click();
    await this.page.keyboard.press('Control+A');
    await this.paste(text);
  }

  // Pastes at the cursor; typed text would be completed and indented by the editor.
  async paste(text: string): Promise<void> {
    await this.app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
    await this.page.keyboard.press('Control+V');
  }

  cursorPosition(): Locator { return this.page.locator('[id="status.editor.selection"]'); }
  // The counts in the status bar, as it reads them: 'Errors: 1, Warnings: 2, Infos: 3' without the zeros, or 'No Problems'.
  problemCounts(): Locator { return this.page.locator('[id="status.problems"]'); }

  // Saves the editor in front. A key pressed just after an edit is sometimes lost; saving twice does no harm.
  async save(): Promise<void> {
    await this.leaveWebview();
    await expect(async () => {
      await this.page.keyboard.press('Control+S');
      await expect(this.activeTab()).not.toHaveClass(/\bdirty\b/, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }

  notification(text: string | RegExp): Locator { return this.page.locator('.notification-toast', { hasText: text }); }
  async clearNotifications(): Promise<void> { await this.command('Notifications: Clear All Notifications'); }

  // The Problems panel, opened; each row of its tree is a file or a finding.
  async openProblems(): Promise<void> {
    await this.command('View: Focus Problems (Errors, Warnings, Infos)');
    await this.page.locator('.markers-panel').waitFor();
  }
  // The findings in the Problems panel; the rows above them are their files.
  problems(): Locator { return this.page.locator('.markers-panel').getByRole('treeitem', { level: 2 }); }
  problem(text: string | RegExp): Locator { return this.problems().filter({ hasText: text }); }

  // The page inside the GSDiagram editor in front.
  diagram(): Diagram {
    // VS Code lays webviews over the editors, outside them; the one shown is the one in front.
    const frame = this.page.locator('iframe.webview.ready').filter({ visible: true }).contentFrame()
      .locator('#active-frame').contentFrame();
    return new Diagram(this.page, frame);
  }

  // Answers the open dialog shown in the window (files.simpleDialog.enable) with an absolute path. Enter picks a file.
  // A folder is typed with a trailing slash, which goes into it, and the dialog's button picks it.
  async pickInDialog(file: string, { folder = false } = {}): Promise<void> {
    const input = this.quickInputBox();
    await expect(this.quickInput()).toBeVisible();
    if (folder) {
      await input.fill(file.replace(/\/?$/, '/'));
      await expect(this.quickInputRow('..')).toBeVisible();
      await this.quickInput().locator('.monaco-button').first().click();
    } else {
      await input.fill(file);
      await expect(input).toHaveValue(file);
      await input.press('Enter');
    }
    await expect(this.quickInput()).toBeHidden();
  }

  // Finds text in the editor in front with the find widget, and says how many matches it has: 'No results', '1 of 2'.
  async find(text: string, group = this.page.locator('.editor-group-container.active')): Promise<Locator> {
    await group.locator('.monaco-editor[data-uri] .view-lines').first().click();
    await this.page.keyboard.press('Control+F');
    const widget = group.locator('.find-widget.visible');
    await widget.locator('.find-part textarea').fill(text);
    return widget.locator('.matchesCount');
  }
}

export class Diagram {
  constructor(private readonly page: Page, readonly frame: FrameLocator) {}

  title(): Locator { return this.frame.locator('#title'); }
  svg(): Locator { return this.frame.locator('#canvas'); }
  detail(): Locator { return this.frame.locator('#detail'); }
  problem(): Locator { return this.frame.locator('#problem'); }
  // A button by its text, or by its title for − and +.
  button(name: string): Locator {
    return this.frame.getByRole('button', { name, exact: true }).or(this.frame.getByTitle(name, { exact: true }));
  }

  nodes(): Locator { return this.frame.locator('[data-node]'); }
  node(id: string): Locator { return this.frame.locator(`[data-node="${id}"]`); }
  edges(): Locator { return this.frame.locator('[data-edge]'); }
  edge(label: string): Locator { return this.frame.locator('[data-edge]', { has: this.frame.locator('text', { hasText: label }) }); }
  edgeLabel(label: string): Locator { return this.frame.locator('[data-edge] text', { hasText: label }); }

  async waitForDrawing(): Promise<void> {
    await expect(this.nodes().first()).toBeVisible({ timeout: 30_000 });
  }

  // A colour of the VS Code theme, as the page sees it.
  async themeColour(name: string): Promise<string> {
    return this.frame.locator('body').evaluate((b, n) => getComputedStyle(b).getPropertyValue(n).trim(), name);
  }

  // The colour an arrow is drawn in, and the colour of a box's border.
  edgeStroke(label: string): Promise<string | null> { return this.edge(label).locator('polyline').nth(1).getAttribute('stroke'); }
  nodeStroke(id: string): Promise<string | null> { return this.node(id).locator('rect, circle').first().getAttribute('stroke'); }

  async position(id: string): Promise<{ x: number; y: number }> {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(await this.node(id).getAttribute('transform') ?? '')!;
    return { x: +m[1], y: +m[2] };
  }

  async width(): Promise<number> { return +(await this.svg().getAttribute('width'))!; }

  // Drags a box with the mouse, by screen pixels.
  async drag(id: string, dx: number, dy: number): Promise<void> {
    await this.node(id).scrollIntoViewIfNeeded();
    const box = (await this.node(id).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
    await this.page.mouse.move(x + dx, y + dy, { steps: 5 });
    await this.page.mouse.up();
  }

  // Clicks the empty canvas, away from every box and arrow.
  async clickBackground(): Promise<void> {
    const svg = (await this.svg().boundingBox())!;
    await this.page.mouse.click(svg.x + 5, svg.y + svg.height - 5);
  }
}

// Run from inside VS Code (its terminal, or an agent in it), the environment says to start Electron as plain Node,
// and points at that VS Code; from a snap-installed VS Code, it also points at the snap's libraries, and the test
// instance would believe it is the snap and watch it for updates. The test instance must not inherit any of it.
function cleanEnv(): Record<string, string> {
  const inherited = /^(ELECTRON_|VSCODE_|SNAP|GTK_|GDK_|GIO_|LOCPATH$)/;
  const env = Object.fromEntries(Object.entries(process.env)
    .filter((e): e is [string, string] => e[1] !== undefined && !inherited.test(e[0])));
  if (process.env.XDG_DATA_DIRS_VSCODE_SNAP_ORIG !== undefined) env.XDG_DATA_DIRS = process.env.XDG_DATA_DIRS_VSCODE_SNAP_ORIG;
  return env;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
