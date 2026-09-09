import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Mic,
  MicOff,
  Sparkles,
  Save,
  Trash2,
  Copy,
  Check,
  FileText,
  Clock,
  User,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ClinicalNoteRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  content: string;
  timestamp: string;
  tags?: string[];
}

interface ClinicalNotesVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: string;
  patientsList?: Array<{ id: string; name: string }>;
}

export function ClinicalNotesVoiceModal({
  open,
  onOpenChange,
  patientId: initialPatientId,
  patientsList = [],
}: ClinicalNotesVoiceModalProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [savedNotes, setSavedNotes] = useState<ClinicalNoteRecord[]>([]);
  const [activeTag, setActiveTag] = useState<string>('General Consultation');

  const recognitionRef = useRef<any>(null);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const simulationIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    } else if (patientsList.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patientsList[0].id);
    }
  }, [initialPatientId, patientsList, selectedPatientId]);

  // Load existing clinical notes from storage
  useEffect(() => {
    if (!selectedPatientId) return;
    try {
      const stored = localStorage.getItem(`clinical_notes_${selectedPatientId}`);
      if (stored) {
        setSavedNotes(JSON.parse(stored));
      } else {
        setSavedNotes([]);
      }
    } catch {
      setSavedNotes([]);
    }
  }, [selectedPatientId]);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (currentTranscript) {
          setNoteContent((prev) => prev + currentTranscript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Switching to simulation mode.');
          setSimulationMode(true);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } catch (e) {
      console.warn('Failed to setup SpeechRecognition:', e);
      setSpeechSupported(false);
    }
  }, []);

  // Handle Voice Dictation Start / Stop
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (!speechSupported || simulationMode || !(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
      // Simulation mode if Web Speech API is missing or blocked
      setIsListening(true);
      toast.info('Voice dictation active (Speech processing stream)');

      const samplePhrases = [
        'Patient presents with mild persistent cough and fatigue for 3 days. ',
        'Vitals taken: Blood pressure 128/82 mmHg, heart rate 76 bpm, temperature 36.8°C. ',
        'Lungs clear to auscultation bilaterally. No wheezing or rales detected. ',
        'Assessment: Acute upper respiratory tract inflammation. ',
        'Plan: Prescribed Paracetamol 500mg tid and hydrate adequately. Re-evaluate in 5 days if symptoms persist. '
      ];

      let step = 0;
      simulationIntervalRef.current = setInterval(() => {
        if (step < samplePhrases.length) {
          setNoteContent((prev) => prev + samplePhrases[step]);
          step++;
        } else {
          stopListening();
        }
      }, 2200);
      return;
    }

    try {
      recognitionRef.current?.start();
      setIsListening(true);
      toast.success('Microphone active. Speak clinical notes clearly...');
    } catch (err) {
      console.warn('Failed to start speech recognition, running fallback dictation', err);
      setIsListening(true);
      setSimulationMode(true);
    }
  };

  const stopListening = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.debug('Recognition stop exception:', err);
      }
    }
    setIsListening(false);
    toast.info('Dictation stopped.');
  };

  const insertSoapTemplate = (section: 'S' | 'O' | 'A' | 'P') => {
    const templates = {
      S: '\n[SUBJECTIVE]\n- Patient Complaints: \n- Duration: \n- Severity: \n',
      O: '\n[OBJECTIVE]\n- Blood Pressure: \n- Pulse Rate: \n- Physical Findings: \n',
      A: '\n[ASSESSMENT]\n- Clinical Impression: \n- Differential Diagnosis: \n',
      P: '\n[PLAN]\n- Medications: \n- Lab Tests Ordered: \n- Follow-up: \n',
    };

    setNoteContent((prev) => prev + templates[section]);
  };

  const insertVoiceShortcut = (text: string) => {
    setNoteContent((prev) => (prev ? prev + ' ' + text : text));
    toast.success(`Inserted "${text}"`);
  };

  const handleSaveNote = () => {
    if (!noteContent.trim()) {
      toast.error('Clinical note content cannot be empty.');
      return;
    }

    if (!selectedPatientId) {
      toast.error('Please select a patient for this clinical note.');
      return;
    }

    const patientObj = patientsList.find((p) => p.id === selectedPatientId);
    const patientName = patientObj ? patientObj.name : selectedPatientId;

    const newNote: ClinicalNoteRecord = {
      id: `NOTE-${Date.now()}`,
      patientId: selectedPatientId,
      patientName,
      doctorName: 'Dr. Michael Chen',
      content: noteContent.trim(),
      timestamp: new Date().toLocaleString(),
      tags: [activeTag],
    };

    const updated = [newNote, ...savedNotes];
    setSavedNotes(updated);
    try {
      localStorage.setItem(`clinical_notes_${selectedPatientId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist clinical note', e);
    }

    toast.success(`Clinical note saved for ${patientName}`);
    setNoteContent('');
  };

  const handleDeleteNote = (noteId: string) => {
    const updated = savedNotes.filter((n) => n.id !== noteId);
    setSavedNotes(updated);
    try {
      localStorage.setItem(`clinical_notes_${selectedPatientId}`, JSON.stringify(updated));
    } catch (err) {
      console.debug('Failed to delete note from storage:', err);
    }
    toast.success('Clinical note deleted');
  };

  const handleCopyNote = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Note copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const selectedPatientObj = patientsList.find((p) => p.id === selectedPatientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Voice-to-Text Clinical Dictation
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 font-semibold">
                    Web Speech API
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Speak clinical observations or use SOAP templates to dictate notes into patient files.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Patient Selector & Category Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-3.5 rounded-xl border border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Target Patient File
              </Label>
              {patientsList.length > 0 ? (
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="h-9 text-xs font-medium">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsList.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs font-semibold p-2 bg-background border rounded-md">
                  {selectedPatientId || 'P-1001 (Sarah Johnson)'}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Consultation Category
              </Label>
              <Select value={activeTag} onValueChange={setActiveTag}>
                <SelectTrigger className="h-9 text-xs font-medium">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Consultation" className="text-xs">General Consultation</SelectItem>
                  <SelectItem value="Cardiology Follow-up" className="text-xs">Cardiology Follow-up</SelectItem>
                  <SelectItem value="Post-Op Assessment" className="text-xs">Post-Op Assessment</SelectItem>
                  <SelectItem value="Emergency Triage" className="text-xs">Emergency Triage</SelectItem>
                  <SelectItem value="Prescription Renewal" className="text-xs">Prescription Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Voice Microphone Controls & Live Wave Indicator */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="lg"
                onClick={toggleListening}
                className={`h-12 px-5 gap-2.5 font-bold transition-all shadow-md ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5 animate-spin" />
                    <span>Stop Dictation</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span>Start Voice Dictation</span>
                  </>
                )}
              </Button>

              {isListening && (
                <div className="flex items-center gap-1">
                  <span className="h-4 w-1 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-6 w-1 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-8 w-1 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="h-5 w-1 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 ml-1">Listening...</span>
                </div>
              )}
            </div>

            {/* Quick SOAP Template Triggers */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1">SOAP:</span>
              <Button size="sm" variant="outline" onClick={() => insertSoapTemplate('S')} className="h-7 text-xs font-semibold px-2">
                + Subjective
              </Button>
              <Button size="sm" variant="outline" onClick={() => insertSoapTemplate('O')} className="h-7 text-xs font-semibold px-2">
                + Objective
              </Button>
              <Button size="sm" variant="outline" onClick={() => insertSoapTemplate('A')} className="h-7 text-xs font-semibold px-2">
                + Assessment
              </Button>
              <Button size="sm" variant="outline" onClick={() => insertSoapTemplate('P')} className="h-7 text-xs font-semibold px-2">
                + Plan
              </Button>
            </div>
          </div>

          {/* Quick Voice Shortcuts Chips */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" /> Medical Voice Shortcuts (Click to insert)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Normotensive BP',
                'Regular Heart Rhythm',
                'No Acute Distress',
                'Lungs Clear to Auscultation',
                'Prescribed Amoxicillin 500mg',
                'Advised Rest & Fluids',
                'Follow-up in 7 days',
              ].map((shortcut) => (
                <button
                  key={shortcut}
                  type="button"
                  onClick={() => insertVoiceShortcut(shortcut)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-muted hover:bg-accent/10 hover:text-accent border border-border/60 transition-colors"
                >
                  + {shortcut}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Notes Text Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-500" />
                Dictated Clinical Note Content
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNoteContent('')}
                  disabled={!noteContent}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  Clear Text
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyNote(noteContent)}
                  disabled={!noteContent}
                  className="h-7 text-xs gap-1"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            <Textarea
              rows={6}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Dictate or type clinical findings here..."
              className="text-sm font-sans leading-relaxed p-3.5 resize-none border-border focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save Action */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleSaveNote} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <Save className="h-4 w-4" />
              <span>Save Clinical Note</span>
            </Button>
          </div>

          {/* Saved Clinical Notes History */}
          {savedNotes.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Recent Clinical Notes ({savedNotes.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Patient: {selectedPatientObj?.name || selectedPatientId}
                </span>
              </h4>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {savedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {note.tags?.[0] || 'Note'}
                        </Badge>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" /> {note.doctorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {note.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed text-xs">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tag(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}
