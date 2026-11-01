// In the processes file: above each process, which diagrams use it; the same on hover.

import path from 'node:path';
import * as vscode from 'vscode';
import { DIAGRAM_SUFFIX } from '../shared/project';
import { Checker, Checked } from './check';

const nameOf = (file: string) => path.basename(file, DIAGRAM_SUFFIX);

function processesFileResult(checker: Checker, document: vscode.TextDocument): Checked | undefined {
  const checked = checker.resultFor(document.uri);
  return checked?.project.processes?.file === document.uri.fsPath ? checked : undefined;
}

export class ProcessLinks implements vscode.CodeLensProvider, vscode.HoverProvider {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changed.event;

  constructor(private readonly checker: Checker) {
    checker.onDidCheck(() => this.changed.fire());
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const checked = processesFileResult(this.checker, document);
    if (!checked) return [];
    const lenses: vscode.CodeLens[] = [];
    for (const p of checked.processes.values()) {
      const range = new vscode.Range(p.line, 0, p.line, 0);
      const files = checked.usage.get(p.id) ?? [];
      if (files.length === 0) {
        lenses.push(new vscode.CodeLens(range, { title: 'in no diagram', command: '' }));
      } else {
        for (const file of files) {
          lenses.push(new vscode.CodeLens(range, { title: `in ${nameOf(file)}`, command: 'gsdiagram.openDiagram', arguments: [vscode.Uri.file(file)] }));
        }
      }
    }
    return lenses;
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const checked = processesFileResult(this.checker, document);
    const p = checked && [...checked.processes.values()].find(x => x.line === position.line);
    if (!checked || !p) return undefined;
    const files = checked.usage.get(p.id) ?? [];
    const md = new vscode.MarkdownString(files.length
      ? `**${p.id}** is in: ${files.map(f => `[${nameOf(f)}](command:gsdiagram.openDiagram?${encodeURIComponent(JSON.stringify([vscode.Uri.file(f)]))})`).join(', ')}`
      : `**${p.id}** is in no diagram.`);
    md.isTrusted = { enabledCommands: ['gsdiagram.openDiagram'] };
    return new vscode.Hover(md);
  }
}
