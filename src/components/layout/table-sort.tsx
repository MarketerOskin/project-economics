'use client';

import * as React from 'react';
import { parseSortValue } from '@/lib/sort-value';

/**
 * Click a column header to sort any table on the page (ADR-050). It works on the rendered
 * rows, so every table in the app sorts without each one carrying its own state; rows that
 * read «Итого» or carry `data-pin` stay at the bottom. A table opts out with `data-no-sort`.
 */

function cellText(row: HTMLTableRowElement, index: number): string {
  let col = 0;
  for (const cell of Array.from(row.cells)) {
    if (col === index) return cell.textContent?.trim() ?? '';
    col += cell.colSpan || 1;
  }
  return '';
}

function isPinned(row: HTMLTableRowElement): boolean {
  if (row.dataset.pin !== undefined) return true;
  const first = row.cells[0]?.textContent?.trim().toLowerCase() ?? '';
  return first === 'итого' || first.startsWith('итого ');
}

function sortTable(table: HTMLTableElement, th: HTMLTableCellElement) {
  const body = table.tBodies[0];
  if (!body) return;
  const headRow = th.parentElement as HTMLTableRowElement;
  let index = 0;
  for (const cell of Array.from(headRow.cells)) {
    if (cell === th) break;
    index += cell.colSpan || 1;
  }
  const dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
  for (const cell of Array.from(headRow.cells)) cell.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', dir);

  const rows = Array.from(body.rows);
  const pinned = rows.filter(isPinned);
  const sortable = rows
    .filter((r) => !isPinned(r))
    .map((row, i) => ({ row, i, v: parseSortValue(cellText(row, index)) }));
  const sign = dir === 'ascending' ? 1 : -1;
  sortable.sort((a, b) => {
    if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
    const c =
      typeof a.v === 'number' && typeof b.v === 'number'
        ? a.v - b.v
        : String(a.v).localeCompare(String(b.v), 'ru', { numeric: true });
    return c === 0 ? a.i - b.i : c * sign;
  });
  for (const { row } of sortable) body.appendChild(row);
  for (const row of pinned) body.appendChild(row);
}

/**
 * One click listener on the document, nothing written into the markup up front: touching
 * headers before React hydrates a streamed table breaks hydration (and with it the page's
 * buttons), so headers are styled from CSS and sorted only when clicked.
 */
function onClick(e: MouseEvent) {
  if (e.button !== 0 || e.defaultPrevented) return;
  const target = e.target as Element | null;
  if (!target || target.closest('a, button, input, select, label')) return;
  const th = target.closest('th');
  const table = th?.closest('table');
  if (!th || !table || !th.closest('thead') || table.dataset.noSort !== undefined) return;
  if (!th.textContent?.trim()) return;
  sortTable(table, th as HTMLTableCellElement);
}

export function TableSort() {
  React.useEffect(() => {
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
