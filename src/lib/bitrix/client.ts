import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { upstream } from '@/lib/errors';
import { decryptToken, encryptToken, redactTokens } from './crypto';
import type { BitrixTokenSet } from './types';

interface BitrixError {
  error: string;
  error_description?: string;
}

function isBitrixError(v: unknown): v is BitrixError {
  return Boolean(v) && typeof v === 'object' && 'error' in (v as object);
}

function restBase(portal: PortalInstallation): string {
  if (portal.restEndpoint) return portal.restEndpoint.replace(/\/$/, '');
  return `https://${portal.domain}/rest`;
}

async function refreshAccessToken(portal: PortalInstallation): Promise<string> {
  if (!portal.refreshTokenEnc) throw upstream('Нет refresh-токена Bitrix24 — переустановите приложение');
  const clientId = process.env.B24_CLIENT_ID;
  const clientSecret = process.env.B24_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw upstream('B24_CLIENT_ID / B24_CLIENT_SECRET не заданы');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptToken(portal.refreshTokenEnc),
  });

  const res = await fetch(`https://oauth.bitrix.info/oauth/token/?${params}`);
  const json = (await res.json()) as BitrixTokenSet & Partial<BitrixError>;
  if (!res.ok || !json.access_token) {
    throw upstream('Не удалось обновить токен Bitrix24');
  }

  await db.portalInstallation.update({
    where: { id: portal.id },
    data: {
      authTokenEnc: encryptToken(json.access_token),
      refreshTokenEnc: encryptToken(json.refresh_token),
      tokenExpiresAt: new Date(Date.now() + json.expires_in * 1000),
    },
  });
  return json.access_token;
}

/**
 * Call a Bitrix24 REST method with an explicit access token (e.g. the short-lived
 * per-user token from a placement request). No refresh, no persistence — one shot.
 */
export async function callBitrixWithToken<T = unknown>(
  portal: Pick<PortalInstallation, 'domain' | 'restEndpoint'>,
  accessToken: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const body = new URLSearchParams();
  const flatten = (prefix: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((v, i) => flatten(`${prefix}[${i}]`, v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) flatten(`${prefix}[${k}]`, v);
    else body.append(prefix, String(value));
  };
  for (const [k, v] of Object.entries(params)) flatten(k, v);
  body.append('auth', accessToken);

  let res: Response;
  try {
    res = await fetch(`${restBase(portal as PortalInstallation)}/${method}.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw upstream(redactTokens(`Сеть недоступна: ${err instanceof Error ? err.message : ''}`));
  }
  const json = (await res.json()) as { result?: T } | BitrixError;
  if (isBitrixError(json)) throw upstream(redactTokens(json.error_description || json.error));
  return json.result as T;
}

/**
 * Call a Bitrix24 REST method. Injects the (decrypted) portal access token, refreshes
 * once on `expired_token` and retries. Never logs a token (redactTokens on any error text).
 */
export async function callBitrix<T = unknown>(
  portal: PortalInstallation,
  method: string,
  params: Record<string, unknown> = {},
  _retried = false,
): Promise<T> {
  if (!portal.authTokenEnc) throw upstream('Bitrix24 не подключён к этому порталу');
  const accessToken = decryptToken(portal.authTokenEnc);

  const body = new URLSearchParams();
  const flatten = (prefix: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => flatten(`${prefix}[${i}]`, v));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) flatten(`${prefix}[${k}]`, v);
    } else {
      body.append(prefix, String(value));
    }
  };
  for (const [k, v] of Object.entries(params)) flatten(k, v);
  body.append('auth', accessToken);

  let res: Response;
  try {
    res = await fetch(`${restBase(portal)}/${method}.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw upstream(redactTokens(`Сеть недоступна: ${err instanceof Error ? err.message : ''}`));
  }

  const json = (await res.json()) as { result?: T } | BitrixError;

  if (isBitrixError(json)) {
    if (json.error === 'expired_token' && !_retried) {
      const fresh = await db.portalInstallation.findUnique({ where: { id: portal.id } });
      if (fresh) {
        await refreshAccessToken(fresh);
        const reloaded = await db.portalInstallation.findUnique({ where: { id: portal.id } });
        if (reloaded) return callBitrix<T>(reloaded, method, params, true);
      }
    }
    throw upstream(redactTokens(json.error_description || json.error));
  }

  return json.result as T;
}

/** Batch up to 50 calls in one HTTP request (ТЗ hint via §53 mass ops). */
export async function batchBitrix(
  portal: PortalInstallation,
  calls: Record<string, { method: string; params?: Record<string, unknown> }>,
): Promise<Record<string, unknown>> {
  const cmd: Record<string, string> = {};
  for (const [key, { method, params }] of Object.entries(calls)) {
    const qs = new URLSearchParams();
    const flat = (p: string, v: unknown) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'object') for (const [k, vv] of Object.entries(v)) flat(`${p}[${k}]`, vv);
      else qs.append(p, String(v));
    };
    for (const [k, v] of Object.entries(params ?? {})) flat(k, v);
    cmd[key] = `${method}?${qs.toString()}`;
  }
  const result = await callBitrix<{ result: Record<string, unknown> }>(portal, 'batch', { cmd });
  return result.result;
}
