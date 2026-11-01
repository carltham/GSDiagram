// The architectures of a project. Each architecture folder is one, of the files directly in it, and so is each of its
// subfolders, of all the files in it: dev/architecture and dev/architecture/old. A folder inside another architecture
// folder belongs to itself only.
//
// Each architecture has its own model, its own findings, and its own diagrams, in a subfolder of the data folder named
// after it: .gsdiagram/architecture, .gsdiagram/old. An archived one, an old or redundant architecture, is listed, but
// gives no findings, and Generate and Update leave it alone.

import path from 'node:path';
import { Described, readArchitecture, slugOf } from './architecture';
import { parseDiagram } from './diagram';
import { analyseArchitecture, ArchModel, modelViews } from './model';
import { architectureFoldersOf, idPattern, Project, SourceFile } from './project';

export interface Architecture {
  // Unique in the project: the folder's name, made unique when two are alike.
  name: string;
  // The folder, absolute and relative to the project.
  folder: string;
  rel: string;
  archived: boolean;
  files: SourceFile[];
  // Where its generated diagrams go.
  diagrams: string;
}

// A folder of an old architecture is archived unless marked current: old, archive, redundant, obsolete, ...
export const ARCHIVED_NAME = /^(old|archived?|redundant|obsolete|deprecated|legacy|retired|former)\b/i;

const relative = (project: Project, file: string) => path.relative(project.root, file).split(path.sep).join('/') || '.';

const found = new WeakMap<Project, Architecture[]>();

export function architecturesOf(project: Project): Architecture[] {
  if (!found.has(project)) found.set(project, find(project));
  return found.get(project)!;
}

function find(project: Project): Architecture[] {
  // The deepest architecture folder that holds a file is its own; then the subfolder of it the file is in, if any.
  const roots = [...project.architectureFolders].sort((a, b) => b.length - a.length);
  const byFolder = new Map<string, SourceFile[]>();
  for (const f of project.architecture) {
    const root = roots.find(r => f.file.startsWith(r + path.sep));
    if (!root) continue;
    const first = path.relative(root, f.file).split(path.sep);
    const folder = first.length > 1 ? path.join(root, first[0]) : root;
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), f]);
  }
  // Every architecture folder is listed, even empty; a subfolder only when it holds Markdown.
  const folders = [...project.architectureFolders, ...[...byFolder.keys()].filter(f => !project.architectureFolders.includes(f)).sort()];

  const taken = new Set<string>();
  return folders.map(folder => {
    const rel = relative(project, folder);
    const base = slugOf(path.basename(folder)) || 'architecture';
    let name = taken.has(base) ? `${slugOf(path.basename(path.dirname(folder)))}-${base}` : base;
    for (let i = 2; taken.has(name); i++) name = `${base}-${i}`;
    taken.add(name);
    return {
      name, folder, rel,
      archived: project.config.archived?.[rel] ?? ARCHIVED_NAME.test(path.basename(folder)),
      files: byFolder.get(folder) ?? [],
      diagrams: path.join(project.folder, name),
    };
  });
}

const models = new WeakMap<Architecture, ArchModel>();

// The model of one architecture's files.
export function modelOf(project: Project, a: Architecture): ArchModel {
  if (!models.has(a)) models.set(a, analyseArchitecture(a.files.map(({ file, text }) => ({ rel: relative(project, file), text })), path.basename(project.root)));
  return models.get(a)!;
}

// Every diagram one architecture describes: those drawn in its files, Mermaid blocks and marked sections, and the
// views of its model. A diagram drawn in them wins over a view with the same source.
export function describedIn(project: Project, a: Architecture): Described[] {
  const drawn = a.files.flatMap(({ file, text }) => readArchitecture(relative(project, file), text, idPattern(project.config)));
  const sources = new Set(drawn.map(d => d.source));
  return [...drawn, ...modelViews(modelOf(project, a), idPattern(project.config)).filter(v => !sources.has(v.source))];
}

// The architecture a diagram file belongs to: the one that describes its source; or else, for a source moved into an
// archived architecture, flows.md to old/flows.md, that one; or else the one whose subfolder of the data folder it is in.
export function architectureOfDiagram(project: Project, file: string, text: string): Architecture | undefined {
  const all = architecturesOf(project);
  let source: string | undefined;
  try { source = parseDiagram(text).source; } catch { /* not a diagram */ }
  const sourceFile = source?.replace(/#.*$/, '');
  const has = (a: Architecture, test: (rel: string) => boolean) => a.files.some(f => test(relative(project, f.file)));
  return (sourceFile ? all.find(a => has(a, rel => rel === sourceFile))
    ?? all.find(a => a.archived && has(a, rel => path.posix.basename(rel) === path.posix.basename(sourceFile))) : undefined)
    ?? all.find(a => path.dirname(file) === a.diagrams);
}

// The architectures Generate and Update draw, those not archived, that describe diagrams.
export const drawnArchitectures = (project: Project) => architecturesOf(project).filter(a => !a.archived && describedIn(project, a).length > 0);

// The architecture folders, as a message names them: dev/architecture, docs/design.
export const foldersOf = (project: Project) => architectureFoldersOf(project.config).join(', ');

export const isArchivedDiagram = (project: Project, file: string, text: string) => architectureOfDiagram(project, file, text)?.archived ?? false;
