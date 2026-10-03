import fs from 'node:fs';
import path from 'node:path';

import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

import { signedInStorageState } from './signedInClerk.js';
import { expectSignedInShell } from './signedInShell.js';

setup('sign in', async ({ page }) => {
  const email = process.env.E2E_CLERK_USER_EMAIL?.trim() ?? '';
  if (!email) throw new Error('E2E_CLERK_USER_EMAIL is required for signed-in Playwright.');

  await clerkSetup();
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: email });
  await expectSignedInShell(page);
  fs.mkdirSync(path.dirname(signedInStorageState), { recursive: true });
  await page.context().storageState({ path: signedInStorageState });
});
