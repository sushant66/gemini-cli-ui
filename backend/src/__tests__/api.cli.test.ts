import request from 'supertest';
import { createServer } from '../server';
import { cliExecutor } from '../services/cliExecutor';

// Mock the CLI executor
jest.mock('../services/cliExecutor', () => ({
  cliExecutor: {
    executeCommand: jest.fn(),
    killProcess: jest.fn(),
    getActiveProcesses: jest.fn(),
    cleanup: jest.fn()
  }
}));

const mockCliExecutor = cliExecutor as jest.Mocked<typeof cliExecutor>;

describe('CLI API Endpoints', () => {
  const app = createServer();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/cli/execute', () => {
    const validRequest = {
      command: 'gemini',
      args: ['--help'],
      workingDirectory: '/test/dir',
      sessionId: 'test-session'
    };

    it('should execute CLI command successfully', async () => {
      const mockResponse = {
        success: true,
        output: 'Gemini CLI help text',
        executionTime: 1000,
        exitCode: 0
      };

      mockCliExecutor.executeCommand.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/cli/execute')
        .send(validRequest)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockCliExecutor.executeCommand).toHaveBeenCalledWith(validRequest);
    });

    it('should handle CLI command failure', async () => {
      const mockResponse = {
        success: false,
        output: '',
        error: 'Command failed',
        executionTime: 500
      };

      mockCliExecutor.executeCommand.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/cli/execute')
        .send(validRequest)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidRequest = {
        command: 'gemini',
        // missing args, workingDirectory, sessionId
      };

      const response = await request(app)
        .post('/api/cli/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
      expect(response.body).toHaveProperty('required');
      expect(mockCliExecutor.executeCommand).not.toHaveBeenCalled();
    });

    it('should return 400 for missing command', async () => {
      const invalidRequest = {
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      const response = await request(app)
        .post('/api/cli/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 for missing args', async () => {
      const invalidRequest = {
        command: 'gemini',
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      const response = await request(app)
        .post('/api/cli/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 for missing workingDirectory', async () => {
      const invalidRequest = {
        command: 'gemini',
        args: ['--help'],
        sessionId: 'test-session'
      };

      const response = await request(app)
        .post('/api/cli/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 for missing sessionId', async () => {
      const invalidRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir'
      };

      const response = await request(app)
        .post('/api/cli/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should handle CLI executor errors', async () => {
      mockCliExecutor.executeCommand.mockRejectedValue(new Error('CLI executor failed'));

      const response = await request(app)
        .post('/api/cli/execute')
        .send(validRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body).toHaveProperty('message', 'CLI executor failed');
    });

    it('should include timeout in request', async () => {
      const requestWithTimeout = {
        ...validRequest,
        timeout: 10000
      };

      const mockResponse = {
        success: true,
        output: 'Output',
        executionTime: 5000,
        exitCode: 0
      };

      mockCliExecutor.executeCommand.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/cli/execute')
        .send(requestWithTimeout)
        .expect(200);

      expect(mockCliExecutor.executeCommand).toHaveBeenCalledWith(requestWithTimeout);
    });
  });

  describe('POST /api/cli/kill/:sessionId', () => {
    it('should kill process successfully', async () => {
      mockCliExecutor.killProcess.mockReturnValue(true);

      const response = await request(app)
        .post('/api/cli/kill/test-session')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Process killed successfully'
      });
      expect(mockCliExecutor.killProcess).toHaveBeenCalledWith('test-session');
    });

    it('should handle process not found', async () => {
      mockCliExecutor.killProcess.mockReturnValue(false);

      const response = await request(app)
        .post('/api/cli/kill/non-existent-session')
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        message: 'Process not found or already terminated'
      });
      expect(mockCliExecutor.killProcess).toHaveBeenCalledWith('non-existent-session');
    });

    it('should handle kill process errors', async () => {
      mockCliExecutor.killProcess.mockImplementation(() => {
        throw new Error('Kill process failed');
      });

      const response = await request(app)
        .post('/api/cli/kill/test-session')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body).toHaveProperty('message', 'Kill process failed');
    });
  });

  describe('GET /api/cli/processes', () => {
    it('should return active processes', async () => {
      const mockActiveProcesses = ['session-1', 'session-2', 'session-3'];
      mockCliExecutor.getActiveProcesses.mockReturnValue(mockActiveProcesses);

      const response = await request(app)
        .get('/api/cli/processes')
        .expect(200);

      expect(response.body).toEqual({
        activeProcesses: mockActiveProcesses
      });
      expect(mockCliExecutor.getActiveProcesses).toHaveBeenCalled();
    });

    it('should return empty array when no processes are active', async () => {
      mockCliExecutor.getActiveProcesses.mockReturnValue([]);

      const response = await request(app)
        .get('/api/cli/processes')
        .expect(200);

      expect(response.body).toEqual({
        activeProcesses: []
      });
    });

    it('should handle get processes errors', async () => {
      mockCliExecutor.getActiveProcesses.mockImplementation(() => {
        throw new Error('Get processes failed');
      });

      const response = await request(app)
        .get('/api/cli/processes')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body).toHaveProperty('message', 'Get processes failed');
    });
  });
});