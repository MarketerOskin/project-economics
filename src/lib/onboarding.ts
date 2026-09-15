import type { PortalScope } from '@/lib/db/with-portal';

/**
 * First-run onboarding for a freshly installed (real, non-demo) portal. Three steps,
 * each derived from real data — never a manually-ticked checkbox, so it can't lie about
 * where the portal actually is. Shown on the dashboard until dismissed or all steps done.
 */
export interface OnboardingStep {
  key: 'project' | 'team' | 'entry';
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  complete: boolean;
}

export async function getOnboardingProgress(scope: PortalScope): Promise<OnboardingProgress> {
  const [projectCount, memberCount, entryCount] = await Promise.all([
    scope.project.count(),
    scope.member.count(),
    scope.entry.count(),
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

  return { steps, complete: steps.every((s) => s.done) };
}
