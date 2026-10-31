// Generate diagrams and Update diagrams: diagrams drawn from the architecture files in dev/architecture, and kept up
// to date with them.

import { expect, test } from '../fixtures';

const ARCHITECTURE = 'dev/architecture/orders.md';
const GENERATED = '.gsdiagram/order-life-cycle.diagram.json';

const ORDERS = `# Orders

## Order life cycle

<!-- diagram -->

- Start → Draft: Create (ORDE1)
- Draft → Sent: Send (ORDE2)
- Sent → End
`;

test('Generate draws a diagram from a marked section of an architecture file', async ({ vscode }) => {
  await vscode.write(ARCHITECTURE, ORDERS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created order-life-cycle.diagram.json.')).toBeVisible();
  expect(JSON.parse(await vscode.read(GENERATED)).source).toBe('dev/architecture/orders.md#order-life-cycle');

  await vscode.open(GENERATED);
  const d = vscode.diagram();
  await d.waitForDrawing();
  await expect(d.title()).toHaveText('Order life cycle');
  await expect(d.nodes()).toHaveCount(4);
  await expect(d.node('draft')).toContainText('Draft');
  await d.edgeLabel('Send').click();
  await expect(d.detail()).toContainText('ORDE2 Send an order. Press Send.');
});

test('Generate draws a diagram from a Mermaid state diagram', async ({ vscode }) => {
  await vscode.write('dev/architecture/states.md', [
    '## Invoice states', '', '```mermaid', 'stateDiagram-v2', '  [*] --> Draft', '  Draft --> Booked : Book (ORDE2)', '  Booked --> [*]', '```', '',
  ].join('\n'));
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created invoice-states.diagram.json.')).toBeVisible();
  await vscode.open('.gsdiagram/invoice-states.diagram.json');
  const d = vscode.diagram();
  await d.waitForDrawing();
  await expect(d.nodes()).toHaveCount(4);
  await expect(d.edgeLabel('Book')).toBeVisible();
});

test('Generate leaves a diagram that is there alone, and says when there is nothing to do', async ({ vscode }) => {
  await vscode.write(ARCHITECTURE, ORDERS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created order-life-cycle.diagram.json.')).toBeVisible();
  await vscode.clearNotifications();
  await vscode.write(ARCHITECTURE, ORDERS.replace('Send (ORDE2)', 'Ship (ORDE2)'));
  const before = await vscode.read(GENERATED);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: the diagrams are up to date.')).toBeVisible();
  expect(await vscode.read(GENERATED)).toBe(before);
});

test('Update draws an open diagram again from its edited source, keeping a dragged box where it is', async ({ vscode }) => {
  await vscode.write(ARCHITECTURE, ORDERS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created order-life-cycle.diagram.json.')).toBeVisible();
  await vscode.clearNotifications();

  await vscode.open(GENERATED);
  const d = vscode.diagram();
  await d.waitForDrawing();
  await d.drag('sent', 0, 120);
  await vscode.save();
  const sent = await d.position('sent');

  // Edit the architecture file in the editor, without saving: Update reads it as it is shown.
  await vscode.open(ARCHITECTURE);
  await vscode.goToLine(9);
  await vscode.page.keyboard.press('Enter');
  await vscode.paste('- Sent → Cancelled: Cancel (ORDE3)');

  await vscode.command('GSDiagram: Update diagrams');
  await expect(vscode.notification('GSDiagram: updated order-life-cycle.diagram.json.')).toBeVisible();
  await vscode.page.locator('.tabs-container .tab', { hasText: 'order-life-cycle.diagram.json' }).click();
  await expect(d.node('cancelled')).toContainText('Cancelled');
  await expect(d.edgeLabel('Cancel')).toBeVisible();
  expect(await d.position('sent')).toEqual({ x: Math.round(sent.x), y: Math.round(sent.y) });
});

test('a generated diagram whose source is gone is a warning in the Problems panel', async ({ vscode }) => {
  await vscode.write(ARCHITECTURE, ORDERS);
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: created order-life-cycle.diagram.json.')).toBeVisible();
  await vscode.write(ARCHITECTURE, '# Orders\n\nNo diagram here any more.\n');
  await vscode.openProblems();
  await expect(vscode.problem(/^The source dev\/architecture\/orders\.md#order-life-cycle of this diagram is gone\./)).toBeVisible();
});

test('Generate and Update without described diagrams say so', async ({ vscode }) => {
  await vscode.command('GSDiagram: Generate diagrams');
  await expect(vscode.notification('GSDiagram: no diagrams are described in dev/architecture.')).toBeVisible();
  await vscode.clearNotifications();
  await vscode.write('dev/architecture/notes.md', '## Rules\n\n1. Not a diagram, no marker.\n');
  await vscode.command('GSDiagram: Update diagrams');
  await expect(vscode.notification('GSDiagram: no diagrams are described in dev/architecture.')).toBeVisible();
});
