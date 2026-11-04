# Improvements

The [known limits](../architecture/quality.md#known-limits) and [open points](../architecture/README.md#open-points) of the architecture, and how each is to be fixed. Each is small, and is done between the phases when it is needed.

| Limit | Fix | Where |
|---|---|---|
| **A self-loop's label** can be drawn across its own loop. | Place the label beside the loop, outside the box, on the side the loop leaves from. | `GSDiagram/shared/layout` |
| **During a drag,** only the box moves. | Draw the box's arrows straight to the pointer while it moves; the routed arrows come when it is dropped. | `GSDiagram/webview/main` |
| **Any `config.json` in the workspace** starts the check. | Watch only the data folder's `config.json` of each workspace folder. | `GSDiagram/extension/extension` |
| **Update replaces labels changed by hand** in a generated diagram. | Keep it: the source is the truth, by [Diagrams from the architecture's own Markdown](../architecture/decisions.md#diagrams-from-the-architectures-own-markdown). Say which labels Update changes, in its message, naming each diagram. It cannot tell a label changed by hand from one of an older source, so it names every changed label. | `GSDiagram/shared/generate`, `GSDiagram/extension/extension`, `GSDiagram/cli/cli` |
| **A PNG from the editor and from the command line differ** in colours. | A field in `config.json`, `pngColours`, `theme` or `light`, `theme` unless set, so a project's pictures look alike whoever renders them. The command line has no theme, and draws `light` either way. | `GSDiagram/webview/main`, `GSDiagram/extension/editor`, `GSDiagram/shared/types` |
| **The process format is fixed.** | Keep it until a project needs another; then a pattern in `config.json` for a process's list item, described in [Data → The processes file](../architecture/data.md#the-processes-file), as `idPattern` is for its id. | `GSDiagram/shared/processes` |

## Needs a principle changed first

- **Arrows of a dragged box** are straight lines, and may cross other boxes. ELK could take the dragged positions as fixed and route the arrows around the boxes. But [The layout is automatic](../architecture/principles.md#the-layout-is-automatic) says the arrows of a dragged box are straight lines, so the principle is changed first, by a decision in [Decisions](../architecture/decisions.md), and then this is planned. Until then it stays a known limit.

## Not to be done

- **Formatting typed by hand** is replaced by two-space indentation when the editor writes a diagram. That is [Written the same way every time](../architecture/principles.md#diagrams-are-plain-files), on purpose.
- **Roles.** Everyone who opens the project can do everything; GSDiagram keeps no users.
- **Linux file watching** stops when inotify instances run out. That is VS Code's, not GSDiagram's; the README says how to raise the limit.
