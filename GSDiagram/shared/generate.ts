// Draws the diagrams that the architecture files describe, and keeps them up to date with them.
//   Generate: each diagram described there that has no file yet gets one.
//   Update:   the same, and each generated diagram is drawn again from its source; dragged positions stay.
// A diagram without a source, drawn by hand, is never changed.

import path from 'node:path';
import { Described, readArchitecture, slugOf } from './architecture';
import { parseDiagram } from './diagram';
import { analyseArchitecture, ArchModel, modelViews } from './model';
import { DIAGRAM_SUFFIX, idPattern, Project } from './project';
import { Diagram } from './types';

export interface Change {
  file: string;
  text: string;
  created: boolean;
}

const write = (d: Diagram) => JSON.stringify(d, null, 2) + '\n';

const relative = (project: Project, file: string) => path.relative(project.root, file).split(path.sep).join('/');

// The architecture model of the project's architecture files.
export function projectModel(project: Project): ArchModel {
  return analyseArchitecture(project.architecture.map(({ file, text }) => ({ rel: relative(project, file), text })), path.basename(project.root));
}

// Every diagram the project's architecture files describe: those drawn in them, Mermaid blocks and marked sections,
// and the views of the model. A diagram drawn in them wins over a view with the same source.
export function describedDiagrams(project: Project, model = projectModel(project)): Described[] {
  const drawn = project.architecture.flatMap(({ file, text }) => readArchitecture(relative(project, file), text, idPattern(project.config)));
  const sources = new Set(drawn.map(d => d.source));
  return [...drawn, ...modelViews(model, idPattern(project.config)).filter(v => !sources.has(v.source))];
}

// The diagram as its source describes it, with what the file keeps of its own: dragged positions, and what was accepted.
function redraw(old: Diagram, described: Described): Diagram {
  const d = described.diagram;
  const nodes = d.nodes.map(n => {
    const was = old.nodes.find(o => o.id === n.id);
    return was?.x !== undefined && was.y !== undefined ? { ...n, x: was.x, y: was.y } : n;
  });
  return {
    title: d.title, ...(d.direction ? { direction: d.direction } : {}), source: described.source, nodes, edges: d.edges,
    ...(old.drawn ? { drawn: old.drawn } : {}),
  };
}

// What Generate (update: false) or Update (update: true) would write.
export function planDiagrams(project: Project, { update }: { update: boolean }): Change[] {
  const bySource = new Map<string, { file: string; diagram: Diagram; text: string }>();
  for (const { file, text } of project.diagrams) {
    try {
      const diagram = parseDiagram(text);
      if (diagram.source) bySource.set(diagram.source, { file, diagram, text });
    } catch { /* reported by the check */ }
  }
  const taken = new Set(project.diagrams.map(d => path.basename(d.file, DIAGRAM_SUFFIX)));
  const changes: Change[] = [];

  for (const described of describedDiagrams(project)) {
    const there = bySource.get(described.source);
    if (there) {
      if (!update) continue;
      const text = write(redraw(there.diagram, described));
      if (text !== there.text) changes.push({ file: there.file, text, created: false });
      continue;
    }
    // Named by the marker, or else by its heading; by its file and heading when that name is taken.
    const fileName = slugOf(described.source.replace(/^.*\//, '').replace(/\.md(#.*)?$/i, ''));
    let name = described.name ?? (slugOf(described.heading) || fileName);
    if (taken.has(name) && !described.name) name = `${fileName}-${name}`;
    let unique = name, i = 2;
    while (taken.has(unique)) unique = `${name}-${i++}`;
    taken.add(unique);
    const d = described.diagram;
    changes.push({
      file: path.join(project.folder, unique + DIAGRAM_SUFFIX),
      text: write({ title: d.title, ...(d.direction ? { direction: d.direction } : {}), source: described.source, nodes: d.nodes, edges: d.edges }),
      created: true,
    });
  }
  return changes;
}
