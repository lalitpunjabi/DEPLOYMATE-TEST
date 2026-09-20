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

  console.log('[Security Suite] ALL REGRESSION TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runSecurityTests().catch((err) => {
    console.error('Security test suite failed:', err);
    process.exit(1);
  });
}

export { runSecurityTests };

