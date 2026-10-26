FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false
COPY backend backend
RUN npm run db:generate --workspace backend
USER node
CMD ["sh","-c","npm run db:migrate --workspace backend && npm run start --workspace backend"]
