import { expect, type Page } from '@playwright/test';

export async function expectSignedInShell(page: Page): Promise<void> {
  await page.goto('/');
  await expect(async () => {
    const logout = page.getByRole('menuitem', { name: 'Logout' });
    if (!(await logout.isVisible())) {
      await page.getByRole('button', { name: 'Open user menu' }).click();
    }
    await expect(logout).toBeVisible();
  }).toPass();
}
