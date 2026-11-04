# What is this good for?

Imagine an architecture that tells you when it stops making sense.

No diagram drawn once and never touched again, no box for a part the code lost a year ago, no
arrow nobody can explain. Just the Markdown you already write about your project, read as a
model of what the system is made of, checked for what does not hold together, and drawn as
diagrams that follow the text.

> **The architecture you write, checked and drawn, so it stays true.**

Checked doesn't mean strict. You write tables and lists, as you would anyway. The checking is in
what GSDiagram makes of them.

---

## The dream

### Write once, in Markdown

You describe your system in the files you keep with your code: a table of components and what
each uses, a list of who uses the system, the steps of each flow. GSDiagram reads them as they
are. Nothing is written twice, and nothing lives in a drawing tool beside the project.

### An architecture that is checked

A name that is no component, a part that uses itself in a circle, a use that one of your own
rules forbids, a component nothing uses, a flow that names no part: each shows up in the
Problems panel, at its line, like a fault in code. A badly made architecture can be put right,
because you can see where it is wrong.

### Diagrams that follow the text

One command draws the context, the components, and each flow, laid out automatically. Change the
text, and Update draws them again. Move a box by hand, and it stays where you put it.

### Processes, kept with their diagrams

The things a user can do, numbered in a file of your own, appear in the diagrams that use them.
A process that has changed since its diagram was drawn, or that no diagram shows, is pointed out
until you have looked.

### Old architecture, kept but quiet

A project often has more than one architecture: the one being built, and the one it replaced.
Move the old one into an `old` folder, and it stays listed and readable, but no longer warns
or gets drawn.

### Next: one user process, seen from several sides

A user process will be describable as the work should be done, with no technology in it, and as
the program should carry it out, part by part. Each will be an aspect of its own, written and
checked on its own. Pick a process and the aspects you want, and see them one under the other, to
compare the aspects by eye.

### Then: the code against the architecture

The imports in the code will be checked against what the architecture says each part uses:
TypeScript first, then Java. The architecture and the code will tell you when they drift apart.

---

## What it will never be

- **Not a drawing tool.** You never draw the diagrams; you describe the system, and the drawing
  follows. A box can be moved, but its meaning comes from the text.
- **Not a keeper of your data.** Everything is a file in your project, versioned with it.
  Nothing goes to a server, nothing is hidden in the editor's storage.
- **Not a writer of your text.** Your Markdown is only read. GSDiagram tells you what is wrong;
  you decide how to put it right.

---

## What it believes in

1. **The architecture is written, not drawn.**
2. **What is written is checked.**
3. **Everything stays in the project.**
4. **Free, for anyone, under MIT.**
