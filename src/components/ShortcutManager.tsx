import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';
import { toast } from 'sonner';

export const ShortcutManager: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys when typing in input, textarea, or contenteditable fields
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        // Allow the escape key to blur the input
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      // 1. Help Cheat-sheet trigger: "?" key (Shift + /) or "Ctrl + /"
      if (e.key === '?' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // 2. Navigation Shortcuts: Ctrl+Key or Alt+Key or Ctrl+Alt+Key
      const isModifier = e.ctrlKey || e.altKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'd': // Dashboard
          e.preventDefault();
          navigate('/dashboard');
          toast.info('Navigation: Dashboard Workspace', { id: 'nav-shortcut' });
          break;
        case 'p': // Patients List
          e.preventDefault();
          navigate('/patients');
          toast.info('Navigation: Patients Registry', { id: 'nav-shortcut' });
          break;
        case 'a': // AI Clinical Copilot
          e.preventDefault();
          navigate('/ai-assistant');
          toast.info('Navigation: AI Assistant Portal', { id: 'nav-shortcut' });
          break;
        case 'm': // Pharmacy Inventory & Tracking
          e.preventDefault();
          navigate('/pharmacy');
          toast.info('Navigation: Pharmacy & Med Tracker', { id: 'nav-shortcut' });
          break;
        case 'q': // Appointments Calendar
          e.preventDefault();
          navigate('/appointments');
          toast.info('Navigation: Appointments Schedule', { id: 'nav-shortcut' });
          break;
        case 's': // Configuration Settings
          e.preventDefault();
          navigate('/settings');
          toast.info('Navigation: System Settings', { id: 'nav-shortcut' });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  return (
    <>
      {/* Floating Shortcut Trigger Button in lower right for discoverability */}
      <button
        id="shortcuts-cheatsheet-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-9 items-center gap-1.5 rounded-full bg-slate-900 border border-slate-700 px-3 text-[11px] font-bold text-white shadow-xl hover:bg-slate-850 hover:border-slate-500 transition-all no-print"
        title="Show global keyboard shortcuts (?)"
      >
        <Keyboard className="h-4 w-4 text-accent animate-pulse" />
        <span>Hotkeys</span>
      </button>

      {/* Elegant Keyboard Cheat-sheet Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl rounded-2xl no-print">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Keyboard className="h-5 w-5 text-accent" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Clinical Keyboard Shortcuts</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Accelerate clinical navigation & charts</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Dashboard</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+D / Alt+D</kbd>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Patients Registry</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+P / Alt+P</kbd>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">AI Assistant</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+A / Alt+A</kbd>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Pharmacy</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+M / Alt+M</kbd>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Appointments</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+Q / Alt+Q</kbd>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-muted-foreground">Settings Panel</span>
                <kbd className="px-2 py-1 text-[10px] font-bold bg-muted border border-border shadow-sm rounded-lg text-foreground">Ctrl+S / Alt+S</kbd>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border p-3.5 bg-muted/20 text-center">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Global Help</span>
              <p className="text-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 font-bold bg-muted border rounded-md text-foreground">?</kbd> at any time from any screen to reveal this workspace documentation menu.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
