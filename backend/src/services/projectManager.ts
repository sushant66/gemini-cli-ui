import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Project } from '../types/session';

export interface ProjectManagerOptions {
  projectsDir?: string;
  maxRecentProjects?: number;
}

export interface CreateProjectRequest {
  name: string;
  path: string;
  description?: string;
}

export interface ProjectValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ProjectManager {
  private readonly projectsDir: string;
  private readonly maxRecentProjects: number;
  private readonly configFile: string;
  private recentProjects: string[] = [];
  private currentProjectId: string | null = null;

  constructor(options: ProjectManagerOptions = {}) {
    this.projectsDir = options.projectsDir || path.join(os.homedir(), '.gemini-desk', 'projects');
    this.maxRecentProjects = options.maxRecentProjects || 10;
    this.configFile = path.join(path.dirname(this.projectsDir), 'config.json');
  }

  /**
   * Initialize the project manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure projects directory exists
      await fs.mkdir(this.projectsDir, { recursive: true });
      
      // Load configuration
      await this.loadConfig();
    } catch (error) {
      console.error('Failed to initialize ProjectManager:', error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(request: CreateProjectRequest): Promise<Project> {
    // Validate the request
    const validationErrors = this.validateCreateProjectRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    // Check if project path exists and is accessible
    await this.validateProjectPath(request.path);

    const project: Project = {
      id: this.generateProjectId(),
      name: request.name,
      path: path.resolve(request.path),
      description: request.description,
      chatSessions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save project to disk
    await this.saveProject(project);

    // Add to recent projects
    await this.addToRecentProjects(project.id);

    return project;
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    try {
      const projectFile = path.join(this.projectsDir, `${id}.json`);
      const data = await fs.readFile(projectFile, 'utf-8');
      const project = JSON.parse(data);
      
      // Convert date strings back to Date objects
      project.createdAt = new Date(project.createdAt);
      project.updatedAt = new Date(project.updatedAt);
      
      return project;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const existingProject = await this.getProject(id);
    if (!existingProject) {
      throw new Error(`Project with ID ${id} not found`);
    }

    const updatedProject: Project = {
      ...existingProject,
      ...updates,
      id: existingProject.id, // Prevent ID changes
      updatedAt: new Date(),
    };

    // Validate the updated project
    const validationErrors = this.validateProject(updatedProject);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    await this.saveProject(updatedProject);
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    const projectFile = path.join(this.projectsDir, `${id}.json`);
    
    try {
      await fs.unlink(projectFile);
      
      // Remove from recent projects
      this.recentProjects = this.recentProjects.filter(pid => pid !== id);
      
      // Clear current project if it was deleted
      if (this.currentProjectId === id) {
        this.currentProjectId = null;
      }
      
      await this.saveConfig();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      const files = await fs.readdir(this.projectsDir);
      const projectFiles = files.filter(file => file.endsWith('.json'));
      
      const projects: Project[] = [];
      
      for (const file of projectFiles) {
        try {
          const projectId = path.basename(file, '.json');
          const project = await this.getProject(projectId);
          if (project) {
            projects.push(project);
          }
        } catch (error) {
          console.warn(`Failed to load project from ${file}:`, error);
        }
      }
      
      // Sort by updatedAt descending
      return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get recent projects
   */
  async getRecentProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    
    for (const projectId of this.recentProjects) {
      try {
        const project = await this.getProject(projectId);
        if (project) {
          projects.push(project);
        }
      } catch (error) {
        console.warn(`Failed to load recent project ${projectId}:`, error);
      }
    }
    
