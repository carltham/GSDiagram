# Code against the architecture

Phase 2. The architecture model is checked against itself today; next, the code is checked against the model. A component's Uses cell is its cell in the Uses column of [Components](../architecture/components.md). A component that imports one its Uses cell does not name, a use the code no longer has, and an import a rule forbids are findings, at their place, as the other findings are.

It follows [Decisions → A model of the architecture, not a drawing](../architecture/decisions.md#a-model-of-the-architecture-not-a-drawing): "Later, the code can be checked against the same model." TypeScript first, because GSDiagram is written in it and checks itself first.

## What is compared

A component's name is its path in the project, without the extension, as the model has it already: `GSDiagram/shared/check` is `GSDiagram/shared/check.ts`. A component is code when such a file is there, as `.ts`, `.tsx`, `.js`, `.mjs`, or `.jsx`, or a folder of that name with an `index` file; else, such as `GSDiagram/webview/style.css`, it is not read.

Of each code component, the relative imports are read: `import … from '../shared/project'`, `export … from`, and `import('…')`. Each is resolved to a file, and the file to its component. An import of a package, such as `vscode` or `elkjs`, is no component and is left out. Type-only imports count as uses: the code still depends on them.

Only `uses` links are compared. A `talks` link, after the semicolon of a Uses cell, is how two parts reach each other without an import, such as `GSDiagram/extension/editor` and `GSDiagram/webview/main` by messages, and is never an import.

## The findings

| Finding | Severity | Where |
|---|---|---|
| A component imports another that its Uses cell does not name | Warning | The import, in the code |
| A Uses cell names a component the code does not import | Warning | The name, in the Uses cell |
| An import a rule forbids | Warning | The import, in the code, naming the rule |
| A code file under a folder of components that is no component | Information | The file's first line |

A forbidden import is reported once, as a rule's finding, not also as an import its Uses cell does not name. When the Uses cell names it too, the finding of `GSDiagram/shared/review` at the Uses cell stays, as today: the one is about the text, the other about the code. "A folder of components" is a folder that holds a component's file; a test or a script next to it is left out by a setting, below.

An archived architecture's components are not compared, as an archived architecture gives no findings; see [Data → `config.json`](../architecture/data.md#configjson).

## Where it goes

| Part | What it does |
|---|---|
| `GSDiagram/shared/code` | New. Loads the code file of each component of each `technical` architecture, see [Aspects](aspects.md), that is not archived, once the project is loaded; the text of an open document takes the place of the file on disk, as for diagrams. Reads the relative imports of a file, with their places, resolves them to components, and compares them with the model. Does not depend on VS Code, so the command line runs it too, by [One code for both](../architecture/principles.md#one-code-for-both). Uses `GSDiagram/shared/architectures`, `GSDiagram/shared/model`, and `GSDiagram/shared/project`. |
| `GSDiagram/shared/check` | Adds the findings of `GSDiagram/shared/code` to the others, with `about: 'architecture'`. |
| `GSDiagram/extension/folder`, `GSDiagram/cli/cli` | Load the code with the project. |
| `GSDiagram/extension/extension` | Also watches the code files of components, so the check runs again when one changes. Analyse architecture counts the findings in an architecture's code files with those in its Markdown. |
| `GSDiagram/extension/sidebar` | Counts the findings in an architecture's code files with those in its Markdown; today it counts only findings in the architecture files. |

`GSDiagram/shared/project` does not load the code itself: it would have to use `GSDiagram/shared/architectures`, which uses it, a cycle `GSDiagram/shared/review` reports. Code files are only read, as the source files are by [Diagrams are plain files](../architecture/principles.md#diagrams-are-plain-files).

Reading imports is done with a scanner of the source text, not with the TypeScript compiler: comments and strings are skipped, and `import`, `export … from`, and `import(` are found with their places. The compiler would be large in the package and slow on every check.

## Settings

In `config.json`, beside the ones in [Data](../architecture/data.md#configjson):

| Field | Holds | Unless set |
|---|---|---|
| `codeCheck` | Whether the code is checked against the architecture | `true` when any component is code |
| `codeIgnore` | Patterns of code files that are no components, such as tests | `**/*.test.*`, `**/*.spec.*` |

A pattern is matched as a side of a rule with `*` is today, turned into a regular expression, with `**` for any folders: no glob library is added, and the Node of VS Code 1.90 has no glob matching of its own.

## Tests

- **Unit,** in `dev/testing/unit/code.test.ts`: the scanner, with comments, strings, and type imports; resolving `../x` to `x.ts` and `x/index.ts`; each finding; a forbidden import reported once; an archived architecture not compared.
- **UI,** in `dev/testing/playwright/tests/code.spec.ts`: an import typed into a component shows its warning in the Problems panel, at the import; removing it clears it. The test writes a small architecture and its code into its own copy of the fixture, as the tests of several architectures do, so the fixture and the other tests stay as they are.
- **GSDiagram itself:** `node dist/cli.js check` on this repository gives no warnings about its code.

## Done when

- The findings above show in the Problems panel and from `node dist/cli.js check`, at their places.
- GSDiagram's own check gives no warnings about its code.
- The architecture describes it: `GSDiagram/shared/code` in [Components](../architecture/components.md), the findings in [Flows → The check runs](../architecture/flows.md#the-check-runs), the settings in [Data](../architecture/data.md#configjson), and the scanner over the compiler in [Decisions](../architecture/decisions.md). Then this file is removed.
