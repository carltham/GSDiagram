// The processes file: above each process, which diagrams use it, and the same on hover; both open the diagram.

import { expect, test } from '../fixtures';

test.beforeEach(async ({ vscode }) => {
  await vscode.open('docs/processes.md');
  await expect(vscode.codeLenses()).toHaveCount(3);
});

test('each process says which diagrams use it', async ({ vscode }) => {
  await expect(vscode.codeLenses()).toHaveText(['in order', 'in order', 'in no diagram']);
});

test('clicking a lens opens the diagram in the GSDiagram editor', async ({ vscode }) => {
  await vscode.codeLensLink('in order').first().click();
  await expect(vscode.activeTab()).toContainText('order.diagram.json');
  const d = vscode.diagram();
  await d.waitForDrawing();
  await expect(d.title()).toHaveText('Order');
});

test('hovering over a process says which diagrams use it, and the link opens it', async ({ vscode }) => {
  await vscode.line('ORDE1').getByText('ORDE1').hover();
  await expect(vscode.hover()).toHaveText('ORDE1 is in: order');
  await vscode.hover().getByRole('link', { name: 'order' }).click();
  await expect(vscode.activeTab()).toContainText('order.diagram.json');
  await vscode.diagram().waitForDrawing();
});

test('hovering over a process in no diagram says so', async ({ vscode }) => {
  await vscode.line('ORDE3').getByText('ORDE3').hover();
  await expect(vscode.hover()).toHaveText('ORDE3 is in no diagram.');
});

test('a new diagram that uses a process shows up above it', async ({ vscode }) => {
  await vscode.write('.gsdiagram/cancel.diagram.json', JSON.stringify({
    title: 'Cancel',
    nodes: [{ id: 'open', label: 'Open' }, { id: 'cancelled', label: 'Cancelled', kind: 'end' }],
    edges: [{ from: 'open', to: 'cancelled', label: 'Cancel', process: 'ORDE3' }],
  }, null, 2));
  await expect(vscode.codeLenses()).toHaveText(['in order', 'in order', 'in cancel']);
  await vscode.codeLensLink('in cancel').click();
  await expect(vscode.activeTab()).toContainText('cancel.diagram.json');
  await expect(vscode.diagram().title()).toHaveText('Cancel');
});

test('a process used by two diagrams has a lens for each', async ({ vscode }) => {
  await vscode.write('.gsdiagram/again.diagram.json', JSON.stringify({
    title: 'Again', nodes: [{ id: 'a', label: 'A', process: 'ORDE1' }], edges: [],
  }));
  await expect(vscode.codeLenses()).toHaveText(['in again', 'in order', 'in order', 'in no diagram']);
  await vscode.line('ORDE1').getByText('ORDE1').hover();
  await expect(vscode.hover()).toHaveText('ORDE1 is in: again, order');
});

test('a process typed into the file gets its lens', async ({ vscode }) => {
  await vscode.goToLine(7);
  await vscode.page.keyboard.press('Enter');
  await vscode.paste('- **ORDE4 Archive an order.** Press Archive.');
  await expect(vscode.codeLenses()).toHaveText(['in order', 'in order', 'in no diagram', 'in no diagram']);
});

test('another Markdown file has no lenses', async ({ vscode }) => {
  await vscode.write('docs/notes.md', '# Notes\n\n- **ORDE1 Create an order.** A copy.\n');
  await vscode.open('docs/notes.md');
  await vscode.page.waitForTimeout(1000);
  await expect(vscode.codeLenses()).toHaveCount(0);
});
