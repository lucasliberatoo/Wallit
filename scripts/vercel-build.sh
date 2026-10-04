#!/usr/bin/env bash
# Vercel build: with a database connected, migrate it, create the demo family
# and point the web app at the API. Without one, publish the offline demo.
set -euo pipefail

if [ -n "${DATABASE_URL:-${POSTGRES_URL:-}}" ]; then
  npm run db:migrate
  npm run db:seed
  export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-/api}"
  echo "Building web app against ${EXPO_PUBLIC_API_URL}"
else
  echo "No DATABASE_URL: building the offline demo"
fi

npm run build:web
