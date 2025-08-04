import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chokidar from 'chokidar';
import os from 'os';
import {
  ChatSession,
  ChatMessage,
  GeminiCLISessionLog,
  GeminiConfig,
  SessionValidationError,
  SessionImportResult,
  CodeBlock,
} from '../types/session';

export class SessionManager {
  private geminiTmpDir: string;
  private watcher?: chokidar.FSWatcher;
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    this.geminiTmpDir = path.join(os.homedir(), '.gemini', 'tmp');
  }

  /**
   * Get a session by ID from Gemini CLI
   */
  async getSession(id: string): Promise<ChatSession | null> {
    // Check in-memory cache first
    if (this.sessions.has(id)) {
      return this.sessions.get(id)!;
    }

    // Try to load from Gemini CLI session directory
    try {
      const sessionPath = path.join(this.geminiTmpDir, id);
      const session = await this.loadGeminiCLISession(sessionPath);

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
   * Update session metadata (cached in memory only)
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

    this.sessions.set(id, updatedSession);
  }

  /**
   * Remove session from cache (Gemini CLI sessions cannot be deleted)
   */
  async removeFromCache(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /**
   * List all Gemini CLI sessions, optionally filtered by project
   */
  async listSessions(projectId?: string): Promise<ChatSession[]> {
    try {
      // Check if Gemini CLI tmp directory exists
      try {
        await fs.access(this.geminiTmpDir);
      } catch {
        console.log('Gemini CLI tmp directory not found');
        return [];
      }

      const entries = await fs.readdir(this.geminiTmpDir, {
        withFileTypes: true,
      });
      const sessionDirs = entries.filter((entry) => entry.isDirectory());

      const sessions: ChatSession[] = [];

      for (const dir of sessionDirs) {
        const sessionPath = path.join(this.geminiTmpDir, dir.name);
        const session = await this.loadGeminiCLISession(sessionPath);

        if (session && (!projectId || session.projectId === projectId)) {
          sessions.push(session);
        }
      }

      // Sort by updatedAt descending
      return sessions.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Load a Gemini CLI session from its directory
   */
  private async loadGeminiCLISession(
    sessionPath: string
  ): Promise<ChatSession | null> {
    try {
      const logsPath = path.join(sessionPath, 'logs.json');

      // Check if logs.json exists
      try {
        await fs.access(logsPath);
      } catch {
        return null;
      }

      // Read and parse logs.json
      const logsData = await fs.readFile(logsPath, 'utf-8');
      const logs: GeminiCLISessionLog[] = JSON.parse(logsData);

      // Validate logs structure
      const validationErrors = this.validateGeminiLogs(logs);
      if (validationErrors.length > 0) {
        console.warn(
          `Invalid logs in session ${path.basename(sessionPath)}:`,
          validationErrors
        );
        return null;
      }

      // Convert Gemini CLI logs to ChatMessages
      const messages: ChatMessage[] = logs.map((log) => ({
        id: uuidv4(),
        type: log.type as 'user' | 'assistant',
        content: log.message,
        timestamp: new Date(log.timestamp),
        metadata: {
          command:
            log.type === 'user' ? this.extractCommand(log.message) : undefined,
          codeBlocks:
            log.type === 'assistant'
              ? this.extractCodeBlocks(log.message)
              : undefined,
        },
      }));

      // Get session stats
      const stats = await fs.stat(sessionPath);
      const geminiSessionId = path.basename(sessionPath);

      const defaultConfig: GeminiConfig = {
        authMethod: 'api-key',
        credentials: {},
        model: 'gemini-pro',
        temperature: 0.7,
        maxTokens: 2048,
        mcpServers: [],
      };

      // Create session object
      const session: ChatSession = {
        id: geminiSessionId,
        name: `Gemini CLI: ${geminiSessionId.substring(0, 8)}`,
        geminiSessionId,
        messages,
        context: {
          files: [],
          workingDirectory: sessionPath,
          geminiConfig: defaultConfig,
        },
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };

      return session;
    } catch (error) {
      console.error(
        `Failed to load Gemini CLI session from ${sessionPath}:`,
        error
      );
      return null;
    }
  }

  /**
   * Import a specific Gemini CLI session (for manual import)
   */
  async importGeminiCLISession(
    sessionId: string
  ): Promise<SessionImportResult> {
    try {
      const sessionPath = path.join(this.geminiTmpDir, sessionId);
      const session = await this.loadGeminiCLISession(sessionPath);

      if (!session) {
        return {
          success: false,
          errors: [
            { field: 'sessionId', message: 'Session not found or invalid' },
          ],
        };
      }

      // Cache the session
      this.sessions.set(sessionId, session);

      return {
        success: true,
        session,
        warnings:
          session.messages.length === 0
            ? ['Session imported but no messages found']
            : undefined,
      };
    } catch (error) {
      console.error('Failed to import Gemini CLI session:', error);
      return {
        success: false,
        errors: [
          {
            field: 'import',
            message:
              error instanceof Error ? error.message : 'Unknown import error',
          },
        ],
      };
    }
  }

  /**
   * Synchronize with Gemini CLI sessions
   */
  async syncWithGeminiCLI(): Promise<void> {
    try {
      // Check if Gemini CLI tmp directory exists
      try {
        await fs.access(this.geminiTmpDir);
      } catch {
        console.log('Gemini CLI tmp directory not found, skipping sync');
        return;
      }

      const entries = await fs.readdir(this.geminiTmpDir, {
        withFileTypes: true,
      });
      const sessionDirs = entries.filter((entry) => entry.isDirectory());

      for (const dir of sessionDirs) {
        const sessionPath = path.join(this.geminiTmpDir, dir.name);

        // Check if we already have this session cached
        if (!this.sessions.has(dir.name)) {
          console.log(`Loading new Gemini CLI session: ${dir.name}`);
          const session = await this.loadGeminiCLISession(sessionPath);

          if (session) {
            this.sessions.set(dir.name, session);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync with Gemini CLI:', error);
    }
  }

  /**
   * Start watching for new Gemini CLI sessions
   */
  startWatching(): void {
    if (this.watcher) {
      return; // Already watching
    }

    try {
      this.watcher = chokidar.watch(this.geminiTmpDir, {
        ignored: /[\/\\]\./,
        persistent: true,
        ignoreInitial: true,
      });

      this.watcher.on('addDir', async (dirPath) => {
        // New session directory created
        const sessionId = path.basename(dirPath);
        console.log(`New Gemini CLI session detected: ${sessionId}`);

        // Wait a bit for the session to be fully created
        setTimeout(async () => {
          const session = await this.loadGeminiCLISession(dirPath);
          if (session) {
            this.sessions.set(sessionId, session);
            console.log(`Successfully loaded new session: ${sessionId}`);
          } else {
            console.error(`Failed to load new session: ${sessionId}`);
          }
        }, 1000);
      });

      console.log('Started watching for new Gemini CLI sessions');
    } catch (error) {
      console.error('Failed to start watching Gemini CLI sessions:', error);
    }
  }

  /**
   * Stop watching for new sessions
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      console.log('Stopped watching for Gemini CLI sessions');
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

  /**
   * Validate Gemini CLI logs structure
   */
  private validateGeminiLogs(logs: any[]): SessionValidationError[] {
    const errors: SessionValidationError[] = [];

    if (!Array.isArray(logs)) {
      errors.push({ field: 'logs', message: 'Logs must be an array' });
      return errors;
    }

    logs.forEach((log, index) => {
      if (!log.sessionId) {
        errors.push({
          field: `logs[${index}].sessionId`,
          message: 'Session ID is required',
        });
      }
      if (!log.type || !['user', 'assistant'].includes(log.type)) {
        errors.push({
          field: `logs[${index}].type`,
          message: 'Type must be "user" or "assistant"',
        });
      }
      if (!log.message) {
        errors.push({
          field: `logs[${index}].message`,
          message: 'Message is required',
        });
      }
      if (!log.timestamp) {
        errors.push({
          field: `logs[${index}].timestamp`,
          message: 'Timestamp is required',
        });
      }
    });

    return errors;
  }

  /**
   * Extract command from user message
   */
  private extractCommand(message: string): string | undefined {
    // Look for slash commands
    const slashCommandMatch = message.match(/^\/(\w+)/);
    if (slashCommandMatch) {
      return slashCommandMatch[1];
    }
    return undefined;
  }

  /**
   * Extract code blocks from assistant message
   */
  private extractCodeBlocks(message: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(message)) !== null) {
      codeBlocks.push({
        id: uuidv4(),
        language: match[1] || 'text',
        content: match[2].trim(),
      });
    }

    return codeBlocks;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
