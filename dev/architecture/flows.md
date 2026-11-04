# Flows

What happens, step by step, for each thing a user does.

## The extension starts

1. VS Code starts `GSDiagram/extension/extension` once it has started itself.
2. It registers the diagram editor, the lenses and hover for Markdown files, the side bar, and the commands.
3. It starts watching: open documents of diagrams, `config.json` files, and Markdown files as they are typed and saved; the same files as they are created, changed, and deleted on disk; the workspace folders; and the `gsdiagram` settings.
4. `GSDiagram/extension/check` runs the check once. A workspace folder without a data folder, or with an empty one, gives no findings and has nothing written to it.

## The side bar is opened

1. The user clicks the GSDiagram icon in the Activity Bar.
2. `GSDiagram/extension/sidebar` lists the diagrams of each workspace folder from the last check: by name, `generated` when it has a `source`, and its count of findings, marked by the worst.
3. It lists each architecture that `GSDiagram/shared/architectures` finds, a group of its own when there are several, archived ones closed: its model, read by `GSDiagram/shared/model`, as Context, Components by layer, Data, Flows, and Rules, each with its count, and last the count of findings about it.
4. A list with nothing in it shows its welcome instead: for Diagrams, Generate diagrams, Set processes file, Choose data folder, and Open the README; for Architecture, what to write, and Open the README.
5. A click on a diagram opens it in the GSDiagram editor; on an element of the model, its file at its line; on the count of findings, the Problems panel.
6. Each time the check has run, both lists are built again.

## The check runs

1. Something that can change the check happens: a diagram, a `config.json`, or a Markdown file is typed in, saved, created, changed, or deleted; a workspace folder is added or removed; a `gsdiagram` setting changes. Or the user runs **GSDiagram: Check**.
2. 300 ms after the last such change, `GSDiagram/extension/check` loads each workspace folder's project. The text of an open document is used in place of its file, so unsaved typing counts.
3. A data folder outside the project is refused: an error message, once per folder, and that folder is left out.
4. `GSDiagram/shared/check` checks each project: every diagram file, the processes file, the sources of generated diagrams, and each architecture that is not archived.
5. The findings replace the last ones in the Problems panel, each at its place in its file.
6. Open diagram editors get the processes again, and the lenses are asked for again.
7. For **GSDiagram: Check**, a message gives the count of errors, warnings, and processes in no diagram.

The findings:

| Finding | Severity | Where |
|---|---|---|
| A diagram file that is not JSON, or has no `nodes` or `edges` list | Error | The diagram, at the fault when it can be found |
| A node id used twice | Error | The node |
| An arrow to or from a node that does not exist | Error | The arrow's `from` or `to` |
| `processesFile` set, but the file is missing or outside the project | Error | `config.json` |
| A process id that is not in the processes file | Warning | Where the diagram names it |
| A process whose text has changed since the diagram was accepted | Warning | Where the diagram names it |
| A generated diagram whose source is no longer described | Warning | The diagram's `source` |
| A process that is in no diagram | Information | The process in the processes file |

Without a processes file, nothing is checked against processes. A process the diagram uses but has never accepted gives no change warning.

## A diagram is opened

1. The user opens a `*.diagram.json` file. VS Code opens it in the GSDiagram editor, its default editor for these files.
2. `GSDiagram/extension/editor` creates the page and, when the page says it is ready, sends it the document's text, the processes of its workspace folder, and whether a processes file is set.
3. The page, `GSDiagram/webview/main`, reads the diagram. If it is not a diagram, the page shows why above the drawing and keeps the last drawing.
4. The page measures the labels in the theme's font, `GSDiagram/shared/layout` lays the diagram out, and `GSDiagram/shared/draw` draws it in the theme's colours. Each box is three lines high; the mouse wheel scrolls a longer text. A box or an arrow whose process is not in the processes file is drawn in the error colour.
5. Whenever the document changes, by typing in it as text, by undo, or by any edit, and whenever the check has run, the editor sends the page the text and processes again, and the page draws again.

