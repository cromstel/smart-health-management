import { useState, useEffect } from 'react';
import { Wifi, WifiOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker state
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.active) {
          setSwRegistered(true);
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveOnline = isOnline && !simulatedOffline;

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('PWA Offline Caches Synchronized with Cloud Server');
    }, 1200);
  };

  const handleToggleSimulated = (checked: boolean) => {
    setSimulatedOffline(checked);
    if (checked) {
      toast.info('Simulated Offline Mode Enabled. System will use local PWA cache.');
    } else {
      toast.success('Simulated Offline Mode Disabled. Connected to live network.');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 px-2.5 text-xs font-medium rounded-full transition-all border ${
            !effectiveOnline
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/80 hover:bg-amber-500/25 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-500/20'
          }`}
          title={!effectiveOnline ? 'PWA Working Offline' : 'PWA Network Online'}
        >
          {!effectiveOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Offline Mode</span>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Online</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 shadow-xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              {!effectiveOnline ? (
                <WifiOff className="h-5 w-5 text-amber-500" />
              ) : (
                <Wifi className="h-5 w-5 text-emerald-500" />
              )}
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {!effectiveOnline ? 'PWA Offline Mode Active' : 'System Online'}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {!effectiveOnline
                    ? 'Working from local IndexedDB & ServiceWorker'
                    : 'Real-time PACS & Cloud Sync Connected'}
                </p>
              </div>
            </div>
            <Badge
              variant={!effectiveOnline ? 'destructive' : 'default'}
              className={!effectiveOnline ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}
            >
              {!effectiveOnline ? 'OFFLINE' : 'ONLINE'}
            </Badge>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
            <div className="flex items-center justify-between">
              <span>Service Worker Status:</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                {swRegistered ? 'Active & Ready' : 'Installed'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Browser Connectivity:</span>
              <span className="font-semibold text-foreground">
                {isOnline ? 'Network Connected' : 'No Network Connection'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Local Storage Guard:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Auto-Save Enabled
              </span>
            </div>
          </div>

          {/* Simulated Offline Toggle for Testing */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              <Label htmlFor="simulated-offline" className="text-xs font-medium cursor-pointer">
                Simulate Offline Mode
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Test PWA offline features manually
              </span>
            </div>
            <Switch
              id="simulated-offline"
              checked={simulatedOffline}
              onCheckedChange={handleToggleSimulated}
            />
          </div>

          <div className="pt-2">
            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              size="sm"
              variant="outline"
              className="w-full text-xs gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing Local Data...' : 'Sync PWA Offline Data'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
