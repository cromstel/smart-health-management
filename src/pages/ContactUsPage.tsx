import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  LifeBuoy,
  MessageCircleMore,
  Loader2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';

const contactRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid work email').max(254),
  organization: z.string().trim().min(2, 'Enter your organisation name').max(160),
  role: z.string().trim().min(2, 'Enter your role').max(120),
  organizationSize: z.enum(['1-50', '51-200', '201-500', '501-1000', '1000+'], { message: 'Select your organisation size' }),
  preferredContact: z.enum(['email', 'phone']),
  phone: z.string().trim().max(30, 'Enter a phone number of 30 characters or fewer').optional(),
  message: z.string().trim().min(10, 'Share a little more so we can prepare').max(1000),
  website: z.string().max(0).optional(),
}).refine((values) => values.preferredContact !== 'phone' || Boolean(values.phone && values.phone.length >= 7), {
  message: 'Enter a phone number so we can call you',
  path: ['phone'],
});

type ContactRequestValues = z.infer<typeof contactRequestSchema>;

const conversationPaths = [
  {
    number: '01',
    icon: CalendarCheck,
    eyebrow: 'Exploring Smart MediCare',
    title: 'Plan a focused walkthrough',
    description: 'Tell us how your organisation works today. We will shape a platform tour around the teams and workflows that matter to you.',
    action: 'Request a demo',
    to: '/auth/request-demo',
  },
  {
    number: '02',
    icon: LifeBuoy,
    eyebrow: 'Already a customer',
    title: 'Start from your workspace',
    description: 'Sign in to keep support conversations connected to your organisation, access permissions, and the context your team needs.',
    action: 'Sign in to Smart MediCare',
    to: '/auth/login',
  },
  {
    number: '03',
    icon: HeartHandshake,
    eyebrow: 'Partnerships & ideas',
    title: 'Bring the right people together',
    description: 'For a new collaboration or a broader platform conversation, begin with a demo request and select the contact method that suits you.',
    action: 'Start a conversation',
    to: '/auth/request-demo',
  },
];

const responsePrinciples = [
  ['01', 'A real person, with the right context', 'We route product conversations to people who understand clinical and operational work—not a generic queue.'],
  ['02', 'No sensitive information here', 'Please keep patient, clinical, and other confidential information out of public contact requests.'],
  ['03', 'A clear next step', 'You choose how to be contacted when you request a demo, so the follow-up fits your team’s availability.'],
];

