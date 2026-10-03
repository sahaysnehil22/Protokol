import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export type Database = DatabaseSync;

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbFilePath?: string): DatabaseSync {
  if (dbInstance && !dbFilePath) {
    return dbInstance;
  }

  const targetPath = dbFilePath || config.dbPath;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Enforce WAL mode and foreign key constraints
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');
  // R-5 (2026-10-03): wait instead of instantly failing on a locked DB when a
  // second writer (backup, sync, another process) holds the lock.
  db.exec('PRAGMA busy_timeout = 5000;');

  if (!dbFilePath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
