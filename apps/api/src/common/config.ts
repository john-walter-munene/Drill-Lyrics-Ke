import { Logger } from '@nestjs/common';

/**
 * Minimum length for a secret to be considered "strong". A rotated secret
 * should carry at least 32 bytes of entropy — e.g. `openssl rand -hex 32` (64
 * hex chars) or `openssl rand -base64 32` (44 chars).
 */
export const MIN_SECRET_LENGTH = 32;

/** Env vars that MUST hold a strong, operator-supplied secret in production. */
export const SECRET_KEYS = ['JWT_SECRET'] as const;

/**
 * Known placeholder/example values that must never survive into production.
 * Compared case-insensitively. Keep in sync with `.env.example`.
 */
const INSECURE_DEFAULTS = new Set([
  'change-me',
  'change-me-in-prod',
  'change-me-now',
  'secret',
  'password',
  'changeme',
]);

/**
 * Pure environment audit: returns a list of human-readable problems, or an
 * empty array when the configuration is safe. Extracted from `validateEnv` so
 * it can be unit-tested without side effects (logging / throwing).
 */
export function collectConfigProblems(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required');

  for (const key of SECRET_KEYS) {
    const val = env[key];
    if (!val) {
      problems.push(`${key} must be set to a strong, non-default value`);
    } else if (INSECURE_DEFAULTS.has(val.trim().toLowerCase())) {
      problems.push(`${key} must not use a default/example value`);
    } else if (val.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${key} is too weak: use at least ${MIN_SECRET_LENGTH} characters (e.g. \`openssl rand -hex 32\`)`,
      );
    }
  }

  return problems;
}

/**
 * Fail-fast environment validation. Called once at boot. In production, missing
 * or insecure secrets abort startup; in development we warn and fall back to
 * safe-ish defaults so the app still runs with zero config.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const log = new Logger('Config');
  const isProd = env.NODE_ENV === 'production';

  const problems = collectConfigProblems(env);
  if (problems.length === 0) return;

  const message = `Environment validation failed:\n  - ${problems.join('\n  - ')}`;
  if (isProd) {
    log.error(message);
    throw new Error('Refusing to start with an insecure configuration');
  }
  log.warn(`${message}\n(continuing in non-production mode)`);
}
