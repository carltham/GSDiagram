// The page inside the GSDiagram editor: draws the diagram, lets boxes be dragged, and shows the process of what is clicked.

import { parseDiagram } from '../shared/diagram';
import { Colours, draw, firstLine, FONT_SIZE, LABEL_SIZE, LIGHT, measurer } from '../shared/draw';
import { Laid, layout, Measure, ROWS } from '../shared/layout';
import { Diagram, FromWebview, Process, ToWebview } from '../shared/types';

declare function acquireVsCodeApi(): { postMessage(m: FromWebview): void };
const vscode = acquireVsCodeApi();
const post = (m: FromWebview) => vscode.postMessage(m);

const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
const detail = document.getElementById('detail')!;
const title = document.getElementById('title')!;
const problem = document.getElementById('problem')!;

let diagram: Diagram | undefined;
let laid: Laid | undefined;
let processes: Record<string, Process> = {};
let hasProcesses = false;
let selected: string | undefined;
let zoom = 1;
// The first line each box shows, by node id, as the wheel scrolls it.
const scroll: Record<string, number> = {};

function colours(): Colours {
  const css = getComputedStyle(document.body);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    background: v('--vscode-editor-background', LIGHT.background),
    text: v('--vscode-editor-foreground', LIGHT.text),
    muted: v('--vscode-descriptionForeground', LIGHT.muted),
    box: v('--vscode-editorWidget-background', LIGHT.box),
    border: v('--vscode-editorWidget-border', LIGHT.border),
    line: v('--vscode-editorLineNumber-foreground', LIGHT.line),
    selected: v('--vscode-focusBorder', LIGHT.selected),
    unknown: v('--vscode-errorForeground', LIGHT.unknown),
    font: v('--vscode-font-family', LIGHT.font),
  };
}

function redraw() {
  if (!laid) return;
  draw(svg, laid, { colours: colours(), known: hasProcesses ? new Set(Object.keys(processes)) : undefined, selected, zoom, scroll });
  showDetail();
}

async function update(text: string) {
  try {
    diagram = parseDiagram(text);
  } catch (e) {
    problem.textContent = `Not a diagram: ${(e as Error).message}`;
    problem.hidden = false;
    return;
  }
  problem.hidden = true;
  title.textContent = diagram.title ?? '';
  laid = await layout(diagram, measure(), { maxRows: ROWS });
  redraw();
}

function measure(): Measure {
  const font = colours().font;
  const node = measurer(font, FONT_SIZE), edge = measurer(font, LABEL_SIZE);
  return (t, of) => (of === 'node' ? node : edge)(t);
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

function showDetail() {
  if (!diagram || !selected) { detail.innerHTML = '<p class="muted">Click a box or an arrow.</p>'; return; }
  const [kind, key] = selected.split(':');
  const node = kind === 'node' ? diagram.nodes.find(n => n.id === key) : undefined;
  const edge = kind === 'edge' ? diagram.edges[+key] : undefined;
  const item = node ?? edge;
  if (!item) { detail.innerHTML = ''; return; }
  let html = node ? `<h3>${escape(node.label)}</h3>`
    : `<h3>${escape(edge!.label ?? '')} <span class="muted">${escape(edge!.from)} → ${escape(edge!.to)}</span></h3>`;
  const id = item.process;
  if (!id) {
    html += '<p class="muted">No process.</p>';
  } else if (!hasProcesses) {
    html += `<p><b>${escape(id)}</b></p><p class="muted">No processes file is set. Run GSDiagram: Set processes file.</p>`;
  } else if (!processes[id]) {
    html += `<p class="unknown"><b>${escape(id)}</b> is not in the processes file.</p>`;
  } else {
    const p = processes[id];
    html += `<p class="muted">${escape(p.group)}</p><p><b>${escape(p.id)} ${escape(p.title)}.</b> ${escape(p.text)}</p>`
      + `<p><button id="open">Open in the processes file</button></p>`;
  }
  detail.innerHTML = html;
  document.getElementById('open')?.addEventListener('click', () => post({ type: 'open', process: id! }));
}

// Dragging a box moves it; a click without moving selects it.
let drag: { id: string; g: SVGGElement; start: DOMPoint; x: number; y: number; moved: boolean } | undefined;

function svgPoint(e: PointerEvent) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
}

svg.addEventListener('pointerdown', e => {
  const target = e.target as Element;
  const node = target.closest('[data-node]') as SVGGElement | null;
  const edge = target.closest('[data-edge]');
  if (node && laid) {
    const box = laid.boxes.find(b => b.id === node.dataset.node)!;
    drag = { id: box.id, g: node, start: svgPoint(e), x: box.x, y: box.y, moved: false };
    svg.setPointerCapture(e.pointerId);
  } else if (edge) {
    selected = `edge:${edge.getAttribute('data-edge')}`;
    redraw();
  } else {
    selected = undefined;
    redraw();
  }
});

svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = svgPoint(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved) drag.g.setAttribute('transform', `translate(${drag.x + dx},${drag.y + dy})`);
});

svg.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = undefined;
  if (d.moved) {
    const p = svgPoint(e);
    post({ type: 'move', id: d.id, x: Math.round(d.x + p.x - d.start.x), y: Math.round(d.y + p.y - d.start.y) });
  } else {
    selected = `node:${d.id}`;
    redraw();
  }
});

// The wheel over a box with more lines than it shows scrolls its text a line at a time; at either end, or anywhere
// else, it scrolls the page.
svg.addEventListener('wheel', e => {
  const node = (e.target as Element).closest('[data-node]') as SVGGElement | null;
  const box = node && laid?.boxes.find(b => b.id === node.dataset.node);
  if (!box || box.lines.length <= box.rows || e.deltaY === 0) return;
  const first = firstLine(box, scroll), next = Math.max(0, Math.min(first + Math.sign(e.deltaY), box.lines.length - box.rows));
  if (next === first) return;
  e.preventDefault();
  scroll[box.id] = next;
  redraw();
}, { passive: false });

document.getElementById('zoom-in')!.addEventListener('click', () => { zoom = Math.min(4, zoom * 1.25); redraw(); });
document.getElementById('zoom-out')!.addEventListener('click', () => { zoom = Math.max(0.25, zoom / 1.25); redraw(); });
document.getElementById('reset')!.addEventListener('click', () => post({ type: 'resetLayout' }));
document.getElementById('png')!.addEventListener('click', () => renderPng());

// Draws the diagram at twice its size, without the selection, and sends it to the extension as a PNG.
async function renderPng() {
  if (!diagram) return;
  // Every box as high as its text, as a picture cannot scroll.
  const laid = await layout(diagram, measure());
  const copy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  draw(copy, laid, { colours: colours(), zoom: 2 });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  const img = new Image();
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = laid.width * 2;
  canvas.height = laid.height * 2;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  post({ type: 'png', data: canvas.toDataURL('image/png') });
}

window.addEventListener('message', (e: MessageEvent<ToWebview>) => {
  const m = e.data;
  if (m.type === 'update') {
    processes = m.processes;
    hasProcesses = m.hasProcessesFile;
    update(m.text);
  } else if (m.type === 'renderPng') {
    renderPng();
  }
});

post({ type: 'ready' });
