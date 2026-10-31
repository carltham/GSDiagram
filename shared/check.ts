// Checks a project's diagrams against its processes file. Each finding names a file and a place in it.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseDiagram, usedProcesses } from './diagram';
import { describedDiagrams } from './generate';
import { readProcesses } from './processes';
import { idPattern, Project } from './project';
import { Diagram, Process } from './types';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  file: string;
  line: number;
  column: number;
  length: number;
  severity: Severity;
  message: string;
}

export const hashOf = (p: Process) => createHash('sha1').update(`${p.title}\n${p.text}`).digest('hex').slice(0, 10);

function place(text: string, offset: number, length: number) {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length - 1, column: before[before.length - 1].length, length };
}

// Where "value" appears in the file, after the key, as near as can be found.
function locate(text: string, key: string, value: string) {
  const m = new RegExp(`"${key}"\\s*:\\s*"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).exec(text);
  return m ? place(text, m.index, m[0].length) : place(text, 0, 1);
}

export function checkProject(project: Project): Finding[] {
  const findings: Finding[] = [];
  const processes = project.processes ? readProcesses(project.processes.text, idPattern(project.config)) : undefined;
  const used = new Set<string>();
  const sources = new Set(describedDiagrams(project).map(d => d.source));

  if (project.config.processesFile && !project.processes)
    findings.push({ file: path.join(project.folder, 'config.json'), line: 0, column: 0, length: 1, severity: 'error',
      message: `The processes file ${project.config.processesFile} is missing, or outside the project.` });

  for (const { file, text } of project.diagrams) {
    let d: Diagram;
    try {
      d = parseDiagram(text);
    } catch (e) {
      const at = /position (\d+)/.exec(String(e));
      findings.push({ file, ...place(text, at ? +at[1] : 0, 1), severity: 'error', message: `Not a diagram: ${(e as Error).message}` });
      continue;
    }

    if (d.source && !sources.has(d.source))
      findings.push({ file, ...locate(text, 'source', d.source), severity: 'warning',
        message: `The source ${d.source} of this diagram is gone. Update diagrams draws it again when it is back.` });

    const ids = new Set<string>();
    for (const n of d.nodes) {
      if (ids.has(n.id)) findings.push({ file, ...locate(text, 'id', n.id), severity: 'error', message: `The node id ${n.id} is used twice.` });
      ids.add(n.id);
    }
    for (const e of d.edges) {
      for (const end of [e.from, e.to]) {
        if (!ids.has(end)) findings.push({ file, ...locate(text, end === e.from ? 'from' : 'to', end), severity: 'error', message: `No node has the id ${end}.` });
      }
    }

    for (const id of usedProcesses(d)) {
      used.add(id);
      if (!processes) continue;
      const p = processes.get(id);
      if (!p) {
        findings.push({ file, ...locate(text, 'process', id), severity: 'warning', message: `${id} is not in ${project.config.processesFile}.` });
      } else if (d.drawn?.[id] && d.drawn[id] !== hashOf(p)) {
        findings.push({ file, ...locate(text, 'process', id), severity: 'warning',
          message: `${id} ${p.title} has changed since the diagram was drawn. Check the diagram, then run Accept process changes.` });
      }
    }
  }

  if (processes && project.processes) {
    for (const p of processes.values()) {
      if (!used.has(p.id)) findings.push({ file: project.processes.file, line: p.line, column: 0, length: p.id.length + 4,
        severity: 'info', message: `${p.id} ${p.title} is in no diagram.` });
    }
  }
  return findings;
}

// Records the current text of every process the diagram uses, so later changes show up in the check.
export function acceptChanges(text: string, processes: Map<string, Process>): string {
  const d = parseDiagram(text);
  const drawn: Record<string, string> = {};
  for (const id of usedProcesses(d).sort()) {
    const p = processes.get(id);
    if (p) drawn[id] = hashOf(p);
  }
  return JSON.stringify({ ...d, drawn }, null, 2) + '\n';
}
