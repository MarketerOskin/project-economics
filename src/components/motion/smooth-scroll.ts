'use client';

import * as React from 'react';
import Lenis from 'lenis';

/**
 * Inertial wheel scrolling for the page area, as on a MacBook trackpad (Lenis, ADR-067).
 *
 * Only on a desktop with a mouse or trackpad, outside the Bitrix24 iframe (there the portal
 * page scrolls, not ours) and when the OS does not ask to reduce motion. Touch keeps native
 * scrolling. Anything that scrolls on its own inside the page — wide tables, chip rows,
 * textareas — keeps its own scroll (`allowNestedScroll`), and `data-lenis-prevent` opts an
 * element out by hand. Dialogs and menus are portaled outside the page, so Lenis never sees them.
 */
export function useSmoothScroll(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [lenis, setLenis] = React.useState<Lenis | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const media = window.matchMedia(
      '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    let instance: Lenis | null = null;
    const sync = () => {
      if (media.matches && !instance) {
        instance = new Lenis({
          wrapper: el,
          content: el,
          autoRaf: true,
          lerp: 0.1,
          wheelMultiplier: 1,
          allowNestedScroll: true,
        });
        setLenis(instance);
      } else if (!media.matches && instance) {
        instance.destroy();
        instance = null;
        setLenis(null);
      }
    };
    sync();
    media.addEventListener('change', sync);
    return () => {
      media.removeEventListener('change', sync);
      instance?.destroy();
      setLenis(null);
    };
  }, [ref, enabled]);

  return lenis;
}
