import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { authThrottle } from '../../common/throttling';
import { CurrentUser } from '../../common/current-user.decorator';
import type { SessionUser } from '../../common/session-auth.guard';
import { Roles } from '../../common/roles.guard';
import { AuthService } from './auth.service';
import { clearSessionCookie, sessionCookie, siteUrl } from './session-cookie';

class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName!: string;
}

class SignInDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  // Same rule as sign-up: a reset must not be a way to weaken an account.
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}

class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

class ConfirmEmailDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}

/**
 * Password accounts use Passport Local and a revocable JWT in an HttpOnly cookie.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @Throttle(authThrottle())
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) response: Response) {
    const { token, expiresAt, sessionId: _sessionId, ...result } = await this.auth.signUp(dto);
    this.setSessionCookie(response, token, expiresAt);
    return { ...result, token, expiresAt };
  }

  @Post('signin')
  @Throttle(authThrottle())
  @UseGuards(AuthGuard('local'))
  async signIn(@Body() _dto: SignInDto, @Req() request: Request & { user: SessionUser }, @Res({ passthrough: true }) response: Response) {
    const { token, expiresAt, sessionId: _sessionId, ...result } = await this.auth.signIn(request.user.id);
    this.setSessionCookie(response, token, expiresAt);
    // Returned as well as set as a cookie, on purpose. A browser that will not
    // store the cookie (split web/API hosts and third-party-cookie rules) would
    // otherwise leave the user "signed in" on a screen that never loads, while
    // the dashboard it redirects to says "sign in". The web client keeps this
    // value and sends it as `Authorization: Bearer`, which needs no cookies.
    return { ...result, token, expiresAt };
  }

  @Post('signout')
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.signOut((request as Request & { user?: SessionUser }).user?.sessionId);
    response.setHeader('Set-Cookie', clearSessionCookie());
    return { ok: true };
  }

  /**
   * Who am I? Public by design (it is how a page discovers it is signed out),
   * but it carries the role, so it is the cheap {"am I staff?"} probe every
   * staff-only page needs. `@Roles()` with no argument means "any authenticated
   * user": without it the global jwt guard is optional, and an expired session
   * would come back as a 200 with no user instead of a 401.
   */
  @Get('me')
  @Roles()
  me(@CurrentUser() user: SessionUser | undefined) {
    return this.auth.me(user);
  }

  /**
   * Explicit session check with an explicit answer.
   *
   * `/auth/me` answers with the user when a cookie is present; this also accepts
   * the `Authorization: Bearer` token sign-in returns, so a client can prove its
   * credential is live before navigating to a protected page.
   */
  @Get('session')
  @UseGuards(AuthGuard('jwt'))
  session(@CurrentUser() user: SessionUser) {
    return { user };
  }

  /**
   * Always returns `{ accepted: true }` for a well-formed address, whether or
   * not an account exists — see `AuthService.requestPasswordReset`. The strict
   * auth throttle is what stops this being a mail-bombing tool.
   */
  @Post('forgot-password')
  @Throttle(authThrottle())
  requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email, siteUrl());
  }

  @Get('reset-password/:token')
  checkResetToken(@Param('token') token: string) {
    return this.auth.checkResetToken(token);
  }

  @Post('reset-password')
  @Throttle(authThrottle())
  async completePasswordReset(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.completePasswordReset(dto.token, dto.password);
    // Every session was revoked, so this browser must not keep a stale cookie.
    response.setHeader('Set-Cookie', clearSessionCookie());
    return result;
  }

  // --- Email confirmation ---------------------------------------------------

  @Get('confirmation')
  @UseGuards(AuthGuard('jwt'))
  confirmationStatus(@CurrentUser() user: SessionUser) {
    return this.auth.confirmationStatus(user.id);
  }

  /** Re-send the link. Throttled like the other mail-sending routes. */
  @Post('confirmation/resend')
  @Throttle(authThrottle())
  @UseGuards(AuthGuard('jwt'))
  async resendConfirmation(@CurrentUser() user: SessionUser) {
    const result = await this.auth.sendConfirmation(user.id, siteUrl());
    // `sent: false` covers "already confirmed" and "delivery failed". Neither is
    // an error the user can fix, and distinguishing them here would tell an
    // attacker whether an address is confirmed.
    return { accepted: true, sent: result.sent };
  }

  @Post('confirm-email')
  @Throttle(authThrottle())
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.auth.confirmEmail(dto.token);
  }

  // --- Data export -----------------------------------------------------------

  @Get('export')
  @UseGuards(AuthGuard('jwt'))
  exportAccount(@CurrentUser() user: SessionUser) {
    return this.auth.exportAccountData(user.id);
  }

  /**
   * Self-service deletion. Requires the password: a stolen session must not be
   * able to destroy an account.
   */
  @Post('delete-account')
  @Throttle(authThrottle())
  @UseGuards(AuthGuard('jwt'))
  async deleteAccount(
    @Body() dto: DeleteAccountDto,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.deleteAccount(user.id, dto.password, siteUrl());
    response.setHeader('Set-Cookie', clearSessionCookie());
    return result;
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date) {
    response.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
  }
}

export type { SignUpDto, SignInDto, ResetPasswordDto, ForgotPasswordDto, DeleteAccountDto, ConfirmEmailDto };
