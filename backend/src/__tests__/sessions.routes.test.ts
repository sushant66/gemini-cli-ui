import request from 'supertest';
import { createServer } from '../server';
import { sessionManager } from '../services/sessionManager';

// Mock the sessionManager
jest.mock('../services/sessionManager');

const mockSessionManager = sessionManager as jest.Mocked<typeof sessionManager>;

describe('Sessions Routes', () => {
  const app = createServer();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/sessions', () => {
    it('should return list of sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session 1',
          geminiSessionId: 'session-1',
          messages: [],
          context: {
            files: [],
            workingDirectory: '/test',
            geminiConfig: {
              authMethod: 'api-key' as const,
              model: 'gemini-pro',
              temperature: 0.7,
              maxTokens: 2048,
              credentials: {},
              mcpServers: [],
            },
          },
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        },
      ];

      mockSessionManager.listSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0]).toMatchObject({
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
      });
      expect(mockSessionManager.listSessions).toHaveBeenCalledWith(undefined);
    });

    it('should filter sessions by projectId', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session 1',
          projectId: 'project-a',
          geminiSessionId: 'session-1',
          messages: [],
          context: {
            files: [],
            workingDirectory: '/test',
            geminiConfig: {
              authMethod: 'api-key' as const,
              model: 'gemini-pro',
              temperature: 0.7,
              maxTokens: 2048,
              credentials: {},
              mcpServers: [],
            },
          },
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        },
      ];

      mockSessionManager.listSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/sessions?projectId=project-a')
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0]).toMatchObject({
        id: 'session-1',
        name: 'Test Session 1',
        projectId: 'project-a',
        geminiSessionId: 'session-1',
      });
      expect(mockSessionManager.listSessions).toHaveBeenCalledWith('project-a');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return a specific session', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      expect(response.body.session).toMatchObject({
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
      });
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('session-1');
    });

    it('should return 404 for non-existent session', async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sessions/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Session not found',
        message: 'Session with ID non-existent does not exist',
      });
    });
  });

  describe('POST /api/sessions/import/:sessionId', () => {
    it('should successfully import a session', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Imported Session',
        geminiSessionId: 'session-1',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      mockSessionManager.importGeminiCLISession.mockResolvedValue({
        success: true,
        session: mockSession,
      });

      const response = await request(app)
        .post('/api/sessions/import/session-1')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.session).toMatchObject({
        id: 'session-1',
        name: 'Imported Session',
        geminiSessionId: 'session-1',
      });
      expect(mockSessionManager.importGeminiCLISession).toHaveBeenCalledWith('session-1');
    });

    it('should return error for failed import', async () => {
      mockSessionManager.importGeminiCLISession.mockResolvedValue({
        success: false,
        errors: [{ field: 'sessionId', message: 'Session not found' }],
      });

      const response = await request(app)
        .post('/api/sessions/import/non-existent')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Import failed',
        errors: [{ field: 'sessionId', message: 'Session not found' }],
      });
    });
  });

  describe('POST /api/sessions/sync', () => {
    it('should sync with Gemini CLI sessions', async () => {
      mockSessionManager.syncWithGeminiCLI.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/sessions/sync')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Synchronization completed',
      });
      expect(mockSessionManager.syncWithGeminiCLI).toHaveBeenCalled();
    });
  });

  describe('PUT /api/sessions/:id', () => {
    it('should update a session', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      const updatedSession = {
        ...mockSession,
        name: 'Updated Session',
      };

      mockSessionManager.getSession
        .mockResolvedValueOnce(mockSession)
        .mockResolvedValueOnce(updatedSession);
      mockSessionManager.validateSession.mockReturnValue([]);
      mockSessionManager.updateSession.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/sessions/session-1')
        .send({ name: 'Updated Session' })
        .expect(200);

      expect(response.body.session).toMatchObject({
        id: 'session-1',
        name: 'Updated Session',
        geminiSessionId: 'session-1',
      });
      expect(mockSessionManager.updateSession).toHaveBeenCalledWith('session-1', { name: 'Updated Session' });
    });

    it('should return 404 for non-existent session', async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/sessions/non-existent')
        .send({ name: 'Updated Session' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Session not found',
        message: 'Session with ID non-existent does not exist',
      });
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should remove session from cache', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);
      mockSessionManager.removeFromCache.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/sessions/session-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Session session-1 removed from cache',
      });
      expect(mockSessionManager.removeFromCache).toHaveBeenCalledWith('session-1');
    });
  });

  describe('GET /api/sessions/:id/messages', () => {
    it('should return session messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          type: 'user' as const,
          content: 'Hello',
          timestamp: new Date('2023-01-01T00:00:00.000Z'),
        },
        {
          id: 'msg-2',
          type: 'assistant' as const,
          content: 'Hi there!',
          timestamp: new Date('2023-01-01T00:01:00.000Z'),
        },
      ];

      const mockSession = {
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
        messages: mockMessages,
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/sessions/session-1/messages')
        .expect(200);

      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toMatchObject({
        id: 'msg-1',
        type: 'user',
        content: 'Hello',
      });
      expect(response.body.messages[1]).toMatchObject({
        id: 'msg-2',
        type: 'assistant',
        content: 'Hi there!',
      });
    });
  });

  describe('GET /api/sessions/:id/validate', () => {
    it('should validate session and return no errors', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session 1',
        geminiSessionId: 'session-1',
        messages: [],
        context: {
          files: [],
          workingDirectory: '/test',
          geminiConfig: {
            authMethod: 'api-key' as const,
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 2048,
            credentials: {},
            mcpServers: [],
          },
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue([]);

      const response = await request(app)
        .get('/api/sessions/session-1/validate')
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        errors: [],
      });
    });
  });
});