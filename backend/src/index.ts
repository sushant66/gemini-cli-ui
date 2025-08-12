import dotenv from 'dotenv';
import { createServer } from './server';
import { sessionManager } from './services/sessionManager';
import { projectManager } from './services/projectManager';
import { database } from './database/database.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Create and configure the Express server
const app = createServer();

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Gemini Desk backend server running on port ${PORT}`);
  
  // Initialize database
  try {
    await database.initialize();
    console.log('Database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  // Initialize project management
  try {
    await projectManager.initialize();
    console.log('Project manager initialized');
  } catch (error) {
    console.error('Failed to initialize project manager:', error);
  }
  
  // Initialize session management
  console.log('Session manager initialized');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await database.close();
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await database.close();
  server.close(() => {
    console.log('Process terminated');
  });
});

export { server };
