import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectCassandra, closeCassandra } from './config/cassandra.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { userService } from './services/userService.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Root Healthcheck
app.get('/', (req, res) => {
  res.json({
    name: 'Enterprise Audit Log Monitoring System API',
    database: 'Apache Cassandra (Wide Column NoSQL)',
    version: '1.0.0',
    status: 'ACTIVE',
  });
});

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Start Server
async function startServer() {
  console.log('====================================================');
  console.log('   AUDIT LOG & SYSTEM OPERATION MONITORING BACKEND   ');
  console.log('   Primary Database: Apache Cassandra (NoSQL)       ');
  console.log('====================================================');

  // Connect to Cassandra
  const connected = await connectCassandra();
  if (!connected) {
    throw new Error('Cassandra is unavailable. Start the database before starting the real-data demo.');
  }
  await userService.initDb();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] REST API listening on port ${env.PORT} -> http://localhost:${env.PORT}`);
    console.log(`[Server] Health Endpoint -> http://localhost:${env.PORT}/api/health`);
  });

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    server.close(async () => {
      await closeCassandra();
      console.log('[Server] Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(async error => {
  console.error('[Startup failed]', error.message);
  await closeCassandra();
  process.exitCode = 1;
});

export default app;
