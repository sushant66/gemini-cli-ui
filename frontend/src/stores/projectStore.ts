import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Project } from '../types/session';
import { apiClient } from '../services/api';

export interface CreateProjectRequest {
  name: string;
  path: string;
  description?: string;
}

export interface OpenProjectRequest {
  path: string;
  name?: string;
}

interface ProjectState {
  // Current project state
  currentProject: Project | null;
  projects: Project[];
  recentProjects: Project[];
  isLoading: boolean;
  error: string | null;
  
  // Project selection dialog state
  isProjectDialogOpen: boolean;
  
  // Actions
  loadProjects: () => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  loadCurrentProject: () => Promise<void>;
  createProject: (request: CreateProjectRequest) => Promise<Project>;
  openProject: (request: OpenProjectRequest) => Promise<Project>;
  setCurrentProject: (projectId: string | null) => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  
  // Dialog actions
  openProjectDialog: () => void;
  closeProjectDialog: () => void;
  
  // Utility actions
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projects: [],
      recentProjects: [],
      isLoading: false,
      error: null,
      isProjectDialogOpen: false,

      // Load all projects
      loadProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.getProjects();
          // Convert date strings to Date objects
          const projects = response.projects.map(project => ({
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          }));
          set({ projects, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load projects',
            isLoading: false 
          });
        }
      },

      // Load recent projects
      loadRecentProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.getRecentProjects();
          // Convert date strings to Date objects
          const recentProjects = response.projects.map(project => ({
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          }));
          set({ recentProjects, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load recent projects',
            isLoading: false 
          });
        }
      },

      // Load current project
      loadCurrentProject: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.getCurrentProject();
          const currentProject = response.project ? {
            ...response.project,
            createdAt: new Date(response.project.createdAt),
            updatedAt: new Date(response.project.updatedAt),
          } : null;
          set({ currentProject, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load current project',
            isLoading: false 
          });
        }
      },

      // Create a new project
      createProject: async (request: CreateProjectRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.createProject(request);
          const project = {
            ...response.project,
            createdAt: new Date(response.project.createdAt),
            updatedAt: new Date(response.project.updatedAt),
          };
          
          // Update local state
          const { projects } = get();
          set({ 
            projects: [project, ...projects],
            currentProject: project,
            isLoading: false,
            isProjectDialogOpen: false,
          });
          
          // Refresh recent projects
          get().loadRecentProjects();
          
          return project;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create project',
            isLoading: false 
          });
          throw error;
        }
      },

      // Open existing directory as project
      openProject: async (request: OpenProjectRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.openProject(request);
          const project = {
            ...response.project,
            createdAt: new Date(response.project.createdAt),
            updatedAt: new Date(response.project.updatedAt),
          };
          
          // Update local state
          const { projects } = get();
          const existingIndex = projects.findIndex(p => p.id === project.id);
          const updatedProjects = existingIndex >= 0 
            ? projects.map((p, i) => i === existingIndex ? project : p)
            : [project, ...projects];
          
          set({ 
            projects: updatedProjects,
            currentProject: project,
            isLoading: false,
            isProjectDialogOpen: false,
          });
          
          // Refresh recent projects
          get().loadRecentProjects();
          
          return project;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to open project',
            isLoading: false 
          });
          throw error;
        }
      },

      // Set current project
      setCurrentProject: async (projectId: string | null) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.setCurrentProject(projectId);
          const response = await apiClient.getCurrentProject();
          const currentProject = response.project ? {
            ...response.project,
            createdAt: new Date(response.project.createdAt),
            updatedAt: new Date(response.project.updatedAt),
          } : null;
          
          set({ currentProject, isLoading: false });
          
          // Refresh recent projects if a project was set
          if (projectId) {
            get().loadRecentProjects();
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to set current project',
            isLoading: false 
          });
        }
      },

      // Switch to a different project
      switchProject: async (projectId: string) => {
        await get().setCurrentProject(projectId);
      },

      // Update a project
      updateProject: async (projectId: string, updates: Partial<Project>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.updateProject(projectId, updates);
          const updatedProject = {
            ...response.project,
            createdAt: new Date(response.project.createdAt),
            updatedAt: new Date(response.project.updatedAt),
          };
          
          // Update local state
          const { projects, currentProject } = get();
          const updatedProjects = projects.map(p => 
            p.id === projectId ? updatedProject : p
          );
          const newCurrentProject = currentProject?.id === projectId 
            ? updatedProject 
            : currentProject;
          
          set({ 
            projects: updatedProjects,
            currentProject: newCurrentProject,
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update project',
            isLoading: false 
          });
        }
      },

      // Delete a project
      deleteProject: async (projectId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.deleteProject(projectId);
          
          // Update local state
          const { projects, currentProject, recentProjects } = get();
          const updatedProjects = projects.filter(p => p.id !== projectId);
          const updatedRecentProjects = recentProjects.filter(p => p.id !== projectId);
          const newCurrentProject = currentProject?.id === projectId 
            ? null 
            : currentProject;
          
          set({ 
            projects: updatedProjects,
            recentProjects: updatedRecentProjects,
            currentProject: newCurrentProject,
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete project',
            isLoading: false 
          });
        }
      },

      // Open project selection dialog
      openProjectDialog: () => {
        set({ isProjectDialogOpen: true });
      },

      // Close project selection dialog
      closeProjectDialog: () => {
        set({ isProjectDialogOpen: false });
      },

      // Clear error state
      clearError: () => set({ error: null }),
    }),
    {
      name: 'project-store',
    }
  )
);