import { IsObject } from 'class-validator';

// AC-6/§3 PUT /api/admin/translations/:locale — bulk upsert of key/value UI-chrome strings.
export class UpsertTranslationsDto {
  @IsObject()
  entries!: Record<string, string>;
}
