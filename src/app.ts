import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import profileRoutes from './routes/profile.routes';

import { tracingMiddleware } from './middlewares/tracing.middleware';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(tracingMiddleware);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger OpenAPI Spec definition
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'LinkedIn Reverse-Engineered Profile Scraper API',
    version: '1.0.0',
    description:
      'Hosted API that accepts a LinkedIn profile URL and returns structured JSON profile data directly over HTTP without browser automation.',
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Server',
    },
  ],
  paths: {
    '/api/v1/profile': {
      get: {
        summary: 'Get LinkedIn profile details by URL query parameter',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            description: 'Target LinkedIn profile URL or vanity username',
            schema: { type: 'string', example: 'https://www.linkedin.com/in/satyanadella/' },
          },
        ],
        responses: {
          200: { description: 'Structured JSON Profile Payload' },
          400: { description: 'Invalid Profile URL' },
          401: { description: 'LinkedIn Session Authentication Failure' },
          404: { description: 'Profile Not Found' },
          429: { description: 'LinkedIn Rate Limit Exceeded' },
        },
      },
      post: {
        summary: 'Get LinkedIn profile details by JSON body payload',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    example: 'https://www.linkedin.com/in/satyanadella/',
                  },
                },
                required: ['url'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Structured JSON Profile Payload' },
          400: { description: 'Invalid Profile URL' },
          401: { description: 'LinkedIn Session Authentication Failure' },
          404: { description: 'Profile Not Found' },
          429: { description: 'LinkedIn Rate Limit Exceeded' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Server Health Check',
        responses: {
          200: { description: 'Service status OK' },
        },
      },
    },
  },
};

import path from 'path';

app.use(express.static(path.join(__dirname, '../public')));

// Swagger Docs Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/v1', profileRoutes);

// Serve Web Dashboard
app.get(['/', '/dashboard'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// Global error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});
