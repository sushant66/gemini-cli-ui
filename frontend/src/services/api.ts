import { Project } from '../types/session';

// Use environment variable or default to localhost
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && (window as any).VITE_API_URL) {
    return (window as any).VITE_API_URL;
  }
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface CLIExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
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

export interface SendMessageRequest {
  message: string;
  workingDirectory?: string;
}

export interface CreateProjectRequest {
  name: string;
  path: string;
  description?: string;
}

export interface OpenProjectRequest {
  path: string;
  name?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Network Error',
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown network error');
    }
  }





  // Session Management APIs
  async getSessions(projectId?: string): Promise<{ success: boolean; data: any[] }> {
    const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request(`/sessions${params}`);
  }

  async getSession(sessionId: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  async createSession(sessionData: any): Promise<{ success: boolean; data: any }> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async updateSession(sessionId: string, updates: any): Promise<{ success: boolean; data: any }> {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  async addMessageToSession(sessionId: string, messageData: any): Promise<{ success: boolean; data: any }> {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }



  // New Chat Session APIs (CLI-based)
  async startNewChatSession(request: NewChatSessionRequest = {}): Promise<NewChatSessionResponse> {
    return this.request('/cli/chat/new', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async sendMessageToSession(sessionId: string, request: SendMessageRequest): Promise<CLIExecutionResponse> {
    return this.request(`/cli/chat/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Project Management APIs
  async getProjects(): Promise<{ projects: Project[] }> {
    return this.request('/projects');
  }

  async getRecentProjects(): Promise<{ projects: Project[] }> {
    return this.request('/projects/recent');
  }

  async getCurrentProject(): Promise<{ project: Project | null }> {
    return this.request('/projects/current');
  }

  async setCurrentProject(projectId: string | null): Promise<{ 
    success: boolean; 
    project: Project | null; 
    message: string;
  }> {
    return this.request('/projects/current', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async getProject(id: string): Promise<{ project: Project }> {
    return this.request(`/projects/${encodeURIComponent(id)}`);
  }

  async createProject(request: CreateProjectRequest): Promise<{ 
    project: Project; 
    success: boolean; 
    message: string;
  }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async openProject(request: OpenProjectRequest): Promise<{ 
    project: Project; 
    success: boolean; 
    message: string;
  }> {
    return this.request('/projects/open', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<{ project: Project; success: boolean; message: string }> {
    return this.request(`/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Health Check
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    uptime: number;
  }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;