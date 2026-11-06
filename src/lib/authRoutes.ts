/**
 * Where each authentication surface lives, and which one a person belongs to.
 *
 * There are three separate audiences and they do not share a recovery URL:
 *
 *   * the clinical workforce (patients, doctors, nurses, pharmacists) signs in
 *     at the workstation and recovers on the clinical pages;
 *   * the tenant hospital administrator signs in at their own portal and
 *     recovers on their own pages;
 *   * the platform site owner signs in at the console and recovers on the
 *     console's pages.
 *
 * The routes are declared once, here, so that a link, a redirect and a
 * back-link cannot disagree about where a surface is. A sign-in that lands on
 * the wrong portal is not a cosmetic problem: the person ends up in a
 * workspace that has nothing to do with them.
 */

/** The clinical workstation's sign-in and recovery pages. */
export const CLINICAL_AUTH_ROUTES = {
  login: '/auth/login',
  register: '/auth/register',
  signup: '/auth/signup',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  twoFactor: '/auth/two-factor',
} as const;

/** The tenant hospital administrator's portal. */
export const HOSPITAL_ADMIN_AUTH_ROUTES = {
  login: '/auth/admin/login',
  forgotPassword: '/auth/admin/forgot-password',
  resetPassword: '/auth/admin/reset-password',
} as const;

/** The platform site owner's console. */
export const SITE_ADMIN_AUTH_ROUTES = {
  login: '/auth/super-admin/login',
  forgotPassword: '/auth/super-admin/forgot-password',
  resetPassword: '/auth/super-admin/reset-password',
} as const;

/** Minimal shape needed to decide which portal a person belongs to. */
export type PortalUser = { role?: string | null } | null | undefined;

/** True for the platform site owner. */
export const isSiteAdmin = (user: PortalUser): boolean =>
  user?.role === 'Super Admin' || user?.role === 'super_admin';

/** True for the tenant hospital administrator. */
export const isHospitalAdmin = (user: PortalUser): boolean => user?.role === 'admin';

/**
 * The sign-in page a person belongs to.
 *
 * Used by the pages that can send someone back: a two-factor screen that
 * was cancelled, a recovery page that was abandoned. Each of them returns
 * the person to their own portal rather than to the clinical one.
 */
export const signInRouteFor = (user: PortalUser): string => {
  if (isSiteAdmin(user)) return SITE_ADMIN_AUTH_ROUTES.login;
  if (isHospitalAdmin(user)) return HOSPITAL_ADMIN_AUTH_ROUTES.login;
  return CLINICAL_AUTH_ROUTES.login;
};

/**
 * The recovery page a person belongs to.
 *
 * The same rule, for the recovery surfaces.
 */
export const recoveryRouteFor = (user: PortalUser): string => {
  if (isSiteAdmin(user)) return SITE_ADMIN_AUTH_ROUTES.forgotPassword;
  if (isHospitalAdmin(user)) return HOSPITAL_ADMIN_AUTH_ROUTES.forgotPassword;
  return CLINICAL_AUTH_ROUTES.forgotPassword;
};

/**
 * The page that completes a recovery for a person.
 *
 * The server issues the link in the recovery email, and it has to point at
 * the surface that matches the account.
 */
export const resetRouteFor = (user: PortalUser): string => {
  if (isSiteAdmin(user)) return SITE_ADMIN_AUTH_ROUTES.resetPassword;
  if (isHospitalAdmin(user)) return HOSPITAL_ADMIN_AUTH_ROUTES.resetPassword;
  return CLINICAL_AUTH_ROUTES.resetPassword;
};
