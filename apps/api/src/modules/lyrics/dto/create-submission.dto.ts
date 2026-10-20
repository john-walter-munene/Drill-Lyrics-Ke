import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `POST /api/lyrics/submissions`. The Markdown content itself is
 * validated by the shared parser (`docs/lyrics-format.md` §4) after this
 * structural check passes.
 */
export class CreateSubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  songId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512 * 1024)
  markdown!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
