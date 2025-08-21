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



      // Send a message to the current session
      sendMessage: async (message: string) => {
        const { currentSession } = get();
        const currentProject = useProjectStore.getState().currentProject;
        
        // Require project selection
        if (!currentProject) {
          set({ error: 'Please select a project before sending messages', isSendingMessage: false });
          return;
        }
        
        if (!currentSession) {
          set({ error: 'No active session', isSendingMessage: false });
          return;
        }

        set({ isSendingMessage: true, error: null });

        try {
          // Add user message to database and update UI
          const userMessage = {
            type: 'user' as const,
            content: message,
            timestamp: new Date().toISOString(), // Send as ISO string
          };

          await get().addMessageToSession(currentSession.id, userMessage);

          try {
            // Send message to Gemini CLI using project path
            const cliResponse = await apiClient.sendMessageToSession(`session-${currentSession.id}`, {
              message,
              workingDirectory: currentProject.path,
            });

            // Create assistant message
            const { content, codeBlocks } = cliResponse.success 
              ? extractCodeBlocksAndCleanContent(cliResponse.output) 
              : { content: cliResponse.error || 'Command failed', codeBlocks: undefined };
              
            const assistantMessage = {
              type: 'assistant' as const,
              content,
              timestamp: new Date().toISOString(), // Send as ISO string
              metadata: {
                codeBlocks,
              },
            };

            // Add assistant message to database
            await get().addMessageToSession(currentSession.id, assistantMessage);

            set({ isSendingMessage: false });
          } catch (error) {
            // If Gemini connection fails, add error message
            const errorMessage = {
              type: 'assistant' as const,
              content: `Failed to connect to Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date().toISOString(), // Send as ISO string
            };

            await get().addMessageToSession(currentSession.id, errorMessage);

            set({ 
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

      // Create a new chat session and save to database
      createNewChatSession: async (): Promise<string> => {
        try {
          const currentProject = useProjectStore.getState().currentProject;
          
          // Require project selection
          if (!currentProject) {
            throw new Error('Please select a project before creating a chat session');
          }
          
          // Create session data
          const sessionData = {
            name: `Chat ${new Date().toLocaleString()}`,
            projectId: currentProject.id,
            messages: [],
            context: {
              files: [],
              workingDirectory: currentProject.path,
            },
          };

          // Create persistent session in database
          const session = await get().createPersistentSession(sessionData);
          
          // Set as current session
          set({ currentSession: session });
          
          // Clear active sessions (old approach)
          set({ activeChatSessions: new Map() });

          return session.id;
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

      // Initialize chat by loading existing sessions for current project
      initializeDefaultChat: async () => {
        try {
          const currentProject = useProjectStore.getState().currentProject;
          
          if (!currentProject) {
            // Clear sessions if no project is selected
            set({ persistentSessions: [], currentSession: null });
            return;
          }
          
          // Load existing sessions from database for current project
          await get().loadSessions(currentProject.id);
          
          const { persistentSessions } = get();
          
          // If there are existing sessions, set the most recent one as current
          if (persistentSessions.length > 0) {
            const mostRecentSession = persistentSessions[0]; // Already sorted by updatedAt DESC
            set({ currentSession: mostRecentSession });
            console.log('Loaded existing session:', mostRecentSession.id);
          } else {
            // No existing sessions - automatically create a new one
            console.log('No existing sessions found for project, creating new session...');
            try {
              await get().createNewChatSession();
              console.log('Automatically created new chat session');
            } catch (error) {
              console.error('Failed to auto-create chat session:', error);
              set({ currentSession: null });
            }
          }
        } catch (error) {
          console.error('Failed to initialize chat:', error);
          set({ error: 'Failed to load chat sessions' });
        }
      },

      // Load persistent sessions from database
      loadSessions: async (projectId?: string) => {
        set({ isLoadingSessions: true, error: null });
        
        try {
          const response = await apiClient.getSessions(projectId);
          
          if (response.success) {
            // Convert timestamp strings to Date objects
            const sessions = response.data.map((session: any) => ({
              ...session,
              createdAt: new Date(session.createdAt),
              updatedAt: new Date(session.updatedAt),
              messages: session.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
            
            set({ 
              persistentSessions: sessions,
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
            // Convert timestamp strings to Date objects
            const session = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              messages: response.data.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            };
            set({ currentSession: session });
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
            // Convert timestamp strings to Date objects
            const session = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              messages: response.data.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            };
            
            // Add to persistent sessions list
            const { persistentSessions } = get();
            set({ 
              persistentSessions: [session, ...persistentSessions],
              currentSession: session
            });
            return session;
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
            // Reload the current session to get the updated messages
            await get().loadSession(sessionId);
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

// Helper function to extract code blocks from text and clean content
function extractCodeBlocksAndCleanContent(text: string) {
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let cleanedContent = text;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      id: `code-${Date.now()}-${Math.random()}`,
      language: match[1] || 'text',
      content: match[2].trim(),
    });
    
    // Remove the code block from the main content
    cleanedContent = cleanedContent.replace(match[0], '').trim();
  }

  return {
    content: cleanedContent,
    codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined
  };
}

// Legacy helper function for backward compatibility
function extractCodeBlocks(text: string) {
  const result = extractCodeBlocksAndCleanContent(text);
  return result.codeBlocks || [];
}