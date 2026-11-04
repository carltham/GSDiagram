// The architecture model: what the architecture files say the system is made of, read from their tables and lists.
//   Components: a table with a Component column and a Uses column. The heading above the table is their group.
//   External systems: a table with an Outside column (or External, or System).
//   Actors: the bold names of the list items under a heading Who uses it (or Actors, Roles, People). Not Users: in a
//   project's own architecture, that is as often a screen, whose list is of its controls.
//   Data: a table with File, Read, and Written columns.
//   Flows: in a file whose name or title says flow, every section with numbered steps.
//   Rules: list items "Rule: <from> must not use <to>", where each side is a component, a folder ending in /, a group, or a pattern with *.
// A component's name is its path in the project: shared/check for shared/check.ts. In a Uses cell, a short name, types,
// is the component of that name, in the same group first. Names after a semicolon, "talks to `webview/main` by
// messages", are links too, but not uses in the code.

import { Described, plain, slugOf, stepsDiagram } from './architecture';
import { Diagram, DiagramEdge, DiagramNode } from './types';

// A place in an architecture file: the file relative to the project, and the zero-based line and column.
export interface Place { file: string; line: number; column: number; length: number }

export type ElementKind = 'actor' | 'external' | 'component' | 'data' | 'flow' | 'step';

export interface ArchElement {
  id: string;
  kind: ElementKind;
  name: string;
  // A component's group; a step's flow.
  group?: string;
  flow?: string;
  // Data: whether anything reads it, or writes it.
  read?: boolean;
  written?: boolean;
  at: Place;
}

// uses: a component uses another in the code. talks: it reaches another another way. next: one step after another.
// names: a flow's step names a component.
export type LinkKind = 'uses' | 'talks' | 'next' | 'names';

export interface ArchLink { from: string; to: string; kind: LinkKind; label?: string; at: Place }

export interface ArchRule { from: string; to: string; at: Place }

// A name in a Uses cell that is no component, or could be more than one.
export interface Reference { from: string; name: string; candidates: string[]; at: Place }

export interface ArchModel {
  system: string;
  elements: ArchElement[];
  links: ArchLink[];
  rules: ArchRule[];
  unresolved: Reference[];
  // Where the views are described, for the diagrams drawn from the model.
  views: { context?: string; components?: string; flows: { id: string; source: string; steps: string[] }[] };
}

interface Line { text: string; n: number }
interface Section { heading: string; level: number; line: number; anchor: string; top: string; lines: Line[] }
interface Cell { text: string; column: number }

// The sections of a Markdown file, by heading, without the lines in code blocks. top is the anchor of the nearest
// heading of level 1 above it, or none.
function sectionsOf(md: string): { title: string; sections: Section[] } {
  const sections: Section[] = [{ heading: '', level: 0, line: 0, anchor: '', top: '', lines: [] }];
  const seen = new Map<string, number>();
  let title = '', top = '', fence = false;
  md.split(/\r?\n/).forEach((text, n) => {
    if (/^\s*(```|~~~)/.test(text)) { fence = !fence; return; }
    if (fence) return;
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(text);
    if (!h) { sections[sections.length - 1].lines.push({ text, n }); return; }
    const heading = plain(h[2]);
    const slug = slugOf(heading);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    const anchor = count ? `${slug}-${count}` : slug;
    if (h[1].length === 1) { top = anchor; if (!title) title = heading; }
    sections.push({ heading, level: h[1].length, line: n, anchor, top, lines: [] });
  });
  return { title, sections };
}

// The cells of a table row, each with its column in the line. A | inside `code` does not end a cell.
function cellsOf(line: string): Cell[] {
  const cells: Cell[] = [];
  let start = line.indexOf('|') + 1, code = false;
  const push = (end: number) => {
    const raw = line.slice(start, end);
    cells.push({ text: raw.trim(), column: start + raw.length - raw.trimStart().length });
  };
  for (let i = start; i < line.length; i++) {
    if (line[i] === '\\') i++;
    else if (line[i] === '`') code = !code;
    else if (line[i] === '|' && !code) { push(i); start = i + 1; }
  }
  if (line.slice(start).trim()) push(line.length);
  return cells;
}

// The tables of a section: the header's cells, and each row with its line.
function tablesOf(section: Section): { header: string[]; rows: { line: Line; cells: Cell[] }[] }[] {
  const tables = [];
  const lines = section.lines;
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i].text) || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1].text)) continue;
    const header = cellsOf(lines[i].text).map(c => plain(c.text).toLowerCase());
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|/.test(lines[j].text); j++) rows.push({ line: lines[j], cells: cellsOf(lines[j].text) });
    tables.push({ header, rows });
    i = j - 1;
  }
  return tables;
}

