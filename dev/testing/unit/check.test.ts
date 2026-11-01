import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptChanges, checkProject, hashOf } from '../../../GSDiagram/shared/check';
import { readProcesses } from '../../../GSDiagram/shared/processes';
import { Project } from '../../../GSDiagram/shared/project';

const md = `## Invoices
- **INVO4 Park an invoice.** Save without Accepted.
- **INVO5 Accept an invoice.** Save with Accepted ticked.
- **INVO10 Send an invoice.** On the detail, press Send.
`;

const diagram = (o: object) => JSON.stringify({ title: 'T', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [], ...o }, null, 2);

function project(diagrams: string[], processes = md): Project {
  return {
    root: '/p', folder: '/p/.gsdiagram', config: { processesFile: 'ui.md' },
    diagrams: diagrams.map((text, i) => ({ file: `/p/.gsdiagram/d${i}.diagram.json`, text })),
    processes: { file: '/p/ui.md', text: processes }, architecture: [],
  };
}

test('a process in no diagram is reported on its line', () => {
  const f = checkProject(project([diagram({ edges: [{ from: 'a', to: 'b', process: 'INVO4' }] })]));
  assert.deepEqual(f.filter(x => x.severity === 'info').map(x => [x.line, x.message]), [
    [2, 'INVO5 Accept an invoice is in no diagram.'],
    [3, 'INVO10 Send an invoice is in no diagram.'],
  ]);
});

test('an unknown process id is a warning at its place in the diagram', () => {
  const text = diagram({ edges: [{ from: 'a', to: 'b', process: 'INVO99' }] });
  const w = checkProject(project([text])).filter(x => x.severity === 'warning');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /INVO99 is not in ui\.md/);
  assert.equal(text.split('\n')[w[0].line].includes('"process": "INVO99"'), true);
});

test('arrows to missing nodes and repeated node ids are errors', () => {
  const text = JSON.stringify({ title: 'T', nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A2' }], edges: [{ from: 'a', to: 'zz' }] });
  const e = checkProject(project([text])).filter(x => x.severity === 'error').map(x => x.message);
  assert.deepEqual(e, ['The node id a is used twice.', 'No node has the id zz.']);
});

test('a file that is not JSON is an error', () => {
  const e = checkProject(project(['{ "nodes": [ }'])).filter(x => x.severity === 'error');
  assert.equal(e.length, 1);
  assert.match(e[0].message, /^Not a diagram/);
});

test('a missing processes file is an error, and nothing is checked against it', () => {
  const p = { ...project([diagram({ edges: [{ from: 'a', to: 'b', process: 'INVO99' }] })]), processes: undefined };
  assert.deepEqual(checkProject(p).map(x => x.severity), ['error']);
});

test('a process changed since it was drawn is a warning, until accepted', () => {
  const text = acceptChanges(diagram({ edges: [{ from: 'a', to: 'b', process: 'INVO5' }] }), readProcesses(md));
  assert.equal(JSON.parse(text).drawn.INVO5, hashOf(readProcesses(md).get('INVO5')!));
  assert.equal(checkProject(project([text])).filter(x => x.severity === 'warning').length, 0);

  const changed = md.replace('Save with Accepted ticked.', 'Save with Accepted ticked, and confirm.');
  const w = checkProject(project([text], changed)).filter(x => x.severity === 'warning');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /INVO5 Accept an invoice has changed/);

  const again = acceptChanges(text, readProcesses(changed));
  assert.equal(checkProject(project([again], changed)).filter(x => x.severity === 'warning').length, 0);
});
