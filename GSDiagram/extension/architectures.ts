// The commands on the architecture folders: add one, remove one, and mark an architecture archived or current. Each
// writes config.json in the data folder, keeping its other fields, and the check runs again.

import path from 'node:path';
import * as vscode from 'vscode';
import { architecturesOf } from '../shared/architectures';
import { isInside, resolveDataFolder } from '../shared/folder';
import { architectureFoldersOf, readConfig, writeConfig } from '../shared/project';
import { Config } from '../shared/types';
import { Checker } from './check';
import { folderSettingOf, pickWorkspaceFolder } from './folder';

// What a row of an architecture in the side bar carries.
export interface ArchitectureRef { root: string; rel: string }

const relative = (root: string, p: string) => path.relative(root, p).split(path.sep).join('/');

async function changeConfig(ws: vscode.WorkspaceFolder, change: (c: Config) => Config): Promise<boolean> {
  try {
    const folder = resolveDataFolder(ws.uri.fsPath, folderSettingOf(ws));
    await writeConfig(folder, change(await readConfig(folder)));
    return true;
  } catch (e) {
    vscode.window.showErrorMessage(`GSDiagram: ${(e as Error).message}`);
    return false;
  }
}

// The workspace folder of a row, or else the one the user picks.
async function workspaceOf(ref?: ArchitectureRef): Promise<vscode.WorkspaceFolder | undefined> {
  return ref ? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(ref.root)) : pickWorkspaceFolder();
}

export function registerArchitectureCommands(checker: Checker): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('gsdiagram.addArchitectureFolder', async () => {
      const ws = await pickWorkspaceFolder();
      if (!ws) return;
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, defaultUri: ws.uri, openLabel: 'Add as architecture folder' });
      if (!picked?.[0]) return;
      if (!isInside(ws.uri.fsPath, picked[0].fsPath))
        return vscode.window.showErrorMessage('GSDiagram: an architecture folder must be inside the project.');
      const rel = relative(ws.uri.fsPath, picked[0].fsPath);
      if (await changeConfig(ws, c => {
        const folders = architectureFoldersOf(c);
        const { architectureFolder: _, ...rest } = c;
        return folders.includes(rel) ? c : { ...rest, architectureFolders: [...folders, rel] };
      })) checker.soon();
    }),

    vscode.commands.registerCommand('gsdiagram.removeArchitectureFolder', async (ref?: ArchitectureRef) => {
      const ws = await workspaceOf(ref);
      if (!ws) return;
      const config = checker.resultFor(ws.uri)?.project.config ?? {};
      const folders = architectureFoldersOf(config);
      const rel = ref?.rel ?? await vscode.window.showQuickPick(folders, { placeHolder: 'The architecture folder to remove from the list' });
      if (!rel) return;
      if (!folders.includes(rel))
        return vscode.window.showErrorMessage(`GSDiagram: ${rel} is a subfolder of an architecture folder; archive it instead, or move it.`);
      if (folders.length === 1) return vscode.window.showErrorMessage('GSDiagram: the last architecture folder cannot be removed.');
      if (await changeConfig(ws, c => {
        const { architectureFolder: _, ...rest } = c;
        return { ...rest, architectureFolders: architectureFoldersOf(c).filter(f => f !== rel) };
      })) checker.soon();
    }),

    ...([['gsdiagram.archive', true], ['gsdiagram.unarchive', false]] as const).map(([command, archived]) =>
      vscode.commands.registerCommand(command, async (ref?: ArchitectureRef) => {
        const ws = await workspaceOf(ref);
        if (!ws) return;
        let rel = ref?.rel;
        if (!rel) {
          const project = checker.resultFor(ws.uri)?.project;
          const choices = project ? architecturesOf(project).filter(a => a.archived !== archived).map(a => a.rel) : [];
          if (choices.length === 0)
            return vscode.window.showInformationMessage(`GSDiagram: no architecture to mark ${archived ? 'archived' : 'current'}.`);
          rel = await vscode.window.showQuickPick(choices, { placeHolder: `The architecture to mark ${archived ? 'archived' : 'current'}` });
          if (!rel) return;
        }
        if (await changeConfig(ws, c => ({ ...c, archived: { ...c.archived, [rel!]: archived } }))) checker.soon();
      })),
  ];
}
