'use client';

import * as React from 'react';
import { useSession } from '@/lib/client/session';
import { setFrameFitted, settledBand, useViewportBand } from '@/lib/client/viewport-band';

interface BX24Api {
  init: (cb: () => void) => void;
  fitWindow?: () => void;
  resizeWindow?: (width: number | string, height: number, cb?: () => void) => void;
}

declare global {
  interface Window {
    BX24?: BX24Api;
  }
}

const SCRIPT_ID = 'bx24-js-sdk';
const MIN_HEIGHT = 420;

function resize(bx: BX24Api, height: number): Promise<void> {
  return new Promise((resolve) => {
    // '100%' as BX24.fitWindow() sends it: the frame keeps following the portal's width.
    bx.resizeWindow!('100%', Math.round(height), () => resolve());
    // Not every portal version calls back; the band settles either way.
    setTimeout(resolve, 300);
  });
}

/**
 * Sizes the iframe to the part of the portal window below its top (ADR-068): first tall
 * enough to reach past the bottom of any screen, then down to the slice that is actually on
 * screen. The portal page then has nothing to scroll and the app scrolls inside itself.
 */
async function fitFrame(bx: BX24Api): Promise<boolean> {
  if (!bx.resizeWindow) return false;
  await resize(bx, Math.max(window.screen?.availHeight ?? 0, 1200));
  const b = await settledBand();
  if (!b || b.height < MIN_HEIGHT / 2) return false;
  await resize(bx, Math.max(MIN_HEIGHT, b.height));
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
  const isRealPortal = session != null && !session.demo;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // A page that already has BX24 (a test harness) is treated like a portal too.
    if (!isRealPortal && !window.BX24) return;
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
  }, [isRealPortal]);

  return ready ? <KeepFitted /> : null;
}

/**
 * Keeps the frame fitted: shrinks it when part of it falls off screen (the portal window got
 * shorter) and fits it again from scratch after the window is resized.
 */
function KeepFitted() {
  const band = useViewportBand();
  const busy = React.useRef(false);

  const refit = React.useCallback(() => {
    const bx = window.BX24;
    if (!bx || busy.current) return;
    busy.current = true;
    void fitFrame(bx).finally(() => {
      busy.current = false;
    });
  }, []);

  React.useEffect(() => {
    const bx = window.BX24;
    if (!bx?.resizeWindow || !band || busy.current) return;
    if (band.top < 2 && band.height >= MIN_HEIGHT && band.height < window.innerHeight - 4) {
      busy.current = true;
      void resize(bx, band.height).finally(() => {
        busy.current = false;
      });
    }
  }, [band]);

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
