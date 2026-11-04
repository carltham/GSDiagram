// The GSDiagram editor: drawing, selecting, the process detail, zoom, dragging, undo and save, Reset layout, Render PNG,
// and the drawing following the text of the file.

import { expect, test } from '../fixtures';

const DIAGRAM = '.gsdiagram/order.diagram.json';

test.beforeEach(async ({ vscode }) => {
  await vscode.open(DIAGRAM);
  await vscode.diagram().waitForDrawing();
});

test('a diagram file opens in the GSDiagram editor and is drawn', async ({ vscode }) => {
  const d = vscode.diagram();
  await expect(d.title()).toHaveText('Order');
  await expect(d.nodes()).toHaveCount(3);
  await expect(d.node('draft')).toContainText('Draft');
  await expect(d.node('sent')).toContainText('Sent');
  await expect(d.node('start').locator('circle')).toHaveCount(1);
  await expect(d.edges()).toHaveCount(3);
  for (const label of ['Create', 'Send', 'Ship']) await expect(d.edgeLabel(label)).toBeVisible();
  await expect(d.detail()).toHaveText('Click a box or an arrow.');
  await expect(d.problem()).toBeHidden();
  for (const name of ['Zoom out', 'Zoom in', 'Reset layout', 'Render PNG']) await expect(d.button(name)).toBeVisible();
});

test('the layout runs left to right', async ({ vscode }) => {
  const d = vscode.diagram();
  const start = await d.position('start'), draft = await d.position('draft'), sent = await d.position('sent');
  expect(start.x).toBeLessThan(draft.x);
  expect(draft.x).toBeLessThan(sent.x);
});

test('an arrow whose process is not in the processes file is drawn in the error colour', async ({ vscode }) => {
  const d = vscode.diagram();
  const error = await d.themeColour('--vscode-errorForeground');
  const line = await d.themeColour('--vscode-editorLineNumber-foreground');
  expect(await d.edgeStroke('Ship')).toBe(error);
  expect(await d.edgeStroke('Send')).toBe(line);
  expect(await d.edgeStroke('Create')).toBe(line);
});

test('clicking a box selects it and shows that it has no process', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.node('draft').click();
  await expect(d.detail().locator('h3')).toHaveText('Draft');
  await expect(d.detail()).toContainText('No process.');
  expect(await d.nodeStroke('draft')).toBe(await d.themeColour('--vscode-focusBorder'));
});

test('clicking an arrow shows its process from the processes file', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.edgeLabel('Create').click();
  await expect(d.detail().locator('h3')).toHaveText('Create start → draft');
  await expect(d.detail()).toContainText('Orders');
  await expect(d.detail()).toContainText('ORDE1 Create an order. Press New order and Save.');
  await expect(d.button('Open in the processes file')).toBeVisible();
  expect(await d.edgeStroke('Create')).toBe(await d.themeColour('--vscode-focusBorder'));
});

test('clicking an arrow with an unknown process says it is not in the processes file', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.edgeLabel('Ship').click();
  await expect(d.detail().locator('.unknown')).toHaveText('ORDE9 is not in the processes file.');
  await expect(d.button('Open in the processes file')).toHaveCount(0);
});

test('clicking the background clears the selection', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.node('sent').click();
  await expect(d.detail().locator('h3')).toHaveText('Sent');
  await d.clickBackground();
  await expect(d.detail()).toHaveText('Click a box or an arrow.');
});

test('Open in the processes file shows the process beside the diagram', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.edgeLabel('Send').click();
  await d.button('Open in the processes file').click();
  const beside = vscode.page.locator('.editor-group-container').nth(1);
  await expect(beside.locator('.tab.active')).toContainText('processes.md');
  // The cursor is on the process; clicking the tab shows where, without moving it.
  await beside.locator('.tab.active').click();
  await expect(vscode.cursorPosition()).toHaveText(/Ln 6, Col 1/);
});

test('+ and − zoom the drawing, within limits', async ({ vscode }) => {
  const d = vscode.diagram();
  const base = await d.width();
  await d.button('Zoom in').click();
  await expect.poll(() => d.width()).toBeCloseTo(base * 1.25, 3);
  await d.button('Zoom out').click();
  await d.button('Zoom out').click();
  await expect.poll(() => d.width()).toBeCloseTo(base / 1.25, 3);
  for (let i = 0; i < 10; i++) await d.button('Zoom out').click();
  await expect.poll(() => d.width()).toBeCloseTo(base * 0.25, 3);
  for (let i = 0; i < 15; i++) await d.button('Zoom in').click();
  await expect.poll(() => d.width()).toBeCloseTo(base * 4, 3);
});

