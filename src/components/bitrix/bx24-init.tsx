'use client';

import * as React from 'react';
import { useSession } from '@/lib/client/session';
import {
  setFrameFitted,
  settledBand,
  useFrameFitted,
  useViewportBand,
} from '@/lib/client/viewport-band';

interface ScrollSize {
  scrollWidth: number;
  scrollHeight: number;
}

interface BX24Api {
  init: (cb: () => void) => void;
  fitWindow?: (cb?: () => void) => void;
  getScrollSize?: () => ScrollSize;
}

declare global {
  interface Window {
    BX24?: BX24Api;
  }
}

const SCRIPT_ID = 'bx24-js-sdk';
/** Narrower or shorter than this, the frame is left to the old stretched mode. */
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;

/**
 * Sets the frame's height and leaves its width to the portal.
 *
 * Not `BX24.resizeWindow`: it runs both sizes through `parseInt`, so the only way to keep the
 * width fluid ('100%') turns into 100 px and squeezed the app into a narrow column on a real
 * portal (#39). `BX24.fitWindow()` is the one call that sends `width: '100%'`; it takes the
 * height from `BX24.getScrollSize()`, which is swapped for the call to return the height we
 * want.
 */
function resize(bx: BX24Api, height: number): Promise<void> {
  return new Promise((resolve) => {
    const original = bx.getScrollSize;
    bx.getScrollSize = () => ({
      scrollWidth: original?.().scrollWidth ?? document.documentElement.scrollWidth,
      scrollHeight: Math.round(height),
    });
    try {
      bx.fitWindow!(() => resolve());
    } finally {
      bx.getScrollSize = original;
    }
    // Not every portal version calls back; the band settles either way.
    setTimeout(resolve, 300);
  });
}

/**
 * Sizes the iframe to the part of the portal window below its top (ADR-068): first tall
 * enough to reach past the bottom of any screen, then down to the slice that is actually on
 * screen. The portal page then has nothing to scroll and the app scrolls inside itself.
 * Gives up (and the caller stretches the frame as before) when the frame is narrow, when the
 * slice can't be measured, or when the frame turns out narrower after resizing.
 */
async function fitFrame(bx: BX24Api): Promise<boolean> {
  if (!bx.fitWindow || !bx.getScrollSize) return false;
  const width = window.innerWidth;
  if (width < MIN_WIDTH) return false;
  await resize(bx, Math.max(window.screen?.availHeight ?? 0, 1200));
  const b = await settledBand();
  if (!b || b.height < MIN_HEIGHT || window.innerWidth < Math.min(width, MIN_WIDTH)) return false;
  await resize(bx, b.height);
  // The width must not have changed: if the portal squeezed the frame, undo.
  if (window.innerWidth < width - 40) return false;
  return true;
}

/**
 * Bitrix24 overlays the iframe with an "app failed to load" error a few seconds after
 * opening it unless the app calls BX24.init() — that's the required embed handshake,
 * not something Bitrix infers from a successful page render. Skipped in demo mode:
 * there's no Bitrix parent frame to talk to outside a real portal install.
 */
export function Bx24Init() {
  const { session } = useSession();
  const loaded = session != null;
  const isRealPortal = loaded && !session.demo;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Waits for the session, so the page has its content when the frame is sized. A page that
    // already has BX24 (a test harness) is treated like a portal too.
    if (!loaded || (!isRealPortal && !window.BX24)) return;
    const onInit = () => {
      const bx = window.BX24;
      if (!bx) return;
      void fitFrame(bx).then((ok) => {
        if (ok) {
          setFrameFitted(true);
          setReady(true);
        } else bx.fitWindow?.();
      });
    };
    if (window.BX24) {
      window.BX24.init(onInit);
      return;
    }
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://api.bitrix24.com/api/v1/';
    script.async = true;
    script.onload = () => window.BX24?.init(onInit);
    document.head.appendChild(script);
  }, [loaded, isRealPortal]);

  return ready ? <KeepFitted /> : null;
}

/**
 * Keeps the frame fitted: shrinks it when part of it falls off screen (the portal window got
 * shorter) and fits it again from scratch after the window is resized.
 */
function KeepFitted() {
  const band = useViewportBand();
  const fitted = useFrameFitted();
  const busy = React.useRef(false);

  const refit = React.useCallback(() => {
    const bx = window.BX24;
    if (!bx || busy.current) return;
    busy.current = true;
    void fitFrame(bx)
      .then((ok) => {
        // Could not fit any more (the window got narrow): back to the stretched frame.
        if (!ok) {
          setFrameFitted(false);
          bx.fitWindow?.();
        }
      })
      .finally(() => {
        busy.current = false;
      });
  }, []);

  React.useEffect(() => {
    const bx = window.BX24;
    if (!fitted || !bx?.fitWindow || !band || busy.current) return;
    if (band.top < 2 && band.height >= MIN_HEIGHT && band.height < window.innerHeight - 4) {
      busy.current = true;
      void resize(bx, band.height).finally(() => {
        busy.current = false;
      });
    }
  }, [band, fitted]);

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(refit, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(t);
    };
  }, [refit]);

  return null;
}
