import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  controllers: [AuthController],
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), MailModule],
  providers: [AuthService, PrismaService, LocalStrategy, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule { }
