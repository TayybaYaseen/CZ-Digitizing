import type { Session } from '../../generated/prisma';

// Never return a raw Prisma `Session` row — `userId` is a bigint, which JSON.stringify can't
// serialize natively (same reason user-profile.dto.ts exists for `User`).
export interface SessionInfoDto {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  isVerified: boolean;
  createdAt: Date;
  lastActivityAt: Date;
}

export function toSessionInfoDto(session: Session): SessionInfoDto {
  return {
    id: session.id,
    deviceId: session.deviceId,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    isVerified: session.isVerified,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  };
}
