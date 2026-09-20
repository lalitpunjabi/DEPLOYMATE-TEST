import dotenv from 'dotenv';
import path from 'path';

// Load environment variables immediately before module imports evaluate process.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
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
import pool from './config/db';

const app = express();
const server = http.createServer(app);

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

  ws.send(JSON.stringify({ 
    output: `\x1b[32mConnected to Pod Shell: ${podName} (${namespace})\x1b[0m\r\nType 'help' or commands (ls, ps, top, env, exit)...\r\n$ ` 
  }));

  ws.on('message', (message: string) => {
    const command = message.toString().trim();
    let reply = '';

    if (command === 'help') {
      reply = "Available shell commands: ls, ps, top, env, uname -a, cat /etc/hosts, exit\r\n";
    } else if (command === 'ls' || command === 'ls -la') {
      reply = "drwxr-xr-x 1 root root  4096 Sep 17 21:30 .\r\ndrwxr-xr-x 1 root root  4096 Sep 17 21:30 ..\r\n-rw-r--r-- 1 root root   466 Sep 17 21:30 Dockerfile\r\ndrwxr-xr-x 1 root root  4096 Sep 17 21:30 dist\r\n-rw-r--r-- 1 root root  1011 Sep 17 21:30 package.json\r\n";
    } else if (command === 'ps' || command === 'ps aux') {
      reply = "PID   USER     TIME  COMMAND\r\n    1 root      0:05 node dist/index.js\r\n   42 root      0:00 sh -c pod-health-checker\r\n";
    } else if (command === 'env') {
      reply = `NODE_ENV=production\r\nPORT=5000\r\nKUBERNETES_SERVICE_HOST=10.96.0.1\r\nPOD_NAME=${podName}\r\nNAMESPACE=${namespace}\r\n`;
    } else if (command === 'top') {
      reply = "MemTotal: 8192000 kB | MemFree: 4120000 kB\r\nCPU: 12.4% usr, 3.1% sys, 84.5% idle\r\n";
    } else if (command === 'uname -a') {
      reply = "Linux deploymate-control-plane 6.6.13-linux-x86_64 #1 SMP K8s\r\n";
    } else if (command === 'exit') {
      ws.close(1000, 'Session closed by operator');
      return;
    } else {
      reply = `sh: command not found: ${command}\r\n`;
    }

    ws.send(JSON.stringify({ output: `${reply}$ ` }));
  });
});

// Upgrade HTTP connection to WebSocket for logs and terminal streaming
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/logs') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiting for Security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Root Welcome Endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'DEPLOYMATE Enterprise Control Plane API Gateway',
    status: 'HEALTHY',
    frontend_portal: 'http://localhost:5173',
    health_endpoint: 'http://localhost:5000/health',
    metrics_endpoint: 'http://localhost:5000/metrics'
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
    res.status(503).json({ status: 'UNREADY', database: 'DISCONNECTED', error: err.message });
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
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Process exception handlers
process.on('uncaughtException', (err) => {
  console.error('[DEPLOYMATE BACKEND] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[DEPLOYMATE BACKEND] Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = parseInt(process.env.PORT || '5000', 10);
server.listen(PORT, () => {
  console.log(`DEPLOYMATE Platform Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

