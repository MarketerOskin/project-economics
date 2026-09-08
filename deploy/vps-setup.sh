#!/usr/bin/env bash
# One-command production bring-up on a VPS. Run from the repo root:
#   bash deploy/vps-setup.sh
#
# - creates .env with freshly generated secrets (keeps an existing .env untouched)
# - builds and starts the stack (app + PostgreSQL) via docker compose
# - runs `prisma migrate deploy` automatically on container start
#
# After it finishes: point nginx at 127.0.0.1:3000 (see deploy/nginx.example.conf)
# and set APP_URL / B24_CLIENT_ID / B24_CLIENT_SECRET / DEMO_MODE=false in .env
# for a real Bitrix24 install, then: docker compose up -d --build

set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "docker is not installed"; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin is not installed"; exit 1; }

if [ ! -f .env ]; then
  echo "→ generating .env"
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  APP_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  cat > .env <<EOF
DATABASE_URL="postgresql://economics:economics@db:5432/economics?schema=public"
APP_URL="${APP_URL:-http://localhost:3000}"
NODE_ENV="production"
SESSION_SECRET="${SESSION_SECRET}"
APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY}"
B24_CLIENT_ID=""
B24_CLIENT_SECRET=""
DEMO_MODE="${DEMO_MODE:-true}"
EOF
  echo "  .env created (SESSION_SECRET / APP_ENCRYPTION_KEY generated)"
else
  echo "→ .env already exists — leaving it as is"
fi

echo "→ docker compose up -d --build"
docker compose up -d --build

echo "→ waiting for the app to become healthy"
for _ in $(seq 1 40); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && { echo "✅ app is healthy"; break; }
  sleep 3
done

echo
echo "Done. The app is on http://127.0.0.1:3000 (behind your reverse proxy)."
echo "Next:"
echo "  • edit .env: APP_URL=https://<your-domain>, B24_CLIENT_ID/SECRET, DEMO_MODE=false"
echo "  • cp deploy/nginx.example.conf /etc/nginx/sites-available/economics.conf, adjust, symlink"
echo "  • certbot --nginx -d <your-domain>"
echo "  • docker compose up -d --build   (to apply .env changes)"
