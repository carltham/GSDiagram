# Quality

How GSDiagram is tested, built, packaged, and released, and what it does not yet do well.

## Testing

Three levels, each run on its own:

| Level | Run with | What | Tests |
|---|---|---|---|
| **Unit** | `npm test` | The shared code in Node: reading processes, the data folder and the setting, every finding of the check, Accept, the layout, reading architecture files, the model and its review, several architectures, Generate and Update. | 54, in `dev/testing/unit/*.test.ts` |
| **Extension** | `npm run test:vscode` | The extension in a test instance of VS Code, on `dev/testing/fixture`: findings reach the Problems panel, a diagram opens in the GSDiagram editor, the lenses. | 3, in `dev/testing/vscode/` |
| **UI** | `npm run test:ui` | The real VS Code, driven by Playwright as a user would: the command palette, the Problems panel, the lenses and hover, the editors, the dialogs, the side bar, and the page inside the GSDiagram editor; clicks, drags, typing, undo, saving. | 71, in `dev/testing/playwright/tests/` |

The UI tests by area:

| Area | Tests |
|---|---|
| The editor: drawing, selection, detail, zoom, dragging, undo, Reset layout, Render PNG, the text editor beside it | 22 |
| The check and Accept | 12 |
| The processes file: lenses and hover | 8 |
| The settings: Set processes file, Choose data folder, refusals | 7 |
| Generate and Update | 7 |
| Analyse architecture and its findings | 4 |
| The side bar: its icon, both lists, the welcome, the title bar | 6 |
| Several architectures: subfolders, archived, added folders, their diagrams | 4 |

**The fixture,** `dev/testing/fixture/`, is a small project: a data folder with `config.json` and one diagram, and a processes file with three processes. The diagram uses one process that is not in the file, and the file has one process that is in no diagram, so a warning and an information finding are there from the start; the tests make the other findings themselves.

**Each UI test** starts its own VS Code, of a fixed version, on a fresh copy of the fixture, with its own user data and settings, one test at a time. A failed test leaves a screenshot and a trace.

**The environment of a test instance** is cleaned of what VS Code itself sets: run from a terminal inside VS Code, the instance would otherwise start as plain Node, or, from a snap-installed VS Code, believe it is the snap.

## Building

- `npm run build` bundles everything into `dist/`, with the pages minified.
- `npm run watch` rebuilds on every change, with the pages readable.
- F5 in VS Code builds, then opens a window with the extension and the fixture.

## Packaging and releasing

- `npm run package` builds and makes `gsdiagram-<version>.vsix`, holding only the extension, the editor's page and style, `package.json`, `README.md`, and `LICENSE`.
- `npm run release` runs every test, then packages.
- A release is tagged, published on GitHub with the package, and can be published on the VS Code Marketplace, under the publisher `gsdiagram`, and on Open VSX.
- Installed locally with `code --install-extension gsdiagram-<version>.vsix`.

## Requirements

- VS Code 1.90 or later. The extension runs on the Node of VS Code 1.90 and later.
- For the command line: Node, a build of the repository, and, for `render`, Chrome or Chromium.

## Known limits

- **A self-loop's label** can be drawn across its own loop.
- **Arrows of a dragged box** are straight lines, and may cross other boxes.
- **During a drag,** only the box moves; its arrows are drawn again when it is dropped.
- **A PNG from the editor** is in the theme's colours; a PNG from the command line is always in the light colours.
- **Update replaces** what was changed by hand in a generated diagram, except dragged positions and `drawn`.
- **The editor writes the whole file again** on any change, so formatting typed by hand is replaced with two-space indentation.
- **Any `config.json` in the workspace,** not only the data folder's, starts the check when it changes. It does no harm, but runs the check more often than needed.
- **Linux file watching:** VS Code's file watcher stops when the user's inotify instances run out, and then changes on disk are not seen. The UI tests that change files on disk need it.
- **The process format is fixed:** a list item with the id and title in bold. Only the id pattern can be changed.
