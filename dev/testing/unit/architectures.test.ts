import assert from 'node:assert/strict';
import { test } from 'node:test';
import { architecturesOf, isArchivedDiagram, modelOf } from '../../../GSDiagram/shared/architectures';
import { checkProject } from '../../../GSDiagram/shared/check';
import { planDiagrams } from '../../../GSDiagram/shared/generate';
import { Project } from '../../../GSDiagram/shared/project';
import { Config } from '../../../GSDiagram/shared/types';

const components = (name: string) => `# Components

| Component | Uses |
|---|---|
| \`${name}/a\` | \`${name}/b\` |
| \`${name}/b\` | — |
`;

const flows = '# Flows\n\n## Order\n\n1. The user orders.\n2. The user pays.\n';

// A project in /p: its architecture folders, the Markdown files in them by path, and its diagrams by path.
function project(files: Record<string, string>, { folders = ['dev/architecture'], config = {}, diagrams = {} }:
  { folders?: string[]; config?: Config; diagrams?: Record<string, object> } = {}): Project {
  return {
    root: '/p', folder: '/p/.gsdiagram', config,
    architectureFolders: folders.map(f => `/p/${f}`),
    architecture: Object.entries(files).map(([rel, text]) => ({ file: `/p/${rel}`, text })),
    diagrams: Object.entries(diagrams).map(([rel, d]) => ({ file: `/p/.gsdiagram/${rel}`, text: JSON.stringify(d, null, 2) + '\n' })),
  };
}

const summary = (p: Project) => architecturesOf(p).map(a => [a.name, a.rel, a.archived, a.files.map(f => f.file.replace('/p/', '')), a.diagrams]);

test('an architecture folder is one architecture, and each of its subfolders another', () => {
  const p = project({
    'dev/architecture/components.md': components('app'),
    'dev/architecture/flows.md': flows,
    'dev/architecture/billing/components.md': components('billing'),
    'dev/architecture/billing/deep/notes.md': '# Notes\n',
    'dev/architecture/old/components.md': components('app'),
  });
  assert.deepEqual(summary(p), [
    ['architecture', 'dev/architecture', false, ['dev/architecture/components.md', 'dev/architecture/flows.md'], '/p/.gsdiagram/architecture'],
    ['billing', 'dev/architecture/billing', false, ['dev/architecture/billing/components.md', 'dev/architecture/billing/deep/notes.md'], '/p/.gsdiagram/billing'],
    ['old', 'dev/architecture/old', true, ['dev/architecture/old/components.md'], '/p/.gsdiagram/old'],
  ]);
});

test('each architecture has its own model, so the same component in the old one is not described twice', () => {
  const p = project({ 'dev/architecture/components.md': components('app'), 'dev/architecture/old/components.md': components('app') },
    { config: { archived: { 'dev/architecture/old': false } } });
  const [current, old] = architecturesOf(p);
  assert.equal(modelOf(p, current).elements.filter(e => e.kind === 'component').length, 2);
  assert.equal(modelOf(p, old).elements.filter(e => e.kind === 'component').length, 2);
  assert.ok(!checkProject(p).some(f => /described twice/.test(f.message)));
});

test('a folder named old, archive, redundant, or legacy is archived, unless marked current; any can be marked archived', () => {
  const files = {
    'dev/architecture/components.md': components('app'), 'dev/architecture/redundant/flows.md': flows,
    'dev/architecture/legacy/flows.md': flows, 'dev/architecture/next/flows.md': flows,
  };
  assert.deepEqual(architecturesOf(project(files)).map(a => [a.name, a.archived]),
    [['architecture', false], ['legacy', true], ['next', false], ['redundant', true]]);
  const marked = project(files, { config: { archived: { 'dev/architecture/legacy': false, 'dev/architecture/next': true } } });
  assert.deepEqual(architecturesOf(marked).map(a => [a.name, a.archived]),
    [['architecture', false], ['legacy', false], ['next', true], ['redundant', true]]);
});

