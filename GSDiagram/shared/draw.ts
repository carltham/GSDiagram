// Draws a laid-out diagram as SVG. Colours are written on the elements, so the SVG stands on its own as a picture.

import { Box, Laid, Line, LINE_H } from './layout';

export interface Colours {
  background: string;
  text: string;
  muted: string;
  box: string;
  border: string;
  line: string;
  selected: string;
  unknown: string;
  font: string;
}

export const LIGHT: Colours = {
  background: '#ffffff', text: '#1f2328', muted: '#59636e', box: '#f6f8fa', border: '#8c959f',
  line: '#57606a', selected: '#0969da', unknown: '#cf222e', font: 'system-ui, sans-serif',
};

const NS = 'http://www.w3.org/2000/svg';
export const FONT_SIZE = 13;
export const LABEL_SIZE = 11;

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface DrawOptions {
  colours: Colours;
  // Process ids that exist in the processes file; others are marked. Undefined when there is no processes file.
  known?: Set<string>;
  selected?: string;
  zoom?: number;
  // The first line each scrolled box shows, by node id.
  scroll?: Record<string, number>;
}

// The first line a box shows: its scroll, kept within its lines.
export const firstLine = (b: Box, scroll?: Record<string, number>) =>
  Math.max(0, Math.min(scroll?.[b.id] ?? 0, b.lines.length - b.rows));

// Each drawn box and line carries data-node or data-edge, for clicks and dragging.
export function draw(svg: SVGSVGElement, laid: Laid, o: DrawOptions): void {
  const c = o.colours, zoom = o.zoom ?? 1;
  svg.replaceChildren();
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${laid.width} ${laid.height}`);
  svg.setAttribute('width', String(laid.width * zoom));
  svg.setAttribute('height', String(laid.height * zoom));
  svg.setAttribute('font-family', c.font);

  const defs = el('defs', {});
  for (const [id, colour] of [['arrow', c.line], ['arrow-selected', c.selected]]) {
    const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.append(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: colour }));
    defs.append(m);
  }
  svg.append(defs, el('rect', { x: 0, y: 0, width: laid.width, height: laid.height, fill: c.background }));

  const unknown = (p?: string) => !!p && !!o.known && !o.known.has(p);
  const isSelected = (key: string) => o.selected === key;

  for (const l of laid.lines) drawLine(svg, l, c, isSelected(`edge:${l.index}`), unknown(l.process));
  for (const b of laid.boxes) drawBox(svg, b, c, isSelected(`node:${b.id}`), unknown(b.process), firstLine(b, o.scroll));
}

function drawLine(svg: SVGSVGElement, l: Line, c: Colours, selected: boolean, unknown: boolean) {
  const g = el('g', { 'data-edge': l.index, cursor: 'pointer' });
  const points = l.points.map(p => `${p.x},${p.y}`).join(' ');
  const colour = selected ? c.selected : unknown ? c.unknown : c.line;
  // A wide transparent line makes the arrow easy to click.
  g.append(el('polyline', { points, fill: 'none', stroke: 'transparent', 'stroke-width': 10 }));
  g.append(el('polyline', { points, fill: 'none', stroke: colour, 'stroke-width': selected ? 2 : 1.3,
    'marker-end': `url(#${selected ? 'arrow-selected' : 'arrow'})` }));
  if (l.label) {
    g.append(el('rect', { x: l.label.x, y: l.label.y, width: l.label.w, height: l.label.h, fill: c.background, opacity: 0.85 }));
    g.append(el('text', { x: l.label.x + l.label.w / 2, y: l.label.y + l.label.h - 4, 'text-anchor': 'middle',
      'font-size': LABEL_SIZE, fill: selected ? c.selected : unknown ? c.unknown : c.muted }, l.label.text));
  }
  svg.append(g);
}

function drawBox(svg: SVGSVGElement, b: Box, c: Colours, selected: boolean, unknown: boolean, first: number) {
  const g = el('g', { 'data-node': b.id, transform: `translate(${b.x},${b.y})`, cursor: 'grab' });
  const stroke = selected ? c.selected : unknown ? c.unknown : c.border;
  const width = selected ? 2.5 : 1.3;
  if (b.kind === 'start') {
    g.append(el('circle', { cx: b.w / 2, cy: b.h / 2, r: b.w / 2, fill: c.text, stroke, 'stroke-width': selected ? width : 0 }));
  } else if (b.kind === 'end') {
    g.append(el('circle', { cx: b.w / 2, cy: b.h / 2, r: b.w / 2, fill: 'none', stroke, 'stroke-width': width }));
    g.append(el('circle', { cx: b.w / 2, cy: b.h / 2, r: b.w / 2 - 5, fill: c.text }));
  } else {
    g.append(el('rect', { width: b.w, height: b.h, rx: 8, fill: c.box, stroke, 'stroke-width': width }));
    // The lines the box shows, one under the other, in the middle of the box.
    const shown = b.lines.slice(first, first + b.rows);
    const text = el('text', { 'text-anchor': 'middle', 'font-size': FONT_SIZE, fill: c.text });
    const top = b.h / 2 - (shown.length - 1) * LINE_H / 2 + FONT_SIZE / 2 - 2;
    shown.forEach((line, i) => text.append(el('tspan', { x: b.w / 2, y: top + i * LINE_H }, line)));
    g.append(text);
    // A box with more lines than it shows has a scroll bar: the track, and the part it shows.
    if (b.lines.length > b.rows) {
      const track = b.h - 16, thumb = Math.max(8, track * b.rows / b.lines.length);
      const y = 8 + (track - thumb) * first / (b.lines.length - b.rows);
      g.append(el('rect', { x: b.w - 7, y: 8, width: 3, height: track, rx: 1.5, fill: c.border, opacity: 0.3 }));
      g.append(el('rect', { x: b.w - 7, y, width: 3, height: thumb, rx: 1.5, fill: c.muted }));
    }
  }
  if (b.kind !== 'state' || b.lines.length > b.rows) g.append(el('title', {}, b.label));
  svg.append(g);
}

// Measures text in the given size, for the layout.
export function measurer(font: string, size: number) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${size}px ${font}`;
  return (text: string) => ctx.measureText(text).width;
}
