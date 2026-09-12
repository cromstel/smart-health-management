import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Heart,
  Hospital,
  Lock,
  Pill,
  Play,
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
            Smart <span className="text-accent">Health</span>
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
    <section className="relative overflow-hidden bg-primary pt-20 pb-24 sm:pt-28 sm:pb-32" id="hero">
      {/* Subtle decorative circles (flat, no gradient) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute right-0 top-0 h-[min(35vw,500px)] w-[min(35vw,500px)] rounded-full border border-primary-foreground/5" />
        <div className="absolute bottom-0 left-0 h-[min(42vw,600px)] w-[min(42vw,600px)] rounded-full border border-primary-foreground/5" />
        <motion.div
          className="absolute top-20 left-[15%] h-3 w-3 rounded-full bg-accent/30"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-32 right-[20%] h-2 w-2 rounded-full bg-accent/20"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute bottom-24 left-[30%] h-2.5 w-2.5 rounded-full bg-accent/25"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Status badge */}
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            Trusted by 500+ healthcare institutions
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-primary-foreground leading-[1.1] mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Intelligent healthcare management,{' '}
            <span className="text-accent">one platform</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="text-lg sm:text-xl text-primary-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Unified electronic health records, AI-powered clinical decision support,
            automated pharmacy workflows, and real-time analytics — built for modern
            healthcare teams.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200"
              asChild
            >
              <Link to="/signup" className="gap-2">
                Start Free Trial
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
                <Play className="h-4 w-4" aria-hidden="true" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-12 text-sm text-primary-foreground/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/60" aria-hidden="true" />
              HIPAA Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/60" aria-hidden="true" />
              SOC 2 Type II
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/60" aria-hidden="true" />
              99.9% Uptime
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/60" aria-hidden="true" />
              24/7 Support
            </span>
          </motion.div>
        </div>

        {/* Hero Visual — Dashboard Preview */}
        <motion.div
          className="mt-16 mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="rounded-2xl border border-primary-foreground/10 bg-card p-1 shadow-2xl shadow-black/40">
            <div className="rounded-xl bg-background overflow-hidden">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-card">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-chart-4/60" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground font-mono">
                    app.smarthealth.com/dashboard
                  </div>
                </div>
              </div>
              {/* Fake dashboard content */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Top row: stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Patients Today', value: '284', change: '+12%', color: 'bg-accent/10 text-accent' },
                    { label: 'Appointments', value: '96', change: '98% kept', color: 'bg-emerald-500/10 text-emerald-500' },
                    { label: 'Active Staff', value: '47', change: 'All on duty', color: 'bg-violet-500/10 text-violet-500' },
                    { label: 'Alerts', value: '3', change: 'Critical', color: 'bg-destructive/10 text-destructive' },
                  ].map((card) => (
                    <div key={card.label} className="rounded-lg border border-border bg-card p-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                      <div className="flex items-baseline justify-between">
                        <p className="text-2xl font-bold text-foreground">{card.value}</p>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${card.color}`}>
                          {card.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Bottom row: mini chart + activity */}
                <div className="grid lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3 rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Patient Admissions — 7 Day Trend</p>
                    <div className="flex items-end gap-2 h-24">
                      {[40, 65, 52, 78, 60, 85, 72].map((h, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t bg-accent/30"
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ duration: 0.5, delay: 1 + i * 0.08 }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                  </div>
                  <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Recent Activity</p>
                    <div className="space-y-3">
                      {[
                        { icon: Heart, text: 'Vitals recorded — P-2841', time: '2m ago', color: 'text-destructive' },
                        { icon: FileText, text: 'Lab results — P-1937', time: '8m ago', color: 'text-accent' },
                        { icon: Stethoscope, text: 'Dr. Chen — consultation', time: '15m ago', color: 'text-emerald-500' },
                        { icon: Pill, text: 'Rx dispensed — P-2839', time: '22m ago', color: 'text-violet-500' },
                      ].map((item) => (
                        <div key={item.text} className="flex items-center gap-3">
                          <item.icon className={`h-4 w-4 ${item.color} shrink-0`} aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">{item.text}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
                        </div>
                      ))}
                    </div>
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
              <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">{stat.value}</p>
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
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
                <span className="text-xl font-bold text-primary-foreground">{step.number}</span>
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground mb-4">
            Ready to modernize your healthcare operations?
          </h2>
          <p className="text-lg text-primary-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join 500+ hospitals and clinics that trust Smart Health to manage their clinical
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
                Smart <span className="text-accent">Health</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              Enterprise healthcare management platform for hospitals, clinics, and healthcare networks.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
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
            &copy; {new Date().getFullYear()} Smart Health Systems. All rights reserved.
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
