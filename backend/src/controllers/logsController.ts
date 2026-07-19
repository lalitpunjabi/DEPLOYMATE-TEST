import { Request, Response } from 'express';

// Pre-generated static logs representing various container operational steps
const simulatedLogs = [
  { timestamp: new Date(Date.now() - 60000 * 30).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Starting DEPLOYMATE Server on port 5000' },
  { timestamp: new Date(Date.now() - 60000 * 29).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Kubernetes Client successfully connected to Local cluster' },
  { timestamp: new Date(Date.now() - 60000 * 28).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'PostgreSQL connection pool established to localhost:5432' },
  { timestamp: new Date(Date.now() - 60000 * 25).toISOString(), level: 'INFO', pod: 'deploymate-ui-6b9f4d7a-xyz99', message: 'Vite Development Server listening on port 5173' },
  { timestamp: new Date(Date.now() - 60000 * 20).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Ingress routing rules applied to namespace [deploymate-staging]' },
  { timestamp: new Date(Date.now() - 60000 * 18).toISOString(), level: 'WARN', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'SMTP credentials missing in environment context. Email alerts disabled.' },
  { timestamp: new Date(Date.now() - 60000 * 15).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Incoming manual webhook trigger received for project [payment-gateway]' },
  { timestamp: new Date(Date.now() - 60000 * 14).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'GET /api/v1/projects 200 OK - 42.1ms' },
  { timestamp: new Date(Date.now() - 60000 * 12).toISOString(), level: 'INFO', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'FastAPI server started successfully on port 8000' },
  { timestamp: new Date(Date.now() - 60000 * 11).toISOString(), level: 'INFO', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'Google Gemini Pro SDK API connector authenticated successfully.' },
  { timestamp: new Date(Date.now() - 60000 * 10).toISOString(), level: 'ERROR', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Authentication failure: JWT verification signature mismatch for user: dev@deploymate.com' },
  { timestamp: new Date(Date.now() - 60000 * 8).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'POST /api/v1/auth/login 200 OK - 89.4ms' },
  { timestamp: new Date(Date.now() - 60000 * 5).toISOString(), level: 'WARN', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'Gemini request throttle: approaching rate-limit (92/100 requests per min)' },
  { timestamp: new Date(Date.now() - 60000 * 2).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'POST /api/v1/kubernetes/rollback 200 OK - 124.5ms' },
  { timestamp: new Date(Date.now() - 60000 * 1).toISOString(), level: 'ERROR', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Failed to resolve DNS query for ECR registry endpoint [deploymate-registry.amazonaws.com]' }
];

export async function getCentralizedLogs(req: Request, res: Response): Promise<void> {
  const { pod, level, query, limit } = req.query;

  try {
    let filteredLogs = [...simulatedLogs];

    // Filter by pod
    if (pod) {
      filteredLogs = filteredLogs.filter(log => log.pod === pod);
    }

    // Filter by level
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    // Filter by keyword query
    if (query) {
      const q = String(query).toLowerCase();
      filteredLogs = filteredLogs.filter(log => log.message.toLowerCase().includes(q));
    }

    // Apply limit
    if (limit) {
      const l = parseInt(String(limit), 10);
      if (!isNaN(l)) {
        filteredLogs = filteredLogs.slice(-l);
      }
    }

    res.status(200).json(filteredLogs);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve logs.', error: error.message });
  }
}
