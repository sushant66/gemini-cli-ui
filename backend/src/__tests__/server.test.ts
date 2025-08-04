import request from 'supertest';
import { createServer } from '../server';

describe('Backend API Server', () => {
  const app = createServer();

  describe('Health Check Endpoints', () => {
    it('should return health status at /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'gemini-desk-backend');
      expect(response.body).toHaveProperty('version');
    });

    it('should return health status at /api/health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'gemini-desk-api');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Root Endpoint', () => {
    it('should return API information at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message', 'Gemini Desk Backend API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('health', '/health');
      expect(response.body.endpoints).toHaveProperty('api', '/api');
    });
  });

  describe('API Routes', () => {
    it('should respond to /api/chats', async () => {
      const response = await request(app)
        .get('/api/chats')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
    });

    it('should respond to /api/sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);
      
      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
    });

    it('should respond to /api/files', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
    });

    it('should respond to /api/cli/execute with validation error', async () => {
      const response = await request(app)
        .post('/api/cli/execute')
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Missing required fields');
      expect(response.body).toHaveProperty('required');
    });

    it('should respond to /api/settings', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
    });

    it('should respond to /api/mcp/servers', async () => {
      const response = await request(app)
        .get('/api/mcp/servers')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});