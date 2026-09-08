# Итоговый аудит — «Экономика проектов» для Bitrix24

Отчёт по форме ТЗ §78.

- **Репозиторий:** https://github.com/MarketerOskin/project-economics (публичный)
- **Живое демо:** http://159.194.205.246 (Docker + nginx на VPS клиента, рядом с
  существующим приложением — отдельный стек, порт `127.0.0.1:8080`, БД без публикации).
  Переключатель ролей слева внизу.

---

## 1. Что реализовано

**Функционально (ТЗ §76 Definition of Done):**

| Область | Статус |
|---|---|
| Проекты: создание вручную | ✅ |
| Проекты: импорт из Bitrix24 (Сделка `entityTypeId=2` / Компания `4`, `crm.item.list/get`) | ✅ |
| Открыть связанную CRM-сущность («Открыть в Bitrix24 ↗») | ✅ |
| Сотрудники подтягиваются из Bitrix24 (`user.get`, `user.current`) | ✅ |
| Сотрудники добавляются к проектам (multi-select с поиском/аватарами) | ✅ |
| Роли ADMIN / MANAGER / EMPLOYEE — проверка на бэкенде | ✅ |
| Доход создаётся | ✅ |
| Расход создаётся | ✅ |
| Новые статьи создаются / редактируются / архивируются | ✅ |
| Фиксированная сумма | ✅ |
| Часы × ставка (пересчёт на сервере, snapshot часов/ставки) | ✅ |
| PLAN и FACT — отдельные записи | ✅ |
| Прибыль / рентабельность / отклонение план-факт | ✅ |
| Главный дашборд (KPI + 3 графика + таблица + фильтры/период в URL) | ✅ |
| Дашборд проекта (шапка + 4 KPI план/факт + вкладки) | ✅ |
| Графики (доходы/расходы во времени, прибыль по проектам, структура расходов) | ✅ |
| История изменений (человекочитаемая, `/history` + вкладка проекта) | ✅ |
| Редактирование / удаление (soft) / архивирование | ✅ |

**Технически:** PostgreSQL, `prisma migrate` + миграция `init`, seed (7 проектов всех
семантических состояний), backend-права, `Decimal` от края до края, Zod-валидация,
AuditLog, Docker (multi-stage, healthcheck, `migrate deploy` на старте), `.env.example`,
demo-mode, тесты.

**UX:** ролевая навигация, skeleton-загрузка, empty/error states, тосты, чистые
сортируемые таблицы, premium desktop-UI (Apple-restrained, один кобальтовый акцент).

**Документация:** `README.md` (с реальными скриншотами, гайдом установки в Bitrix24,
формулами, матрицей прав), `AI_USAGE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`,
`docs/DESIGN.md`, `deploy/README.md` + `deploy/nginx.example.conf`.

## 2. Архитектура

```
src/
  domain/finance/       чистый движок формул (Decimal in → Decimal|null out),
                        ноль зависимостей от БД/React — единственный источник формул
  lib/
    db/with-portal.ts   каждый запрос портал-скоупится portalId (изоляция порталов)
    bitrix/             REST-клиент (refresh + retry), crypto (AES-256-GCM), auth,
                        users (sync), crm (нормализация crm.item.*)
    auth/               подписанный cookie (jose), резолв сессии/роли на сервере
    permissions/        can.* + requirePermission — ре-проверка на бэкенде
    format/             единственное место, где живёт ₽ и Intl.NumberFormat('ru-RU')
    rate-limit.ts       token-bucket на мутациях
  server/
    handler.ts          route(): CSRF → сессия → права → домен →
                        $transaction(мутация + audit) → маппинг ошибок
    services/           read/write-логика, переиспользуется RSC-страницами и API
  app/                  App Router; RSC для чтения, route handlers для мутаций
  components/           UI (Radix primitives, Recharts, RHF)
  proxy.ts              Next 16 middleware: demo-бутстрап сессии
```

Поток мутации: `zod.parse → requirePermission(can.*) → domain → prisma.$transaction([мутация, writeAudit]) → 200/human-error`.

## 3. Структура БД (Prisma, PostgreSQL)

7 моделей: `PortalInstallation`, `AppUser`, `Project`, `ProjectMember`,
`FinanceCategory`, `FinancialEntry`, `AuditLog`.
Enum'ы: `AppRole`, `ProjectStatus`, `ProjectSource`, `CrmEntityType`,
`FinanceDirection`, `BudgetType`, `CalculationMode`, `CategoryKind`, `AuditAction`,
`AuditEntityType`.

- Деньги `Decimal @db.Decimal(18,2)`, часы/ставка `Decimal @db.Decimal(10,2)`,
  календарные даты `@db.Date`.
