// The command line: check, render, accept, generate, and update, for a project folder. The same code as the extension.
//   node dist/cli.js check    <project>
//   node dist/cli.js render   <project> [--chrome <path>]
//   node dist/cli.js accept   <project>
//   node dist/cli.js generate <project>
//   node dist/cli.js update   <project>

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { acceptChanges, checkProject } from '../shared/check';
import { describedDiagrams, planDiagrams } from '../shared/generate';
import { readProcesses } from '../shared/processes';
import { configuredFolder, idPattern, loadProject } from '../shared/project';
import { DEFAULT_ARCHITECTURE_FOLDER } from '../shared/types';

async function main() {
  const [command, root = '.', ...rest] = process.argv.slice(2);
  const projectRoot = path.resolve(root);
  const project = await loadProject(projectRoot, await configuredFolder(projectRoot));

  if (command === 'check') {
    const findings = checkProject(project);
    for (const f of findings) console.log(`${path.relative(projectRoot, f.file)}:${f.line + 1}:${f.column + 1}: ${f.severity}: ${f.message}`);
    const count = (s: string) => findings.filter(f => f.severity === s).length;
    console.log(`${count('error')} errors, ${count('warning')} warnings, ${count('info')} processes in no diagram.`);
    process.exitCode = count('error') + count('warning') > 0 ? 1 : 0;

  } else if (command === 'accept') {
    if (!project.processes) throw new Error('No processes file is set.');
    const processes = readProcesses(project.processes.text, idPattern(project.config));
    for (const d of project.diagrams) {
      await writeFile(d.file, acceptChanges(d.text, processes));
      console.log(`accepted ${path.relative(projectRoot, d.file)}`);
    }

  } else if (command === 'generate' || command === 'update') {
    if (describedDiagrams(project).length === 0)
      throw new Error(`No diagrams are described in ${project.config.architectureFolder || DEFAULT_ARCHITECTURE_FOLDER}.`);
    const changes = planDiagrams(project, { update: command === 'update' });
    for (const c of changes) {
      await mkdir(path.dirname(c.file), { recursive: true });
      await writeFile(c.file, c.text);
      console.log(`${c.created ? 'created' : 'updated'} ${path.relative(projectRoot, c.file)}`);
    }
    if (changes.length === 0) console.log('The diagrams are up to date.');

  } else if (command === 'render') {
    const at = rest.indexOf('--chrome');
    const chrome = at >= 0 ? rest[at + 1] : '/usr/bin/google-chrome';
    const known = project.processes ? [...readProcesses(project.processes.text, idPattern(project.config)).keys()] : undefined;
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: chrome });
    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 });
      await page.goto(`file://${path.join(__dirname, 'render.html')}`);
      for (const d of project.diagrams) {
        await page.evaluate(([text, ids]) => window.renderDiagram(text as string, ids as string[] | undefined), [d.text, known] as const);
        const file = d.file.replace(/\.diagram\.json$/, '.png');
        await page.locator('#canvas').screenshot({ path: file });
        console.log(`rendered ${path.relative(projectRoot, file)}`);
      }
    } finally {
      await browser.close();
    }

  } else {
    console.log('Usage: gsdiagram check|render|accept|generate|update <project> [--chrome <path>]');
    process.exitCode = 2;
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
