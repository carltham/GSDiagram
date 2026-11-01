# Test status

The state of the tests now. The UI run in progress, test by test with progress bars, is in [test-log.md](test-log.md), written live by `playwright/log-reporter.ts`; how the tests fit together is in [tests.mmd](tests.mmd).

Last updated: 2026-11-01 10:52.

| Suite | Run with | Tests | Last result |
|---|---|---|---|
| Unit | `npm test` | 43 | 43 passed (2026-11-01 10:37) |
| Extension | `npm run test:vscode` | 3 | 3 passed (2026-11-01 10:37) |
| UI | `npm run test:ui` | 65 | 64 passed, 1 failed (2026-11-01 10:47); the failed one fixed, then 6 of 6 |

## Open problems

| Test | Problem | State |
|---|---|---|
| `editor.spec.ts` › clicking the background clears the selection | Selecting a box scrolls a wide drawing to the right. The click 5 px from the drawing's left edge then lands outside the editor, and the selection stays. A fault in the test, not in the extension. | Fixed in `vscode.ts` `clickBackground()`: scrolls back to the left first. Passed in the full runs of 10:09 and 10:19. |
| `editor.spec.ts` › a drag in the diagram shows up in the text | The test read the box's position before the page drew it again from the file, while it was still where the pointer left it, `165.67`; the file holds whole pixels, `166`. A fault in the test. Failed 2 of 5 times. | Fixed: the test rounds the position, as the file does. Passed 6 of 6 after. |
| `check.spec.ts` › Accept process changes works from the diagram open as text | Sometimes **View: Reopen Editor With...** is not found in the command palette within 15 s. Fails also on commit `089f266`, so it is older than the architecture model. | Cause not yet known. Passed in the full runs of 10:09 and 10:19, on a quiet machine; it failed only under load. Watch it. |

## Not committed

The GSDiagram side bar (`GSDiagram/extension/sidebar.ts`, its icon, views, welcome, and title bar buttons) and its 6 UI tests in `dev/testing/playwright/tests/sidebar.spec.ts`; the fix to the drag test.