**Reopen Editor With… → Text Editor** shows the JSON. Both editors work on the same document.

## A box or an arrow is clicked

1. The user clicks a box without moving it, or clicks an arrow.
2. `GSDiagram/webview/main` draws it as selected and shows its detail: the box's label, or the arrow's label with the ids it runs between, and then:
   - its group, id, title, text, and **Open in the processes file**; or
   - that it has no process; or
   - that its process is not in the processes file; or
   - its process id, and that no processes file is set.
3. **Open in the processes file** opens the processes file beside the diagram, at the process's line.

Clicking the background clears the selection.

## A box is dragged

1. The user presses on a box and moves the pointer more than 3 pixels. The box follows the pointer.
2. On release, `GSDiagram/webview/main` sends the new position, rounded to whole pixels.
3. `GSDiagram/extension/editor` reads the document, sets the box's `x` and `y`, and replaces the document's text with the diagram written again. The document is now changed, but not saved.
4. The document change makes the page draw again. The box stays where it was dropped, and its arrows are drawn straight.
5. Undo and redo move it back and forth. Saving writes the file.

## Reset layout

1. The user presses **Reset layout**.
2. `GSDiagram/extension/editor` removes `x` and `y` from every box. If no box had them, nothing changes and the file is left as it was written.
3. The page draws again with the automatic layout.

## Zoom

**+** and **−** make the drawing 1.25 times larger or smaller, between a quarter and four times its size. The file does not change.

## Render PNG, in the editor

1. The user presses **Render PNG**, or runs **GSDiagram: Render PNG** with a diagram editor in front.
2. `GSDiagram/webview/main` draws the diagram again, at twice its size, without the selection, in the theme's colours, every box as high as its text, and turns it into a PNG.
3. `GSDiagram/extension/editor` writes it next to the diagram, `orders.diagram.json` to `orders.png`, replacing one that is there, and says it is saved.

Without a diagram editor in front, the command says to open a diagram first.

## Accept process changes

1. The user runs **GSDiagram: Accept process changes** with a diagram open, in the GSDiagram editor or as text.
2. The check runs first.
3. `GSDiagram/shared/check` records, for every process the diagram uses that is in the processes file, the current hash of its title and text in `drawn`, which is written anew. Ids not in the processes file are left out of it.
4. The document is changed, like an edit; saving writes it. The change warnings for that diagram go away.

Without a diagram open, it says to open one; without a processes file, it says none is set.

## Analyse architecture

1. The user runs **GSDiagram: Analyse architecture**.
2. The check runs first; `GSDiagram/shared/review` adds its findings about the architecture to the Problems panel.
3. If no workspace folder's architecture files hold anything for the model, a message says so and nothing is written.
4. For each architecture that `GSDiagram/shared/architectures` finds, `GSDiagram/shared/model` reads the model from its files.
5. `GSDiagram/extension/extension` writes each architecture's model to `architecture.json` in its folder of the data folder, creating it if it is not there. An archived architecture is analysed too, but not checked.
6. A message per architecture says what the model holds and how many warnings and notes are in the Problems panel.

## Generate diagrams

1. The user runs **GSDiagram: Generate diagrams**. A progress bar shows in a notification and on top of the Diagrams list, with each step.
2. The check runs first.
3. If no workspace folder's architecture files describe a diagram, a message says so and nothing changes.
4. For each architecture that `GSDiagram/shared/architectures` finds, and that is not archived, and for each diagram it describes that no diagram file has as its `source`, a file is planned in the architecture's folder of the data folder: named by the marker's name; or else by its heading; or else by its file's name. If that name is taken and the marker gave none, the file's name is put in front, `orders-flow`; if it is still taken, `-2`, `-3` are added.
5. A diagram that is there is never changed by Generate.
6. `GSDiagram/extension/extension` writes each new file to disk without opening it; the progress bar counts them, `saving orders.diagram.json, 3 of 15`. When it is done, a message lists the files created, or says the diagrams are up to date.

## Update diagrams

As Generate, and also:

