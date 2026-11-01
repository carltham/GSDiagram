// Loads a project from disk: its data folder, config.json, diagrams, processes file, and architecture files.

import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { folderSetting, isInside, resolveDataFolder } from './folder';
import { Config, DEFAULT_ARCHITECTURE_FOLDER, DEFAULT_ID_PATTERN } from './types';

export interface SourceFile { file: string; text: string }

export interface Project {
  root: string;
  folder: string;
  config: Config;
  diagrams: SourceFile[];
  processes?: SourceFile;
  // The architecture folders, and the Markdown files in them and in all their subfolders.
  architectureFolders: string[];
  architecture: SourceFile[];
}

export const DIAGRAM_SUFFIX = '.diagram.json';

// The text of an open, possibly unsaved, document wins over the file on disk.
export type Overrides = (file: string) => string | undefined;

export async function readConfig(folder: string): Promise<Config> {
  const file = path.join(folder, 'config.json');
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
}

export async function writeConfig(folder: string, config: Config): Promise<void> {
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'config.json'), JSON.stringify(config, null, 2) + '\n');
}

export async function configuredFolder(root: string): Promise<string | undefined> {
  const settings = path.join(root, '.vscode', 'settings.json');
  return folderSetting(existsSync(settings) ? await readFile(settings, 'utf8') : undefined);
}

export async function loadProject(root: string, folderSettingValue?: string, overrides: Overrides = () => undefined): Promise<Project> {
  const folder = resolveDataFolder(root, folderSettingValue);
  const config = existsSync(folder) ? await readConfig(folder) : {};
  const read = async (file: string) => overrides(file) ?? await readFile(file, 'utf8');

  // The diagrams in the data folder and its subfolders, one per architecture.
  const diagrams: SourceFile[] = [];
  if (existsSync(folder))
    for (const file of await filesIn(folder, n => n.endsWith(DIAGRAM_SUFFIX))) diagrams.push({ file, text: await read(file) });

  let processes: SourceFile | undefined;
  if (config.processesFile) {
    const file = path.resolve(root, config.processesFile);
    if (isInside(root, file) && existsSync(file)) processes = { file, text: await read(file) };
  }
  const architectureFolders = architectureFoldersOf(config).map(f => path.resolve(root, f)).filter(f => isInside(root, f) && existsSync(f));
  const architecture: SourceFile[] = [];
  const seen = new Set<string>();
  for (const archFolder of architectureFolders) {
    for (const file of await filesIn(archFolder, n => /\.md$/i.test(n))) {
      if (seen.has(file)) continue;
      seen.add(file);
      architecture.push({ file, text: await read(file) });
    }
  }
  return { root, folder, config, diagrams, processes, architectureFolders, architecture };
}

// The architecture folders the config names, relative to the project.
export const architectureFoldersOf = (config: Config) =>
  config.architectureFolders?.length ? config.architectureFolders : [config.architectureFolder || DEFAULT_ARCHITECTURE_FOLDER];

// The files in a folder and all its subfolders whose names pass, sorted.
async function filesIn(folder: string, pass: (name: string) => boolean): Promise<string[]> {
  // parentPath is new in Node 20.12; VS Code 1.90 runs Node 20.9, which calls it path.
  return (await readdir(folder, { recursive: true, withFileTypes: true }))
    .filter(e => e.isFile() && pass(e.name))
    .map(e => path.join(e.parentPath ?? (e as unknown as { path: string }).path, e.name)).sort();
}

export const idPattern = (config: Config) => config.idPattern || DEFAULT_ID_PATTERN;
