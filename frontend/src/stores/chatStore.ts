import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ChatMessage } from '../types/session';
import { apiClient } from '../services/api';
import { useProjectStore } from './projectStore';

interface ChatState {
  // State
  error: string | null;
  isSendingMessage: boolean;
  isLoadingSessions: boolean;
  
  // Active chat sessions (for new chats)
  activeChatSessions: Map<string, { sessionId: string; messages: ChatMessage[] }>;
  
  // Persistent sessions from database
  persistentSessions: any[];
  currentSession: any | null;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  createNewChatSession: () => Promise<string>;
  closeActiveChatSession: (sessionId: string) => void;
  clearError: () => void;
  initializeDefaultChat: () => Promise<void>;
  
  // Persistent session actions
  loadSessions: (projectId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createPersistentSession: (sessionData: any) => Promise<any>;
  updateSession: (sessionId: string, updates: any) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessageToSession: (sessionId: string, messageData: any) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      error: null,
      isSendingMessage: false,
      isLoadingSessions: false,
      activeChatSessions: new Map(),
      persistentSessions: [],
      currentSession: null,



      // Send a message to the active chat session
      sendMessage: async (message: string) => {
        const { activeChatSessions } = get();
        
        set({ isSendingMessage: true, error: null });

        try {
          // Add user message immediately for UI responsiveness
          const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            type: 'user',
            content: message,
            timestamp: new Date(),
          };

          // Handle active chat session (new chat)
          const activeSessionId = Array.from(activeChatSessions.keys())[0];
          if (!activeSessionId) {
            set({ error: 'No active session', isSendingMessage: false });
            return;
          }

          const activeSession = activeChatSessions.get(activeSessionId)!;
          const updatedMessages = [...activeSession.messages, userMessage];
          
          // Update active session with user message
          const newActiveSessions = new Map(activeChatSessions);
          newActiveSessions.set(activeSessionId, {
            ...activeSession,
            messages: updatedMessages,
          });
          set({ activeChatSessions: newActiveSessions });

          try {
            // Get current project for working directory
            const currentProject = useProjectStore.getState().currentProject;
            
            // First, create a new Gemini CLI session (this is when we actually connect)
            const newSessionResponse = await apiClient.startNewChatSession({
              workingDirectory: currentProject?.path,
            });

            if (!newSessionResponse.success) {
              throw new Error(newSessionResponse.error || 'Failed to create Gemini session');
            }

            // Now send the message to the newly created Gemini session
            const cliResponse = await apiClient.sendMessageToSession(newSessionResponse.sessionId, {
              message,
              workingDirectory: currentProject?.path,
            });

            // Create assistant message
            const assistantMessage: ChatMessage = {
              id: `response-${Date.now()}`,
              type: 'assistant',
              content: cliResponse.success ? cliResponse.output : (cliResponse.error || 'Command failed'),
              timestamp: new Date(),
              metadata: {
                codeBlocks: cliResponse.success ? extractCodeBlocks(cliResponse.output) : undefined,
              },
            };

            // Update with assistant response and replace the local session ID with the real Gemini session ID
            const finalMessages = [...updatedMessages, assistantMessage];
            
            // Remove the old local session and add the new Gemini session
            newActiveSessions.delete(activeSessionId);
            newActiveSessions.set(newSessionResponse.sessionId, {
              sessionId: newSessionResponse.sessionId,
              messages: finalMessages,
            });

            set({ activeChatSessions: newActiveSessions, isSendingMessage: false });
          } catch (error) {
            // If Gemini connection fails, show error but keep the local session
            const errorMessage: ChatMessage = {
              id: `error-${Date.now()}`,
              type: 'assistant',
              content: `Failed to connect to Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
            };

            const finalMessages = [...updatedMessages, errorMessage];
            newActiveSessions.set(activeSessionId, {
              ...activeSession,
              messages: finalMessages,
            });

            set({ 
              activeChatSessions: newActiveSessions, 
              isSendingMessage: false,
              error: 'Failed to connect to Gemini. Please check if the backend is running.'
            });
          }

        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to send message',
            isSendingMessage: false 
          });
        }
      },

      // Create a new chat session (local only, connects to Gemini on first message)
      createNewChatSession: async (): Promise<string> => {
        try {
          // Create a local session ID without connecting to Gemini
          const sessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          // Clear existing sessions and create a new one
          const newActiveSessions = new Map();
          
          // Create empty session (no initial messages)
          newActiveSessions.set(sessionId, {
            sessionId,
            messages: [],
          });

          set({ activeChatSessions: newActiveSessions });

          return sessionId;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create new chat session'
          });
          throw error;
        }
      },

      // Close an active chat session
      closeActiveChatSession: (sessionId: string) => {
        const { activeChatSessions } = get();
        const newActiveSessions = new Map(activeChatSessions);
        newActiveSessions.delete(sessionId);
        
        set({ activeChatSessions: newActiveSessions });
      },

      // Clear error state
      clearError: () => set({ error: null }),

      // Initialize default chat session if none exists
      initializeDefaultChat: async () => {
        const currentState = get();
        
        // Only create a new session if none exists
        if (currentState.activeChatSessions.size === 0) {
          console.log('Creating local chat session for UI...');
          
          // Create a local session ID without connecting to Gemini
          const sessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          // Add to active sessions with empty messages
          const newActiveSessions = new Map(currentState.activeChatSessions);
          newActiveSessions.set(sessionId, {
            sessionId,
            messages: [],
          });
          
          set({ activeChatSessions: newActiveSessions });
          console.log('Local chat session created successfully');
        } else {
          console.log('Skipping session creation - session already exists');
        }
      },

      // Load persistent sessions from database
      loadSessions: async (projectId?: string) => {
        set({ isLoadingSessions: true, error: null });
        
        try {
          const response = await apiClient.getSessions(projectId);
          
          if (response.success) {
            set({ 
              persistentSessions: response.data,
              isLoadingSessions: false 
            });
          } else {
            throw new Error('Failed to load sessions');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load sessions',
            isLoadingSessions: false 
          });
        }
      },

      // Load a specific session
      loadSession: async (sessionId: string) => {
        set({ error: null });
        
        try {
          const response = await apiClient.getSession(sessionId);
          
          if (response.success) {
            set({ currentSession: response.data });
          } else {
            throw new Error('Failed to load session');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load session'
          });
        }
      },

      // Create a new persistent session
      createPersistentSession: async (sessionData: any) => {
        set({ error: null });
        
        try {
          const response = await apiClient.createSession(sessionData);
          
          if (response.success) {
            // Add to persistent sessions list
            const { persistentSessions } = get();
            set({ 
              persistentSessions: [response.data, ...persistentSessions],
              currentSession: response.data
            });
            return response.data;
          } else {
            throw new Error('Failed to create session');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create session'
          });
          throw error;
        }
      },

      // Update a session
      updateSession: async (sessionId: string, updates: any) => {
        set({ error: null });
        
        try {
          const response = await apiClient.updateSession(sessionId, updates);
          
          if (response.success) {
            // Update in persistent sessions list
            const { persistentSessions, currentSession } = get();
            const updatedSessions = persistentSessions.map(session => 
              session.id === sessionId ? response.data : session
            );
            
            set({ 
              persistentSessions: updatedSessions,
              currentSession: currentSession?.id === sessionId ? response.data : currentSession
            });
          } else {
            throw new Error('Failed to update session');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update session'
          });
        }
      },

      // Delete a session
      deleteSession: async (sessionId: string) => {
        set({ error: null });
        
        try {
          const response = await apiClient.deleteSession(sessionId);
          
          if (response.success) {
            // Remove from persistent sessions list
            const { persistentSessions, currentSession } = get();
            const updatedSessions = persistentSessions.filter(session => session.id !== sessionId);
            
            set({ 
              persistentSessions: updatedSessions,
              currentSession: currentSession?.id === sessionId ? null : currentSession
            });
          } else {
            throw new Error('Failed to delete session');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete session'
          });
        }
      },

      // Add a message to a persistent session
      addMessageToSession: async (sessionId: string, messageData: any) => {
        set({ error: null });
        
        try {
          const response = await apiClient.addMessageToSession(sessionId, messageData);
          
          if (response.success) {
            // Update current session if it matches
            const { currentSession } = get();
            if (currentSession?.id === sessionId) {
              const updatedSession = {
                ...currentSession,
                messages: [...currentSession.messages, response.data],
                updatedAt: new Date()
              };
              set({ currentSession: updatedSession });
            }
          } else {
            throw new Error('Failed to add message');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add message'
          });
        }
      },


    }),
    {
      name: 'chat-store',
    }
  )
);

// Helper function to extract code blocks from text
function extractCodeBlocks(text: string) {
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      id: `code-${Date.now()}-${Math.random()}`,
      language: match[1] || 'text',
      content: match[2].trim(),
    });
  }

  return codeBlocks;
}