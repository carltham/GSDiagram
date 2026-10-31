# Components

The code is in four folders. `shared/` is used by everything; `src/` is the extension, `webview/` the pages, and `cli/` the command line.

## Shared

Used by the extension, the command line, and the pages. It does not depend on VS Code. `diagram`, `layout`, and `draw` do not depend on Node either, so the pages can use them.

| Component | What it does | Uses |
|---|---|---|
| `shared/types` | The types: the diagram, its nodes and arrows, `config.json`, a process, and the messages between the extension and the editor's page. The defaults: the id pattern `[A-Z]{4}\d+` and the architecture folder `dev/architecture`. | — |
| `shared/diagram` | Reads a diagram file, and refuses one without `nodes` and `edges` lists. Lists the process ids a diagram uses. | `types` |
| `shared/processes` | Reads the processes from a Markdown file: id, title, text, group, and line. | `types` |
| `shared/folder` | Resolves the data folder from the setting, or the default; refuses one outside the project. Reads `gsdiagram.folder` from a `settings.json` that may have comments and trailing commas. | — |
| `shared/project` | Loads a project: the data folder, `config.json`, the diagrams, the processes file, and the architecture files. The text of an open document can take the place of the file on disk. Writes `config.json`. | `folder`, `types` |
| `shared/check` | The check: every finding, with its file, line, column, and severity. Accept process changes. The short hash of a process's text. | `diagram`, `processes`, `project`, `generate`, `types` |
| `shared/architecture` | Reads the diagrams an architecture file describes: sections marked `<!-- diagram -->`. | `types` |
| `shared/generate` | Plans Generate and Update: which diagram files to create or change, and their text. Lists every diagram the architecture files describe. | `architecture`, `diagram`, `project`, `types` |
| `shared/layout` | Places boxes, arrows, and labels with ELK, keeps dragged boxes where they are, and draws their arrows straight. | `types` |
| `shared/draw` | Draws a laid-out diagram as SVG, with the colours written on the elements. The light colours. Measures text. | `layout` |

## Extension

Runs in VS Code's extension host.

| Component | What it does | Uses |
|---|---|---|
| `src/extension` | Starts the extension once VS Code has started. Registers the editor, the lenses and hover, and the commands. Watches the files and settings that can change the check. Applies Generate and Update as one edit, and saves the files. | `src/check`, `src/editor`, `src/links`, `src/folder`, `shared/check`, `shared/folder`, `shared/generate`, `shared/project`, `shared/types` |
| `src/check` | The checker: runs the check on every workspace folder, 300 ms after the last change; puts the findings in the Problems panel; keeps, per folder, the project, its processes, which diagrams use each process, and the findings; tells the editors and the lenses when it has run. Shows a refused data folder once per folder. | `src/folder`, `shared/check`, `shared/diagram`, `shared/processes`, `shared/project`, `shared/types` |
| `src/editor` | The custom text editor for `*.diagram.json`: the page, the messages to and from it, the changes to the document, the PNG file, and opening a process. Knows which diagram editor is in front. | `src/check`, `shared/diagram`, `shared/types`; talks to `webview/main` by messages |
| `src/links` | The lenses above each process in the processes file, and the hover over it. | `src/check`, `shared/project` |
| `src/folder` | Reads the setting per workspace folder, loads a workspace folder's project with the text of open documents, and asks which folder when a command needs one and there are several. | `shared/project` |

## Pages

Run in a browser: the editor's page in VS Code's webview, the render page in headless Chrome.

| Component | What it does | Uses |
|---|---|---|
| `webview/main` | The editor's page: lays out and draws the diagram in the theme's colours, the selection and the detail, dragging, zoom, Reset layout, and Render PNG. Talks to `src/editor` by messages only. | `shared/diagram`, `shared/layout`, `shared/draw`, `shared/types` |
| `webview/render` | The page the command line opens to draw a diagram in the light colours. | `shared/diagram`, `shared/layout`, `shared/draw` |
| `webview/style.css` | The editor page's look, in the theme's colours. | — |

## Command line

| Component | What it does | Uses |
|---|---|---|
| `cli/cli` | `check`, `render`, `accept`, `generate`, and `update` on a project folder. Reads the data folder from the project's `.vscode/settings.json`. | `shared/check`, `shared/generate`, `shared/processes`, `shared/project`, `shared/types`; opens `webview/render` in headless Chrome |

## Built output

`esbuild.mjs` bundles each entry point into `dist/`:

| Bundle | From | For |
|---|---|---|
| `dist/extension.js` | `src/extension` | Node, CommonJS; `vscode` left out |
| `dist/cli.js` | `cli/cli` | Node, CommonJS; `playwright-core` left out |
| `dist/webview.js` | `webview/main` | Browser, minified, ELK included |
| `dist/render.js` | `webview/render` | Browser, minified, ELK included |
| `dist/style.css`, `dist/render.html` | `webview/` | Copied |
| `dist/test/` | `test/` | The tests |

The package holds only `extension.js`, `webview.js`, `style.css`, `package.json`, `README.md`, and `LICENSE`. The command line and the render page are not in it; they are used from the repository.
