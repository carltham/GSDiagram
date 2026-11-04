# Data

Every file GSDiagram reads or writes. All of them are in the project.

| File | Read | Written |
|---|---|---|
| The data folder | Yes | Created when something is saved into it |
| `config.json` | Yes | By Set processes file |
| `*.diagram.json` | Yes | By the editor, Accept, Generate, and Update |
| `*.png` | No | By Render PNG |
| `architecture.json`, one per architecture | No | By Analyse architecture |
| The processes file | Yes | Never |
| The architecture files | Yes | Never |
| `.vscode/settings.json` | Yes, by the command line | By Choose data folder, through VS Code |

## The data folder

- `.gsdiagram/` at the root of the project, unless the setting `gsdiagram.folder` names another, relative to the project.
- A folder outside the project is refused. In VS Code the refusal is shown once per workspace folder, and that folder is left out of the check until the setting is put right. The command line stops with the refusal.
- The diagrams are the `*.diagram.json` files in it and in its subfolders, in the order of their paths. Each architecture's generated diagrams, and its `architecture.json`, are in a subfolder named after it: `.gsdiagram/architecture/`, `.gsdiagram/old/`.

## `config.json`

In the data folder. Every field may be left out.

| Field | What it is | When left out |
|---|---|---|
| `processesFile` | The processes file, relative to the project | No processes file: the diagrams work, and nothing is checked against processes |
| `idPattern` | The pattern of a process id, as a regular expression | `[A-Z]{4}\d+` |
| `architectureFolders` | The architecture folders, relative to the project. Each is an architecture, and so is each of its subfolders, unless `subfolderArchitectures` is false. | `architectureFolder`, or else `dev/architecture` |
| `architectureFolder` | One architecture folder, as before there could be several | `dev/architecture` |
| `archived` | Architectures marked archived, `true`, or current, `false`, by their folder relative to the project | A folder named `old`, `archive`, `archived`, `redundant`, `obsolete`, `deprecated`, `legacy`, `retired`, or `former` is archived |
| `subfolderArchitectures` | Whether each subfolder of an architecture folder is an architecture of its own. When `false`, it is part of its folder's, unless it is archived. | `true` |

## `*.diagram.json`

```json
{
  "title": "Order life cycle",
  "direction": "RIGHT",
  "source": "dev/architecture/orders.md#order-life-cycle",
  "nodes": [
    { "id": "start", "label": "Start", "kind": "start" },
    { "id": "draft", "label": "Draft", "x": 120, "y": 40 },
    { "id": "sent", "label": "Sent" }
  ],
  "edges": [
    { "from": "start", "to": "draft", "label": "Create", "process": "ORDE1" },
    { "from": "draft", "to": "sent", "label": "Send", "process": "ORDE2" }
  ],
  "drawn": { "ORDE1": "fa366da9f8", "ORDE2": "f7fee0bb4c" }
}
```

| Field | What it is |
|---|---|
| `title` | Shown above the drawing. |
| `direction` | `RIGHT`, the default, or `DOWN`: the way the layout runs. |
| `nodes` | The boxes. Required, even when empty. |
| `nodes[].id` | Unique in the diagram; arrows name it. |
| `nodes[].label` | The text in the box. |
| `nodes[].kind` | `state`, the default, a rounded box; `start`, a filled dot; `end`, a ring with a dot. A dot shows its label only on pointing. |
| `nodes[].process` | A process id from the processes file. |
| `nodes[].x`, `nodes[].y` | Set when the box has been dragged; otherwise the layout places it. |
| `edges` | The arrows. Required, even when empty. |
| `edges[].from`, `edges[].to` | Node ids. An arrow from a node to itself is a loop. |
| `edges[].label` | The text on the arrow. |
| `edges[].process` | A process id from the processes file. |
| `drawn` | Per process id the diagram uses, a short hash of the process's title and text when the diagram was last accepted. |
| `source` | Only in a generated diagram: the architecture file it was drawn from, relative to the project, and the heading's anchor. |

Other fields are kept as they are when the editor changes the file.

## `*.png`

A picture of a diagram, next to it, with the same name: `orders.diagram.json` gives `orders.png`. Drawn at twice the diagram's size.

## The processes file

Any Markdown file in the project. A process is a list item that starts with its id and its title in bold:

```markdown
## Invoices

- **INVO10 Send an invoice.** On the detail, press Send; its draft is booked.
```

- **Id:** matches the id pattern.
- **Title:** the bold text after the id, without its final full stop.
- **Text:** the rest of the line.
- **Group:** the last heading above it, at any level.
- **Line:** where it is, for the Problems panel, the lenses, and Open in the processes file.

Only the first of two items with the same id counts. A bold item without an id, such as `- **Administrator.**`, is not a process.

## The architecture files

Every `.md` file under each architecture folder, in all its subfolders. A diagram is described in a marked section: a heading's section with `<!-- diagram -->`, or `<!-- diagram: name -->` to name its file. The diagram is drawn from the section's list items with arrows:

```markdown
## Invoice
<!-- diagram: invoice-life-cycle -->
- Start → Draft: Create (INVO2)
- Draft → Accepted → Sent: Send (INVO10)
- Sent → End
```

`→`, `->`, and `-->` are arrows; the text after the colon labels the last arrow of the item; `Start`, `End`, and `[*]` are the dots. Without any such item, the section's numbered steps are drawn one after the other, from Start to End, each labelled with its text up to the first colon, full stop, or semicolon; a long label wraps over several lines, and its box in the editor shows three at a time and scrolls the rest.

Further:

- **A process id in parentheses** links a box or an arrow to that process: `Send (ORDE2)` is the label `Send` and the process `ORDE2`.
- **Links, emphasis, and code marks** are dropped from labels.
- **Only marked sections** are diagrams, besides Mermaid blocks and the flows of the model. A list or numbered steps without a marker are not.
- **The diagram's title** is its heading, or the file's name when there is none.
- **Its source** is the file, relative to the project, `#` and the heading's anchor. A second diagram under the same heading gets `-2`, a third `-3`.
- **A described diagram needs an arrow, or at least two boxes.**

The architecture files are also read as a model of the project, by the headers of their tables and the headings of their lists: components from a table with Component and Uses columns, external systems from an Outside column, actors from the bold names under Who uses it, Actors, Roles, or People, data from File, Read, and Written columns, flows from the numbered steps in a file whose name or title says flow, and rules from items `Rule: <from> must not use <to>`. The views of the model, the context, the components, and each flow, are diagrams too; a diagram described in a section wins over a flow of the same section.

## `architecture.json`

In the data folder, written by Analyse architecture, and only read by people. The model of the architecture files: every element with its kind, name, and place, `dev/architecture/components.md:12`; every link, `uses`, `talks`, `next`, or `names`; the rules; and the names that are no component.

## `.vscode/settings.json`

The project's own VS Code settings. GSDiagram uses one:

| Setting | What it is |
|---|---|
| `gsdiagram.folder` | The data folder, relative to the project. Empty means `.gsdiagram`. |
