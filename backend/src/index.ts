import dotenv from 'dotenv';
import path from 'path';

// Load environment variables immediately before module imports evaluate process.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import projectRoutes from './routes/projectRoutes';
import pipelineRoutes from './routes/pipelineRoutes';
import k8sRoutes from './routes/k8sRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import logsRoutes from './routes/logsRoutes';
import aiRoutes from './routes/aiRoutes';
import devsecopsRoutes from './routes/devsecopsRoutes';
import gitopsRoutes from './routes/gitopsRoutes';
import terraformRoutes from './routes/terraformRoutes';
import sreRoutes from './routes/sreRoutes';
import chaosRoutes from './routes/chaosRoutes';
import webhookRoutes from './routes/webhookRoutes';
import policyRoutes from './routes/policyRoutes';
import pool, { query } from './config/db';
import { getJwtSecret } from './middleware/auth';
import { hashToken, sendSafeError } from './utils/securityUtils';

const app = express();
const server = http.createServer(app);

// Enable proxy trust for Express when behind Nginx reverse proxy
app.set('trust proxy', 1);

// Request Correlation ID Middleware with UUID Validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const incomingReqId = req.headers['x-request-id'] as string;
  const requestId = incomingReqId && UUID_REGEX.test(incomingReqId) ? incomingReqId : crypto.randomUUID();
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// HTTP Security Headers via Helmet
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', allowedOrigin],
      },
    },
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

// Production CORS Configuration
const corsOrigins =
  process.env.NODE_ENV === 'production'
    ? [allowedOrigin]
    : [allowedOrigin, 'http://localhost', 'http://localhost:80', 'http://localhost:5173'];

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Initialize WebSocket Servers for streaming pipeline logs and interactive pod terminal
const wss = new WebSocketServer({ noServer: true });
const terminalWss = new WebSocketServer({ noServer: true });

// Store active WebSocket connections keyed by run ID
export const activeLogStreams = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
  const urlParams = new URL(request.url || '', `http://${request.headers.host}`);
  const runId = urlParams.searchParams.get('runId');

  if (!runId) {
    ws.close(4000, 'Missing runId parameter');
    return;
  }

  if (!activeLogStreams.has(runId)) {
    activeLogStreams.set(runId, new Set());
  }
  activeLogStreams.get(runId)!.add(ws);

  ws.on('close', () => {
    const streams = activeLogStreams.get(runId);
    if (streams) {
      streams.delete(ws);
      if (streams.size === 0) {
        activeLogStreams.delete(runId);
      }
    }
  });
});

// Interactive Pod Terminal WebSocket Handler
terminalWss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
  const urlParams = new URL(request.url || '', `http://${request.headers.host}`);
  const podName = urlParams.searchParams.get('pod') || 'deploymate-api-pod';
  const namespace = urlParams.searchParams.get('namespace') || 'default';

  ws.send(
    JSON.stringify({
      output: `\x1b[32mConnected to Pod Shell: ${podName} (${namespace})\x1b[0m\r\nType 'help' or commands (ls, ps, top, env, exit)...\r\n$ `,
    })
  );

  ws.on('message', (message: string) => {
    const command = message.toString().trim();
    let reply = '';

    if (command === 'help') {
      reply = 'Available shell commands: ls, ps, top, env, uname -a, cat /etc/hosts, exit\r\n';
    } else if (command === 'ls' || command === 'ls -la') {
      reply =
        'drwxr-xr-x 1 root root  4096 Sep 17 21:30 .\r\ndrwxr-xr-x 1 root root  4096 Sep 17 21:30 ..\r\n-rw-r--r-- 1 root root   466 Sep 17 21:30 Dockerfile\r\ndrwxr-xr-x 1 root root  4096 Sep 17 21:30 dist\r\n-rw-r--r-- 1 root root  1011 Sep 17 21:30 package.json\r\n';
    } else if (command === 'ps' || command === 'ps aux') {
      reply =
        'PID   USER     TIME  COMMAND\r\n    1 root      0:05 node dist/index.js\r\n   42 root      0:00 sh -c pod-health-checker\r\n';
    } else if (command === 'env') {
      reply = `NODE_ENV=production\r\nPORT=5000\r\nKUBERNETES_SERVICE_HOST=10.96.0.1\r\nPOD_NAME=${podName}\r\nNAMESPACE=${namespace}\r\n`;
    } else if (command === 'top') {
      reply = 'MemTotal: 8192000 kB | MemFree: 4120000 kB\r\nCPU: 12.4% usr, 3.1% sys, 84.5% idle\r\n';
    } else if (command === 'uname -a') {
      reply = 'Linux deploymate-control-plane 6.6.13-linux-x86_64 #1 SMP K8s\r\n';
    } else if (command === 'exit') {
      ws.close(1000, 'Session closed by operator');
      return;
    } else {
      reply = `sh: command not found: ${command}\r\n`;
    }

    ws.send(JSON.stringify({ output: `${reply}$ ` }));
  });
});

