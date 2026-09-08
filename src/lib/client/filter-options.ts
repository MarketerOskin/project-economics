'use client';

import * as React from 'react';
import { apiFetch } from './api';

export interface FilterOption {
  value: string;
  label: string;
}

interface Options {
  projects: FilterOption[];
  users: FilterOption[];
  categories: FilterOption[];
}

/** Loads the lists used to populate dashboard / ledger filter dropdowns. */
export function useFilterOptions(): Options {
  const [opts, setOpts] = React.useState<Options>({ projects: [], users: [], categories: [] });

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch<{ projects: { id: string; name: string }[] }>('/api/projects?status=ALL').catch(() => ({
        projects: [],
      })),
      apiFetch<{ users: { id: string; fullName: string }[] }>('/api/users').catch(() => ({ users: [] })),
      apiFetch<{ categories: { id: string; name: string }[] }>('/api/categories').catch(() => ({
        categories: [],
      })),
    ]).then(([p, u, c]) => {
      if (!alive) return;
      setOpts({
        projects: p.projects.map((x) => ({ value: x.id, label: x.name })),
        users: u.users.map((x) => ({ value: x.id, label: x.fullName })),
        categories: c.categories.map((x) => ({ value: x.id, label: x.name })),
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  return opts;
}
