import { Router, Request, Response } from 'express';
import { cliExecutor, CLIExecutionRequest } from '../services/cliExecutor';
import { sessionsRouter } from './sessions';
import { projectsRouter } from './projects';

const router = Router();

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gemini-desk-api',
    uptime: process.uptime(),
  });
});

// Chat endpoints (placeholder for future implementation)
router.get('/chats', (_req: Request, res: Response) => {
  res.json({ message: 'Chat endpoints not yet implemented' });
});

// Session endpoints
router.use('/sessions', sessionsRouter);

// Project endpoints
router.use('/projects', projectsRouter);

// File system endpoints (placeholder for future implementation)
router.get('/files', (_req: Request, res: Response) => {
  res.json({ message: 'File system endpoints not yet implemented' });
});

// CLI execution endpoints
router.post('/cli/execute', async (req: Request, res: Response) => {
  try {
    const {
      command,
      args,
      workingDirectory,
      sessionId,
      timeout,
    }: CLIExecutionRequest = req.body;

    // Validate required fields
    if (!command || !args || !workingDirectory || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['command', 'args', 'workingDirectory', 'sessionId'],
      });
    }

    const result = await cliExecutor.executeCommand({
      command,
      args,
      workingDirectory,
      sessionId,
      timeout,
    });

    res.json(result);
  } catch (error) {
    console.error('CLI execution error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start new chat session
router.post('/cli/chat/new', async (req: Request, res: Response) => {
  try {
    const { workingDirectory, timeout } = req.body;

    const result = await cliExecutor.startNewChatSession({
      workingDirectory,
      timeout,
    });

    res.json(result);
  } catch (error) {
    console.error('New chat session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Send message to chat session
router.post('/cli/chat/:sessionId/message', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message, workingDirectory } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Missing required field: message',
      });
    }

    const result = await cliExecutor.sendMessageToSession(
      sessionId,
      message,
      workingDirectory
    );

    res.json(result);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Kill running CLI process
router.post('/cli/kill/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const killed = cliExecutor.killProcess(sessionId);

    res.json({
      success: killed,
      message: killed
        ? 'Process killed successfully'
        : 'Process not found or already terminated',
    });
  } catch (error) {
    console.error('CLI kill error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get active CLI processes
router.get('/cli/processes', (_req: Request, res: Response) => {
  try {
    const activeProcesses = cliExecutor.getActiveProcesses();
    res.json({ activeProcesses });
  } catch (error) {
    console.error('CLI processes error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Settings endpoints (placeholder for future implementation)
router.get('/settings', (_req: Request, res: Response) => {
  res.json({ message: 'Settings endpoints not yet implemented' });
});

// MCP server endpoints (placeholder for future implementation)
router.get('/mcp/servers', (_req: Request, res: Response) => {
  res.json({ message: 'MCP server endpoints not yet implemented' });
});

export { router as apiRouter };
