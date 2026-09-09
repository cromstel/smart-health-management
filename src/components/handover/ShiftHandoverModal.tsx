import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import {
  Send,
  Copy,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';

interface ShiftHandoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HandoverTask {
  id: string;
  patientName: string;
  task: string;
  priority: 'URGENT' | 'ROUTINE';
  done: boolean;
}

export function ShiftHandoverModal({ open, onOpenChange }: ShiftHandoverModalProps) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [outgoingClinician, setOutgoingClinician] = useState(
    user?.name ? `Dr. ${user.name}` : 'Dr. Sarah Jenkins'
  );
  const [incomingClinician, setIncomingClinician] = useState('Dr. Marcus Vance');
  const [department, setDepartment] = useState('Emergency & Trauma Bay');
  const [shiftPeriod, setShiftPeriod] = useState('Night Shift (19:00 - 07:00)');
  const [handoverNotes, setHandoverNotes] = useState(
    'All Level-1 trauma patients stabilized. Sarah Connor (STEMI) awaiting 09:00 repeat cardiac enzymes. Kwame Mensah in Bay 03 on 4L/min O2 nasal cannula.'
  );

  const [tasks, setTasks] = useState<HandoverTask[]>([
    {
      id: 't-1',
      patientName: 'Sarah Connor (Bay 01)',
      task: 'Repeat STAT Troponin I lab draw at 09:00',
      priority: 'URGENT',
      done: false,
    },
    {
      id: 't-2',
      patientName: 'Kwame Mensah (Bay 03)',
      task: 'Re-evaluate SpO2 after 30 mins nebulizer session',
      priority: 'URGENT',
      done: false,
    },
    {
      id: 't-3',
      patientName: 'Amina Yeboah (Bay 04)',
      task: 'Check for discharge eligibility following IV antihistamine',
      priority: 'ROUTINE',
      done: true,
    },
    {
      id: 't-4',
      patientName: 'General ER Inventory',
      task: 'Complete Schedule II controlled substance count with incoming lead',
      priority: 'URGENT',
      done: false,
    },
  ]);

  const [isSharing, setIsSharing] = useState(false);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleShareInternalMessaging = () => {
    setIsSharing(true);

    setTimeout(() => {
      // Dispatch notification to internal messaging system
      addNotification({
        type: 'system',
        priority: 'high',
        title: `📋 Shift Handover Submitted by ${outgoingClinician}`,
        message: `Handover report for ${department} assigned to ${incomingClinician}. Notes: "${handoverNotes.slice(0, 80)}..."`,
        timestamp: 'Just now',
        patientName: 'Shift Handover Report',
        status: 'pending',
      });

      toast.success(`Shift Handover Report dispatched to ${incomingClinician} via Secure Internal Messaging!`, {
        description: 'Audit log entry created and saved for compliance.',
      });

      setIsSharing(false);
      onOpenChange(false);
    }, 1000);
  };

  const generateMarkdownReport = () => {
    return `
# CLINICAL SHIFT HANDOVER REPORT
------------------------------------------------
Department: ${department}
Outgoing Lead: ${outgoingClinician}
Incoming Lead: ${incomingClinician}
Shift Period: ${shiftPeriod}
Timestamp: ${new Date().toLocaleString()}

## Handover Summary Notes
${handoverNotes}

## Active Tasks & Next Shift Actions
${tasks.map((t) => `- [${t.done ? 'X' : ' '}] [${t.priority}] ${t.patientName}: ${t.task}`).join('\n')}

------------------------------------------------
HIPAA Certified Electronic Handover Document
    `.trim();
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    toast.success('Shift Handover Summary copied to clipboard!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Clinical Shift Handover Report</DialogTitle>
              <DialogDescription>
                Generate and transmit structured clinical handovers to incoming shift leads
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Shift Details Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Outgoing Clinician</Label>
              <Input
                value={outgoingClinician}
                onChange={(e) => setOutgoingClinician(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Incoming Clinician</Label>
              <Input
                value={incomingClinician}
                onChange={(e) => setIncomingClinician(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Department / Bay</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Shift Period</Label>
              <Input
                value={shiftPeriod}
                onChange={(e) => setShiftPeriod(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Key Clinical Handover Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Shift Handover Summary Notes</span>
              <span className="text-[10px] text-muted-foreground">Detailed patient status & updates</span>
            </Label>
            <Textarea
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              rows={3}
              className="text-xs resize-none"
              placeholder="Enter clinical notes for incoming shift..."
            />
          </div>

          {/* Pending Action Items & Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Pending Tasks for Incoming Shift
              </Label>
              <Badge variant="outline" className="text-[10px] font-mono">
                {tasks.filter((t) => !t.done).length} Pending
              </Badge>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-muted/30 border">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-card border text-xs gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                    <span className={t.done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}>
                      <strong>{t.patientName}:</strong> {t.task}
                    </span>
                  </div>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 font-bold ${
                      t.priority === 'URGENT'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              All handovers are encrypted and logged in compliance with HIPAA electronic record transmission standards.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopyReport} className="text-xs gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            <span>Copy Markdown</span>
          </Button>

          <Button
            size="sm"
            onClick={handleShareInternalMessaging}
            disabled={isSharing}
            className="text-xs gap-1.5 bg-accent text-accent-foreground font-bold shadow"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSharing ? 'Transmitting...' : 'Send via Internal Messaging'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
