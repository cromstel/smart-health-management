import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest, ApiRequestError } from '@/services/shmsApiClient';

/**
 * Public hospital registration.
 *
 * A prospective hospital has no account yet, so this form posts to the
 * unauthenticated onboarding endpoint. What it creates is INACTIVE: a super
 * administrator must confirm the record before the address starts serving.
 * The confirmation below states exactly that, rather than implying the
 * portal is live.
 */

/** The shape the platform itself occupies; the server refuses these too. */
const RESERVED_HINT =
  '2-100 characters: lowercase letters, numbers and hyphens. Names the platform uses are reserved.';

const subdomainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

export default function HospitalRegistrationPage() {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ subdomain: string; message: string } | null>(null);

  const subdomainValid = subdomainPattern.test(subdomain) && subdomain.length >= 2 && subdomain.length <= 100;
  const canSubmit = subdomainValid && name.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ subdomain: string; message: string }>('/api/onboard', {
        method: 'POST',
        body: { name: name.trim(), subdomain, email: email.trim() || undefined },
      });
      setConfirmed({ subdomain: result.subdomain, message: result.message });
    } catch (err) {
      // The server's own message: it knows which names are reserved and
      // whether the subdomain is already claimed.
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">Register Your Medical Center</h1>
        <p className="text-muted-foreground mt-2">Claim a subdomain so your center can access its portal.</p>
      </header>
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {confirmed ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">{confirmed.message}</p>
              <p className="text-muted-foreground">
                Your address:{' '}
                <code className="font-mono bg-muted px-1 rounded">
                  {confirmed.subdomain}.medicare.cromstelit.com
                </code>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="h-name">Center name</label>
                <input
                  id="h-name"
                  required
                  aria-required="true"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sea-blue"
                  placeholder="General Hospital"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="h-sub">Subdomain</label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="h-sub"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    aria-invalid={subdomain !== '' && !subdomainValid}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sea-blue font-mono"
                    placeholder="general-hospital"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap self-center">.medicare.cromstelit.com</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{RESERVED_HINT}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="h-email">Contact email</label>
                <input
                  id="h-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sea-blue"
                  placeholder="admin@hospital.com"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" disabled={!canSubmit} className="w-full">
                {submitting ? 'Submitting…' : 'Submit Onboarding Request'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
