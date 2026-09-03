import { IsInt, Max, Min } from 'class-validator';

// AC-4 — the year "years of experience" is computed from (current_year - experience_start_year)
// each time it's read; never stored as a precomputed count.
export class UpdateExperienceDto {
  @IsInt()
  @Min(1990)
  @Max(2100)
  experienceStartYear!: number;
}
