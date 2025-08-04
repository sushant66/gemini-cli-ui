import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { projectManager } from './projectManager';

export interface CLIExecutionRequest {
  command: string;
  args: string[];
  workingDirectory: string;
  sessionId: string;
  timeout?: number;
}

export interface NewChatSessionRequest {
  workingDirectory?: string;
  timeout?: number;
}

export interface NewChatSessionResponse {
  success: boolean;
  sessionId: string;
  output?: string;
  error?: string;
  executionTime: number;
}

export interface CLIExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
}

export interface CLIExecutionOptions {
  timeout: number;
  maxOutputSize: number;
  allowedCommands: string[];
  geminiCliPath?: string;
}

export class CLIExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CLIExecutionError';
  }
}

export class CLIExecutor extends EventEmitter {
  private readonly options: CLIExecutionOptions;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor(options: Partial<CLIExecutionOptions> = {}) {
    super();
    this.options = {
      timeout: options.timeout || 30000, // 30 seconds default
      maxOutputSize: options.maxOutputSize || 10 * 1024 * 1024, // 10MB default
      allowedCommands: options.allowedCommands || ['gemini'],
      geminiCliPath: options.geminiCliPath || 'gemini'
    };
  }

  /**
   * Execute a Gemini CLI command
   */
  async executeCommand(request: CLIExecutionRequest): Promise<CLIExecutionResponse> {
    const startTime = Date.now();
    
    try {
      // Validate the request
      this.validateRequest(request);
      
      // Sanitize command and arguments
      const sanitizedCommand = this.sanitizeCommand(request.command);
      const sanitizedArgs = this.sanitizeArguments(request.args);
      
      // Validate working directory
      await this.validateWorkingDirectory(request.workingDirectory);
      
      // Execute the command
      const result = await this.spawnProcess(
        sanitizedCommand,
        sanitizedArgs,
        request.workingDirectory,
        request.sessionId,
        request.timeout || this.options.timeout
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        executionTime,
        exitCode: result.exitCode
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof CLIExecutionError) {
        return {
          success: false,
          output: '',
          error: error.message,
          executionTime
        };
      }
      
      return {
        success: false,
        output: '',
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime
      };
    }
  }

  /**
   * Kill a running process by session ID
   */
  killProcess(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get list of active process session IDs
   */
  getActiveProcesses(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Start a new Gemini CLI session in non-interactive mode
   */
  async startNewChatSession(request: NewChatSessionRequest): Promise<NewChatSessionResponse> {
    const startTime = Date.now();
    const sessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    try {
      // Use current project directory if available, otherwise use provided or default
      let workingDirectory = request.workingDirectory;
      
      if (!workingDirectory) {
        const currentProject = await projectManager.getCurrentProject();
        workingDirectory = currentProject?.path || process.cwd();
      }
      
      // Validate working directory
      await this.validateWorkingDirectory(workingDirectory);
      
      // Start Gemini CLI in non-interactive mode with a simple prompt to initialize
      const result = await this.spawnProcess(
        this.options.geminiCliPath || 'gemini',
        ['-p', 'Hello! I\'m ready to help you. What would you like to know?'],
        workingDirectory,
        sessionId,
        request.timeout || this.options.timeout
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: result.exitCode === 0,
        sessionId,
        output: result.stdout,
        error: result.stderr || undefined,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof CLIExecutionError) {
        return {
          success: false,
          sessionId,
          error: error.message,
          executionTime
        };
      }
      
      return {
        success: false,
        sessionId,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime
      };
    }
  }

  /**
   * Send a message to an existing Gemini CLI session
   */
  async sendMessageToSession(sessionId: string, message: string, workingDirectory?: string): Promise<CLIExecutionResponse> {
    // Use current project directory if available, otherwise use provided or default
    let finalWorkingDirectory = workingDirectory;
    
    if (!finalWorkingDirectory) {
      const currentProject = await projectManager.getCurrentProject();
      finalWorkingDirectory = currentProject?.path || process.cwd();
    }
    
    return this.executeCommand({
      command: 'gemini',
      args: ['-y', '-p', message],
      workingDirectory: finalWorkingDirectory,
      sessionId,
    });
  }

  /**
   * Validate the CLI execution request
   */
  private validateRequest(request: CLIExecutionRequest): void {
    if (!request.command || typeof request.command !== 'string') {
      throw new CLIExecutionError('Command is required and must be a string', 'INVALID_COMMAND');
    }
    
    if (!Array.isArray(request.args)) {
      throw new CLIExecutionError('Arguments must be an array', 'INVALID_ARGS');
    }
    
    if (!request.workingDirectory || typeof request.workingDirectory !== 'string') {
      throw new CLIExecutionError('Working directory is required and must be a string', 'INVALID_WORKING_DIR');
    }
    
    if (!request.sessionId || typeof request.sessionId !== 'string') {
      throw new CLIExecutionError('Session ID is required and must be a string', 'INVALID_SESSION_ID');
    }
    
    if (request.timeout !== undefined && (typeof request.timeout !== 'number' || request.timeout <= 0)) {
      throw new CLIExecutionError('Timeout must be a positive number', 'INVALID_TIMEOUT');
    }
  }

  /**
   * Sanitize and validate the command
   */
  private sanitizeCommand(command: string): string {
    // Remove any path traversal attempts
    const sanitized = command.replace(/[;&|`$(){}[\]\\]/g, '');
    
    // Check if command is in allowed list
    const baseCommand = sanitized.split(' ')[0];
    if (!this.options.allowedCommands.includes(baseCommand)) {
      throw new CLIExecutionError(
        `Command '${baseCommand}' is not allowed. Allowed commands: ${this.options.allowedCommands.join(', ')}`,
        'COMMAND_NOT_ALLOWED'
      );
    }
    
    return sanitized;
  }

  /**
   * Sanitize command arguments
   */
  private sanitizeArguments(args: string[]): string[] {
    return args.map(arg => {
      // Remove dangerous characters but preserve necessary ones for file paths and options
      return arg.replace(/[;&|`$(){}[\]\\]/g, '');
    });
  }