const column = (header: string[], pattern: RegExp) => header.findIndex(h => pattern.test(h));

// What a cell names: its first `code`, or else its first **bold**, or else its text.
function nameOf(cell: Cell): Place & { name: string } {
  const m = /`([^`]+)`/.exec(cell.text) ?? /\*\*(.+?)\*\*/.exec(cell.text);
  const name = m?.[0].startsWith('`') ? m[1].trim() : plain(m ? m[1] : cell.text).replace(/[.,:;]+$/, '');
  const offset = m ? m.index + (m[0].startsWith('`') ? 1 : 2) : 0;
  return { name, file: '', line: 0, column: cell.column + offset, length: m ? m[1].length : cell.text.length };
}

// The names in a Uses cell: those before a semicolon are uses, those after it other links, labelled by the words before
// them ("talks to").
function referencesOf(cell: Cell): { name: string; kind: 'uses' | 'talks'; label?: string; column: number; length: number }[] {
  const found = [];
  const semicolon = cell.text.search(/;(?=(?:[^`]*`[^`]*`)*[^`]*$)/);
  const parts = semicolon < 0 ? [{ text: cell.text, from: 0 }]
    : [{ text: cell.text.slice(0, semicolon), from: 0 }, { text: cell.text.slice(semicolon + 1), from: semicolon + 1 }];
  for (const [i, part] of parts.entries()) {
    const kind = i === 0 ? 'uses' as const : 'talks' as const;
    const code = [...part.text.matchAll(/`([^`]+)`/g)];
    if (code.length) {
      let after = 0;
      for (const m of code) {
        const label = kind === 'talks' ? plain(part.text.slice(after, m.index).replace(/^[\s,]*(and\s+)?|[\s,]+$/g, '')) || undefined : undefined;
        found.push({ name: m[1].trim(), kind, label, column: cell.column + part.from + m.index! + 1, length: m[1].length });
        after = m.index! + m[0].length;
      }
    } else if (kind === 'uses') {
      let at = 0;
      for (const raw of part.text.split(/,|\band\b/)) {
        const name = plain(raw);
        const offset = part.text.indexOf(raw, at);
        at = offset + raw.length;
        if (!name || /^(—|-|–|none|nothing)$/i.test(name)) continue;
        found.push({ name, kind, column: cell.column + part.from + offset + raw.indexOf(raw.trim()), length: raw.trim().length });
      }
    }
  }
  return found;
}

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|java|kt|py|go|rs|cs)$/;
const bare = (name: string) => name.replace(CODE_FILE, '');
// A Read or Written cell that says no: No, Never, None, a dash, or nothing.
const no = (text: string) => /^(no|never|none|nothing|—|–|-)?$/i.test(plain(text).split(/[\s,.;]+/)[0]);

// Every architecture file, read into one model. rel is a file's path relative to the project.
export function analyseArchitecture(files: { rel: string; text: string }[], system: string): ArchModel {
  const model: ArchModel = { system, elements: [], links: [], rules: [], unresolved: [], views: { flows: [] } };
  const pending: { from: string; group?: string; name: string; kind: 'uses' | 'talks' | 'names'; label?: string; at: Place; quiet?: boolean }[] = [];
  const add = (e: ArchElement) => { model.elements.push(e); return e.id; };

  for (const { rel, text } of files) {
    const { title, sections } = sectionsOf(text);
    const flows = /flow/i.test(rel.replace(/^.*\//, '')) || /flow/i.test(title);
    for (const section of sections) {
      const at = (line: number, column: number, length: number): Place => ({ file: rel, line, column, length });

      for (const { header, rows } of tablesOf(section)) {
        const comp = column(header, /^(component|module|package|part)s?$/), uses = column(header, /^(uses|depends on|dependencies|imports)$/);
        const outside = column(header, /^(outside|externals?|external systems?|systems?|neighbou?rs?)$/);
        const file = column(header, /^(files?|data)$/), read = column(header, /^read$/), written = column(header, /^(written|writes?)$/);
        for (const { line, cells } of rows) {
          if (comp >= 0 && uses >= 0 && cells[comp]) {
            const { name, ...p } = nameOf(cells[comp]);
            if (!name) continue;
            const id = add({ id: `component:${name}`, kind: 'component', name, group: section.heading || undefined, at: at(line.n, p.column, p.length) });
            if (!model.views.components) model.views.components = `${rel}${section.top ? `#${section.top}` : ''}`;
            for (const r of cells[uses] ? referencesOf(cells[uses]) : [])
              pending.push({ from: id, group: section.heading, name: r.name, kind: r.kind, label: r.label, at: at(line.n, r.column, r.length) });
          } else if (outside >= 0 && cells[outside]) {
            const { name, ...p } = nameOf(cells[outside]);
            if (name) add({ id: `external:${slugOf(name)}`, kind: 'external', name, at: at(line.n, p.column, p.length) });
            if (name && !model.views.context) model.views.context = `${rel}#${section.anchor}`;
          } else if (file >= 0 && read >= 0 && written >= 0 && cells[file]) {
            const { name, ...p } = nameOf(cells[file]);
            if (name) add({ id: `data:${slugOf(name)}`, kind: 'data', name, read: !no(cells[read]?.text ?? ''), written: !no(cells[written]?.text ?? ''),
              at: at(line.n, p.column, p.length) });
          }
        }
      }

      if (/^(who uses it|actors|roles|people)$/i.test(section.heading)) {
        for (const { text: t, n } of section.lines) {
          const m = /^(\s{0,3}[-*+]\s+)\*\*(.+?)\*\*/.exec(t);
          if (!m) continue;
          const name = plain(m[2]).replace(/[.,:;]+$/, '');
          add({ id: `actor:${slugOf(name)}`, kind: 'actor', name, at: at(n, m[1].length + 2, m[2].length) });
          if (!model.views.context) model.views.context = `${rel}#${section.anchor}`;
        }
      }

      for (const { text: t, n } of section.lines) {
        const m = /^(\s*[-*+]\s+(?:\*\*)?Rule:(?:\*\*)?\s+)(.+?)\s+must not use\s+(.+?)\.?\s*$/i.exec(t);
        if (m) model.rules.push({ from: m[2].replace(/`/g, ''), to: m[3].replace(/`/g, ''), at: at(n, m[1].length, t.length - m[1].length) });
      }

      const steps = section.lines.filter(l => /^\s{0,3}\d+[.)]\s+/.test(l.text));
      if (flows && section.level >= 2 && steps.length >= 2) {
        const source = `${rel}#${section.anchor}`;
        const flow = add({ id: `flow:${source}`, kind: 'flow', name: section.heading, at: at(section.line, 0, 0) });
        let last: string | undefined;
        const texts: string[] = [];
        steps.forEach(({ text: t, n }, i) => {
          const body = t.replace(/^\s{0,3}\d+[.)]\s+/, '');
          texts.push(body);
          const step = add({ id: `step:${source}/${i + 1}`, kind: 'step', name: plain(body), flow, at: at(n, t.length - body.length, body.length) });
          if (last) model.links.push({ from: last, to: step, kind: 'next', at: at(n, 0, 0) });
          last = step;
          for (const c of body.matchAll(/`([^`]+)`/g))
            pending.push({ from: step, name: c[1].trim(), kind: 'names', at: at(n, t.length - body.length + c.index! + 1, c[1].length), quiet: true });
        });
        model.views.flows.push({ id: flow, source, steps: texts });
      }
    }
  }

  for (const r of pending) {
    const candidates = resolve(model, r.name, r.group);
    if (candidates.length === 1) model.links.push({ from: r.from, to: candidates[0], kind: r.kind, ...(r.label ? { label: r.label } : {}), at: r.at });
    else if (!r.quiet) model.unresolved.push({ from: r.from, name: r.name, candidates, at: r.at });
  }
  return model;
}

// The components a name can stand for: the one of that name, or else those it ends, in the same group first.
export function resolve(model: ArchModel, name: string, group?: string): string[] {
  const n = bare(name);
  const components = model.elements.filter(e => e.kind === 'component');
  const exact = components.filter(c => bare(c.name) === n);
  if (exact.length) return [...new Set(exact.map(c => c.id))];
  const ending = components.filter(c => bare(c.name).endsWith(`/${n}`));
  const near = ending.filter(c => c.group === group);
  return [...new Set((near.length === 1 ? near : ending).map(c => c.id))];
}

// The components one side of a rule stands for: a folder ending in /, a group, a pattern with *, or a component.
export function ruleSide(model: ArchModel, side: string): string[] {
  const components = model.elements.filter(e => e.kind === 'component');
  if (side.endsWith('/')) return components.filter(c => c.name.startsWith(side)).map(c => c.id);
  const group = components.filter(c => c.group?.toLowerCase() === side.toLowerCase());
  if (group.length) return group.map(c => c.id);
  if (side.includes('*')) {
    const pattern = new RegExp(`^${side.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return components.filter(c => pattern.test(c.name)).map(c => c.id);
  }
  return resolve(model, side);
}

const nodeId = (id: string) => slugOf(id.replace(/^\w+:/, '')) || 'box';

// The diagrams drawn from the model: the context, the components, and each flow.
export function modelViews(model: ArchModel, idPattern?: string): Described[] {
  const views: Described[] = [];
  const of = (kind: ElementKind) => model.elements.filter(e => e.kind === kind);
  const unique = <T extends { id: string }>(xs: T[]) => xs.filter((x, i) => xs.findIndex(y => y.id === x.id) === i);

  const actors = unique(of('actor')), externals = unique(of('external'));
  if (model.views.context && actors.length + externals.length) {
    const nodes: DiagramNode[] = [{ id: 'system', label: model.system }];
    const edges: DiagramEdge[] = [];
    for (const a of actors) { nodes.push({ id: nodeId(a.id), label: a.name }); edges.push({ from: nodeId(a.id), to: 'system', label: 'uses' }); }
    for (const x of externals) { nodes.push({ id: nodeId(x.id), label: x.name }); edges.push({ from: 'system', to: nodeId(x.id) }); }
    views.push(view(model.views.context, 'context', `${model.system} and what it works with`, { nodes, edges, direction: 'RIGHT' }));
  }

  const components = unique(of('component'));
  if (model.views.components && components.length) {
    const nodes = components.map(c => ({ id: nodeId(c.id), label: c.name }));
    const edges = model.links.filter(l => (l.kind === 'uses' || l.kind === 'talks') && l.from !== l.to)
      .map(l => ({ from: nodeId(l.from), to: nodeId(l.to), ...(l.label ? { label: l.label } : {}) }))
      .filter((e, i, all) => all.findIndex(x => x.from === e.from && x.to === e.to) === i);
    views.push(view(model.views.components, 'components', 'Components', { nodes, edges, direction: 'DOWN' }));
  }

  for (const f of model.views.flows) {
    const name = model.elements.find(e => e.id === f.id)!.name;
    views.push({ source: f.source, heading: name, diagram: stepsDiagram(name, f.steps, idPattern, 'DOWN') });
  }
  return views;
}

function view(source: string, name: string, title: string, d: Pick<Diagram, 'nodes' | 'edges' | 'direction'>): Described {
  return { source, name, heading: title, diagram: { title, ...(d.direction ? { direction: d.direction } : {}), nodes: d.nodes, edges: d.edges } };
}

export const MODEL_FILE = 'architecture.json';

// The model as it is written to architecture.json: every place as file:line, one-based.
export function writeModel(model: ArchModel): string {
  const where = (p: Place) => `${p.file}:${p.line + 1}`;
  return JSON.stringify({
    system: model.system,
    elements: model.elements.map(({ at, ...e }) => ({ ...e, at: where(at) })),
    links: model.links.map(({ at, ...l }) => ({ ...l, at: where(at) })),
    rules: model.rules.map(({ at, ...r }) => ({ ...r, at: where(at) })),
    unresolved: model.unresolved.map(({ at, ...r }) => ({ ...r, at: where(at) })),
  }, null, 2) + '\n';
}
