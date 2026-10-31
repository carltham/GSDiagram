// GSDiagram: diagrams of a project's processes, kept in the project's own folder and checked against its processes file.

import path from 'node:path';
import * as vscode from 'vscode';
import { acceptChanges } from '../shared/check';
import { isInside, resolveDataFolder } from '../shared/folder';
import { readConfig, writeConfig } from '../shared/project';
import { Checker } from './check';
import { DiagramEditor, replaceText, VIEW_TYPE } from './editor';
import { folderSettingOf, pickWorkspaceFolder } from './folder';
import { ProcessLinks } from './links';

const relative = (root: string, p: string) => path.relative(root, p).split(path.sep).join('/');

// Only diagrams, config files, and Markdown can change the check.
const relevant = (d: vscode.TextDocument) => d.uri.scheme === 'file' && /(\.diagram\.json|config\.json|\.md)$/.test(d.fileName);

export function activate(context: vscode.ExtensionContext) {
  const checker = new Checker();
  const editor = new DiagramEditor(context, checker);
  const links = new ProcessLinks(checker);
  const markdown = { language: 'markdown', scheme: 'file' };

  context.subscriptions.push(
    checker,
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, editor, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.languages.registerCodeLensProvider(markdown, links),
    vscode.languages.registerHoverProvider(markdown, links),

    vscode.commands.registerCommand('gsdiagram.check', async () => {
      const found = await checker.run();
      const count = (s: string) => found.filter(f => f.severity === s).length;
      vscode.window.showInformationMessage(
        `GSDiagram: ${count('error')} errors, ${count('warning')} warnings, ${count('info')} processes in no diagram.`);
    }),

    vscode.commands.registerCommand('gsdiagram.acceptChanges', async () => {
      const document = editor.activeDocument()
        ?? (vscode.window.activeTextEditor?.document.fileName.endsWith('.diagram.json') ? vscode.window.activeTextEditor.document : undefined);
      if (!document) return vscode.window.showErrorMessage('GSDiagram: open a diagram first.');
      await checker.run();
      const checked = checker.resultFor(document.uri);
      if (!checked?.project.processes) return vscode.window.showErrorMessage('GSDiagram: no processes file is set.');
      try {
        await replaceText(document, acceptChanges(document.getText(), checked.processes));
      } catch (e) {
        vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
      }
    }),

    vscode.commands.registerCommand('gsdiagram.renderPng', () => {
      if (!editor.renderPng()) vscode.window.showErrorMessage('GSDiagram: open a diagram first.');
    }),

    vscode.commands.registerCommand('gsdiagram.chooseFolder', async () => {
      const ws = await pickWorkspaceFolder();
      if (!ws) return;
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, defaultUri: ws.uri, openLabel: 'Use as data folder' });
      if (!picked?.[0]) return;
      if (!isInside(ws.uri.fsPath, picked[0].fsPath))
        return vscode.window.showErrorMessage('GSDiagram: the data folder must be inside the project.');
      await vscode.workspace.getConfiguration('gsdiagram', ws.uri)
        .update('folder', relative(ws.uri.fsPath, picked[0].fsPath), vscode.ConfigurationTarget.WorkspaceFolder);
      checker.soon();
    }),

    vscode.commands.registerCommand('gsdiagram.setProcessesFile', async () => {
      const ws = await pickWorkspaceFolder();
      if (!ws) return;
      const picked = await vscode.window.showOpenDialog({ canSelectFiles: true, defaultUri: ws.uri, filters: { Markdown: ['md'] }, openLabel: 'Use as processes file' });
      if (!picked?.[0]) return;
      if (!isInside(ws.uri.fsPath, picked[0].fsPath))
        return vscode.window.showErrorMessage('GSDiagram: the processes file must be inside the project.');
      try {
        const folder = resolveDataFolder(ws.uri.fsPath, folderSettingOf(ws));
        await writeConfig(folder, { ...(await readConfig(folder)), processesFile: relative(ws.uri.fsPath, picked[0].fsPath) });
      } catch (e) {
        return vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
      }
      checker.soon();
    }),

    vscode.commands.registerCommand('gsdiagram.openDiagram', (uri: vscode.Uri) => vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE)),

    vscode.workspace.onDidChangeTextDocument(e => { if (relevant(e.document)) checker.soon(); }),
    vscode.workspace.onDidSaveTextDocument(d => { if (relevant(d)) checker.soon(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => checker.soon()),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('gsdiagram')) checker.soon(); }),
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/{*.diagram.json,config.json,*.md}');
  watcher.onDidCreate(() => checker.soon());
  watcher.onDidDelete(() => checker.soon());
  watcher.onDidChange(() => checker.soon());
  context.subscriptions.push(watcher);

  checker.run();
  return { checker };
}

export function deactivate() {}
