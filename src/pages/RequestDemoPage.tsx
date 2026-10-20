import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Hospital,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { api } from '@/services/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const demoRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid work email').max(254),
  organization: z.string().trim().min(2, 'Enter your organisation name').max(160),
  role: z.string().trim().min(2, 'Enter your role').max(120),
  phone: z.string().trim().optional().refine((value) => !value || value.length >= 7, 'Enter a valid phone number'),
  organizationSize: z.enum(['1-50', '51-200', '201-500', '501-1000', '1000+'], { message: 'Select your organisation size' }),
  preferredContact: z.enum(['email', 'phone']),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(0).optional(),
}).refine((values) => values.preferredContact !== 'phone' || Boolean(values.phone && values.phone.length >= 7), {
  message: 'Enter a phone number so we can call you',
  path: ['phone'],
});

type DemoRequestValues = z.infer<typeof demoRequestSchema>;

const inputClass = 'pl-10 bg-muted/40 border-accent/30 text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-accent/30';

const trustBenefits = [
  {
    icon: Users,
    title: 'Trusted by Healthcare Professionals',
    description: 'Built for clinical and administrative teams managing daily patient care and hospital operations.',
  },
  {
    icon: TrendingUp,
    title: 'Proven Results',
    description: 'Streamlined workflows that reduce administrative burden and improve coordination across teams.',
  },
  {
    icon: Building2,
    title: 'Multi-Tenant Platform',
    description: 'Supports multiple hospitals, clinics, and organisations with isolated data and access control.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Compliant',
    description: 'Role-based access control, encrypted credentials, and audit logging for accountable operations.',
  },
];

const stats = [
  { icon: Hospital, value: '250+', label: 'Hospitals Trust Us' },
  { icon: Users, value: '50,000+', label: 'Patients Managed Daily' },
  { icon: Stethoscope, value: '5,000+', label: 'Healthcare Professionals' },
  { icon: Activity, value: '99.9%', label: 'System Uptime' },
];

const benefitItems = [
  { icon: CalendarCheck, label: 'Live Product Tour' },
  { icon: Users, label: 'Expert Guidance' },
  { icon: Clock3, label: 'Tailored to Your Needs' },
];

