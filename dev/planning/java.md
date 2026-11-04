# Java

Phase 3. The check of [Code against the architecture](code-check.md), for Java code. The findings, their places, the settings, and the parts that hold them are the same; reading the imports differs, and the model names packages.

## What is compared

In a Java project, a component is a package or a class, named by its path in the project, as in a TypeScript project:

| Component name | Is |
|---|---|
| `src/main/java/com/example/billing/` | The package `com.example.billing`: every `.java` file directly in that folder |
| `src/main/java/com/example/billing/Invoice` | The class `com.example.billing.Invoice`, in `Invoice.java` |

When a class and its package are both components, the class's file is the class's. A name ending in `/` is a folder, as a side of a rule is today; see [Data → The architecture files](../architecture/data.md#the-architecture-files).

Of each `.java` file of a component, these are read:

- `import com.example.billing.Invoice;`: that class.
- `import com.example.billing.*;`: that package.
- `import static com.example.billing.Invoice.total;`: the class `Invoice`.

Each is resolved to a file or folder under the source roots, and so to its component; an import of a class that is not in the project, such as `java.util.List`, is left out. A class of the same package is used without an import: such uses are not seen, and a Uses cell that names one is not reported as missing.

## Source roots

A class is found under the project's source roots: `src/main/java`, and, in a project of several modules, each module's `src/main/java`, found by its `pom.xml` or `build.gradle`. A field in `config.json` names others:

| Field | Holds | Unless set |
|---|---|---|
| `sourceRoots` | Folders, relative to the project, under which a class's package is its path | Every `src/main/java` in the project |

## Where it goes

`GSDiagram/shared/code` gets a second reader, for `.java`, beside the one for TypeScript; the reader is chosen by the file's extension. The findings go the same way, by `GSDiagram/shared/check`.

`GSDiagram/shared/model` resolves a short name in a Uses cell to a package too: `billing` to `src/main/java/com/example/billing/`. Today a short name matches only the end of a component's name, so `billing/` would have to be written.

## Tests

- **Unit:** single, wildcard, and static imports; packages and classes as components; several modules; a class outside the project left out.
- **A real project:** a Java project with an architecture in `dev/architecture`, checked from the command line, its findings read through by hand. GSPos has no architecture yet; it is the first candidate once it has.

## Done when

- A Java project's imports are checked as a TypeScript project's are.
- The architecture describes it, and this file is removed.
