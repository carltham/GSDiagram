// The check: its findings in the Problems panel, the Check command, the check following edits as they are typed,
// and Accept process changes.

import { expect, test } from '../fixtures';

const DIAGRAM = '.gsdiagram/order.diagram.json';

test('the Problems panel shows the findings at their places', async ({ vscode }) => {
  await vscode.openProblems();
  await expect(vscode.problems()).toHaveCount(2);
  await expect(vscode.problem('ORDE9 is not in docs/processes.md.')).toContainText('[Ln 11, Col 55]');
  await expect(vscode.problem('ORDE3 Cancel an order is in no diagram.')).toContainText('[Ln 7, Col 1]');
  await expect(vscode.problem('ORDE9')).toContainText('GSDiagram');
  await expect(vscode.problemCounts()).toHaveAttribute('aria-label', 'Warnings: 1, Infos: 1');
});

test('a finding in the Problems panel opens the diagram at its place', async ({ vscode }) => {
  await vscode.openProblems();
  await vscode.problem('ORDE9 is not in docs/processes.md.').dblclick();
  await expect(vscode.activeTab()).toContainText('order.diagram.json');
});

test('the Check command reports the counts', async ({ vscode }) => {
  await vscode.command('GSDiagram: Check');
  await expect(vscode.notification('GSDiagram: 0 errors, 1 warnings, 1 processes in no diagram.')).toBeVisible();
});

test('typing a missing process into the processes file clears its warning, before saving', async ({ vscode }) => {
  await vscode.open(DIAGRAM);
  const d = vscode.diagram();
  await d.waitForDrawing();
  const error = await d.themeColour('--vscode-errorForeground');
  expect(await d.edgeStroke('Ship')).toBe(error);

  await vscode.command('View: Split Editor Right');
  await vscode.open('docs/processes.md');
  await vscode.goToLine(7);
  await vscode.page.keyboard.press('Enter');
  await vscode.paste('- **ORDE9 Ship an order.** Press Ship.');
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);

  await vscode.openProblems();
  await expect(vscode.problem('ORDE9')).toHaveCount(0);
  await expect(vscode.problems()).toHaveCount(1);
  // The diagram beside follows: Ship is no longer marked, and its detail shows the new process.
  await expect.poll(() => d.edgeStroke('Ship')).not.toBe(error);
  await d.edgeLabel('Ship').click();
  await expect(d.detail()).toContainText('ORDE9 Ship an order. Press Ship.');
});

test('removing a process from the processes file marks the arrows that use it', async ({ vscode }) => {
  await vscode.open(DIAGRAM);
  const d = vscode.diagram();
  await d.waitForDrawing();
  await vscode.command('View: Split Editor Right');
  await vscode.open('docs/processes.md');
  await vscode.goToLine(5);
  await vscode.page.keyboard.press('Shift+Home');
  await vscode.page.keyboard.press('Backspace');
  await vscode.openProblems();
  await expect(vscode.problem('ORDE1 is not in docs/processes.md.')).toBeVisible();
  await expect.poll(() => d.edgeStroke('Create')).toBe(await d.themeColour('--vscode-errorForeground'));
});

test('a diagram file that is not JSON is an error', async ({ vscode }) => {
  await vscode.write('.gsdiagram/broken.diagram.json', '{ "title": "Broken", ');
  await vscode.openProblems();
  await expect(vscode.problem(/Not a diagram: /)).toBeVisible();
  await expect(vscode.problemCounts()).toHaveAttribute('aria-label', /^Errors: 1,/);
});

test('an arrow to a missing node and a node id used twice are errors', async ({ vscode }) => {
  await vscode.write('.gsdiagram/bad.diagram.json', JSON.stringify({
    title: 'Bad',
    nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A again' }],
    edges: [{ from: 'a', to: 'nowhere' }],
  }, null, 2));
  await vscode.openProblems();
  await expect(vscode.problem('The node id a is used twice.')).toBeVisible();
  await expect(vscode.problem('No node has the id nowhere.')).toBeVisible();
  await expect(vscode.problemCounts()).toHaveAttribute('aria-label', /^Errors: 2,/);
});

test('a processes file that is missing is an error on config.json', async ({ vscode }) => {
  await vscode.write('.gsdiagram/config.json', JSON.stringify({ processesFile: 'docs/gone.md' }));
  await vscode.openProblems();
  await expect(vscode.problem('The processes file docs/gone.md is missing, or outside the project.')).toBeVisible();
  // Without processes, nothing else is checked.
  await expect(vscode.problems()).toHaveCount(1);
});

test('fixing a finding clears it from the Problems panel', async ({ vscode }) => {
  const text = (await vscode.read(DIAGRAM)).replace('"ORDE9"', '"ORDE3"');
  await vscode.write(DIAGRAM, text);
  await vscode.openProblems();
  await expect(vscode.problems()).toHaveCount(0);
  await expect(vscode.problemCounts()).toHaveAttribute('aria-label', 'No Problems');
});

test('a changed process is reported until its change is accepted', async ({ vscode }) => {
  await vscode.open(DIAGRAM);
  await vscode.diagram().waitForDrawing();

  // Accepting records the text of every process the diagram uses.
  await vscode.command('GSDiagram: Accept process changes');
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);
  await vscode.save();
  const drawn = JSON.parse(await vscode.read(DIAGRAM)).drawn;
  expect(Object.keys(drawn)).toEqual(['ORDE1', 'ORDE2']);

  // Change the text of ORDE2.
  await vscode.command('View: Split Editor Right');
  await vscode.open('docs/processes.md');
  await vscode.goToLine(6);
  await vscode.paste(' Then confirm.');
  await vscode.save();
  await vscode.openProblems();
  await expect(vscode.problem('ORDE2 Send an order has changed since the diagram was drawn. Check the diagram, then run Accept process changes.')).toBeVisible();

  // Accept again, from the diagram.
  await vscode.page.locator('.editor-group-container').first().locator('.tab', { hasText: 'order.diagram.json' }).click();
  await expect(vscode.activeTab()).toContainText('order.diagram.json');
  await vscode.command('GSDiagram: Accept process changes');
  await vscode.save();
  await expect(vscode.problem(/has changed since/)).toHaveCount(0);
  expect(JSON.parse(await vscode.read(DIAGRAM)).drawn.ORDE2).not.toBe(drawn.ORDE2);
});

test('Accept process changes works from the diagram open as text', async ({ vscode }) => {
  await vscode.open(DIAGRAM);
  await vscode.reopenWith('Text Editor');
  await vscode.command('GSDiagram: Accept process changes');
  await expect.poll(() => vscode.editorText()).toContain('"drawn": {');
});

test('Accept process changes without a processes file says so', async ({ vscode }) => {
  await vscode.write('.gsdiagram/config.json', '{}\n');
  await vscode.open(DIAGRAM);
  await vscode.diagram().waitForDrawing();
  await vscode.command('GSDiagram: Accept process changes');
  await expect(vscode.notification('GSDiagram: no processes file is set.')).toBeVisible();
});
