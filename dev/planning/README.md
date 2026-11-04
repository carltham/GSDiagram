# Planning

What is to be built next, and how: the work that the [Architecture](../architecture/README.md) does not yet describe, because it is not built. Planning conforms to the architecture, never the other way round. It names components, flows, and principles by the names the architecture gives them; nothing here may break a [principle](../architecture/principles.md).

When a part is built, its description moves into the architecture, and it leaves this folder.

| File | Holds |
|---|---|
| [Aspects](aspects.md) | Independent aspects of one user process, each with its goal and its JSON file: as it should be without technology, and from the program's technical aspect; seen together, as the architect picks them |
| [Code against the architecture](code-check.md) | Phase 2: the imports of TypeScript code checked against the components, their uses, and the rules |
| [Java](java.md) | Phase 3: the same check for Java code |
| [Improvements](improvements.md) | Known limits and open points of the architecture, and how each is to be fixed |

## Order

1. **Phase 1, the model and its checks,** is built: the architecture is read into a model and checked against itself. See [Decisions → A model of the architecture](../architecture/decisions.md#a-model-of-the-architecture-not-a-drawing).
2. [Aspects](aspects.md), on what is built: the model of today becomes the `technical` aspect, and a `processes` aspect is added beside it.
3. **Phase 2,** [code against the architecture](code-check.md), for TypeScript, GSDiagram's own language, so GSDiagram checks itself first.
4. **Phase 3,** [Java](java.md), on the same findings, with another reader of imports.
5. [Improvements](improvements.md), between the others, as they are needed.
