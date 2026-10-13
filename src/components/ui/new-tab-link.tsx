'use client';

import * as React from 'react';
import { readToken } from '@/lib/client/token-bridge';

/**
 * A link to one of our own pages that opens in a new browser tab. Inside the Bitrix24 iframe
 * the session cookie is partitioned under the portal's site (or blocked outright), so a fresh
 * top-level tab has no session and lands on the public /contact page. When this tab runs on
 * the bridged token (ADR-024), hand it over in `?pe_token=`: proxy.ts signs the new tab in
 * and the token bridge scrubs it from the address bar.
 */
export function NewTabLink({
  href,
  onClick,
  ...props
}: React.ComponentProps<'a'> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener"
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        const token = readToken();
        if (!token) return;
        e.preventDefault();
        const url = new URL(href, window.location.origin);
        url.searchParams.set('pe_token', token);
        window.open(url.toString(), '_blank', 'noopener');
      }}
    />
  );
}
