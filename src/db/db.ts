import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DB_PATH } from '../config';
import { ensureDir } from '../util/fs';
import { logger } from '../logging/logger';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    ensureDir(path.dirname(DB_PATH));
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
          database.exec(sql);
      } catch (e: any) {
          // Ignore "duplicate column" or "table exists" errors which happen on re-run
          // For a robust system we should track applied migrations in a table.
          // Getting "duplicate column" for 002 is expected on 2nd run.
          if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) {
              logger.warn(`Migration ${file} failed (might be already applied)`, { error: e.message });
          }
      }
  }
}

export function closeDb() {
  if (db) {
    db.close();
  }
}