- `FinancialEntry`: `budgetType PLAN|FACT` (отдельные записи), `calculationMode`,
  `hours`/`hourlyRate` snapshot, `plannedEntryId` (опц. связь факт→план),
  `deletedAt`/`deletedById` (soft-delete).
- Составные уникальные ключи с `portalId` (`@@unique([portalId, bitrixUserId])`,
  `@@unique([portalId, kind, name])`).
- Индексы: `portalId`, `projectId`, `operationDate`, `budgetType`, `direction`,
  `categoryId`, `deletedAt` + составной `(portalId, projectId, budgetType, direction, deletedAt)`
  и `(portalId, operationDate)`; на audit — `(portalId, createdAt)`, `(portalId, entityType, entityId)`, `(portalId, projectId)`.
- `AuditLog`: `actorName` (snapshot), `before`/`after` JSON, `changedFields[]`.

Одна миграция `prisma/migrations/20260908024810_init`.

## 4. Bitrix24 integration

- **OAuth:** `POST /api/bitrix/install` — upsert `PortalInstallation` (токены
  **AES-256-GCM**), seed 6 статей, `placement.bind` пункта меню `LEFT_MENU`
  «Экономика проектов». `POST /api/bitrix/handler` — проверка `application_token`,
  `user.current` → upsert `AppUser`, `is_admin → ADMIN`, выдача сессии, redirect.
  `POST /api/bitrix/events` — `ONAPPUNINSTALL` деактивирует портал и стирает токены.
- **REST-клиент** (`src/lib/bitrix/client.ts`): `callBitrix` инжектит access-токен,
  при `expired_token` один раз обновляет через `oauth.bitrix.info`, перезаписывает
  зашифрованные токены и повторяет запрос; `batchBitrix` (≤50/вызов). Токен никогда
  не логируется (`redactTokens`, тест).
- **Сотрудники:** `syncUsers` (`user.get` с пагинацией, деактивация исчезнувших),
  фоновая синхронизация из `/api/users` при устаревании > 1ч.
- **CRM:** `listCrmItems` / `getCrmItem` через `crm.item.list` / `crm.item.get`
  (Сделка 2 / Компания 4), нормализация в `{id, title, clientName, url}`; при импорте
  проекта сохраняется snapshot id/тип/название/URL, подставляется клиент.
- **Scopes:** `crm`, `placement`, `user_brief`, `basic`.
- **Demo-fallback:** без Bitrix24 CRM-браузер отдаёт заготовленный список, sync
  сотрудников не вызывается.

**Не проверено вживую:** реальный OAuth-хендшейк и вызовы против настоящего портала
(нет доступа). Реализация — строго по актуальной REST-документации, покрыта
unit/integration-тестами с замоканным `fetch`. См. `AI_USAGE.md`.

## 5. Реализованные роли (проверка на бэкенде)

| Возможность | ADMIN | MANAGER | EMPLOYEE |
|---|:-:|:-:|:-:|
| Видеть все проекты | ✓ | ✓ | только свои |
| Видеть финпоказатели проекта | ✓ | ✓ | ✓ (в доступном) |
| Создавать / редактировать / архивировать проект | ✓ | ✓ | — |
| Создавать / править / удалять операции | ✓ | ✓ | — |
| Управлять участниками / статьями | ✓ | ✓ | — |
| Смотреть историю | ✓ | ✓ | — |
| Назначать роли, настройки интеграции | ✓ | — | — |

`GET /api/projects/:id` для не-участника → **403**. Мутация финансов сотрудником →
**403**. **Роль из cookie игнорируется** — берётся из `AppUser` (тест: подделанный
ADMIN-cookie для EMPLOYEE → 403 на admin-мутации). Проверено также в браузере:
сотрудник видит на дашборде только суммы своих проектов, меню сокращено, кнопок
создания нет.

## 6. Финансовые формулы

```
Фактический доход  = Σ FACT INCOME          Плановый доход  = Σ PLAN INCOME
Фактические расходы = Σ FACT EXPENSE          (аналогично для расходов / плановой прибыли)
Фактическая прибыль = доход − расходы

Рентабельность = Прибыль / Доход × 100     при Доход = 0 → null  (UI: «—», не Infinity/NaN/0%)

Отклонение (доход/расход/прибыль) = FACT − PLAN
Отклонение рентабельности          = FACT margin − PLAN margin  → в п.п.  («+4,2 п.п.»)

HOURS_RATE: Сумма = round₂(часы × ставка)   — всегда пересчитывается на сервере,
                                              клиентский amount игнорируется
```

