// Runs inside the test instance of VS Code, on dev/testing/fixture.

import assert from 'node:assert/strict';
import path from 'node:path';
import Mocha from 'mocha';
import * as vscode from 'vscode';

const fixture = path.resolve(__dirname, '../../../dev/testing/fixture');
const diagram = vscode.Uri.file(path.join(fixture, '.gsdiagram/order.diagram.json'));
const processes = vscode.Uri.file(path.join(fixture, 'docs/processes.md'));

async function extension() {
  const ext = vscode.extensions.all.find(e => e.packageJSON.name === 'gsdiagram')!;
  const api = await ext.activate();
  await api.checker.run();
  return api;
}

function tests() {
  suite('GSDiagram', () => {
    test('the check puts its findings in the Problems panel', async () => {
      await extension();
      const inDiagram = vscode.languages.getDiagnostics(diagram).map(d => d.message);
      assert.deepEqual(inDiagram, ['ORDE9 is not in docs/processes.md.']);
      const inProcesses = vscode.languages.getDiagnostics(processes);
      assert.deepEqual(inProcesses.map(d => [d.range.start.line, d.message]), [[6, 'ORDE3 Cancel an order is in no diagram.']]);
    });

    test('a diagram opens in the GSDiagram editor', async () => {
      await extension();
      await vscode.commands.executeCommand('vscode.open', diagram);
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab!;
      assert.ok(tab.input instanceof vscode.TabInputCustom);
      assert.equal((tab.input as vscode.TabInputCustom).viewType, 'gsdiagram.editor');
    });

    test('the processes file shows which diagrams use each process', async () => {
      await extension();
      const doc = await vscode.workspace.openTextDocument(processes);
      const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', doc.uri);
      assert.deepEqual(lenses.map(l => [l.range.start.line, l.command?.title]), [[4, 'in order'], [5, 'in order'], [6, 'in no diagram']]);
    });
  });
}

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', timeout: 20000, color: false });
  mocha.suite.emit('pre-require', globalThis, 'suite', mocha);
  tests();
  return new Promise((ok, fail) => mocha.run(failures => failures ? fail(new Error(`${failures} tests failed`)) : ok()));
}
