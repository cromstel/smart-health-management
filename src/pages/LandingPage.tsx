import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ArrowRight,
  Heart,
  Hospital,
  Lock,
  Pill,
  Shield,
  ShieldCheck,
  Stethoscope,
  Users,
  Zap,
  Calendar,
  FileText,
  BarChart3,
  Brain,
  Star,
  Menu,
  X,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                              Section Wrapper                                */
/* -------------------------------------------------------------------------- */

function AnimatedSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      id={id}
      className={className}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

const stats = [
  { value: '500+', label: 'Hospitals', icon: Hospital },
  { value: '2M+', label: 'Patients Managed', icon: Users },
  { value: '99.9%', label: 'Uptime SLA', icon: Activity },
  { value: 'HIPAA', label: 'Fully Compliant', icon: ShieldCheck },
];

const features = [
  {
    icon: Stethoscope,
    title: 'Patient Records',
    description: 'Unified electronic health records with real-time vitals tracking, clinical notes, and comprehensive patient timelines.',
  },
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'AI-powered appointment scheduling with automated reminders, conflict resolution, and staff capacity management.',
  },
  {
    icon: Brain,
    title: 'Clinical AI Assistant',
    description: 'Gemini-powered clinical decision support for diagnosis suggestions, treatment plans, and evidence-based recommendations.',
  },
  {
    icon: Pill,
    title: 'Pharmacy & Inventory',
    description: 'End-to-end prescription fulfillment, automated inventory management, purchase orders, and expiry tracking.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Role-based access control, multi-factor authentication, audit logging, and HIPAA-compliant data encryption.',
  },
  {
    icon: BarChart3,
    title: 'Financial Analytics',
    description: 'Revenue tracking, expense management, billing integration, and comprehensive financial reporting dashboards.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Onboard Your Hospital',
    description: 'Register your institution, configure departments, and invite staff. Setup takes minutes, not months.',
    icon: Hospital,
  },
  {
    number: '02',
    title: 'Connect Your Team',
    description: 'Assign roles, set permissions, and enable multi-factor authentication for secure clinical collaboration.',
    icon: Users,
  },
  {
    number: '03',
    title: 'Deliver Better Care',
    description: 'Access AI-powered insights, manage patient workflows, and track outcomes — all from a single dashboard.',
    icon: Activity,
  },
];

const testimonials = [
  {
    quote: 'Smart Health transformed how our 200-bed facility operates. Scheduling conflicts dropped 80% in the first month, and our clinical team finally has real-time visibility into patient status.',
    author: 'Dr. Sarah Chen',
    role: 'Chief Medical Officer',
    hospital: 'Metropolitan General Hospital',
  },
  {
    quote: 'The AI assistant alone saved our pharmacy 15 hours per week on prescription verification. Combined with automated inventory alerts, we eliminated stockouts entirely.',
    author: 'James Okonkwo',
    role: 'Head of Pharmacy',
    hospital: 'Riverside Medical Center',
  },
  {
    quote: 'Having financial analytics tied directly to patient outcomes gave our board the clarity they needed. We reduced operational costs by 23% while improving care quality scores.',
    author: 'Dr. Maria Santos',
    role: 'Hospital Administrator',
    hospital: 'St. Luke\'s Healthcare Network',
  },
];

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
];

