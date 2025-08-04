import dotenv from 'dotenv';
import { createServer } from './server';
import { sessionManager } from './services/sessionManager';
import { projectManager } from './services/projectManager';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Create and configure the Express server
const app = createServer();

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Gemini Desk backend server running on port ${PORT}`);
  
  // Initialize project management
  try {
    await projectManager.initialize();
    console.log('Project manager initialized');
  } catch (error) {
    console.error('Failed to initialize project manager:', error);
  }
  
  // Initialize session management
  sessionManager.startWatching();
  sessionManager.syncWithGeminiCLI().catch(error => {
    console.error('Failed to sync with Gemini CLI sessions:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  sessionManager.stopWatching();
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  sessionManager.stopWatching();
  server.close(() => {
    console.log('Process terminated');
  });
});

export { server };
