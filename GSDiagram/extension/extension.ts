// GSDiagram: diagrams of a project's processes, kept in the project's own folder and checked against its processes file.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { acceptChanges, modelSummary, plural, summary } from '../shared/check';
import { isInside, resolveDataFolder } from '../shared/folder';
import { Change, describedDiagrams, planDiagrams, projectModel } from '../shared/generate';
import { MODEL_FILE, writeModel } from '../shared/model';
import { readConfig, writeConfig } from '../shared/project';
import { DEFAULT_ARCHITECTURE_FOLDER } from '../shared/types';
import { Checker } from './check';
import { DiagramEditor, replaceText, VIEW_TYPE } from './editor';
import { folderSettingOf, pickWorkspaceFolder } from './folder';
import { ProcessLinks } from './links';
import { ArchitectureTree, DiagramTree } from './sidebar';

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
    vscode.window.createTreeView('gsdiagram.diagrams', { treeDataProvider: new DiagramTree(checker) }),
    vscode.window.createTreeView('gsdiagram.architecture', { treeDataProvider: new ArchitectureTree(checker), showCollapseAll: true }),
    vscode.commands.registerCommand('gsdiagram.openReadme',
      () => vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(context.extensionUri, 'README.md'))),

    vscode.commands.registerCommand('gsdiagram.check', async () => {
      vscode.window.showInformationMessage(`GSDiagram: ${summary(await checker.run())}`);
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

    vscode.commands.registerCommand('gsdiagram.analyse', () => analyse(checker)),
    vscode.commands.registerCommand('gsdiagram.generate', () => drawFromArchitecture(checker, false)),
    vscode.commands.registerCommand('gsdiagram.update', () => drawFromArchitecture(checker, true)),

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

// Analyse architecture: writes the model of every workspace folder's architecture files into its data folder, and
// says what it holds and what the check found in it.
async function analyse(checker: Checker) {
  await checker.run();
  const analysed = checker.all().map(c => ({ c, model: projectModel(c.project) })).filter(({ model }) => model.elements.length > 0);
  if (analysed.length === 0) {
    const folder = checker.all()[0]?.project.config.architectureFolder || DEFAULT_ARCHITECTURE_FOLDER;
    return vscode.window.showErrorMessage(`GSDiagram: nothing to analyse in ${folder}.`);
  }
  for (const { c, model } of analysed) {
    try {
      await mkdir(c.project.folder, { recursive: true });
      await writeFile(path.join(c.project.folder, MODEL_FILE), writeModel(model));
    } catch (e) {
      return vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
    }
    const found = c.findings.filter(f => f.about === 'architecture');
    const warnings = found.filter(f => f.severity === 'warning').length;
    vscode.window.showInformationMessage(`GSDiagram: ${modelSummary(model)}; ${plural(warnings, 'warning')} and ${plural(found.length - warnings, 'note')} `
      + `in the Problems panel. Written to ${relative(c.project.root, path.join(c.project.folder, MODEL_FILE))}.`);
  }
}

// Generate, or Update, in every workspace folder whose architecture files describe diagrams. The files change like an
// edit would, so Undo works, and are saved.
async function drawFromArchitecture(checker: Checker, update: boolean) {
  await checker.run();
  const results = checker.all().filter(c => describedDiagrams(c.project).length > 0);
  if (results.length === 0) {
    const folder = checker.all()[0]?.project.config.architectureFolder || DEFAULT_ARCHITECTURE_FOLDER;
    return vscode.window.showErrorMessage(`GSDiagram: no diagrams are described in ${folder}.`);
  }
  const changes: Change[] = results.flatMap(c => planDiagrams(c.project, { update }));
  if (changes.length === 0) return vscode.window.showInformationMessage('GSDiagram: the diagrams are up to date.');

  const edit = new vscode.WorkspaceEdit();
  for (const c of changes) {
    const uri = vscode.Uri.file(c.file);
    if (c.created) {
      edit.createFile(uri, { ignoreIfExists: false });
      edit.insert(uri, new vscode.Position(0, 0), c.text);
    } else {
      const document = await vscode.workspace.openTextDocument(uri);
      edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), c.text);
    }
  }
  if (!await vscode.workspace.applyEdit(edit)) return vscode.window.showErrorMessage('GSDiagram: the diagrams could not be changed.');
  for (const c of changes) await (await vscode.workspace.openTextDocument(vscode.Uri.file(c.file))).save();

  const created = changes.filter(c => c.created).map(c => path.basename(c.file));
  const updated = changes.filter(c => !c.created).map(c => path.basename(c.file));
  vscode.window.showInformationMessage(['GSDiagram:',
    created.length ? `created ${created.join(', ')}` : '',
    updated.length ? `${created.length ? 'and ' : ''}updated ${updated.join(', ')}` : ''].filter(Boolean).join(' ') + '.');
  checker.soon();
}

export function deactivate() {}
