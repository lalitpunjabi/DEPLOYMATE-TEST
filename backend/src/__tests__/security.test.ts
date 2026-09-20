import assert from 'assert';
import { hashToken, sanitizeFilePath, validateExternalUrl } from '../utils/securityUtils';

function runSecurityTests() {
  console.log('[Security Suite] Running DEPLOYMATE Security Regression Tests...');

  // Test 1: Token Hashing
  const token = 'sample-jwt-token-string';
  const hash1 = hashToken(token);
  const hash2 = hashToken(token);
  assert.strictEqual(hash1, hash2, 'Token hashes must be deterministic');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hash length must be 64 characters hex');
  console.log('✅ Test 1 Passed: Token Hashing SHA-256');

  // Test 2: Path Traversal
  const baseDir = process.cwd();
  assert.throws(
    () => sanitizeFilePath(baseDir, '../../../etc/passwd'),
    /Security Error: Path traversal attempt detected./,
    'Path traversal should throw Security Error'
  );
  console.log('✅ Test 2 Passed: Path Traversal Prevention');

  // Test 3: SSRF Prevention
  assert.strictEqual(validateExternalUrl('http://127.0.0.1/api'), false, 'Loopback IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://localhost:5000/internal'), false, 'localhost must be blocked');
  assert.strictEqual(validateExternalUrl('http://169.254.169.254/latest/meta-data/'), false, 'AWS metadata IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://10.0.0.1/admin'), false, 'Private 10.x IP must be blocked');
  assert.strictEqual(validateExternalUrl('http://192.168.1.1/router'), false, 'Private 192.168.x IP must be blocked');
  assert.strictEqual(validateExternalUrl('https://github.com/deploymate/core'), true, 'Public HTTPS URL must be allowed');
  console.log('✅ Test 3 Passed: SSRF IPv4 Filter');

  console.log('[Security Suite] ALL REGRESSION TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runSecurityTests();
}

export { runSecurityTests };
