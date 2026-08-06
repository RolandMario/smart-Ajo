/**
 * Global user roles.
 *
 * NOTE: Group-level permissions (e.g. "isGroupAdmin") are NOT represented
 * here. They live on the GroupMember document and are scoped per-group.
 * This enum only distinguishes platform staff (who access the admin web
 * dashboard) from everyone else.
 */
export enum Role {
  PLATFORM_ADMIN = 'platform_admin',
  USER = 'user',
}
