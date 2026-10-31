// The diagram file, *.diagram.json, and the project's config.json.

export type NodeKind = 'state' | 'start' | 'end';

export interface DiagramNode {
  id: string;
  label: string;
  kind?: NodeKind;
  process?: string;
  // Set when the node has been dragged; otherwise the layout places it.
  x?: number;
  y?: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  process?: string;
}

export interface Diagram {
  title: string;
  direction?: 'RIGHT' | 'DOWN';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  // The text of each process as it was when the diagram was drawn, as a short hash.
  drawn?: Record<string, string>;
}

export interface Config {
  // The Markdown file that lists the processes, relative to the project.
  processesFile?: string;
  // The pattern of a process id, as a regular expression.
  idPattern?: string;
}

export const DEFAULT_ID_PATTERN = '[A-Z]{4}\\d+';

export interface Process {
  id: string;
  title: string;
  text: string;
  group: string;
  // Zero-based line in the processes file.
  line: number;
}

// What the extension sends to the webview, and what the webview sends back.
export type ToWebview =
  | { type: 'update'; text: string; processes: Record<string, Process>; hasProcessesFile: boolean }
  | { type: 'renderPng' };

export type FromWebview =
  | { type: 'ready' }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resetLayout' }
  | { type: 'open'; process: string }
  | { type: 'png'; data: string };
