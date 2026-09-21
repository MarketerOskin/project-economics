import { db } from '@/lib/db/client';
import { redactTokens } from './crypto';

/** Bitrix24 Marketplace requires server-side REST call logs for at least 3 days. */
export const API_LOG_RETENTION_DAYS = 7;

const MAX_FIELD = 4000;
const PURGE_EVERY_MS = 60 * 60 * 1000;
let lastPurgeAt = 0;

function clip(value: unknown): string | null {
  if (value === undefined) return null;
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return null;
  }
  if (text === undefined) return null;
  const safe = redactTokens(text);
  return safe.length > MAX_FIELD ? `${safe.slice(0, MAX_FIELD)}…[truncated]` : safe;
}

export interface ApiCallEntry {
  portalId: string;
  method: string;
  params: Record<string, unknown>;
  response: unknown;
  ok: boolean;
  errorCode?: string;
  durationMs: number;
}

/**
 * Best-effort: a logging failure must never break the Bitrix call it describes. The auth
 * token is never in `params` (it is appended to the request body separately), and both
 * payloads pass through redactTokens as a second line of defence.
 */
export async function logApiCall(entry: ApiCallEntry): Promise<void> {
  try {
    await db.apiCallLog.create({
      data: {
        portalId: entry.portalId,
        method: entry.method,
        request: clip(entry.params),
        response: clip(entry.response),
        ok: entry.ok,
        errorCode: entry.errorCode ?? null,
        durationMs: Math.round(entry.durationMs),
      },
    });
    await purgeOldApiLogs();
  } catch {
    // Deliberately silent — see above.
  }
}

/** Runs at most once an hour per process; no cron needed. */
export async function purgeOldApiLogs(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastPurgeAt < PURGE_EVERY_MS) return 0;
  lastPurgeAt = now;
  const cutoff = new Date(now - API_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await db.apiCallLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
