// The GSDiagram side bar, opened from its icon in the Activity Bar:
//   Diagrams:     every diagram of each project, whether it was generated, and its findings. A click opens it.
//   Architecture: the model of the architecture files, its context, components, data, flows, and rules, and the
//                 findings about it. A click goes to where each is written.
// Both follow the check. An empty list shows its welcome, with the commands to get started.

import path from 'node:path';
import * as vscode from 'vscode';
import { Finding, plural } from '../shared/check';
import { parseDiagram } from '../shared/diagram';
import { projectModel } from '../shared/generate';
import { ArchElement, ArchModel, Place } from '../shared/model';
import { DIAGRAM_SUFFIX } from '../shared/project';
import { Diagram } from '../shared/types';
import { Checked, Checker } from './check';

export interface Item extends vscode.TreeItem { children?: Item[] }

const ICON: Record<Finding['severity'], vscode.ThemeIcon> = {
  error: new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground')),
  warning: new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground')),
  info: new vscode.ThemeIcon('info'),
};

const worst = (found: Finding[]) => (['error', 'warning', 'info'] as const).find(s => found.some(f => f.severity === s));

// "1 warning", "2 errors, 1 warning", or nothing.
function counted(found: Finding[]): string {
  const n = (s: Finding['severity']) => found.filter(f => f.severity === s).length;
  return [[n('error'), 'error'], [n('warning'), 'warning'], [n('info'), 'note']].filter(([c]) => c)
    .map(([c, one]) => plural(c as number, one as string)).join(', ');
}

function item(label: string, props: Partial<Item>): Item {
  const children = props.children;
  const i: Item = new vscode.TreeItem(label, children
    ? (props.collapsibleState ?? vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None);
  return Object.assign(i, props);
}

// A list that is built again from the check each time it has run.
abstract class Tree implements vscode.TreeDataProvider<Item> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(protected readonly checker: Checker) {
    checker.onDidCheck(() => this.changed.fire());
  }

  getTreeItem(i: Item): Item { return i; }

  getChildren(i?: Item): Item[] {
    if (i) return i.children ?? [];
    const results = this.checker.all();
    const per = results.map(c => ({ c, items: this.build(c) })).filter(r => r.items.length);
    // With several workspace folders, each is a group of its own.
    if (results.length < 2) return per.flatMap(r => r.items);
    return per.map(({ c, items }) => item(path.basename(c.project.root), {
      id: `${this.constructor.name}:${c.project.root}`, children: items, iconPath: vscode.ThemeIcon.Folder,
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    }));
  }

  protected abstract build(checked: Checked): Item[];
}

export class DiagramTree extends Tree {
  protected build(checked: Checked): Item[] {
    return checked.project.diagrams.map(({ file, text }) => {
      let d: Diagram | undefined;
      try { d = parseDiagram(text); } catch { /* shown as not a diagram */ }
      const found = checked.findings.filter(f => f.file === file);
      const severity = worst(found);
      return item(path.basename(file, DIAGRAM_SUFFIX), {
        id: `diagram:${file}`,
        description: [d ? (d.source ? 'generated' : '') : 'not a diagram', counted(found)].filter(Boolean).join(' · '),
        tooltip: [d ? d.title : 'Not a diagram', d?.source ? `Generated from ${d.source}` : '', ...found.map(f => f.message)].filter(Boolean).join('\n'),
        iconPath: severity ? ICON[severity] : new vscode.ThemeIcon('type-hierarchy'),
        resourceUri: vscode.Uri.file(file),
        command: { command: 'gsdiagram.openDiagram', title: 'Open', arguments: [vscode.Uri.file(file)] },
        contextValue: 'diagram',
      });
    });
  }
}

// The model of each project, read once per check.
const models = new WeakMap<Checked, ArchModel>();
const modelOf = (c: Checked) => { if (!models.has(c)) models.set(c, projectModel(c.project)); return models.get(c)!; };

