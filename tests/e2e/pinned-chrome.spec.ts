import { test, expect, type Page } from '@playwright/test';

// The side menu and the top bar stay put on desktop: only the page area scrolls (ADR-068).

/** The top bar appears once the session has loaded. */
async function ready(page: Page) {
  await page.waitForFunction(
    () => (document.querySelector('main')?.previousElementSibling?.clientWidth ?? 0) > 0,
  );
}

async function chromeRects(page: Page) {
  return page.evaluate(() => {
    const menu = document.querySelector('aside > div')!.getBoundingClientRect();
    const bar = document.querySelector('main')!.previousElementSibling!.getBoundingClientRect();
    return {
      menu: [menu.top, menu.left, menu.height],
      bar: [bar.top, bar.left],
      page: document.scrollingElement!.scrollTop,
    };
  });
}

for (const width of [1280, 1920]) {
  test(`menu and top bar do not move while the page scrolls (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/finance');
    await ready(page);
    const before = await chromeRects(page);

    await page.mouse.move(width - 300, 500);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(60);
      expect(await chromeRects(page)).toEqual(before);
    }
    // Wheeling over the menu does not drag the page either.
    await page.mouse.move(120, 500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(800);
    expect(await chromeRects(page)).toEqual(before);
    expect(await page.evaluate(() => document.querySelector('main')!.scrollTop)).toBeGreaterThan(0);
  });
}

test('the page itself never rubber-bands outside Bitrix24', async ({ page }) => {
  await page.goto('/finance');
  await page.locator('main').waitFor();
  const overscroll = await page.evaluate(() => [
    getComputedStyle(document.documentElement).overscrollBehaviorY,
    getComputedStyle(document.body).overscrollBehaviorY,
  ]);
  expect(overscroll).toEqual(['none', 'none']);
});

test('inside a stretched iframe the menu stays in the visible slice', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  // A stand-in for the portal page: 120 px of portal chrome, then the app stretched to its
  // full height the way BX24.fitWindow() does.
  await page.route(`${baseURL}/__portal`, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<body style="margin:0"><div style="height:120px"></div><iframe id="app" src="/finance" style="display:block;width:100%;height:4000px;border:0"></iframe></body>',
    }),
  );
  await page.goto('/__portal');
  const app = page.frameLocator('#app');
  await app.locator('aside > div').waitFor();
  const frame = page.frames()[1]!;
  await page.waitForTimeout(500);

  const menuTopOnScreen = async () =>
    120 +
    (await frame.evaluate(
      () => document.querySelector('aside > div')!.getBoundingClientRect().top,
    )) -
    (await page.evaluate(() => scrollY));

  await page.mouse.move(900, 400);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
  }
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await expect.poll(menuTopOnScreen).toBe(16);
});

test('on a portal the frame is fitted to the screen and only the page area scrolls', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  // A stand-in for BX24 inside the app's frame: resizeWindow sets the iframe's height.
  await page.addInitScript(() => {
    if (window === window.top) return;
    const frame = () => window.frameElement as HTMLIFrameElement;
    (window as unknown as { BX24: unknown }).BX24 = {
      init: (cb: () => void) => cb(),
      resizeWindow: (_w: unknown, h: number, cb?: () => void) => {
        frame().style.height = `${h}px`;
        cb?.();
      },
      fitWindow: () => {
        frame().style.height = `${document.documentElement.scrollHeight}px`;
      },
    };
  });
  await page.route(`${baseURL}/__portal`, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<body style="margin:0"><div style="height:120px"></div><iframe id="app" src="/finance" style="display:block;width:100%;height:600px;border:0"></iframe><div style="height:40px"></div></body>',
    }),
  );
  await page.goto('/__portal');
  const frame = page.frames()[1]!;
  await expect
    .poll(() => page.evaluate(() => document.getElementById('app')!.getBoundingClientRect().height))
    .toBe(680);
  await frame.waitForFunction(
    () => (document.querySelector('main')?.previousElementSibling?.clientWidth ?? 0) > 0,
  );

  const rects = () =>
    frame.evaluate(() => ({
      menu: document.querySelector('aside > div')!.getBoundingClientRect().top,
      bar: document.querySelector('main')!.previousElementSibling!.getBoundingClientRect().top,
      portal: window.parent.scrollY,
    }));
  const before = await rects();
  await page.mouse.move(900, 500);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(80);
    expect(await rects()).toEqual(before);
  }
  await page.waitForTimeout(800);
  expect(await rects()).toEqual(before);
  expect(await frame.evaluate(() => document.querySelector('main')!.scrollTop)).toBeGreaterThan(0);
  expect(before.portal).toBe(0);
  // Wheeling over the menu does not scroll the portal page either.
  await page.mouse.move(120, 500);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  expect(await rects()).toEqual(before);
});
