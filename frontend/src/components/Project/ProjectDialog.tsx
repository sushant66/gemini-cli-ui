import React, { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, Plus, Clock, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useProjectStore, CreateProjectRequest, OpenProjectRequest } from '../../stores/projectStore';
import { Project } from '../../types/session';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DialogMode = 'select' | 'create' | 'open';

const ProjectDialog: React.FC<ProjectDialogProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<DialogMode>('select');
  const [createForm, setCreateForm] = useState<CreateProjectRequest>({
    name: '',
    path: '',
    description: '',
  });
  const [openForm, setOpenForm] = useState<OpenProjectRequest>({
    path: '',
    name: '',
  });

  const {
    projects,
    recentProjects,
    currentProject,
    isLoading,
    error,
    loadProjects,
    loadRecentProjects,
    createProject,
    openProject,
    switchProject,
    deleteProject,
    clearError,
  } = useProjectStore();

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      loadRecentProjects();
      clearError();
    }
  }, [isOpen, loadProjects, loadRecentProjects, clearError]);

  const handleClose = () => {
    setMode('select');
    setCreateForm({ name: '', path: '', description: '' });
    setOpenForm({ path: '', name: '' });
    clearError();
    onClose();
  };

  const handleProjectSelect = async (project: Project) => {
    try {
      await switchProject(project.id);
      handleClose();
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.path.trim()) {
      return;
    }

    try {
      await createProject({
        name: createForm.name.trim(),
        path: createForm.path.trim(),
        description: createForm.description?.trim() || undefined,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleOpenProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openForm.path.trim()) {
      return;
    }

    try {
      await openProject({
        path: openForm.path.trim(),
        name: openForm.name?.trim() || undefined,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? This will only remove it from Gemini Desk, not delete the actual files.')) {
      try {
        await deleteProject(projectId);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleBrowseDirectory = async () => {
    // Check if we're in an Electron environment or have access to the File System Access API
    if ('showDirectoryPicker' in window) {
      try {
        // Use the modern File System Access API (Chrome 86+)
        const dirHandle = await (window as any).showDirectoryPicker();
        const directoryName = dirHandle.name;
        
        // Get the current platform to provide better examples
        const platform = navigator.platform.toLowerCase();
        const isWindows = platform.includes('win');
        const isMac = platform.includes('mac');
        
        let examplePath = '';
        if (isWindows) {
          examplePath = `C:\\Users\\${navigator.userAgent.includes('Windows') ? 'username' : 'your-username'}\\projects\\${directoryName}`;
        } else if (isMac) {
          examplePath = `/Users/${navigator.userAgent.includes('Mac') ? 'username' : 'your-username'}/projects/${directoryName}`;
        } else {
          examplePath = `/home/username/projects/${directoryName}`;
        }
        
        // Show a helpful dialog explaining the limitation
        const userPath = prompt(
          `✅ Selected directory: "${directoryName}"\n\n` +
          `⚠️  Browser Security Limitation:\n` +
          `For security reasons, browsers don't provide the full directory path.\n\n` +
          `📝 Please enter the complete path to "${directoryName}":\n\n` +
          `💡 Example for your system:\n${examplePath}\n\n` +
          `🔍 Tip: You can copy the path from your file manager's address bar.`,
          examplePath
        );
        
        if (userPath && userPath.trim()) {
          if (mode === 'create') {
            setCreateForm(prev => ({
              ...prev,
              path: userPath.trim(),
              name: prev.name || directoryName
            }));
          } else {
            setOpenForm(prev => ({
              ...prev,
              path: userPath.trim(),
              name: prev.name || directoryName
            }));
          }
        }
      } catch (error) {
        // User cancelled or error occurred
        console.log('Directory selection cancelled or failed:', error);
      }
    } else {
      // Fallback: Show an alert with instructions
      alert(
        '🚫 Directory Browser Not Available\n\n' +
        'Your browser doesn\'t support directory browsing.\n\n' +
        '📝 Please manually enter the full path to your project directory:\n\n' +
        '💡 Examples:\n' +
        '• macOS/Linux: /Users/username/projects/my-project\n' +
        '• Windows: C:\\Users\\username\\projects\\my-project\n\n' +
        '🔍 Tip: Copy the path from your file manager\'s address bar.'
      );
      
      // Focus the input field
      const input = document.getElementById(mode === 'create' ? 'create-path' : 'open-path');
      input?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl max-h-[80vh] bg-[#1a1a1a] rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'select' && 'Select Project'}
            {mode === 'create' && 'Create New Project'}
            {mode === 'open' && 'Open Directory'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md transition-colors hover:bg-gray-800"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-md">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {mode === 'select' && (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setMode('create')}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Project</span>
                </button>
                <button
                  onClick={() => setMode('open')}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Open Directory</span>
                </button>
              </div>

              {/* Recent Projects */}
              {recentProjects.length > 0 && (
                <div>
                  <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                    <Clock className="h-4 w-4" />
                    <span>Recent Projects</span>
                  </h3>
                  <div className="space-y-1">
                    {recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className={clsx(
                          "group flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors",
                          currentProject?.id === project.id
                            ? "bg-blue-900/20 border border-blue-700"
                            : "hover:bg-gray-800"
                        )}
                        onClick={() => handleProjectSelect(project)}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Folder className="h-5 w-5 text-blue-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium truncate">{project.name}</p>
                            <p className="text-gray-400 text-sm truncate">{project.path}</p>
                            {project.description && (
                              <p className="text-gray-500 text-xs truncate">{project.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                          title="Delete project"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Projects */}
              {projects.length > 0 && (
                <div>
                  <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                    <Folder className="h-4 w-4" />
                    <span>All Projects ({projects.length})</span>
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className={clsx(
                          "group flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors",
                          currentProject?.id === project.id
                            ? "bg-blue-900/20 border border-blue-700"
                            : "hover:bg-gray-800"
                        )}
                        onClick={() => handleProjectSelect(project)}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Folder className="h-5 w-5 text-blue-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium truncate">{project.name}</p>
                            <p className="text-gray-400 text-sm truncate">{project.path}</p>
                            {project.description && (
                              <p className="text-gray-500 text-xs truncate">{project.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                          title="Delete project"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {projects.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">No projects found</p>
                  <p className="text-gray-500 text-sm">Create a new project or open an existing directory to get started.</p>
                </div>
              )}
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="create-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  id="create-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Awesome Project"
                  required
                />
              </div>

              <div>
                <label htmlFor="create-path" className="block text-sm font-medium text-gray-300 mb-1">
                  Project Path *
                </label>
                <div className="flex space-x-2">
                  <input
                    id="create-path"
                    type="text"
                    value={createForm.path}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, path: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., /Users/username/projects/my-project"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleBrowseDirectory}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-gray-300 transition-colors"
                    title="Browse for directory (if supported by browser)"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the full path where you want to create the project directory.<br/>
                  <span className="text-gray-600">Note: Browse button helps select folder name, but you'll need to provide the full path.</span>
                </p>
              </div>

              <div>
                <label htmlFor="create-description" className="block text-sm font-medium text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="create-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of your project..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !createForm.name.trim() || !createForm.path.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors"
                >
                  {isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          )}

          {mode === 'open' && (
            <form onSubmit={handleOpenProject} className="space-y-4">
              <div>
                <label htmlFor="open-path" className="block text-sm font-medium text-gray-300 mb-1">
                  Directory Path *
                </label>
                <div className="flex space-x-2">
                  <input
                    id="open-path"
                    type="text"
                    value={openForm.path}
                    onChange={(e) => setOpenForm(prev => ({ ...prev, path: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., /Users/username/projects/existing-project"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleBrowseDirectory}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-gray-300 transition-colors"
                    title="Browse for directory (if supported by browser)"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the full path to an existing project directory.<br/>
                  <span className="text-gray-600">Note: Browse button helps select folder name, but you'll need to provide the full path.</span>
                </p>
              </div>

              <div>
                <label htmlFor="open-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name (Optional)
                </label>
                <input
                  id="open-name"
                  type="text"
                  value={openForm.name}
                  onChange={(e) => setOpenForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty to use directory name"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !openForm.path.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors"
                >
                  {isLoading ? 'Opening...' : 'Open Directory'}
                </button>
              </div>
            </form>
          )}

          {isLoading && mode === 'select' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDialog;