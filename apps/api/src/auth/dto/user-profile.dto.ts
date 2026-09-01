import type { User } from '../../generated/prisma';
import type { Role } from '@czd/shared-types';

// Never return a raw Prisma `User` row — this excludes passwordHash/twoFactorSecret by
// construction and stringifies the bigint id (which JSON.stringify can't serialize natively).
export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  gmailVerified: boolean;
  twoFactorEnabled: boolean;
}

export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    gmailVerified: user.gmailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}
