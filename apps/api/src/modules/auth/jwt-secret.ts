/**
 * The session signing key, resolved once per process.
 *
 * If the strategy, the strategy's refresh and `AuthService` each fell back to
 * their own copy of the default, a change to the fallback in one place would
 * issue tokens the others cannot verify — every request 401s and the symptom is
 * "login does not work". One constant makes that impossible.
 */
export const SESSION_JWT_SECRET =
  process.env.JWT_SECRET || 'local-dev-only-secret-change-before-deploying-0000';
