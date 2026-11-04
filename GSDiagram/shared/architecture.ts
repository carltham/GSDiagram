// Reads the diagrams that the architecture files describe. Used both in the extension and the command line.
//
// A diagram is:
//   - a Mermaid block of a flowchart (flowchart, graph) or a state diagram (stateDiagram, stateDiagram-v2);
//   - a section marked <!-- diagram --> (or <!-- diagram: name -->), from its list items with arrows,
//       - Draft → Sent: Send (INVO10)
//     or, without any, from its numbered steps, one after the other.
// A marker followed by a Mermaid block in its section names that block instead.
// A process id in parentheses, (INVO10), links a box or an arrow to that process. Start, End, and [*] are the dots.

import { Diagram, DiagramEdge, DiagramNode, DEFAULT_ID_PATTERN } from './types';

export interface Described {
  // Where the diagram is described: the file, relative to the project, and the heading's anchor.
  source: string;
  // The name given in the marker, if any.
  name?: string;
  heading: string;
  diagram: Diagram;
}

export const slugOf = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Markdown kept as plain text: links, emphasis, and code marks are dropped.
export function plain(s: string): string {
  return s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
}

const DOTS: Record<string, 'start' | 'end'> = { 'start': 'start', 'end': 'end' };

class Builder {
  readonly nodes: DiagramNode[] = [];
  readonly edges: DiagramEdge[] = [];
  constructor(private readonly id: RegExp) {}

  // A label with its process: "Send (INVO10)" is the label Send and the process INVO10.
  linked(text: string): { label: string; process?: string } {
    const t = plain(text);
    const inParens = new RegExp(`\\s*\\(\\s*(${this.id.source})\\s*\\)`).exec(t);
    if (inParens) return { label: (t.slice(0, inParens.index) + t.slice(inParens.index + inParens[0].length)).trim() || inParens[1], process: inParens[1] };
    return { label: t };
  }

  node(id: string, text?: string, kind?: 'start' | 'end'): string {
    let n = this.nodes.find(x => x.id === id);
    if (!n) {
      n = { id, label: '' };
      if (kind) { n.kind = kind; n.label = kind === 'start' ? 'Start' : 'End'; }
      this.nodes.push(n);
    }
    if (text !== undefined && !n.kind) {
      const { label, process } = this.linked(text);
      n.label = label;
      if (process) n.process = process;
    }
    if (!n.label) n.label = id;
    return id;
  }

  // A box named in prose; its id is made from its name.
  named(name: string): string {
    const t = plain(name);
    return this.node(slugOf(this.linked(t).label) || 'box', t);
  }

  edge(from: string, to: string, text?: string) {
    const e: DiagramEdge = { from, to };
    if (text) {
      const { label, process } = this.linked(text);
      if (label) e.label = label;
      if (process) e.process = process;
    }
    this.edges.push(e);
  }

  diagram(title: string, direction?: 'RIGHT' | 'DOWN'): Diagram | undefined {
    if (this.edges.length === 0 && this.nodes.filter(n => !n.kind).length < 2) return undefined;
    return { title, ...(direction ? { direction } : {}), nodes: this.nodes, edges: this.edges };
  }
}

// "- A → B → C: label" lists, Start and End as dots.
function fromArrows(items: string[], b: Builder): void {
  for (const item of items) {
    const colon = item.search(/:\s/);
    const path = colon >= 0 ? item.slice(0, colon) : item;
    const label = colon >= 0 ? item.slice(colon + 1).trim() : undefined;
    const names = path.split(/\s*(?:→|-->|->)\s*/);
    const ids = names.map((n, i) => {
      const t = plain(n);
      const dot = t === '[*]' ? (i === 0 ? 'start' : 'end') : DOTS[t.toLowerCase()];
      return dot ? b.node(dot, undefined, dot) : b.named(n);
    });
    for (let i = 1; i < ids.length; i++) b.edge(ids[i - 1], ids[i], i === ids.length - 1 ? label : undefined);
  }
}