    return projects;
  }

  /**
   * Set current project
   */
  async setCurrentProject(projectId: string | null): Promise<void> {
    if (projectId) {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      // Validate project path still exists
      await this.validateProjectPath(project.path);
      
      // Add to recent projects
      await this.addToRecentProjects(projectId);
    }
    
    this.currentProjectId = projectId;
    await this.saveConfig();
  }

  /**
   * Get current project
   */
  async getCurrentProject(): Promise<Project | null> {
    if (!this.currentProjectId) {
      return null;
    }
    
    return this.getProject(this.currentProjectId);
  }

  /**
   * Get current project ID
   */
  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  /**
   * Open project directory (select existing directory)
   */
  async openProjectDirectory(directoryPath: string, name?: string): Promise<Project> {
    const resolvedPath = path.resolve(directoryPath);
    
    // Validate the directory
    await this.validateProjectPath(resolvedPath);
    
    // Check if project already exists for this path
    const existingProjects = await this.listProjects();
    const existingProject = existingProjects.find(p => p.path === resolvedPath);
    
    if (existingProject) {
      // Update recent projects and set as current
      await this.setCurrentProject(existingProject.id);
      return existingProject;
    }
    
    // Create new project for this directory
    const projectName = name || path.basename(resolvedPath);
    return this.createProject({
      name: projectName,
      path: resolvedPath,
      description: `Project opened from ${resolvedPath}`,
    });
  }

  /**
   * Validate project path exists and is accessible
   */
  private async validateProjectPath(projectPath: string): Promise<void> {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
      
      // Check if directory is accessible
      await fs.access(projectPath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Invalid project path: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate create project request
   */
  private validateCreateProjectRequest(request: CreateProjectRequest): ProjectValidationError[] {
    const errors: ProjectValidationError[] = [];
    
    if (!request.name || typeof request.name !== 'string' || request.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Project name is required and must be a non-empty string',
        value: request.name,
      });
    }
    
    if (!request.path || typeof request.path !== 'string' || request.path.trim().length === 0) {
      errors.push({
        field: 'path',
        message: 'Project path is required and must be a non-empty string',
        value: request.path,
      });
    }
    
    if (request.description !== undefined && typeof request.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Project description must be a string',
        value: request.description,
      });
    }
    
    return errors;
  }

  /**
   * Validate project object
   */
  private validateProject(project: Project): ProjectValidationError[] {
    const errors: ProjectValidationError[] = [];
    
    if (!project.id || typeof project.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Project ID is required and must be a string',
        value: project.id,
      });
    }
    
    if (!project.name || typeof project.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Project name is required and must be a string',
        value: project.name,
      });
    }
    
    if (!project.path || typeof project.path !== 'string') {
      errors.push({
        field: 'path',
        message: 'Project path is required and must be a string',
        value: project.path,
      });
    }
    
    if (!Array.isArray(project.chatSessions)) {
      errors.push({
        field: 'chatSessions',
        message: 'Chat sessions must be an array',
        value: project.chatSessions,
      });
    }
    
    return errors;
  }

  /**
   * Generate a unique project ID
   */
  private generateProjectId(): string {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save project to disk
   */
  private async saveProject(project: Project): Promise<void> {
    const projectFile = path.join(this.projectsDir, `${project.id}.json`);
    await fs.writeFile(projectFile, JSON.stringify(project, null, 2), 'utf-8');
  }

  /**
   * Add project to recent projects list
   */
  private async addToRecentProjects(projectId: string): Promise<void> {
    // Remove if already exists
    this.recentProjects = this.recentProjects.filter(id => id !== projectId);
    
    // Add to beginning
    this.recentProjects.unshift(projectId);
    
    // Limit to max recent projects
    if (this.recentProjects.length > this.maxRecentProjects) {
      this.recentProjects = this.recentProjects.slice(0, this.maxRecentProjects);
    }
    
    await this.saveConfig();
  }

  /**
   * Load configuration from disk
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configFile, 'utf-8');
      const config = JSON.parse(data);
      
      this.recentProjects = Array.isArray(config.recentProjects) ? config.recentProjects : [];
      this.currentProjectId = config.currentProjectId || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load project manager config:', error);
      }
      // Use defaults if config doesn't exist
    }
  }

  /**
   * Save configuration to disk
   */
  private async saveConfig(): Promise<void> {
    const config = {
      recentProjects: this.recentProjects,
      currentProjectId: this.currentProjectId,
    };
    
    // Ensure config directory exists
    await fs.mkdir(path.dirname(this.configFile), { recursive: true });
    
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
  }
}

// Export singleton instance
export const projectManager = new ProjectManager();