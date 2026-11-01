# Components

The code is in `GSDiagram/`, in four folders. `GSDiagram/shared/` is used by everything; `GSDiagram/extension/` is the extension, `GSDiagram/webview/` the pages, and `GSDiagram/cli/` the command line. The tests are in `dev/testing/`.

## Shared

Used by the extension, the command line, and the pages. It does not depend on VS Code. `diagram`, `layout`, and `draw` do not depend on Node either, so the pages can use them.

| Component | What it does | Uses |
|---|---|---|
| `GSDiagram/shared/types` | The types: the diagram, its nodes and arrows, `config.json`, a process, and the messages between the extension and the editor's page. The defaults: the id pattern `[A-Z]{4}\d+` and the architecture folder `dev/architecture`. | — |
| `GSDiagram/shared/diagram` | Reads a diagram file, and refuses one without `nodes` and `edges` lists. Lists the process ids a diagram uses. | `types` |
| `GSDiagram/shared/processes` | Reads the processes from a Markdown file: id, title, text, group, and line. | `types` |
| `GSDiagram/shared/folder` | Resolves the data folder from the setting, or the default; refuses one outside the project. Reads `gsdiagram.folder` from a `settings.json` that may have comments and trailing commas. | — |
| `GSDiagram/shared/project` | Loads a project: the data folder, `config.json`, the diagrams, the processes file, and the architecture files. The text of an open document can take the place of the file on disk. Writes `config.json`. | `folder`, `types` |
| `GSDiagram/shared/check` | The check: every finding, with its file, line, column, and severity, and the findings of the architecture's review. Accept process changes. The short hash of a process's text. The counts of a check and of a model. | `diagram`, `processes`, `project`, `generate`, `model`, `review`, `types` |
| `GSDiagram/shared/architecture` | Reads the diagrams an architecture file describes: Mermaid flowcharts and state diagrams, and sections marked `<!-- diagram -->`. Draws numbered steps as a diagram. | `types` |
| `GSDiagram/shared/model` | Reads the architecture model from the architecture files' tables and lists: components and their uses, actors, external systems, data, flows, and rules. Draws its views: the context, the components, and each flow. Writes `architecture.json`. | `architecture`, `types` |
| `GSDiagram/shared/review` | The check of the architecture model: names that are no component, cycles, uses a rule forbids, and what nothing uses or names. | `model` |
| `GSDiagram/shared/generate` | Plans Generate and Update: which diagram files to create or change, and their text. Lists every diagram the architecture files describe, and the views of their model. Reads a project's model. | `architecture`, `diagram`, `model`, `project`, `types` |
| `GSDiagram/shared/layout` | Places boxes, arrows, and labels with ELK, keeps dragged boxes where they are, and draws their arrows straight. | `types` |
| `GSDiagram/shared/draw` | Draws a laid-out diagram as SVG, with the colours written on the elements. The light colours. Measures text. | `layout` |

## Extension

Runs in VS Code's extension host.

