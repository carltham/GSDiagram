// Reading a diagram file. Used both in the extension and in the webview, so it needs nothing from Node.

import { Diagram } from './types';

export function parseDiagram(text: string): Diagram {
  const d = JSON.parse(text);
  if (typeof d !== 'object' || d === null || !Array.isArray(d.nodes) || !Array.isArray(d.edges))
    throw new Error('A diagram needs "nodes" and "edges" lists.');
  return d;
}

// Every process id a diagram uses, on its nodes and its edges.
export function usedProcesses(d: Diagram): string[] {
  return [...new Set([...d.nodes, ...d.edges].map(x => x.process).filter((p): p is string => !!p))];
}
