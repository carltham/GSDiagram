# GSDiagram

A free VS Code extension for diagrams of a project's processes. The diagrams are plain JSON files in the project itself, drawn automatically, and checked against the project's list of processes.

## The data stays in the project

- Everything GSDiagram keeps is a file in the project's **data folder**: `.gsdiagram/` at the root of the project.
- Another folder in the project can be configured with the setting `gsdiagram.folder`, a path relative to the project, kept in the project's own `.vscode/settings.json`. **GSDiagram: Choose data folder** picks it.
- A data folder outside the project is refused. Nothing is kept in VS Code's own storage.
- In a workspace with several folders, each folder has its own data folder.

The data folder holds:

| File | What it is |
|---|---|
| `config.json` | The project's settings: `processesFile`, the Markdown file that lists the processes, and `idPattern`, the pattern of a process id. |
| `*.diagram.json` | One diagram each. |
| `*.png` | A diagram drawn as a picture, by **Render PNG**. |

## The processes file

Any Markdown file in the project. A process is a list item that starts with its id and title in bold:

```markdown
## Invoices

- **INVO10 Send an invoice.** On the detail, press Send; its draft is booked.
```

The id pattern is `[A-Z]{4}\d+` unless `idPattern` in `config.json` says otherwise. **GSDiagram: Set processes file** picks the file. Without one, the diagrams still work, and nothing is checked.

## A diagram

```json
{
  "title": "Invoice life cycle",
  "direction": "RIGHT",
  "nodes": [
    { "id": "start", "label": "Start", "kind": "start" },
    { "id": "sent", "label": "Sent" }
  ],
  "edges": [
    { "from": "start", "to": "sent", "label": "Send", "process": "INVO10" }
  ]
}
```

- `kind` is `state` (the default), `start`, or `end`.
- `direction` is `RIGHT` (the default) or `DOWN`.
- `process`, on a node or an arrow, is a process id from the processes file.
- The layout is automatic. A dragged box gets `x` and `y`, and keeps them until **Reset layout**.
- `drawn` records the text of each process when the diagram was last accepted; see the check.
- `source`, in a generated diagram, names the architecture file and section that describe it; see below.

A `*.diagram.json` file opens in the diagram editor. **Reopen Editor With… → Text Editor** shows the JSON. A drag changes the file like typing would: undo, save, and diff work as usual. The editor writes the file with two-space indentation.

## The editor

- Click a box or an arrow to see its process; **Open in the processes file** goes to it.
- Drag a box to move it. **Reset layout** forgets every dragged position.
- **−** and **+** zoom.
- **Render PNG** saves the diagram as a PNG next to it.
- A process id that is not in the processes file is drawn in red.

## The check

It runs whenever a diagram, `config.json`, or a Markdown file changes, and on **GSDiagram: Check**. Findings go to the Problems panel:

| Finding | Severity |
|---|---|
| A file that is not a diagram; an arrow to a node that does not exist; a node id used twice; a processes file that is missing | Error |
| A process id that is not in the processes file | Warning |
| A process whose text has changed since the diagram was accepted | Warning |
| A generated diagram whose source section is gone from the architecture files | Warning |
| A process that is in no diagram | Information |

After checking a diagram against the changed processes, **GSDiagram: Accept process changes** records their current text in the diagram's `drawn`.

In the processes file, a line above each process says which diagrams use it, and opens them. Hovering over the process says the same.

## Diagrams from the architecture files

**GSDiagram: Generate diagrams** draws the diagrams that the Markdown files in `dev/architecture` describe, in all its subfolders. Another folder in the project can be set as `architectureFolder` in `config.json`. A diagram is described by:

- A Mermaid flowchart or state diagram. Other Mermaid diagrams, such as sequence diagrams, are not drawn.

  ````markdown
  ## Order life cycle

  ```mermaid
  stateDiagram-v2
      [*] --> Draft : Create (ORDE1)
      Draft --> Sent : Send (ORDE2)
      Sent --> [*]
  ```
  ````

- A section marked `<!-- diagram -->`, which does not show when the Markdown is read. Its list items with arrows are the boxes and arrows; `Start` and `End` are the dots.

  ```markdown
  ## Order life cycle
  <!-- diagram -->
  - Start → Draft: Create (ORDE1)
  - Draft → Sent: Send (ORDE2)
  - Sent → End
  ```

  A marked section without arrows is drawn from its numbered steps, one after the other, from Start to End. A step's label is its text up to the first colon or full stop.

A process id in parentheses, `(ORDE1)`, links a box or an arrow to that process, and the check checks it against the processes file. A section without a marker is not drawn, even if it has arrows or steps.

Each diagram is named after its heading, `order-life-cycle.diagram.json`, unless the marker names it: `<!-- diagram: orders -->`. A marker before a Mermaid block names that block. The diagram records where it was described in `source`, such as `dev/architecture/orders.md#order-life-cycle`. Generate never changes a diagram that is there.

**GSDiagram: Update diagrams** does the same, and draws each generated diagram again from its source: change the architecture file, not the diagram. Dragged positions and accepted process changes are kept. A diagram without `source`, drawn by hand, is never changed. When the section of a diagram's source is gone, the check says so.

The changes are saved, and can be undone like an edit.

## Command line

The same check and drawing, outside VS Code, after `npm run build`:

```
node dist/cli.js check    <project>
node dist/cli.js render   <project> [--chrome /usr/bin/google-chrome]
node dist/cli.js accept   <project>
node dist/cli.js generate <project>
node dist/cli.js update   <project>
```

`check` exits with 1 when there are errors or warnings. `render` needs Chrome or Chromium.

## Development

```
npm install
npm run build          # into dist/
npm test               # unit tests
npm run test:vscode    # the extension in a test instance of VS Code
npm run test:ui        # the UI, driven by Playwright in a test instance of VS Code
npm run package        # gsdiagram-<version>.vsix
npm run release        # every test, then the package
```

The UI tests are in `dev/testing/playwright`, a Node project of its own with its own Playwright: install it once with `npm --prefix dev/testing/playwright install`. Each test starts its own VS Code on a fresh copy of `test/fixture`, then clicks, drags, types, and uses the command palette, the Problems panel, the lenses, and the open dialogs as a user would. On Linux, `xvfb-run -a npm run test:ui` keeps the windows off the screen. A failed test leaves a screenshot and a trace in `dev/testing/playwright/test-results/`; `npm --prefix dev/testing/playwright run report` shows them.

The tests that change files on disk need VS Code's file watcher. On Linux it stops working when the user's inotify instances run out (`fs.inotify.max_user_instances`, often 128); close other editors, or raise the limit.

F5 in VS Code opens a window with the extension and `test/fixture`. Install a package with `code --install-extension gsdiagram-<version>.vsix`.

`npm run build` minifies the pages of the editor; `npm run watch` leaves them readable.

## Release

1. `npm version <version>` sets the version, commits it, and tags it `v<version>`.
2. `xvfb-run -a npm run release` runs every test and builds `gsdiagram-<version>.vsix`. Without `xvfb-run`, the test windows open on the screen.
3. Publish the package:
   - On GitHub: `git push --follow-tags`, then `gh release create v<version> gsdiagram-<version>.vsix --generate-notes`.
   - On the VS Code Marketplace, under the publisher `gsdiagram`: `npx vsce login gsdiagram` once, with an Azure DevOps token that may manage the Marketplace, then `npx vsce publish`.
   - On Open VSX: `npx ovsx publish gsdiagram-<version>.vsix -p <token>`.

## Licence

MIT. Free to use, change, and share.
