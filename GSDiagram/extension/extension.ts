// GSDiagram: diagrams of a project's processes, kept in the project's own folder and checked against its processes file.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { acceptChanges, modelSummary, plural, summary } from '../shared/check';
import { isInside, resolveDataFolder } from '../shared/folder';
import { architecturesOf, drawnArchitectures, foldersOf, modelOf } from '../shared/architectures';
import { Change, planDiagrams } from '../shared/generate';
import { MODEL_FILE, writeModel } from '../shared/model';
import { readConfig, writeConfig } from '../shared/project';
import { DEFAULT_ARCHITECTURE_FOLDER } from '../shared/types';
import { Checker } from './check';
import { DiagramEditor, replaceText, VIEW_TYPE } from './editor';
import { folderSettingOf, pickWorkspaceFolder } from './folder';
import { registerArchitectureCommands } from './architectures';
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
    ...registerArchitectureCommands(checker),
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

// Analyse architecture: writes the model of each architecture into its subfolder of the data folder, and says what it
// holds and what the check found in it.
async function analyse(checker: Checker) {
  await checker.run();
  const analysed = checker.all().flatMap(c => architecturesOf(c.project).map(a => ({ c, a, model: modelOf(c.project, a) })))
    .filter(({ model }) => model.elements.length > 0);
  if (analysed.length === 0) {
    const project = checker.all()[0]?.project;
    return vscode.window.showErrorMessage(`GSDiagram: nothing to analyse in ${project ? foldersOf(project) : DEFAULT_ARCHITECTURE_FOLDER}.`);
  }
  for (const { c, a, model } of analysed) {
    try {
      await mkdir(a.diagrams, { recursive: true });
      await writeFile(path.join(a.diagrams, MODEL_FILE), writeModel(model));
    } catch (e) {
      return vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
    }
    const files = new Set(a.files.map(f => f.file));
    const found = c.findings.filter(f => f.about === 'architecture' && files.has(f.file));
    const warnings = found.filter(f => f.severity === 'warning').length;
    const named = analysed.length > 1 ? `${a.name}${a.archived ? ', archived' : ''}: ` : '';
    vscode.window.showInformationMessage(`GSDiagram: ${named}${modelSummary(model)}; `
      + (a.archived ? 'archived, so not checked' : `${plural(warnings, 'warning')} and ${plural(found.length - warnings, 'note')} in the Problems panel`)
      + `. Written to ${relative(c.project.root, path.join(a.diagrams, MODEL_FILE))}.`);
  }
}

// Generate, or Update, in every architecture that is not archived and describes diagrams. A progress bar, in a
// notification and on top of the Diagrams list, shows each step and each file saved.
async function drawFromArchitecture(checker: Checker, update: boolean) {
  const title = update ? 'GSDiagram: updating diagrams' : 'GSDiagram: generating diagrams';
  const done = await vscode.window.withProgress({ location: { viewId: 'gsdiagram.diagrams' } }, () =>
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, progress => draw(checker, update, progress)));
  if (done.error) vscode.window.showErrorMessage(`GSDiagram: ${done.error}`);
  else vscode.window.showInformationMessage(`GSDiagram: ${done.message}`);
  if (done.changed) checker.soon();
}

type Progress = vscode.Progress<{ message?: string; increment?: number }>;

// The work of Generate or Update, step by step, with the progress of each: checking 10, planning 10, the edit 10,
// and saving the files 70, shared among them.
async function draw(checker: Checker, update: boolean, progress: Progress): Promise<{ message?: string; error?: string; changed?: boolean }> {
  progress.report({ message: 'checking the project' });
  await checker.run();
  progress.report({ increment: 10, message: 'reading the architecture' });
  const results = checker.all().filter(c => drawnArchitectures(c.project).length > 0);
  if (results.length === 0) {
    const project = checker.all()[0]?.project;
    return { error: `no diagrams are described in ${project ? foldersOf(project) : DEFAULT_ARCHITECTURE_FOLDER}.` };
  }
  const changes: Change[] = results.flatMap(c => planDiagrams(c.project, { update }));
  if (changes.length === 0) return { message: 'the diagrams are up to date.' };

  // A diagram open in an editor changes like an edit, so its editor follows and Undo works, and is saved; every other
  // file is written as it is, without opening it.
  progress.report({ increment: 10, message: `writing ${plural(changes.length, 'diagram')}` });
  const open = (c: Change) => vscode.workspace.textDocuments.find(d => d.uri.fsPath === c.file);
  const edited = changes.filter(c => !c.created && open(c));
  if (edited.length) {
    const edit = new vscode.WorkspaceEdit();
    for (const c of edited) edit.replace(vscode.Uri.file(c.file), new vscode.Range(0, 0, open(c)!.lineCount, 0), c.text);
    if (!await vscode.workspace.applyEdit(edit)) return { error: 'the diagrams could not be changed.' };
  }
  progress.report({ increment: 10 });
  for (const [i, c] of changes.entries()) {
    progress.report({ message: `saving ${path.basename(c.file)}, ${i + 1} of ${changes.length}` });
    if (edited.includes(c)) await open(c)!.save();
    else await vscode.workspace.fs.writeFile(vscode.Uri.file(c.file), Buffer.from(c.text));
    progress.report({ increment: 70 / changes.length });
  }

  // Named in the data folder: architecture/components.diagram.json.
  const named = (c: Change) => relative(results.find(r => isInside(r.project.folder, c.file))?.project.folder ?? path.dirname(c.file), c.file);
  const created = changes.filter(c => c.created).map(named);
  const updated = changes.filter(c => !c.created).map(named);
  return { changed: true, message: [created.length ? `created ${created.join(', ')}` : '',
    updated.length ? `${created.length ? 'and ' : ''}updated ${updated.join(', ')}` : ''].filter(Boolean).join(' ') + '.' };
}

export function deactivate() {}
