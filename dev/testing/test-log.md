# Test log

The UI tests of the run in progress, written as they run by `dev/testing/playwright/log-reporter.ts`.

Started 2026-11-01 11:54. Finished 2026-11-01 12:06: **passed**.

70 passed, 0 failed, 0 skipped, 0 to go.

**All** `██████████████████████████████` 70/70

| File | Progress | Passed | Failed |
|---|---|---|---|
| analyse.spec.ts | `████████████████████` 4/4 | 4 | 0 |
| architectures.spec.ts | `████████████████████` 4/4 | 4 | 0 |
| check.spec.ts | `████████████████████` 12/12 | 12 | 0 |
| editor.spec.ts | `████████████████████` 22/22 | 22 | 0 |
| generate.spec.ts | `████████████████████` 7/7 | 7 | 0 |
| processes.spec.ts | `████████████████████` 8/8 | 8 | 0 |
| settings.spec.ts | `████████████████████` 7/7 | 7 | 0 |
| sidebar.spec.ts | `████████████████████` 6/6 | 6 | 0 |

| | File | Test | Time | Error |
|---|---|---|---|---|
| ✔ | analyse.spec.ts:23 | Analyse writes the model of the architecture files, and says what it holds | 8.9 s |  |
| ✔ | analyse.spec.ts:33 | a use against a rule is a warning in the Problems panel, and goes away when the architecture is put right | 10.3 s |  |
| ✔ | analyse.spec.ts:50 | Generate draws the components of the model, with their uses | 9.7 s |  |
| ✔ | analyse.spec.ts:63 | Analyse without architecture files says there is nothing to analyse | 8.6 s |  |
| ✔ | architectures.spec.ts:16 | each subfolder is an architecture of its own; one named old is archived, and gives no findings | 9.7 s |  |
| ✔ | architectures.spec.ts:32 | Generate draws each current architecture into its own folder, listed as its own group | 9.0 s |  |
| ✔ | architectures.spec.ts:45 | an architecture is marked archived from the side bar, and current again | 11.6 s |  |
| ✔ | architectures.spec.ts:63 | an architecture folder elsewhere in the project is added, and removed again | 10.3 s |  |
| ✔ | check.spec.ts:8 | the Problems panel shows the findings at their places | 8.4 s |  |
| ✔ | check.spec.ts:17 | a finding in the Problems panel opens the diagram at its place | 9.2 s |  |
| ✔ | check.spec.ts:23 | the Check command reports the counts | 9.3 s |  |
| ✔ | check.spec.ts:28 | typing a missing process into the processes file clears its warning, before saving | 11.9 s |  |
| ✔ | check.spec.ts:51 | removing a process from the processes file marks the arrows that use it | 11.3 s |  |
| ✔ | check.spec.ts:65 | a diagram file that is not JSON is an error | 8.8 s |  |
| ✔ | check.spec.ts:72 | an arrow to a missing node and a node id used twice are errors | 9.3 s |  |
| ✔ | check.spec.ts:84 | a processes file that is missing is an error on config.json | 9.0 s |  |
| ✔ | check.spec.ts:92 | fixing a finding clears it from the Problems panel | 9.4 s |  |
| ✔ | check.spec.ts:100 | a changed process is reported until its change is accepted | 13.1 s |  |
| ✔ | check.spec.ts:129 | Accept process changes works from the diagram open as text | 10.1 s |  |
| ✔ | check.spec.ts:136 | Accept process changes without a processes file says so | 9.5 s |  |
| ✔ | editor.spec.ts:13 | a diagram file opens in the GSDiagram editor and is drawn | 9.4 s |  |
| ✔ | editor.spec.ts:27 | the layout runs left to right | 9.6 s |  |
| ✔ | editor.spec.ts:34 | an arrow whose process is not in the processes file is drawn in the error colour | 9.6 s |  |
| ✔ | editor.spec.ts:43 | clicking a box selects it and shows that it has no process | 9.9 s |  |
| ✔ | editor.spec.ts:51 | clicking an arrow shows its process from the processes file | 9.7 s |  |
| ✔ | editor.spec.ts:61 | clicking an arrow with an unknown process says it is not in the processes file | 9.6 s |  |
| ✔ | editor.spec.ts:68 | clicking the background clears the selection | 9.8 s |  |
| ✔ | editor.spec.ts:76 | Open in the processes file shows the process beside the diagram | 10.5 s |  |
| ✔ | editor.spec.ts:87 | + and − zoom the drawing, within limits | 11.9 s |  |
| ✔ | editor.spec.ts:101 | dragging a box moves it and changes the file like typing would; save writes it | 9.8 s |  |
| ✔ | editor.spec.ts:118 | a click on a box without moving it does not change the file | 9.9 s |  |
| ✔ | editor.spec.ts:125 | undo puts a dragged box back, and redo moves it again | 10.2 s |  |
| ✔ | editor.spec.ts:141 | a dragged position is kept when the diagram is opened again | 11.9 s |  |
| ✔ | editor.spec.ts:152 | Reset layout forgets every dragged position | 10.4 s |  |
| ✔ | editor.spec.ts:167 | Reset layout on a diagram with no dragged boxes changes nothing | 9.9 s |  |
| ✔ | editor.spec.ts:173 | the Render PNG button saves the diagram as a PNG next to it | 10.6 s |  |
| ✔ | editor.spec.ts:185 | the Render PNG command renders the diagram in front | 11.1 s |  |
| ✔ | editor.spec.ts:191 | Reopen Editor With… Text Editor shows the JSON, and back again the drawing | 13.2 s |  |
| ✔ | editor.spec.ts:206 | typing in the JSON redraws the diagram at once | 13.3 s |  |
| ✔ | editor.spec.ts:220 | text that is not a diagram is shown as a problem, and the last drawing stays | 12.4 s |  |
| ✔ | editor.spec.ts:236 | a drag in the diagram shows up in the text | 11.8 s |  |
| ✔ | editor.spec.ts:249 | Render PNG and Accept process changes without a diagram open say to open one | 12.7 s |  |
| ✔ | generate.spec.ts:20 | Generate draws a diagram from a marked section of an architecture file | 10.8 s |  |
| ✔ | generate.spec.ts:36 | Generate draws a diagram from a Mermaid state diagram | 10.0 s |  |
| ✔ | generate.spec.ts:49 | Generate leaves a diagram that is there alone, and says when there is nothing to do | 10.5 s |  |
| ✔ | generate.spec.ts:61 | Update draws an open diagram again from its edited source, keeping a dragged box where it is | 13.1 s |  |
| ✔ | generate.spec.ts:88 | a generated diagram whose source is gone is a warning in the Problems panel | 9.3 s |  |
| ✔ | generate.spec.ts:97 | Generate and Update without described diagrams say so | 10.2 s |  |
| ✔ | generate.spec.ts:106 | Generate shows its progress, file by file, then what it created | 10.3 s |  |
| ✔ | processes.spec.ts:10 | each process says which diagrams use it | 8.7 s |  |
| ✔ | processes.spec.ts:14 | clicking a lens opens the diagram in the GSDiagram editor | 10.4 s |  |
| ✔ | processes.spec.ts:22 | hovering over a process says which diagrams use it, and the link opens it | 10.6 s |  |
| ✔ | processes.spec.ts:30 | hovering over a process in no diagram says so | 9.0 s |  |
| ✔ | processes.spec.ts:35 | a new diagram that uses a process shows up above it | 11.6 s |  |
| ✔ | processes.spec.ts:47 | a process used by two diagrams has a lens for each | 10.2 s |  |
| ✔ | processes.spec.ts:56 | a process typed into the file gets its lens | 10.1 s |  |
| ✔ | processes.spec.ts:63 | another Markdown file has no lenses | 10.5 s |  |
| ✔ | settings.spec.ts:8 | Set processes file writes the chosen file into config.json and checks against it | 10.2 s |  |
| ✔ | settings.spec.ts:21 | Set processes file refuses a file outside the project | 9.6 s |  |
| ✔ | settings.spec.ts:30 | Set processes file, cancelled, changes nothing | 9.1 s |  |
| ✔ | settings.spec.ts:37 | Choose data folder stores the folder in the project settings and uses it | 11.2 s |  |
| ✔ | settings.spec.ts:53 | Choose data folder refuses a folder outside the project | 9.2 s |  |
| ✔ | settings.spec.ts:60 | a data folder setting outside the project is refused, once | 11.6 s |  |
| ✔ | settings.spec.ts:72 | without a processes file the diagrams still work, and nothing is checked | 9.8 s |  |
| ✔ | sidebar.spec.ts:23 | the GSDiagram icon opens the side bar, which lists the diagrams with their findings; a click opens one | 9.7 s |  |
| ✔ | sidebar.spec.ts:33 | without diagrams, the side bar says how to get started, and Generate fills it | 10.5 s |  |
| ✔ | sidebar.spec.ts:46 | the Architecture view shows the model; a click goes to where a component is written | 10.2 s |  |
| ✔ | sidebar.spec.ts:62 | a finding about the architecture marks what it is about, and the title bar runs Analyse | 9.5 s |  |
| ✔ | sidebar.spec.ts:76 | the lists follow the check: a diagram written on disk shows up | 8.8 s |  |
| ✔ | sidebar.spec.ts:85 | the welcome opens the README | 9.1 s |  |
