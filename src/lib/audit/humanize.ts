import type { AuditAction } from '@prisma/client';
import { formatRub } from '@/lib/format';
import { m } from '@/domain/finance/money';

export interface HumanAuditEntry {
  id: string;
  when: Date;
  who: string;
  /** A plain sentence — never raw JSON (ТЗ §32). */
  sentence: string;
  /** Optional "before → after" line for value changes. */
  change: string | null;
  action: AuditAction;
}

interface RawAudit {
  id: string;
  actorName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  projectId: string | null;
  before: unknown;
  after: unknown;
  changedFields: string[];
  createdAt: Date;
}

const val = (o: unknown, key: string): string | undefined => {
  if (o && typeof o === 'object' && key in o) {
    const v = (o as Record<string, unknown>)[key];
    return v === null || v === undefined ? undefined : String(v);
  }
  return undefined;
};

function money(s: string | undefined): string {
  if (s === undefined) return '—';
  try {
    return formatRub(m(s));
  } catch {
    return s;
  }
}

const FIELD_LABEL: Record<string, string> = {
  name: 'название',
  status: 'статус',
  clientName: 'клиент',
  startDate: 'дата начала',
  endDate: 'дата окончания',
  description: 'описание',
  amount: 'сумму',
  supportHoursLimit: 'пакет часов в месяц',
  supportMonthlyFee: 'абонентскую плату',
  supportHourRate: 'цену часа',
  sourceType: 'связь с Битрикс24',
  crmEntityTitle: 'связь с Битрикс24',
  crmEntityId: 'связь с Битрикс24',
  crmEntityTypeId: 'связь с Битрикс24',
};

export function humanizeAudit(row: RawAudit, projectName?: string): HumanAuditEntry {
  // Names may already carry «…»; don't double-wrap.
  const p = projectName
    ? /[«»„"]/.test(projectName)
      ? projectName
      : `«${projectName}»`
    : 'проекта';
  let sentence: string;
  let change: string | null = null;

  if (row.entityType === 'MARKETING_SPEND' || row.entityType === 'MARKETING_PLAN') {
    return { id: row.id, when: row.createdAt, who: row.actorName, action: row.action, ...marketingSentence(row) };
  }

  switch (row.action) {
    case 'PROJECT_CREATED':
      sentence = `создал проект ${projectName ? p : ''}`.trim();
      break;
    case 'PROJECT_UPDATED': {
      const fields = [...new Set(row.changedFields.map((f) => FIELD_LABEL[f] ?? f))];
      sentence = `изменил ${fields.length ? fields.join(', ') : 'данные'} проекта ${p}`;
      if (row.changedFields.includes('name')) {
        change = `${val(row.before, 'name') ?? '—'} → ${val(row.after, 'name') ?? '—'}`;
      }
      break;
    }
    case 'PROJECT_ARCHIVED':
      sentence = `отправил проект ${p} в архив`;
      break;
    case 'PROJECT_RESTORED':
      sentence = `вернул проект ${p} из архива`;
      break;
    case 'PROJECT_DELETED': {
      // The project row is gone, so its name comes from the snapshot.
      const name = projectName ? p : val(row.before, 'name');
      sentence = `удалил проект ${name ? (projectName ? name : `«${name}»`) : ''}`.trim();
      break;
    }
    case 'FINANCE_CREATED': {
      const dir = val(row.after, 'direction') === 'INCOME' ? 'доход' : 'расход';
      sentence = `добавил ${dir} по проекту ${p}`;
      change = money(val(row.after, 'amount'));
      break;
    }
    case 'FINANCE_UPDATED': {
      const dir = val(row.after, 'direction') === 'INCOME' ? 'доход' : 'расход';
      sentence = `изменил ${dir} проекта ${p}`;
      change = `${money(val(row.before, 'amount'))} → ${money(val(row.after, 'amount'))}`;
      break;
    }
    case 'FINANCE_DELETED': {
      const dir = val(row.before, 'direction') === 'INCOME' ? 'доход' : 'расход';
      sentence = `удалил ${dir} ${money(val(row.before, 'amount'))} по проекту ${p}`;
      break;
    }
    case 'CATEGORY_CREATED':
      sentence = `создал статью «${val(row.after, 'name') ?? ''}»`;
      break;
    case 'CATEGORY_UPDATED':
      sentence = val(row.after, 'deleted')
        ? `удалил статью «${val(row.before, 'name') ?? ''}»`
        : `изменил статью «${val(row.after, 'name') ?? val(row.before, 'name') ?? ''}»`;
      break;
    case 'CATEGORY_ARCHIVED':
      sentence = `архивировал статью «${val(row.before, 'name') ?? ''}»`;
      break;
    case 'USER_ROLE_CHANGED':
      sentence = `изменил роль сотрудника`;
      change = `${val(row.before, 'role') ?? '—'} → ${val(row.after, 'role') ?? '—'}`;
      break;
    case 'PROJECT_MEMBER_ADDED':
      sentence = `добавил сотрудника в проект ${p}`;
      break;
    case 'PROJECT_MEMBER_REMOVED':
      sentence = `убрал сотрудника из проекта ${p}`;
      break;
    default:
      sentence = `выполнил действие в проекте ${p}`;
  }

  return {
    id: row.id,
    when: row.createdAt,
    who: row.actorName,
    sentence,
    change,
    action: row.action,
  };
}

/** Marketing spend and plan (ADR-048): no project, a channel and a month instead. */
function marketingSentence(row: RawAudit): { sentence: string; change: string | null } {
  if (row.entityType === 'MARKETING_PLAN') {
    const month = val(row.after, 'month') ?? val(row.before, 'month') ?? '';
    return {
      sentence: `${row.action === 'FINANCE_CREATED' ? 'задал' : 'изменил'} маркетинговый план на ${month}`,
      change: row.action === 'FINANCE_UPDATED' ? `${money(val(row.before, 'amount'))} → ${money(val(row.after, 'amount'))}` : money(val(row.after, 'amount')),
    };
  }
  const deleted = row.action === 'FINANCE_DELETED';
  const snap = deleted ? row.before : row.after;
  const what = val(snap, 'kind') === 'PAID' ? 'оплату канала' : 'расход на маркетинг';
  const channel = val(snap, 'channel') ?? val(snap, 'sourceId');
  return {
    sentence: `${deleted ? 'удалил' : 'добавил'} ${what}${channel ? ` «${channel}»` : ''}`,
    change: money(val(snap, 'amount')),
  };
}
