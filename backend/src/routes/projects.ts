import { Router, Request, Response } from 'express';
import { projectManager, CreateProjectRequest } from '../services/projectManager';

const router = Router();

// Get all projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await projectManager.listProjects();
    res.json({ projects });
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get recent projects
router.get('/recent', async (_req: Request, res: Response) => {
  try {
    const projects = await projectManager.getRecentProjects();
    res.json({ projects });
  } catch (error) {
    console.error('Failed to get recent projects:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get current project
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const project = await projectManager.getCurrentProject();
    res.json({ project });
  } catch (error) {
    console.error('Failed to get current project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Set current project
router.post('/current', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    
    if (projectId !== null && (typeof projectId !== 'string' || projectId.trim().length === 0)) {
      return res.status(400).json({
        error: 'Invalid project ID',
        message: 'Project ID must be a non-empty string or null',
      });
    }
    
    await projectManager.setCurrentProject(projectId);
    const project = await projectManager.getCurrentProject();
    
    res.json({ 
      success: true,
      project,
      message: projectId ? `Current project set to ${projectId}` : 'Current project cleared',
    });
  } catch (error) {
    console.error('Failed to set current project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await projectManager.getProject(id);
    
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        message: `Project with ID ${id} does not exist`,
      });
    }

    res.json({ project });
  } catch (error) {
    console.error('Failed to get project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create a new project
router.post('/', async (req: Request, res: Response) => {
  try {
    const createRequest: CreateProjectRequest = req.body;
    
    // Validate required fields
    if (!createRequest.name || !createRequest.path) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both name and path are required',
        required: ['name', 'path'],
      });
    }
    
    const project = await projectManager.createProject(createRequest);
    
    // Set as current project
    await projectManager.setCurrentProject(project.id);
    
    res.status(201).json({ 
      project,
      success: true,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Open existing directory as project
router.post('/open', async (req: Request, res: Response) => {
  try {
    const { path: directoryPath, name } = req.body;
    
    if (!directoryPath || typeof directoryPath !== 'string') {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Directory path is required',
        required: ['path'],
      });
    }
    
    const project = await projectManager.openProjectDirectory(directoryPath, name);
    
    // Set as current project
    await projectManager.setCurrentProject(project.id);
    
    res.json({ 
      project,
      success: true,
      message: 'Project opened successfully',
    });
  } catch (error) {
    console.error('Failed to open project directory:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a project
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate the project exists
    const existingProject = await projectManager.getProject(id);
    if (!existingProject) {
      return res.status(404).json({
        error: 'Project not found',
        message: `Project with ID ${id} does not exist`,
      });
    }

    await projectManager.updateProject(id, updates);
    const updatedProject = await projectManager.getProject(id);
    
    res.json({ 
      project: updatedProject,
      success: true,
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete a project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate the project exists
    const existingProject = await projectManager.getProject(id);
    if (!existingProject) {
      return res.status(404).json({
        error: 'Project not found',
        message: `Project with ID ${id} does not exist`,
      });
    }

    await projectManager.deleteProject(id);
    
    res.json({ 
      success: true,
      message: `Project ${id} deleted successfully`,
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as projectsRouter };