# Test status

The state of the tests now. The UI run in progress, test by test with progress bars, is in [test-log.md](test-log.md), written live by `playwright/log-reporter.ts`; how the tests fit together is in [tests.mmd](tests.mmd).

Last updated: 2026-11-01 10:28.

| Suite | Run with | Tests | Last result |
|---|---|---|---|
| Unit | `npm test` | 43 | 43 passed (2026-11-01 10:19) |
| Extension | `npm run test:vscode` | 3 | 3 passed (2026-11-01 10:19) |
| UI | `npm run test:ui` | 59 | 59 passed (2026-11-01 10:28) |

## Open problems

| Test | Problem | State |
|---|---|---|
| `editor.spec.ts` › clicking the background clears the selection | Selecting a box scrolls a wide drawing to the right. The click 5 px from the drawing's left edge then lands outside the editor, and the selection stays. A fault in the test, not in the extension. | Fixed in `vscode.ts` `clickBackground()`: scrolls back to the left first. Passed in the full runs of 10:09 and 10:19. |
| `check.spec.ts` › Accept process changes works from the diagram open as text | Sometimes **View: Reopen Editor With...** is not found in the command palette within 15 s. Fails also on commit `089f266`, so it is older than the architecture model. | Cause not yet known. Passed in the full runs of 10:09 and 10:19, on a quiet machine; it failed only under load. Watch it. |

## Not committed

The architecture model (`GSDiagram/shared/model.ts`, `GSDiagram/shared/review.ts`, Analyse architecture) and its tests, `dev/testing/unit/model.test.ts` and `dev/testing/playwright/tests/analyse.spec.ts`. The move of the code into `GSDiagram/` and of the tests into `dev/testing/`.
