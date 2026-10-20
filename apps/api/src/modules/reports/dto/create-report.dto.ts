import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { ReportTargetType } from '@drillke/shared';

const TARGET_TYPES: ReportTargetType[] = [
  'song',
  'lyric_version',
  'annotation',
  'artist',
  'dj',
  'podcast_episode',
  'event',
  'user',
];

/** Body of `POST /api/reports`. */
export class CreateReportDto {
  @IsIn(TARGET_TYPES)
  targetType!: ReportTargetType;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;
}
