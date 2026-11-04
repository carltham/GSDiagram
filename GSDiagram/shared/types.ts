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
  // Where an architecture file describes the diagram, for a generated one: the file, relative to the project, and
  // the heading's anchor. Update draws it again from there.
  source?: string;
}

export interface Config {
  // The Markdown file that lists the processes, relative to the project.
  processesFile?: string;
  // The pattern of a process id, as a regular expression.
  idPattern?: string;
  // The folders of the architecture files, relative to the project. Each is an architecture, and so is each of its
  // subfolders, unless subfolderArchitectures is false. dev/architecture unless set.
  architectureFolders?: string[];
  // One folder, as before there could be several; read when architectureFolders is not set.
  architectureFolder?: string;
  // Architectures marked archived, true, or current, false, by their folder relative to the project. Unless marked, a
  // folder named old, archive, archived, redundant, obsolete, deprecated, legacy, retired, or former is archived.
  archived?: Record<string, boolean>;
  // Whether a subfolder of an architecture folder is an architecture of its own. True unless set; when false, a
  // subfolder is part of its folder's architecture, unless it is archived.
  subfolderArchitectures?: boolean;
}

export const DEFAULT_ARCHITECTURE_FOLDER = 'dev/architecture';

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