test('a box is three lines high, and the wheel scrolls a longer text a line at a time', async ({ vscode }) => {
  const words = Array.from({ length: 40 }, (_, i) => `word${i + 1}`);
  await vscode.write('.gsdiagram/long.diagram.json', JSON.stringify({ title: 'Long', nodes: [
    { id: 'long', label: words.join(' ') }, { id: 'short', label: 'Short' }], edges: [{ from: 'long', to: 'short' }] }));
  await vscode.open('.gsdiagram/long.diagram.json');
  const d = vscode.diagram();
  await expect(d.title()).toHaveText('Long');
  const lines = (id: string) => d.node(id).locator('tspan');
  const height = (id: string) => d.node(id).locator('rect').first().getAttribute('height');
  await expect(lines('long')).toHaveCount(3);
  await expect(lines('short')).toHaveCount(1);
  expect(await height('short')).toBe(await height('long'));
  await expect(lines('long').first()).toHaveText(/^word1 /);

  const box = (await d.node('long').boundingBox())!;
  await vscode.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await vscode.page.mouse.wheel(0, 100);
  await expect(lines('long').first()).not.toHaveText(/^word1 /);
  await expect(lines('long')).toHaveCount(3);
  for (let i = 0; i < 20; i++) await vscode.page.mouse.wheel(0, 100);
  await expect(lines('long').last()).toHaveText(/word40$/);
  for (let i = 0; i < 20; i++) await vscode.page.mouse.wheel(0, -100);
  await expect(lines('long').first()).toHaveText(/^word1 /);
});

test('dragging a box moves it and changes the file like typing would; save writes it', async ({ vscode }) => {
  const d = vscode.diagram();
  const before = await d.position('sent');
  await d.drag('sent', 0, 120);
  await expect.poll(async () => (await d.position('sent')).y).toBeGreaterThan(before.y + 100);
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);
  // Not on disk until saved.
  expect(JSON.parse(await vscode.read(DIAGRAM)).nodes[2].x).toBeUndefined();

  await vscode.save();
  const sent = JSON.parse(await vscode.read(DIAGRAM)).nodes.find((n: { id: string }) => n.id === 'sent');
  const after = await d.position('sent');
  expect(sent).toMatchObject({ x: Math.round(after.x), y: Math.round(after.y) });
  // The editor writes the file with two-space indentation.
  expect(await vscode.read(DIAGRAM)).toContain('\n  "nodes": [\n    {\n      "id": "start",');
});

test('a click on a box without moving it does not change the file', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.node('draft').click();
  await expect(d.detail().locator('h3')).toHaveText('Draft');
  await expect(vscode.activeTab()).not.toHaveClass(/\bdirty\b/);
});

test('undo puts a dragged box back, and redo moves it again', async ({ vscode, }) => {
  const d = vscode.diagram();
  const before = await d.position('sent');
  await d.drag('sent', 0, 120);
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);
  const moved = await d.position('sent');

  await vscode.page.keyboard.press('Control+Z');
  await expect.poll(() => d.position('sent')).toEqual(before);
  await expect(vscode.activeTab()).not.toHaveClass(/\bdirty\b/);

  await vscode.page.keyboard.press('Control+Shift+Z');
  await expect.poll(() => d.position('sent')).toEqual({ x: Math.round(moved.x), y: Math.round(moved.y) });
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);
});

test('a dragged position is kept when the diagram is opened again', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.drag('draft', 0, 150);
  await vscode.save();
  const moved = await d.position('draft');
  await vscode.command('View: Close All Editors');
  await vscode.open(DIAGRAM);
  await vscode.diagram().waitForDrawing();
  expect(await vscode.diagram().position('draft')).toEqual({ x: Math.round(moved.x), y: Math.round(moved.y) });
});

test('Reset layout forgets every dragged position', async ({ vscode }) => {
  const d = vscode.diagram();
  const auto = await d.position('draft');
  await d.drag('draft', 0, 150);
  await d.drag('sent', 40, 150);
  await vscode.save();
  expect((await vscode.read(DIAGRAM))).toMatch(/"x":/);

  await d.button('Reset layout').click();
  await expect.poll(() => d.position('draft')).toEqual(auto);
  await expect(vscode.activeTab()).toHaveClass(/\bdirty\b/);
  await vscode.save();
  expect(await vscode.read(DIAGRAM)).not.toMatch(/"[xy]":/);
});

