// Runs the check on every workspace folder, puts the findings in the Problems panel, and keeps what the editor and the links need.

import * as vscode from 'vscode';
import { isArchivedDiagram } from '../shared/architectures';
import { checkProject, Finding } from '../shared/check';
import { parseDiagram, usedProcesses } from '../shared/diagram';
import { readProcesses } from '../shared/processes';
import { idPattern, Project } from '../shared/project';
import { Process } from '../shared/types';
import { loadWorkspaceProject } from './folder';

export interface Checked {
  project: Project;
  processes: Map<string, Process>;
  // For each process id, the diagram files that use it.
  usage: Map<string, string[]>;
  findings: Finding[];
}

const SEVERITY = { error: vscode.DiagnosticSeverity.Error, warning: vscode.DiagnosticSeverity.Warning, info: vscode.DiagnosticSeverity.Information };

export class Checker implements vscode.Disposable {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('gsdiagram');
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidCheck = this.changed.event;
  private readonly results = new Map<string, Checked>();
  private timer: NodeJS.Timeout | undefined;
  private refused = new Set<string>();

  // The result for the workspace folder that holds the file.
  resultFor(file: vscode.Uri): Checked | undefined {
    const ws = vscode.workspace.getWorkspaceFolder(file);
    return ws ? this.results.get(ws.uri.fsPath) : undefined;
  }

  all(): Checked[] {
    return [...this.results.values()];
  }

  soon(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 300);
  }

  async run(): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.results.clear();
    for (const ws of vscode.workspace.workspaceFolders ?? []) {
      let project: Project;
      try {
        project = await loadWorkspaceProject(ws);
        this.refused.delete(ws.uri.fsPath);
      } catch (e) {
        if (!this.refused.has(ws.uri.fsPath)) vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
        this.refused.add(ws.uri.fsPath);
        continue;
      }
      const processes = project.processes ? readProcesses(project.processes.text, idPattern(project.config)) : new Map<string, Process>();
      const usage = new Map<string, string[]>();
      // An archived architecture's diagrams do not count: a process only they use is in no diagram.
      for (const { file, text } of project.diagrams.filter(d => !isArchivedDiagram(project, d.file, d.text))) {
        try {
          for (const id of usedProcesses(parseDiagram(text))) usage.set(id, [...(usage.get(id) ?? []), file]);
        } catch { /* reported by the check */ }
      }
      const found = checkProject(project);
      this.results.set(ws.uri.fsPath, { project, processes, usage, findings: found });
      findings.push(...found);
    }

    this.diagnostics.clear();
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const f of findings) {
      const range = new vscode.Range(f.line, f.column, f.line, f.column + f.length);
      const d = new vscode.Diagnostic(range, f.message, SEVERITY[f.severity]);
      d.source = 'GSDiagram';
      byFile.set(f.file, [...(byFile.get(f.file) ?? []), d]);
    }
    for (const [file, list] of byFile) this.diagnostics.set(vscode.Uri.file(file), list);
    this.changed.fire();
    return findings;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.diagnostics.dispose();
    this.changed.dispose();
  }
}