test('an archived architecture gives no findings, and its diagrams none either', () => {
  const broken = '# Components\n\n| Component | Uses |\n|---|---|\n| `x` | `missing` |\n';
  const p = project({ 'dev/architecture/components.md': components('app'), 'dev/architecture/old/components.md': broken },
    { diagrams: { 'old/broken.diagram.json': { title: 'Broken', source: 'dev/architecture/old/gone.md#x', nodes: [], edges: [{ from: 'a', to: 'b' }] } } });
  const messages = checkProject(p).map(f => f.message);
  assert.ok(!messages.some(m => /missing|No node|is gone/.test(m)), messages.join('\n'));
  assert.equal(isArchivedDiagram(p, '/p/.gsdiagram/old/broken.diagram.json', JSON.stringify({ title: 'B', nodes: [], edges: [] })), true);
});

test('Generate draws each current architecture into its own subfolder, and leaves an archived one alone', () => {
  const p = project({
    'dev/architecture/flows.md': flows, 'dev/architecture/billing/flows.md': flows, 'dev/architecture/old/flows.md': flows,
  });
  assert.deepEqual(planDiagrams(p, { update: false }).map(c => c.file.replace('/p/.gsdiagram/', '')),
    ['architecture/order.diagram.json', 'billing/order.diagram.json']);
});

test('a diagram whose source was moved into an archived folder belongs to it, and is not reported as gone', () => {
  const diagram = { title: 'Order', source: 'dev/architecture/flows.md#order', nodes: [{ id: 'a', label: 'A' }], edges: [] };
  const p = project({ 'dev/architecture/components.md': components('app'), 'dev/architecture/old/flows.md': flows },
    { diagrams: { 'architecture/order.diagram.json': diagram } });
  assert.equal(isArchivedDiagram(p, '/p/.gsdiagram/architecture/order.diagram.json', JSON.stringify(diagram)), true);
  assert.ok(!checkProject(p).some(f => /is gone/.test(f.message)));
  assert.ok(!planDiagrams(p, { update: true }).some(c => c.file.endsWith('order.diagram.json')));
});

test('architecture folders outside dev/architecture are architectures too; the same name gets its parent in front', () => {
  const p = project({ 'dev/architecture/flows.md': flows, 'docs/architecture/flows.md': flows }, { folders: ['dev/architecture', 'docs/architecture'] });
  assert.deepEqual(architecturesOf(p).map(a => [a.name, a.rel]), [['architecture', 'dev/architecture'], ['docs-architecture', 'docs/architecture']]);
  assert.deepEqual(planDiagrams(p, { update: false }).map(c => [c.file.replace('/p/.gsdiagram/', ''), JSON.parse(c.text).source]), [
    ['architecture/order.diagram.json', 'dev/architecture/flows.md#order'],
    ['docs-architecture/order.diagram.json', 'docs/architecture/flows.md#order'],
  ]);
});

test('an architecture folder inside another belongs to itself only', () => {
  const p = project({ 'dev/architecture/flows.md': flows, 'dev/architecture/design/v2/flows.md': flows },
    { folders: ['dev/architecture', 'dev/architecture/design/v2'] });
  assert.deepEqual(summary(p).map(([name, rel, , files]) => [name, rel, files]), [
    ['architecture', 'dev/architecture', ['dev/architecture/flows.md']],
    ['v2', 'dev/architecture/design/v2', ['dev/architecture/design/v2/flows.md']],
  ]);
});

test('with subfolderArchitectures false, a subfolder is part of its folder, and an archived one stays its own', () => {
  const p = project({
    'dev/architecture/README.md': components('app'),
    'dev/architecture/core/flows.md': flows,
    'dev/architecture/model/notes.md': '# Notes\n',
    'dev/architecture/old/components.md': components('app'),
  }, { config: { subfolderArchitectures: false } });
  assert.deepEqual(summary(p).map(([name, rel, archived, files]) => [name, rel, archived, files]), [
    ['architecture', 'dev/architecture', false,
      ['dev/architecture/README.md', 'dev/architecture/core/flows.md', 'dev/architecture/model/notes.md']],
    ['old', 'dev/architecture/old', true, ['dev/architecture/old/components.md']],
  ]);
});
