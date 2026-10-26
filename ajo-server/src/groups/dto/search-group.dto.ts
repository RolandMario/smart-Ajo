import { IsString, Matches } from 'class-validator';

/**
 * Lenient on length (1–12) because the caller normalizes: lowercase,
 * spaces and separators are stripped server-side before the exact lookup.
 * The server rejects only clearly-wrong input before that point.
 */
const GROUP_CODE_REGEX = /^[A-Za-z0-9 -]{1,12}$/;

export class SearchGroupDto {
  @IsString()
  @Matches(GROUP_CODE_REGEX, {
    message:
      'code must be a valid group ID (letters and numbers only, max 12 characters)',
  })
  code!: string;
}
