import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';

const sectionLinks = [
  { label: 'Features', hash: '#features' },
  { label: 'How It Works', hash: '#how-it-works' },
  { label: 'Testimonials', hash: '#testimonials' },
];

function sectionHref(hash: string, isLandingPage: boolean) {
  return isLandingPage ? hash : `/${hash}`;
}

/** Public-site navigation shared by the landing and company pages. */
export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isLandingPage = pathname === '/' || pathname === '/landing';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md" role="banner">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="Smart MediCare — Home">
          <Logo size="sm" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {sectionLinks.map((link) => (
            <a key={link.hash} href={sectionHref(link.hash, isLandingPage)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              {link.label}
            </a>
          ))}
          <Link to="/about-us/" aria-current={pathname === '/about-us/' || pathname === '/about-us' ? 'page' : undefined} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
            About Us
          </Link>
          <Link to="/contact-us" aria-current={pathname === '/contact-us' ? 'page' : undefined} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
            Contact
          </Link>
          <Link to="/faq" aria-current={pathname === '/faq' ? 'page' : undefined} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
            FAQ
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild><Link to="/auth/login">Sign In</Link></Button>
          <Button size="sm" asChild><Link to="/auth/signup" className="gap-1.5">Get Started <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></Button>
        </div>

        <button type="button" className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:hidden" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {sectionLinks.map((link) => (
              <a key={link.hash} href={sectionHref(link.hash, isLandingPage)} onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
                {link.label}
              </a>
            ))}
            <Link to="/about-us/" onClick={() => setMobileOpen(false)} aria-current={pathname === '/about-us/' || pathname === '/about-us' ? 'page' : undefined} className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
              About Us
            </Link>
            <Link to="/contact-us" onClick={() => setMobileOpen(false)} aria-current={pathname === '/contact-us' ? 'page' : undefined} className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
              Contact
            </Link>
            <Link to="/faq" onClick={() => setMobileOpen(false)} aria-current={pathname === '/faq' ? 'page' : undefined} className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground">
              FAQ
            </Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              <Button variant="ghost" size="sm" asChild className="justify-start"><Link to="/auth/login" onClick={() => setMobileOpen(false)}>Sign In</Link></Button>
              <Button size="sm" asChild><Link to="/auth/signup" onClick={() => setMobileOpen(false)} className="gap-1.5">Get Started <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></Button>
            </div>
          </div>
        </motion.div>
      )}
    </header>
  );
}
