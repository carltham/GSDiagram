import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyseArchitecture, ArchModel, modelViews, writeModel } from '../../../GSDiagram/shared/model';
import { reviewModel } from '../../../GSDiagram/shared/review';

const COMPONENTS = `# Components

## Shared

| Component | What it does | Uses |
|---|---|---|
| \`shared/types\` | The types. | — |
| \`shared/check\` | The check. | \`types\`, \`project\` |
| \`shared/project\` | Loads a project. | \`types\` |

## Extension

| Component | What it does | Uses |
|---|---|---|
| \`src/extension\` | Starts. | \`src/editor\`, \`shared/check\` |
| \`src/editor\` | The editor. | \`shared/types\`; talks to \`webview/main\` by messages |

## Pages

| Component | What it does | Uses |
|---|---|---|
| \`webview/main\` | The page. | \`shared/types\` |
`;

const CONTEXT = `# Context

## Who uses it

- **An architect,** who writes the architecture.

## What it works with

| Outside | What it does with it |
|---|---|
| **VS Code** 1.90 or later | Hosts it. |
| **The project's folder** | Holds everything. |
`;

const DATA = `# Data

| File | Read | Written |
|---|---|---|
| \`config.json\` | Yes | By Set processes file |
| \`*.png\` | No | By Render PNG |
| \`old.txt\` | No | Never |
`;

const FLOWS = `# Flows

## Reset layout

1. The user presses **Reset layout**.
2. \`src/editor\` removes \`x\` and \`y\` from every box.

## Zoom

Not a flow: no steps.

## A box is dragged

1. The user drags a box.
2. The page sends its position.
`;

const PRINCIPLES = `# Principles

- Rule: shared/ must not use src/
- **Rule:** Pages must not use \`src/editor\`.
`;

const files = (extra: Record<string, string> = {}) => Object.entries({
  'dev/architecture/components.md': COMPONENTS, 'dev/architecture/context.md': CONTEXT, 'dev/architecture/data.md': DATA,
  'dev/architecture/flows.md': FLOWS, 'dev/architecture/principles.md': PRINCIPLES, ...extra,
}).map(([rel, text]) => ({ rel, text }));

const model = (extra?: Record<string, string>) => analyseArchitecture(files(extra), 'Shop');
const names = (m: ArchModel, kind: string) => m.elements.filter(e => e.kind === kind).map(e => e.name);
const links = (m: ArchModel, kind: string) => m.links.filter(l => l.kind === kind).map(l => `${l.from.replace(/^\w+:/, '')} > ${l.to.replace(/^\w+:/, '')}`);

test('components come from a table with Component and Uses columns, in the layer of their heading', () => {
  const m = model();
  assert.deepEqual(names(m, 'component'), ['shared/types', 'shared/check', 'shared/project', 'src/extension', 'src/editor', 'webview/main']);
  assert.deepEqual(m.elements.filter(e => e.kind === 'component').map(e => e.layer), ['Shared', 'Shared', 'Shared', 'Extension', 'Extension', 'Pages']);
  assert.deepEqual(m.elements.find(e => e.name === 'shared/check')!.at, { file: 'dev/architecture/components.md', line: 7, column: 3, length: 12 });
});

test('a short name in a Uses cell is the component it ends, and a name after a semicolon is another link', () => {
  const m = model();
  assert.deepEqual(links(m, 'uses'), [
    'shared/check > shared/types', 'shared/check > shared/project', 'shared/project > shared/types',
    'src/extension > src/editor', 'src/extension > shared/check', 'src/editor > shared/types', 'webview/main > shared/types',
  ]);
  assert.deepEqual(m.links.filter(l => l.kind === 'talks').map(l => [l.to, l.label]), [['component:webview/main', 'talks to']]);
  const at = m.links.find(l => l.to === 'component:shared/project')!.at;
  assert.equal(COMPONENTS.split('\n')[at.line].slice(at.column, at.column + at.length), 'project');
});

test('actors, external systems, data, flows, and rules are read from their lists and tables', () => {
  const m = model();
  assert.deepEqual(names(m, 'actor'), ['An architect']);
  assert.deepEqual(names(m, 'external'), ['VS Code', "The project's folder"]);
  assert.deepEqual(m.elements.filter(e => e.kind === 'data').map(e => [e.name, e.read, e.written]),
    [['config.json', true, true], ['*.png', false, true], ['old.txt', false, false]]);
  assert.deepEqual(names(m, 'flow'), ['Reset layout', 'A box is dragged']);
  assert.deepEqual(links(m, 'next'), ['dev/architecture/flows.md#reset-layout/1 > dev/architecture/flows.md#reset-layout/2',
    'dev/architecture/flows.md#a-box-is-dragged/1 > dev/architecture/flows.md#a-box-is-dragged/2']);
  assert.deepEqual(links(m, 'names'), ['dev/architecture/flows.md#reset-layout/2 > src/editor']);
  assert.deepEqual(m.rules.map(r => [r.from, r.to]), [['shared/', 'src/'], ['Pages', 'src/editor']]);
});

