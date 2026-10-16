import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleHelp, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Faq = {
  question: string;
  answer: string;
  category: 'Getting started' | 'Care workflows' | 'Security & privacy' | 'Account & support';
};

const faqs: Faq[] = [
  {
    category: 'Getting started',
    question: 'Who is Smart MediCare designed for?',
    answer: 'Smart MediCare brings clinical, operational, pharmacy, and administrative teams into one coordinated workspace. It is designed for hospitals, clinics, and care networks that need clearer handoffs across the care journey.',
  },
  {
    category: 'Getting started',
    question: 'How can our organisation evaluate the platform?',
    answer: 'Request a demonstration and tell us about the teams and workflows you want to explore. We will shape the conversation around the practical work your organisation needs to coordinate.',
  },
  {
    category: 'Getting started',
    question: 'Can different teams use the same workspace?',
    answer: 'Yes. The platform is intended to support connected work across teams while presenting people with the tools and permissions appropriate to their role.',
  },
  {
    category: 'Care workflows',
    question: 'What areas of care operations does the platform support?',
    answer: 'The platform supports patient records, scheduling, clinical documentation, pharmacy and inventory work, staff coordination, financial operations, and controlled administrative workflows.',
  },
  {
    category: 'Care workflows',
    question: 'Does Smart MediCare replace clinical judgment?',
    answer: 'No. Platform features and AI-assisted capabilities are intended to support licensed professionals and established care processes. They do not replace professional assessment, diagnosis, or clinical decision-making.',
  },
  {
    category: 'Care workflows',
    question: 'Can we manage permissions by staff role?',
    answer: 'Yes. Role-based access controls help organisations give each person access appropriate to their responsibilities, while keeping privileged administration and operational functions clearly separated.',
  },
  {
    category: 'Security & privacy',
    question: 'Should I submit patient information through this public website?',
    answer: 'No. Please do not include patient, clinical, or other confidential information in public forms or general enquiries. Existing customers should sign in and use their organisation’s established support process.',
  },
  {
    category: 'Security & privacy',
    question: 'How does the platform approach access control?',
    answer: 'Access is designed around authenticated accounts and role-scoped permissions so that operational and administrative functions can be separated according to organisational responsibility.',
  },
  {
    category: 'Security & privacy',
    question: 'Does this page store or request health information?',
    answer: 'No. This public FAQ is informational only. It does not request, display, or collect clinical or personal health information.',
  },
  {
    category: 'Account & support',
    question: 'I am an existing customer. Where should I go for help?',
    answer: 'Sign in to your Smart MediCare workspace first. This keeps assistance connected to the right organisation, account permissions, and operational context.',
  },
  {
    category: 'Account & support',
    question: 'What if I cannot sign in?',
    answer: 'Use the password recovery option on the sign-in page. If your organisation has a local access administrator, they may also be able to help with account access and role questions.',
  },
  {
    category: 'Account & support',
    question: 'Where can I ask a question not covered here?',
    answer: 'For an evaluation, partnership, or general platform conversation, use the contact page. For account-specific assistance, sign in first and follow your organisation’s support route.',
  },
];

const categories = ['All questions', ...Array.from(new Set(faqs.map((faq) => faq.category)))];

export default function FaqPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All questions');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFaqs = useMemo(() => faqs.filter((faq) => (
    (category === 'All questions' || faq.category === category)
    && (!normalizedQuery || `${faq.question} ${faq.answer} ${faq.category}`.toLocaleLowerCase().includes(normalizedQuery))
  )), [category, normalizedQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('/images/medicare-faq-hero-banner.avif')` }} />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none">Skip to main content</a>
      <main id="main-content">
        <section className="border-b border-primary-foreground/15 bg-primary py-16 text-primary-foreground sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:items-end lg:px-8">
            <div className="lg:col-span-8">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/80"><CircleHelp className="h-4 w-4 text-accent" aria-hidden="true" /> Practical answers</p>
              <h1 className="mt-6 max-w-3xl font-display text-5xl font-medium leading-[0.98] tracking-tight sm:text-6xl">Questions, answered with care.</h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-primary-foreground/80">A clear starting point for evaluating Smart MediCare, understanding its role in care operations, and finding the right place for support.</p>
            </div>
            <aside className="border-l-2 border-accent bg-primary/80 p-5 lg:col-span-3 lg:col-start-10">
              <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-primary-foreground/70">Privacy reminder</p>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/90">Please do not include patient or confidential information in public enquiries.</p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="faq-heading">
          <div className="grid gap-8 border-b border-border pb-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Find an answer</p><h2 id="faq-heading" className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">Start with the question in front of you.</h2></div>
            <p className="max-w-xl leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9">Search across common topics, or narrow the list to the part of the platform you are exploring.</p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative max-w-2xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 pl-12" type="search" placeholder="Search questions and answers" aria-label="Search frequently asked questions" /></div>
            <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">{visibleFaqs.length} {visibleFaqs.length === 1 ? 'answer' : 'answers'} shown</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter frequently asked questions by topic">
            {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground">{item}</button>)}
          </div>

          <div className="mt-12 divide-y divide-border border-y border-border">
            {visibleFaqs.map((faq) => (
              <details key={faq.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-semibold tracking-tight marker:content-none focus-visible:outline-none [&::-webkit-details-marker]:hidden"><span><span className="mb-2 block font-mono text-xs font-normal uppercase tracking-[0.14em] text-accent">{faq.category}</span>{faq.question}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xl font-normal leading-none text-accent transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span></summary>
                <div className="max-w-3xl pb-6 pr-12 leading-relaxed text-muted-foreground">{faq.answer}</div>
              </details>
            ))}
            {visibleFaqs.length === 0 && <div className="py-14 text-center"><Stethoscope className="mx-auto h-7 w-7 text-accent" aria-hidden="true" /><p className="mt-4 text-lg font-semibold">No matching answer yet.</p><p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">Try a broader search or use the contact page to begin the right conversation.</p><Button variant="outline" className="mt-6" asChild><Link to="/contact-us">Contact us <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div>}
          </div>
        </section>

        <section className="border-t border-border bg-card py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8"><div className="lg:col-span-7"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Still deciding?</p><h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">We can make the next step straightforward.</h2><p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">Request a focused platform walkthrough, or sign in to continue an existing customer conversation in the right context.</p></div><div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:col-start-9 lg:justify-end"><Button size="lg" asChild><Link to="/auth/request-demo">Request a demo <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/auth/login">Sign in</Link></Button></div></div>
        </section>
      </main>
    </div>
  );
}
