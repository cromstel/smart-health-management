import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The hospital's tenant address: the subdomain it is reached by, and any
 * custom domain pointed at the platform.
 *
 * The hospital is resolved from the signed-in account — an administrator's
 * own hospital by its public code, or, for a super administrator, the single
 * hospital in the deployment or one picked from the list. Nothing here
 * assumes a row number.
 */

interface HospitalRow {
  id: number;
  hospital_id: string;
  name: string;
  subdomain?: string | null;
  domain?: string | null;
}

const subdomainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
// A full domain: labels and a dot, for example portal.example.org.
const domainPattern = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export default function SubdomainSettings() {
  const { user, hasPermission } = useAuth();

  const [hospitals, setHospitals] = useState<HospitalRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission('hospitals:edit');

  // The account's own hospital, when it has one; otherwise the only row in
  // the deployment; otherwise whatever is picked below.
  const preferredId = useMemo(() => {
    if (!hospitals || hospitals.length === 0) return null;
    const mine = user?.hospital_id
      ? hospitals.find((h) => h.hospital_id === user.hospital_id)
      : undefined;
    if (mine) return mine.id;
    return hospitals.length === 1 ? hospitals[0].id : null;
  }, [hospitals, user?.hospital_id]);

  useEffect(() => {
    let cancelled = false;
    api
      .getHospitals()
      // handleResponse is an unchecked assertion (see api.ts line 42), so the
      // shape is checked here rather than trusted.
      .then((rows: unknown) => {
        if (cancelled) return;
        setHospitals(Array.isArray(rows) ? (rows as HospitalRow[]) : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'Could not load hospitals.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (preferredId === null) return;
    setSelectedId(preferredId);
  }, [preferredId]);

  const selected = useMemo(
    () => hospitals?.find((h) => h.id === selectedId) ?? null,
    [hospitals, selectedId]
  );

  // Seed the form from the selected row whenever the selection changes.
  useEffect(() => {
    setSubdomain(selected?.subdomain ?? '');
    setDomain(selected?.domain ?? '');
  }, [selected]);

  const subdomainValid = subdomain === '' || (subdomainPattern.test(subdomain) && subdomain.length >= 2 && subdomain.length <= 100);
  const domainValid = domain === '' || domainPattern.test(domain);
  const dirty =
    selected !== null &&
    (subdomain !== (selected.subdomain ?? '') || domain !== (selected.domain ?? ''));
  const canSave = canEdit && selected !== null && dirty && subdomainValid && domainValid && !saving;

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSave || selected === null) return;
      setSaving(true);
      try {
        await api.updateHospitalSubdomain(String(selected.id), {
          subdomain: subdomain || undefined,
          domain: domain || undefined,
        });
        setHospitals((current) =>
          current
            ? current.map((h) =>
                h.id === selected.id ? { ...h, subdomain: subdomain || null, domain: domain || null } : h
              )
            : current
        );
        toast.success('Address updated. Changes take effect for new sessions.');
      } catch (err) {
        // The server knows which names are reserved and which are claimed.
        toast.error(err instanceof ApiError ? err.message : 'Could not update the address.');
      } finally {
        setSaving(false);
      }
    },
    [canSave, selected, subdomain, domain]
  );

  if (loadError) {
    return (
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Subdomain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!hospitals) {
    return (
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Subdomain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (hospitals.length === 0 || (preferredId === null && selectedId === null)) {
    return (
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Subdomain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hospitals.length === 0
              ? 'No hospitals exist in this deployment yet.'
              : 'No hospital is assigned to your account, so there is no address to configure.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-sans text-lg">Subdomain</CardTitle>
          {selected?.subdomain && (
            <Badge variant="outline" className="font-mono text-xs">
              {selected.subdomain}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            You do not have permission to change the hospital address.
          </p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {hospitals.length > 1 && (
              <div>
                <Label htmlFor="sub-hospital">Hospital</Label>
                <select
                  id="sub-hospital"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.hospital_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="sub-subdomain">Subdomain</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="sub-subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  aria-invalid={subdomain !== '' && !subdomainValid}
                  className="font-mono"
                  placeholder="general-hospital"
                  disabled={saving}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap self-center">
                  .medicare.cromstelit.com
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                2-100 characters: letters, numbers and hyphens. Names the platform uses are reserved.
              </p>
            </div>

            <div>
              <Label htmlFor="sub-domain">Custom domain (optional)</Label>
              <Input
                id="sub-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                aria-invalid={domain !== '' && !domainValid}
                placeholder="portal.example.org"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Point a domain of your own at the platform by arrangement with operations.
              </p>
            </div>

            <Button type="submit" disabled={!canSave}>
              {saving ? 'Saving…' : 'Save address'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
