/**
 * Subdomain rules, in one place.
 *
 * A subdomain becomes the first label of the platform's hostname
 * (`<sub>.medicare.example.com`), so two independent constraints apply:
 * the DNS label shape, and the names the platform itself occupies on that
 * hostname space. Both are enforced wherever a subdomain is accepted —
 * onboarding, the hospital settings surface and the resolver — so a value
 * that would shadow a platform route cannot be written by any path.
 */

/**
 * Names the platform serves on the shared hostname space.
 *
 * A tenant holding one of these would sit in front of the route it shadows,
 * so they are refused at every entry point and skipped by the resolver.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'api',
  'www',
  'auth',
  'login',
  'register',
  'dashboard',
  'patient-portal',
  'super-admin',
  'appointments',
  'financial',
  'settings',
  'documents',
  'pharmacy',
  'inventory-reports',
  'prescriptions',
  'purchase-orders',
];

/** DNS label shape: letters, digits and interior hyphens; 2-100 characters. */
const SUBDOMAIN_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

/** Whether the text can be a subdomain label (shape and length only). */
export const hasSubdomainShape = (text: string): boolean =>
  text.length >= 2 && text.length <= 100 && SUBDOMAIN_SHAPE.test(text);

/** Whether the text is one of the names the platform occupies. */
export const isReservedSubdomain = (text: string): boolean =>
  RESERVED_SUBDOMAINS.includes(text.trim().toLowerCase());

/**
 * The lower-cased label for a supplied value, or null when the value is not
 * an acceptable subdomain (wrong shape, wrong length, or reserved).
 */
export const normalizeSubdomain = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (!hasSubdomainShape(text) || isReservedSubdomain(text)) return null;
  return text;
};
