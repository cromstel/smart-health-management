import { useState, useEffect } from 'react';
import { api, type SuperAdminBackup, type SuperAdminSetting } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, HardDriveUpload, HardDriveDownload, HeartPulse, ShieldCheck, Copy, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Two-factor enrolment for the super admin's own account.
 *
 * The seed deliberately leaves totp_secret NULL for this account (see
 * seed.sql), so the master session starts on credentials alone and the operator
 * chooses when two-factor becomes mandatory. Without this panel there would be
 * no way to turn it on: the enrolment endpoints exist and the staff settings
 * page uses them, but the super-admin console had no entry point, so the seeded
 * account would stay permanently unenrolled.
 */
function SuperAdminTwoFactor() {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [pairing, setPairing] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const enabled = Boolean(user?.totp_enabled);

  const startEnrolment = async () => {
    setBusy(true);
    try {
      const { secret: newSecret } = await api.totpEnroll();
      setSecret(newSecret);
      setPairing(true);
      setDisabling(false);
      toast.success('Secret generated. Add it to your authenticator app, then confirm a code.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start two-factor setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrolment = async () => {
    const code = confirmCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.totpConfirm(secret, code);
      setPairing(false);
      setConfirmCode('');
      setSecret('');
      setRecoveryCodes(result.recoveryCodes ?? []);
      toast.success('Two-factor authentication enabled for this master account.');
      await refreshUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed. Check the code.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const code = disableCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter a current 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      await api.totpDisable(code);
      setDisabling(false);
      setDisableCode('');
      toast.success('Two-factor authentication disabled.');
      await refreshUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disable two-factor.');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the secret manually.');
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Protects the master session. Not enabled by default so a fresh
          environment can be signed into; enable it once your authenticator app
          is paired.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Status:{' '}
          <span className={enabled ? 'font-semibold text-success' : 'font-semibold text-warning'}>
            {enabled ? 'Enabled' : 'Not enabled'}
          </span>
        </p>

        {recoveryCodes.length > 0 && (
          <div className="space-y-2 rounded-md border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-foreground">
              Recovery codes — shown once
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-xs text-foreground">
              {recoveryCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Store these now. They are the only way back in if the authenticator
              is lost.
            </p>
          </div>
        )}

        {pairing && secret && (
          <div className="space-y-3 rounded-md border border-border bg-background p-4">
            <Label htmlFor="superadmin-totp-secret">Authenticator secret</Label>
            <div className="flex items-center gap-2">
              <code
                id="superadmin-totp-secret"
                className="flex-1 rounded border border-border bg-card px-3 py-2 font-mono text-xs break-all text-foreground"
              >
                {secret}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copySecret}>
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">Copy secret</span>
              </Button>
            </div>
            <Label htmlFor="superadmin-totp-confirm">6-digit code</Label>
            <Input
              id="superadmin-totp-confirm"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="font-mono"
            />
            <Button onClick={confirmEnrolment} disabled={busy}>
              {busy ? 'Verifying...' : 'Confirm and enable'}
            </Button>
          </div>
        )}

        {disabling && (
          <div className="space-y-3 rounded-md border border-border bg-background p-4">
            <Label htmlFor="superadmin-totp-disable">Current 6-digit code</Label>
            <Input
              id="superadmin-totp-disable"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={disable} disabled={busy}>
                {busy ? 'Disabling...' : 'Confirm disable'}
              </Button>
              <Button variant="outline" onClick={() => setDisabling(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!pairing && !disabling && (
          <div className="flex flex-wrap gap-2">
            {enabled ? (
              <Button variant="outline" onClick={() => setDisabling(true)} disabled={busy}>
                Disable two-factor
              </Button>
            ) : (
              <Button onClick={startEnrolment} disabled={busy}>
                {busy ? 'Working...' : 'Enable two-factor'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState<SuperAdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backups, setBackups] = useState<SuperAdminBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setSettings(await api.getSystemSettings());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (settingId: string, value: string) => {
    try {
      setSaving(settingId);
      setSuccess(null);
      await api.updateSystemSetting(settingId, value);
      setSuccess(settingId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err instanceof Error ? `Failed to update setting: ${err.message}` : 'Failed to update setting.');
    } finally {
      setSaving(null);
    }
  };

  const handleTriggerBackup = async () => {
    setBackupLoading(true);
    setBackupSuccess(false);
    setBackupError(null);
    try {
      await api.triggerBackup();
      setBackupSuccess(true);
    } catch (err: any) {
      setBackupError(err.message || 'Failed to trigger backup');
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupSuccess(false), 3000);
    }
  };

  const loadBackups = async () => {
    try {
      setBackups(await api.getBackups());
    } catch (err: any) {
      console.error('Failed to load backups:', err?.message ?? err);
    }
  };
  const handleTriggerRestore = async () => {
    if (!selectedBackup) {
      setRestoreError('Please select a backup to restore.');
      return;
    }
    setRestoreLoading(true);
    setRestoreSuccess(false);
    setRestoreError(null);
    try {
      const path = `backups/${selectedBackup}`;
      await api.triggerRestore(path);
      setRestoreSuccess(true);
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to trigger restore');
    } finally {
      setRestoreLoading(false);
      setTimeout(() => setRestoreSuccess(false), 3000);
    }
  };

  const handleGetSystemHealth = async () => {
    setHealthLoading(true);
    setHealthStatus(null);
    setHealthError(null);
    try {
      const response = await api.getSystemHealth() as { status?: string } | null;
      if (response && typeof response.status === 'string') {
        setHealthStatus(response.status);
      } else {
        setHealthError('Invalid response from health endpoint');
      }
    } catch (err: any) {
      setHealthError(err?.message || 'Failed to get system health');
    } finally {
      setHealthLoading(false);
    }
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SuperAdminSetting[]>);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure system-wide settings and preferences</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedSettings).map(([category, categorySettings]) => (
          <Card key={category} className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground capitalize">{category} Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage {category} configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categorySettings.map((setting) => (
                <div key={setting.id} className="space-y-2">
                  <Label htmlFor={setting.id} className="text-muted-foreground capitalize">
                    {setting.setting_key.replace(/_/g, ' ')}
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id={setting.id}
                      defaultValue={setting.setting_value}
                      onBlur={(e) => {
                        if (e.target.value !== setting.setting_value) {
                          handleSave(setting.id, e.target.value);
                        }
                      }}
                      className="bg-background border-border"
                    />
                    {saving === setting.id && (
                      <Button disabled className="bg-accent/10 text-accent">
                        Saving...
                      </Button>
                    )}
                    {success === setting.id && (
                      <Button disabled className="bg-success/10 text-success">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Saved
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Two-factor for the master session. First, because it is the one
            control here that affects who can reach the console at all. */}
        <SuperAdminTwoFactor />

        {/* System Operations */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">System Operations</CardTitle>
            <CardDescription className="text-muted-foreground">
              Perform critical system operations like backup, restore, and health checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-muted-foreground">Trigger System Backup</Label>
              <Button
                onClick={handleTriggerBackup}
                disabled={backupLoading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {backupLoading ? 'Backing up...' : <><HardDriveUpload className="w-4 h-4 mr-2" /> Trigger Backup</>}
              </Button>
            </div>
            {backupSuccess && <p className="text-success text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Backup successful!</p>}
            {backupError && <p className="text-destructive text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {backupError}</p>}

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Restore from Backup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="backup-select" className="text-muted-foreground">Select a backup to restore</Label>
                  <select
                    id="backup-select"
                    aria-label="Select a backup to restore"
                    title="Select a backup to restore"
                    value={selectedBackup || ''}
                    onChange={(e) => setSelectedBackup(e.target.value)}
                    className="w-full p-2 rounded-md bg-background border-border text-foreground"
                  >
                    <option value="" disabled>Select a backup</option>
                    {backups.map((backup) => (
                      <option key={backup.name} value={backup.name}>
                        {backup.name} ({new Date(backup.createdAt).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleTriggerRestore} disabled={restoreLoading || !selectedBackup} className="mt-4 w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  {restoreLoading ? 'Restoring...' : <><HardDriveDownload className="w-4 h-4 mr-2" /> Restore Selected Backup</>}
                </Button>
                {restoreSuccess && <p className="mt-2 text-sm text-success flex items-center"><CheckCircle className="w-4 h-4 mr-2" />Restore successful!</p>}
                {restoreError && <p className="mt-2 text-sm text-destructive flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{restoreError}</p>}
              </CardContent>
            </Card>
            {restoreSuccess && <p className="text-success text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Restore successful!</p>}
            {restoreError && <p className="text-destructive text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {restoreError}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-muted-foreground">Check System Health</Label>
              <Button
                onClick={handleGetSystemHealth}
                disabled={healthLoading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {healthLoading ? 'Checking...' : <><HeartPulse className="w-4 h-4 mr-2" /> Check Health</>}
              </Button>
            </div>
            {healthStatus && <p className="text-success text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> System Health: {healthStatus}</p>}
            {healthError && <p className="text-destructive text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {healthError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
