import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

const Header: React.FC = () => {
  const { currentProject, openProjectDialog } = useProjectStore();

  if (!currentProject) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">No project selected</span>
        </div>
        <button
          onClick={openProjectDialog}
          className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          <span>Open Project</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-gray-800">
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-white">{currentProject.name}</span>
          <span className="text-sm text-gray-400 ml-2">•</span>
          <span className="text-sm text-gray-400 ml-2 truncate">{currentProject.path}</span>
        </div>
      </div>
      <button
        onClick={openProjectDialog}
        className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors flex-shrink-0"
        title="Switch project"
      >
        <FolderOpen className="h-3 w-3" />
        <span>Switch</span>
      </button>
    </div>
  );
};

export default Header;