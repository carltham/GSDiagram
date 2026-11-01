// Writes the run in progress to dev/testing/test-log.md: every test, and whether it waits, runs, passed, or failed.
// The file is written again as each test starts and ends, so it can be watched while the tests run.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

const LOG = path.join(__dirname, '..', 'test-log.md');

type State = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped';
const MARK: Record<State, string> = { waiting: '·', running: '▶', passed: '✔', failed: '✘', skipped: '–' };

const time = (d: Date) => d.toLocaleString('sv-SE').slice(0, 16);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// A bar of 30 blocks: passed in full blocks, failed in crosses, the rest still to go. 18/59 after it.
function bar(passed: number, failed: number, total: number, width = 30): string {
  const ok = Math.round(passed / total * width), bad = failed ? Math.max(1, Math.round(failed / total * width)) : 0;
  const rest = Math.max(0, width - ok - bad);
  return `\`${'█'.repeat(ok)}${'✘'.repeat(bad)}${'░'.repeat(rest)}\` ${passed + failed}/${total}`;
}

export default class LogReporter implements Reporter {
  private tests: TestCase[] = [];
  private state = new Map<TestCase, { state: State; duration?: number; error?: string }>();
  private started = new Date();
  private finished?: { at: Date; status: string };

  onBegin(_config: FullConfig, suite: Suite) {
    this.started = new Date();
    this.tests = suite.allTests();
    for (const t of this.tests) this.state.set(t, { state: 'waiting' });
    this.write();
  }

  onTestBegin(test: TestCase) {
    this.state.set(test, { state: 'running' });
    this.write();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const state: State = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    const error = result.error?.message?.split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '');
    this.state.set(test, { state, duration: result.duration, ...(state === 'failed' && error ? { error } : {}) });
    this.write();
  }

  onEnd(result: { status: string }) {
    this.finished = { at: new Date(), status: result.status };
    this.write();
  }

  private write() {
    const count = (s: State) => [...this.state.values()].filter(x => x.state === s).length;
    const done = count('passed') + count('failed') + count('skipped');
    const cell = (s: string) => s.replace(/\|/g, '\\|');
    const lines = [
      '# Test log',
      '',
      'The UI tests of the run in progress, written as they run by `dev/testing/playwright/log-reporter.ts`.',
      '',
      `Started ${time(this.started)}. ${this.finished
        ? `Finished ${time(this.finished.at)}: **${this.finished.status}**.`
        : `Running: ${done} of ${this.tests.length} done.`}`,
      '',
      `${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped, ${count('waiting') + count('running')} to go.`,
      '',
      `**All** ${bar(count('passed') + count('skipped'), count('failed'), this.tests.length)}`,
      '',
      '| File | Progress | Passed | Failed |',
      '|---|---|---|---|',
      ...[...new Set(this.tests.map(t => t.location.file))].map(file => {
        const of = this.tests.filter(t => t.location.file === file).map(t => this.state.get(t)!.state);
        const n = (s: State) => of.filter(x => x === s).length;
        const now = of.includes('running') ? ' ▶' : '';
        return `| ${path.basename(file)}${now} | ${bar(n('passed') + n('skipped'), n('failed'), of.length, 20)} | ${n('passed')} | ${n('failed')} |`;
      }),
      '',
      '| | File | Test | Time | Error |',
      '|---|---|---|---|---|',
      ...this.tests.map(t => {
        const s = this.state.get(t)!;
        return `| ${MARK[s.state]} | ${path.basename(t.location.file)}:${t.location.line} | ${cell(t.title)} | `
          + `${s.duration !== undefined ? seconds(s.duration) : ''} | ${cell(s.error ?? '')} |`;
      }),
      '',
    ];
    writeFileSync(LOG, lines.join('\n'));
  }
}