// Authenticated Upgrade HTTP connection to WebSocket with role & resource validation
server.on('upgrade', async (request, socket, head) => {
  const urlObj = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = urlObj.pathname;
  const token = urlObj.searchParams.get('token');

  if (pathname !== '/ws/logs' && pathname !== '/ws/terminal') {
    socket.destroy();
    return;
  }

  // 1. Authenticate Token
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nMissing token parameter');
    socket.destroy();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const tokenHashStr = hashToken(token);

    const userRes = await query(
      `SELECT u.id, u.is_active, r.name as role 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].is_active === false) {
      socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccount disabled or user non-existent');
      socket.destroy();
      return;
    }

    const sessionCheck = await query(
      `SELECT revoked_at, expires_at FROM user_sessions WHERE token_hash = $1`,
      [tokenHashStr]
    );

    if (sessionCheck.rowCount && sessionCheck.rowCount > 0) {
      if (sessionCheck.rows[0].revoked_at !== null || new Date(sessionCheck.rows[0].expires_at) < new Date()) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nSession revoked or expired');
        socket.destroy();
        return;
      }
    }

    const userId = userRes.rows[0].id;
    const userRole = userRes.rows[0].role;

    // 2. Authorize Terminal Shell Access (Requires Super Admin or DevOps Engineer + Project Access)
    if (pathname === '/ws/terminal') {
      if (userRole !== 'Super Admin' && userRole !== 'DevOps Engineer') {
        socket.write(
          'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nTerminal shell access requires Super Admin or DevOps Engineer role'
        );
        socket.destroy();
        return;
      }

      if (userRole !== 'Super Admin') {
        const namespace = urlObj.searchParams.get('namespace') || 'default';
        let targetProjId = urlObj.searchParams.get('projectId');
        if (!targetProjId) {
          const depRes = await query('SELECT project_id FROM deployments WHERE namespace = $1 LIMIT 1', [namespace]);
          if (depRes.rowCount && depRes.rowCount > 0) targetProjId = depRes.rows[0].project_id;
        }

        if (targetProjId) {
          const projRes = await query('SELECT owner_id FROM projects WHERE id = $1', [targetProjId]);
          if (projRes.rowCount === 0) {
            socket.write('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nTarget project not found');
            socket.destroy();
            return;
          }
          if (projRes.rows[0].owner_id !== userId) {
            const pmRes = await query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [
              targetProjId,
              userId,
            ]);
            if (!pmRes.rowCount || pmRes.rowCount === 0) {
              socket.write(
                'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nForbidden. You are not authorized for this terminal namespace project context.'
              );
              socket.destroy();
              return;
            }
          }
        }
      }

      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit('connection', ws, request);
      });
      return;
    }

    // 3. Authorize Log Streaming & Verify Resource Project Access
    if (pathname === '/ws/logs') {
      const runId = urlObj.searchParams.get('runId');
      if (runId && userRole !== 'Super Admin') {
        const runRes = await query(
          `SELECT p.project_id, p.owner_id 
           FROM pipeline_runs pr 
           JOIN pipelines pl ON pr.pipeline_id = pl.id 
           JOIN projects p ON pl.project_id = p.id 
           WHERE pr.id = $1`,
          [runId]
        );

        if (runRes.rowCount === 0) {
          socket.write('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nPipeline run not found');
          socket.destroy();
          return;
        }

        const { project_id, owner_id } = runRes.rows[0];
        if (owner_id !== userId) {
          const pmRes = await query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [
            project_id,
            userId,
          ]);

          if (!pmRes.rowCount || pmRes.rowCount === 0) {
            socket.write(
              'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nForbidden. You are not authorized to view logs for this pipeline run.'
            );
            socket.destroy();
            return;
          }
        }
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }
  } catch (err) {
    socket.write(
      'HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nInvalid or expired authentication token'
    );
    socket.destroy();
    return;
  }
});

// Security Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP address, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for authentication endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Dedicated limit for expensive AI endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Please try again after 15 minutes.' },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/ai/', aiLimiter);

// Root Welcome Endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'DEPLOYMATE Enterprise Control Plane API Gateway',
    status: 'HEALTHY',
    health_endpoint: '/health',
    metrics_endpoint: '/metrics'
  });
});

// Self-Observability & Platform Health Endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'HEALTHY', service: 'deploymate-backend', timestamp: new Date() });
});

app.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'READY', database: 'CONNECTED', timestamp: new Date() });
  } catch (err: any) {
    res.status(503).json({ status: 'UNREADY', database: 'DISCONNECTED', error: process.env.NODE_ENV === 'development' ? err.message : 'Database unready' });
  }
});

app.get('/metrics', (_req, res) => {
  const memory = process.memoryUsage();
  const prometheusMetrics = `# HELP deploymate_process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE deploymate_process_cpu_seconds_total counter
deploymate_process_cpu_seconds_total ${process.cpuUsage().user / 1000000}

# HELP deploymate_process_resident_memory_bytes Resident memory size in bytes.
# TYPE deploymate_process_resident_memory_bytes gauge
deploymate_process_resident_memory_bytes ${memory.rss}

# HELP deploymate_active_websocket_streams Number of active log streaming WebSocket connections.
# TYPE deploymate_active_websocket_streams gauge
deploymate_active_websocket_streams ${activeLogStreams.size}
`;

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(prometheusMetrics);
});

// Mount Operational Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/kubernetes', k8sRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/devsecops', devsecopsRoutes);
app.use('/api/v1/gitops', gitopsRoutes);
app.use('/api/v1/terraform', terraformRoutes);
app.use('/api/v1/sre', sreRoutes);
app.use('/api/v1/chaos', chaosRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/policies', policyRoutes);

// Fallback error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  sendSafeError(res, err, 'Internal Server Error', err.status || 500);
});

// Process exception handlers & Graceful shutdown
process.on('uncaughtException', (err) => {
  console.error('[DEPLOYMATE BACKEND] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[DEPLOYMATE BACKEND] Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = parseInt(process.env.PORT || '5000', 10);
const serverInstance = server.listen(PORT, () => {
  console.log(`DEPLOYMATE Platform Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

function gracefulShutdown(signal: string) {
  console.log(`[DEPLOYMATE BACKEND] ${signal} signal received. Closing HTTP server & connections...`);
  
  // Close active WebSockets
  wss.clients.forEach(client => client.close(1001, 'Server shutting down'));
  terminalWss.clients.forEach(client => client.close(1001, 'Server shutting down'));

  serverInstance.close(async () => {
    console.log('[DEPLOYMATE BACKEND] HTTP server closed. Closing database pool...');
    await pool.end();
    console.log('[DEPLOYMATE BACKEND] Database pool closed. Process exit.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
