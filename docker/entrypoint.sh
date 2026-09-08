#!/bin/sh
set -e

# Apply pending migrations (never `db push` in production — ТЗ §4).
echo "→ prisma migrate deploy"
node_modules/.bin/prisma migrate deploy

# In demo mode, provision the demo portal on first boot (idempotent).
if [ "$DEMO_MODE" = "true" ]; then
  echo "→ seeding demo portal (idempotent)"
  node prisma/seed.mjs || echo "seed skipped/failed (non-fatal)"
fi

echo "→ starting: $*"
exec "$@"
