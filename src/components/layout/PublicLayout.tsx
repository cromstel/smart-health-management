import { Outlet, useLocation } from 'react-router-dom';
import { PublicFooter } from './PublicFooter';
import { MarketingHeader } from './MarketingHeader';

const footerlessAuthenticationPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/signup',
  '/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/two-factor',
  '/auth/super-admin/login',
  '/auth/admin/login',
]);

/** Shared frame for visitor-facing routes with consistent navigation and footer. */
export function PublicLayout() {
  const { pathname } = useLocation();
  const hasFooter = !footerlessAuthenticationPaths.has(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingHeader />
      <div className="flex-1"><Outlet /></div>
      {hasFooter && <PublicFooter />}
    </div>
  );
}
