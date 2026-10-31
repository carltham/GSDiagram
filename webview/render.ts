// The page the command line opens headless to draw a diagram as PNG, with the same code as the editor.

import { parseDiagram } from '../shared/diagram';
import { draw, FONT_SIZE, LABEL_SIZE, LIGHT, measurer } from '../shared/draw';
import { layout } from '../shared/layout';

declare global {
  interface Window { renderDiagram(text: string, known?: string[]): Promise<{ width: number; height: number }> }
}

window.renderDiagram = async (text, known) => {
  const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
  const node = measurer(LIGHT.font, FONT_SIZE), edge = measurer(LIGHT.font, LABEL_SIZE);
  const laid = await layout(parseDiagram(text), (t, of) => (of === 'node' ? node : edge)(t));
  draw(svg, laid, { colours: LIGHT, known: known ? new Set(known) : undefined });
  return { width: laid.width, height: laid.height };
};
