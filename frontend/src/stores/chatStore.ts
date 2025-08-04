import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ChatMessage } from '../types/session';
import { apiClient } from '../services/api';
import { useProjectStore } from './projectStore';

interface ChatState {
  // State
  error: string | null;
  isSendingMessage: boolean;
  
  // Active chat sessions (for new chats)
  activeChatSessions: Map<string, { sessionId: string; messages: ChatMessage[] }>;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  createNewChatSession: () => Promise<string>;
  closeActiveChatSession: (sessionId: string) => void;
  clearError: () => void;
  initializeDefaultChat: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      error: null,
      isSendingMessage: false,
      activeChatSessions: new Map(),



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