#!/usr/bin/env bash
# One-command production bring-up on a VPS (safe next to an existing app).
# Run from the repo root:  bash deploy/vps-setup.sh
#
#   APP_URL   public URL (default http://<server>:<APP_PORT>)
#   APP_PORT  loopback host port for the app (default 3000; change if taken)
#   DEMO_MODE "true" (default) or "false" for a real Bitrix24 install
#
# What it does:
#   - creates .env with generated secrets (keeps an existing .env)
#   - builds + starts app + PostgreSQL, bound to 127.0.0.1 only (nginx is the entrypoint)
#   - PostgreSQL port is never published; `prisma migrate deploy` runs on container start

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
APP_PORT="${APP_PORT:-3000}"

command -v docker >/dev/null || { echo "docker is not installed"; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin is not installed"; exit 1; }

if [ ! -f .env ]; then
  echo "→ generating .env"
  cat > .env <<EOF
DATABASE_URL="postgresql://economics:economics@db:5432/economics?schema=public"
APP_URL="${APP_URL:-http://localhost:${APP_PORT}}"
NODE_ENV="production"
SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
APP_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
B24_CLIENT_ID=""
B24_CLIENT_SECRET=""
DEMO_MODE="${DEMO_MODE:-true}"
APP_PORT="${APP_PORT}"
EOF
  echo "  .env created (secrets generated)"
else
  echo "→ .env already exists — leaving it as is"
fi

echo "→ ${COMPOSE} up -d --build"
APP_PORT="${APP_PORT}" ${COMPOSE} up -d --build

echo "→ waiting for the app to become healthy"
cid="$(${COMPOSE} ps -q app)"
for _ in $(seq 1 40); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && { echo "✅ app is healthy on 127.0.0.1:${APP_PORT}"; break; }
  sleep 3
done

echo
echo "Done. The app listens on http://127.0.0.1:${APP_PORT} (loopback only)."
echo "Next:"
echo "  • point nginx at 127.0.0.1:${APP_PORT} — see deploy/nginx.example.conf"
echo "  • for a real Bitrix24 install: set APP_URL=https://<domain>, B24_CLIENT_ID/SECRET,"
echo "    DEMO_MODE=false in .env, then re-run this script"
