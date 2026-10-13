import { describe, it, expect } from 'vitest';
import {
  normalizeHex,
  onAccent,
  reportPalette,
  sniffLogo,
  tint,
  DEFAULT_ACCENT,
} from '@/lib/brand';

describe('report branding (ADR-054)', () => {
  it('normalizes hex colours and rejects anything else', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('3f6212')).toBe('#3f6212');
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });

  it('picks readable text on the accent', () => {
    expect(onAccent('#000000')).toBe('#ffffff');
    expect(onAccent('#1f2937')).toBe('#ffffff');
    expect(onAccent('#ffeb3b')).toBe('#111111');
    expect(onAccent('#d6ff3f')).toBe('#111111');
  });

  it('tints towards white and falls back to the default accent', () => {
    expect(tint('#000000', 0.5)).toBe('#808080');
    expect(reportPalette('nonsense').accent).toBe(DEFAULT_ACCENT);
  });

  it('recognises logos by their bytes, not their name', () => {
    expect(sniffLogo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      'image/png',
    );
    expect(sniffLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffLogo(new TextEncoder().encode('<svg onload="x()"></svg>'))).toBeNull();
  });
});
