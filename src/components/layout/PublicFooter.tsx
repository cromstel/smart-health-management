import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Lock, ShieldCheck, Zap } from 'lucide-react';
import Logo from '@/components/Logo';

type FooterLink = {
  label: string;
  href: string;
};

const footerSections: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Platform',
    links: [
      { label: 'Patient records', href: '#features' },
      { label: 'Smart scheduling', href: '#features' },
      { label: 'Clinical AI', href: '#features' },
      { label: 'Pharmacy & inventory', href: '#features' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Care stories', href: '#testimonials' },
      { label: 'About us', href: '/about-us/' },
      { label: 'Contact', href: '/contact-us' },
      { label: 'Frequently asked questions', href: '/faq' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Request a demo', href: '/auth/request-demo' },
      { label: 'Staff sign in', href: '/auth/login' },
      { label: 'Create an account', href: '/auth/signup' },
      { label: 'Platform overview', href: '#how-it-works' },
    ],
  },
];

function footerHref(href: string, isLandingPage: boolean) {
  return href.startsWith('#') && !isLandingPage ? `/${href}` : href;
}

function FooterNavigationLink({ link, isLandingPage }: { link: FooterLink; isLandingPage: boolean }) {
  const href = footerHref(link.href, isLandingPage);

  if (href.startsWith('/')) {
    return (
      <Link className="group inline-flex items-center gap-1 text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:text-primary-foreground" to={href}>
        {link.label}
        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
      </Link>
    );
  }

  return <a className="group inline-flex items-center gap-1 text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:text-primary-foreground" href={href}>{link.label}<ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" /></a>;
}

/** Shared visitor-site footer. It deliberately stays outside clinical and authenticated layouts. */
export function PublicFooter() {
  const { pathname } = useLocation();
  const isLandingPage = pathname === '/' || pathname === '/landing';

  return (
    <footer className="border-t border-primary-foreground/15 bg-primary text-primary-foreground" role="contentinfo">
      <div className="mx-auto w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 border-b border-primary-foreground/15 pb-12 lg:grid-cols-12 lg:gap-8 lg:pb-16">
          <div className="max-w-sm lg:col-span-4">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Smart MediCare — Home">
              <Logo size="sm" variant="light" />
            </Link>
            <p className="mt-6 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Infrastructure for care that keeps people at the centre.</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/70">One calm, connected workspace for the people and systems behind better health outcomes.</p>
            <div className="mt-7 inline-flex items-center gap-2 border-l-2 border-accent pl-3 text-xs font-medium text-primary-foreground/80">
              <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>Privacy-aware care operations</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-7 lg:col-start-6">
            {footerSections.map((section) => (
              <section key={section.title} aria-labelledby={`footer-${section.title.toLowerCase().replace(/ /g, '-')}`}>
                <h2 id={`footer-${section.title.toLowerCase().replace(/ /g, '-')}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/50">{section.title}</h2>
                <ul className="mt-5 space-y-3">
                  {section.links.map((link) => <li key={link.label}><FooterNavigationLink link={link} isLandingPage={isLandingPage} /></li>)}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs tabular-nums text-primary-foreground/55">© {new Date().getFullYear()} Smart MediCare. Built for accountable care.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link to="/auth/super-admin/login" className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/65 transition-colors hover:text-primary-foreground focus-visible:text-primary-foreground"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Super admin</Link>
            <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/65 transition-colors hover:text-primary-foreground focus-visible:text-primary-foreground"><Zap className="h-3.5 w-3.5" aria-hidden="true" /> Staff sign in</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
