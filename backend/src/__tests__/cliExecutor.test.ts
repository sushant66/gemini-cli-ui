import { CLIExecutor, CLIExecutionError, CLIExecutionRequest } from '../services/cliExecutor';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock EventEmitter for child process
class MockChildProcess {
  stdout = { on: jest.fn() };
  stderr = { on: jest.fn() };
  on = jest.fn();
  kill = jest.fn();
  killed = false;
}

describe('CLIExecutor', () => {
  let cliExecutor: CLIExecutor;
  let mockChild: MockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    cliExecutor = new CLIExecutor({
      timeout: 5000,
      maxOutputSize: 1024,
      allowedCommands: ['gemini', 'test-command']
    });
    mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);
  });

  afterEach(() => {
    cliExecutor.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const executor = new CLIExecutor();
      expect(executor).toBeInstanceOf(CLIExecutor);
    });

    it('should initialize with custom options', () => {
      const options = {
        timeout: 10000,
        maxOutputSize: 2048,
        allowedCommands: ['custom-command'],
        geminiCliPath: '/custom/path/gemini'
      };
      const executor = new CLIExecutor(options);
      expect(executor).toBeInstanceOf(CLIExecutor);
    });
  });

  describe('validateRequest', () => {
    const validRequest: CLIExecutionRequest = {
      command: 'gemini',
      args: ['--help'],
      workingDirectory: '/test/dir',
      sessionId: 'test-session'
    };

    it('should validate a valid request', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Mock successful command execution
      setTimeout(() => {
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      const result = await cliExecutor.executeCommand(validRequest);
      expect(result.success).toBe(true);
    });

    it('should throw error for missing command', async () => {
      const invalidRequest = { ...validRequest, command: '' };
      
      const result = await cliExecutor.executeCommand(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command is required');
    });

    it('should throw error for invalid args', async () => {
      const invalidRequest = { ...validRequest, args: 'not-an-array' as any };
      
      const result = await cliExecutor.executeCommand(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Arguments must be an array');
    });

    it('should throw error for missing working directory', async () => {
      const invalidRequest = { ...validRequest, workingDirectory: '' };
      
      const result = await cliExecutor.executeCommand(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Working directory is required');
    });

    it('should throw error for missing session ID', async () => {
      const invalidRequest = { ...validRequest, sessionId: '' };
      
      const result = await cliExecutor.executeCommand(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID is required');
    });

    it('should throw error for invalid timeout', async () => {
      const invalidRequest = { ...validRequest, timeout: -1 };
      
      const result = await cliExecutor.executeCommand(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be a positive number');
    });
  });

  describe('sanitizeCommand', () => {
    it('should allow valid commands', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      setTimeout(() => {
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      const result = await cliExecutor.executeCommand(request);
      expect(result.success).toBe(true);
    });

    it('should reject disallowed commands', async () => {
      const request: CLIExecutionRequest = {
        command: 'rm',
        args: ['-rf', '/'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      const result = await cliExecutor.executeCommand(request);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command \'rm\' is not allowed');
    });

    it('should sanitize dangerous characters', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini; rm -rf /',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      setTimeout(() => {
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      await cliExecutor.executeCommand(request);
      
      // Verify spawn was called with sanitized command
      expect(mockSpawn).toHaveBeenCalledWith(
        'gemini rm -rf /',
        ['--help'],
        expect.any(Object)
      );
    });
  });

  describe('sanitizeArguments', () => {
    it('should sanitize dangerous characters in arguments', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--input', 'file.txt; rm -rf /'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      setTimeout(() => {
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      await cliExecutor.executeCommand(request);
      
      // Verify spawn was called with sanitized arguments
      expect(mockSpawn).toHaveBeenCalledWith(
        'gemini',
        ['--input', 'file.txt rm -rf /'],
        expect.any(Object)
      );
    });
  });

  describe('validateWorkingDirectory', () => {
    it('should validate existing directory', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      setTimeout(() => {
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      const result = await cliExecutor.executeCommand(request);
      expect(result.success).toBe(true);
    });

    it('should reject non-existent directory', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/non/existent/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await cliExecutor.executeCommand(request);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Working directory validation failed');
    });

    it('should reject file instead of directory', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/file.txt',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      const result = await cliExecutor.executeCommand(request);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Working directory is not a directory');
    });
  });

  describe('executeCommand', () => {
    const validRequest: CLIExecutionRequest = {
      command: 'gemini',
      args: ['--help'],
      workingDirectory: '/test/dir',
      sessionId: 'test-session'
    };

    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should execute command successfully', async () => {
      const expectedOutput = 'Gemini CLI help text';
      
      setTimeout(() => {
        // Simulate stdout data
        mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1](Buffer.from(expectedOutput));
        // Simulate process close
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      const result = await cliExecutor.executeCommand(validRequest);
      
      expect(result.success).toBe(true);
      expect(result.output).toBe(expectedOutput);
      expect(result.exitCode).toBe(0);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should handle command failure', async () => {
      const expectedError = 'Command failed';
      
      setTimeout(() => {
        // Simulate stderr data
        mockChild.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1](Buffer.from(expectedError));
        // Simulate process close with error code
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](1);
      }, 0);

      const result = await cliExecutor.executeCommand(validRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(expectedError);
      expect(result.exitCode).toBe(1);
    });

    it('should handle command not found error', async () => {
      setTimeout(() => {
        // Simulate ENOENT error
        const error = new Error('spawn gemini ENOENT');
        mockChild.on.mock.calls.find(call => call[0] === 'error')?.[1](error);
      }, 0);

      const result = await cliExecutor.executeCommand(validRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command \'gemini\' not found');
    });

    it('should handle timeout', async () => {
      const shortTimeoutRequest = { ...validRequest, timeout: 100 };
      
      // Don't simulate process completion to trigger timeout
      
      const result = await cliExecutor.executeCommand(shortTimeoutRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command execution timed out');
    });

    it('should handle output size limit', async () => {
      const largeOutput = 'x'.repeat(2000); // Exceeds 1024 byte limit
      
      setTimeout(() => {
        // Simulate large stdout data
        mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1](Buffer.from(largeOutput));
      }, 0);

      const result = await cliExecutor.executeCommand(validRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Output size exceeded maximum limit');
    });

    it('should emit stdout events', async () => {
      const expectedOutput = 'Test output';
      const stdoutSpy = jest.fn();
      cliExecutor.on('stdout', stdoutSpy);
      
      setTimeout(() => {
        mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1](Buffer.from(expectedOutput));
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](0);
      }, 0);

      await cliExecutor.executeCommand(validRequest);
      
      expect(stdoutSpy).toHaveBeenCalledWith('test-session', expectedOutput);
    });

    it('should emit stderr events', async () => {
      const expectedError = 'Test error';
      const stderrSpy = jest.fn();
      cliExecutor.on('stderr', stderrSpy);
      
      setTimeout(() => {
        mockChild.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1](Buffer.from(expectedError));
        mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1](1);
      }, 0);

      await cliExecutor.executeCommand(validRequest);
      
      expect(stderrSpy).toHaveBeenCalledWith('test-session', expectedError);
    });
  });

  describe('killProcess', () => {
    it('should kill active process', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Start a command but don't complete it
      const executePromise = cliExecutor.executeCommand(request);
      
      // Wait a bit for the process to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Kill the process
      const killed = cliExecutor.killProcess('test-session');
      
      expect(killed).toBe(true);
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should return false for non-existent process', () => {
      const killed = cliExecutor.killProcess('non-existent-session');
      expect(killed).toBe(false);
    });
  });

  describe('getActiveProcesses', () => {
    it('should return list of active process session IDs', async () => {
      const request: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'test-session'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Start a command but don't complete it
      const executePromise = cliExecutor.executeCommand(request);
      
      // Wait a bit for the process to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const activeProcesses = cliExecutor.getActiveProcesses();
      expect(activeProcesses).toContain('test-session');
    });

    it('should return empty array when no processes are active', () => {
      const activeProcesses = cliExecutor.getActiveProcesses();
      expect(activeProcesses).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should kill all active processes', async () => {
      const request1: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--help'],
        workingDirectory: '/test/dir',
        sessionId: 'session-1'
      };

      const request2: CLIExecutionRequest = {
        command: 'gemini',
        args: ['--version'],
        workingDirectory: '/test/dir',
        sessionId: 'session-2'
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockResolvedValue(undefined);

      // Start multiple commands
      const executePromise1 = cliExecutor.executeCommand(request1);
      const executePromise2 = cliExecutor.executeCommand(request2);
      
      // Wait a bit for processes to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cleanup all processes
      cliExecutor.cleanup();
      
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(cliExecutor.getActiveProcesses()).toEqual([]);
    });
  });
});