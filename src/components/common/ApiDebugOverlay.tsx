import { useState, useEffect } from 'react';
import { getApiMetrics } from '@/lib/api';
import { ShieldAlert, CheckCircle2, X, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ApiDebugOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState(getApiMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getApiMetrics());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut Ctrl+Shift+D to toggle debug overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 text-xs font-mono px-3 py-1.5 rounded-full shadow-lg border border-zinc-700 flex items-center gap-2 transition-all"
        title="Toggle API Telemetry (Ctrl+Shift+D)"
        id="api-debug-trigger"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>API: {metrics.avgLatency}ms ({metrics.errorRate}% err)</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-zinc-950 text-zinc-100 rounded-xl shadow-2xl border border-zinc-800 p-4 font-mono text-xs" id="api-debug-overlay">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
        <div className="flex items-center gap-2 font-semibold">
          <Terminal className="h-4 w-4 text-primary" />
          <span>API Telemetry & Monitor</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100"
          id="close-api-debug"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/80">
          <div className="text-zinc-400 text-[10px] uppercase">Requests</div>
          <div className="text-base font-bold mt-0.5 text-zinc-100">{metrics.totalRequests}</div>
        </div>
        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/80">
          <div className="text-zinc-400 text-[10px] uppercase">Avg Latency</div>
          <div className="text-base font-bold mt-0.5 text-primary">{metrics.avgLatency}ms</div>
        </div>
        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/80">
          <div className="text-zinc-400 text-[10px] uppercase">Error Rate</div>
          <div className={`text-base font-bold mt-0.5 ${metrics.errorRate > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
            {metrics.errorRate}%
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase">Recent API Requests</div>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {metrics.recentLogs.length === 0 ? (
            <div className="text-zinc-500 py-4 text-center">No API calls recorded yet.</div>
          ) : (
            metrics.recentLogs.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between bg-zinc-900/60 px-2.5 py-1.5 rounded border border-zinc-800/50">
                <div className="flex items-center gap-2 truncate">
                  {log.success ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className="truncate text-zinc-300">{log.endpoint}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-zinc-400">
                  <span>{log.duration}ms</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
