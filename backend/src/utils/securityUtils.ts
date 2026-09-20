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

import net from 'net';
import dns from 'dns';

// Helper to check if an IP address is private/internal
export function isPrivateIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (ip.startsWith('::ffff:')) {
    const rawV4 = ip.substring(7);
    if (net.isIPv4(rawV4)) {
      return isPrivateIp(rawV4);
    }
  }

  // IPv4 Checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    const [a, b] = parts;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8
    if (a === 0) return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1 or ::
    if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unique Local (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link Local (fe80::/10)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb'))
      return true;
  }

  return false;
}

// SSRF prevention helper for external URLs (synchronous string & IP checks)
export function validateExternalUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check common hostname blacklists
    if (
      hostname === 'localhost' ||
      hostname === 'metadata.google.internal' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Hex / Octal / Decimal integer IP format checks (e.g., 0x7f000001, 2130706433, 0177.0.0.1)
    if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
      return false;
    }

    // Direct IP address check
    if (net.isIP(hostname) && isPrivateIp(hostname)) {
      return false;
    }

    // String prefix fallback for standard IPv4 dot notation
    if (
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// SSRF prevention helper with DNS resolution
export async function validateExternalUrlAsync(urlString: string): Promise<boolean> {
  if (!validateExternalUrl(urlString)) return false;

  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;

    if (!net.isIP(hostname)) {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return false;
        }
      }
    }

    return true;
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
