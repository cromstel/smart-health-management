/**
 * Secure RBAC guard — enforce that data access is scoped to the user's
 * assigned hospital unless the user is the site super admin (global scope).
 */
export function enforceHospitalScope(
  user: { role?: string; scope?: string; hospital_id?: string; permissions?: string[] },
  targetHospitalId?: string
): boolean {
  // Super admin (site owner) — global access, always permitted
  if (user.role === 'super_admin' || user.role === 'Super Admin') return true;
  // Hospital-scoped roles (admin, doctor, nurse, pharmacist) — must match
  if (user.scope === 'hospital') {
    if (!user.hospital_id) return false; // no assignment = deny
    return !targetHospitalId || user.hospital_id === targetHospitalId;
  }
  // Self-scoped (patient) — handled separately
  if (user.scope === 'self') {
    return !!targetHospitalId; // patient data access is self-identifier based elsewhere
  }
  return false; // deny by default
}
