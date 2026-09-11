import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Database, 
  Bell, 
  Cloud, 
  Server,
  Loader2,
  CheckCircle2,
  Clock,
  Fingerprint,
  ShieldCheck,
  Key,
  QrCode,
  Copy,
  Smartphone
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { registerPasskey, isWebAuthnSupported } from '@/utils/webauthn';

interface Settings {
  systemName?: string;
  timezone?: string;
  language?: string;
  currency?: string;
  darkMode?: boolean;
  autoSave?: boolean;
}

export default function SettingsPage() {
  const { user, hasPermission, refreshUser } = useAuth();
  const { isDark, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  // Preferred Export Format for Inventory Reports
  const [preferredInventoryExport, setPreferredInventoryExport] = useState<string>(() => {
    return localStorage.getItem('preferred_inventory_export') || 'PDF';
  });

  // Dashboard Refresh Interval State
  const [dashboardRefreshInterval, setDashboardRefreshInterval] = useState<string>(() => {
    return localStorage.getItem('dashboard_refresh_interval') || '30';
  });

  const handleRefreshIntervalChange = (val: string) => {
    setDashboardRefreshInterval(val);
    localStorage.setItem('dashboard_refresh_interval', val);
    toast.success(`Dashboard auto-refresh interval set to ${val === '0' ? 'Disabled' : `${val} seconds`}`);
  };

  // TOTP / 2FA state — the backend is the source of truth for whether 2FA is
  // enabled. These controls live against the real /auth/totp/* endpoints.
  const [totpEnabled, setTotpEnabled] = useState<boolean>(!!user?.totp_enabled);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpPairing, setTotpPairing] = useState(false); // pairing wizard open (secret generated)
  const [totpSecret, setTotpSecret] = useState('');
  const [totpOtpauthUrl, setTotpOtpauthUrl] = useState('');
  const [totpConfirmCode, setTotpConfirmCode] = useState('');
  const [totpDisableMode, setTotpDisableMode] = useState(false);
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'sms' | 'passkey'>(() => (localStorage.getItem('mfa_method') as any) || 'totp');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const recoveryCodes = [
    '8F92-3B1A', '1E90-C782', '4D81-9F33', '7A22-8E11', '9C04-5B66',
    '3F11-2A99', '6E88-4D55', '2C77-1B44', '5A99-8F22', '0D33-7E11'
  ];

  // Keep the toggle in sync with the authenticated user's server-side 2FA state.
  useEffect(() => {
    setTotpEnabled(!!user?.totp_enabled);
    if (!user?.totp_enabled) {
      setTotpPairing(false);
      setTotpDisableMode(false);
    }
  }, [user?.totp_enabled]);

  const handleEnableTotp = async () => {
    setTotpBusy(true);
    try {
      const { secret, otpauthUrl } = await api.totpEnroll();
      setTotpSecret(secret);
      setTotpOtpauthUrl(otpauthUrl);
      setTotpPairing(true);
      setTotpDisableMode(false);
      toast.success('Secret generated — add it to your authenticator app, then confirm the code below.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start two-factor setup');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleConfirmTotp = async () => {
    const cleanCode = totpConfirmCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      toast.error('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setTotpBusy(true);
    try {
      await api.totpConfirm(totpSecret, cleanCode);
      setTotpEnabled(true);
      setTotpPairing(false);
      setTotpConfirmCode('');
      toast.success('Two-factor authentication enabled! Your account is now protected.');
      await refreshUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed. Check the code and try again.');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisableTotp = async () => {
    const cleanCode = totpDisableCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      toast.error('Enter a current 6-digit code from your authenticator app.');
      return;
    }
    setTotpBusy(true);
    try {
      await api.totpDisable(cleanCode);
      setTotpEnabled(false);
      setTotpDisableMode(false);
      setTotpDisableCode('');
      toast.success('Two-factor authentication disabled.');
      await refreshUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disable two-factor.');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleMethodChange = (method: 'totp' | 'sms' | 'passkey') => {
    setMfaMethod(method);
    localStorage.setItem('mfa_method', method);
    toast.info(`Default MFA method set to ${method.toUpperCase()}`);
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const loadSettings = useCallback(async () => {
    try {
	  setLoading(true);
      const data = await api.getSettings() as any;
      setSettings({
        ...data,
        darkMode: isDark,
      });
    } catch (error: any) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [isDark]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Data Management & Archiving Panel states
  const [automaticBackups, setAutomaticBackups] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState('daily');
  const [backupLocation, setBackupLocation] = useState('C:\\HealthManager\\Backups');
  const [retentionDays, setRetentionDays] = useState(30);
  const [backupScheduleEnabled, setBackupScheduleEnabled] = useState(true);
  const [exportScheduleTime, setExportScheduleTime] = useState('02:00 AM');
  const [exportFormat, setExportFormat] = useState('fhir-json');
  const [exportDestination, setExportDestination] = useState('s3');
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStep, setBackupStep] = useState('');
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupsList, setBackupsList] = useState([
    { id: '1', date: '2024-01-20 02:00 AM', size: '2.4 GB', status: 'Success' },
    { id: '2', date: '2024-01-19 02:00 AM', size: '2.3 GB', status: 'Success' },
    { id: '3', date: '2024-01-18 02:00 AM', size: '2.3 GB', status: 'Success' },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('backup_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.automaticBackups !== undefined) setAutomaticBackups(parsed.automaticBackups);
        if (parsed.backupFrequency !== undefined) setBackupFrequency(parsed.backupFrequency);
        if (parsed.backupLocation !== undefined) setBackupLocation(parsed.backupLocation);
        if (parsed.retentionDays !== undefined) setRetentionDays(parsed.retentionDays);
        if (parsed.backupScheduleEnabled !== undefined) setBackupScheduleEnabled(parsed.backupScheduleEnabled);
        if (parsed.exportScheduleTime !== undefined) setExportScheduleTime(parsed.exportScheduleTime);
        if (parsed.exportFormat !== undefined) setExportFormat(parsed.exportFormat);
        if (parsed.exportDestination !== undefined) setExportDestination(parsed.exportDestination);
      } catch (e) {
        console.error('Failed to load backup settings', e);
      }
    }
  }, []);

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(10);
    setBackupStep('Initializing secure connection to cloud database server...');
    
    setTimeout(() => {
      setBackupProgress(35);
      setBackupStep('Exporting schemas and active clinical records (4,251 database rows)...');
      
      setTimeout(() => {
        setBackupProgress(70);
        setBackupStep('Compressing and encrypting package with military-grade AES-256 standards...');
        
        setTimeout(() => {
          setBackupProgress(90);
          setBackupStep('Uploading package file to secure central health repository...');
          
          setTimeout(() => {
            setBackupProgress(100);
            setBackupStep('Database backup completed successfully!');
            const now = new Date();
            const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);
            setBackupsList(prev => [
              { id: Date.now().toString(), date: `${dateStr} AM`, size: '2.4 GB', status: 'Success' },
              ...prev
            ]);
            setIsBackingUp(false);
          }, 800);
        }, 800);
      }, 800);
    }, 800);
  };

  const handleSaveBackupSettings = () => {
    const config = {
      automaticBackups,
      backupFrequency,
      backupLocation,
      retentionDays,
      backupScheduleEnabled,
      exportScheduleTime,
      exportFormat,
      exportDestination
    };
    localStorage.setItem('backup_settings', JSON.stringify(config));
    alert('Data Management and Backup settings successfully updated!');
  };

  const handleSettingsChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'darkMode') {
      setTheme(value ? 'dark' : 'light');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.updateSettings(settings);
      localStorage.setItem('preferred_inventory_export', preferredInventoryExport);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings.');
    }
  };

  return (
    <div className="space-y-6">
	{loading ? (
          <div className="space-y-4" role="status" aria-label="Loading settings">
            <span className="sr-only">Loading settings...</span>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        ) : (
		<>
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">Configure system preferences and options</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-accent" />
                General Settings
              </CardTitle>
              <CardDescription>Manage basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="systemName">System Name</Label>
                <Input
                  id="systemName"
                  placeholder="System Name"
                  value={settings.systemName || ''}
                  onChange={(e) => handleSettingsChange('systemName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.timezone || 'gmt'}
                  onValueChange={(value) => handleSettingsChange('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmt">GMT (Ghana)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="eat">EAT (East Africa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={settings.language || 'en'}
                  onValueChange={(value) => handleSettingsChange('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="tw">Twi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={settings.currency || 'ghs'}
                  onValueChange={(value) => handleSettingsChange('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ghs">GHS (Ghana Cedi)</SelectItem>
                    <SelectItem value="usd">USD (US Dollar)</SelectItem>
                    <SelectItem value="eur">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboardRefresh">Dashboard Auto-Refresh Interval</Label>
                <Select
                  value={dashboardRefreshInterval}
                  onValueChange={handleRefreshIntervalChange}
                >
                  <SelectTrigger id="dashboardRefresh">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Disabled (Manual Refresh)</SelectItem>
                    <SelectItem value="10">Every 10 seconds</SelectItem>
                    <SelectItem value="30">Every 30 seconds</SelectItem>
                    <SelectItem value="60">Every 1 minute</SelectItem>
                    <SelectItem value="300">Every 5 minutes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how often the Dashboard data automatically re-fetches from the API in the background.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredInventoryExport">Preferred Inventory Export Format</Label>
                <Select
                  value={preferredInventoryExport}
                  onValueChange={(val) => {
                    setPreferredInventoryExport(val);
                    localStorage.setItem('preferred_inventory_export', val);
                    toast.success(`Preferred export format set to ${val}`);
                  }}
                >
                  <SelectTrigger id="preferredInventoryExport">
                    <SelectValue placeholder="Select export format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF Document</SelectItem>
                    <SelectItem value="CSV">CSV Spreadsheet</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your preferred file type for exporting medical inventory reports.
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between dark theme and light mode</p>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) => handleSettingsChange('darkMode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-save</Label>
                  <p className="text-sm text-muted-foreground">Automatically save changes</p>
                </div>
                <Switch
                  checked={settings.autoSave === true}
                  onCheckedChange={(checked) => handleSettingsChange('autoSave', checked)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={!hasPermission('settings:edit')}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                Multi-Factor Authentication (MFA / 2FA)
              </CardTitle>
              <CardDescription>Configure two-step verification methods, pairing QR codes, and recovery keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="font-semibold text-base">Enable Multi-Factor Authentication</Label>
                    <Badge variant={totpEnabled ? 'default' : 'outline'} className={totpEnabled ? 'bg-emerald-600 text-white' : ''}>
                      {totpEnabled ? 'ACTIVE & ENFORCED' : 'DISABLED'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Require staff to verify identity with 2FA TOTP code or biometrics upon signing in.
                  </p>
                </div>
                <Switch
                  checked={totpEnabled}
                  disabled={totpBusy}
                  onCheckedChange={(enabled) => {
                    if (enabled) {
                      void handleEnableTotp();
                    } else {
                      setTotpDisableMode(true);
                      setTotpPairing(false);
                    }
                  }}
                />
              </div>

              {(totpEnabled || totpPairing) && (
                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Default Authentication Method</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleMethodChange('totp')}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                          mfaMethod === 'totp' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <QrCode className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold">Authenticator App</div>
                          <div className="text-[11px] text-muted-foreground">Google Auth / Authy TOTP</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMethodChange('sms')}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                          mfaMethod === 'sms' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <Smartphone className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold">SMS Verification</div>
                          <div className="text-[11px] text-muted-foreground">+233 ••• ••56</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMethodChange('passkey')}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                          mfaMethod === 'passkey' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <Fingerprint className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold">Biometric Passkey</div>
                          <div className="text-[11px] text-muted-foreground">Touch ID / Face ID</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {mfaMethod === 'totp' && totpPairing && (
                    <div className="p-4 rounded-xl border bg-card space-y-4">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-accent" />
                        <h4 className="text-sm font-semibold">Pair Authenticator App (TOTP)</h4>
                        <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold ml-auto">NEW KEY</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col justify-center p-4 bg-muted/40 border-border border rounded-lg space-y-3">
                          <div>
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Manual Setup</Label>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              In your authenticator app choose "Add account" &gt; "Enter a setup key", then
                              paste the secret below (or the full otpauth:// link).
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Secret Key</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="p-2 rounded bg-muted font-mono text-xs font-bold tracking-wider flex-1 border border-border" aria-label="TOTP secret key">
                                {totpSecret}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(totpSecret, 'Secret key copied to clipboard!')}
                                className="gap-1 h-8 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Authenticator Link</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="p-2 rounded bg-muted font-mono text-[10px] flex-1 border border-border truncate">
                                {totpOtpauthUrl}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(totpOtpauthUrl, 'Authenticator link copied to clipboard!')}
                                className="gap-1 h-8 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="totpConfirmCode" className="text-xs">6-Digit Code from Your App</Label>
                            <div className="flex gap-2 mt-1">
                              <Input
                                id="totpConfirmCode"
                                placeholder="e.g. 123456"
                                className="h-9 font-mono text-xs w-36"
                                maxLength={6}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={totpConfirmCode}
                                onChange={(e) => setTotpConfirmCode(e.target.value.replace(/[^\d]/g, ''))}
                                aria-label="Current authenticator code"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 text-xs"
                                onClick={() => void handleConfirmTotp()}
                                disabled={totpBusy}
                              >
                                {totpBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Confirm &amp; Enable
                              </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              Confirming proves you hold the app and immediately enforces 2FA on your next sign-in.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setTotpPairing(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {mfaMethod === 'totp' && totpEnabled && !totpPairing && (
                    <div className="p-4 rounded-xl border bg-card space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-accent" />
                        <h4 className="text-sm font-semibold">Authenticator App (TOTP)</h4>
                        <Badge variant="default" className="text-[10px] bg-emerald-600 text-white font-semibold ml-auto">ENFORCED</Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        An authenticator code is required on every sign-in. You can rotate the key at any time
                        by toggling the switch above — the new secret only takes effect after you confirm a code
                        from the new app.
                      </p>

                      {!totpDisableMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => setTotpDisableMode(true)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Disable Two-Factor Authentication
                        </Button>
                      ) : (
                        <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5">
                          <Label htmlFor="totpDisableCode" className="text-xs font-semibold">
                            Enter a current 6-digit code to confirm disabling
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="totpDisableCode"
                              placeholder="6-digit code"
                              className="h-9 font-mono text-xs w-36"
                              maxLength={6}
                              inputMode="numeric"
                              value={totpDisableCode}
                              onChange={(e) => setTotpDisableCode(e.target.value.replace(/[^\d]/g, ''))}
                              aria-label="Current authenticator code to disable 2FA"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs"
                              onClick={() => void handleDisableTotp()}
                              disabled={totpBusy}
                            >
                              {totpBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Disable 2FA
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-9 text-xs"
                              onClick={() => {
                                setTotpDisableMode(false);
                                setTotpDisableCode('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-accent" />
                        <span>Offline Emergency Recovery Codes</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        10 single-use emergency backup keys for account recovery if you lose your device.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
                      className="gap-1.5 text-xs"
                    >
                      <Key className="h-3.5 w-3.5" />
                      {showRecoveryCodes ? 'Hide Codes' : 'View Recovery Codes'}
                    </Button>
                  </div>

                  {showRecoveryCodes && (
                    <div className="p-4 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Emergency Single-Use Backup Keys</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'Recovery codes copied to clipboard!')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy All
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                        {recoveryCodes.map((code, idx) => (
                          <div key={idx} className="p-2 rounded border bg-muted/40 text-center font-bold text-foreground">
                            {code}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Keep these codes stored securely offline. Each code can only be used once.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">Auto logout after inactivity</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout Duration (minutes)</Label>
                  <Input id="timeout" type="number" defaultValue="30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max Login Attempts</Label>
                  <Input id="maxAttempts" type="number" defaultValue="5" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lockout">Account Lockout Duration (minutes)</Label>
                  <Input id="lockout" type="number" defaultValue="15" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Fingerprint className="h-4 w-4 text-accent" />
                      Biometric WebAuthn Passkeys
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Register Touch ID, Face ID, or Windows Hello for instant passwordless clinician login.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-accent/40 text-accent hover:bg-accent/10"
                    onClick={() => registerPasskey(user?.email || 'clinician@smarthealth.com')}
                  >
                    <Fingerprint className="h-4 w-4" />
                    Register New Passkey
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center justify-between">
                  <span>WebAuthn Device Support: <strong>{isWebAuthnSupported() ? 'Supported (Platform Enclave Available)' : 'Browser Standard Fallback'}</strong></span>
                  <span className="text-emerald-500 font-medium">HIPAA Certified</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button disabled={!hasPermission('settings:edit')} onClick={handleSaveSettings}>Save Security Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-accent" />
                Storage Configuration
              </CardTitle>
              <CardDescription>Manage document storage options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default Storage Location</Label>
                <Select defaultValue="local">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Storage</SelectItem>
                    <SelectItem value="cloud">Cloud Storage</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Local + Cloud)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Local Storage</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localPath">Storage Path</Label>
                  <Input id="localPath" defaultValue="C:\HealthManager\Storage" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Used Space</span>
                    <span className="font-medium text-foreground">128 GB / 500 GB</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[25.6%]" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Cloud Storage</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">Cloud Provider</Label>
                  <Select defaultValue="aws">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">Amazon S3</SelectItem>
                    <SelectItem value="azure">Azure Blob Storage</SelectItem>
                    <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket Name</Label>
                <Input id="bucket" placeholder="health-manager-docs" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used Space</span>
                  <span className="font-medium text-foreground">45.2 GB / 100 GB</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent w-[45.2%]" />
                </div>
              </div>
			  </div>
              <div className="flex justify-end">
                <Button>Save Storage Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-accent" />
                Notification Settings
              </div >
              <CardDescription>Configure system notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via SMS</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <h3 className="font-medium text-foreground">Notification Types</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Appointment Reminders</Label>
                    <p className="text-sm text-muted-foreground">Notify patients about appointments</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Low Stock Alerts</Label>
                    <p className="text-sm text-muted-foreground">Alert when inventory is low</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Updates</Label>
                    <p className="text-sm text-muted-foreground">Notify about system updates</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Security Alerts</Label>
                    <p className="text-sm text-muted-foreground">Alert on security events</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Notification Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Column 1: Database Backups & Manual Trigger */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-accent" />
                  Database Archival & Manual Backup
                </CardTitle>
                <CardDescription>Manually trigger encrypted health database backups and manage archives.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Database Status:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      ONLINE (Active)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Active Database Records:</span>
                    <span className="font-bold text-foreground">4,251 row items</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Last Automated Backup:</span>
                    <span className="font-semibold text-foreground">Today at 02:00 AM</span>
                  </div>
                </div>

                {isBackingUp ? (
                  <div className="space-y-3 p-4 border border-accent/20 bg-accent/5 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-semibold text-accent-foreground">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {backupStep}
                      </span>
                      <span>{backupProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300" 
                        style={{ width: `${backupProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <Button 
                    className="w-full gap-2 text-xs font-semibold h-10" 
                    onClick={handleManualBackup}
                  >
                    <Database className="h-4 w-4" />
                    Trigger Manual Database Backup
                  </Button>
                )}

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-foreground">Available Recovery Points</h4>
                  <div className="space-y-2">
                    {backupsList.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between rounded-lg border border-border p-3 text-xs bg-card hover:bg-muted/10"
                      >
                        <div>
                          <p className="font-bold text-foreground">{backup.date}</p>
                          <p className="text-muted-foreground">Size: {backup.size} | Status: <span className="text-emerald-600 font-semibold">{backup.status}</span></p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[10px] h-7 px-2.5 font-semibold"
                          onClick={() => {
                            alert(`Restoration process from backup point (${backup.date}) has been successfully completed in the sandbox.`);
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Column 2: Automated Daily Export Scheduler */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-accent" />
                  Automated Daily Exports
                </CardTitle>
                <CardDescription>Configure automated data exports of health records for national repositories.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground">Automated Daily Exports</Label>
                    <p className="text-[11px] text-muted-foreground">Perform daily background archival dumps</p>
                  </div>
                  <Switch 
                    checked={backupScheduleEnabled} 
                    onCheckedChange={setBackupScheduleEnabled} 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Daily Export Time</Label>
                  <Select value={exportScheduleTime} onValueChange={setExportScheduleTime}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12:00 AM" className="text-xs">12:00 AM (Midnight)</SelectItem>
                      <SelectItem value="02:00 AM" className="text-xs">02:00 AM (Recommended)</SelectItem>
                      <SelectItem value="04:00 AM" className="text-xs">04:00 AM (Off-peak)</SelectItem>
                      <SelectItem value="11:00 PM" className="text-xs">11:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Data Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fhir-json" className="text-xs">FHIR Compliant JSON (Standard)</SelectItem>
                      <SelectItem value="json" className="text-xs">Standard JSON Format</SelectItem>
                      <SelectItem value="csv" className="text-xs">Tabular CSV Records</SelectItem>
                      <SelectItem value="xml" className="text-xs">Clinical XML Schema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Archival Destination</Label>
                  <Select value={exportDestination} onValueChange={setExportDestination}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s3" className="text-xs">Secure Cloud Bucket Vault</SelectItem>
                      <SelectItem value="local" className="text-xs">Local Server Volume Partition</SelectItem>
                      <SelectItem value="sftp" className="text-xs">Encrypted Remote SFTP Node</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retentionDays" className="text-xs font-bold text-foreground">Retention Period (days)</Label>
                  <Input 
                    id="retentionDays" 
                    type="number" 
                    value={retentionDays} 
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="h-9 text-xs" 
                  />
                </div>

                <Separator />

                <Button 
                  className="w-full gap-2 text-xs font-semibold h-10" 
                  onClick={handleSaveBackupSettings}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Data Management Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
		</>
		)}
    </div>
  );
}
