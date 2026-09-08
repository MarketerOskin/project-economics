import { test, expect, type Page } from '@playwright/test';

/**
 * ТЗ §67 — full manager scenario, end to end, against demo mode.
 * login as demo MANAGER → create project → add member → plan income 1 000 000 →
 * fact income 900 000 → expense «Внешние программисты» 100 ч × 2 000 → AI expense 50 000 →
 * open project → check profit & margin → edit the expense → check KPI changed →
 * open history → see the change.
 */

test.setTimeout(150_000);

const uniqueName = `E2E Проект ${Date.now()}`;

async function loginAsManager(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Демо-режим')).toBeVisible();
  await page.locator('aside button', { hasText: 'Администратор' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Руководитель' }).click();
  await expect(page.locator('aside')).toContainText('Соколов', { timeout: 15_000 });
}

async function addEntryFromProject(
  page: Page,
  projectUrl: string,
  opts: {
    direction: 'Доход' | 'Расход';
    budget: 'План' | 'Факт';
    category: string;
    hoursRate?: { hours: string; rate: string };
    amount?: string;
  },
) {
  await page.goto(`${projectUrl}/finance`);
  await page.getByRole('button', { name: 'Операция' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('tab', { name: opts.direction, exact: true }).click();
  await dialog.getByRole('tab', { name: opts.budget, exact: true }).click();

  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: opts.category, exact: true }).click();

  if (opts.hoursRate) {
    await dialog.getByRole('tab', { name: 'Часы × ставка' }).click();
    await dialog.getByLabel('Количество часов').fill(opts.hoursRate.hours);
    await dialog.getByLabel('Стоимость часа').fill(opts.hoursRate.rate);
  } else {
    await dialog.getByLabel('Сумма').fill(opts.amount!);
  }

  await dialog.getByRole('button', { name: 'Добавить операцию' }).click();
  await expect(dialog).toBeHidden();
}

test('manager economics flow (ТЗ §67)', async ({ page }) => {
  await loginAsManager(page);

  // 2. create a project
  await page.goto('/projects/new');
  await page.getByLabel('Название').fill(uniqueName);

  // 3. add a member
  await page.getByRole('button', { name: 'Выберите сотрудников' }).click();
  await page.getByPlaceholder('Поиск').fill('Игорь');
  await page.getByRole('button', { name: /Игорь Лебедев/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Выбрано: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Создать проект' }).click();
  await page.waitForURL(/\/projects\/c[a-z0-9]{10,}$/);
  const projectUrl = page.url();
  await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();

  // 4–7. finance operations (project is preselected inside the project)
  await addEntryFromProject(page, projectUrl, {
    direction: 'Доход',
    budget: 'План',
    category: 'Доход',
    amount: '1000000',
  });
  await addEntryFromProject(page, projectUrl, {
    direction: 'Доход',
    budget: 'Факт',
    category: 'Доход',
    amount: '900000',
  });
  await addEntryFromProject(page, projectUrl, {
    direction: 'Расход',
    budget: 'Факт',
    category: 'Внешние программисты',
    hoursRate: { hours: '100', rate: '2000' },
  });
  await addEntryFromProject(page, projectUrl, {
    direction: 'Расход',
    budget: 'Факт',
    category: 'Расходы на ИИ',
    amount: '50000',
  });

  // 8–10. project overview — profit 650 000, margin ≈ 72,2 %
  await page.goto(projectUrl);
  await expect(page.getByText('Прибыль').first()).toBeVisible();
  await expect(page.locator('body')).toContainText('650 000');
  await expect(page.locator('body')).toContainText('72,2');

  // 11. edit the hourly expense: 100 ч → 120 ч
  await page.goto(`${projectUrl}/finance`);
  const row = page.locator('tr', { hasText: 'Внешние программисты' }).first();
  await row.locator('button').last().click();
  await page.getByRole('menuitem', { name: 'Редактировать' }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Количество часов').fill('120');
  await editDialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editDialog).toBeHidden();

  // 12. profit is now 900 000 − (240 000 + 50 000) = 610 000
  await page.goto(projectUrl);
  await expect(page.locator('body')).toContainText('610 000');

  // 13–14. history shows the change with a before → after value
  await page.goto(`${projectUrl}/history`);
  await expect(page.locator('body')).toContainText('изменил расход');
  await expect(page.locator('body')).toContainText('→');
});
