# VPS Deployment

Target: a single Linux VPS running Docker + Docker Compose, behind nginx with TLS.

## 1. Prerequisites

- Docker Engine + Docker Compose plugin
- A domain pointing at the VPS (e.g. `economics.example.com`)
- nginx + certbot on the host (or run nginx in a container — not covered here)

## 2. Configure

```bash
git clone <repo> /opt/economics && cd /opt/economics
cp .env.example .env
```

Edit `.env`:

| var | value |
|---|---|
| `DATABASE_URL` | `postgresql://economics:economics@db:5432/economics?schema=public` (matches compose) |
| `APP_URL` | `https://economics.example.com` |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` (exactly 32 bytes) |
| `B24_CLIENT_ID` / `B24_CLIENT_SECRET` | from the Bitrix24 local app (see main README) |
| `DEMO_MODE` | `false` for a real Bitrix24 install |

## 3. Run

One command (safe next to an app that already runs on the server):

```bash
APP_PORT=3000 bash deploy/vps-setup.sh
```

It creates `.env` with generated secrets and starts the stack with the production
override:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- the app is bound to **127.0.0.1:$APP_PORT** only (nginx is the public entrypoint) —
  change `APP_PORT` if 3000 is taken;
- PostgreSQL runs in its own container and its port is **not** published;
- the app container runs `prisma migrate deploy` on every boot (never `db push`).

Check health:

```bash
curl -f http://127.0.0.1:3000/api/health   # {"status":"ok"}
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## 4. Reverse proxy

```bash
cp deploy/nginx.example.conf /etc/nginx/sites-available/economics.conf
# edit server_name + cert paths
ln -s /etc/nginx/sites-available/economics.conf /etc/nginx/sites-enabled/
certbot --nginx -d economics.example.com
nginx -t && systemctl reload nginx
```

## 5. Updates

```bash
cd /opt/economics && git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrations apply automatically on container start. To run one-off commands:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec app node_modules/.bin/prisma migrate status
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec app node prisma/seed.mjs      # re-seed demo (idempotent)
```

## 6. Backups

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db pg_dump -U economics economics | gzip > backup-$(date +%F).sql.gz
```
