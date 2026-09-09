import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Sparkles, Navigation, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface VoiceRouteCommand {
  phrases: string[];
  route: string;
  label: string;
}

const VOICE_COMMANDS: VoiceRouteCommand[] = [
  { phrases: ['go to patients', 'open patients', 'view patients', 'patients'], route: '/patients', label: 'Patients Directory' },
  { phrases: ['go to appointments', 'open appointments', 'view appointments', 'appointments'], route: '/appointments', label: 'Appointments Calendar' },
  { phrases: ['go to dashboard', 'open dashboard', 'dashboard', 'home', 'main menu'], route: '/dashboard', label: 'Main Dashboard' },
  { phrases: ['go to vitals', 'open vitals', 'patient vitals', 'vitals'], route: '/patients?tab=vitals', label: 'Patient Vitals' },
  { phrases: ['go to pharmacy', 'open pharmacy', 'pharmacy', 'medications'], route: '/pharmacy', label: 'Pharmacy & Dispensing' },
  { phrases: ['go to billing', 'open billing', 'billing', 'financials'], route: '/financial', label: 'Financials & Billing' },
  { phrases: ['go to settings', 'open settings', 'settings', 'system settings'], route: '/settings', label: 'System Settings' },
  { phrases: ['go to audit logs', 'open audit logs', 'audit logs', 'logs'], route: '/audit-logs', label: 'Audit Logs' },
  { phrases: ['go to staff', 'open staff', 'staff capacity', 'staff'], route: '/staff', label: 'Staff Capacity' },
  { phrases: ['go to ai assistant', 'open ai assistant', 'ai assistant'], route: '/ai-assistant', label: 'AI Clinical Assistant' },
  { phrases: ['go to documents', 'open documents', 'documents'], route: '/documents', label: 'Documents & Records' },
  { phrases: ['go to hospitals', 'open hospitals', 'hospitals'], route: '/hospitals', label: 'Hospitals Network' },
  { phrases: ['go to purchase orders', 'open purchase orders'], route: '/purchase-orders', label: 'Purchase Orders' },
];

export function VoiceNavigationButton() {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastMatchedCommand, setLastMatchedCommand] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const processPhrase = useCallback(
    (phrase: string) => {
      const cleanPhrase = phrase.toLowerCase().trim();
      let matched = false;

      for (const cmd of VOICE_COMMANDS) {
        for (const trigger of cmd.phrases) {
          if (cleanPhrase.includes(trigger)) {
            matched = true;
            setLastMatchedCommand(cmd.label);
            toast.success(`Voice Command Recognized: "${phrase}"`, {
              description: `Navigating to ${cmd.label}...`,
            });
            navigate(cmd.route);
            setPopoverOpen(false);
            break;
          }
        }
        if (matched) break;
      }

      if (!matched && cleanPhrase.length > 2) {
        toast.info(`Unrecognized phrase: "${phrase}". Try "Go to patients" or "Open appointments".`);
      }
    },
    [navigate]
  );

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Web Speech API is not supported in this browser. You can click command shortcuts below.');
      setPopoverOpen(true);
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            currentTranscript += result[0].transcript;
            if (result.isFinal) {
              processPhrase(result[0].transcript);
            }
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }

      recognitionRef.current.start();
      setIsListening(true);
      setPopoverOpen(true);
      toast.info('Voice Command Listener Active. Speak a command e.g., "Go to patients".');
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  }, [processPhrase]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  // Keyboard shortcut listener (Alt + V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleListening]);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          aria-label={isListening ? 'Stop Voice Command Listener' : 'Start Voice Command Listener'}
          className={`relative h-10 w-10 rounded-full transition-all ${
            isListening
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-400 dark:border-rose-700 animate-pulse'
              : 'hover:bg-secondary text-foreground'
          }`}
          title="Voice Command Navigation (Alt+V)"
        >
          {isListening ? (
            <Mic className="h-5 w-5 text-rose-600 dark:text-rose-400 animate-bounce" />
          ) : (
            <Mic className="h-5 w-5 text-muted-foreground" />
          )}
          {isListening && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-4 shadow-2xl border-rose-500/20">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${isListening ? 'bg-rose-500/10 text-rose-600' : 'bg-primary/10 text-primary'}`}>
                <Navigation className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Voice Command Listener
                  {isListening && <Badge variant="destructive" className="text-[10px] h-4 px-1.5 bg-rose-600">LISTENING</Badge>}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Speak to navigate instantly across hospital modules
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={isListening ? 'destructive' : 'default'}
              onClick={toggleListening}
              className="h-8 text-xs gap-1.5"
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Listen
                </>
              )}
            </Button>
          </div>

          {/* Transcript Box */}
          <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-semibold">
              <span className="flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-accent" />
                Live Voice Stream
              </span>
              <span className="font-mono text-slate-400">Shortcut: Alt+V</span>
            </div>
            <p className="text-foreground font-medium min-h-[2rem] flex items-center italic">
              {transcript ? `"${transcript}"` : isListening ? 'Listening for command... (e.g. "Go to patients")' : 'Click Listen or press Alt+V to start'}
            </p>
            {lastMatchedCommand && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1 border-t border-border/40">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>Matched: <strong>{lastMatchedCommand}</strong></span>
              </div>
            )}
          </div>

          {/* Available Commands Grid */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Quick Command Phrase Shortcuts:
            </span>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {VOICE_COMMANDS.slice(0, 8).map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => processPhrase(cmd.phrases[0])}
                  className="text-left p-1.5 rounded-md text-[11px] bg-background hover:bg-muted border border-border/60 transition-all flex flex-col justify-center"
                >
                  <span className="font-semibold text-foreground truncate">"{cmd.phrases[0]}"</span>
                  <span className="text-[10px] text-muted-foreground truncate">{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
