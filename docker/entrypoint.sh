#!/bin/sh
set -e

# ── Zero-config demo: generate ephemeral secrets if none were provided ────────
# In a real Bitrix24 install you MUST set persistent SESSION_SECRET / APP_ENCRYPTION_KEY
# in .env (otherwise sessions drop and stored Bitrix tokens become unreadable on restart).
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64"))')"
  export SESSION_SECRET
  echo "⚠ SESSION_SECRET not set — generated an ephemeral one (demo only)."
fi
if [ -z "$APP_ENCRYPTION_KEY" ]; then
  APP_ENCRYPTION_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  export APP_ENCRYPTION_KEY
  echo "⚠ APP_ENCRYPTION_KEY not set — generated an ephemeral one (demo only)."
fi

# ── Migrations (never `db push` in production — ТЗ §4) ───────────────────────
echo "→ prisma migrate deploy"
./node_modules/.bin/prisma migrate deploy

# ── Demo seed (idempotent) ──────────────────────────────────────────────────
if [ "$DEMO_MODE" = "true" ]; then
  echo "→ seeding demo portal (idempotent)"
  node prisma/seed.mjs || echo "seed skipped/failed (non-fatal)"
fi

echo "→ starting: $*"
exec "$@"
