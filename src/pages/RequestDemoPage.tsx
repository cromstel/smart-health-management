import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarCheck, CheckCircle2, Clock3, Loader2, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react';
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
  organizationSize: z.enum(['1-50', '51-250', '251-1000', '1000+'], { message: 'Select your organisation size' }),
  preferredContact: z.enum(['email', 'phone']),
  phone: z.string().trim().max(30, 'Enter a phone number of 30 characters or fewer').optional(),
  message: z.string().trim().max(1000, 'Keep your message to 1,000 characters or fewer').optional(),
  website: z.string().max(0).optional(),
}).refine((values) => values.preferredContact !== 'phone' || Boolean(values.phone && values.phone.length >= 7), {
  message: 'Enter a phone number so we can call you',
  path: ['phone'],
});

type DemoRequestValues = z.infer<typeof demoRequestSchema>;

export default function RequestDemoPage() {
  const reduce = useReducedMotion();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DemoRequestValues>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { preferredContact: 'email', website: '' },
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
        <section className="relative isolate min-h-[32rem] overflow-hidden border-b border-primary-foreground/15 bg-primary py-16 sm:py-24 lg:flex lg:min-h-[34rem] lg:items-center lg:py-28">
          <motion.img
            src="/images/hero-banner/medicare-demo-request-hero-banner.avif"
            alt="A diverse healthcare team standing together in a bright clinical setting"
            initial={reduce ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full select-none object-cover object-[60%_center]"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-overlay/68" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="mx-auto grid h-full max-w-6xl grid-cols-4 border-x border-primary-foreground/15">
              {[0, 1, 2, 3].map((line) => <div key={line} className="border-r border-primary-foreground/15 last:border-r-0" />)}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-6xl px-4 text-left sm:px-6 lg:px-8">
            <motion.p initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }} className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/90">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              Personalised platform tour
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl">
              <div className="border-y border-primary-foreground/30 py-8 sm:py-10">
                <h1 className="font-display text-4xl font-medium leading-[1.02] tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">See Smart MediCare in action.</h1>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-primary-foreground/90">Tell us about your organisation and a product specialist will prepare a focused walkthrough for your team.</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-24">
          <div className="lg:pt-2">
            <ul className="space-y-6 text-sm text-muted-foreground">
              <li className="flex gap-3"><CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">Built around your workflow.</strong><br />Explore the clinical, operations, pharmacy, and reporting tools most relevant to you.</span></li>
              <li className="flex gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">Bring the right people.</strong><br />Invite clinical, operational, and IT stakeholders to the same session.</span></li>
              <li className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">A clear next step.</strong><br />You will receive a response through your preferred contact method.</span></li>
            </ul>
            <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" /> Please do not include patient or other sensitive health information.</p>
          </div>

          <Card className="border-border bg-card shadow-lg shadow-border/50">
          <CardHeader className="border-b border-border">
            <CardTitle>Request a demo</CardTitle>
            <CardDescription>Required fields are marked by their labels. We use these details only to arrange your demo.</CardDescription>
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="demo-name" label="Full name" error={errors.name?.message}><Input id="demo-name" autoComplete="name" {...register('name')} aria-invalid={!!errors.name} /></Field>
                  <Field id="demo-email" label="Work email" error={errors.email?.message}><Input id="demo-email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} /></Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="demo-organization" label="Organisation" error={errors.organization?.message}><Input id="demo-organization" autoComplete="organization" {...register('organization')} aria-invalid={!!errors.organization} /></Field>
                  <Field id="demo-role" label="Your role" error={errors.role?.message}><Input id="demo-role" autoComplete="organization-title" {...register('role')} aria-invalid={!!errors.role} /></Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="demo-organization-size" label="Organisation size" error={errors.organizationSize?.message}><select id="demo-organization-size" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&>option]:bg-background [&>option]:text-foreground" {...register('organizationSize')} aria-invalid={!!errors.organizationSize}><option value="">Select size</option><option value="1-50">1–50 people</option><option value="51-250">51–250 people</option><option value="251-1000">251–1,000 people</option><option value="1000+">1,000+ people</option></select></Field>
                  <Field id="demo-preferred-contact" label="Preferred contact" error={errors.preferredContact?.message}><select id="demo-preferred-contact" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&>option]:bg-background [&>option]:text-foreground" {...register('preferredContact')}><option value="email">Email</option><option value="phone">Phone</option></select></Field>
                </div>
                <Field id="demo-phone" label="Phone (required when phone is selected)" error={errors.phone?.message}><Input id="demo-phone" type="tel" autoComplete="tel" {...register('phone')} aria-invalid={!!errors.phone} /></Field>
                <Field id="demo-message" label="What would you like to explore? (optional)" error={errors.message?.message}><Textarea id="demo-message" className="min-h-28 resize-y" {...register('message')} aria-invalid={!!errors.message} /></Field>
                <div className="hidden" aria-hidden="true"><Label htmlFor="website">Website</Label><Input id="website" tabIndex={-1} autoComplete="off" {...register('website')} /></div>
                {serverError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{serverError}</p>}
                <Button type="submit" className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending request…</> : <><Mail className="h-4 w-4" aria-hidden="true" /> SEND REQUEST</>}</Button>
              </form>
            )}
          </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}</div>;
}
