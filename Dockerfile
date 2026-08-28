FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    RAILETA_DATA_DIR=/data \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip nginx gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements-prod.txt ./backend/requirements-prod.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r backend/requirements-prod.txt

COPY backend ./backend
COPY simulator ./simulator
COPY frontend ./frontend
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY raileta.db trains.json stations.json schedules.json ./
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]
