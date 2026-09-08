import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * The ₽ sign must appear only in src/lib/format/ (ТЗ §11 — currency formatting is centralised).
 * Tests may reference it freely; they are excluded here.
 */
describe('ruble sign is centralised', () => {
  it('no ₽ literal outside src/lib/format/', () => {
    let hits = '';
    try {
      hits = execSync(
        `grep -rn "₽" src --include="*.ts" --include="*.tsx" || true`,
        { encoding: 'utf8' },
      );
    } catch {
      hits = '';
    }
    const offenders = hits
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.startsWith('src/lib/format/'));
    expect(offenders, `stray ₽ found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