test('numbered steps are a flow only in a file about flows', () => {
  const m = model({ 'dev/architecture/setup.md': '# Setup\n\n## Install\n\n1. Install Node.\n2. Run npm install.\n' });
  assert.deepEqual(names(m, 'flow'), ['Reset layout', 'A box is dragged']);
});

test('tables and lists in code blocks are not read', () => {
  const m = analyseArchitecture([{ rel: 'a.md', text: '```\n| Component | Uses |\n|---|---|\n| `x` | — |\n```\n' }], 'Shop');
  assert.deepEqual(m.elements, []);
});

const messages = (m: ArchModel) => reviewModel(m).map(n => `${n.severity}: ${n.message}`);

test('the check of a sound model has only notes', () => {
  assert.deepEqual(messages(model()), [
    'info: Nothing uses src/extension, and no flow names it.',
    'info: Nothing reads or writes old.txt.',
    'info: The flow A box is dragged names no component. Name the component that does a step, in `code` as in a Uses cell.',
  ]);
});

test('a name that is no component, or could be two, is a warning at the name', () => {
  const m = model({ 'dev/architecture/more.md': '## More\n\n| Component | Uses |\n|---|---|\n| `src/types` | `missing` |\n'
    + '\n## Other\n\n| Component | Uses |\n|---|---|\n| `lib/a` | `types`, `lib/a` |\n' });
  const found = reviewModel(m).filter(n => n.severity === 'warning');
  assert.deepEqual(found.map(n => n.message), [
    'missing, used by src/types, is not a component in the architecture.',
    'types could be shared/types or src/types. Write the full name.',
    'A cycle: lib/a uses lib/a.',
  ]);
  assert.deepEqual(found[0].at, { file: 'dev/architecture/more.md', line: 4, column: 17, length: 7 });
});

test('a cycle is a warning once, at its first use', () => {
  const cycle = COMPONENTS.replace('| `shared/project` | Loads a project. | `types` |', '| `shared/project` | Loads a project. | `types`, `check` |');
  assert.deepEqual(messages(model({ 'dev/architecture/components.md': cycle })).filter(m => m.startsWith('warning')),
    ['warning: A cycle: shared/check uses shared/project uses shared/check.']);
});

test('a use that a rule forbids is a warning at the use; a rule about nothing is a warning at the rule', () => {
  const broken = COMPONENTS.replace('| `shared/types` | The types. | — |', '| `shared/types` | The types. | `src/editor` |')
    .replace('| `webview/main` | The page. | `shared/types` |', '| `webview/main` | The page. | `shared/types`, `src/editor` |');
  const rules = PRINCIPLES + '- Rule: lib/ must not use src/\n';
  const found = reviewModel(model({ 'dev/architecture/components.md': broken, 'dev/architecture/principles.md': rules })).filter(n => n.severity === 'warning');
  assert.deepEqual(found.map(n => n.message), [
    'A cycle: shared/types uses src/editor uses shared/types.',
    'shared/types uses src/editor, but the rule at principles.md line 3 says shared/ must not use src/.',
    'webview/main uses src/editor, but the rule at principles.md line 4 says Pages must not use src/editor.',
    'lib/ is no component, folder, or layer in the architecture.',
  ]);
  assert.equal(found[1].at.file, 'dev/architecture/components.md');
});

test('a component described twice is a warning', () => {
  const twice = COMPONENTS + '\n## Again\n\n| Component | Uses |\n|---|---|\n| `shared/types` | — |\n';
  assert.ok(messages(model({ 'dev/architecture/components.md': twice })).includes('warning: shared/types is described twice; first at components.md line 7.'));
});

test('the views: the context, the components, and each flow, each with its source', () => {
  const views = modelViews(model());
  assert.deepEqual(views.map(v => [v.source, v.name, v.diagram.title]), [
    ['dev/architecture/context.md#who-uses-it', 'context', 'Shop and what it works with'],
    ['dev/architecture/components.md#components', 'components', 'Components'],
    ['dev/architecture/flows.md#reset-layout', undefined, 'Reset layout'],
    ['dev/architecture/flows.md#a-box-is-dragged', undefined, 'A box is dragged'],
  ]);
  const [context, components, reset] = views.map(v => v.diagram);
  assert.deepEqual(context.edges.map(e => `${e.from}>${e.to}`), ['an-architect>system', 'system>vs-code', "system>the-project-s-folder"]);
  assert.equal(components.nodes.length, 6);
  assert.deepEqual(components.edges.find(e => e.to === 'webview-main' && e.from === 'src-editor'), { from: 'src-editor', to: 'webview-main', label: 'talks to' });
  assert.deepEqual(reset.nodes.map(n => n.label), ['Start', 'The user presses Reset layout', 'src/editor removes x and y from every box', 'End']);
  assert.equal(reset.direction, 'DOWN');
});

test('the model file names every place as file:line', () => {
  const written = JSON.parse(writeModel(model()));
  assert.deepEqual(Object.keys(written), ['system', 'elements', 'links', 'rules', 'unresolved']);
  assert.equal(written.elements[0].at, 'dev/architecture/components.md:7');
});
