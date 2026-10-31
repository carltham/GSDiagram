// Starts a test instance of VS Code with the extension and the fixture project, and runs the suite in it.

import path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main() {
  // Started from a terminal inside VS Code, the test instance would inherit this and start as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE;
  const root = path.resolve(__dirname, '../../..');
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(__dirname, 'suite.js'),
    launchArgs: [path.join(root, 'test/fixture'), '--disable-extensions', '--disable-workspace-trust'],
  });
}

main().catch(e => { console.error(e); process.exit(1); });
