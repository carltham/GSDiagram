// Analyse architecture: the model of the architecture files, its findings in the Problems panel, and its diagrams.

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

const RULES = '# Principles\n\n- Rule: shared/ must not use src/\n';

test('Analyse writes the model of the architecture files, and says what it holds', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', COMPONENTS);
  await vscode.write('dev/architecture/principles.md', RULES);
  await vscode.command('GSDiagram: Analyse architecture');
  await expect(vscode.notification('GSDiagram: 3 components, 1 rule; 0 warnings and 1 note in the Problems panel. Written to .gsdiagram/architecture/architecture.json.'))
    .toBeVisible();
  const model = JSON.parse(await vscode.read('.gsdiagram/architecture/architecture.json'));
  expect(model.links).toContainEqual({ from: 'component:shared/check', to: 'component:shared/types', kind: 'uses', at: 'dev/architecture/components.md:8' });
});

test('a use against a rule is a warning in the Problems panel, and goes away when the architecture is put right', async ({ vscode }) => {
  await vscode.write('dev/architecture/principles.md', RULES);
  await vscode.write('dev/architecture/components.md', COMPONENTS.replace('| `shared/types` | The types. | — |', '| `shared/types` | The types. | `src/extension` |'));
  // Written while VS Code may still be starting, before its file watcher runs: check by hand.
  await vscode.command('GSDiagram: Check');
  await vscode.openProblems();
  const broken = vscode.problem('shared/types uses src/extension, but the rule at principles.md line 3 says shared/ must not use src/.');
  await expect(broken).toBeVisible();
  await expect(vscode.problem('A cycle: shared/types uses src/extension uses shared/check uses shared/types.')).toBeVisible();

  // Typed, not saved: the check reads the architecture as it is shown.
  await vscode.open('dev/architecture/components.md');
  await vscode.replaceText(COMPONENTS);
  await expect(broken).toHaveCount(0);
  await expect(vscode.problem('Nothing uses src/extension, and no flow names it.')).toBeVisible();
});

test('Generate draws the components of the model, with their uses', async ({ vscode }) => {
  await vscode.write('dev/architecture/components.md', COMPONENTS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created architecture/components.diagram.json.')).toBeVisible();
  await vscode.open('.gsdiagram/architecture/components.diagram.json');
  const d = vscode.diagram();
  await d.waitForDrawing();
  await expect(d.title()).toHaveText('Components');
  await expect(d.nodes()).toHaveCount(3);
  await expect(d.node('shared-check')).toContainText('shared/check');
  await expect(d.edges()).toHaveCount(2);
});

test('Analyse without architecture files says there is nothing to analyse', async ({ vscode }) => {
  await vscode.command('GSDiagram: Analyse architecture');
  await expect(vscode.notification('GSDiagram: nothing to analyse in dev/architecture.')).toBeVisible();
});
