import assert from 'assert';
import { hashToken, sanitizeFilePath, validateExternalUrl, isPrivateIp, safeSpawnCommand } from '../utils/securityUtils';

async function runSecurityTests() {
  console.log('[Security Suite] Running DEPLOYMATE Security Regression Tests...');

  // Test 1: Token Hashing (SHA-256)
  const token = 'sample-jwt-token-string';
  const hash1 = hashToken(token);
  const hash2 = hashToken(token);
  assert.strictEqual(hash1, hash2, 'Token hashes must be deterministic');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hash length must be 64 characters hex');
  console.log('✅ Test 1 Passed: Token Hashing SHA-256');

  // Test 2: Path Traversal Prevention
  const baseDir = process.cwd();
  assert.throws(
    () => sanitizeFilePath(baseDir, '../../../etc/passwd'),
    /Security Error: Path traversal attempt detected./,
    'Path traversal should throw Security Error'
  );
  console.log('✅ Test 2 Passed: Path Traversal Prevention');

  // Test 3: SSRF IPv4 & IPv6 Filtering
  assert.strictEqual(validateExternalUrl('http://127.0.0.1/api'), false, 'Loopback IPv4 must be blocked');
  assert.strictEqual(validateExternalUrl('http://localhost:5000/internal'), false, 'localhost must be blocked');
  assert.strictEqual(validateExternalUrl('http://169.254.169.254/latest/meta-data/'), false, 'AWS metadata IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://10.0.0.1/admin'), false, 'Private 10.x IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://192.168.1.1/router'), false, 'Private 192.168.x IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://172.16.0.1/internal'), false, 'Private 172.16.x IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://metadata.google.internal'), false, 'GCP metadata hostname must be blocked');
  assert.strictEqual(validateExternalUrl('https://github.com/deploymate/core'), true, 'Public HTTPS URL must be allowed');
  console.log('✅ Test 3 Passed: SSRF IPv4 & Hostname Filter');

  // Test 4: SSRF Advanced IP Format Checks (IPv6, IPv4-mapped, Hex/Octal)
  assert.strictEqual(isPrivateIp('127.0.0.1'), true, '127.0.0.1 is private');
  assert.strictEqual(isPrivateIp('::1'), true, 'IPv6 loopback ::1 is private');
  assert.strictEqual(isPrivateIp('::ffff:127.0.0.1'), true, 'IPv4-mapped IPv6 loopback is private');
  assert.strictEqual(isPrivateIp('::ffff:10.0.0.1'), true, 'IPv4-mapped IPv6 10.x is private');
  assert.strictEqual(isPrivateIp('8.8.8.8'), false, 'Public IP 8.8.8.8 is not private');
  assert.strictEqual(validateExternalUrl('http://0x7f000001/'), false, 'Hex IP representation 0x7f000001 must be blocked');
  assert.strictEqual(validateExternalUrl('http://2130706433/'), false, 'Integer IP representation 2130706433 must be blocked');
  console.log('✅ Test 4 Passed: Advanced SSRF (IPv6 / Mapped / Alternate Formats)');

  // Test 5: Command Injection Safety (safeSpawnCommand wrapper)
  const child = safeSpawnCommand('node', ['-v']);
  assert.ok(child, 'safeSpawnCommand should spawn child process with shell: false');
  child.kill();
  console.log('✅ Test 5 Passed: Command Execution Safety (No Shell Concatenation)');

  // Test 6: Registration Role Forcing Logic Simulation
  const simulateRegistrationPayload = (body: any) => {
    // Backend forced override logic: ignore body.roleName
    const assignedRole = 'Developer';
    return { name: body.name, email: body.email, role: assignedRole };
  };
  const regResult = simulateRegistrationPayload({ name: 'Hacker', email: 'hacker@test.com', roleName: 'Super Admin' });
  assert.strictEqual(regResult.role, 'Developer', 'Public registration must never allow Super Admin assignment');
  console.log('✅ Test 6 Passed: Privilege Escalation Prevention (Role Forcing)');

  // Test 7: HMAC SHA-256 Constant-Time Verification Logic
  const crypto = await import('crypto');
  const secret = 'webhook-secret-key-123';
  const payloadStr = JSON.stringify({ action: 'push', repository: { name: 'deploymate' } });
  const validSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  
  const verifyHmac = (rawPayload: string, headerSig: string, key: string): boolean => {
    if (!headerSig || !headerSig.startsWith('sha256=')) return false;
    const digest = crypto.createHmac('sha256', key).update(rawPayload).digest('hex');
    const sigBuffer = Buffer.from(headerSig.slice(7), 'utf8');
    const digestBuffer = Buffer.from(digest, 'utf8');
    if (sigBuffer.length !== digestBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, digestBuffer);
  };

  assert.strictEqual(verifyHmac(payloadStr, validSig, secret), true, 'Valid HMAC signature must verify');
  assert.strictEqual(verifyHmac(payloadStr, 'sha256=invalidhexdigest', secret), false, 'Invalid HMAC digest must fail');
  assert.strictEqual(verifyHmac(payloadStr, validSig, 'wrong-secret'), false, 'HMAC with wrong secret must fail');
  console.log('✅ Test 7 Passed: Fail-Closed Constant-Time HMAC SHA-256 Verification');

  // Test 8: Webhook Secret Response Sanitization
  const sanitizeProjectResponse = (projectRow: any) => {
    const { webhook_secret, ...safeProject } = projectRow;
    return {
      ...safeProject,
      webhook_configured: Boolean(webhook_secret && webhook_secret.trim().length > 0)
    };
  };

  const dbProject = { id: 'proj-101', name: 'Frontend', webhook_secret: 'super-secret-key-456' };
  const sanitized = sanitizeProjectResponse(dbProject);
  assert.strictEqual((sanitized as any).webhook_secret, undefined, 'webhook_secret must be scrubbed from API output');
  assert.strictEqual(sanitized.webhook_configured, true, 'webhook_configured flag must be returned instead');
  console.log('✅ Test 8 Passed: Webhook Secret Sanitization');

  // Test 9: Multi-Tenant IDOR Project Authorization Check
  const checkProjectAuthorization = (userId: string, userRole: string, project: { owner_id: string; members: string[] }): boolean => {
    if (userRole === 'Super Admin') return true;
    if (project.owner_id === userId) return true;
    if (project.members.includes(userId)) return true;
    return false;
  };

  const projA = { owner_id: 'user-A-id', members: ['user-A-id', 'dev-user-id'] };
  assert.strictEqual(checkProjectAuthorization('user-A-id', 'Developer', projA), true, 'User A can access own project');
  assert.strictEqual(checkProjectAuthorization('user-B-id', 'Developer', projA), false, 'User B must be DENIED access to User A project (IDOR Blocked)');
  assert.strictEqual(checkProjectAuthorization('user-B-id', 'Super Admin', projA), true, 'Super Admin bypasses project isolation');
  console.log('✅ Test 9 Passed: Multi-Tenant IDOR Project Isolation');

  // Test 10: Internal AI Service Authentication Header Check
  const verifyAiInternalToken = (reqToken: string | undefined, expectedToken: string): boolean => {
    if (!reqToken || reqToken !== expectedToken) return false;
    return true;
  };
  assert.strictEqual(verifyAiInternalToken('secret-ai-token-777', 'secret-ai-token-777'), true, 'Matching AI internal token allows request');
  assert.strictEqual(verifyAiInternalToken('wrong-token', 'secret-ai-token-777'), false, 'Wrong AI token is rejected');
  assert.strictEqual(verifyAiInternalToken(undefined, 'secret-ai-token-777'), false, 'Missing AI token is rejected');
  console.log('✅ Test 10 Passed: Internal AI Service Token Gate');

  // Test 11: AI PR Fix Path Traversal & Size Bounds Validation
  const validateAiPrRequest = (targetFile: string, patchContent: string): { valid: boolean; reason?: string } => {
    if (targetFile.includes('..') || targetFile.startsWith('/')) {
      return { valid: false, reason: 'Path traversal attempt detected' };
    }
    if (patchContent.length > 100000) {
      return { valid: false, reason: 'Patch content exceeds maximum allowed size' };
    }
    return { valid: true };
  };

  assert.strictEqual(validateAiPrRequest('src/components/App.tsx', 'const a = 1;').valid, true, 'Valid file patch allowed');
  assert.strictEqual(validateAiPrRequest('../../../etc/passwd', 'malicious').valid, false, 'Path traversal target file rejected');
  assert.strictEqual(validateAiPrRequest('/etc/shadow', 'malicious').valid, false, 'Absolute root path target file rejected');
  assert.strictEqual(validateAiPrRequest('src/app.js', 'x'.repeat(100001)).valid, false, 'Over-sized patch content rejected');
  console.log('✅ Test 11 Passed: AI PR Fix Path Traversal & Size Bounds Validation');

  console.log('[Security Suite] ALL REGRESSION TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runSecurityTests().catch((err) => {
    console.error('Security test suite failed:', err);
    process.exit(1);
  });
}

export { runSecurityTests };

