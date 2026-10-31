# Context

## What GSDiagram is

A VS Code extension, free under MIT, for diagrams of a project's processes. A process is a numbered step of what a user can do, such as `INVO10 Send an invoice`, listed in a Markdown file of the project. A diagram shows how the processes connect: boxes, arrows, and the process each stands for.

GSDiagram draws each diagram automatically, lets the user move boxes by hand, and checks every diagram against the list of processes: a process that does not exist, a process that has changed since the diagram was drawn, and a process that is in no diagram.

The same code also runs as a command line, outside VS Code.

## Who uses it

- **Someone writing a project's architecture,** who keeps its processes in a Markdown file and wants to see them as diagrams, and to know when the diagrams and the text drift apart.
- **A developer or an agent,** who runs the command line to check the diagrams or draw them as pictures, without VS Code.

## What it works with

| Outside | What GSDiagram does with it |
|---|---|
| **VS Code** 1.90 or later | Hosts the extension: the diagram editor, the Problems panel, the lenses and hover in Markdown, the commands, the settings, the pickers, and the messages. |
| **The project's folder** | Holds everything GSDiagram reads and writes. Each workspace folder is a project of its own. |
| **The processes file** | A Markdown file of the project that lists the processes. Read only. |
| **The architecture files** | The Markdown files under the project's architecture folder, `dev/architecture` unless configured. Read only; diagrams described in them can be generated. |
| **The project's `.vscode/settings.json`** | Holds the setting `gsdiagram.folder`, when the data folder is not the default. |
| **Chrome or Chromium** | Used only by the command line's `render`, to draw diagrams as PNG without a window. |

## What goes in and what comes out

| In | Out |
|---|---|
| The processes file | Findings in the Problems panel, or printed by the command line |
| The architecture files | Generated `*.diagram.json` files |
| `*.diagram.json`, typed or dragged | The drawing in the editor; the changed file |
| `config.json` and the setting | Where everything is found |
| | `*.png` pictures of the diagrams |
| | Lenses and hover in the processes file |
