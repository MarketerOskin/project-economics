import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HowItWorksSections } from '@/components/how-it-works/sections';

describe('HowItWorksSections (onboarding explainer)', () => {
  it('renders all six explainer sections', () => {
    render(<HowItWorksSections />);
    for (const title of [
      'Откуда берутся проекты',
      'План и факт — отдельные записи',
      'Как считаются прибыль и маржа',
      'Часы и ставка',
      'Кто что видит',
      'Удаление — мягкое',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('explains margin as "—" when income is zero, not 0% or an error', () => {
    render(<HowItWorksSections />);
    expect(screen.getByText(/показывается как «—»/)).toBeInTheDocument();
  });

  it('explains margin deltas are in percentage points, not percent', () => {
    render(<HowItWorksSections />);
    expect(screen.getByText(/процентных пунктах \(п\.п\.\), а не в процентах/)).toBeInTheDocument();
  });
});
