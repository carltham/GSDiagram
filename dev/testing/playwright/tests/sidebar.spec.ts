// The GSDiagram side bar: its icon in the Activity Bar, the Diagrams and Architecture views, and their welcome.

import { expect, test } from '../fixtures';

const COMPONENTS = `# Components

## Shared

| Component | What it does | Uses |
|---|---|---|
| \`shared/types\` | The types. | — |
| \`shared/check\` | The check. | \`types\` |

## Extension

| Component | What it does | Uses |
|---|---|---|
| \`src/extension\` | Starts. | \`shared/check\` |
`;

const FLOWS = '# Flows\n\n## Reset layout\n\n1. The user presses Reset layout.\n2. `src/extension` forgets the positions.\n';

test('the GSDiagram icon opens the side bar, which lists the diagrams with their findings; a click opens one', async ({ vscode }) => {
  await vscode.openSideBar();
  const order = vscode.viewRow('Diagrams', 'order');
  await expect(order).toContainText('1 warning');
  await order.click();
  const d = vscode.diagram();
  await d.waitForDrawing();
  await expect(d.title()).toHaveText('Order');
});

test('without diagrams, the side bar says how to get started, and Generate fills it', async ({ vscode }) => {
  await vscode.remove('.gsdiagram/order.diagram.json');
  await vscode.write('dev/architecture/components.md', COMPONENTS);
  await vscode.write('dev/architecture/flows.md', FLOWS);
  await vscode.command('GSDiagram: Check');
  await vscode.openSideBar();
  await expect(vscode.welcome('Diagrams')).toContainText('No diagrams in this project yet.');
  await vscode.welcome('Diagrams').getByRole('button', { name: 'Generate diagrams' }).click();
  await expect(vscode.notification('GSDiagram: created components.diagram.json, reset-layout.diagram.json.')).toBeVisible();
  await expect(vscode.viewRow('Diagrams', 'components')).toContainText('generated');
  await expect(vscode.viewRow('Diagrams', 'reset-layout')).toBeVisible();
});

test('the Architecture view shows the model; a click goes to where a component is written', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', COMPONENTS);
  await vscode.write('dev/architecture/flows.md', FLOWS);
  await vscode.command('GSDiagram: Check');
  await vscode.openSideBar();
  await expect(vscode.viewRow('Architecture', 'Components')).toContainText('3');
  await expect(vscode.viewRow('Architecture', 'Flows')).toContainText('1');
  await expect(vscode.viewRow('Architecture', 'No findings')).toBeVisible();

  await vscode.viewRow('Architecture', 'Components').click();
  await vscode.viewRow('Architecture', 'Shared').click();
  await vscode.viewRow('Architecture', /^check$/).click();
  await expect(vscode.activeTab()).toContainText('components.md');
  await expect(vscode.cursorPosition()).toContainText('Ln 8');
});

test('a finding about the architecture marks what it is about, and the title bar runs Analyse', async ({ vscode }) => {
  await vscode.write('dev/architecture/principles.md', '# Principles\n\n- Rule: shared/ must not use src/\n');
  await vscode.write('dev/architecture/components.md', COMPONENTS.replace('| `shared/types` | The types. | — |', '| `shared/types` | The types. | `src/extension` |'));
  await vscode.command('GSDiagram: Check');
  await vscode.openSideBar();
  await expect(vscode.viewRow('Architecture', /^2 warnings$/)).toBeVisible();
  await vscode.viewRow('Architecture', 'Components').click();
  await vscode.viewRow('Architecture', 'Shared').click();
  await expect(vscode.viewRow('Architecture', /^types$/)).toContainText('shared · 2 warnings');

  await vscode.viewAction('Architecture', 'Analyse architecture');
  await expect(vscode.notification(/^GSDiagram: 3 components, 1 rule; 2 warnings and 0 notes/)).toBeVisible();
});

test('the lists follow the check: a diagram written on disk shows up', async ({ vscode }) => {
  await vscode.openSideBar();
  await expect(vscode.viewRow('Diagrams', 'order')).toBeVisible();
  await vscode.write('.gsdiagram/more.diagram.json', '{ "title": "More", "nodes": [], "edges": [] }\n');
  await vscode.command('GSDiagram: Check');
  await expect(vscode.viewRow('Diagrams', 'more')).toBeVisible();
  await expect(vscode.welcome('Architecture')).toContainText('The architecture files in dev/architecture describe nothing yet.');
});

test('the welcome opens the README', async ({ vscode }) => {
  await vscode.openSideBar();
  await vscode.welcome('Architecture').getByRole('button', { name: 'Open the README' }).click();
  await expect(vscode.activeTab()).toContainText('Preview README.md');
});
