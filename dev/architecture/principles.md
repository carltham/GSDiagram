# Principles

The fixed decisions. Every part of GSDiagram follows them.

## Free

- **MIT.** Anyone may use, change, and share GSDiagram, without cost.

## The data stays in the project

- **Everything GSDiagram keeps is a file in the project,** in its data folder, versioned with the project. Nothing is kept in VS Code's global or extension storage.
- **The data folder is `.gsdiagram/`** at the root of the project, unless the setting `gsdiagram.folder` names another folder in the project.
- **Nothing outside the project.** A data folder, a processes file, or an architecture folder outside the project is refused or ignored.
- **One project per workspace folder.** In a workspace with several folders, each has its own data folder, settings, and findings.
- **Nothing is created by looking.** Opening a project, checking it, or loading it writes nothing. The data folder is created only when something is saved into it.

## Diagrams are plain files

- **A diagram is a JSON file,** `*.diagram.json`, readable and editable by hand, and diffable in version control.
- **Changed like typing.** In VS Code, every change to a diagram goes through the text document, so undo, redo, save, the dirty mark, and the diff work as for any file.
- **Written the same way every time:** two-space indentation and a final new line. A change that changes nothing leaves the file as it was written.
- **The source files are only read.** The processes file and the architecture files are never written by GSDiagram.

## One code for both

- **The extension and the command line share their code:** loading a project, the check, accepting changes, generating diagrams, the layout, and the drawing. A picture drawn by the command line is drawn by the same code as the editor's.
- **The shared code does not depend on VS Code.**
- Rule: GSDiagram/shared/ must not use GSDiagram/extension/
- Rule: GSDiagram/shared/ must not use GSDiagram/cli/
- Rule: Pages must not use Extension

## The layout is automatic

- **Every box is placed automatically,** unless the user has dragged it. A dragged box keeps its position until Reset layout.
- **The arrows of a dragged box are straight lines.**

## Generic

- **Nothing is specific to one project.** The processes file, the id pattern, the data folder, and the architecture folder are all settings, with neutral defaults.
