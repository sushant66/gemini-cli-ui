export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    command?: string;
    files?: string[];
    codeBlocks?: CodeBlock[];
  };
}

export interface CodeBlock {
  id: string;
  language: string;
  content: string;
  filename?: string;
  startLine?: number;
  endLine?: number;
}

export interface GeminiConfig {
  authMethod: 'google' | 'api-key' | 'vertex-ai';
  credentials: {
    apiKey?: string;
    googleAccount?: string;
    vertexProject?: string;
  };
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  mcpServers: MCPServerConfig[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  status: 'running' | 'stopped' | 'error';
  lastError?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  projectId?: string;
  geminiSessionId?: string; // Maps to Gemini CLI session
  messages: ChatMessage[];
  context: {
    files: string[];
    workingDirectory: string;
    geminiConfig: GeminiConfig;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  geminiConfig: GeminiConfig;
  chatSessions: string[]; // Session IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface SessionImportResult {
  success: boolean;
  session?: ChatSession;
  errors?: SessionValidationError[];
  warnings?: string[];
}