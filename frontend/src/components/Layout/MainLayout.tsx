import React, { useState, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  FolderOpen,
  Menu,
  X,
  Trash2,
  Folder,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import ProjectDialog from '../Project/ProjectDialog';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface LayoutState {
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  activePanel: 'chat' | 'files' | 'settings';
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    sidebarWidth: 260,
    isSidebarCollapsed: false,
    activePanel: 'chat',
  });

  const {
    persistentSessions,
    currentSession,
    createNewChatSession,
    loadSession,
    deleteSession,
    loadSessions,
    initializeDefaultChat,
  } = useChatStore();

  const {
    currentProject,
    isProjectDialogOpen,
    loadCurrentProject,
    openProjectDialog,
    closeProjectDialog,
  } = useProjectStore();

  useEffect(() => {
    loadCurrentProject();
  }, [loadCurrentProject]);

  // Initialize chat when current project changes
  useEffect(() => {
    initializeDefaultChat();
  }, [currentProject, initializeDefaultChat]);

  const toggleSidebar = () => {
    setLayoutState((prev) => ({
      ...prev,
      isSidebarCollapsed: !prev.isSidebarCollapsed,
    }));
  };



  const handleNewChat = async () => {
    try {
      if (!currentProject) {
        // Open project dialog if no project is selected
        openProjectDialog();
        return;
      }
      
      // Create a new chat session
      await createNewChatSession();
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1a1a] text-white">
      {/* Sidebar */}
      <div
        className={clsx(
          'flex-shrink-0 bg-[#0f0f0f] transition-all duration-300 ease-in-out',
          layoutState.isSidebarCollapsed ? 'w-0 md:w-12' : 'w-full md:w-64',
          'absolute z-50 h-full md:relative'
        )}
      >
        {/* Sidebar Content */}
        {!layoutState.isSidebarCollapsed && (
          <div className="flex h-full flex-col">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-orange-500">
                  <span className="text-xs font-bold text-white">G</span>
                </div>
                <h1 className="text-sm font-medium text-white">Gemini</h1>
              </div>
              <button
                onClick={toggleSidebar}
                className="rounded-md p-1 transition-colors hover:bg-gray-800 md:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="px-3 pb-3">
              <button 
                onClick={handleNewChat}
                className={clsx(
                  "flex w-full items-center space-x-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  currentProject 
                    ? "border-gray-700 bg-transparent hover:bg-gray-800 text-white" 
                    : "border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400"
                )}
              >
                <Plus className="h-4 w-4" />
                <span>{currentProject ? "New Chat" : "Select Project"}</span>
              </button>
            </div>

            {/* Current Project Display */}
            {currentProject && (
              <div className="px-3 pb-3">
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-md">
                  <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{currentProject.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentProject.path}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Items */}
            <div className="space-y-1 px-3 pb-4">
              <button 
                onClick={openProjectDialog}
                className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Projects</span>
              </button>
            </div>

            {/* Sessions Section */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3">
                {/* Persistent Chat Sessions */}
                {persistentSessions.length > 0 ? (
                  <>
                    <h3 className="mb-2 px-3 text-xs font-medium text-gray-500">
                      Chats ({persistentSessions.length})
                    </h3>
                    <div className="space-y-1">
                      {persistentSessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => loadSession(session.id)}
                          className={clsx(
                            "group flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-800 cursor-pointer",
                            currentSession?.id === session.id ? "bg-gray-800" : ""
                          )}
                        >
                          <div className="flex-1 truncate">
                            <div className="truncate text-gray-300">
                              {session.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {session.messages.length} messages • {new Date(session.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-8 text-center">
                    <div className="text-gray-500 text-sm mb-2">No chats yet</div>
                    <div className="text-gray-600 text-xs">Click "New Chat" to start a conversation</div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="border-t border-gray-800 p-3">
              <div className="flex items-center space-x-2 px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500">
                  <span className="text-xs font-bold text-white">G</span>
                </div>
                <span className="text-sm text-gray-300">Gemini Desk</span>
              </div>

              {!currentProject && (
                <div className="mt-2 px-3 py-1">
                  <button
                    onClick={openProjectDialog}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Open a project to get started
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Sidebar Content */}
        {layoutState.isSidebarCollapsed && (
          <div className="hidden flex-col items-center space-y-4 py-4 md:flex">
            <button
              className="rounded-md p-2 transition-colors hover:bg-gray-800"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-2 transition-colors hover:bg-gray-800"
              title="Chats"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {!layoutState.isSidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Menu Button - Only visible on mobile when sidebar is collapsed */}
        {layoutState.isSidebarCollapsed && (
          <div className="flex items-center p-3 md:hidden">
            <button
              onClick={toggleSidebar}
              className="rounded-md p-2 transition-colors hover:bg-gray-800"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header with project info */}
          <Header />
          
          {/* Chat Content Area */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>

      {/* Project Dialog */}
      <ProjectDialog 
        isOpen={isProjectDialogOpen} 
        onClose={closeProjectDialog} 
      />
    </div>
  );
};

export default MainLayout;
