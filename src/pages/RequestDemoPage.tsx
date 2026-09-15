import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Activity, ArrowLeft, CalendarCheck, CheckCircle2, Clock3, Loader2, Mail, ShieldCheck, Users } from 'lucide-react';
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
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Smart Health home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" /></span>
            <span className="text-lg font-bold text-foreground">Smart <span className="text-accent">Health</span></span>
          </Link>
          <Button variant="ghost" size="sm" asChild><Link to="/login">Staff sign in</Link></Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
        <section className="lg:pt-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Smart Health</Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-accent">Personalised platform tour</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">See Smart Health in action.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">Tell us about your organisation and a product specialist will prepare a focused walkthrough for your team.</p>
          <ul className="mt-10 space-y-5 text-sm text-muted-foreground">
            <li className="flex gap-3"><CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">Built around your workflow.</strong><br />Explore the clinical, operations, pharmacy, and reporting tools most relevant to you.</span></li>
            <li className="flex gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">Bring the right people.</strong><br />Invite clinical, operational, and IT stakeholders to the same session.</span></li>
            <li className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span><strong className="text-foreground">A clear next step.</strong><br />You will receive a response through your preferred contact method.</span></li>
          </ul>
          <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Please do not include patient or other sensitive health information.</p>
        </section>

        <Card className="border-border bg-card shadow-lg shadow-border/50">
          <CardHeader className="border-b border-border">
            <CardTitle>Request a demo</CardTitle>
            <CardDescription>Required fields are marked by their labels. We use these details only to arrange your demo.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {submitted ? (
              <div className="space-y-5 py-10 text-center" role="status" aria-live="polite">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></span>
                <div><h2 className="text-xl font-semibold text-foreground">Your request is on its way.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A Smart Health product specialist will contact you using your selected preference.</p></div>
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
                  <Field id="demo-organization-size" label="Organisation size" error={errors.organizationSize?.message}><select id="demo-organization-size" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" {...register('organizationSize')} aria-invalid={!!errors.organizationSize}><option value="">Select size</option><option value="1-50">1–50 people</option><option value="51-250">51–250 people</option><option value="251-1000">251–1,000 people</option><option value="1000+">1,000+ people</option></select></Field>
                  <Field id="demo-preferred-contact" label="Preferred contact" error={errors.preferredContact?.message}><select id="demo-preferred-contact" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" {...register('preferredContact')}><option value="email">Email</option><option value="phone">Phone</option></select></Field>
                </div>
                <Field id="demo-phone" label="Phone (required when phone is selected)" error={errors.phone?.message}><Input id="demo-phone" type="tel" autoComplete="tel" {...register('phone')} aria-invalid={!!errors.phone} /></Field>
                <Field id="demo-message" label="What would you like to explore? (optional)" error={errors.message?.message}><Textarea id="demo-message" className="min-h-28 resize-y" {...register('message')} aria-invalid={!!errors.message} /></Field>
                <div className="hidden" aria-hidden="true"><Label htmlFor="website">Website</Label><Input id="website" tabIndex={-1} autoComplete="off" {...register('website')} /></div>
                {serverError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{serverError}</p>}
                <Button type="submit" className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending request…</> : <><Mail className="h-4 w-4" aria-hidden="true" /> Request my demo</>}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}</div>;
}
