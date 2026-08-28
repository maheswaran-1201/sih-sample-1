#!/usr/bin/env bash
set -euo pipefail

export PORT="${PORT:-8080}"
export RAILETA_DATA_DIR="${RAILETA_DATA_DIR:-/data}"
mkdir -p "$RAILETA_DATA_DIR"
if [ ! -f "$RAILETA_DATA_DIR/raileta.db" ]; then
  cp /app/raileta.db "$RAILETA_DATA_DIR/raileta.db"
fi

envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -t

echo "[RailETA] Starting FastAPI Backend on 127.0.0.1:8000..."
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
backend_pid=$!

echo "[RailETA] Starting Next.js Frontend on 127.0.0.1:3000..."
(cd /app/frontend && npx next start -H 127.0.0.1 -p 3000) &
frontend_pid=$!

echo "[RailETA] Waiting for Backend readiness on port 8000..."
for i in $(seq 1 45); do
  if python3 -c "import socket; s = socket.socket(); s.connect(('127.0.0.1', 8000)); s.close()" 2>/dev/null; then
    echo "[RailETA] Backend is ready."
    break
  fi
  sleep 1
done

echo "[RailETA] Waiting for Frontend readiness on port 3000..."
for i in $(seq 1 45); do
  if python3 -c "import socket; s = socket.socket(); s.connect(('127.0.0.1', 3000)); s.close()" 2>/dev/null; then
    echo "[RailETA] Frontend is ready."
    break
  fi
  sleep 1
done

echo "[RailETA] Launching Nginx Reverse Proxy on port ${PORT}..."
nginx -g 'daemon off;' &
proxy_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" "$proxy_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait -n "$backend_pid" "$frontend_pid" "$proxy_pid"
