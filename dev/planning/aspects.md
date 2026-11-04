# Aspects

A user process can be described from more than one aspect: as the work should be done, without any technology, and as the program should carry it out. Each of these is an aspect, and the aspects are independent of each other: each has its own files, its own model, its own JSON file, its own checks, and its own diagrams. Nothing in one aspect refers to another, and nothing is checked between them.

What they share is the screen. An architect picks a user process and the aspects to see, and the picked aspects show their views of that process at the same time, one under the other, to compare the aspects by eye.

## The goals

Each architecture, an architecture folder or a subfolder of one as in [Data → `config.json`](../architecture/data.md#configjson), has one goal, and so is one aspect:

| Goal | Describes | Its JSON file |
|---|---|---|
| `processes` | The user processes as they should be, without any kind of technology: who does what, step by step, in the user's words | `processes.json` |
| `technical` | The user processes as they should be from the program's technical aspect: the components that carry out each step, their uses, the rules, and the data. The model of today. | `technical.json` |

An architecture is `technical` unless `config.json` says otherwise, so a project that sets nothing works as today:

| Field | Holds | Unless set |
|---|---|---|
| `goals` | The goal of an architecture, by its folder relative to the project: `"dev/processes": "processes"`. A subfolder has its folder's goal unless it is named itself. | `technical` |

More goals can be added later, each an aspect of its own, on the same terms.

## The JSON files

**Analyse architecture** writes each architecture's model into its folder of the data folder, named by its goal: `.gsdiagram/processes/processes.json`, `.gsdiagram/architecture/technical.json`. The model of a `technical` architecture is today's `architecture.json` under its new name; an `architecture.json` left from before is not read, and can be removed.

A `processes` model holds:

- **Actors,** the bold names under Who uses it, Actors, Roles, or People, as today.
- **Processes,** every section with numbered steps, in any of the architecture's files, not only one whose name says flow: its heading, its process id, and its steps.

A `technical` model is today's model: components, uses, actors, external systems, data, flows, and rules; see [Data → The architecture files](../architecture/data.md#the-architecture-files).

## The user process, in every aspect

An aspect describes a user process in a section whose heading carries the process's id in parentheses, as a box or an arrow does today: `## Send an invoice (INVO10)`. The id is how the view finds the same process in each aspect. It is taken out of the heading for the diagram's title, as it is taken out of a box's label: the title is `Send an invoice`. It names the process; it is no link between the aspects, and neither aspect needs the other to have it.

## The checks

Each aspect is checked on its own, by its goal. The findings are about the architecture, in the Problems panel at their places, as today.

| Goal | Finding | Severity |
|---|---|---|
| Both | Two sections in one aspect for the same process id | Warning |
| Both | A process id in a heading that is not in the processes file, when one is set | Warning |
| `processes` | A section of steps whose heading has no process id | Information |
| `processes` | A step that names something in `code`, such as a component or a file: the aspect is without technology | Information |
| `processes` | An actor no step names | Information |
| `technical` | Everything `GSDiagram/shared/review` reports today | As today |

A `technical` flow without a process id is not reported: not every technical flow is a user process, such as The extension starts.

## Generate and the diagrams

Generate draws each aspect's processes or flows as today, into its own folder of the data folder, each with its `source`. The view finds an aspect's diagram of a process in two steps: the aspect's model gives the section with that process id, and the diagram is the one whose `source` is that section, as Update finds it. A heading reworded keeps the id, so the process is still found once Update has drawn it again. Dragging a box changes that aspect's diagram only.

## The view

**GSDiagram: Inspect a user process**, also a lens above each process in the processes file and an action on a flow with a process id in the side bar, opens the view:

1. The operator picks a process: every process id that any aspect describes. An archived architecture is no aspect here, as it is drawn nowhere else.
2. Above the drawing, a box per aspect, by its architecture's name and goal, picks which aspects are shown. Every aspect that describes the process is picked at first.
3. Each picked aspect is a band, one under the other, in the order of the architecture folders, with its name on the band. It shows that aspect's generated diagram of the process, drawn and laid out as in the editor, three-line boxes and all.
4. A picked aspect that does not describe the process shows an empty band that says so, and Generate when it has a section but no diagram yet.
5. A box can be dragged in its band, which changes that aspect's diagram file like an edit, as in the editor. Nothing crosses between bands.
6. Which aspects are picked is not kept: by [The data stays in the project](../architecture/principles.md#the-data-stays-in-the-project), nothing goes into VS Code's storage, and it is no property of the project.

## Where it goes

| Part | What it does |
|---|---|
| `GSDiagram/shared/model` | Reads a `processes` model as well as a `technical` one, by the goal, and the process id of a section's heading. |
| `GSDiagram/shared/architecture` | Takes a process id out of a heading for a diagram's title. |
| `GSDiagram/shared/review` | Checks a model by its goal. |
| `GSDiagram/shared/architectures` | Gives each architecture its goal, from `goals` in `config.json`. |
| `GSDiagram/shared/aspects` | New. Finds, for a process id, the section and the generated diagram of it in each aspect. Uses `GSDiagram/shared/architectures` and `GSDiagram/shared/diagram`. |
| `GSDiagram/extension/aspects` | New. The view: a webview panel, the picking of the process and the aspects, and the changes to each aspect's diagram document. Uses `GSDiagram/extension/check` and `GSDiagram/shared/aspects`; talks to `GSDiagram/webview/aspects` by messages. |
| `GSDiagram/webview/aspects` | New. The view's page: the boxes to pick aspects, and a band per picked aspect, drawn with `GSDiagram/shared/layout` and `GSDiagram/shared/draw`. |
| `GSDiagram/extension/sidebar` | Shows each architecture's goal beside its name, and Inspect on a flow with a process id. |
| `GSDiagram/extension/links` | A lens Inspect above each process in the processes file. |
| `GSDiagram/extension/extension`, `GSDiagram/cli/cli` | Analyse writes each model under its goal's name. |

The rule [Pages must not use Extension](../architecture/principles.md#one-code-for-both) holds: the new page talks to the panel by messages only.

## Tests

- **Unit:** reading a `processes` model; each finding of the table, by goal; `goals` and a subfolder's goal; finding a process in each aspect by its id; `technical` as the default, with today's tests unchanged.
- **UI:** a project with `dev/processes` and `dev/architecture`; Inspect a user process shows both bands; unpicking one hides it and the other closes up; an aspect without the process shows its empty band; a drag in a band changes that aspect's diagram only.

## Done when

- A project can have a `processes` aspect and a `technical` aspect, each with its own JSON file and its own checks.
- An architect can see any picked aspects of one user process at the same time.
- The architecture describes it, and this file is removed.
