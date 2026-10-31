// A fresh VS Code, on a fresh copy of the fixture project, for every test.

import { test as base } from '@playwright/test';
import { VSCode } from './vscode';

export const test = base.extend<{ vscode: VSCode }>({
  vscode: async ({}, use, testInfo) => {
    const vscode = await VSCode.launch();
    try {
      await use(vscode);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus)
        await testInfo.attach('window', { body: await vscode.page.screenshot().catch(() => Buffer.alloc(0)), contentType: 'image/png' });
      await vscode.close();
    }
  },
});

export { expect } from '@playwright/test';