export default function RequestDemoPage() {
  const reduce = useReducedMotion();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DemoRequestValues>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { preferredContact: 'email', role: 'Demo Request', website: '' },
  });

  const onSubmit = async (values: DemoRequestValues) => {
    setServerError('');
    try {
      await api.requestDemo(values);
      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'We could not send your request. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none">
        Skip to main content
      </a>
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border bg-primary py-16 sm:py-20 lg:py-24">
          <motion.img
            src="/images/hero-banner/medicare-demo-request-hero-banner.avif"
            alt="A diverse healthcare team standing together in a bright clinical setting"
            initial={reduce ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full select-none object-cover object-[60%_center]"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-overlay/60" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="mx-auto grid h-full w-full grid-cols-4 border-x border-primary-foreground/15">
              {[0, 1, 2, 3].map((line) => <div key={line} className="border-r border-primary-foreground/15 last:border-r-0" />)}
            </div>
          </div>

          <div className="relative mx-auto grid w-full gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12 lg:px-8">
            {/* Left column */}
            <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/90">
                <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Request a Personalized Demo
              </span>
              <h1 className="font-display text-4xl font-medium leading-[1.02] tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
                See Smart MediCare <span className="text-accent">in Action</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/85">
                Discover how Smart MediCare streamlines hospital operations, improves patient care coordination, and supports better outcomes for your clinical and administrative teams.
              </p>
              <ul className="flex flex-wrap gap-3 text-sm text-primary-foreground/90">
                {benefitItems.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/15 text-accent">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right column: form card */}
            <motion.div initial={reduce ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="lg:ml-auto lg:w-full lg:max-w-md">
              <Card className="border-primary-foreground/20 bg-card/95 shadow-2xl shadow-primary/20 backdrop-blur">
                <CardHeader className="border-b border-border">
                  <CardTitle>Request a Demo</CardTitle>
                  <CardDescription>Tell us about your organization. We'll get back to you within 24 hours to schedule your personalized demo.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {submitted ? (
                    <div className="space-y-5 py-10 text-center" role="status" aria-live="polite">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></span>
                      <div><h2 className="text-xl font-semibold text-foreground">Your request is on its way.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A Smart MediCare product specialist will contact you using your selected preference.</p></div>
                      <Button asChild><Link to="/">Return to home</Link></Button>
                    </div>
                  ) : (
                    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
                      <Field id="demo-name" label="Full Name" required error={errors.name?.message} icon={User}>
                        <Input id="demo-name" className={inputClass} autoComplete="name" {...register('name')} aria-invalid={!!errors.name} />
                      </Field>
                      <Field id="demo-email" label="Work Email" required error={errors.email?.message} icon={Mail}>
                        <Input id="demo-email" type="email" className={inputClass} autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
                      </Field>
                      <Field id="demo-phone" label="Phone Number" required error={errors.phone?.message} icon={Phone}>
                        <Input id="demo-phone" type="tel" className={inputClass} autoComplete="tel" {...register('phone')} aria-invalid={!!errors.phone} />
                      </Field>
                      <Field id="demo-organization" label="Organization / Hospital" required error={errors.organization?.message} icon={Building2}>
                        <Input id="demo-organization" className={inputClass} autoComplete="organization" {...register('organization')} aria-invalid={!!errors.organization} />
                      </Field>
                      <Field id="demo-organization-size" label="Number of Staff" required error={errors.organizationSize?.message} icon={Users}>
                        <select id="demo-organization-size" className={`h-9 w-full rounded-md border border-accent/30 bg-muted/40 px-3 pl-10 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-accent/30 focus-visible:ring-[3px] [&>option]:bg-background [&>option]:text-foreground`} {...register('organizationSize')} aria-invalid={!!errors.organizationSize}>
                          <option value="">Select size</option>
                          <option value="1-50">1–50</option>
                          <option value="51-200">51–200</option>
                          <option value="201-500">201–500</option>
                          <option value="501-1000">501–1,000</option>
                          <option value="1000+">1,000+</option>
                        </select>
                      </Field>
                      <div className="space-y-2">
                        <Label htmlFor="demo-message">Additional Information</Label>
                        <div className="relative">
                          <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-accent" aria-hidden="true" />
                          <Textarea id="demo-message" className="min-h-24 resize-y pl-10 bg-muted/40 border-accent/30 text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-accent/30" {...register('message')} aria-invalid={!!errors.message} />
                        </div>
                        {errors.message && <p className="text-xs font-medium text-destructive" role="alert">{errors.message.message}</p>}
                      </div>
                      <div className="hidden" aria-hidden="true"><Label htmlFor="website">Website</Label><Input id="website" tabIndex={-1} autoComplete="off" {...register('website')} /></div>
                      {serverError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{serverError}</p>}
                      <Button type="submit" className="h-11 w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending request…</> : <><span>Request Demo</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
                      </Button>
                      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                        Your information is kept private and used only to arrange your demo.
                      </p>
                      <input type="hidden" {...register('preferredContact')} value="email" />
                      <input type="hidden" {...register('role')} value="Demo Request" />
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Trust & benefits */}
        <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Why teams choose us</p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Trusted by Healthcare Professionals</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">A practical platform for clinical and administrative teams managing daily patient care and hospital operations.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {trustBenefits.map(({ icon: Icon, title, description }) => (
                <div key={title} className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg hover:shadow-primary/10">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Statistics strip */}
        <section className="border-b border-border bg-background py-14 sm:py-16">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="mb-8 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Platform at a glance</p>
              <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">Numbers that reflect how teams use Smart MediCare</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Illustrative figures — replace with verified organisational metrics before launch.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold tabular-nums text-accent">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
</div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ id, label, required, error, icon: Icon, children }: { id: string; label: string; required?: boolean; error?: string; icon: typeof User; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" aria-hidden="true" />
        {children}
      </div>
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}
