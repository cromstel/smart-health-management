import { useState } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';

export default function SuperAdminOperations() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const [backupLoading, setBackupLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      setMessage(null);
      const result = await api.triggerBackup() as any;
      setMessage({
        type: 'success',
        text: `Backup initiated successfully${result.backupPath || result.backupId ? `: ${result.backupPath || result.backupId}` : ''}`,
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to trigger backup',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) {
      setMessage({ type: 'error', text: 'Version is required' });
      return;
    }

    try {
      setUpgradeLoading(true);
      setMessage(null);
      await api.triggerUpgrade(version, description);
      setMessage({
        type: 'success',
        text: `System upgrade to version ${version} initiated successfully`,
      });
      setVersion('');
      setDescription('');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to trigger upgrade',
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Operations</h1>
        <p className="text-muted-foreground mt-1">Manage system backups and upgrades</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-start gap-2 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-foreground">System Backup</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Create a backup of the entire system
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">Backup Information</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Includes all database tables</li>
                <li>• Includes system configuration</li>
                <li>• Stored with timestamp</li>
                <li>• Can be used for restoration</li>
              </ul>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => {
                        if (!hasPermission('superadmin:edit')) {
                          logAction('permission_block', 'superadmin', { oldValue: 'backup' });
                          return;
                        }
                        handleBackup();
                      }}
                      disabled={backupLoading || !hasPermission('superadmin:edit')}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      {backupLoading ? (
                        'Creating Backup...'
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Trigger Backup
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasPermission('superadmin:edit') && (
                  <TooltipContent>
                    Requires permission: superadmin:edit
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Upgrade Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-foreground">System Upgrade</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Upgrade the system to a new version
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpgrade} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version" className="text-muted-foreground">
                  Version Number *
                </Label>
                <Input
                  id="version"
                  placeholder="e.g., 2.0.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-muted-foreground">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the changes in this upgrade..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="bg-background border-border"
                />
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="submit"
                        disabled={upgradeLoading || !hasPermission('superadmin:edit')}
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={(e) => {
                          if (!hasPermission('superadmin:edit')) {
                            e.preventDefault();
                            logAction('permission_block', 'superadmin', { oldValue: 'upgrade' });
                            return;
                          }
                        }}
                      >
                        {upgradeLoading ? (
                          'Initiating Upgrade...'
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Trigger Upgrade
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!hasPermission('superadmin:edit') && (
                    <TooltipContent>
                      Requires permission: superadmin:edit
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Warning Notice */}
      <Card className="bg-yellow-500/10 border-yellow-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-500 mb-1">Important Notice</h4>
              <p className="text-sm text-yellow-400/80">
                System operations like backups and upgrades may temporarily affect system performance.
                It's recommended to perform these operations during off-peak hours. Always ensure you
                have a recent backup before performing system upgrades.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