test('Reset layout on a diagram with no dragged boxes changes nothing', async ({ vscode }) => {
  await vscode.diagram().button('Reset layout').click();
  await vscode.page.waitForTimeout(500);
  await expect(vscode.activeTab()).not.toHaveClass(/\bdirty\b/);
});

test('the Render PNG button saves the diagram as a PNG next to it', async ({ vscode }) => {
  const d = vscode.diagram();
  await d.button('Render PNG').click();
  await expect(vscode.notification('GSDiagram: saved order.png.')).toBeVisible();
  const png = await vscode.readBytes('.gsdiagram/order.png');
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  // Drawn at twice the size of the diagram.
  const [, , vbWidth, vbHeight] = (await d.svg().getAttribute('viewBox'))!.split(' ').map(Number);
  expect(png.readUInt32BE(16)).toBe(Math.round(vbWidth * 2));
  expect(png.readUInt32BE(20)).toBe(Math.round(vbHeight * 2));
});

test('the Render PNG command renders the diagram in front', async ({ vscode }) => {
  await vscode.command('GSDiagram: Render PNG');
  await expect(vscode.notification('GSDiagram: saved order.png.')).toBeVisible();
  expect((await vscode.readBytes('.gsdiagram/order.png')).length).toBeGreaterThan(1000);
});

test('Reopen Editor With… Text Editor shows the JSON, and back again the drawing', async ({ vscode }) => {
  await vscode.reopenWith('Text Editor');
  await expect.poll(() => vscode.editorText()).toContain('"title": "Order"');
  await vscode.reopenWith('GSDiagram');
  await vscode.diagram().waitForDrawing();
  await expect(vscode.diagram().title()).toHaveText('Order');
});

test.describe('beside the JSON in a text editor', () => {
  test.beforeEach(async ({ vscode }) => {
    await vscode.command('View: Split Editor Right');
    await vscode.reopenWith('Text Editor');
    await expect.poll(() => vscode.editorText()).toContain('"title": "Order"');
  });

  test('typing in the JSON redraws the diagram at once', async ({ vscode }) => {
    const text = JSON.parse(await vscode.read(DIAGRAM));
    text.title = 'Order, reworked';
    text.nodes.push({ id: 'done', label: 'Done', kind: 'end' });
    text.edges.push({ from: 'sent', to: 'done', label: 'Close' });
    await vscode.replaceText(JSON.stringify(text, null, 2));

    const d = vscode.diagram();
    await expect(d.title()).toHaveText('Order, reworked');
    await expect(d.nodes()).toHaveCount(4);
    await expect(d.node('done').locator('circle')).toHaveCount(2);
    await expect(d.edgeLabel('Close')).toBeVisible();
  });

  test('text that is not a diagram is shown as a problem, and the last drawing stays', async ({ vscode }) => {
    await vscode.replaceText('{ "title": "Order", "nodes": [');
    const d = vscode.diagram();
    await expect(d.problem()).toBeVisible();
    await expect(d.problem()).toHaveText(/^Not a diagram: /);
    await expect(d.nodes()).toHaveCount(3);

    await vscode.replaceText('{ "title": "Order" }');
    await expect(d.problem()).toHaveText('Not a diagram: A diagram needs "nodes" and "edges" lists.');

    await vscode.replaceText('{ "title": "Small", "nodes": [{ "id": "a", "label": "A" }], "edges": [] }');
    await expect(d.problem()).toBeHidden();
    await expect(d.title()).toHaveText('Small');
    await expect(d.nodes()).toHaveCount(1);
  });

  test('a drag in the diagram shows up in the text', async ({ vscode }) => {
    const d = vscode.diagram();
    await d.drag('sent', 0, 120);
    // The file holds the dropped position in whole pixels; the box may still be where the pointer left it.
    const dropped = await d.position('sent');
    const x = Math.round(dropped.x), y = Math.round(dropped.y);
    // The text editor beside shows only the lines in view; its find widget searches all of them.
    const text = vscode.page.locator('.editor-group-container').nth(1);
    await expect(await vscode.find(`"x": ${x},`, text)).toHaveText('1 of 1');
    await expect(await vscode.find(`"y": ${y}`, text)).toHaveText('1 of 1');
  });
});

test('Render PNG and Accept process changes without a diagram open say to open one', async ({ vscode }) => {
  await vscode.command('View: Close All Editors');
  await vscode.command('GSDiagram: Render PNG');
  await expect(vscode.notification('GSDiagram: open a diagram first.')).toBeVisible();
  await vscode.clearNotifications();
  await vscode.command('GSDiagram: Accept process changes');
  await expect(vscode.notification('GSDiagram: open a diagram first.')).toBeVisible();
});
