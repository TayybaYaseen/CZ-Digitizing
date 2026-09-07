import type { AccountMember, User } from '../../generated/prisma';

// docs/specs/2026-08-28-14-customer-account-history.md §4 (aspect A-019), AC-7.
export interface AccountMemberDto {
  id: string;
  email: string;
  displayName: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

export function toAccountMemberDto(row: AccountMember & { memberUser: User }): AccountMemberDto {
  return {
    id: row.id.toString(),
    email: row.memberUser.email,
    displayName: row.memberUser.displayName,
    invitedAt: row.invitedAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
  };
}
