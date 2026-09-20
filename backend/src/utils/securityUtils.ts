import crypto from 'crypto';
import path from 'path';
import { URL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { Response } from 'express';

// Hash token helper using SHA-256
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Path traversal prevention helper
export function sanitizeFilePath(baseDir: string, relativePath: string): string {
  const absoluteBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(absoluteBase, relativePath);

  if (!resolvedPath.startsWith(absoluteBase)) {
    throw new Error('Security Error: Path traversal attempt detected.');
  }
  return resolvedPath;
}

// SSRF prevention helper for external URLs
export function validateExternalUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, loopback, private ranges, metadata service
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Safe spawn child process wrapper (no shell execution)
export function safeSpawnCommand(command: string, args: string[], options: object = {}): ChildProcess {
  return spawn(command, args, {
    ...options,
    shell: false, // Enforce no shell string interpretation
  });
}

// Safe error response wrapper
export function sendSafeError(res: Response, error: any, defaultMessage: string = 'Internal server error', statusCode: number = 500): void {
  const isDev = process.env.NODE_ENV === 'development';
  const requestId = crypto.randomUUID();

  console.error(`[Request Error - ID: ${requestId}]:`, error);

  res.status(statusCode).json({
    success: false,
    message: isDev ? error?.message || defaultMessage : defaultMessage,
    requestId,
  });
}
