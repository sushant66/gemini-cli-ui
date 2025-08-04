import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';

const router = Router();

// Get all sessions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const sessions = await sessionManager.listSessions(projectId as string);
    res.json({ sessions });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific session
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${id} does not exist`,
      });
    }

    res.json({ session });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import a Gemini CLI session
router.post('/import/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const result = await sessionManager.importGeminiCLISession(sessionId);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Import failed',
        errors: result.errors,
      });
    }

    res.status(201).json({
      success: true,
      session: result.session,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Failed to import session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a session
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate the session exists
    const existingSession = await sessionManager.getSession(id);
    if (!existingSession) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${id} does not exist`,
      });
    }

    // Validate the updates
    const validationErrors = sessionManager.validateSession({ ...existingSession, ...updates });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validationErrors,
      });
    }

    await sessionManager.updateSession(id, updates);
    const updatedSession = await sessionManager.getSession(id);
    
    res.json({ session: updatedSession });
  } catch (error) {
    console.error('Failed to update session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Remove session from cache
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate the session exists
    const existingSession = await sessionManager.getSession(id);
    if (!existingSession) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${id} does not exist`,
      });
    }

    await sessionManager.removeFromCache(id);
    res.json({ 
      success: true,
      message: `Session ${id} removed from cache`,
    });
  } catch (error) {
    console.error('Failed to remove session from cache:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});



// Sync with Gemini CLI sessions
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    await sessionManager.syncWithGeminiCLI();
    res.json({
      success: true,
      message: 'Synchronization completed',
    });
  } catch (error) {
    console.error('Failed to sync sessions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get messages from a session (read-only)
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${id} does not exist`,
      });
    }

    res.json({ messages: session.messages });
  } catch (error) {
    console.error('Failed to get messages:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get session validation status
router.get('/:id/validate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session with ID ${id} does not exist`,
      });
    }

    const validationErrors = sessionManager.validateSession(session);
    
    res.json({
      valid: validationErrors.length === 0,
      errors: validationErrors,
    });
  } catch (error) {
    console.error('Failed to validate session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as sessionsRouter };