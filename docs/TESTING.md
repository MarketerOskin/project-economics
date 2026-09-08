# Тестирование

```
npm run lint          # ESLint (eslint-config-next, strict)
npm run typecheck     # tsc --noEmit, strict + noUncheckedIndexedAccess
npm test              # Vitest — unit + integration
npm run test:e2e      # Playwright — собирает прод и гоняет standalone-сервер
npm run build         # next build (output: standalone)
```

Интеграционным и E2E тестам нужна тестовая БД:
`docker compose -f docker-compose.test.yml up -d` (PostgreSQL на :5433).

## Уровни

### Unit (`tests/unit/`, окружение node/jsdom)

| Файл | Что проверяет |
|---|---|
| `finance/money` | `Decimal`: `0.1 + 0.2 == 0.3`, `sum`, отсутствие дрейфа на большом агрегате |
| `finance/calculations` | прибыль (300 000), рентабельность (30%), `null` при нулевом доходе, убыток −40%, `12.5 × 2000 = 25 000`, округление half-up, отклонения, п.п. |
| `finance/aggregates` | агрегаты проекта/компании, **исключение soft-deleted**, независимость PLAN/FACT, `factMargin = null` при нулевом факт-доходе, decimal-кейс, структура расходов, time-series |
| `format/*` | `₽` только в `lib/format` (grep-тест), `—` для null, п.п. со знаком |
| `permissions` | матрица 3 роли × 9 возможностей + member-scoped `viewProject` |
| `errors` | `ZodError → 400`, Prisma `P2002 → 409` / `P2025 → 404` без утечки кода, unknown → generic 500 |
| `auth/session` | round-trip подписи, отказ на подделке / чужом секрете / мусоре |
| `period` | `resolvePeriod` для всех пресетов, `granularityFor` |
| `audit/humanize` | человекочитаемые фразы, `25 000 ₽ → 32 000 ₽`, никакого сырого JSON, неизвестное действие не падает |
| `bitrix/crypto` | AES-256-GCM round-trip, отказ на чужом ключе / не-32-байтном ключе, `redactTokens` |

### Integration (`tests/integration/`, реальная PostgreSQL)

| Файл | Что проверяет |
|---|---|
| `schema` | схема применяется, `Decimal` без float на уровне БД |
| `with-portal` | изоляция порталов: `findByIdOrThrow` чужой строки → 404, `findMany` — только свой портал |
| `handler` | `route()`: 401 без сессии, **подделанная роль в cookie игнорируется**, 403 без CSRF, маппинг `AppError` |
| `demo-auth` | `/api/session`, переключатель роли, 403 при `DEMO_MODE=false`, невалидная роль → 400 |
| `seed` | 6 проектов всех семантических состояний, HOURS_RATE = часы×ставка, soft-deleted + audit-строки |
| `projects/api` | **ТЗ §66**: сотрудник в проект A → 200, в B → 403, список — только свои; менеджер → 200; чужой портал → 404; PATCH пишет `changedFields`; archive/restore; участники (diff + audit) |
| `projects/atomicity` | падение audit-записи откатывает создание проекта (ТЗ §52) |
| `finance/api` | сотрудник → 403; **HOURS_RATE считается на сервере, клиентский `amount` игнорируется**; статья не того `kind` → 400; edit → пересчёт + audit before/after; delete → вне агрегатов; пагинация + скоуп; deleted скрыт по умолчанию |
| `categories` | 403 для сотрудника; удаление неиспользуемой; **используемую нельзя удалить (400) — только архив**; невалидный цвет → 400; архив скрывает из активных, история сохраняет имя |
| `dashboard` | company KPI = сумма проектов; бары по прибыли desc; сотрудник видит только свой проект во всех цифрах; **≤ 4 SELECT независимо от числа проектов** (нет N+1); структура расходов с именами/цветами |
| `audit` | глобальная история: сотрудник → 403, менеджер → 200 с человекочитаемыми записями, без сырого JSON; история проекта — участник читает, не-участник → 403 |
| `security` | cookie на несуществующего пользователя → 401; подделанный ADMIN-cookie для EMPLOYEE → 403 на admin-мутации; **ни один ответ не содержит сохранённый токен**; POST без CSRF → 403; шквал мутаций → 429 |
| `bitrix/crypto`, `bitrix/client` | refresh по `expired_token` + retry, перезапись зашифрованных токенов, **в логах нет подстроки токена** |
| `bitrix/install` | install создаёт портал с зашифрованными токенами + 6 статей; handler: `user.current` (admin) → сессия + `AppUser` ADMIN; неверный `application_token` → 401; `ONAPPUNINSTALL` деактивирует портал |
| `bitrix/users` | `syncUsers`: upsert снимков, деактивация исчезнувших |
| `bitrix/crm` | demo — заготовленный список; production — нормализация `crm.item.list`; проект из сделки хранит snapshot + валидный URL Bitrix |

### E2E (`tests/e2e/`, Playwright, demo-mode)

| Файл | Сценарий |
|---|---|
| `smoke` | приложение поднимается, заголовок виден |
| `manager-flow` | **полный сценарий ТЗ §67**: вход руководителем → создание проекта → добавление сотрудника → план 1 000 000 → факт 900 000 → расход «Внешние программисты» 100 ч × 2 000 → AI 50 000 → открыть проект → **прибыль 650 000 ₽, рентабельность 72,2%** → редактирование расхода (120 ч) → **прибыль 610 000 ₽** → история показывает «изменил расход» с `→` |

## Ручные проверки (ТЗ §70)

Проведены в demo-mode для трёх ролей: Dashboard, Projects, Project card, Finance,
Categories, History, добавление дохода/расхода, расчёт часов, редактирование, удаление,
архивирование, фильтры, переключение ролей (сотрудник → сокращённое меню + только свои
проекты), empty state, error state. Консоль браузера — без React-warnings, hydration-
ошибок и uncaught errors.

## Что покрыто из обязательных кейсов ТЗ

- **§65** (unit финансов) — все 8 кейсов.
- **§66** (permission tests) — все кейсы, включая admin settings (`categories`).
- **§67** (E2E) — полностью.
- **§68** (seed) — все 6 семантических состояний (тест `seed`).
- **§52** (атомарность) — тест `projects/atomicity`.
- **§53** (без N+1) — тест `dashboard`.
- **§54** (изоляция порталов) — тест `with-portal` + `projects/api`.