export class ArchitectureTree extends Tree {
  protected build(checked: Checked): Item[] {
    const model = modelOf(checked);
    if (model.elements.length === 0 && model.rules.length === 0) return [];
    const root = checked.project.root;
    const findings = checked.findings.filter(f => f.about === 'architecture');
    const at = (p: Place) => findings.filter(f => f.file === path.join(root, p.file) && f.line === p.line);
    const open = (p: Place): vscode.Command => ({
      command: 'vscode.open', title: 'Open',
      arguments: [vscode.Uri.file(path.join(root, p.file)), { selection: new vscode.Range(p.line, p.column, p.line, p.column + p.length) }],
    });
    const leaf = (label: string, p: Place, icon: string, description = '') => {
      const found = at(p);
      const severity = worst(found);
      return item(label, {
        description: [description, counted(found)].filter(Boolean).join(' · '),
        tooltip: [`${p.file}:${p.line + 1}`, ...found.map(f => f.message)].join('\n'),
        iconPath: severity ? ICON[severity] : new vscode.ThemeIcon(icon), command: open(p),
      });
    };
    const once = (kind: string) => model.elements.filter((e, i, all) => e.kind === kind && all.findIndex(x => x.id === e.id) === i);
    const group = (id: string, label: string, children: Item[], icon: string) =>
      item(label, { id: `architecture:${root}:${id}`, description: String(children.length), children, iconPath: new vscode.ThemeIcon(icon) });
    const element = (e: ArchElement, icon: string, description?: string) => leaf(e.name, e.at, icon, description);
    // A component by its last name, its folder beside it: editor, GSDiagram/extension.
    const component = (c: ArchElement) => {
      const slash = c.name.replace(/\/$/, '').lastIndexOf('/');
      return slash < 0 ? element(c, 'symbol-module') : leaf(c.name.slice(slash + 1), c.at, 'symbol-module', c.name.slice(0, slash));
    };

    const groups: Item[] = [];
    const context = [...once('actor').map(e => element(e, 'person', 'actor')), ...once('external').map(e => element(e, 'globe', 'external'))];
    if (context.length) groups.push(group('context', 'Context', context, 'globe'));

    const components = once('component');
    if (components.length) {
      const layers = [...new Set(components.map(c => c.layer ?? ''))];
      const children = layers.length < 2 ? components.map(component)
        : layers.map(l => {
          const inLayer = components.filter(c => (c.layer ?? '') === l).map(component);
          return item(l || 'Other', { id: `architecture:${root}:layer:${l}`, description: String(inLayer.length), children: inLayer, iconPath: new vscode.ThemeIcon('layers') });
        });
      groups.push(item('Components', { id: `architecture:${root}:components`, description: String(components.length), children, iconPath: new vscode.ThemeIcon('symbol-module') }));
    }

    const data = once('data').map(e => element(e, 'file', [e.read ? 'read' : '', e.written ? 'written' : ''].filter(Boolean).join(', ')));
    if (data.length) groups.push(group('data', 'Data', data, 'database'));

    const flows = once('flow').map(f => element(f, 'list-ordered', plural(model.elements.filter(e => e.kind === 'step' && e.flow === f.id).length, 'step')));
    if (flows.length) groups.push(group('flows', 'Flows', flows, 'list-ordered'));

    const rules = model.rules.map(r => leaf(`${r.from} must not use ${r.to}`, r.at, 'law'));
    if (rules.length) groups.push(group('rules', 'Rules', rules, 'law'));

    const severity = worst(findings);
    groups.push(item(findings.length ? counted(findings) : 'No findings', {
      id: `architecture:${root}:findings`,
      tooltip: findings.length ? 'Show them in the Problems panel' : 'The architecture holds together.',
      iconPath: severity ? ICON[severity] : new vscode.ThemeIcon('pass'),
      ...(findings.length ? { command: { command: 'workbench.actions.view.problems', title: 'Show problems' } } : {}),
    }));
    return groups;
  }
}
