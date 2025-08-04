import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

export function createServer(): Application {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  const allowedOrigins = [
    'http://localhost:3000', // Create React App default
    'http://localhost:5173', // Vite default
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        const msg =
          'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use(requestLogger);

  // API routes
  app.use('/api', apiRouter);

  // Health check endpoint (also available at root for load balancers)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gemini-desk-backend',
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'Gemini Desk Backend API',
      version: process.env.npm_package_version || '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api',
      },
    });
  });

  // 404 handler
  app.use('*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found on this server',
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}
