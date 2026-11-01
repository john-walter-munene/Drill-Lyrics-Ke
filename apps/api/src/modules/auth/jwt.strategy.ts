import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { PrismaService } from '../../prisma.service';
import { SESSION_COOKIE, type SessionUser } from '../../common/session-auth.guard';
import { SESSION_JWT_SECRET } from './jwt-secret';

const INACTIVITY_MS = 14 * 24 * 60 * 60 * 1000;

function extractCookie(req: Request): string | null {
  const item = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: SESSION_JWT_SECRET,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: { sub: string; sid: string; exp?: number }): Promise<SessionUser> {
    if (!payload.sub || !payload.sid) throw new UnauthorizedException();
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, email: true, displayName: true, role: true, createdAt: true } } },
    });
    const now = Date.now();
    if (!session || session.userId !== payload.sub || session.expiresAt.getTime() <= now
      || session.lastActivityAt.getTime() <= now - INACTIVITY_MS) {
      if (session) await this.prisma.session.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired after 14 days of inactivity');
    }

    const expiresAt = new Date(now + INACTIVITY_MS);
    await this.prisma.session.update({ where: { id: session.id }, data: { lastActivityAt: new Date(now), expiresAt } });
    if (!payload.exp || payload.exp * 1000 <= now + 13 * 24 * 60 * 60 * 1000) {
      const response = (request as Request & { res?: import('express').Response }).res;
      if (response) {
        const token = jwt.sign({ sub: session.user.id, sid: session.id }, SESSION_JWT_SECRET, { expiresIn: '14d' });
        response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
        if (request.headers.authorization?.startsWith('Bearer ')) response.setHeader('Authorization', `Bearer ${token}`);
      }
    }
    return { ...session.user, sessionId: session.id } as SessionUser;
  }
}
