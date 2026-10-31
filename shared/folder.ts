// The data folder: .gsdiagram in the project, unless configured. It is never outside the project.

import path from 'node:path';

export const DEFAULT_FOLDER = '.gsdiagram';

export function isInside(root: string, p: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(p));
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function resolveDataFolder(root: string, configured?: string): string {
  const folder = path.resolve(root, configured?.trim() || DEFAULT_FOLDER);
  if (!isInside(root, folder)) throw new Error(`The data folder ${folder} is outside the project ${root}.`);
  return folder;
}

// Reads gsdiagram.folder from the project's .vscode/settings.json, which may have comments and trailing commas.
export function folderSetting(settingsText: string | undefined): string | undefined {
  if (!settingsText) return undefined;
  const json = settingsText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"\\])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  const value = JSON.parse(json)['gsdiagram.folder'];
  return typeof value === 'string' ? value : undefined;
}
