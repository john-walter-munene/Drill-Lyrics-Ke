import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Module,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@drillke/shared';

/**
 * Role-based access control. Routes declare the minimum role with
 * `@Roles('moderator')`; the guard (registered globally in AppModule) denies
 * anything below it. The role is read from `req.user`, populated by the auth
 * guard in Phase 1.
 *
 * `@Roles()` with no arguments means "any authenticated user".
 */
export const ROLES_KEY = 'drillke:roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Numeric rank so "at least this role" comparisons stay in one place. */
const ROLE_RANK: Record<Role, number> = {
  member: 0,
  contributor: 1,
  moderator: 2,
  admin: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const role = req.user?.role;
    if (!role) return false;

    const minimum = Math.max(...required.map((r) => ROLE_RANK[r]));
    return ROLE_RANK[role] >= minimum;
  }
}

/**
 * Wraps `RolesGuard` so its `Reflector` dependency is resolved explicitly.
 *
 * `RolesGuard` is registered as a root-scope `APP_GUARD`, but the root module
 * does not import the `Reflector` provider, so Nest injected `undefined` and
 * every request failed with "Cannot read properties of undefined (reading
 * 'getAllAndOverride')". This module re-provides the guard with `Reflector`
 * available and exports it for `@UseGuards` on individual controllers.
 */
@Module({
  providers: [
    {
      provide: RolesGuard,
      useFactory: () => new RolesGuard(new Reflector()),
    },
  ],
  exports: [RolesGuard],
})
export class AuthZModule { }
