// Where the data is: Set processes file, Choose data folder, and the gsdiagram.folder setting.

import path from 'node:path';
import { expect, test } from '../fixtures';

const OTHER = '# Other\n\n## Orders\n\n- **ORDE2 Send an order.** Press Send.\n- **ORDE9 Ship an order.** Press Ship.\n';

test('Set processes file writes the chosen file into config.json and checks against it', async ({ vscode }) => {
  await vscode.write('docs/other.md', OTHER);
  await vscode.command('GSDiagram: Set processes file', { asks: true });
  await vscode.pickInDialog(vscode.file('docs/other.md'));

  await expect.poll(async () => JSON.parse(await vscode.read('.gsdiagram/config.json'))).toEqual({ processesFile: 'docs/other.md' });
  await vscode.openProblems();
  await expect(vscode.problem('ORDE1 is not in docs/other.md.')).toBeVisible();
  await expect(vscode.problem('ORDE9')).toHaveCount(0);
  await vscode.open('docs/other.md');
  await expect(vscode.codeLenses()).toHaveText(['in order', 'in order']);
});

test('Set processes file refuses a file outside the project', async ({ vscode }) => {
  const outside = path.join(vscode.temp, 'outside.md');
  await vscode.write(path.relative(vscode.project, outside), OTHER);
  await vscode.command('GSDiagram: Set processes file', { asks: true });
  await vscode.pickInDialog(outside);
  await expect(vscode.notification('GSDiagram: the processes file must be inside the project.')).toBeVisible();
  expect(JSON.parse(await vscode.read('.gsdiagram/config.json'))).toEqual({ processesFile: 'docs/processes.md' });
});

test('Set processes file, cancelled, changes nothing', async ({ vscode }) => {
  await vscode.command('GSDiagram: Set processes file', { asks: true });
  await vscode.page.keyboard.press('Escape');
  await expect(vscode.quickInput()).toBeHidden();
  expect(JSON.parse(await vscode.read('.gsdiagram/config.json'))).toEqual({ processesFile: 'docs/processes.md' });
});

test('Choose data folder stores the folder in the project settings and uses it', async ({ vscode }) => {
  await vscode.write('diagrams/config.json', JSON.stringify({ processesFile: 'docs/processes.md' }));
  await vscode.write('diagrams/cancel.diagram.json', JSON.stringify({
    title: 'Cancel', nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'a', label: 'Cancel', process: 'ORDE3' }],
  }));
  await vscode.command('GSDiagram: Choose data folder', { asks: true });
  await vscode.pickInDialog(vscode.file('diagrams'), { folder: true });

  await expect.poll(async () => JSON.parse(await vscode.read('.vscode/settings.json'))['gsdiagram.folder']).toBe('diagrams');
  await vscode.open('docs/processes.md');
  await expect(vscode.codeLenses()).toHaveText(['in no diagram', 'in no diagram', 'in cancel']);
  await vscode.openProblems();
  await expect(vscode.problem('ORDE1 Create an order is in no diagram.')).toBeVisible();
  await expect(vscode.problem('ORDE9')).toHaveCount(0);
});

test('Choose data folder refuses a folder outside the project', async ({ vscode }) => {
  await vscode.command('GSDiagram: Choose data folder', { asks: true });
  await vscode.pickInDialog(vscode.temp, { folder: true });
  await expect(vscode.notification('GSDiagram: the data folder must be inside the project.')).toBeVisible();
  await expect(vscode.read('.vscode/settings.json')).rejects.toThrow();
});

test('a data folder setting outside the project is refused, once', async ({ vscode }) => {
  await vscode.write('.vscode/settings.json', JSON.stringify({ 'gsdiagram.folder': '../elsewhere' }));
  await expect(vscode.notification(/GSDiagram: The data folder .*elsewhere is outside the project/)).toBeVisible();
  await vscode.openProblems();
  await expect(vscode.problems()).toHaveCount(0);

  await vscode.clearNotifications();
  await vscode.command('GSDiagram: Check');
  await expect(vscode.notification('GSDiagram: 0 errors, 0 warnings, 0 processes in no diagram.')).toBeVisible();
  await expect(vscode.notification(/is outside the project/)).toHaveCount(0);
});

test('without a processes file the diagrams still work, and nothing is checked', async ({ vscode }) => {
  await vscode.write('.gsdiagram/config.json', '{}\n');
  await vscode.openProblems();
  await expect(vscode.problems()).toHaveCount(0);
  await vscode.open('.gsdiagram/order.diagram.json');
  const d = vscode.diagram();
  await d.waitForDrawing();
  expect(await d.edgeStroke('Ship')).toBe(await d.themeColour('--vscode-editorLineNumber-foreground'));
  await d.edgeLabel('Ship').click();
  await expect(d.detail()).toContainText('No processes file is set. Run GSDiagram: Set processes file.');
});
