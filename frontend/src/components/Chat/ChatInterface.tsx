import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Copy, AlertCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import { CodeBlock } from '../../types/session';

const ChatInterface: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const initializationAttempted = useRef(false);
  const {
    error,
    isSendingMessage,
    currentSession,
    sendMessage,
    clearError,
    initializeDefaultChat,
  } = useChatStore();

  const { currentProject } = useProjectStore();

  // Initialize default chat on component mount
  useEffect(() => {
    const initialize = async () => {
      // Prevent double initialization in React StrictMode
      if (initializationAttempted.current) {
        return;
      }
      initializationAttempted.current = true;
      
      await initializeDefaultChat();
    };
    initialize();
  }, [initializeDefaultChat]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && !isSendingMessage) {
      await sendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleCopyCode = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const renderCodeBlock = (codeBlock: CodeBlock) => (
    <div key={codeBlock.id} className="my-4 rounded-lg bg-gray-800 border border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-700 rounded-t-lg">
        <span className="text-sm text-gray-300">{codeBlock.language}</span>
        <button
          onClick={() => handleCopyCode(codeBlock.content)}
          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-600 rounded"
        >
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-gray-100">{codeBlock.content}</code>
      </pre>
    </div>
  );

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get messages from current session
  const displayMessages = currentSession?.messages || [];

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 px-4 py-3 mx-4 mt-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-red-200 text-sm">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}



      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {!currentProject ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            {/* No Project Selected */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex items-center justify-center">
                <Sparkles className="mr-2 h-6 w-6 text-orange-500" />
                <h1 className="text-2xl font-normal text-white">
                  Welcome to Gemini Desk
                </h1>
              </div>
              <p className="text-lg text-gray-400 mb-4">
                Please select a project to start chatting with Gemini.
              </p>
              <p className="text-sm text-gray-500">
                Click "Select Project" in the sidebar to get started.
              </p>
            </div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            {/* Greeting */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex items-center justify-center">
                <Sparkles className="mr-2 h-6 w-6 text-orange-500" />
                <h1 className="text-2xl font-normal text-white">
                  Welcome to Gemini Desk
                </h1>
              </div>
              <p className="text-lg text-gray-400">
                Start a conversation with Gemini by typing a message below.
              </p>
              

            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl px-4 py-6">
            {displayMessages.map((message) => (
              <div key={message.id} className="mb-8">
                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      message.type === 'user' ? 'bg-blue-600' : 'bg-orange-500'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">
                      {message.type === 'user' ? 'U' : 'G'}
                    </span>
                  </div>

                  {/* Message Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">
                        {message.type === 'user' ? 'You' : 'Gemini'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none leading-relaxed text-gray-300">
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                      {/* Render code blocks if present */}
                      {message.metadata?.codeBlocks?.map(renderCodeBlock)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Sending message indicator */}
            {isSendingMessage && (
              <div className="mb-8">
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500">
                    <span className="text-xs font-bold text-white">G</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">Gemini</span>
                      <span className="text-xs text-gray-500">Thinking...</span>
                    </div>
                    <div className="text-gray-400">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-[#1a1a1a] p-4">
        <div className="mx-auto max-w-4xl">
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                !currentProject
                  ? "Select a project to start chatting..."
                  : currentSession 
                  ? "Message Gemini..." 
                  : "Start a new chat"
              }
              disabled={!currentProject || !currentSession || isSendingMessage}
              className="w-full resize-none rounded-xl border border-gray-600 bg-[#2a2a2a] px-4 py-3 pr-12 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                resize: 'none',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !currentProject || !currentSession || isSendingMessage}
              className="absolute bottom-2 right-2 rounded-lg bg-orange-500 p-2 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-600"
              aria-label="Send message"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            {!currentProject
              ? "Select a project from the sidebar to enable chatting"
              : currentSession
              ? "Gemini can make mistakes. Check important info."
              : "Click 'New Chat' in the sidebar to start a conversation"
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
