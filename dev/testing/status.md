# Test status

The state of the tests now. The UI run in progress, test by test with progress bars, is in [test-log.md](test-log.md), written live by `playwright/log-reporter.ts`; how the tests fit together is in [tests.mmd](tests.mmd).

Last updated: 2026-11-01 12:06.

| Suite | Run with | Tests | Last result |
|---|---|---|---|
| Unit | `npm test` | 51 | 51 passed (2026-11-01 11:53) |
| Extension | `npm run test:vscode` | 3 | 3 passed (2026-11-01 11:53) |
| UI | `npm run test:ui` | 70 | 70 passed (2026-11-01 12:06) |

## Open problems

| Test | Problem | State |
|---|---|---|
| `editor.spec.ts` › clicking the background clears the selection | Selecting a box scrolls a wide drawing to the right. The click 5 px from the drawing's left edge then lands outside the editor, and the selection stays. A fault in the test, not in the extension. | Fixed in `vscode.ts` `clickBackground()`: scrolls back to the left first. Passed in the full runs of 10:09 and 10:19. |
| `editor.spec.ts` › a drag in the diagram shows up in the text | The test read the box's position before the page drew it again from the file, while it was still where the pointer left it, `165.67`; the file holds whole pixels, `166`. A fault in the test. Failed 2 of 5 times. | Fixed: the test rounds the position, as the file does. Passed 6 of 6 after, and in the full run of 11:10. |
| `check.spec.ts` › Accept process changes works from the diagram open as text | Sometimes **View: Reopen Editor With...** is not found in the command palette within 15 s. Fails also on commit `089f266`, so it is older than the architecture model. | Cause not yet known. Passed in the full runs of 10:09 and 10:19, on a quiet machine; it failed only under load. Watch it. |

## Not committed

Version 0.2.0, and the progress bar of Generate and Update. Several architectures per project: `GSDiagram/shared/architectures.ts`, `GSDiagram/extension/architectures.ts`, the side bar's groups, and their tests, `dev/testing/unit/architectures.test.ts` and `dev/testing/playwright/tests/architectures.spec.ts`.
