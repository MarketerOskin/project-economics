# Design system

Direction: **Apple-restrained, editorial** (ТЗ §33–36). Off-white ground, white cards,
near-black text, one cobalt accent, muted semantics. Financial numbers dominate; decoration
recedes. Committed light theme (desktop, embedded in Bitrix24).

## Tokens (`src/app/globals.css`)

| Role | Value |
|---|---|
| `--bg` | `#f5f5f7` (warm off-white ground) |
| `--surface` | `#ffffff` (cards) |
| `--surface-muted` | `#fafafa` |
| `--fg` / `--fg-secondary` / `--fg-tertiary` | `#111111` / `#5b5b60` / `#8a8a8e` |
| `--border` / `--border-strong` | `#e6e6e9` / `#d4d4d8` |
| `--accent` | `#2f4fe0` (cobalt) — used sparingly: active nav, primary buttons, links, focus |
| `--positive` / `--warning` / `--negative` | `#1f7a4d` / `#9a6b16` / `#b23b3b` (muted) |
| radii | `--radius-sm 10` · `--radius 14` · `--radius-lg 18` · `--radius-xl 22` |
| shadows | very soft only (`--shadow-sm/-/-lg`); no strong drop shadows |

## Category accent palette (`src/lib/categories/palette.ts`)

7 hues from the **validated data-viz reference categorical theme** (adjacent pairlist:
worst CVD ΔE 9.1, normal-vision 19.6). Used as micro-accents (a dot / small badge — always
with a text label beside it, so identity is never colour-alone) and as chart segment fills.

## Typography

System-first stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
Inter, …`). No font files in the repo. `tnum` tabular figures on the body so money columns
align. Hierarchy: page title (2xl, tracking-tight) · KPI numerals (26px, semibold) · labels
(xs, uppercase, tracking-wide, tertiary ink).

## Numbers & colour

- Loss is shown with a real minus sign **and** `--negative` — never colour alone (ТЗ §58).
- Profit is neutral ink (no colour) unless negative.
- `margin === null` renders `—` everywhere (ТЗ §16).
- Deviations carry an explicit `+`/`−` sign and a green/amber/red tone.

## Tables

Clean single horizontal rules, hover row highlight, right-aligned money columns with `nums`,
`overflow-x-auto` wrappers so wide tables scroll inside their own container (the page body
never scrolls sideways). No vertical borders.

## States

- **Loading:** route-level `loading.tsx` skeletons (KPI blocks + table skeleton).
- **Empty:** `EmptyState` — icon + title + one line + action buttons (ТЗ §37).
- **Error:** `(app)/error.tsx` human copy + retry; `not-found.tsx`; API errors mapped by
  `toErrorResponse` to human Russian messages, surfaced as toasts (ТЗ §39–40).

## Charts

Recessive axes/grid, ink-token text (never series colour on labels), 2px marks, 2px surface
gap on the donut, legend + values beside every categorical chart, per-mark hover tooltips.
No dual-axis. Profit bars coloured by sign (green/red) with the value labelled beside each bar.
