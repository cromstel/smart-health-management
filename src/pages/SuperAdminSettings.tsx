import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, HardDriveUpload, HardDriveDownload, HeartPulse } from 'lucide-react';

interface Setting {
  id: string;
  setting_key: string;
  setting_value: string;
  category: string;
}

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
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
      const data = await api.getSystemSettings() as { settings: Setting[] };
      setSettings(data.settings);
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
      alert('Failed to update setting: ' + err.message);
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
      // expected shape from API
      const data = await api.getBackups() as { backups?: { name: string; createdAt: string }[] } | null;
      const backupList = data && Array.isArray(data.backups) ? data.backups : [];
      setBackups(backupList);
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
  }, {} as Record<string, Setting[]>);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure system-wide settings and preferences</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
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
                  <div className="flex gap-2">
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
                      <Button disabled className="bg-green-500/10 text-green-500">
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

        {/* System Operations */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">System Operations</CardTitle>
            <CardDescription className="text-muted-foreground">
              Perform critical system operations like backup, restore, and health checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Trigger System Backup</Label>
              <Button
                onClick={handleTriggerBackup}
                disabled={backupLoading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {backupLoading ? 'Backing up...' : <><HardDriveUpload className="w-4 h-4 mr-2" /> Trigger Backup</>}
              </Button>
            </div>
            {backupSuccess && <p className="text-green-500 text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Backup successful!</p>}
            {backupError && <p className="text-red-500 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {backupError}</p>}

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
                {restoreSuccess && <p className="mt-2 text-sm text-green-500 flex items-center"><CheckCircle className="w-4 h-4 mr-2" />Restore successful!</p>}
                {restoreError && <p className="mt-2 text-sm text-red-500 flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{restoreError}</p>}
              </CardContent>
            </Card>
            {restoreSuccess && <p className="text-green-500 text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Restore successful!</p>}
            {restoreError && <p className="text-red-500 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {restoreError}</p>}

            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Check System Health</Label>
              <Button
                onClick={handleGetSystemHealth}
                disabled={healthLoading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {healthLoading ? 'Checking...' : <><HeartPulse className="w-4 h-4 mr-2" /> Check Health</>}
              </Button>
            </div>
            {healthStatus && <p className="text-green-500 text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> System Health: {healthStatus}</p>}
            {healthError && <p className="text-red-500 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {healthError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
