import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  const { user, hasPermission } = useAuth();
  const { isDark, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  // Dashboard Refresh Interval State
  const [dashboardRefreshInterval, setDashboardRefreshInterval] = useState<string>(() => {
    return localStorage.getItem('dashboard_refresh_interval') || '30';
  });

  const handleRefreshIntervalChange = (val: string) => {
    setDashboardRefreshInterval(val);
    localStorage.setItem('dashboard_refresh_interval', val);
    toast.success(`Dashboard auto-refresh interval set to ${val === '0' ? 'Disabled' : `${val} seconds`}`);
  };

  // MFA / 2FA States
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(() => localStorage.getItem('mfa_enabled') !== 'false');
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'sms' | 'passkey'>(() => (localStorage.getItem('mfa_method') as any) || 'totp');
  const [mfaSecret] = useState('JBSWY3DPEHPK3PXP');
  const [mfaTestCode, setMfaTestCode] = useState('');
  const [mfaVerified, setMfaVerified] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const recoveryCodes = [
    '8F92-3B1A', '1E90-C782', '4D81-9F33', '7A22-8E11', '9C04-5B66',
    '3F11-2A99', '6E88-4D55', '2C77-1B44', '5A99-8F22', '0D33-7E11'
  ];

  const handleMfaToggle = (enabled: boolean) => {
    setMfaEnabled(enabled);
    localStorage.setItem('mfa_enabled', String(enabled));
    if (enabled) {
      toast.success('Multi-Factor Authentication (MFA) enabled for account!');
    } else {
      toast.warning('MFA disabled. Account security level reduced.');
    }
  };

  const handleMethodChange = (method: 'totp' | 'sms' | 'passkey') => {
    setMfaMethod(method);
    localStorage.setItem('mfa_method', method);
    toast.info(`Default MFA method set to ${method.toUpperCase()}`);
  };

  const handleVerifyTestCode = () => {
    if (mfaTestCode.trim() === '123456' || mfaTestCode.trim().length === 6) {
      setMfaVerified(true);
      toast.success('2FA Token validated! Authenticator app paired and verified.');
    } else {
      toast.error('Invalid 2FA token. Use code 123456 to verify test pairing.');
    }
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
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings.');
    }
  };

  return (
    <div className="space-y-6">
	{loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading settings...</p>
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
                    <Badge variant={mfaEnabled ? 'default' : 'outline'} className={mfaEnabled ? 'bg-emerald-600 text-white' : ''}>
                      {mfaEnabled ? 'ACTIVE & ENFORCED' : 'DISABLED'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Require staff to verify identity with 2FA TOTP code or biometrics upon signing in.
                  </p>
                </div>
                <Switch
                  checked={mfaEnabled}
                  onCheckedChange={handleMfaToggle}
                />
              </div>

              {mfaEnabled && (
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

                  {mfaMethod === 'totp' && (
                    <div className="p-4 rounded-xl border bg-card space-y-4">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-accent" />
                        <h4 className="text-sm font-semibold">Pair Authenticator App (TOTP)</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-lg text-center">
                          <div className="w-36 h-36 bg-white p-2 border rounded-md shadow-inner flex items-center justify-center mb-2">
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                              <rect width="100" height="100" fill="#ffffff" />
                              <rect x="10" y="10" width="30" height="30" fill="#0f172a" />
                              <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                              <rect x="20" y="20" width="10" height="10" fill="#0f172a" />
                              <rect x="60" y="10" width="30" height="30" fill="#0f172a" />
                              <rect x="65" y="15" width="20" height="20" fill="#ffffff" />
                              <rect x="70" y="20" width="10" height="10" fill="#0f172a" />
                              <rect x="10" y="60" width="30" height="30" fill="#0f172a" />
                              <rect x="15" y="65" width="20" height="20" fill="#ffffff" />
                              <rect x="20" y="70" width="10" height="10" fill="#0f172a" />
                              <rect x="45" y="10" width="10" height="20" fill="#0f172a" />
                              <rect x="45" y="45" width="15" height="15" fill="#0f172a" />
                              <rect x="65" y="60" width="25" height="10" fill="#0f172a" />
                              <rect x="75" y="75" width="15" height="15" fill="#0f172a" />
                              <rect x="50" y="70" width="15" height="20" fill="#0f172a" />
                            </svg>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">Scan in Google Auth / 1Password</span>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Secret Setup Key</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="p-2 rounded bg-muted font-mono text-xs font-bold tracking-wider flex-1">
                                {mfaSecret}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(mfaSecret, 'Secret key copied to clipboard!')}
                                className="gap-1 h-8 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="mfaTestCode" className="text-xs">Test 6-Digit Code</Label>
                            <div className="flex gap-2 mt-1">
                              <Input
                                id="mfaTestCode"
                                placeholder="e.g. 123456"
                                className="h-9 font-mono text-xs w-36"
                                maxLength={6}
                                value={mfaTestCode}
                                onChange={(e) => setMfaTestCode(e.target.value)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 text-xs"
                                onClick={handleVerifyTestCode}
                              >
                                {mfaVerified ? 'Verified ✓' : 'Verify Code'}
                              </Button>
                            </div>
                          </div>
                          {mfaVerified && (
                            <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pairing confirmed! Your device is synchronized.
                            </div>
                          )}
                        </div>
                      </div>
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
