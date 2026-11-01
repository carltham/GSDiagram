// Several architectures in one project: each architecture folder and each of its subfolders is one, with its own model,
// findings, and diagrams; an old one is archived. Architecture folders can be added, removed, archived, and restored.

import { expect, test } from '../fixtures';

const components = (name: string) => `# Components

| Component | Uses |
|---|---|
| \`${name}/a\` | \`${name}/b\` |
| \`${name}/b\` | \`missing\` |
`;

const FLOWS = '# Flows\n\n## Order\n\n1. The user orders.\n2. The user pays.\n';

test('each subfolder is an architecture of its own; one named old is archived, and gives no findings', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', components('app'));
  await vscode.write('dev/architecture/billing/components.md', components('billing'));
  await vscode.write('dev/architecture/old/components.md', components('app'));
  await vscode.command('GSDiagram: Check');
  await vscode.openSideBar();
  await expect(vscode.viewRow('Architecture', /^architecture$/)).toContainText('dev/architecture');
  await expect(vscode.viewRow('Architecture', /^billing$/)).toContainText('dev/architecture/billing');
  await expect(vscode.viewRow('Architecture', /^old$/)).toContainText('archived');

  // Only the current two say missing is no component: once each, not three times, and nothing is described twice.
  await vscode.openProblems();
  await expect(vscode.problem(/^missing, used by .*, is not a component in the architecture\./)).toHaveCount(2);
  await expect(vscode.problem(/described twice/)).toHaveCount(0);
});

test('Generate draws each current architecture into its own folder, listed as its own group', async ({ vscode }) => {
  await vscode.write('dev/architecture/flows.md', FLOWS);
  await vscode.write('dev/architecture/billing/flows.md', FLOWS);
  await vscode.write('dev/architecture/old/flows.md', FLOWS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created architecture/order.diagram.json, billing/order.diagram.json.')).toBeVisible();
  expect(JSON.parse(await vscode.read('.gsdiagram/billing/order.diagram.json')).source).toBe('dev/architecture/billing/flows.md#order');

  await vscode.openSideBar();
  await expect(vscode.viewRow('Diagrams', /^order$/)).toHaveCount(3);
  await expect(vscode.viewRow('Diagrams', /^billing$/)).toContainText('1');
});

test('an architecture is marked archived from the side bar, and current again', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', components('app'));
  await vscode.write('dev/architecture/billing/components.md', components('billing'));
  await vscode.command('GSDiagram: Check');
  await vscode.openSideBar();
  await vscode.openProblems();
  await expect(vscode.problem(/^missing, used by billing\/b/)).toBeVisible();

  await vscode.rowAction('Architecture', /^billing$/, 'Mark architecture archived');
  await expect(vscode.viewRow('Architecture', /^billing$/)).toContainText('archived');
  await expect(vscode.problem(/^missing, used by billing\/b/)).toHaveCount(0);
  expect(JSON.parse(await vscode.read('.gsdiagram/config.json')).archived).toEqual({ 'dev/architecture/billing': true });

  await vscode.rowAction('Architecture', /^billing$/, 'Mark architecture current');
  await expect(vscode.viewRow('Architecture', /^billing$/)).not.toContainText('archived');
  await expect(vscode.problem(/^missing, used by billing\/b/)).toBeVisible();
});

test('an architecture folder elsewhere in the project is added, and removed again', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', components('app'));
  await vscode.write('docs/design/flows.md', FLOWS);
  await vscode.openSideBar();
  await vscode.viewAction('Architecture', 'Add architecture folder');
  await vscode.pickInDialog(vscode.file('docs/design'), { folder: true });
  await expect(vscode.viewRow('Architecture', /^design$/)).toContainText('docs/design');
  expect(JSON.parse(await vscode.read('.gsdiagram/config.json')).architectureFolders).toEqual(['dev/architecture', 'docs/design']);

  await vscode.rowAction('Architecture', /^design$/, 'Remove architecture folder');
  await expect(vscode.viewRow('Architecture', /^design$/)).toHaveCount(0);
  expect(JSON.parse(await vscode.read('.gsdiagram/config.json')).architectureFolders).toEqual(['dev/architecture']);
});
