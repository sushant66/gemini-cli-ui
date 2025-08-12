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
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.filename);
      await fs.mkdir(dbDir, { recursive: true });

      // Create database connection
      await this.connect();

      // Create tables and indexes (will be skipped if they already exist)
      await this.createSchema();

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
   * Create database schema (tables, indexes, triggers)
   */
  private async createSchema(): Promise<void> {
    try {
      // Read schema from SQL file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSQL = await fs.readFile(schemaPath, 'utf-8');

      // Execute the entire SQL file using sqlite3's exec method
      await this.exec(schemaSQL);

      console.log('Database schema created');
    } catch (error) {
      console.error('Failed to create schema:', error);
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
   * Execute multiple SQL statements from a string
   */
  async exec(sql: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
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
