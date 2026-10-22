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

/**
 * A stand-in for the portal: 120 px of portal chrome, the app's iframe, a footer. Inside the
 * frame BX24 behaves like the real SDK (api.bitrix24.com/api/v1): `resizeWindow` runs both
 * sizes through parseInt, `fitWindow` sends `width: '100%'` and the height from
 * `getScrollSize()`; the "portal" applies what it is sent to the iframe, as Bitrix24 does.
 */
async function openPortal(page: Page, baseURL: string | undefined, frameWidth = '100%') {
  await page.addInitScript(() => {
    if (window === window.top) return;
    const apply = (size: { width: number | string; height: number }) => {
      const f = window.frameElement as HTMLIFrameElement;
      f.style.width = typeof size.width === 'number' ? `${size.width}px` : size.width;
      f.style.height = `${size.height}px`;
    };
    const bx = {
      init: (cb: () => void) => cb(),
      getScrollSize: () => ({
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.documentElement.offsetWidth,
        ),
        scrollHeight: Math.max(
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight,
        ),
      }),
      resizeWindow: (w: unknown, h: unknown, cb?: () => void) => {
        const width = parseInt(String(w));
        const height = parseInt(String(h));
        if (width > 0 && height > 0) apply({ width, height });
        cb?.();
      },
      fitWindow: (cb?: () => void) => {
        apply({ width: '100%', height: bx.getScrollSize().scrollHeight });
        cb?.();
      },
    };
    (window as unknown as { BX24: typeof bx }).BX24 = bx;
  });
  await page.route(`${baseURL}/__portal`, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<body style="margin:0"><div style="height:120px"></div><iframe id="app" src="/finance" style="display:block;width:${frameWidth};height:600px;border:0"></iframe><div style="height:40px"></div></body>`,
    }),
  );
  await page.goto('/__portal');
  return page.frames()[1]!;
}

const frameBox = (page: Page) =>
  page.evaluate(() => {
    const r = document.getElementById('app')!.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });

test('on a portal the frame is fitted to the screen and only the page area scrolls', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const frame = await openPortal(page, baseURL);
  await expect.poll(async () => (await frameBox(page)).height).toBe(680);
  // The width stays the portal's: #39 squeezed the app into a 100 px column.
  expect((await frameBox(page)).width).toBe(1440);
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

  // A wider window: fitted again, still full width.
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(async () => (await frameBox(page)).height).toBe(780);
  expect((await frameBox(page)).width).toBe(1600);
});

test('a narrow portal frame is left stretched as before, never squeezed', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 560, height: 800 });
  await openPortal(page, baseURL);
  // Stretched to the content (taller than the screen) and as wide as the portal.
  await expect.poll(async () => (await frameBox(page)).height).toBeGreaterThan(1000);
  expect((await frameBox(page)).width).toBe(560);
});
