import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@drillke/shared';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: Date;
  sessionId: string;
}

export const SESSION_COOKIE = 'drillke_session';

export function readSessionToken(cookieHeader?: string): string | null {
  const item = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) || null : null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser | undefined =>
    context.switchToHttp().getRequest<{ user?: SessionUser }>().user,
);
