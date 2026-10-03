import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getDatabase } from './db/database.js';
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { createApiRouter } from './api/routes.js';
import { createAuthRouter } from './api/auth.js';
import { SupabaseSyncService } from './services/supabase_sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createApp(dbInstance?: any) {
  const app = express();
  const db = dbInstance || getDatabase();

  initializeSchema(db);

  // Behind Render's TLS-terminating proxy: correct client IPs (rate limiting)
  // and Secure cookies.
  app.set('trust proxy', 1);

  // S-3: security headers. CSP is disabled for now because the PWA uses inline
  // styles extensively; enabling CSP requires a style-attribute refactor first.
  // CORP/COOP disabled 2026-10-03: cross-origin-resource-policy: same-origin
  // broke ES module loading through the service worker in production
  // (Chromium refused to evaluate the app module). Revisit with COEP/CORP
  // tuning once module delivery is verified stable.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  }));
  app.use(cookieParser());

  // Sync with Supabase Cloud if configured
  SupabaseSyncService.syncFromSupabase(db).catch(err => {
    console.warn('⚠️ [SUPABASE] Error durante sincronización inicial:', err.message);
  });

  // Seed database only if explicitly requested (e.g. SEED_DATABASE=true) or in test suite
  if (process.env.SEED_DATABASE === 'true' || process.env.NODE_ENV === 'test') {
    seedDatabase(db);
  }

  // S-2: CORS locked to known origins (env CORS_ORIGINS, comma-separated).
  // Same-origin PWA traffic is unaffected; this blocks foreign sites from
  // calling the API with the user's cookies.
  const allowedOrigins = (process.env.CORS_ORIGINS ||
    'https://protokol-1.onrender.com,https://protokol-c8eb.onrender.com,http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check (Render health checks + uptime monitors). Public.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'protokol', time: new Date().toISOString() });
  });

  // API Routes
  app.use('/api', createAuthRouter(db));
  app.use('/api', createApiRouter(db));

  // Serve static files for PWA
  const publicDir = path.join(rootDir, 'public');
  app.use(express.static(publicDir));

  // Fallback for SPA routing to index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return next();
  });

  return { app, db };
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const { app, db } = createApp();
  const server = app.listen(config.port, config.host, () => {
    const projectCount = db.prepare('SELECT count(*) as count FROM projects').get() as { count: number };
    console.log(`====================================================`);
    console.log(`🚀 PROTOKOL Phase 0 Server Running`);
    console.log(`📍 URL: http://${config.host}:${config.port}`);
    console.log(`📁 Configured Projects: ${projectCount.count}`);
    console.log(`⏱ Default Timezone: ${config.defaultTimezoneName} (${config.defaultTimezoneOffset})`);
    console.log(`📱 PWA Field Client: Ready on root URL`);
    console.log(`====================================================`);
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}
