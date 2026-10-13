import type { PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import { fetchSectionStages, type SectionFunnel } from '@/lib/bitrix/related';
import {
  OUTCOME_SEMANTIC,
  SEMANTIC_OUTCOME,
  ruleKey,
  type StageOutcome,
  type StageRules,
  type StageSemantic,
} from '@/domain/crm/stages';
import { listCrmSections } from './portal-setup';

/**
 * The portal's reading of CRM stages (ADR-051): which stages mean the work is in progress,
 * closed, won or cancelled. Read by analytics (linked elements) and marketing (leads, deals).
 */

export async function loadStageRules(scope: PortalScope): Promise<StageRules> {
  const rows = await scope.crmStageRule.findMany();
  return new Map(
    rows.map((r) => [ruleKey(r.entityTypeId, r.stageId), OUTCOME_SEMANTIC[r.outcome]]),
  );
}

export interface StageRow {
  id: string;
  name: string;
  /** What Bitrix24 itself says. */
  bitrix: StageOutcome;
  /** What the portal set; null — Bitrix24's own. */
  outcome: StageOutcome | null;
}

export interface StageSection {
  entityTypeId: number;
  title: string;
  funnels: Array<{ id: number | null; name: string; stages: StageRow[] }>;
  error: string | null;
}

const DEMO_SECTIONS: Array<{ entityTypeId: number; title: string; funnels: SectionFunnel[] }> = [
  {
    entityTypeId: 2,
    title: 'Сделки',
    funnels: [
      {
        id: 0,
        name: 'Общая',
        stages: [
          { id: 'NEW', name: 'Новая', semantic: 'process' },
          { id: 'PREPARATION', name: 'КП отправлено', semantic: 'process' },
          { id: 'WON', name: 'Сделка успешна', semantic: 'success' },
          { id: 'LOSE', name: 'Сделка провалена', semantic: 'fail' },
        ],
      },
    ],
  },
  {
    entityTypeId: 1044,
    title: 'Заявки',
    funnels: [
      {
        id: 55,
        name: 'Поддержка',
        stages: [
          { id: 'DT1044_55:NEW', name: 'Новая', semantic: 'process' },
          { id: 'DT1044_55:PREPARATION', name: 'В работе', semantic: 'process' },
          { id: 'DT1044_55:CLIENT', name: 'Выполнена, ждём акт', semantic: 'process' },
          { id: 'DT1044_55:SUCCESS', name: 'Готово', semantic: 'success' },
          { id: 'DT1044_55:FAIL', name: 'Отменена', semantic: 'fail' },
        ],
      },
    ],
  },
];

/** Every section's funnels and stages with the portal's rules, for settings. */
export async function stageSettings(
  portal: PortalInstallation,
  scope: PortalScope,
  demo: boolean,
): Promise<StageSection[]> {
  const rules = await scope.crmStageRule.findMany();
  const saved = new Map(rules.map((r) => [ruleKey(r.entityTypeId, r.stageId), r.outcome]));
  const sections: Array<{
    entityTypeId: number;
    title: string;
    funnels: SectionFunnel[];
    error: string | null;
  }> = [];
  if (demo) {
    sections.push(...DEMO_SECTIONS.map((s) => ({ ...s, error: null })));
  } else {
    for (const s of await listCrmSections(portal, scope)) {
      try {
        sections.push({
          ...s,
          funnels: await fetchSectionStages(portal, s.entityTypeId),
          error: null,
        });
      } catch (err) {
        sections.push({
          ...s,
          funnels: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return sections.map((s) => ({
    entityTypeId: s.entityTypeId,
    title: s.title,
    error: s.error,
    funnels: s.funnels.map((f) => ({
      id: f.id,
      name: f.name,
      stages: f.stages.map((st) => ({
        id: st.id,
        name: st.name,
        bitrix: SEMANTIC_OUTCOME[st.semantic as StageSemantic],
        outcome: saved.get(ruleKey(s.entityTypeId, st.id)) ?? null,
      })),
    })),
  }));
}

/** Saves one section's rules; a stage set to what Bitrix24 already says is not stored. */
export async function saveStageRules(
  scope: PortalScope,
  entityTypeId: number,
  rules: Array<{ stageId: string; outcome: StageOutcome }>,
): Promise<void> {
  await scope.crmStageRule.replaceForType(entityTypeId, rules);
}
