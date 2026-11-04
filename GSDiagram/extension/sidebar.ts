// The GSDiagram side bar, opened from its icon in the Activity Bar:
//   Diagrams:     every diagram of each project, whether it was generated, and its findings. A click opens it.
//   Architecture: the model of the architecture files, its context, components, data, flows, and rules, and the
//                 findings about it. A click goes to where each is written.
// Both follow the check. An empty list shows its welcome, with the commands to get started.

import path from 'node:path';
import * as vscode from 'vscode';
import { Finding, plural } from '../shared/check';
import { parseDiagram } from '../shared/diagram';
import { Architecture, architecturesOf, isArchivedDiagram, modelOf } from '../shared/architectures';
import { ArchElement, ArchModel, Place } from '../shared/model';
import { DIAGRAM_SUFFIX } from '../shared/project';
import { Diagram } from '../shared/types';
import { ArchitectureRef } from './architectures';
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
    const { project } = checked;
    const rows = project.diagrams.map(({ file, text }) => {
      let d: Diagram | undefined;
      try { d = parseDiagram(text); } catch { /* shown as not a diagram */ }
      const archived = isArchivedDiagram(project, file, text);
      const found = checked.findings.filter(f => f.file === file);
      const severity = worst(found);
      return {
        folder: path.dirname(file), archived,
        item: item(path.basename(file, DIAGRAM_SUFFIX), {
          id: `diagram:${file}`,
          description: [d ? (d.source ? 'generated' : '') : 'not a diagram', archived ? 'archived' : '', counted(found)].filter(Boolean).join(' · '),
          tooltip: [d ? d.title : 'Not a diagram', d?.source ? `Generated from ${d.source}` : '', ...found.map(f => f.message)].filter(Boolean).join('\n'),
          iconPath: severity ? ICON[severity] : new vscode.ThemeIcon(archived ? 'archive' : 'type-hierarchy'),
          resourceUri: vscode.Uri.file(file),
          command: { command: 'gsdiagram.openDiagram', title: 'Open', arguments: [vscode.Uri.file(file)] },
          contextValue: 'diagram',
        }),
      };
    });
    // In one folder, a plain list; in several, the data folder's own diagrams, then a group per subfolder, an
    // architecture's: open for a current one, closed for an archived one.
    const folders = [...new Set(rows.map(r => r.folder))];
    if (folders.length < 2) return rows.map(r => r.item);
    const own = rows.filter(r => r.folder === project.folder).map(r => r.item);
    return [...own, ...folders.filter(f => f !== project.folder).sort().map(f => {
      const inside = rows.filter(r => r.folder === f);
      const archived = inside.every(r => r.archived);
      return item(path.relative(project.folder, f).split(path.sep).join('/'), {
        id: `diagrams:${f}`, description: [String(inside.length), archived ? 'archived' : ''].filter(Boolean).join(' · '),
        children: inside.map(r => r.item), iconPath: new vscode.ThemeIcon(archived ? 'archive' : 'folder'),
        collapsibleState: archived ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded,
      });
    })];
  }
}

export class ArchitectureTree extends Tree {
  protected build(checked: Checked): Item[] {
    const { project } = checked;
    const shown = architecturesOf(project).map(a => ({ a, model: modelOf(project, a) }))
      .filter(({ a, model }) => model.elements.length > 0 || model.rules.length > 0 || project.architectureFolders.includes(a.folder) && a.files.length > 0);
    // One current architecture is shown as it is; several, each as a group of its own.
    if (shown.length === 1 && !shown[0].a.archived) return this.groups(checked, shown[0].a, shown[0].model);
    return shown.map(({ a, model }) => {
      const ref: ArchitectureRef = { root: project.root, rel: a.rel };
      return Object.assign(item(a.name, {
        id: `architecture:${a.folder}`,
        description: [a.rel, a.archived ? 'archived' : ''].filter(Boolean).join(' · '),
        tooltip: `${a.rel}${a.archived ? '\nArchived: listed, but not checked, and Generate and Update leave it alone.' : ''}`,
        iconPath: new vscode.ThemeIcon(a.archived ? 'archive' : 'folder-library'),
        children: this.groups(checked, a, model),
        collapsibleState: a.archived ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded,
        contextValue: `architecture${a.archived ? '-archived' : ''}${project.architectureFolders.includes(a.folder) ? '-folder' : ''}`,
      }), ref);
    });
  }

  // The model of one architecture: Context, Components by group, Data, Flows, Rules, and its findings.
  private groups(checked: Checked, a: Architecture, model: ArchModel): Item[] {
    const root = checked.project.root;
    const files = new Set(a.files.map(f => f.file));
    const findings = checked.findings.filter(f => f.about === 'architecture' && files.has(f.file));
    const key = `architecture:${a.folder}`;
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
      item(label, { id: `${key}:${id}`, description: String(children.length), children, iconPath: new vscode.ThemeIcon(icon) });
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
      const groupNames = [...new Set(components.map(c => c.group ?? ''))];
      const children = groupNames.length < 2 ? components.map(component)
        : groupNames.map(g => {
          const inGroup = components.filter(c => (c.group ?? '') === g).map(component);
          return item(g || 'Other', { id: `${key}:group:${g}`, description: String(inGroup.length), children: inGroup, iconPath: new vscode.ThemeIcon('folder') });
        });
      groups.push(item('Components', { id: `${key}:components`, description: String(components.length), children, iconPath: new vscode.ThemeIcon('symbol-module') }));
    }

    const data = once('data').map(e => element(e, 'file', [e.read ? 'read' : '', e.written ? 'written' : ''].filter(Boolean).join(', ')));
    if (data.length) groups.push(group('data', 'Data', data, 'database'));

    const flows = once('flow').map(f => element(f, 'list-ordered', plural(model.elements.filter(e => e.kind === 'step' && e.flow === f.id).length, 'step')));
    if (flows.length) groups.push(group('flows', 'Flows', flows, 'list-ordered'));

    const rules = model.rules.map(r => leaf(`${r.from} must not use ${r.to}`, r.at, 'law'));
    if (rules.length) groups.push(group('rules', 'Rules', rules, 'law'));

    const severity = worst(findings);
    groups.push(item(a.archived ? 'Archived: not checked' : findings.length ? counted(findings) : 'No findings', {
      id: `${key}:findings`,
      tooltip: a.archived ? 'An archived architecture gives no findings.' : findings.length ? 'Show them in the Problems panel' : 'The architecture holds together.',
      iconPath: a.archived ? new vscode.ThemeIcon('archive') : severity ? ICON[severity] : new vscode.ThemeIcon('pass'),
      ...(findings.length ? { command: { command: 'workbench.actions.view.problems', title: 'Show problems' } } : {}),
    }));
    return groups;
  }
}
