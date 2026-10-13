import { describe, it, expect } from 'vitest';
import { parseProjectList } from '@/lib/project-list';

describe('parseProjectList (ADR-043)', () => {
  it('one project per line, client after ; or a tab (pasted from Excel)', () => {
    expect(parseProjectList('Внедрение CRM; ООО «Альфа»\n\n  Аудит портала  \nСайт\tИП Иванов\r\n')).toEqual([
      { name: 'Внедрение CRM', clientName: 'ООО «Альфа»' },
      { name: 'Аудит портала', clientName: null },
      { name: 'Сайт', clientName: 'ИП Иванов' },
    ]);
  });

  it('skips lines with no name', () => {
    expect(parseProjectList('; Клиент без проекта\n')).toEqual([]);
  });
});
