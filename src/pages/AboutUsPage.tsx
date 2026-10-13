import { Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import {
  ArrowRight,
  Compass,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingHeader } from '@/components/layout/MarketingHeader';

const principles = [
  {
    icon: HeartPulse,
    title: 'Care stays human',
    description: 'We design around the people delivering and receiving care, so technology supports attention instead of competing for it.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust is designed in',
    description: 'Privacy, accountability, and clear permissions are foundational to every clinical workflow—not a layer added later.',
  },
  {
    icon: Compass,
    title: 'Clarity creates capacity',
    description: 'One connected view helps teams spend less time reconciling systems and more time making informed decisions.',
  },
];

const commitments = [
  ['One connected workspace', 'Clinical, operational, and administrative teams work from a shared source of truth.'],
  ['Built for real routines', 'The interface is shaped for handoffs, rounds, follow-ups, and the many small decisions between them.'],
  ['Progress you can account for', 'Clear records and auditable workflows make improvement visible without turning care into a dashboard exercise.'],
];

const teamDisciplines = [
  { number: '01', title: 'Clinical practice', initials: 'CP', description: 'Keeping the realities of patient care close to every product decision.' },
  { number: '02', title: 'Care operations', initials: 'CO', description: 'Turning complex coordination into calm, repeatable daily routines.' },
  { number: '03', title: 'Product & engineering', initials: 'PE', description: 'Building focused tools that connect systems without adding noise.' },
  { number: '04', title: 'Trust & safety', initials: 'TS', description: 'Championing privacy, accountability, and appropriate access from the start.' },
];

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none">
        Skip to main content
      </a>
      <MarketingHeader />

      <main id="main-content">
        <section className="relative isolate min-h-[40rem] overflow-hidden border-b border-primary-foreground/15 bg-primary py-16 sm:py-24 lg:flex lg:min-h-[43rem] lg:items-center lg:py-28">
          <motion.img
            src="/images/medicare-about-us-hero-banner.webp"
            alt="A diverse healthcare team standing together in a bright clinical setting"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 -z-20 h-full w-full select-none object-cover object-[62%_center] sm:object-[58%_center]"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-overlay/68" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="mx-auto grid h-full max-w-7xl grid-cols-4 border-x border-primary-foreground/15">
              {[0, 1, 2, 3].map((line) => <div key={line} className="border-r border-primary-foreground/15 last:border-r-0" />)}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-7xl px-4 text-left sm:px-6 lg:px-8">
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/90">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              Our purpose
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl">
              <div className="border-y border-primary-foreground/30 py-8 sm:py-10">
                <h1 className="font-display text-5xl font-medium leading-[0.98] tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl">Better systems make room for better care.</h1>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-primary-foreground/90">Smart MediCare helps healthcare teams coordinate the work behind every meaningful patient moment.</p>
                <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.6 }} className="mt-8 flex items-center gap-3 border-l-2 border-accent pl-4 text-sm text-primary-foreground/85">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                  Built around the people doing the work
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-28">
          <Reveal className="lg:col-span-4"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Why we exist</p><h2 className="mt-4 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">Healthcare is already complex enough.</h2></Reveal>
          <Reveal delay={0.12} className="space-y-6 text-lg leading-relaxed text-muted-foreground lg:col-span-7 lg:col-start-6">
            <p>Every day, care teams reconcile appointments, records, inventory, compliance, and the needs of real people. When those systems are disconnected, the cost is felt in every handoff.</p>
            <p>We are building a calmer operational foundation: a secure, connected workspace where clinical insight and practical coordination can live side by side.</p>
            <p className="border-l-2 border-accent pl-5 font-display text-2xl leading-snug text-foreground">Our role is not to replace clinical judgment. It is to give it the context, continuity, and time it deserves.</p>
          </Reveal>
        </section>

        <section className="border-y border-border bg-muted/45 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mb-12 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">The way we work</p><h2 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">Principles that guide every decision.</h2></Reveal>
            <div className="grid gap-5 md:grid-cols-3 lg:gap-7">
              {principles.map(({ icon: Icon, title, description }, index) => (
                <Reveal key={title} delay={index * 0.1} className="group relative min-h-72 border border-border bg-background p-8 transition-all duration-300 hover:-translate-y-1 hover:border-accent/45 hover:bg-card hover:shadow-lg hover:shadow-primary/10 sm:p-9">
                  <div className="absolute left-8 right-8 top-0 h-px bg-accent/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:left-9 sm:right-9" aria-hidden="true" />
                  <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-full border border-accent/15 bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                  <h3 className="text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-28">
          <Reveal className="lg:col-span-5"><div className="flex h-full min-h-72 flex-col justify-between border border-border bg-card p-8 sm:p-10"><UsersRound className="h-8 w-8 text-accent" aria-hidden="true" /><div><p className="font-display text-3xl font-medium leading-tight tracking-tight">Designed for the whole care team.</p><p className="mt-4 leading-relaxed text-muted-foreground">From first appointment to finance review, each role deserves tools that respect its expertise.</p></div></div></Reveal>
          <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">What we are committed to</p><ol className="mt-5 divide-y divide-border border-y border-border">{commitments.map(([title, description], index) => <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-6 sm:grid-cols-[3.5rem_1fr]"><span className="font-mono text-sm tabular-nums text-accent">0{index + 1}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1.5 leading-relaxed text-muted-foreground">{description}</p></div></li>)}</ol></Reveal>
        </section>

        <section className="overflow-hidden border-y border-border bg-card py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end"><div className="lg:col-span-7"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Our team</p><h2 className="mt-4 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">Different disciplines. One care-minded standard.</h2></div><p className="max-w-xl leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9">Our work brings clinical, operational, technical, and safety perspectives into the same room—because good healthcare software is a team sport.</p></Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teamDisciplines.map((discipline, index) => (
                <Reveal key={discipline.title} delay={index * 0.08}>
                  <article className="group relative min-h-72 overflow-hidden border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg hover:shadow-primary/10">
                    <motion.div whileHover={{ rotate: -5, scale: 1.04 }} transition={{ type: 'spring', stiffness: 280, damping: 18 }} className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/25 bg-accent/10 font-mono text-lg font-semibold text-accent">{discipline.initials}</motion.div>
                    <div className="absolute right-5 top-5 font-mono text-xs tabular-nums text-muted-foreground">{discipline.number}</div>
                    <div className="absolute bottom-6 left-6 right-6"><h3 className="text-xl font-semibold tracking-tight">{discipline.title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{discipline.description}</p></div>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.15} className="mt-10 flex items-center gap-3 border-l-2 border-accent pl-5 text-sm leading-relaxed text-muted-foreground"><Stethoscope className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />We build with respect for the expertise already present in every care setting.</Reveal>
          </div>
        </section>

        <section className="border-t border-border bg-primary py-20 text-center sm:py-24">
          <Reveal className="mx-auto max-w-3xl px-4 sm:px-6"><h2 className="font-display text-4xl font-medium leading-tight tracking-tight text-primary-foreground sm:text-5xl">Let’s make the work of care feel more connected.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-primary-foreground/80">See how Smart MediCare can support your hospital, clinic, or care network.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" asChild><Link to="/request-demo">Request a demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button><Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild><Link to="/">Explore the platform</Link></Button></div></Reveal>
        </section>
      </main>
    </div>
  );
}
