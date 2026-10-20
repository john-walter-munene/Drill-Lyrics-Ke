import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) { }

  signUp(_dto: { email: string; password: string; displayName: string }) {
    // TODO(phase-1): hash with argon2/scrypt, create the user, set the session.
    throw new NotImplementedException('Auth lands in Phase 1');
  }

  signIn(_dto: { email: string; password: string }) {
    // TODO(phase-1): constant-time verify, rotate session id on login.
    throw new NotImplementedException('Auth lands in Phase 1');
  }

  signOut() {
    // TODO(phase-1): clear the session cookie + revoke the session row.
    throw new NotImplementedException('Auth lands in Phase 1');
  }

  me() {
    // TODO(phase-1): resolve the session cookie to a `Me` payload.
    throw new NotImplementedException('Auth lands in Phase 1');
  }
}
