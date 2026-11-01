import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readArchitecture, slugOf } from '../../../GSDiagram/shared/architecture';
import { checkProject } from '../../../GSDiagram/shared/check';
import { planDiagrams } from '../../../GSDiagram/shared/generate';
import { Project } from '../../../GSDiagram/shared/project';
import { Diagram } from '../../../GSDiagram/shared/types';

const read = (md: string) => readArchitecture('dev/architecture/flows.md', md);
const only = (md: string) => { const found = read(md); assert.equal(found.length, 1); return found[0]; };
const boxes = (d: Diagram) => d.nodes.map(n => [n.id, n.label, n.kind ?? n.process ?? '']);
const arrows = (d: Diagram) => d.edges.map(e => [e.from, e.to, e.label ?? '', e.process ?? '']);

test('a name becomes a file name', () => {
  assert.equal(slugOf('Order life cycle'), 'order-life-cycle');
  assert.equal(slugOf('Ärenden & returns, 2026'), 'arenden-returns-2026');
});

test('a Mermaid state diagram is a diagram, with [*] as Start and End', () => {
  const found = only(`# Orders

## Order life cycle

\`\`\`mermaid
stateDiagram-v2
    direction LR
    state "Draft order" as Draft
    [*] --> Draft : Create (ORDE1)
    Draft --> Sent : Send (ORDE2)
    Sent --> [*]
    note right of Sent : not a box
\`\`\`
`);
  assert.equal(found.source, 'dev/architecture/flows.md#order-life-cycle');
  assert.equal(found.heading, 'Order life cycle');
  assert.equal(found.diagram.title, 'Order life cycle');
  assert.equal(found.diagram.direction, 'RIGHT');
  assert.deepEqual(boxes(found.diagram), [['Draft', 'Draft order', ''], ['start', 'Start', 'start'], ['Sent', 'Sent', ''], ['end', 'End', 'end']]);
  assert.deepEqual(arrows(found.diagram), [['start', 'Draft', 'Create', 'ORDE1'], ['Draft', 'Sent', 'Send', 'ORDE2'], ['Sent', 'end', '', '']]);
});

test('a Mermaid flowchart is a diagram, with its shapes, arrow labels, and chains', () => {
  const found = only(`## Scan

\`\`\`mermaid
flowchart TD
    %% a comment
    A([User taps Scan]) --> B[Scanners run (SCAN1)]
    B -->|items| C{Ignored?}
    C -- no --> D["Results update"] --> E((Done))
    classDef hot fill:#f00
\`\`\`
`);
  assert.equal(found.diagram.direction, 'DOWN');
  assert.deepEqual(boxes(found.diagram), [
    ['A', 'User taps Scan', ''], ['B', 'Scanners run', 'SCAN1'], ['C', 'Ignored?', ''], ['D', 'Results update', ''], ['E', 'Done', ''],
  ]);
  assert.deepEqual(arrows(found.diagram), [['A', 'B', '', ''], ['B', 'C', 'items', ''], ['C', 'D', 'no', ''], ['D', 'E', '', '']]);
});

test('other Mermaid blocks and other code are not diagrams', () => {
  assert.deepEqual(read(`## Calls

\`\`\`mermaid
sequenceDiagram
    UI->>App: start
\`\`\`

\`\`\`
A --> B
\`\`\`
`), []);
});

test('a marked section is a diagram of its arrows; Start and End are dots', () => {
  const found = only(`## Invoice

<!-- diagram: invoice-life-cycle -->

The life of an invoice:

- Start → Draft: Create (INVO2)
- Draft → Accepted → Sent: Send (INVO10)
- Sent → End
`);
  assert.equal(found.name, 'invoice-life-cycle');
  assert.deepEqual(boxes(found.diagram), [['start', 'Start', 'start'], ['draft', 'Draft', ''], ['accepted', 'Accepted', ''], ['sent', 'Sent', ''], ['end', 'End', 'end']]);
  assert.deepEqual(arrows(found.diagram), [
    ['start', 'draft', 'Create', 'INVO2'], ['draft', 'accepted', '', ''], ['accepted', 'sent', 'Send', 'INVO10'], ['sent', 'end', '', ''],
  ]);
});

test('a marked section without arrows is a diagram of its numbered steps', () => {
  const found = only(`## First launch
<!-- diagram -->

1. Short introduction: what the app does, and that nothing leaves the device.
2. Privacy and ad consent (see [advertising.md](advertising.md#consent)).
3. Ask for **storage access** (ACCE1). If the user refuses, the app runs with reduced categories.
`);
  assert.equal(found.name, undefined);
  assert.deepEqual(boxes(found.diagram), [
    ['start', 'Start', 'start'], ['step1', 'Short introduction', ''], ['step2', 'Privacy and ad consent (see advertising.md)', ''],
    ['step3', 'Ask for storage access', 'ACCE1'], ['end', 'End', 'end'],
  ]);
  assert.deepEqual(arrows(found.diagram).map(([f, t]) => `${f}>${t}`), ['start>step1', 'step1>step2', 'step2>step3', 'step3>end']);
});

test('a section without a marker is not a diagram, even with arrows or steps', () => {
  assert.deepEqual(read(`## Rules

1. Implement the repository.
2. Implement the service.

- Implement service → business logic
- order_items (filtered via order → tenant_id)
`), []);
});

