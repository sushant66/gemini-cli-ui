import { v4 as uuidv4 } from 'uuid';
import {
  ChatSession,
  ChatMessage,
  SessionValidationError,
} from '../types/session';
import { dal } from '../database/dal.js';

export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    // No initialization needed for database-only session management
  }

  /**
   * Get a session by ID from database
   */
  async getSession(id: string): Promise<ChatSession | null> {
    try {
      // Check in-memory cache first
      if (this.sessions.has(id)) {
        return this.sessions.get(id)!;
      }

      // Get from database
      const session = await dal.getChatSessionById(id);
      
      if (session) {
        this.sessions.set(id, session);
      }

      return session;
    } catch (error) {
      console.error(`Failed to load session ${id}:`, error);
      return null;
    }
  }

  /**
   * Update session metadata in database and cache
   */
  async updateSession(
    id: string,
    updates: Partial<ChatSession>
  ): Promise<void> {
    const session = await this.getSession(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const updatedSession: ChatSession = {
      ...session,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date(),
    };

    // Update in database
    await dal.updateChatSession(id, updatedSession);
    
    // Update cache
    this.sessions.set(id, updatedSession);
  }

  /**
   * Create a new chat session
   */
  async createSession(sessionData: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChatSession> {
    const session: ChatSession = {
      id: uuidv4(),
      ...sessionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await dal.createChatSession(session);
    
    // Save messages to database
    for (const message of session.messages) {
      await dal.createMessage(message, session.id);
    }

    // Cache the session
    this.sessions.set(session.id, session);

    return session;
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const newMessage: ChatMessage = {
      id: uuidv4(),
      ...message,
    };

    // Save message to database
    await dal.createMessage(newMessage, sessionId);

    // Update session in cache
    session.messages.push(newMessage);
    session.updatedAt = new Date();
    this.sessions.set(sessionId, session);

    // Update session timestamp in database
    await dal.updateChatSession(sessionId, { updatedAt: session.updatedAt });

    return newMessage;
  }

  /**
   * Remove session from database and cache
   */
  async removeSession(id: string): Promise<void> {
    // Remove from database
    await dal.deleteChatSession(id);
    
    // Remove from cache
    this.sessions.delete(id);
  }

  /**
   * Remove session from cache only (for Gemini CLI sessions that cannot be deleted)
   */
  async removeFromCache(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /**
   * List all sessions from database, optionally filtered by project
   */
  async listSessions(projectId?: string): Promise<ChatSession[]> {
    try {
      // Get sessions from database
      const sessions = await dal.listChatSessions(projectId);
      
      // Update cache
      for (const session of sessions) {
        this.sessions.set(session.id, session);
      }

      return sessions;
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }



  /**
   * Validate session data
   */
  validateSession(session: Partial<ChatSession>): SessionValidationError[] {
    const errors: SessionValidationError[] = [];

    if (!session.id) {
      errors.push({ field: 'id', message: 'Session ID is required' });
    }

    if (!session.name || session.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Session name is required' });
    }

    if (!session.context) {
      errors.push({ field: 'context', message: 'Session context is required' });
    } else {
      if (!session.context.workingDirectory) {
        errors.push({
          field: 'context.workingDirectory',
          message: 'Working directory is required',
        });
      }
    }

    if (!session.messages || !Array.isArray(session.messages)) {
      errors.push({ field: 'messages', message: 'Messages must be an array' });
    }

    return errors;
  }


}

// Export singleton instance
export const sessionManager = new SessionManager();
