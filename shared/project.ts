// Loads a project from disk: its data folder, config.json, diagrams, and processes file.

import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { folderSetting, isInside, resolveDataFolder } from './folder';
import { Config, DEFAULT_ID_PATTERN } from './types';

export interface SourceFile { file: string; text: string }

export interface Project {
  root: string;
  folder: string;
  config: Config;
  diagrams: SourceFile[];
  processes?: SourceFile;
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

  const diagrams: SourceFile[] = [];
  if (existsSync(folder)) {
    for (const name of (await readdir(folder)).filter(n => n.endsWith(DIAGRAM_SUFFIX)).sort()) {
      const file = path.join(folder, name);
      diagrams.push({ file, text: await read(file) });
    }
  }

  let processes: SourceFile | undefined;
  if (config.processesFile) {
    const file = path.resolve(root, config.processesFile);
    if (isInside(root, file) && existsSync(file)) processes = { file, text: await read(file) };
  }
  return { root, folder, config, diagrams, processes };
}

export const idPattern = (config: Config) => config.idPattern || DEFAULT_ID_PATTERN;
