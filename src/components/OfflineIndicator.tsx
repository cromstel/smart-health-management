import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div 
      id="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-4 py-3 text-xs font-semibold text-white shadow-xl border border-amber-500 animate-bounce"
    >
      <WifiOff className="h-4.5 w-4.5 text-white animate-pulse" />
      <div className="flex flex-col">
        <span>Offline Mode Enabled</span>
        <span className="text-[10px] text-amber-100 font-normal">Working from local clinical caches</span>
      </div>
    </div>
  );
};
