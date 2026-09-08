import { test, expect } from '@playwright/test';

test('app boots and shows the title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Экономика проектов' })).toBeVisible();
});
