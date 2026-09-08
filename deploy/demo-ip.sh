#!/usr/bin/env bash
# Quick public demo on a VPS by IP (no domain, no nginx). Safe next to other apps.
# Run from the repo root:  APP_PORT=8080 bash deploy/demo-ip.sh
set -euo pipefail
cd "$(dirname "$0")/.."

APP_PORT="${APP_PORT:-8080}"
PUBLIC_IP="${PUBLIC_IP:-$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

command -v docker >/dev/null || { echo "install docker first: curl -fsSL https://get.docker.com | sh"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing"; exit 1; }

# pick a free port if the requested one is taken
while ss -ltn "( sport = :$APP_PORT )" 2>/dev/null | grep -q LISTEN; do
  echo "port $APP_PORT is taken, trying $((APP_PORT+1))"
  APP_PORT=$((APP_PORT+1))
done

if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL="postgresql://economics:economics@db:5432/economics?schema=public"
APP_URL="http://${PUBLIC_IP}:${APP_PORT}"
NODE_ENV="production"
SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
APP_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
DEMO_MODE="true"
APP_PORT="${APP_PORT}"
EOF
else
  # keep an existing .env but make sure APP_URL/APP_PORT match this run
  sed -i "s|^APP_URL=.*|APP_URL=\"http://${PUBLIC_IP}:${APP_PORT}\"|" .env || true
  grep -q '^APP_PORT=' .env && sed -i "s|^APP_PORT=.*|APP_PORT=\"${APP_PORT}\"|" .env || echo "APP_PORT=\"${APP_PORT}\"" >> .env
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.demo.yml"
echo "→ ${COMPOSE} up -d --build   (APP_PORT=${APP_PORT})"
APP_PORT="${APP_PORT}" ${COMPOSE} up -d --build

cid="$(${COMPOSE} ps -q app)"
for _ in $(seq 1 40); do
  s="$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
  [ "$s" = "healthy" ] && break
  sleep 3
done

echo
echo "✅ Демо: http://${PUBLIC_IP}:${APP_PORT}"
echo "   (переключатель ролей — слева внизу; данные демо-портала уже загружены)"
echo
echo "Управление:  ${COMPOSE} ps | logs -f app | down"
