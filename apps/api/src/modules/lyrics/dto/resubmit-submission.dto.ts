import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `PUT /api/lyrics/submissions/:id`.
 *
 * Deliberately narrower than `CreateSubmissionDto`: a resubmission edits the
 * text, it does not move the submission to another song. A wrong song means a
 * different contribution, and silently re-pointing one would rewrite the
 * reviewer's history for a song they never looked at.
 */
export class ResubmitSubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512 * 1024)
  markdown!: string;

  /** The contributor's own note to the reviewer. Optional, as on create. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}