import express from 'express';
import { sessionManager } from '../services/sessionManager.js';
import { ChatSession, ChatMessage } from '../types/session.js';

const router = express.Router();

/**
 * GET /api/sessions
 * List all chat sessions, optionally filtered by project
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    const sessions = await sessionManager.listSessions(
      projectId as string | undefined
    );
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions'
    });
  }
});

/**
 * GET /api/sessions/:id
 * Get a specific chat session by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * POST /api/sessions
 * Create a new chat session
 */
router.post('/', async (req, res) => {
  try {
    const sessionData = req.body as Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>;
    
    // Validate required fields
    if (!sessionData.name || !sessionData.context?.workingDirectory) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name and context.workingDirectory'
      });
    }
    
    const session = await sessionManager.createSession(sessionData);
    
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * PUT /api/sessions/:id
 * Update a chat session
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<ChatSession>;
    
    await sessionManager.updateSession(id, updates);
    
    const updatedSession = await sessionManager.getSession(id);
    
    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    console.error('Failed to update session:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update session'
    });
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a chat session
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const session = await sessionManager.getSession(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    await sessionManager.removeSession(id);
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
});

/**
 * POST /api/sessions/:id/messages
 * Add a message to a chat session
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messageData = req.body as Omit<ChatMessage, 'id'>;
    
    // Validate required fields
    if (!messageData.type || !messageData.content || !messageData.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, content, timestamp'
      });
    }
    
    const message = await sessionManager.addMessage(id, messageData);
    
    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Failed to add message:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});



export { router as sessionsRouter };