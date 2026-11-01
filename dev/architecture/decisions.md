# Decisions

The choices of technology and design, and why they were made.

## A VS Code extension

**Chosen:** a VS Code extension, written in TypeScript.

**Instead of:** a desktop application in Electron, JavaFX, or Swing.

**Why:** the diagrams sit next to the Markdown they describe, and VS Code already gives the rest: the Problems panel for findings, lenses and hover in the processes file, undo, save, and diff for diagram files, the theme, and the command palette. A separate application would have had to rebuild all of it.

## A custom text editor

**Chosen:** a custom *text* editor (`CustomTextEditorProvider`) for `*.diagram.json`.

**Instead of:** a custom editor with its own document model.

**Why:** every change goes through VS Code's own text document. Undo, redo, save, the dirty mark, and the diff need no code of their own, and the same file can be open as text and as a drawing at once.

## Plain TypeScript in the page

**Chosen:** the editor's page in plain TypeScript, without a framework.

**Instead of:** Angular or another framework.

**Why:** the page is one drawing, a detail panel, and four buttons. The hard part, layout and SVG, gets no help from a framework.

## ELK for the layout

**Chosen:** ELK (`elkjs`), its layered algorithm, with orthogonal arrows and centred labels.

**Instead of:** placing boxes by hand, or dagre.

**Why:** process diagrams are mostly flows in one direction, which is what the layered algorithm is for. It places arrow labels as part of the layout, so they do not overlap boxes, and keeps parallel arrows apart. It runs in the browser and in Node without a worker.

## Colours on the elements

**Chosen:** the drawing writes every colour and font onto the SVG elements, rather than using a stylesheet.

**Why:** the SVG then stands on its own as a picture: the page can turn it into a PNG by serialising it, and the render page draws the same picture outside VS Code.

## One shared code, one render page

**Chosen:** the check, the layout, and the drawing in `GSDiagram/shared/`, used by the extension, the command line, and both pages; the command line draws PNGs by opening the render page in headless Chrome through `playwright-core`, with the system's Chrome.

**Why:** a picture checked from the command line is drawn by exactly the code that draws it in the editor. `playwright-core` brings no browser of its own, so nothing large is downloaded.

## Hashes for changed processes

**Chosen:** a diagram records a 10-character SHA-1 hash of each process's title and text when it is accepted.

**Instead of:** copying the processes' text into the diagram.

**Why:** the diagram stays small and readable, and any change to a process's title or text shows up, until the user has looked at the diagram and accepted it.

## A model of the architecture, not a drawing

**Chosen:** the architecture files are read into a model, elements with a kind and links with a meaning, which is checked and drawn. Not Mermaid or another drawing language in between.

**Why:** a drawing has boxes and lines, but no meaning to check: that a name is a component, that shared code does not use the extension, that nothing goes round in a cycle. The model is read from the tables and lists the files already have, so nothing is written twice. Later, the code can be checked against the same model.

## Diagrams from the architecture's own Markdown

**Chosen:** Generate reads sections marked `<!-- diagram -->` from the architecture files.

**Why:** the marker lets a list of arrows or numbered steps that is already in the text become a diagram, without writing it twice. Without a marker nothing is taken, so ordinary lists are never mistaken for diagrams.

## esbuild

**Chosen:** esbuild bundles each entry point into one file.

**Why:** it is fast, needs little configuration, and bundles ELK into the pages, so the package has no `node_modules`.

## Started once VS Code has started

**Chosen:** the extension starts on `onStartupFinished`.

**Why:** the check and the lenses must be there as soon as the processes file is opened, in any project, without delaying VS Code's own start. A project without a data folder costs one look for it.
