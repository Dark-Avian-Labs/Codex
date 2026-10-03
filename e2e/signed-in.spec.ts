import { expect, test } from '@playwright/test';

import { expectSignedInShell } from './signedInShell.js';

test('signed-in shell shows logout', async ({ page }) => {
  await expectSignedInShell(page);
});

test('created account is still there after reload', async ({ page }) => {
  const name = 'E2E Main';
  await page.goto('/wor');
  await expect(page.getByRole('button', { name: 'Game Accounts' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Game Accounts' }).click();
  await page.getByLabel('Account name').fill(name);
  await page.getByRole('button', { name: 'Add Account' }).click();
  const accountButton = page.getByRole('button', { name: 'Select Watcher of Realms account' });
  await expect(accountButton).toHaveText(name);
  await page.reload();
  await expect(accountButton).toHaveText(name);
});
