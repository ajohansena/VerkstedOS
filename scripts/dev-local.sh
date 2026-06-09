#!/usr/bin/env bash
#
# dev-local.sh — start the local development server, ready to use by hand.
#
# Wired to `pnpm branch` / `npm run branch`. It:
#   1. ensures the local Postgres container (verkstedos-pg) is running,
#   2. stops any stale Next.js dev server,
#   3. starts `next dev` with the DEV auth bypass enabled so you land straight
#      on the Operations Center as the bootstrapped owner account.
#
# The DEV auth bypass is development-only (gated on NODE_ENV !== 'production')
# and must NEVER ship to production.
set -euo pipefail

cd "$(dirname "$0")/.."

DEV_LOGIN_EMAIL="${DEV_AUTO_LOGIN_EMAIL:-ajohansena@gmail.com}"

# 1. Local database container.
if command -v docker >/dev/null 2>&1; then
  if [ -n "$(docker ps -aq -f name='^verkstedos-pg$')" ]; then
    docker start verkstedos-pg >/dev/null 2>&1 || true
  fi
fi

# 2. Stop any stale dev server so port 3000 is free.
pkill -9 -f 'next dev' 2>/dev/null || true
pkill -9 -f 'next-server' 2>/dev/null || true
sleep 1

# 3. Load .env.local (next loads it too, but this makes the values available to
#    anything spawned here) and start the dev server in the foreground.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

echo "▶ Starting VerkstedOS dev server (auto-login: ${DEV_LOGIN_EMAIL})"
echo "  → http://localhost:3000"
DEV_AUTO_LOGIN_EMAIL="${DEV_LOGIN_EMAIL}" exec pnpm dev
