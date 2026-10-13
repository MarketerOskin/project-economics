import type { StreamKind } from '@prisma/client';

/** Directions of a project (ADR-052), as the team names them. */
export const STREAM_KIND_LABELS: Record<StreamKind, string> = {
  SUPPORT: 'Поддержка',
  IMPLEMENTATION: 'Внедрение',
  DEVELOPMENT: 'Разработка',
  CONSULTING: 'Консалтинг',
  OTHER: 'Другое',
};

export const STREAM_KINDS = Object.keys(STREAM_KIND_LABELS) as StreamKind[];

export function streamTitle(s: { kind: StreamKind; name: string | null }): string {
  return s.name?.trim() || STREAM_KIND_LABELS[s.kind];
}
