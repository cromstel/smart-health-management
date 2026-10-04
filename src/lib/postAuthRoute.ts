/**
 * Where a user lands after authenticating.
 *
 * Super admins belong in the super-admin console, not the clinician dashboard.
 * This was previously hardcoded as '/dashboard' in LoginPage, RegisterPage,
 * TwoFactorPage and SuperAdminLogin, so a super admin who signed in -- whether
 * directly or after completing two-factor -- landed on the clinician dashboard,
 * which then bounced them to '/' because SuperAdminRoute rejects that role.
 *
 * Kept in one place so every post-auth entry point agrees.
 */

/** Minimal shape needed to decide the landing route. */
type Roleish = { role?: string | null } | null | undefined;

export const isSuperAdmin = (user: Roleish): boolean =>
  user?.role === 'Super Admin' || user?.role === 'super_admin';

/** Landing route for a user who has just authenticated. */
export const postAuthRoute = (user: Roleish): string =>
  isSuperAdmin(user) ? '/super-admin/dashboard' : '/dashboard';
