// Draws the diagrams that the architecture files describe, and keeps them up to date with them.
//   Generate: each diagram described there that has no file yet gets one.
//   Update:   the same, and each generated diagram is drawn again from its source; dragged positions stay.
// A diagram without a source, drawn by hand, is never changed, nor is anything of an archived architecture.

import path from 'node:path';
import { Described, slugOf } from './architecture';
import { architecturesOf, describedIn } from './architectures';
import { parseDiagram } from './diagram';
import { DIAGRAM_SUFFIX, Project } from './project';
import { Diagram } from './types';

export interface Change {
  file: string;
  text: string;
  created: boolean;
}

const write = (d: Diagram) => JSON.stringify(d, null, 2) + '\n';

// Every diagram the project's architectures describe, archived ones too.
export function describedDiagrams(project: Project): Described[] {
  return architecturesOf(project).flatMap(a => describedIn(project, a));
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

// What Generate (update: false) or Update (update: true) would write, for every architecture that is not archived.
// A new diagram goes into the architecture's subfolder of the data folder.
export function planDiagrams(project: Project, { update }: { update: boolean }): Change[] {
  const bySource = new Map<string, { file: string; diagram: Diagram; text: string }>();
  for (const { file, text } of project.diagrams) {
    try {
      const diagram = parseDiagram(text);
      if (diagram.source) bySource.set(diagram.source, { file, diagram, text });
    } catch { /* reported by the check */ }
  }
  const changes: Change[] = [];

  for (const a of architecturesOf(project).filter(a => !a.archived)) {
    const taken = new Set(project.diagrams.filter(d => path.dirname(d.file) === a.diagrams).map(d => path.basename(d.file, DIAGRAM_SUFFIX)));
    for (const described of describedIn(project, a)) {
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
        file: path.join(a.diagrams, unique + DIAGRAM_SUFFIX),
        text: write({ title: d.title, ...(d.direction ? { direction: d.direction } : {}), source: described.source, nodes: d.nodes, edges: d.edges }),
        created: true,
      });
    }
  }
  return changes;
}
