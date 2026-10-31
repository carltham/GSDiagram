// The custom editor for *.diagram.json. Changes go through the text document, so undo, save, and diff work as for any file.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { parseDiagram } from '../shared/diagram';
import { Diagram, FromWebview, ToWebview } from '../shared/types';
import { Checker } from './check';

export const VIEW_TYPE = 'gsdiagram.editor';

export class DiagramEditor implements vscode.CustomTextEditorProvider {
  private active: vscode.WebviewPanel | undefined;
  private readonly documents = new Map<vscode.WebviewPanel, vscode.TextDocument>();

  constructor(private readonly context: vscode.ExtensionContext, private readonly checker: Checker) {}

  // The document of the diagram editor in front, if any.
  activeDocument(): vscode.TextDocument | undefined {
    return this.active ? this.documents.get(this.active) : undefined;
  }

  renderPng(): boolean {
    if (!this.active) return false;
    this.active.webview.postMessage({ type: 'renderPng' } satisfies ToWebview);
    return true;
  }

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const dist = vscode.Uri.joinPath(this.context.extensionUri, 'dist');
    panel.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    panel.webview.html = this.html(panel.webview, dist);
    this.documents.set(panel, document);
    if (panel.active) this.active = panel;

    const send = () => {
      const checked = this.checker.resultFor(document.uri);
      panel.webview.postMessage({
        type: 'update',
        text: document.getText(),
        processes: Object.fromEntries(checked?.processes ?? []),
        hasProcessesFile: !!checked?.project.processes,
      } satisfies ToWebview);
    };

    const subscriptions = [
      vscode.workspace.onDidChangeTextDocument(e => { if (e.document.uri.toString() === document.uri.toString()) send(); }),
      this.checker.onDidCheck(send),
      panel.onDidChangeViewState(() => { if (panel.active) this.active = panel; }),
      panel.webview.onDidReceiveMessage((m: FromWebview) => this.receive(m, document, send)),
    ];
    panel.onDidDispose(() => {
      subscriptions.forEach(s => s.dispose());
      this.documents.delete(panel);
      if (this.active === panel) this.active = undefined;
    });
  }

  private async receive(m: FromWebview, document: vscode.TextDocument, send: () => void) {
    switch (m.type) {
      case 'ready':
        send();
        break;
      case 'move':
        await this.change(document, d => {
          const n = d.nodes.find(x => x.id === m.id);
          if (n) { n.x = m.x; n.y = m.y; }
        });
        break;
      case 'resetLayout':
        await this.change(document, d => d.nodes.forEach(n => { delete n.x; delete n.y; }));
        break;
      case 'open':
        await this.openProcess(document, m.process);
        break;
      case 'png': {
        const file = document.uri.fsPath.replace(/\.diagram\.json$/, '.png');
        await writeFile(file, Buffer.from(m.data.replace(/^data:image\/png;base64,/, ''), 'base64'));
        vscode.window.showInformationMessage(`GSDiagram: saved ${path.basename(file)}.`);
        break;
      }
    }
  }

  private async change(document: vscode.TextDocument, f: (d: Diagram) => void) {
    let d: Diagram;
    try {
      d = parseDiagram(document.getText());
    } catch {
      return;
    }
    f(d);
    await replaceText(document, JSON.stringify(d, null, 2) + '\n');
  }

  private async openProcess(document: vscode.TextDocument, id: string) {
    const checked = this.checker.resultFor(document.uri);
    const p = checked?.processes.get(id);
    if (!checked?.project.processes || !p) return;
    const pos = new vscode.Position(p.line, 0);
    await vscode.window.showTextDocument(vscode.Uri.file(checked.project.processes.file),
      { selection: new vscode.Range(pos, pos), viewColumn: vscode.ViewColumn.Beside });
  }

  private html(webview: vscode.Webview, dist: vscode.Uri): string {
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    const uri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(dist, f));
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} blob: data:;">
  <link rel="stylesheet" href="${uri('style.css')}">
</head>
<body>
  <header>
    <h2 id="title"></h2>
    <button id="zoom-out" title="Zoom out">−</button>
    <button id="zoom-in" title="Zoom in">+</button>
    <button id="reset" title="Forget dragged positions">Reset layout</button>
    <button id="png" title="Save the diagram as a PNG next to it">Render PNG</button>
  </header>
  <div id="problem" hidden></div>
  <main><svg id="canvas"></svg></main>
  <aside id="detail"></aside>
  <script nonce="${nonce}" src="${uri('webview.js')}"></script>
</body>
</html>`;
  }
}

export async function replaceText(document: vscode.TextDocument, text: string): Promise<void> {
  if (text === document.getText()) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
  await vscode.workspace.applyEdit(edit);
}
