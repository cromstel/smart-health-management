import { Link } from 'react-router-dom';
import { HOSPITAL_ADMIN_AUTH_ROUTES, SITE_ADMIN_AUTH_ROUTES } from '@/lib/authRoutes';

/**
 * The routes to the administrator recovery pages, shown on the clinical
 * recovery surfaces.
 *
 * A signed-out administrator has no session to tell the page who they are, so
 * the clinical pages cannot send them to their own recovery page
 * automatically. Offering the two administrator routes explicitly is what
 * lets them find the right one, rather than reading a clinical form and
 * filling it in against the wrong portal.
 */
export default function AdminRecoveryLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted-foreground ${className}`}>
      Administrator account?{' '}
      <Link
        to={HOSPITAL_ADMIN_AUTH_ROUTES.forgotPassword}
        className="font-semibold text-accent hover:text-accent/80 transition-colors"
      >
        Hospital administrator
      </Link>
      {' · '}
      <Link
        to={SITE_ADMIN_AUTH_ROUTES.forgotPassword}
        className="font-semibold text-accent hover:text-accent/80 transition-colors"
      >
        Site owner
      </Link>
    </p>
  );
}
