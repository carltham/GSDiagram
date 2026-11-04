// The check of the architecture model: what the architecture files say that does not hold together.
//   A name in a Uses cell that is no component, or could be more than one.
//   A component described twice.
//   Components that use each other, round in a cycle.
//   A use that a rule forbids, and a rule whose from side is nothing.
//   A component nothing uses and no flow names; data nothing reads or writes; a flow that names no component.

import { ArchElement, ArchModel, Place, ruleSide } from './model';

export interface Note { at: Place; severity: 'warning' | 'info'; message: string }

const line = (p: Place) => `${p.file.replace(/^.*\//, '')} line ${p.line + 1}`;

export function reviewModel(model: ArchModel): Note[] {
  const notes: Note[] = [];
  const byId = new Map<string, ArchElement>();
  const name = (id: string) => byId.get(id)?.name ?? id;
  const components = model.elements.filter(e => e.kind === 'component');

  for (const e of model.elements) {
    const first = byId.get(e.id);
    if (!first) { byId.set(e.id, e); continue; }
    if (e.kind === 'component') notes.push({ at: e.at, severity: 'warning', message: `${e.name} is described twice; first at ${line(first.at)}.` });
  }

  for (const r of model.unresolved) {
    notes.push({ at: r.at, severity: 'warning', message: r.candidates.length
      ? `${r.name} could be ${r.candidates.map(name).join(' or ')}. Write the full name.`
      : `${r.name}, used by ${name(r.from)}, is not a component in the architecture.` });
  }

  const uses = model.links.filter(l => l.kind === 'uses');
  for (const cycle of cycles(components.map(c => c.id), uses)) {
    const first = uses.find(l => l.from === cycle[0] && l.to === (cycle[1] ?? cycle[0]))!;
    notes.push({ at: first.at, severity: 'warning', message: `A cycle: ${[...cycle, cycle[0]].map(name).join(' uses ')}.` });
  }

  for (const rule of model.rules) {
    const from = new Set(ruleSide(model, rule.from)), to = new Set(ruleSide(model, rule.to));
    if (from.size === 0) {
      notes.push({ at: rule.at, severity: 'warning', message: `${rule.from} is no component, folder, or group in the architecture.` });
      continue;
    }
    for (const l of uses.filter(l => from.has(l.from) && to.has(l.to)))
      notes.push({ at: l.at, severity: 'warning',
        message: `${name(l.from)} uses ${name(l.to)}, but the rule at ${line(rule.at)} says ${rule.from} must not use ${rule.to}.` });
  }

  const reached = new Set(model.links.filter(l => l.kind !== 'next').map(l => l.to));
  for (const c of components.filter((c, i) => components.findIndex(x => x.id === c.id) === i && !reached.has(c.id)))
    notes.push({ at: c.at, severity: 'info', message: `Nothing uses ${c.name}, and no flow names it.` });

  for (const d of model.elements.filter(e => e.kind === 'data' && !e.read && !e.written))
    notes.push({ at: d.at, severity: 'info', message: `Nothing reads or writes ${d.name}.` });

  const named = new Set(model.links.filter(l => l.kind === 'names').map(l => byId.get(l.from)?.flow));
  for (const f of model.elements.filter(e => e.kind === 'flow' && !named.has(e.id)))
    notes.push({ at: { ...f.at, length: 2 + f.name.length + 1 }, severity: 'info',
      message: `The flow ${f.name} names no component. Name the component that does a step, in \`code\` as in a Uses cell.` });

  return notes;
}

// Each cycle among the nodes once, as the nodes in it in order, starting at the first of them in the order given.
function cycles(nodes: string[], links: { from: string; to: string }[]): string[][] {
  const next = new Map<string, string[]>();
  for (const l of links) next.set(l.from, [...(next.get(l.from) ?? []), l.to]);
  const order = new Map(nodes.map((n, i) => [n, i]));

  // Tarjan's strongly connected components.
  const index = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], on = new Set<string>();
  const groups: string[][] = [];
  let counter = 0;
  const visit = (v: string) => {
    index.set(v, counter); low.set(v, counter++); stack.push(v); on.add(v);
    for (const w of next.get(v) ?? []) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const group: string[] = [];
      let w: string;
      do { w = stack.pop()!; on.delete(w); group.push(w); } while (w !== v);
      if (group.length > 1 || next.get(v)?.includes(v)) groups.push(group);
    }
  };
  for (const n of nodes) if (!index.has(n)) visit(n);

  // In each group, the shortest way from its first node back to itself.
  return groups.map(group => {
    const inside = new Set(group);
    const start = group.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
    const from = new Map<string, string>();
    const queue = [start];
    while (queue.length) {
      const v = queue.shift()!;
      for (const w of next.get(v) ?? []) {
        if (!inside.has(w)) continue;
        if (w === start) {
          const path = [v];
          while (path[0] !== start) path.unshift(from.get(path[0])!);
          return path;
        }
        if (!from.has(w)) { from.set(w, v); queue.push(w); }
      }
    }
    return [start];
  }).sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
}
