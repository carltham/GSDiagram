// Builds the extension, the webview, the render page, the command line, and the tests into dist/.

import * as esbuild from 'esbuild';
import { copyFile, mkdir, readdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const node = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', sourcemap: true, logLevel: 'info' };
// The pages are minified, except while watching; the source maps still point at the source.
const browser = { bundle: true, platform: 'browser', format: 'iife', target: 'es2022', sourcemap: true, minify: !watch, logLevel: 'info' };

const tests = (await readdir('dev/testing/unit')).filter(f => f.endsWith('.test.ts')).map(f => `dev/testing/unit/${f}`);

const builds = [
  { ...node, entryPoints: ['GSDiagram/extension/extension.ts'], outfile: 'dist/extension.js', external: ['vscode'] },
  { ...node, entryPoints: ['GSDiagram/cli/cli.ts'], outfile: 'dist/cli.js', external: ['playwright-core'] },
  { ...node, entryPoints: tests, outdir: 'dist/test' },
  { ...node, entryPoints: ['dev/testing/vscode/run.ts', 'dev/testing/vscode/suite.ts'], outdir: 'dist/test/vscode', external: ['vscode', 'mocha', '@vscode/test-electron'] },
  { ...browser, entryPoints: ['GSDiagram/webview/main.ts'], outfile: 'dist/webview.js' },
  { ...browser, entryPoints: ['GSDiagram/webview/render.ts'], outfile: 'dist/render.js' },
];

await mkdir('dist', { recursive: true });
await copyFile('GSDiagram/webview/style.css', 'dist/style.css');
await copyFile('GSDiagram/webview/render.html', 'dist/render.html');

if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map(b => esbuild.build(b)));
}
