/**
 * App sections a portal can switch off in «Настройка под портал» (ADR-041). Projects,
 * finance and settings are the core and always stay. Hiding is about a tidy menu, not
 * access: permissions are still checked on every request.
 */
export const OPTIONAL_SECTIONS = [
  {
    key: 'analytics',
    href: '/analytics',
    label: 'Аналитика',
    description: 'Задачи, часы и встречи по проектам',
  },
  {
    key: 'automation',
    href: '/automation',
    label: 'Автоматизация',
    description: 'Расходы по часам и доход из CRM',
  },
  {
    key: 'sales',
    href: '/sales-funnels',
    label: 'Продажи и обращения',
    description: 'Воронки сделок, лиды и смарт-процессы продаж',
  },
  { key: 'history', href: '/history', label: 'История', description: 'Журнал изменений' },
] as const;

export type SectionKey = (typeof OPTIONAL_SECTIONS)[number]['key'];

export const SECTION_KEYS = OPTIONAL_SECTIONS.map((s) => s.key) as SectionKey[];

/** The section a path belongs to, if it is one that can be switched off. */
export function sectionOfPath(pathname: string): SectionKey | null {
  return (
    OPTIONAL_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))?.key ??
    null
  );
}

/** What each CRM section is for on the portal (ADR-041). */
export const CRM_ROLES = [
  {
    value: 'TRAFFIC',
    label: 'Обращения и трафик',
    hint: 'Все входящие заявки: считаем, сколько пришло и сколько дошло до продажи',
  },
  {
    value: 'SALES',
    label: 'Продажи',
    hint: 'Первичные касания и сделки: воронки, выигрыш и проигрыш',
  },
  {
    value: 'SUPPORT',
    label: 'Поддержка клиентов',
    hint: 'Обращения клиентов на поддержке: из них берутся время и заявки по проекту',
  },
  {
    value: 'PROJECTS',
    label: 'Проекты и работы',
    hint: 'Сами проекты или работы по ним: их можно выбрать при создании проекта',
  },
  { value: 'IGNORE', label: 'Не использовать', hint: 'Приложение не показывает этот раздел' },
] as const;

export type CrmRoleValue = (typeof CRM_ROLES)[number]['value'];
