import type { LanguageDto } from '@czd/shared-types';
import type { Language } from '../../generated/prisma';

export function toLanguageDto(row: Language): LanguageDto {
  return {
    code: row.code,
    name: row.name,
    nativeName: row.nativeName,
    isRtl: row.isRtl,
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
  };
}