/**
 * Entrance reveal for a section.
 *
 * Honours `prefers-reduced-motion`. The global CSS block that zeroes
 * `animation-duration` and `transition-duration` cannot reach these: Motion
 * drives transforms from JavaScript, so the element still slid and faded in
 * for anyone who asked for stillness.
 */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={reduceMotion ? undefined : isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function ContactUsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  // The hero animates on mount rather than on scroll, so each element opts out
  // of its entrance once. See Reveal for why the CSS block is not enough.
  const reduceMotion = useReducedMotion();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactRequestValues>({
    resolver: zodResolver(contactRequestSchema),
    defaultValues: { preferredContact: 'email', website: '' },
  });

  const onSubmit = async (values: ContactRequestValues) => {
    setServerError('');
    try {
      await api.requestDemo(values);
      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'We could not send your message. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none">
        Skip to main content
      </a>
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-primary-foreground/15 bg-primary py-16 sm:py-24 lg:min-h-[43rem] lg:py-28">
          <motion.img
            src="/images/medicare-contact-us-hero-banner.webp"
            alt="A diverse healthcare team standing together in a bright clinical setting"
            initial={reduceMotion ? false : { opacity: 0, scale: 1.055 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 -z-20 h-full w-full select-none object-cover object-[60%_center]"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-overlay/70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="mx-auto grid h-full w-full grid-cols-4 border-x border-primary-foreground/15">
              {[0, 1, 2, 3].map((line) => <div key={line} className="border-r border-primary-foreground/15 last:border-r-0" />)}
            </div>
          </div>

          <div className="relative mx-auto grid w-full w-full gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8">
            <div className="lg:col-span-8">
              <motion.p initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/90">
                <MessageCircleMore className="h-4 w-4 text-accent" aria-hidden="true" />
                Start with a conversation
              </motion.p>
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="mt-6 max-w-3xl border-y border-primary-foreground/30 py-8 sm:py-10">
                <h1 className="font-display text-5xl font-medium leading-[0.98] tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl">Let’s make room for better care.</h1>
                <p className="mt-7 max-w-2xl text-lg leading-relaxed text-primary-foreground/90">Whether you are evaluating a new care platform, coordinating a wider team, or need help from inside your workspace, we will help you find the right next step.</p>
              </motion.div>
            </div>
            <motion.aside initial={reduceMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.35 }} className="border-l-2 border-accent bg-primary/80 p-5 text-primary-foreground lg:col-span-3 lg:col-start-10 lg:mb-1">
              <Clock3 className="h-5 w-5 text-accent" aria-hidden="true" />
              <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-primary-foreground/75">Thoughtful follow-up</p>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/90">Choose your preferred contact method when you request a demo. We will come prepared for the conversation.</p>
            </motion.aside>
          </div>
        </section>

        <section className="mx-auto w-full px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <Reveal className="grid gap-8 border-b border-border pb-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Choose your path</p><h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">A good conversation begins in the right place.</h2></div>
            <p className="max-w-xl leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9">We have kept public contact simple on purpose. Pick the route that matches what you need, without placing sensitive information in an open web form.</p>
          </Reveal>

          <div className="divide-y divide-border">
            {conversationPaths.map(({ number, icon: Icon, eyebrow, title, description, action, to }, index) => (
              <Reveal key={title} delay={index * 0.08} className="group grid gap-6 py-8 sm:py-10 lg:grid-cols-12 lg:items-center">
                <span className="font-mono text-sm tabular-nums text-accent lg:col-span-1">{number}</span>
                <div className="flex items-start gap-5 lg:col-span-5"><span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p><h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3></div></div>
                <p className="leading-relaxed text-muted-foreground lg:col-span-3">{description}</p>
                <div className="lg:col-span-2 lg:col-start-11"><Button variant="link" className="group/button h-auto justify-start gap-2 p-0 text-accent no-underline hover:text-accent hover:no-underline focus-visible:text-accent" asChild><Link to={to}>{action}<ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover/button:-translate-y-0.5 group-hover/button:translate-x-0.5" aria-hidden="true" /></Link></Button></div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/45 py-20 sm:py-24">
          <div className="mx-auto grid w-full gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
            <Reveal className="lg:col-span-4"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">What to expect</p><h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">Useful before it is urgent.</h2><div className="mt-8 border-l-2 border-accent pl-5 text-sm leading-relaxed text-muted-foreground"><ShieldCheck className="mb-3 h-5 w-5 text-success" aria-hidden="true" />For the protection of patients and teams, do not include protected health information in a public request.</div></Reveal>
            <Reveal delay={0.1} className="lg:col-span-7 lg:col-start-6"><ol className="divide-y divide-border border-y border-border">{responsePrinciples.map(([number, title, description]) => <li key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 py-7 sm:grid-cols-[3.5rem_1fr]"><span className="font-mono text-sm tabular-nums text-accent">{number}</span><div><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{description}</p></div></li>)}</ol></Reveal>
          </div>
        </section>

        <section className="mx-auto grid w-full gap-5 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-28">
          <Reveal className="border border-border bg-card p-8 sm:p-10 lg:col-span-7"><Building2 className="h-7 w-7 text-accent" aria-hidden="true" /><p className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-accent">For care organisations</p><h2 className="mt-4 max-w-xl font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">Tell us where care could feel more connected.</h2><p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">Share the shape of your organisation and the conversation you would like to have. We will use it only to prepare a focused follow-up.</p>
            {submitted ? (
              <div className="mt-8 border border-success/30 bg-success/10 p-6" role="status" aria-live="polite"><CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" /><h3 className="mt-4 text-xl font-semibold">Your message is on its way.</h3><p className="mt-2 leading-relaxed text-muted-foreground">Thank you. A Smart MediCare specialist will follow up using your selected contact method.</p></div>
            ) : (
              <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="contact-name">Full name</Label><Input id="contact-name" className="mt-2" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register('name')} />{errors.name && <p className="mt-1.5 text-sm text-destructive">{errors.name.message}</p>}</div><div><Label htmlFor="contact-email">Work email</Label><Input id="contact-email" className="mt-2" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email')} />{errors.email && <p className="mt-1.5 text-sm text-destructive">{errors.email.message}</p>}</div></div>
                <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="contact-organisation">Organisation</Label><Input id="contact-organisation" className="mt-2" autoComplete="organization" aria-invalid={Boolean(errors.organization)} {...register('organization')} />{errors.organization && <p className="mt-1.5 text-sm text-destructive">{errors.organization.message}</p>}</div><div><Label htmlFor="contact-role">Your role</Label><Input id="contact-role" className="mt-2" autoComplete="organization-title" aria-invalid={Boolean(errors.role)} {...register('role')} />{errors.role && <p className="mt-1.5 text-sm text-destructive">{errors.role.message}</p>}</div></div>
                <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="contact-size">Organisation size</Label><select id="contact-size" className="mt-2 flex h-9 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-popover dark:text-popover-foreground [&_option]:bg-popover [&_option]:text-popover-foreground" aria-invalid={Boolean(errors.organizationSize)} {...register('organizationSize')}><option value="">Select size</option><option value="1-50">1-50 people</option><option value="51-200">51-200 people</option><option value="201-500">201-500 people</option><option value="501-1000">501-1,000 people</option><option value="1000+">1,000+ people</option></select>{errors.organizationSize && <p className="mt-1.5 text-sm text-destructive">{errors.organizationSize.message}</p>}</div><fieldset><legend className="text-sm font-medium">Preferred contact</legend><div className="mt-3 flex gap-5"><label className="flex items-center gap-2 text-sm"><input type="radio" value="email" {...register('preferredContact')} /> Email</label><label className="flex items-center gap-2 text-sm"><input type="radio" value="phone" {...register('preferredContact')} /> Phone</label></div></fieldset></div>
                <div><Label htmlFor="contact-phone">Phone <span className="text-muted-foreground">(required if phone is selected)</span></Label><Input id="contact-phone" className="mt-2" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register('phone')} />{errors.phone && <p className="mt-1.5 text-sm text-destructive">{errors.phone.message}</p>}</div>
                <div><Label htmlFor="contact-message">What would you like to discuss?</Label><Textarea id="contact-message" className="mt-2 min-h-32" aria-describedby="contact-message-note" aria-invalid={Boolean(errors.message)} {...register('message')} />{errors.message && <p className="mt-1.5 text-sm text-destructive">{errors.message.message}</p>}<p id="contact-message-note" className="mt-2 text-sm leading-relaxed text-muted-foreground">Please do not include patient, clinical, or other sensitive health information.</p></div>
                <div className="hidden" aria-hidden="true"><Label htmlFor="contact-website">Website</Label><Input id="contact-website" tabIndex={-1} autoComplete="off" {...register('website')} /></div>
                {serverError && <p className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{serverError}</p>}
                <Button type="submit" size="lg" className="gap-2" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending your message</> : <>Send message <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</Button>
              </form>
            )}
          </Reveal>
          <Reveal delay={0.12} className="flex min-h-80 flex-col justify-between bg-primary p-8 text-primary-foreground sm:p-10 lg:col-span-5"><UsersRound className="h-8 w-8 text-accent" aria-hidden="true" /><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-primary-foreground/70">Already connected?</p><h2 className="mt-4 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Your workspace knows your context.</h2><p className="mt-4 leading-relaxed text-primary-foreground/80">Sign in to continue from the team, organisation, and permissions that shape your work.</p><Button variant="outline" className="mt-7 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild><Link to="/auth/login">Sign in to your workspace</Link></Button></div></Reveal>
        </section>

        <section className="border-t border-border bg-card py-16 sm:py-20">
          <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6"><Sparkles className="mx-auto h-5 w-5 text-accent" aria-hidden="true" /><h2 className="mt-5 font-display text-2xl font-medium tracking-tight sm:text-3xl">The work of care deserves a calmer system.</h2><p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">Start with a conversation built around what your organisation needs next.</p><Button size="lg" className="mt-8 gap-2" asChild><Link to="/auth/request-demo">Talk with our team <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button></Reveal>
        </section>
      </main>
    </div>
  );
}
