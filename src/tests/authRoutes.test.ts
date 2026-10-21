import { describe, it, expect } from 'vitest';
import {
  CLINICAL_AUTH_ROUTES,
  HOSPITAL_ADMIN_AUTH_ROUTES,
  SITE_ADMIN_AUTH_ROUTES,
  isHospitalAdmin,
  isSiteAdmin,
  recoveryRouteFor,
  resetRouteFor,
  signInRouteFor,
} from '@/lib/authRoutes';

describe('authentication surfaces', () => {
  it('gives each audience its own recovery and reset routes', () => {
    // The three audiences must not share a recovery URL. A tenant hospital
    // administrator who lands on the clinical recovery page is filling in
    // the wrong form for the wrong portal.
    const clinical = new Set<string>(Object.values(CLINICAL_AUTH_ROUTES));
    const hospital = new Set<string>(Object.values(HOSPITAL_ADMIN_AUTH_ROUTES));
    const site = new Set<string>(Object.values(SITE_ADMIN_AUTH_ROUTES));

    for (const route of hospital) expect(clinical.has(route)).toBe(false);
    for (const route of site) expect(clinical.has(route)).toBe(false);
    for (const route of site) expect(hospital.has(route)).toBe(false);
  });

  it('sends each role to the portal it belongs to', () => {
    expect(isSiteAdmin({ role: 'super_admin' })).toBe(true);
    expect(isSiteAdmin({ role: 'Super Admin' })).toBe(true);
    expect(isSiteAdmin({ role: 'admin' })).toBe(false);

    expect(isHospitalAdmin({ role: 'admin' })).toBe(true);
    expect(isHospitalAdmin({ role: 'super_admin' })).toBe(false);
  });

  it('returns a person to their own sign-in page', () => {
    expect(signInRouteFor({ role: 'super_admin' })).toBe(SITE_ADMIN_AUTH_ROUTES.login);
    expect(signInRouteFor({ role: 'admin' })).toBe(HOSPITAL_ADMIN_AUTH_ROUTES.login);
    expect(signInRouteFor({ role: 'doctor' })).toBe(CLINICAL_AUTH_ROUTES.login);
    expect(signInRouteFor({ role: 'patient' })).toBe(CLINICAL_AUTH_ROUTES.login);
    expect(signInRouteFor(null)).toBe(CLINICAL_AUTH_ROUTES.login);
  });

  it('sends each role to its own recovery and reset page', () => {
    expect(recoveryRouteFor({ role: 'super_admin' })).toBe(SITE_ADMIN_AUTH_ROUTES.forgotPassword);
    expect(recoveryRouteFor({ role: 'admin' })).toBe(HOSPITAL_ADMIN_AUTH_ROUTES.forgotPassword);
    expect(recoveryRouteFor({ role: 'doctor' })).toBe(CLINICAL_AUTH_ROUTES.forgotPassword);

    expect(resetRouteFor({ role: 'super_admin' })).toBe(SITE_ADMIN_AUTH_ROUTES.resetPassword);
    expect(resetRouteFor({ role: 'admin' })).toBe(HOSPITAL_ADMIN_AUTH_ROUTES.resetPassword);
    expect(resetRouteFor({ role: 'nurse' })).toBe(CLINICAL_AUTH_ROUTES.resetPassword);
  });
});
