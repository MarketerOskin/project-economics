import { redactTokens } from '@/lib/bitrix/crypto';
import { upstream } from '@/lib/errors';

export interface BugReportInput {
  description: string;
  portalDomain: string;
  authorName: string;
  pageUrl?: string;
}

interface BitrixError {
  error: string;
  error_description?: string;
}

function isBitrixError(v: unknown): v is BitrixError {
  return Boolean(v) && typeof v === 'object' && 'error' in (v as object);
}

/**
 * Reports a bug from a customer portal into the DEVELOPER's own Bitrix24 CRM, as a lead —
 * via a fixed incoming webhook (SUPPORT_BITRIX_WEBHOOK_URL), unrelated to the per-customer
 * OAuth client in src/lib/bitrix/. No portal record, no stored token: one webhook, one call.
 */
export async function reportBug(input: BugReportInput): Promise<void> {
  const base = process.env.SUPPORT_BITRIX_WEBHOOK_URL;
  if (!base) throw upstream('Отправка отчётов временно недоступна.');

  const comments = [
    input.description,
    '',
    `Портал: ${input.portalDomain}`,
    `Автор: ${input.authorName}`,
    input.pageUrl ? `Страница: ${input.pageUrl}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const body = new URLSearchParams();
  body.append('fields[TITLE]', `Баг-репорт: ${input.portalDomain}`);
  body.append('fields[COMMENTS]', comments);
  body.append('fields[SOURCE_ID]', 'OTHER');

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/+$/, '')}/crm.lead.add.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw upstream(redactTokens(`Не удалось отправить отчёт: ${err instanceof Error ? err.message : ''}`));
  }

  const json = (await res.json()) as { result?: number } | BitrixError;
  if (isBitrixError(json)) {
    throw upstream(redactTokens(json.error_description || json.error));
  }
}
