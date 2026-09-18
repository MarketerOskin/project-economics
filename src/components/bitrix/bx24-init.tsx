'use client';

import * as React from 'react';
import { useSession } from '@/lib/client/session';

declare global {
  interface Window {
    BX24?: { init: (cb: () => void) => void; fitWindow?: () => void };
  }
}

const SCRIPT_ID = 'bx24-js-sdk';

/**
 * Bitrix24 overlays the iframe with an "app failed to load" error a few seconds after
 * opening it unless the app calls BX24.init() — that's the required embed handshake,
 * not something Bitrix infers from a successful page render. Skipped in demo mode:
 * there's no Bitrix parent frame to talk to outside a real portal install.
 */
export function Bx24Init() {
  const { session } = useSession();
  const isRealPortal = session != null && !session.demo;

  React.useEffect(() => {
    if (!isRealPortal) return;
    if (window.BX24) {
      window.BX24.init(() => window.BX24?.fitWindow?.());
      return;
    }
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://api.bitrix24.com/api/v1/';
    script.async = true;
    script.onload = () => window.BX24?.init(() => window.BX24?.fitWindow?.());
    document.head.appendChild(script);
  }, [isRealPortal]);

  return null;
}
