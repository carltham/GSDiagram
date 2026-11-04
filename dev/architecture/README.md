# GSDiagram architecture

The architecture of GSDiagram as it is built: a free VS Code extension, with a command line, that draws a project's processes as diagrams, keeps them as files in the project, and checks them against the project's list of processes.

It describes the code as it is. Where the code and README.md disagree, the code is described, and the difference is an open point. What is not yet built is planned in [Planning](../planning/README.md).

## Index

| File | Holds |
|---|---|
| [Context](context.md) | What GSDiagram is, who uses it, what it works with, and what goes in and out |
| [Principles](principles.md) | The fixed decisions every part follows |
| [Components](components.md) | The parts of the code, what each does, and how they depend on each other |
| [Data](data.md) | Every file GSDiagram reads or writes, and its format |
| [Flows](flows.md) | What happens, step by step, for each thing a user does |
| [Decisions](decisions.md) | The choices of technology and design, and why |
| [Quality](quality.md) | Testing, building, packaging, releasing, and the known limits |

## Open points

- **Labels changed by hand in a generated diagram** are lost on Update. Only dragged positions and `drawn` are kept.
- **A PNG from the editor and a PNG from the command line differ.** The editor draws in the VS Code theme's colours, so a dark theme gives a dark picture; the command line always draws in the light colours.
- **A self-loop's label** can be drawn across its own loop.
- **Roles:** GSDiagram has none. Everyone who opens the project can do everything.