test('a marker belongs to its section only, and names the Mermaid block after it', () => {
  const found = read(`## A
<!-- diagram: named -->
\`\`\`mermaid
graph LR
  x --> y
\`\`\`
1. Not a diagram, the marker is used.

## B
1. Not marked.
`);
  assert.deepEqual(found.map(f => [f.source, f.name]), [['dev/architecture/flows.md#a', 'named']]);
});

test('two diagrams under one heading have different sources', () => {
  const found = read(`## Twice
\`\`\`mermaid
graph LR
  a --> b
\`\`\`
\`\`\`mermaid
graph LR
  c --> d
\`\`\`
`);
  assert.deepEqual(found.map(f => f.source), ['dev/architecture/flows.md#twice', 'dev/architecture/flows.md#twice-2']);
});

// A project in /p with the files of its dev/architecture, and its diagrams.
function project(architecture: Record<string, string>, diagrams: Record<string, object | string> = {}): Project {
  return {
    root: '/p', folder: '/p/.gsdiagram', config: {},
    diagrams: Object.entries(diagrams).map(([name, d]) =>
      ({ file: `/p/.gsdiagram/${name}.diagram.json`, text: typeof d === 'string' ? d : JSON.stringify(d, null, 2) + '\n' })),
    architecture: Object.entries(architecture).map(([name, text]) => ({ file: `/p/dev/architecture/${name}`, text })),
  };
}

const orders = `## Order life cycle
<!-- diagram -->
- Start → Draft: Create (ORDE1)
- Draft → Sent: Send (ORDE2)
`;

test('Generate makes a diagram for each one described, named after its heading, with its source', () => {
  const changes = planDiagrams(project({ 'orders.md': orders }), { update: false });
  assert.deepEqual(changes.map(c => [c.file, c.created]), [['/p/.gsdiagram/order-life-cycle.diagram.json', true]]);
  const d = JSON.parse(changes[0].text);
  assert.equal(d.source, 'dev/architecture/orders.md#order-life-cycle');
  assert.deepEqual(Object.keys(d), ['title', 'source', 'nodes', 'edges']);
  assert.ok(changes[0].text.endsWith('}\n'));
});

test('a name that is taken gets the file name in front, and then a number', () => {
  const twice = `## Flow\n<!-- diagram -->\n- A → B\n`;
  const changes = planDiagrams(project({ 'a.md': twice, 'b.md': twice }, { flow: { title: 'Mine', nodes: [], edges: [] } }), { update: false });
  assert.deepEqual(changes.map(c => c.file.replace('/p/.gsdiagram/', '')), ['a-flow.diagram.json', 'b-flow.diagram.json']);
});

test('Generate leaves diagrams that are there alone; Update draws them again from their source, keeping positions', () => {
  const first = planDiagrams(project({ 'orders.md': orders }), { update: false })[0];
  const placed = JSON.parse(first.text);
  placed.nodes.find((n: { id: string }) => n.id === 'draft').x = 10;
  placed.nodes.find((n: { id: string }) => n.id === 'draft').y = 20;
  placed.nodes.find((n: { id: string }) => n.id === 'sent').label = 'Changed by hand';
  placed.drawn = { ORDE1: 'abc' };
  const changed = orders.replace('Send (ORDE2)', 'Ship (ORDE3)') + '- Sent → End\n';
  const p = project({ 'orders.md': changed }, { 'order-life-cycle': placed });

  assert.deepEqual(planDiagrams(p, { update: false }), []);
  const [u] = planDiagrams(p, { update: true });
  assert.equal(u.created, false);
  const d = JSON.parse(u.text);
  assert.deepEqual(d.nodes.find((n: { id: string }) => n.id === 'draft'), { id: 'draft', label: 'Draft', x: 10, y: 20 });
  assert.equal(d.nodes.find((n: { id: string }) => n.id === 'sent').label, 'Sent');
  assert.deepEqual(d.edges[1], { from: 'draft', to: 'sent', label: 'Ship', process: 'ORDE3' });
  assert.deepEqual(d.nodes.map((n: { id: string }) => n.id), ['start', 'draft', 'sent', 'end']);
  assert.deepEqual(d.drawn, { ORDE1: 'abc' });
});

test('Update changes nothing when the diagrams are up to date, and never a diagram drawn by hand', () => {
  const first = planDiagrams(project({ 'orders.md': orders }), { update: false })[0];
  const byHand = { title: 'Mine', nodes: [{ id: 'a', label: 'A' }], edges: [] };
  const p = project({ 'orders.md': orders }, { 'order-life-cycle': first.text, mine: byHand, broken: '{' });
  assert.deepEqual(planDiagrams(p, { update: true }), []);
});

test('the check warns about a diagram whose source is gone', () => {
  const first = planDiagrams(project({ 'orders.md': orders }), { update: false })[0];
  const p = project({ 'orders.md': '# Nothing here\n' }, { 'order-life-cycle': first.text });
  const found = checkProject(p).filter(f => f.severity === 'warning');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /^The source dev\/architecture\/orders.md#order-life-cycle of this diagram is gone\./);
  assert.equal(checkProject(project({ 'orders.md': orders }, { 'order-life-cycle': first.text })).length, 0);
});
