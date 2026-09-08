import React, { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, do not show button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        id="pwa-install-button"
        variant="outline"
        size="sm"
        onClick={install}
        className="flex items-center gap-1.5 h-8 text-[11px] font-semibold border-accent/30 text-accent hover:bg-accent/10"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Install Clinical App</span>
      </Button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <Button
          id="pwa-ios-install-button"
          variant="outline"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 h-8 text-[11px] font-semibold border-accent/30 text-accent hover:bg-accent/10"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>iOS Workstation Setup</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-bold text-foreground">Add to Workstation Home Screen</h3>
                </div>
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed space-y-3">
                To run Smart Health in standalone mode with complete performance:
              </p>
              <div className="mt-3 space-y-2.5 text-xs text-foreground">
                <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border">
                  <span className="font-bold flex items-center justify-center h-5 w-5 rounded-full bg-accent/20 text-accent text-[10px]">1</span>
                  <span>Tap the standard <strong>Share</strong> button in the Safari toolbar.</span>
                </div>
                <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border">
                  <span className="font-bold flex items-center justify-center h-5 w-5 rounded-full bg-accent/20 text-accent text-[10px]">2</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
              </div>
              <Button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full text-xs font-semibold h-9"
              >
                Understood, Close
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
