// Finds each workspace folder's project: its data folder from the setting, its config, diagrams, and processes file.

import * as vscode from 'vscode';
import { loadProject, Project } from '../shared/project';

export function folderSettingOf(ws: vscode.WorkspaceFolder): string | undefined {
  return vscode.workspace.getConfiguration('gsdiagram', ws.uri).get<string>('folder');
}

// Open documents may hold changes not yet saved; the project is read with them.
function openText(file: string): string | undefined {
  return vscode.workspace.textDocuments.find(d => d.uri.scheme === 'file' && d.uri.fsPath === file)?.getText();
}

export function loadWorkspaceProject(ws: vscode.WorkspaceFolder): Promise<Project> {
  return loadProject(ws.uri.fsPath, folderSettingOf(ws), openText);
}

export async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    vscode.window.showErrorMessage('GSDiagram needs an open folder: its data is kept in the project.');
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Which project?' });
}
