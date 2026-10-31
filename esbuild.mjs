// Builds the extension, the webview, the render page, the command line, and the tests into dist/.

import * as esbuild from 'esbuild';
import { copyFile, mkdir, readdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const node = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', sourcemap: true, logLevel: 'info' };
const browser = { bundle: true, platform: 'browser', format: 'iife', target: 'es2022', sourcemap: true, logLevel: 'info' };

const tests = (await readdir('test')).filter(f => f.endsWith('.test.ts')).map(f => `test/${f}`);

const builds = [
  { ...node, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js', external: ['vscode'] },
  { ...node, entryPoints: ['cli/cli.ts'], outfile: 'dist/cli.js', external: ['playwright-core'] },
  { ...node, entryPoints: tests, outdir: 'dist/test' },
  { ...node, entryPoints: ['test/vscode/run.ts', 'test/vscode/suite.ts'], outdir: 'dist/test/vscode', external: ['vscode', 'mocha', '@vscode/test-electron'] },
  { ...browser, entryPoints: ['webview/main.ts'], outfile: 'dist/webview.js' },
  { ...browser, entryPoints: ['webview/render.ts'], outfile: 'dist/render.js' },
];

await mkdir('dist', { recursive: true });
await copyFile('webview/style.css', 'dist/style.css');
await copyFile('webview/render.html', 'dist/render.html');

if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map(b => esbuild.build(b)));
}
