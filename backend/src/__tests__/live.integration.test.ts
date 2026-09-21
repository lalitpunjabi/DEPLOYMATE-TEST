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
import WebSocket from 'ws';

const enabled = process.env.LIVE_INTEGRATION === '1';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.LIVE_ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIVE_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
const WEBHOOK_SECRET = process.env.LIVE_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET;

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

  // Least privilege: a freshly self-registered 'Developer' may NOT create projects
  // (privilege escalation via self-registration must be impossible over live HTTP).
  const devAttemptProj = await request('POST', '/api/v1/projects', {
    headers: authUserA,
    body: { name: `should-fail-${suffix}`, github_repo_url: `https://github.com/example/x-${suffix}` },
  });
  assert.strictEqual(devAttemptProj.status, 403, `Developer self-registration must not allow project creation (got ${devAttemptProj.status})`);
  console.log('✅ Live 5: Self-registered Developer cannot create projects (no privilege escalation)');

  // Super Admin promotes A and B to 'DevOps Engineer' so each can own a project,
  // enabling a genuine two-tenant cross-access check.
  const userAId = regA.json?.user?.id;
  const userBId = regB.json?.user?.id;
  assert.ok(userAId && userBId, 'Registration must return the new user id');
  const promoteA = await request('PATCH', `/api/v1/admin/users/${userAId}/role`, { headers: authAdmin, body: { roleName: 'DevOps Engineer' } });
  const promoteB = await request('PATCH', `/api/v1/admin/users/${userBId}/role`, { headers: authAdmin, body: { roleName: 'DevOps Engineer' } });
  assert.strictEqual(promoteA.status, 200, promoteA.body);
  assert.strictEqual(promoteB.status, 200, promoteB.body);

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
  const projectAId = projA.json?.id || projA.json?.project?.id;
  const projectBId = projB.json?.id || projB.json?.project?.id;
  assert.ok(projectAId && projectBId);

  // Cross-tenant: A (owner of projA) must be denied B's project ...
  const stealProject = await request('GET', `/api/v1/pipelines?projectId=${projectBId}`, { headers: authUserA });
  assert.ok(stealProject.status === 403 || stealProject.status === 404, `Cross-tenant project access must be denied (got ${stealProject.status})`);
  // ... while owner access to its own project succeeds.
  const ownProject = await request('GET', `/api/v1/pipelines?projectId=${projectAId}`, { headers: authUserA });
  assert.strictEqual(ownProject.status, 200, `Owner must access its own project (got ${ownProject.status})`);
  console.log('✅ Live 6: Cross-tenant project denied while owner access allowed');

  // A's project listing must not expose B's project.
  const listA = await request('GET', '/api/v1/projects', { headers: authUserA });
  const listedIds = Array.isArray(listA.json) ? listA.json.map((p: any) => p.id) : [];
  assert.ok(!listedIds.includes(projectBId), 'User A project listing must not expose User B project');
  console.log('✅ Live 6b: User A project listing excludes User B project');

  const ticket = await request('POST', '/api/v1/auth/ws-ticket', { headers: authAdmin });
  assert.strictEqual(ticket.status, 200);
  assert.ok(ticket.json?.ticket);
  const firstTicket = ticket.json.ticket;
  console.log('✅ Live 7: WebSocket ticket issuance works');

  // Live 8: REAL WebSocket upgrade over the authenticated ticket (admin bypasses run-project check)
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  const validRunUuid = '00000000-0000-4000-8000-000000000001';
  const firstConnect = await wsUpgrade(`${wsBase}/ws/logs?runId=${validRunUuid}&ticket=${firstTicket}`);
  assert.strictEqual(firstConnect.ok, true, `First WebSocket upgrade with a valid ticket must succeed (got ${JSON.stringify(firstConnect)})`);
  console.log('✅ Live 8: WebSocket upgrade with a valid ticket succeeds');

  // Live 9: The SAME ticket is single-use — a replayed connection is rejected
  const replayConnect = await wsUpgrade(`${wsBase}/ws/logs?runId=${validRunUuid}&ticket=${firstTicket}`);
  assert.strictEqual(replayConnect.ok, false, 'Reusing a consumed WebSocket ticket must be rejected');
  console.log(`✅ Live 9: Replayed WebSocket ticket rejected (HTTP ${replayConnect.status ?? 'n/a'})`);

  // Live 10: JWT query-string authentication is rejected at the upgrade handler
  const jwtConnect = await wsUpgrade(`${wsBase}/ws/logs?runId=${validRunUuid}&token=${tokenAdmin}`);
  assert.strictEqual(jwtConnect.ok, false, 'WebSocket upgrade with a ?token= JWT must be rejected');
  console.log(`✅ Live 10: JWT query-string WebSocket authentication rejected (HTTP ${jwtConnect.status ?? 'n/a'})`);

  // Live 11: Malformed ticket is rejected without touching the store lookup path errors
  const malformed = await wsUpgrade(`${wsBase}/ws/logs?runId=${validRunUuid}&ticket=not-a-real-ticket`);
  assert.strictEqual(malformed.ok, false, 'Malformed WebSocket ticket must be rejected');
  console.log(`✅ Live 11: Malformed WebSocket ticket rejected (HTTP ${malformed.status ?? 'n/a'})`);

  // Live 12: Registration enforces the unified 12-character password policy over HTTP
  const weakReg = await request('POST', '/api/v1/auth/register', {
    body: { name: 'Weak PW', email: `weak-${suffix}@example.test`, password: 'Short1!' },
  });
  assert.strictEqual(weakReg.status, 400, `Weak (<12 char) password registration must be rejected (got ${weakReg.status})`);
  const strongReg = await request('POST', '/api/v1/auth/register', {
    body: { name: 'Strong PW', email: `strong-${suffix}@example.test`, password: `Str0ng!Pass-${suffix}` },
  });
  assert.ok(strongReg.status === 201 || strongReg.status === 200, `Compliant password registration must succeed: ${strongReg.body}`);
  console.log('✅ Live 12: 12-character password policy enforced on live registration');

  // Live 13: GitHub webhook HMAC enforcement over real HTTP (only when a secret is configured)
  if (WEBHOOK_SECRET) {
    const whBody = { ref: 'refs/heads/main', repository: { full_name: 'example/webhook-probe', html_url: 'https://github.com/example/webhook-probe' } };
    const rawBody = JSON.stringify(whBody);
    const goodSig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

    const badSig = await request('POST', '/api/v1/webhooks/github', {
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'push', 'x-github-delivery': `del-bad-${suffix}`, 'x-hub-signature-256': 'sha256=deadbeef' },
      body: undefined,
    });
    // Send raw body manually so signature is verifiable:
    const badRaw = await requestRaw('/api/v1/webhooks/github', rawBody, {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': `del-bad-${suffix}`,
      'x-hub-signature-256': 'sha256=deadbeef',
    });
    void badSig;
    assert.strictEqual(badRaw.status, 401, `Invalid webhook HMAC must be rejected (got ${badRaw.status}: ${badRaw.body})`);

    const goodRaw = await requestRaw('/api/v1/webhooks/github', rawBody, {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': `del-good-${suffix}`,
      'x-hub-signature-256': goodSig,
    });
    // Valid HMAC for an unregistered repo → 200 IGNORED (or 202 if it mapped). Never 401.
    assert.notStrictEqual(goodRaw.status, 401, `Valid webhook HMAC must not be rejected as unauthorized (got ${goodRaw.status})`);

    // Replay protection: identical delivery ID a second time is ignored, not re-accepted
    const replayRaw = await requestRaw('/api/v1/webhooks/github', rawBody, {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': `del-good-${suffix}`,
      'x-hub-signature-256': goodSig,
    });
    assert.ok(replayRaw.status === 200 && /Duplicate/i.test(replayRaw.body), `Replayed delivery id must be ignored (got ${replayRaw.status}: ${replayRaw.body})`);
    console.log('✅ Live 13: Webhook HMAC verification + replay protection enforced over HTTP');
  } else {
    console.log('⚠️ Live 13 skipped: LIVE_WEBHOOK_SECRET / GITHUB_WEBHOOK_SECRET not available to the test client.');
  }

  console.log('[Live Integration] Completed the checks that this environment can execute over HTTP + WebSocket.');
}

