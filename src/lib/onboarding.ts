import type { PortalScope } from '@/lib/db/with-portal';

/**
 * First-run onboarding for a freshly installed (real, non-demo) portal. Three steps, five for
 * those who manage settings; each derived from real data — never a manually-ticked checkbox,
 * so it can't lie about where the portal actually is. Shown on the dashboard until dismissed
 * or all required steps are done.
 */
export interface OnboardingStep {
  key: 'setup' | 'project' | 'team' | 'entry' | 'time';
  label: string;
  description: string;
  href: string;
  done: boolean;
  /** Not every portal needs it; the checklist counts as complete without it. */
  optional?: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  complete: boolean;
}

/** `settings`: the viewer can change portal settings, so settings steps are shown to them. */
export async function getOnboardingProgress(
  scope: PortalScope,
  opts: { settings?: boolean; setupDone?: boolean } = {},
): Promise<OnboardingProgress> {
  const [projectCount, memberCount, entryCount, timeFields] = await Promise.all([
    scope.project.count(),
    scope.member.count(),
    scope.entry.count(),
    scope.crmTimeField.findMany(),
  ]);

  const steps: OnboardingStep[] = [
    {
      key: 'project',
      label: 'Создайте первый проект',
      description: 'Вручную или импортом сделки/компании из Bitrix24',
      href: '/projects/new',
      done: projectCount > 0,
    },
    {
      key: 'team',
      label: 'Добавьте команду',
      description: 'Сотрудники Bitrix24, которые будут видеть проект',
      href: '/projects',
      done: memberCount > 0,
    },
    {
      key: 'entry',
      label: 'Внесите первую операцию',
      description: 'Плановый или фактический доход/расход',
      href: '/finance',
      done: entryCount > 0,
    },
  ];
  if (opts.settings) {
    steps.unshift({
      key: 'setup',
      label: 'Настройте под свой портал',
      description: 'Для чего лиды, сделки и смарт-процессы и какие разделы нужны',
      href: '/setup',
      done: Boolean(opts.setupDone),
    });
    steps.push({
      key: 'time',
      label: 'Проверьте учёт времени',
      description: 'Если часы пишут в поля смарт-процесса или сделки, укажите эти поля',
      href: '/settings/time-fields',
      done: timeFields.length > 0,
      optional: true,
    });
  }

  return { steps, complete: steps.every((s) => s.done || s.optional) };
}
