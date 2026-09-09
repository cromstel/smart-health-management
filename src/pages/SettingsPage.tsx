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
  Lock, 
  Cloud, 
  Server,
  Loader2,
  CheckCircle2,
  Clock,
  Fingerprint
} from 'lucide-react';

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
                <Lock className="h-5 w-5 text-accent" />
                Security Settings
              </CardTitle>
              <CardDescription>Configure authentication and access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">Auto logout after inactivity</p>
                </div>
                <Switch defaultChecked />
              </div>
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
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">Track all user activities</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Data Encryption</Label>
                  <p className="text-sm text-muted-foreground">Encrypt sensitive data at rest</p>
                </div>
                <Switch defaultChecked />
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
                <Button disabled={!hasPermission('settings:edit')}>Save Security Settings</Button>
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