/** Perform a real WebSocket handshake and report success or the rejection HTTP status. */
function wsUpgrade(wsUrl: string): Promise<{ ok: boolean; status?: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const ws = new WebSocket(wsUrl, { handshakeTimeout: 8000 });
    const finish = (r: { ok: boolean; status?: number }) => {
      if (settled) return;
      settled = true;
      try { ws.terminate(); } catch { /* noop */ }
      resolve(r);
    };
    ws.on('open', () => finish({ ok: true }));
    ws.on('unexpected-response', (_req, res) => finish({ ok: false, status: res.statusCode }));
    ws.on('error', () => finish({ ok: false }));
    setTimeout(() => finish({ ok: false }), 9000);
  });
}

/** Issue a raw-body POST (needed for webhook HMAC where the signature covers exact bytes). */
function requestRaw(urlPath: string, rawBody: string, headers: Record<string, string>): Promise<HttpResult> {
  const url = new URL(urlPath, BASE_URL);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(rawBody) }, rejectUnauthorized: false, timeout: 15000 } as https.RequestOptions,
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let json: any = null;
          try { json = JSON.parse(body); } catch { json = null; }
          resolve({ status: res.statusCode || 0, headers: res.headers, body, json });
        });
      }
    );
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

if (require.main === module) {
  runLiveTests().catch((err) => {
    console.error('Live integration tests failed:', err);
    process.exit(1);
  });
}

export { runLiveTests };
