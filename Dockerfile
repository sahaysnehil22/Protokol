# PROTOKOL — production image (H-11: reproducible deploys)
FROM node:24-slim

# sqlite native module needs build tools only at install; keep image lean
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY index.js ./

RUN npx tsc

# Run as non-root
RUN useradd -m -u 10001 appuser \
  && mkdir -p /app/data /app/public/uploads /app/public/pdfs /app/public/dossiers \
  && chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/protokol.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
