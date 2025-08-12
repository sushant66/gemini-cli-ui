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



export interface ChatSession {
  id: string;
  name: string;
  projectId?: string;
  messages: ChatMessage[];
  context: {
    files: string[];
    workingDirectory: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  chatSessions: string[]; // Session IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionValidationError {
  field: string;
  message: string;
  value?: any;
}