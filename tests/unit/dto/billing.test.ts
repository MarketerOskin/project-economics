import { describe, it, expect } from 'vitest';
import { createProLeadSchema } from '@/server/dto/billing';

describe('createProLeadSchema', () => {
  it('requires a contact of at least 3 characters', () => {
    expect(createProLeadSchema.safeParse({ contact: '' }).success).toBe(false);
    expect(createProLeadSchema.safeParse({ contact: 'ab' }).success).toBe(false);
    expect(createProLeadSchema.safeParse({ contact: 'a@b.ru' }).success).toBe(true);
  });

  it('comment is optional', () => {
    const r = createProLeadSchema.parse({ contact: 'a@b.ru' });
    expect(r.comment).toBeUndefined();
    const r2 = createProLeadSchema.parse({ contact: 'a@b.ru', comment: 'hi' });
    expect(r2.comment).toBe('hi');
  });

  it('trims whitespace and caps length', () => {
    const r = createProLeadSchema.parse({ contact: '  a@b.ru  ' });
    expect(r.contact).toBe('a@b.ru');
    expect(createProLeadSchema.safeParse({ contact: 'a@b.ru', comment: 'x'.repeat(1001) }).success).toBe(false);
  });
});
