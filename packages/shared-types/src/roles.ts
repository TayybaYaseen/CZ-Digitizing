// Mirrors architecture §Authentication & Security "Role-Based Access Control (RBAC)"
// and docs/specs/2026-08-28-01-auth-account-security.md.

export type Role = 'customer' | 'admin' | 'freelancer' | 'moderator';

export type AdminPermissionAccessLevel = 'read_only' | 'crud';