1. `GSDiagram/shared/generate` draws each diagram file whose `source` is still described again from it: its title, direction, nodes, and arrows are the source's.
2. A box that is still there, by its id, keeps its dragged position. `drawn` is kept.
3. Everything else the file had is replaced, including labels changed by hand and other fields.
4. A file whose text would not change is not touched. A diagram without a `source`, drawn by hand, is never touched.
5. A diagram open in an editor changes in one edit, so its editor follows and the change can be undone, and is saved. Every other file is written to disk without opening it.

## Add an architecture folder

1. The user runs **GSDiagram: Add architecture folder**, or presses its button in the Architecture list's title bar, and picks the workspace folder when there are several.
2. A folder picker opens at the project. A folder outside the project is refused with a message; cancelling changes nothing.
3. `GSDiagram/extension/architectures` writes the folder into `architectureFolders` in `config.json`, after the ones there, keeping the other fields. The check runs, and the side bar lists the new architecture, and each of its subfolders, as groups of their own.

**Remove architecture folder** takes a folder off the list again; a subfolder cannot be removed, and the last folder neither.

## Archive an architecture

1. The user presses **Mark architecture archived** on an architecture's row in the side bar, or runs the command and picks the architecture.
2. `GSDiagram/extension/architectures` writes `"<folder>": true` into `archived` in `config.json`.
3. The check runs. The architecture's findings, and those of its diagrams, leave the Problems panel; its row says archived; Generate and Update leave it alone.

**Mark architecture current** writes `false`, which also brings back an architecture archived by its folder's name.

## See where a process is drawn

1. The user opens the processes file of a workspace folder.
2. `GSDiagram/extension/links` puts above each process a lens per diagram that uses it, `in orders`, which opens that diagram in the GSDiagram editor; or `in no diagram`, which does nothing.
3. Pointing at a process's line shows the same, with links that open the diagrams.
4. The lenses follow the check: a process typed in gets its lens, and a new diagram shows up above its processes.

Other Markdown files have no lenses and no hover.

## Choose data folder

1. The user runs **GSDiagram: Choose data folder**, and picks the workspace folder when there are several.
2. A folder picker opens at the project.
3. A folder outside the project is refused with a message. Cancelling changes nothing.
4. `GSDiagram/extension/extension` stores the folder, relative to the project, in the project's `.vscode/settings.json` as `gsdiagram.folder`.
5. The check runs with the new data folder.

## Set processes file

1. The user runs **GSDiagram: Set processes file**, and picks the workspace folder when there are several.
2. A file picker for Markdown files opens at the project.
3. A file outside the project is refused with a message. Cancelling changes nothing.
4. `GSDiagram/extension/extension` writes the file, relative to the project, as `processesFile` into `config.json`, keeping its other fields. The data folder is created if it is not there.
5. The check runs against the new processes file.

## The command line

1. A developer or an agent runs `GSDiagram/cli/cli` as `node dist/cli.js <command> <project>`, after a build. The project is the current folder when left out.
2. It reads the data folder from the project's `.vscode/settings.json`, and loads the project with `GSDiagram/shared/project`.
3. It does the command, with the same code as the extension; for `render`, it opens `GSDiagram/webview/render` in headless Chrome.
4. It prints what it found or wrote, and exits with 0, or with 1 on findings or a failure.

| Command | What it does |
|---|---|
| `check` | Prints each finding as `file:line:column: severity: message`, then the counts. Exits with 1 when there are errors or warnings, else 0. |
| `render` | Opens the render page in headless Chrome, `/usr/bin/google-chrome` unless `--chrome <path>` names another, and writes each diagram's PNG next to it, at twice its size, in the light colours. |
| `accept` | Accepts process changes in every diagram, and writes them. Stops when no processes file is set. |
| `analyse` | As Analyse architecture: writes each architecture's `architecture.json` and prints the findings about it. |
| `generate` | As Generate diagrams, writing the files directly. Stops when no diagrams are described. |
| `update` | As Update diagrams, writing the files directly. Stops when no diagrams are described. |

An unknown command prints the usage and exits with 2. Any failure prints its message and exits with 1.
