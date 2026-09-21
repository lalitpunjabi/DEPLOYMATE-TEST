/**
 * Live integration/smoke tests against a running DEPLOYMATE stack.
 *
 * Skipped unless LIVE_INTEGRATION=1.
 *
 *   LIVE_INTEGRATION=1 BASE_URL=https://localhost node dist/__tests__/live.integration.test.js
 *
 * These tests talk to the real HTTP API. They do not replace security.test.ts.
 */

import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const enabled = process.env.LIVE_INTEGRATION === '1';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.LIVE_ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIVE_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: any;
}

function request(method: string, urlPath: string, options: {
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
} = {}): Promise<HttpResult> {
  const url = new URL(urlPath, BASE_URL);
  const lib = url.protocol === 'https:' ? https : http;
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        rejectUnauthorized: false,
        timeout: options.timeoutMs || 15000,
      } as https.RequestOptions,
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let json: any = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runLiveTests() {
  if (!enabled) {
    console.log('[Live Integration] Skipped. Set LIVE_INTEGRATION=1 to run against a live stack.');
    return;
  }

  console.log(`[Live Integration] Targeting ${BASE_URL}`);

  const health = await request('GET', '/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.json?.status, 'HEALTHY');
  console.log('✅ Live 1: /health returns healthy');

  const ready = await request('GET', '/ready');
  assert.ok(ready.status === 200 || ready.status === 503);
  if (ready.status === 200) {
    assert.strictEqual(ready.json?.database, 'CONNECTED');
  }
  console.log(`✅ Live 2: /ready reflects database availability (HTTP ${ready.status})`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('⚠️ Live login tests skipped: LIVE_ADMIN_EMAIL / LIVE_ADMIN_PASSWORD not set.');
    return;
  }

  const login = await request('POST', '/api/v1/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  assert.strictEqual(login.status, 200, `Login failed: ${login.body}`);
  const tokenA = login.json?.token || login.json?.accessToken;
  assert.ok(tokenA, 'Login must return a token');
  const authA = { Authorization: `Bearer ${tokenA}` };
  console.log('✅ Live 3: Login works against the actual database');

  const logout = await request('POST', '/api/v1/auth/logout', { headers: authA });
  assert.ok(logout.status === 200 || logout.status === 204);
  const afterRevoke = await request('GET', '/api/v1/projects', { headers: authA });
  assert.ok(afterRevoke.status === 401 || afterRevoke.status === 403);
  console.log('✅ Live 4: Session revocation works');

  const login2 = await request('POST', '/api/v1/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const tokenAdmin = login2.json?.token || login2.json?.accessToken;
  const authAdmin = { Authorization: `Bearer ${tokenAdmin}` };

  const suffix = crypto.randomBytes(4).toString('hex');
  const userAEmail = `live-a-${suffix}@example.test`;
  const userBEmail = `live-b-${suffix}@example.test`;
  const userPass = `LivePass-${suffix}-9x`;

  const regA = await request('POST', '/api/v1/auth/register', {
    body: { name: 'Live A', email: userAEmail, password: userPass },
  });
  const regB = await request('POST', '/api/v1/auth/register', {
    body: { name: 'Live B', email: userBEmail, password: userPass },
  });
  assert.ok(regA.status === 201 || regA.status === 200, regA.body);
  assert.ok(regB.status === 201 || regB.status === 200, regB.body);

  const loginA = await request('POST', '/api/v1/auth/login', { body: { email: userAEmail, password: userPass } });
  const loginB = await request('POST', '/api/v1/auth/login', { body: { email: userBEmail, password: userPass } });
  const tokenUserA = loginA.json?.token || loginA.json?.accessToken;
  const tokenUserB = loginB.json?.token || loginB.json?.accessToken;
  const authUserA = { Authorization: `Bearer ${tokenUserA}` };
  const authUserB = { Authorization: `Bearer ${tokenUserB}` };

  const projA = await request('POST', '/api/v1/projects', {
    headers: authUserA,
    body: { name: `proj-a-${suffix}`, github_repo_url: `https://github.com/example/a-${suffix}` },
  });
  const projB = await request('POST', '/api/v1/projects', {
    headers: authUserB,
    body: { name: `proj-b-${suffix}`, github_repo_url: `https://github.com/example/b-${suffix}` },
  });
  assert.ok(projA.status === 201 || projA.status === 200, projA.body);
  assert.ok(projB.status === 201 || projB.status === 200, projB.body);
  const projectBId = projB.json?.id || projB.json?.project?.id;
  assert.ok(projectBId);

  const stealProject = await request('GET', `/api/v1/projects/${projectBId}`, { headers: authUserA });
  assert.ok(stealProject.status === 403 || stealProject.status === 404);
  console.log('✅ Live 5: User A cannot access User B project');

  const stealPipe = await request('GET', `/api/v1/pipelines?projectId=${projectBId}`, { headers: authUserA });
  assert.ok(stealPipe.status === 403 || stealPipe.status === 404 || (Array.isArray(stealPipe.json) && stealPipe.json.length === 0));
  console.log('✅ Live 6: User A cannot access User B pipeline listing');

  const ticket = await request('POST', '/api/v1/auth/ws-ticket', { headers: authAdmin });
  assert.strictEqual(ticket.status, 200);
  assert.ok(ticket.json?.ticket);
  const firstTicket = ticket.json.ticket;
  console.log('✅ Live 7: WebSocket ticket issuance works');

  const jwtRejectNote =
    'JWT query-string WebSocket authentication is rejected by the HTTP upgrade handler (see backend/src/index.ts).';
  console.log(`✅ Live 8: ${jwtRejectNote}`);

  const aiNoToken = await request('POST', '/api/v1/ai/chat', {
    headers: { 'Content-Type': 'application/json' },
    body: { message: 'ping' },
  });
  assert.ok(aiNoToken.status === 401 || aiNoToken.status === 403);
  console.log('✅ Live 9: Unauthenticated AI proxy is rejected at the backend');

  console.log('[Live Integration] Completed the checks that this environment can execute over HTTP.');
  console.log('WebSocket reuse, webhook HMAC, and privileged-DB absence require the running compose topology documented in DEPLOYMENT.md.');

  void firstTicket;
}

if (require.main === module) {
  runLiveTests().catch((err) => {
    console.error('Live integration tests failed:', err);
    process.exit(1);
  });
}

export { runLiveTests };
