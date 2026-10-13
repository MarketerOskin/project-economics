import ExcelJS from 'exceljs';
import { RUB_SIGN } from '@/lib/format';
import type { MarketingReport, SalesReport } from './marketing';

/**
 * «Маркетинг» and «Продажи» as .xlsx or .csv (ADR-048): the screen's tables, money and
 * percentages as plain numbers so they sum in Excel.
 */

type Cell = string | number | null;
interface Table {
  name: string;
  columns: Array<{ header: string; width: number }>;
  rows: Cell[][];
}

const num = (s: string | null) => (s === null ? null : Number(s));

export function marketingTables(r: MarketingReport): Table[] {
  const channelColumns = [
    { header: 'Канал', width: 28 },
    { header: `Расход, ${RUB_SIGN}`, width: 14 },
    { header: `Оплачено, ${RUB_SIGN}`, width: 14 },
    { header: 'Лиды', width: 9 },
    { header: `CPL, ${RUB_SIGN}`, width: 12 },
    { header: 'Квал. лиды', width: 11 },
    { header: `CPL-2, ${RUB_SIGN}`, width: 12 },
    { header: 'Лид → квал, %', width: 13 },
    { header: 'Продажи', width: 10 },
    { header: `CAC, ${RUB_SIGN}`, width: 12 },
    { header: `Выручка, ${RUB_SIGN}`, width: 14 },
    { header: 'ROMI, %', width: 10 },
  ];
  const line = (name: string, c: MarketingReport['total']): Cell[] => [
    name,
    num(c.spent),
    num(c.paid),
    c.leads,
    num(c.cpl),
    c.qualified,
    num(c.cpl2),
    num(c.leadToQualified),
    c.sales,
    num(c.cac),
    num(c.revenue),
    num(c.romi),
  ];
  const tables: Table[] = [
    {
      name: 'Каналы',
      columns: channelColumns,
      rows: [...r.channels.map((c) => line(c.name, c)), line('Итого', r.total)],
    },
  ];
  if (r.planFact) {
    tables.push({
      name: 'План-факт',
      columns: [
        { header: 'Показатель', width: 16 },
        { header: 'План', width: 14 },
        { header: 'Факт', width: 14 },
        { header: 'Выполнение, %', width: 14 },
        { header: 'Прогноз на месяц', width: 16 },
      ],
      rows: r.planFact.map((p) => [
        p.money ? `${p.label}, ${RUB_SIGN}` : p.label,
        num(p.plan),
        num(p.fact),
        num(p.done),
        num(p.forecast),
      ]),
    });
  }
  if (r.spends.length) {
    tables.push({
      name: 'Расходы',
      columns: [
        { header: 'Дата', width: 12 },
        { header: 'Канал', width: 28 },
        { header: 'Вид', width: 14 },
        { header: `Сумма, ${RUB_SIGN}`, width: 14 },
        { header: 'Комментарий', width: 40 },
      ],
      rows: r.spends.map((s) => [
        s.date,
        s.channel,
        s.kind === 'SPENT' ? 'Реализовано' : 'Оплачено',
        num(s.amount),
        s.note,
      ]),
    });
  }
  return tables;
}

export function salesTables(r: SalesReport): Table[] {
  const columns = (first: string) => [
    { header: first, width: 28 },
    { header: 'Создано', width: 10 },
    { header: 'В работе', width: 10 },
    { header: 'Выиграно', width: 10 },
    { header: 'Проиграно', width: 10 },
    { header: 'Конверсия, %', width: 13 },
    { header: 'Продажи за период', width: 16 },
    { header: `Выручка, ${RUB_SIGN}`, width: 14 },
    { header: `Средний чек, ${RUB_SIGN}`, width: 15 },
  ];
  const line = (s: SalesReport['total']): Cell[] => [
    s.name,
    s.created,
    s.inWork,
    s.won,
    s.lost,
    num(s.conversion),
    s.sales,
    num(s.revenue),
    num(s.avgCheck),
  ];
  return [
    {
      name: 'По каналам',
      columns: columns('Канал'),
      rows: [...r.byChannel.map(line), line(r.total)],
    },
    {
      name: 'По менеджерам',
      columns: columns('Менеджер'),
      rows: [...r.byManager.map(line), line(r.total)],
    },
  ];
}

export async function tablesToXlsx(tables: Table[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const t of tables) {
    const ws = wb.addWorksheet(t.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = t.columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFD6FF3F' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF050505' } };
    for (const row of t.rows) ws.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** First table as CSV (semicolon-separated, decimal comma, BOM) — opens right in Russian Excel. */
export function tableToCsv(t: Table): string {
  const cell = (v: Cell) => {
    if (v === null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [t.columns.map((c) => cell(c.header)), ...t.rows.map((r) => r.map(cell))];
  return `﻿${lines.map((l) => l.join(';')).join('\r\n')}\r\n`;
}
