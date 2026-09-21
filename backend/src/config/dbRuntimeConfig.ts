export interface RuntimeDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const INSECURE_APP_PASSWORDS = new Set([
  'deploymate_app_password',
  'deploymate_app_password_dev',
  'postgrespassword',
  'postgres_dev_only',
  'postgres',
]);

const INSECURE_ADMIN_PASSWORDS = new Set(['postgrespassword', 'postgres_dev_only', 'postgres']);

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Runtime application pool credentials.
 * Production must use only DB_APP_USER / DB_APP_PASSWORD.
 */
export function resolveRuntimeDbConfig(env: NodeJS.ProcessEnv = process.env): RuntimeDbConfig {
  const host = env.DB_HOST || 'localhost';
  const port = parseInt(env.DB_PORT || '5432', 10);
  const database = env.DB_NAME || 'deploymate';

  if (isProduction(env)) {
    const user = env.DB_APP_USER?.trim();
    const password = env.DB_APP_PASSWORD;

    if (!user) {
      throw new Error(
        'FATAL SECURITY ERROR: DB_APP_USER is required in production. Privileged DB_USER must not be used for application queries.'
      );
    }
    if (!password || !password.trim()) {
      throw new Error(
        'FATAL SECURITY ERROR: DB_APP_PASSWORD is required in production. Privileged DB_PASSWORD must not be used for application queries.'
      );
    }
    if (INSECURE_APP_PASSWORDS.has(password.trim())) {
      throw new Error('FATAL SECURITY ERROR: DB_APP_PASSWORD is using an insecure default value.');
    }

    return { host, port, user, password, database };
  }

  const user = (env.DB_APP_USER || env.DB_USER || 'deploymate_app').trim();
  const password = env.DB_APP_PASSWORD || env.DB_PASSWORD;
  if (!password) {
    throw new Error(
      'DB_APP_PASSWORD is required for the application database pool. In development you may set DB_PASSWORD as a fallback after creating the app role.'
    );
  }

  return { host, port, user, password, database };
}

/**
 * Privileged credentials used only by db:init (database/role provisioning).
 */
export function resolveAdminDbConfig(env: NodeJS.ProcessEnv = process.env): Omit<RuntimeDbConfig, 'database'> & {
  database?: string;
} {
  const host = env.DB_HOST || 'localhost';
  const port = parseInt(env.DB_PORT || '5432', 10);
  const user = env.DB_USER?.trim();
  const password = env.DB_PASSWORD;

  if (!user || !password) {
    throw new Error(
      'FATAL: DB_USER and DB_PASSWORD are required for administrative database initialization (db:init). These must not be injected into the production backend runtime.'
    );
  }

  if (isProduction(env) && INSECURE_ADMIN_PASSWORDS.has(password.trim())) {
    throw new Error('FATAL SECURITY ERROR: DB_PASSWORD is using an insecure default value.');
  }

  return { host, port, user, password };
}

export function validateProductionRuntimeSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProduction(env)) {
    return;
  }

  const insecureDefaults = [
    'postgrespassword',
    'deploymate-jwt-secret-key-change-in-production',
    'deploymate_app_password',
    'AdminPass123!',
    'admin123',
    'deploymate-internal-ai-secret-token-dev-only',
  ];

  const requiredKeys = ['DB_APP_USER', 'DB_APP_PASSWORD', 'JWT_SECRET', 'AI_INTERNAL_TOKEN', 'GITHUB_WEBHOOK_SECRET'];

  const missingSecrets = requiredKeys.filter((key) => {
    const val = env[key];
    return !val || val.trim().length === 0 || insecureDefaults.includes(val.trim());
  });

  if (missingSecrets.length > 0) {
    throw new Error(
      `FATAL SECURITY ERROR: Mandatory production secrets are unconfigured or using insecure default values: [${missingSecrets.join(
        ', '
      )}]. Deployment aborted.`
    );
  }

  if (env.DB_USER || env.DB_PASSWORD) {
    // Presence is not a hard failure (one-off bootstrap jobs may inherit a file), but runtime
    // query configuration must still ignore these values. resolveRuntimeDbConfig enforces that.
  }
}

export function assertIdentifier(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`SECURITY ERROR: Invalid ${label} identifier "${value}". Use alphanumeric characters and underscores only.`);
  }
  return value;
}
