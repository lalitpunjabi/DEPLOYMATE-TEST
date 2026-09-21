import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSafeError } from '../utils/securityUtils';

// Pre-generated static logs representing container operational steps (Simulated)
const simulatedLogs = [
  { timestamp: new Date(Date.now() - 60000 * 30).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Starting DEPLOYMATE Server on port 5000 (Simulated)' },
  { timestamp: new Date(Date.now() - 60000 * 29).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Kubernetes Client connected to cluster (Simulated)' },
  { timestamp: new Date(Date.now() - 60000 * 28).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'PostgreSQL connection pool established' },
  { timestamp: new Date(Date.now() - 60000 * 25).toISOString(), level: 'INFO', pod: 'deploymate-ui-6b9f4d7a-xyz99', message: 'Vite Server listening on port 5173 (Simulated)' },
  { timestamp: new Date(Date.now() - 60000 * 20).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Ingress routing rules applied to namespace [deploymate-staging]' },
  { timestamp: new Date(Date.now() - 60000 * 18).toISOString(), level: 'WARN', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'SMTP credentials missing in environment context.' },
  { timestamp: new Date(Date.now() - 60000 * 15).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Incoming webhook trigger received for project [payment-gateway]' },
  { timestamp: new Date(Date.now() - 60000 * 14).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'GET /api/v1/projects 200 OK - 42.1ms' },
  { timestamp: new Date(Date.now() - 60000 * 12).toISOString(), level: 'INFO', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'FastAPI server started on port 8000 (Simulated)' },
  { timestamp: new Date(Date.now() - 60000 * 10).toISOString(), level: 'ERROR', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Authentication failure: JWT verification signature mismatch' }
];

export async function getCentralizedLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId, pod, level, query: queryParam, limit } = req.query;

  if (!projectId && req.user?.role !== 'Super Admin') {
    res.status(403).json({ message: 'Forbidden. Valid project context is required for log retrieval.' });
    return;
  }

  try {
    let filteredLogs = simulatedLogs.map(log => ({ ...log, project_id: projectId || 'global' }));

    // Filter by pod
    if (pod) {
      filteredLogs = filteredLogs.filter(log => log.pod === pod);
    }

    // Filter by level
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    // Filter by keyword query
    if (queryParam) {
      const q = String(queryParam).toLowerCase();
      filteredLogs = filteredLogs.filter(log => log.message.toLowerCase().includes(q));
    }

    // Apply limit
    if (limit) {
      const l = parseInt(String(limit), 10);
      if (!isNaN(l)) {
        filteredLogs = filteredLogs.slice(-l);
      }
    }

    res.status(200).json({
      execution_mode: 'SIMULATED',
      project_id: projectId || 'global',
      logs: filteredLogs
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve logs.');
  }
}
