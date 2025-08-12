import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabaseConfig {
  filename: string;
  mode?: number;
  verbose?: boolean;
}

export class Database {
  private db: sqlite3.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.filename);
      await fs.mkdir(dbDir, { recursive: true });

      // Create database connection
      await this.connect();

      // Run migrations
      await this.runMigrations();

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Connect to SQLite database
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const mode =
        this.config.mode || sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;

      this.db = new sqlite3.Database(this.config.filename, mode, (err) => {
        if (err) {
          console.error('Failed to connect to database:', err);
          reject(err);
        } else {
          if (this.config.verbose) {
            console.log(
              `Connected to SQLite database: ${this.config.filename}`
            );
          }

          // Enable foreign keys
          this.db!.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      // Define schema statements directly to avoid parsing issues
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          project_id TEXT,
          user_id TEXT,
          context_files TEXT,
          working_directory TEXT NOT NULL,
          gemini_config TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS code_blocks (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          language TEXT NOT NULL,
          content TEXT NOT NULL,
          filename TEXT,
          start_line INTEGER,
          end_line INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )`,

        'CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_code_blocks_message_id ON code_blocks(message_id)',

        `CREATE TRIGGER IF NOT EXISTS update_users_updated_at
          AFTER UPDATE ON users
          FOR EACH ROW
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

        `CREATE TRIGGER IF NOT EXISTS update_chat_sessions_updated_at
          AFTER UPDATE ON chat_sessions
          FOR EACH ROW
        BEGIN
          UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,
      ];

      // Execute each statement
      for (const statement of statements) {
        await this.run(statement);
      }

      console.log('Database migrations completed');
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Execute a SQL statement
   */
  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return first row
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return all rows
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    await this.run('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    await this.run('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    await this.run('ROLLBACK');
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction<T>(operations: () => Promise<T>): Promise<T> {
    await this.beginTransaction();

    try {
      const result = await operations();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null;
  }
}

// Create singleton database instance
const dbConfig: DatabaseConfig = {
  filename:
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'data', 'gemini-desk.db'),
  verbose: process.env.NODE_ENV === 'development',
};

export const database = new Database(dbConfig);
