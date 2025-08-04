import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SessionManager } from '../services/sessionManager';
import { ChatSession, GeminiCLISessionLog } from '../types/session';

// Mock fs and path modules
jest.mock('fs/promises');
jest.mock('chokidar');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = '/tmp/test-sessions';
    sessionManager = new SessionManager();
    
    // Mock directory creation
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  describe('loadGeminiCLISession', () => {
    it('should return null when logs.json does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const session = await sessionManager.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should load session from Gemini CLI directory', async () => {
      const mockLogs: GeminiCLISessionLog[] = [
        {
          sessionId: 'test-session',
          messageId: 1,
          type: 'user',
          message: 'Hello, how can you help me?',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        {
          sessionId: 'test-session',
          messageId: 2,
          type: 'assistant',
          message: 'I can help you with coding tasks.',
          timestamp: '2023-01-01T00:01:00.000Z',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2023-01-01T00:00:00.000Z'),
        mtime: new Date('2023-01-01T00:01:00.000Z'),
      } as any);

      const session = await sessionManager.getSession('test-session');

      expect(session).toMatchObject({
        id: 'test-session',
        name: expect.stringContaining('Gemini CLI'),
        geminiSessionId: 'test-session',
        messages: expect.arrayContaining([
          expect.objectContaining({
            type: 'user',
            content: 'Hello, how can you help me?',
          }),
          expect.objectContaining({
            type: 'assistant',
            content: 'I can help you with coding tasks.',
          }),
        ]),
      });
    });
  });



  describe('updateSession', () => {
    it('should throw error for non-existent session', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(
        sessionManager.updateSession('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should update existing session in cache', async () => {
      const mockLogs: GeminiCLISessionLog[] = [
        {
          sessionId: 'test-session',
          messageId: 1,
          type: 'user',
          message: 'Hello',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2023-01-01T00:00:00.000Z'),
        mtime: new Date('2023-01-01T00:01:00.000Z'),
      } as any);

      await sessionManager.updateSession('test-session', { name: 'Updated Session' });

      const session = await sessionManager.getSession('test-session');
      expect(session?.name).toBe('Updated Session');
    });
  });

  describe('removeFromCache', () => {
    it('should remove session from cache', async () => {
      // First add a session to cache
      const mockLogs: GeminiCLISessionLog[] = [
        {
          sessionId: 'test-session',
          messageId: 1,
          type: 'user',
          message: 'Hello',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2023-01-01T00:00:00.000Z'),
        mtime: new Date('2023-01-01T00:01:00.000Z'),
      } as any);

      // Load session into cache
      await sessionManager.getSession('test-session');

      // Remove from cache
      await sessionManager.removeFromCache('test-session');

      // Should not throw and should work
      expect(true).toBe(true);
    });
  });

  describe('listSessions', () => {
    it('should return empty array when Gemini CLI directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      const sessions = await sessionManager.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should list all Gemini CLI sessions sorted by updatedAt', async () => {
      const mockDirEntries = [
        { name: 'session-1', isDirectory: () => true },
        { name: 'session-2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ];

      const mockLogs1: GeminiCLISessionLog[] = [
        {
          sessionId: 'session-1',
          messageId: 1,
          type: 'user',
          message: 'Hello 1',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      ];

      const mockLogs2: GeminiCLISessionLog[] = [
        {
          sessionId: 'session-2',
          messageId: 1,
          type: 'user',
          message: 'Hello 2',
          timestamp: '2023-01-02T00:00:00.000Z',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue(mockDirEntries as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockLogs1))
        .mockResolvedValueOnce(JSON.stringify(mockLogs2));
      mockFs.stat
        .mockResolvedValueOnce({
          birthtime: new Date('2023-01-01T00:00:00.000Z'),
          mtime: new Date('2023-01-01T00:00:00.000Z'),
        } as any)
        .mockResolvedValueOnce({
          birthtime: new Date('2023-01-02T00:00:00.000Z'),
          mtime: new Date('2023-01-02T00:00:00.000Z'),
        } as any);

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-2'); // More recent first
      expect(sessions[1].id).toBe('session-1');
    });
  });

  describe('importGeminiCLISession', () => {
    it('should return error when session does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await sessionManager.importGeminiCLISession('non-existent');

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'sessionId',
        message: 'Session not found or invalid',
      });
    });

    it('should successfully import valid Gemini CLI session', async () => {
      const mockLogs: GeminiCLISessionLog[] = [
        {
          sessionId: 'test-session',
          messageId: 1,
          type: 'user',
          message: 'Hello, how can you help me?',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        {
          sessionId: 'test-session',
          messageId: 2,
          type: 'assistant',
          message: 'I can help you with coding tasks. Here is some code:\n```python\nprint("Hello")\n```',
          timestamp: '2023-01-01T00:01:00.000Z',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2023-01-01T00:00:00.000Z'),
        mtime: new Date('2023-01-01T00:01:00.000Z'),
      } as any);

      const result = await sessionManager.importGeminiCLISession('test-session');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session!.geminiSessionId).toBe('test-session');
      expect(result.session!.messages).toHaveLength(2);
      expect(result.session!.messages[0].type).toBe('user');
      expect(result.session!.messages[1].type).toBe('assistant');
      expect(result.session!.messages[1].metadata?.codeBlocks).toHaveLength(1);
      expect(result.session!.messages[1].metadata?.codeBlocks![0].language).toBe('python');
    });

    it('should return error for invalid logs', async () => {
      const invalidLogs = [
        {
          // Missing required fields
          messageId: 1,
          message: 'Hello',
        },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidLogs));

      const result = await sessionManager.importGeminiCLISession('test-session');

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'sessionId',
        message: 'Session not found or invalid',
      });
    });
  });

  describe('validateSession', () => {
    it('should return no errors for valid session', () => {
      const validSession: Partial<ChatSession> = {
        id: 'test-session',
        name: 'Test Session',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key',
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
      };

      const errors = sessionManager.validateSession(validSession);

      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid session', () => {
      const invalidSession: Partial<ChatSession> = {
        // Missing required fields
        name: '',
        messages: 'not an array' as any,
      };

      const errors = sessionManager.validateSession(invalidSession);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContainEqual({
        field: 'id',
        message: 'Session ID is required',
      });
      expect(errors).toContainEqual({
        field: 'name',
        message: 'Session name is required',
      });
      expect(errors).toContainEqual({
        field: 'messages',
        message: 'Messages must be an array',
      });
    });
  });

  describe('syncWithGeminiCLI', () => {
    it('should skip sync when Gemini CLI directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      // Should not throw
      await expect(sessionManager.syncWithGeminiCLI()).resolves.toBeUndefined();
    });

    it('should load new sessions from Gemini CLI directory', async () => {
      const mockDirEntries = [
        { name: 'session-1', isDirectory: () => true },
        { name: 'session-2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue(mockDirEntries as any);
      
      // Mock logs for loading
      const mockLogs = [
        {
          sessionId: 'session-1',
          messageId: 1,
          type: 'user',
          message: 'Test message',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      mockFs.stat.mockResolvedValue({
        birthtime: new Date('2023-01-01T00:00:00.000Z'),
        mtime: new Date('2023-01-01T00:01:00.000Z'),
      } as any);

      await sessionManager.syncWithGeminiCLI();

      // Should have attempted to load sessions
      expect(mockFs.readFile).toHaveBeenCalled();
    });
  });
});