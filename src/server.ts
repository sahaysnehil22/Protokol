import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getDatabase } from './db/database.js';
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { createApiRouter } from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createApp(dbInstance?: any) {
  const app = express();
  const db = dbInstance || getDatabase();

  initializeSchema(db);
  seedDatabase(db);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
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
  const { app } = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`====================================================`);
    console.log(`🚀 PROTOKOL Phase 0 Server Running`);
    console.log(`📍 URL: http://${config.host}:${config.port}`);
    console.log(`📁 Project: ${config.pilotProjectName} (${config.pilotProjectId})`);
    console.log(`⏱ Timezone: ${config.projectTimezoneName} (${config.projectTimezoneOffset})`);
    console.log(`📱 PWA Field Client: Ready on root URL`);
    console.log(`====================================================`);
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}
