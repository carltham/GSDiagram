// Lays a diagram out with ELK. A node with a saved position keeps it, and its arrows are drawn straight.

import ELK, { ElkNode } from 'elkjs/lib/elk.bundled.js';
import { Diagram, NodeKind } from './types';

export interface Point { x: number; y: number }

export interface Box {
  id: string;
  label: string;
  kind: NodeKind;
  process?: string;
  x: number; y: number; w: number; h: number;
}

export interface Label { text: string; x: number; y: number; w: number; h: number }

export interface Line {
  index: number;
  points: Point[];
  label?: Label;
  process?: string;
}

export interface Laid { width: number; height: number; boxes: Box[]; lines: Line[] }

export type Measure = (text: string, of: 'node' | 'edge') => number;

const PAD = 24;
const BOX_H = 40;
const DOT = 22;
const LABEL_H = 16;

const elk = new ELK();

export async function layout(d: Diagram, measure: Measure): Promise<Laid> {
  const size = (n: Diagram['nodes'][number]) =>
    n.kind === 'start' || n.kind === 'end' ? { w: DOT, h: DOT } : { w: Math.max(110, Math.ceil(measure(n.label, 'node')) + 28), h: BOX_H };

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': d.direction ?? 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.edgeLabel': '6',
      'elk.spacing.edgeEdge': '14',
      'elk.spacing.edgeNode': '18',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20',
      'elk.edgeLabels.placement': 'CENTER',
    },
    children: d.nodes.map(n => ({ id: n.id, width: size(n).w, height: size(n).h })),
    edges: d.edges.map((e, i) => ({
      id: `e${i}`, sources: [e.from], targets: [e.to],
      labels: e.label ? [{ text: e.label, width: Math.ceil(measure(e.label, 'edge')) + 8, height: LABEL_H }] : [],
    })),
  };
  const g = await elk.layout(graph);

  const boxes: Box[] = d.nodes.map(n => {
    const c = g.children!.find(x => x.id === n.id)!;
    const moved = typeof n.x === 'number' && typeof n.y === 'number';
    return { id: n.id, label: n.label, kind: n.kind ?? 'state', process: n.process,
      x: moved ? n.x! : c.x! + PAD, y: moved ? n.y! : c.y! + PAD, w: c.width!, h: c.height! };
  });
  const byId = new Map(boxes.map(b => [b.id, b]));
  const movedIds = new Set(d.nodes.filter(n => typeof n.x === 'number' && typeof n.y === 'number').map(n => n.id));

  const lines: Line[] = d.edges.map((e, i) => {
    const ge = g.edges!.find(x => x.id === `e${i}`)!;
    const from = byId.get(e.from)!, to = byId.get(e.to)!;
    let points: Point[];
    let label: Label | undefined;
    if (movedIds.has(e.from) || movedIds.has(e.to) || !ge.sections?.length) {
      points = straight(from, to);
      if (e.label) {
        const w = Math.ceil(measure(e.label, 'edge')) + 8, mid = middle(points);
        label = { text: e.label, x: mid.x - w / 2, y: mid.y - LABEL_H - 2, w, h: LABEL_H };
      }
    } else {
      const s = ge.sections[0];
      points = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(p => ({ x: p.x + PAD, y: p.y + PAD }));
      const l = ge.labels?.[0];
      if (l && e.label) label = { text: e.label, x: l.x! + PAD, y: l.y! + PAD, w: l.width!, h: l.height! };
    }
    return { index: i, points, label, process: e.process };
  });

  const xs = [...boxes.flatMap(b => [b.x + b.w]), ...lines.flatMap(l => [...l.points.map(p => p.x), l.label ? l.label.x + l.label.w : 0])];
  const ys = [...boxes.flatMap(b => [b.y + b.h]), ...lines.flatMap(l => [...l.points.map(p => p.y), l.label ? l.label.y + l.label.h : 0])];
  return { width: Math.max(...xs) + PAD, height: Math.max(...ys) + PAD, boxes, lines };
}

const centre = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// Where the line from the centre of b towards p leaves the box.
function border(b: Box, p: Point): Point {
  const c = centre(b), dx = p.x - c.x, dy = p.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

function straight(from: Box, to: Box): Point[] {
  if (from === to) {
    // A loop over the top of the box.
    const { x, y, w } = from;
    return [{ x: x + w * 0.35, y }, { x: x + w * 0.35, y: y - 24 }, { x: x + w * 0.65, y: y - 24 }, { x: x + w * 0.65, y }];
  }
  return [border(from, centre(to)), border(to, centre(from))];
}

function middle(points: Point[]): Point {
  if (points.length === 2) return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  const a = points[Math.floor((points.length - 1) / 2)], b = points[Math.floor((points.length - 1) / 2) + 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
