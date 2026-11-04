# Test status

The state of the tests now. The UI run in progress, test by test with progress bars, is in [test-log.md](test-log.md), written live by `playwright/log-reporter.ts`; how the tests fit together is in [tests.mmd](tests.mmd).

Last updated: 2026-11-04 20:51.

| Suite | Run with | Tests | Last result |
|---|---|---|---|
| Unit | `npm test` | 56 | 56 passed (2026-11-04) |
| Extension | `npm run test:vscode` | 3 | 3 passed (2026-11-01 11:53) |
| UI | `npm run test:ui` | 71 | 71 passed (2026-11-01 18:18) |

## Open problems

| Test | Problem | State |
|---|---|---|
| `editor.spec.ts` › clicking the background clears the selection | Selecting a box scrolls a wide drawing to the right. The click 5 px from the drawing's left edge then lands outside the editor, and the selection stays. A fault in the test, not in the extension. | Fixed in `vscode.ts` `clickBackground()`: scrolls back to the left first. Passed in the full runs of 10:09 and 10:19. |
| `editor.spec.ts` › a drag in the diagram shows up in the text | The test read the box's position before the page drew it again from the file, while it was still where the pointer left it, `165.67`; the file holds whole pixels, `166`. A fault in the test. Failed 2 of 5 times. | Fixed: the test rounds the position, as the file does. Passed 6 of 6 after, and in the full run of 11:10. |
| `check.spec.ts` › Accept process changes works from the diagram open as text | Sometimes **View: Reopen Editor With...** is not found in the command palette within 15 s. Fails also on commit `089f266`, so it is older than the architecture model. | Cause not yet known. Passed in the full runs of 10:09 and 10:19, on a quiet machine; it failed only under load. Watch it. |

## Not committed

A heading Users no longer gives actors, only Who uses it, Actors, Roles, or People: in a project's architecture, Users is as often a screen, and its list is of its controls. A new setting, `subfolderArchitectures`, `true` unless set: when `false`, a subfolder is part of its folder's architecture, unless it is archived. `GSDiagram/shared/model.ts`, `architectures.ts`, `types.ts`, the README, `data.md`, `components.md`, and 2 unit tests. Unit 56 pass; the extension and UI tests were not run.

The architecture checked against itself and the code, four rounds, from 14 notes to 0 warnings and 0 notes: each flow names the components that do its steps, the command line is a flow of its own, and stale descriptions are brought up to date. `dev/architecture/`, the README and `types.ts` name every archived folder name. The imports match every Uses cell.