/* -------------------------------------------------------------------------- */
/*                                 Navbar                                     */
/* -------------------------------------------------------------------------- */

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md" role="banner">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="Smart Health — Home">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Smart <span className="text-accent">MediCare</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/60"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup" className="gap-1.5">
              Get Started
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-border bg-background px-4 pb-4"
        >
          <div className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/60"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" asChild className="justify-start">
                <Link to="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="gap-1.5">
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Hero                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative bg-primary pt-16 pb-24 sm:pt-24 sm:pb-32" id="hero">
      {/* Column hairlines. Flat 1px rules standing in for a printed grid --
          a gradient mesh would be the obvious way to texture this and rule 1
          forbids it, so depth comes from ruled structure instead. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="mx-auto h-full max-w-7xl">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-primary-foreground/[0.07]"
              style={{ left: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Editorial column. Deliberately left-aligned and optically hung
              rather than centred: a centred hero is the default this design is
              trying to avoid. */}
          <div className="lg:col-span-7 lg:pr-8">
            <motion.div
              className="inline-flex items-center gap-2.5 border border-primary-foreground/25 px-3.5 py-1.5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <span className="h-1.5 w-1.5 bg-success" aria-hidden="true" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/80">
                Live in 500+ institutions
              </span>
            </motion.div>

            <motion.h1
              className="font-display mt-8 text-[2.75rem] font-medium leading-[0.98] text-primary-foreground sm:text-6xl lg:text-[4.5rem]"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              Clinical operations,
              <br />
              <span className="italic text-accent">held to a higher standard.</span>
            </motion.h1>

            <motion.p
              className="mt-7 max-w-xl text-base leading-relaxed text-primary-foreground/70 sm:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Unified records, AI-assisted clinical decision support, pharmacy
              workflow, and operational analytics in one system your team
              actually adopts.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
            >
              <Button
                size="lg"
                className="h-12 px-7 text-sm font-semibold tracking-wide bg-accent text-accent-foreground hover:bg-accent/90"
                asChild
              >
                <Link to="/signup" className="gap-2">
                  Start free trial
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-7 text-sm font-semibold tracking-wide border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground/50"
                asChild
              >
                <Link to="/request-demo" className="gap-2">
                  Request a demo
                </Link>
              </Button>
            </motion.div>

            <motion.dl
              className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-primary-foreground/15 pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {[
                ['HIPAA', 'Compliant'],
                ['SOC 2', 'Type II'],
                ['99.9%', 'Uptime SLA'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-mono text-sm text-primary-foreground/90 tabular-nums">
                    {value}
                  </dt>
                  <dd className="mt-0.5 text-xs uppercase tracking-[0.14em] text-primary-foreground/50">
                    {label}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Instrument rail. Square corners against the rounded dashboard
              below, so the page mixes hard and soft geometry rather than
              rounding everything to the same radius. */}
          <motion.aside
            className="lg:col-span-5 lg:pl-8"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border border-primary-foreground/20 bg-navy-raised p-1">
              <div className="flex items-center justify-between border-b border-primary-foreground/15 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
                  Live census
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-success tabular-nums">
                  <span className="h-1.5 w-1.5 bg-success" aria-hidden="true" />
                  streaming
                </span>
              </div>
              <dl className="divide-y divide-primary-foreground/10">
                {[
                  ['Admissions today', '284', '+12%'],
                  ['Bed occupancy', '87%', '+4 pts'],
                  ['Avg. wait', '14m', '-6m'],
                  ['Critical flags', '3', 'review'],
                ].map(([label, value, delta]) => (
                  <div key={label} className="flex items-baseline justify-between px-4 py-3.5">
                    <dt className="text-sm text-primary-foreground/70">{label}</dt>
                    <dd className="flex items-baseline gap-2.5">
                      <span className="font-mono text-lg text-primary-foreground tabular-nums">
                        {value}
                      </span>
                      <span className="font-mono text-[11px] text-primary-foreground/45 tabular-nums">
                        {delta}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-primary-foreground/40">
              Figures are illustrative. Production census is scoped per
              hospital.
            </p>
          </motion.aside>
        </div>

        {/* Dashboard preview. Pulled up out of the section and given a hard
            unblurred offset block: a flat second colour reads as printed
            matter sitting on a surface, where a blurred shadow would read as
            generic elevation. */}
        <motion.div
          className="relative mt-16 sm:mt-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hidden sm:block sm:absolute sm:-bottom-3 sm:right-6 sm:h-full sm:w-full sm:border sm:border-accent/40" aria-hidden="true" />
          <div className="relative border border-primary-foreground/15 bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-chart-4/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <div className="mx-auto rounded bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
                app.smartmedicare.com/dashboard
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: 'Patients today', value: '284', change: '+12%', tone: 'text-success' },
                  { label: 'Appointments', value: '96', change: '98% kept', tone: 'text-success' },
                  { label: 'Active staff', value: '47', change: 'all on duty', tone: 'text-info' },
                  { label: 'Critical alerts', value: '3', change: 'action needed', tone: 'text-destructive' },
                ].map((card) => (
                  <div key={card.label} className="border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <p className="font-mono text-2xl font-bold text-foreground tabular-nums">
                        {card.value}
                      </p>
                      <span className={`font-mono text-[11px] ${card.tone}`}>{card.change}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="border border-border bg-background p-4 lg:col-span-3">
                  <p className="text-xs font-semibold text-foreground">
                    Patient admissions — 7 day trend
                  </p>
                  <div className="mt-4 flex h-24 items-end gap-2">
                    {[40, 65, 52, 78, 60, 85, 72].map((h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 bg-accent/70"
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: 1.15 + i * 0.07 }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                </div>
                <div className="border border-border bg-background p-4 lg:col-span-2">
                  <p className="text-xs font-semibold text-foreground">Recent activity</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { icon: Heart, text: 'Vitals recorded — P-2841', time: '2m', tone: 'text-destructive' },
                      { icon: FileText, text: 'Lab results — P-1937', time: '8m', tone: 'text-accent' },
                      { icon: Stethoscope, text: 'Dr. Chen — consultation', time: '15m', tone: 'text-success' },
                      { icon: Pill, text: 'Rx dispensed — P-2839', time: '22m', tone: 'text-info' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-3">
                        <item.icon className={`h-4 w-4 shrink-0 ${item.tone}`} aria-hidden="true" />
                        <p className="min-w-0 flex-1 truncate text-xs text-foreground">{item.text}</p>
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Stats                                       */
/* -------------------------------------------------------------------------- */

function StatsBar() {
  return (
    <AnimatedSection className="bg-card border-y border-border py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                <stat.icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight font-mono tabular-nums">{stat.value}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Features                                     */
/* -------------------------------------------------------------------------- */

function Features() {
  return (
    <AnimatedSection id="features" className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Platform Features</p>
          <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl mb-4">
            Everything your healthcare team needs
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A comprehensive suite of clinical, administrative, and financial tools designed to
            streamline operations and improve patient outcomes.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="group relative rounded-xl border border-border bg-card p-6 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 group-hover:bg-accent/15 transition-colors">
                <feature.icon className="h-6 w-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                             How It Works                                   */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  return (
    <AnimatedSection id="how-it-works" className="py-20 sm:py-28 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">How It Works</p>
          <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl mb-4">
            Up and running in three steps
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            No lengthy implementations. Get your entire hospital connected in hours, not months.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className="relative text-center"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              {/* Step number */}
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary border-2 border-primary/80 shadow-lg shadow-primary/20">
                <span className="font-mono text-xl font-bold text-primary-foreground">{step.number}</span>
              </div>

              {/* Connector line (hidden on mobile, hidden for last) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-border" aria-hidden="true" />
              )}

              <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Testimonials                                   */
/* -------------------------------------------------------------------------- */

function Testimonials() {
  return (
    <AnimatedSection id="testimonials" className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Testimonials</p>
          <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl mb-4">
            Trusted by healthcare leaders
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            See how hospitals and clinics across the country are transforming care delivery.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              className="relative rounded-xl border border-border bg-card p-6 flex flex-col"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4" aria-label={`5 out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                ))}
              </div>

              <blockquote className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {t.author.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role} &middot; {t.hospital}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                              CTA Banner                                    */
/* -------------------------------------------------------------------------- */

function CtaBanner() {
  return (
    <AnimatedSection className="py-20 sm:py-28 bg-primary">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl font-semibold text-primary-foreground sm:text-4xl mb-4">
            Ready to modernize your healthcare operations?
          </h2>
          <p className="text-lg text-primary-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join 500+ hospitals and clinics that trust Smart MediCare to manage their clinical
            workflows, pharmacy operations, and patient care — every single day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all duration-200"
              asChild
            >
              <Link to="/signup" className="gap-2">
                Get Started — Free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base font-semibold border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 transition-all duration-200"
              asChild
            >
              <Link to="/request-demo" className="gap-2">
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
                Request a Demo
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Footer                                      */
/* -------------------------------------------------------------------------- */

function Footer() {
  const footerSections = [
    {
      title: 'Platform',
      links: [
        { label: 'Patient Records', href: '#features' },
        { label: 'Smart Scheduling', href: '#features' },
        { label: 'Clinical AI', href: '#features' },
        { label: 'Pharmacy & Inventory', href: '#features' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '#hero' },
        { label: 'Careers', href: '#hero' },
        { label: 'Contact', href: '#hero' },
        { label: 'Blog', href: '#hero' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#hero' },
        { label: 'API Reference', href: '#hero' },
        { label: 'Security', href: '#hero' },
        { label: 'Status', href: '#hero' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '#hero' },
        { label: 'Terms of Service', href: '#hero' },
        { label: 'HIPAA Compliance', href: '#hero' },
        { label: 'Cookie Policy', href: '#hero' },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand column */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4" aria-label="Smart Health — Home">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Smart <span className="text-accent">MediCare</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              Enterprise healthcare management platform for hospitals, clinics, and healthcare networks.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              <span>HIPAA Compliant &middot; SOC 2 Certified</span>
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground mb-4">{section.title}</h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Smart MediCare. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/super-admin/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Super Admin
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Zap className="h-3 w-3" aria-hidden="true" />
              Staff Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Main Landing Page                             */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content">
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CtaBanner />
      </main>

      <Footer />
    </div>
  );
}
