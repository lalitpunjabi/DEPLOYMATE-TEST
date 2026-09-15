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
import pool from './config/db';

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Server for streaming pipeline logs
const wss = new WebSocketServer({ noServer: true });

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

// Upgrade HTTP connection to WebSocket for logs streaming
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/logs') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
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

// Fallback error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = parseInt(process.env.PORT || '5000', 10);
server.listen(PORT, () => {
  console.log(`DEPLOYMATE Platform Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