| Component | What it does | Uses |
|---|---|---|
| `GSDiagram/extension/extension` | Starts the extension once VS Code has started. Registers the editor, the lenses and hover, the side bar, and the commands. Watches the files and settings that can change the check. Applies Generate and Update as one edit, and saves the files. Writes the model for Analyse architecture. | `GSDiagram/extension/check`, `GSDiagram/extension/editor`, `GSDiagram/extension/links`, `GSDiagram/extension/sidebar`, `GSDiagram/extension/folder`, `GSDiagram/shared/check`, `GSDiagram/shared/folder`, `GSDiagram/shared/generate`, `GSDiagram/shared/model`, `GSDiagram/shared/project`, `GSDiagram/shared/types` |
| `GSDiagram/extension/check` | The checker: runs the check on every workspace folder, 300 ms after the last change; puts the findings in the Problems panel; keeps, per folder, the project, its processes, which diagrams use each process, and the findings; tells the editors and the lenses when it has run. Shows a refused data folder once per folder. | `GSDiagram/extension/folder`, `GSDiagram/shared/check`, `GSDiagram/shared/diagram`, `GSDiagram/shared/processes`, `GSDiagram/shared/project`, `GSDiagram/shared/types` |
| `GSDiagram/extension/editor` | The custom text editor for `*.diagram.json`: the page, the messages to and from it, the changes to the document, the PNG file, and opening a process. Knows which diagram editor is in front. | `GSDiagram/extension/check`, `GSDiagram/shared/diagram`, `GSDiagram/shared/types`; talks to `GSDiagram/webview/main` by messages |
| `GSDiagram/extension/sidebar` | The side bar behind the GSDiagram icon in the Activity Bar: the Diagrams list, with whether each was generated and its findings, and the Architecture list, the model's context, components by layer, data, flows, and rules, each with its findings and its place. Both are built again each time the check has run. | `GSDiagram/extension/check`, `GSDiagram/shared/check`, `GSDiagram/shared/diagram`, `GSDiagram/shared/generate`, `GSDiagram/shared/model`, `GSDiagram/shared/project`, `GSDiagram/shared/types` |
| `GSDiagram/extension/links` | The lenses above each process in the processes file, and the hover over it. | `GSDiagram/extension/check`, `GSDiagram/shared/project` |
| `GSDiagram/extension/folder` | Reads the setting per workspace folder, loads a workspace folder's project with the text of open documents, and asks which folder when a command needs one and there are several. | `GSDiagram/shared/project` |

## Pages

Run in a browser: the editor's page in VS Code's webview, the render page in headless Chrome.

| Component | What it does | Uses |
|---|---|---|
| `GSDiagram/webview/main` | The editor's page: lays out and draws the diagram in the theme's colours, the selection and the detail, dragging, zoom, Reset layout, and Render PNG. Talks to `GSDiagram/extension/editor` by messages only. | `GSDiagram/shared/diagram`, `GSDiagram/shared/layout`, `GSDiagram/shared/draw`, `GSDiagram/shared/types` |
| `GSDiagram/webview/render` | The page the command line opens to draw a diagram in the light colours. | `GSDiagram/shared/diagram`, `GSDiagram/shared/layout`, `GSDiagram/shared/draw` |
| `GSDiagram/webview/style.css` | The editor page's look, in the theme's colours. | — |

## Command line

| Component | What it does | Uses |
|---|---|---|
| `GSDiagram/cli/cli` | `check`, `render`, `accept`, `analyse`, `generate`, and `update` on a project folder. Reads the data folder from the project's `.vscode/settings.json`. | `GSDiagram/shared/check`, `GSDiagram/shared/generate`, `GSDiagram/shared/model`, `GSDiagram/shared/processes`, `GSDiagram/shared/project`, `GSDiagram/shared/types`; opens `GSDiagram/webview/render` in headless Chrome |

## Built output

`esbuild.mjs` bundles each entry point into `dist/`:

| Bundle | From | For |
|---|---|---|
| `dist/extension.js` | `GSDiagram/extension/extension` | Node, CommonJS; `vscode` left out |
| `dist/cli.js` | `GSDiagram/cli/cli` | Node, CommonJS; `playwright-core` left out |
| `dist/webview.js` | `GSDiagram/webview/main` | Browser, minified, ELK included |
| `dist/render.js` | `GSDiagram/webview/render` | Browser, minified, ELK included |
| `dist/style.css`, `dist/render.html` | `GSDiagram/webview/` | Copied |
| `dist/sidebar.svg` | `GSDiagram/extension/` | Copied: the icon in the Activity Bar |
| `dist/test/` | `dev/testing/unit/`, `dev/testing/vscode/` | The tests |

The package holds only `extension.js`, `webview.js`, `style.css`, `sidebar.svg`, `package.json`, `README.md`, and `LICENSE`. The command line and the render page are not in it; they are used from the repository.
