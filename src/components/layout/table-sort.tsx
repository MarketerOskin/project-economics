'use client';

import * as React from 'react';
import { parseSortValue } from '@/lib/sort-value';

/**
 * Click a column header to sort any table on the page (ADR-050). It works on the rendered
 * rows, so every table in the app sorts without each one carrying its own state; rows that
 * read «Итого» or carry `data-pin` stay at the bottom. A table opts out with `data-no-sort`.
 */

const READY = 'sortReady';

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

function enhance(root: ParentNode) {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    if (table.dataset[READY] || table.dataset.noSort !== undefined) continue;
    const head = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!head || !table.tBodies[0]) continue;
    table.dataset[READY] = '1';
    for (const th of Array.from(head.cells)) {
      if (!th.textContent?.trim()) continue;
      th.classList.add('cursor-pointer', 'select-none', 'sortable-th');
      th.title = 'Сортировать';
      th.tabIndex = 0;
      const run = () => sortTable(table, th);
      th.addEventListener('click', run);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          run();
        }
      });
    }
  }
}

export function TableSort() {
  React.useEffect(() => {
    enhance(document);
    const observer = new MutationObserver(() => enhance(document));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