  /**
   * Validate that the working directory exists and is accessible
   */
  private async validateWorkingDirectory(workingDir: string): Promise<void> {
    try {
      // Resolve the path to prevent directory traversal
      const resolvedPath = path.resolve(workingDir);
      
      // Check if directory exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new CLIExecutionError('Working directory is not a directory', 'INVALID_WORKING_DIR');
      }
      
      // Check if directory is accessible
      await fs.access(resolvedPath, fs.constants.R_OK);
      
    } catch (error) {
      if (error instanceof CLIExecutionError) {
        throw error;
      }
      throw new CLIExecutionError(
        `Working directory validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'WORKING_DIR_ACCESS_ERROR'
      );
    }
  }

  /**
   * Spawn a child process and handle its execution
   */
  private async spawnProcess(
    command: string,
    args: string[],
    workingDirectory: string,
    sessionId: string,
    timeout: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        shell: false // Prevent shell injection
      });

      this.activeProcesses.set(sessionId, child);

      let stdout = '';
      let stderr = '';
      let outputSize = 0;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          reject(new CLIExecutionError('Command execution timed out', 'TIMEOUT'));
        }
      }, timeout);

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize > this.options.maxOutputSize) {
          child.kill('SIGTERM');
          reject(new CLIExecutionError('Output size exceeded maximum limit', 'OUTPUT_TOO_LARGE'));
          return;
        }
        
        stdout += chunk;
        this.emit('stdout', sessionId, chunk);
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize > this.options.maxOutputSize) {
          child.kill('SIGTERM');
          reject(new CLIExecutionError('Output size exceeded maximum limit', 'OUTPUT_TOO_LARGE'));
          return;
        }
        
        stderr += chunk;
        this.emit('stderr', sessionId, chunk);
      });

      // Handle process exit
      child.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(sessionId);
        
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0
        });
      });

      // Handle process errors
      child.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(sessionId);
        
        if (error.message.includes('ENOENT')) {
          reject(new CLIExecutionError(
            `Command '${command}' not found. Make sure Gemini CLI is installed and in PATH.`,
            'COMMAND_NOT_FOUND'
          ));
        } else {
          reject(new CLIExecutionError(
            `Process error: ${error.message}`,
            'PROCESS_ERROR',
            error
          ));
        }
      });
    });
  }

  /**
   * Clean up all active processes
   */
  cleanup(): void {
    for (const [, process] of this.activeProcesses) {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    }
    this.activeProcesses.clear();
  }
}

// Export a singleton instance
export const cliExecutor = new CLIExecutor();