// Numbered steps, one after the other. A step's label is its text up to the first colon, full stop, or semicolon.
function fromSteps(steps: string[], b: Builder): void {
  let last = b.node('start', undefined, 'start');
  steps.forEach((step, i) => {
    const { process } = b.linked(plain(step));
    // Cut where the first sentence or clause ends, but not inside **bold**, `code`, or a link.
    const masked = step.replace(/\*\*.+?\*\*|`[^`]+`|\[[^\]]*\]\([^)]*\)/g, m => 'x'.repeat(m.length));
    const cut = masked.search(/:\s|\.\s|;\s|\.$/);
    const label = b.linked(plain(cut < 0 ? step : step.slice(0, cut))).label;
    const id = b.node(`step${i + 1}`);
    Object.assign(b.nodes.find(n => n.id === id)!, { label, ...(process ? { process } : {}) });
    b.edge(last, id);
    last = id;
  });
  b.edge(last, b.node('end', undefined, 'end'));
}

const OPEN: [string, string][] = [['((', '))'], ['([', '])'], ['[(', ')]'], ['[[', ']]'], ['[/', '/]'], ['[\\', '\\]'], ['{{', '}}'], ['[', ']'], ['(', ')'], ['{', '}'], ['>', ']']];
const ARROW = /^\s*(?:--\s+([^-][^>]*?)\s+-->|-\.->|-\.-|==>|-->|---|--[xo]|==)\s*(?:\|([^|]*)\|)?\s*/;

// A Mermaid flowchart: nodes A[Text], A(Text), A{Text}, ...; arrows A --> B, A -->|text| B, A -- text --> B.
function fromFlowchart(lines: string[], b: Builder): 'RIGHT' | 'DOWN' | undefined {
  const head = /^(?:flowchart|graph)\s+(\w+)/.exec(lines[0].trim());
  const direction = head && /^(LR|RL)$/.test(head[1]) ? 'RIGHT' : head ? 'DOWN' : undefined;
  for (const raw of lines.slice(1).flatMap(l => l.split(';'))) {
    const line = raw.trim();
    if (!line || /^(%%|subgraph\b|end\b|classDef\b|class\b|style\b|click\b|linkStyle\b|direction\b)/.test(line) || line.includes('&')) continue;
    let rest = line;
    const node = (): string | undefined => {
      const m = /^\s*(\w+)/.exec(rest);
      if (!m) return undefined;
      rest = rest.slice(m[0].length);
      const open = OPEN.find(([o]) => rest.startsWith(o));
      let text: string | undefined;
      if (open) {
        const close = rest.indexOf(open[1], open[0].length);
        if (close < 0) return undefined;
        text = rest.slice(open[0].length, close).trim().replace(/^"(.*)"$/, '$1');
        rest = rest.slice(close + open[1].length);
      }
      rest = rest.replace(/^:::\w+/, '');
      return b.node(m[1], text);
    };
    let from = node();
    while (from) {
      const a = ARROW.exec(rest);
      if (!a) break;
      rest = rest.slice(a[0].length);
      const to = node();
      if (!to) break;
      b.edge(from, to, (a[1] ?? a[2])?.trim().replace(/^"(.*)"$/, '$1'));
      from = to;
    }
  }
  return direction;
}

// A Mermaid state diagram: A --> B : text, [*] as Start and End, state "Text" as A, A : Text.
function fromStateDiagram(lines: string[], b: Builder): 'RIGHT' | 'DOWN' | undefined {
  let direction: 'RIGHT' | 'DOWN' | undefined;
  let inNote = false;
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (inNote) { if (/^end note/.test(line)) inNote = false; continue; }
    if (/^note\b/.test(line)) { if (!line.includes(':')) inNote = true; continue; }
    const dir = /^direction\s+(\w+)/.exec(line);
    if (dir) { direction = /^(LR|RL)$/.test(dir[1]) ? 'RIGHT' : 'DOWN'; continue; }
    const named = /^state\s+"([^"]+)"\s+as\s+(\w+)/.exec(line);
    if (named) { b.node(named[2], named[1]); continue; }
    const t = /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.+))?$/.exec(line);
    if (t) {
      const from = t[1] === '[*]' ? b.node('start', undefined, 'start') : b.node(t[1]);
      const to = t[2] === '[*]' ? b.node('end', undefined, 'end') : b.node(t[2]);
      b.edge(from, to, t[3]);
      continue;
    }
    const described = /^(\w+)\s*:\s*(.+)$/.exec(line);
    if (described) b.node(described[1], described[2]);
  }
  return direction;
}

// A diagram of numbered steps, one after the other, from Start to End.
export function stepsDiagram(title: string, steps: string[], idPattern = DEFAULT_ID_PATTERN, direction?: 'RIGHT' | 'DOWN'): Diagram {
  const b = new Builder(new RegExp(idPattern));
  fromSteps(steps, b);
  return { title, ...(direction ? { direction } : {}), nodes: b.nodes, edges: b.edges };
}

// Every diagram one architecture file describes. rel is the file's path relative to the project.
export function readArchitecture(rel: string, md: string, idPattern = DEFAULT_ID_PATTERN): Described[] {
  const id = new RegExp(idPattern);
  const found: Described[] = [];
  const anchors = new Map<string, number>();
  const sourceOf = (heading: string) => {
    const anchor = heading ? slugOf(heading) : '';
    const n = (anchors.get(anchor) ?? 0) + 1;
    anchors.set(anchor, n);
    return rel + (anchor || n > 1 ? `#${anchor}${n > 1 ? `-${n}` : ''}` : '');
  };
  const fileTitle = rel.replace(/^.*\//, '').replace(/\.md$/i, '');

  let heading = '';
  let marker: { name?: string } | undefined;
  let arrows: string[] = [], steps: string[] = [];
  let fence: { mermaid: boolean; lines: string[] } | undefined;

  const closeSection = () => {
    if (marker) {
      const b = new Builder(id);
      if (arrows.length) fromArrows(arrows, b);
      else if (steps.length) fromSteps(steps, b);
      const d = b.diagram(heading || fileTitle);
      if (d) found.push({ source: sourceOf(heading), name: marker.name, heading: heading || fileTitle, diagram: d });
    }
    marker = undefined; arrows = []; steps = [];
  };

  for (const text of md.split(/\r?\n/)) {
    if (fence) {
      if (/^\s*(```|~~~)/.test(text)) {
        if (fence.mermaid && fence.lines.length) {
          const b = new Builder(id);
          const kind = fence.lines[0].trim();
          const direction = /^(flowchart|graph)\b/.test(kind) ? fromFlowchart(fence.lines, b)
            : /^stateDiagram/.test(kind) ? fromStateDiagram(fence.lines, b) : null;
          const d = direction !== null ? b.diagram(heading || fileTitle, direction) : undefined;
          // A marker belongs to the first Mermaid block after it in its section.
          if (d) found.push({ source: sourceOf(heading), name: marker?.name, heading: heading || fileTitle, diagram: d });
          if (d) marker = undefined;
        }
        fence = undefined;
      } else if (text.trim() && !/^\s*%%/.test(text)) fence.lines.push(text);
      continue;
    }
    const open = /^\s*(```|~~~)\s*(\w*)/.exec(text);
    if (open) { fence = { mermaid: open[2] === 'mermaid', lines: [] }; continue; }
    const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(text);
    if (h) { closeSection(); heading = plain(h[1]); continue; }
    const m = /^\s*<!--\s*diagram(?:\s*:\s*([\w.-]+))?\s*-->\s*$/.exec(text);
    if (m) { marker = { name: m[1] }; continue; }
    const arrow = /^\s{0,3}[-*+]\s+(.*(?:→|->).*)$/.exec(text);
    if (arrow) { arrows.push(arrow[1]); continue; }
    const step = /^\s{0,3}\d+[.)]\s+(.+)$/.exec(text);
    if (step) steps.push(step[1]);
  }
  closeSection();
  return found;
}