Всё на `Decimal` (decimal.js, 40 знаков, HALF_UP). Единственный источник —
`src/domain/finance/`, дублирования формул в страницах/API/графиках нет.

Все 8 кейсов ТЗ §65 в тестах: прибыль 300 000, рентабельность 30%, `null` при нулевом
доходе, убыток −40%, `12.5 × 2000 = 25 000`, decimal без float-дрейфа, удалённая
операция вне агрегата, независимость PLAN/FACT.

## 7. Tests

32 файла, **190 unit/integration + 2 E2E**.

- **Unit:** движок финансов (все §65), форматтеры (`₽` только в `lib/format` —
  grep-тест), матрица прав 3×9, маппинг ошибок, session, period, humanize аудита,
  crypto Bitrix.
- **Integration (реальная PostgreSQL):** `route()` (CSRF, 401, подделанная роль),
  demo-auth, seed (6 состояний), **матрица §66** (проект A/B → 200/403, чужой портал →
  404), атомарность §52 (падение audit откатывает проект), HOURS_RATE-пересчёт §14,
  архив-вместо-удаления статьи §28, дашборд без N+1 §53 (≤4 SELECT), изоляция порталов
  §54, security-инварианты (токен не в ответе, rate-limit 429), Bitrix
  install/handler/users/crm.
- **E2E (Playwright):** smoke + **полный сценарий ТЗ §67** (вход руководителем →
  проект → сотрудник → план 1 000 000 → факт 900 000 → 100 ч × 2 000 → AI 50 000 →
  прибыль 650 000 ₽ / рентабельность 72,2% → правка на 120 ч → прибыль 610 000 ₽ →
  история «изменил расход» с `→`).

Найдено и исправлено тестами 2 реальных бага: сериализация даты при редактировании
операции (E2E), некорректный redirect без `APP_URL` (E2E).

Отдельные тесты на правки по ревью: проверка `application_token` на `ONAPPUNINSTALL`
(без токена / с чужим токеном → 401, портал не трогается), запрет переноса операции
на проект чужого портала через `PATCH` (→ 404), одноразовый per-user AUTH_ID
используется напрямую и не пишется в общий токен портала, отказ на 3-й знак после
запятой в сумме/часах.

## 8. Результаты lint / typecheck / test / build / e2e

Прогон от 2026-09-08 (`docker compose -f docker-compose.test.yml up -d` предварительно):

```
npm run lint        → clean (0 errors, 0 warnings)
npm run typecheck   → clean (tsc --noEmit, strict + noUncheckedIndexedAccess)
npm test            → Test Files 32 passed (32) · Tests 190 passed (190)
npm run build       → ✓ Compiled successfully · standalone output
npm run test:e2e    → 2 passed (smoke + manager-flow ТЗ §67)
```

В коде нет `any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, нет `TODO`/`FIXME`,
нет debug-`console.log` (только `console.error` в error-boundary и обёртке обработчика).
Консоль браузера на всех экранах — без React-warnings, hydration-ошибок, uncaught.

## 9. Как запустить demo

Нужен только Docker. **Без конфигурации:**

```bash
git clone <repo> && cd project-economics
docker compose up --build
```

Открыть <http://localhost:3000>. В demo-режиме контейнер `app` сам генерирует
временные секреты (если `.env` нет), выполняет `prisma migrate deploy` (проверено на
свежем клоне с чистого volume — миграция `init` применяется) и наполняет демо-портал
(7 проектов: прибыльный, убыточный, точно по плану, с перерасходом, без факт-дохода,
завершённый, архивный). Слева внизу — переключатель ролей Администратор / Руководитель / Сотрудник
(его нет в production-режиме).

Для постоянного demo или реальной установки — `cp .env.example .env`, задать
`SESSION_SECRET` (`openssl rand -base64 48`) и `APP_ENCRYPTION_KEY`
(`openssl rand -base64 32`).

Локально без Docker для приложения:
```bash
npm install && cp .env.example .env
docker compose up -d db
npm run db:migrate && npm run db:seed && npm run dev
```

## 10. Как установить в Bitrix24

1. **Разработчикам → Другое → Локальное приложение** (серверное, с API и встраиванием).
2. **Адрес обработчика:** `https://<APP_URL>/api/bitrix/handler`
3. **URL установки:** `https://<APP_URL>/api/bitrix/install`
4. **Права:** `crm`, `placement`, `user_brief`, `basic`.
5. `client_id`/`client_secret` → `B24_CLIENT_ID`/`B24_CLIENT_SECRET`, `DEMO_MODE=false`,
   перезапустить `docker compose up -d`.
6. Нажать **Установить** — обработчик сохранит зашифрованные токены, создаст стартовые
   статьи и привяжет пункт левого меню **«Экономика проектов»** (`placement.bind`,
   `LEFT_MENU`).
