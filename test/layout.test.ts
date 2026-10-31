import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layout } from '../shared/layout';
import { Diagram } from '../shared/types';

const measure = (t: string) => t.length * 7;

const d: Diagram = {
  title: 'T',
  nodes: [{ id: 's', label: 'Start', kind: 'start' }, { id: 'a', label: 'Parked' }, { id: 'b', label: 'Accepted' }],
  edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'b', label: 'Save with Accepted' }, { from: 'b', to: 'b', label: 'Edit' }],
};

const overlap = (p: { x: number; y: number; w: number; h: number }, q: typeof p) =>
  p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

test('every node and arrow is placed, and boxes do not overlap', async () => {
  const laid = await layout(d, measure);
  assert.equal(laid.boxes.length, 3);
  assert.equal(laid.lines.length, 3);
  for (const l of laid.lines) assert.ok(l.points.length >= 2);
  for (const a of laid.boxes) for (const b of laid.boxes) if (a !== b) assert.equal(overlap(a, b), false);
  for (const b of laid.boxes) assert.ok(b.x + b.w <= laid.width && b.y + b.h <= laid.height);
});

test('labels are placed and do not overlap a box', async () => {
  const laid = await layout(d, measure);
  for (const l of laid.lines.filter(x => x.label)) for (const b of laid.boxes) assert.equal(overlap(l.label!, b), false);
});

test('a dragged node keeps its position, and its arrows are straight', async () => {
  const moved = { ...d, nodes: d.nodes.map(n => n.id === 'b' ? { ...n, x: 500, y: 300 } : n) };
  const laid = await layout(moved, measure);
  const b = laid.boxes.find(x => x.id === 'b')!;
  assert.deepEqual([b.x, b.y], [500, 300]);
  assert.equal(laid.lines[1].points.length, 2);
  assert.ok(laid.width >= 500 + b.w);
});
