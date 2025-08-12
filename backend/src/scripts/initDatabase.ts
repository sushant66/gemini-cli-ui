#!/usr/bin/env node

/**
 * Database initialization script
 * This script initializes the SQLite database with the required schema
 */

import { database } from '../database/database.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  try {
    console.log('Initializing Gemini Desk database...');
    
    // Initialize database (this will create tables and run migrations)
    await database.initialize();
    
    console.log('✅ Database initialized successfully');
    console.log(`📁 Database location: ${process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'gemini-desk.db')}`);
    
    // Close database connection
    await database.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };