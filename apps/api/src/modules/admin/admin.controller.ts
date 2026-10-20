import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Role } from '@drillke/shared';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { AdminService } from './admin.service';

class RejectLyricsDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

class RequestChangesDto {
  @IsString()
  @MaxLength(500)
  note!: string;
}

class UnpublishLyricsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class ChangeRoleDto {
  @IsIn(['member', 'contributor', 'moderator', 'admin'])
  role!: Role;
}

/**
 * Review + moderation surface. Guards are declared per-route so each action has
 * an explicit minimum role — see docs/api.md §Review.
 */
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) { }

  @Get('lyrics/queue')
  @Roles('moderator')
  queue(@Query('status') status?: string) {
    return this.admin.lyricsQueue(status);
  }

  @Post('lyrics/:id/approve')
  @Roles('moderator')
  approve(@Param('id') id: string) {
    return this.admin.approveLyrics(id);
  }

  @Post('lyrics/:id/reject')
  @Roles('moderator')
  reject(@Param('id') id: string, @Body() dto: RejectLyricsDto) {
    return this.admin.rejectLyrics(id, dto.reason);
  }

  @Post('lyrics/:id/request-changes')
  @Roles('moderator')
  requestChanges(@Param('id') id: string, @Body() dto: RequestChangesDto) {
    return this.admin.requestChanges(id, dto.note);
  }

  @Post('lyrics/:id/unpublish')
  @Roles('admin')
  unpublish(@Param('id') id: string, @Body() dto: UnpublishLyricsDto) {
    return this.admin.unpublishLyrics(id, dto.reason);
  }

  @Get('audit')
  @Roles('admin')
  audit(@Query('entity') entity?: string, @Query('page') page?: string) {
    return this.admin.auditLog({ entity, page });
  }

  @Patch('users/:id/role')
  @Roles('admin')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.admin.changeRole(id, dto.role);
  }
}