7. **Проверка:** пункт появился в левом меню; открытие приложения определяет
   пользователя через `user.current`, администратор Bitrix24 → ADMIN.
8. Подписать событие `ONAPPUNINSTALL` на `https://<APP_URL>/api/bitrix/events`.

Подробнее — раздел «Установка в Bitrix24» в `README.md`.

## 11. Как развернуть на VPS

Одной командой из корня репозитория:
```bash
bash deploy/vps-setup.sh
```
Скрипт создаёт `.env` со сгенерированными секретами, собирает и поднимает стек
(app + PostgreSQL), дожидается healthcheck. Контейнер `app` применяет миграции на
старте (`prisma migrate deploy`, **не** `db push`).

Дальше: nginx как reverse-proxy с TLS — `deploy/nginx.example.conf` (CSP
`frame-ancestors` для доменов `*.bitrix24.*`, проксирование на `127.0.0.1:3000`,
`certbot --nginx`); правка `.env` под реальный портал (`APP_URL`,
`B24_CLIENT_ID/SECRET`, `DEMO_MODE=false`) и `docker compose up -d --build`.
Обновление: `git pull && docker compose up -d --build`. Бэкап:
`docker compose exec -T db pg_dump -U economics economics | gzip > backup.sql.gz`.

## 12. Что осталось

**Правки после первичной сдачи** (по запросу на максимальный балл):
- **Recharts 2 → 3.** Recharts 2.15 под React 19 молча не отрисовывал `<Cell>`
  (столбцы и сегменты donut оставались нулевого размера). Обнаружено инспекцией DOM,
  не по скриншоту. Recharts 3.10 + `isAnimationActive={false}` — все три графика
  рендерятся корректно.
- **Фильтры дашборда (ТЗ §22):** выпадающий список — статус проекта / проект /
  сотрудник / статья, синхронизация с URL, сброс. API уже поддерживал эти параметры.
- **Zero-config demo:** `docker compose up` работает без `.env` — entrypoint
  генерирует временные секреты. Проверено на свежем `git clone`.
- **`deploy/vps-setup.sh`** — развёртывание на VPS одной командой.

**Правки по результатам внешнего ревью** (все — с новыми тестами):
- **`/api/bitrix/events`** проверяет `auth[application_token]` по сохранённому токену
  портала до деактивации / очистки токенов; событие без валидного токена → 401 и
  ничего не меняет.
- **OAuth-сессия:** входящий короткоживущий per-user `AUTH_ID` из placement больше
  не пишется в общий `authTokenEnc` портала (гонка: одновременный вход двух
  пользователей мог выдать одному сессию другого). `user.current` вызывается этим
  токеном напрямую (`callBitrixWithToken`), без сохранения.
- **Изоляция порталов при правке операции:** `PATCH` повторно проверяет
  проект/статью по порталу вызывающего — перенести операцию на проект чужого
  портала нельзя (было: проверка только при создании).
- **Округление до 2 знаков:** DTO отклоняет 3-й знак после запятой; сумма
  «часы × ставка» округляется до точности хранения перед умножением.
- **UI:** страница `/settings` (раньше пункт меню вёл на 404) — статус интеграции,
  данные портала, команда; форма правки операции подставляет исполнителя; ошибка
  дубля названия статьи показывается тостом, а не только в консоли.
- **Dev-инфраструктура:** `docker-compose.override.yml` публикует dev-БД только на
  `127.0.0.1` (на VPS используется `prod.yml`, где порт БД вообще не проброшен).

Обязательный функционал ТЗ реализован и покрыт тестами полностью. Открытые пункты —
только то, что **невозможно проверить без реального портала Bitrix24**:

- **Живой OAuth-хендшейк и вызовы `crm.item.*` / `user.get` против настоящего портала**
  не прогонялись (нет доступа к порталу). Код написан по актуальной REST-документации,
  покрыт unit/integration-тестами с замоканным `fetch` и demo-фолбэком. При появлении
  тестового портала достаточно задать `B24_CLIENT_ID/SECRET` и `DEMO_MODE=false`.
- **Смарт-процессы** как источник проекта — не реализованы (ТЗ помечает их как
  «дополнительно, если без ухудшения основного»); архитектура (`crmEntityTypeId: Int`)
  готова к добавлению без изменения схемы.
- Мелкое: на демо-скриншоте дашборда подпись значения на одном отрицательном столбце
  «Прибыль по проектам» частично налезает на подпись оси (косметика Recharts; значения
  читаемы, на hover — тултип). Не влияет на функциональность.

Ничего из обязательного не выдаётся за готовое сверх фактического состояния.
