import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { authThrottle } from '../../common/throttling';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { AuthService } from './auth.service';

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

/**
 * Session auth. Phase 1 wires password hashing + an httpOnly session cookie;
 * the routes and throttle budgets are fixed here so the web app can be built.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @Throttle(authThrottle())
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Post('signin')
  @Throttle(authThrottle())
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto);
  }

  @Post('signout')
  @UseGuards(RolesGuard)
  @Roles('member')
  signOut() {
    return this.auth.signOut();
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('member')
  me() {
    return this.auth.me();
  }
}

export type { SignUpDto, SignInDto };
