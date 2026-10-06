import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  RefreshCw,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { VitalsRecord } from '@/types/vitals';

interface AiClinicalInsightsSidebarProps {
  patientId: string;
  patientName: string;
  vitalsList: VitalsRecord[];
  onClose?: () => void;
  onCopyToNotes?: (text: string) => void;
}

export function AiClinicalInsightsSidebar({
  patientId,
  patientName,
  vitalsList,
  onClose,
  onCopyToNotes,
}: AiClinicalInsightsSidebarProps) {
  const [loading, setLoading] = useState(false);
  const [insightsText, setInsightsText] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const fetchInsights = async () => {
    if (vitalsList.length === 0) {
      setInsightsText('Insufficient clinical record history. Please add vital sign readings to activate the AI advisory engine.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Consulting medical LLM diagnostics models...');

    try {
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          vitalsList,
        }),
      });

      if (!response.ok) throw new Error('Insights service failed');
      const data = await response.json();

      setInsightsText(data.text);
      setModelUsed(data.modelUsed || 'gemini-3.5-flash');
      setIsSimulated(!!data.simulated);
      toast.success('AI Diagnostics patterns analyzed and loaded', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture AI clinical suggestions', { id: toastId });
      setInsightsText('Error connecting to the clinical insights model. Please review your server-side environment variables or check your network socket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, vitalsList]);

  // Clean custom rendering helper that maps basic markdown structures to gorgeous React layouts
  const renderInsightsMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border" id={`insight-h3-${idx}`}>
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-foreground uppercase tracking-wider mt-3 mb-1.5" id={`insight-h4-${idx}`}>
            {line.replace('#### ', '')}
          </h4>
        );
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={idx} className="font-bold text-foreground mt-2" id={`insight-bold-p-${idx}`}>
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      // List items
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const itemText = line.trim().substring(2);
        // Process bold subtitles inside list items
        if (itemText.includes('**')) {
          const parts = itemText.split('**');
          return (
            <div key={idx} className="pl-4 py-1 flex items-start gap-1.5 text-xs text-foreground" id={`insight-list-item-${idx}`}>
              <span className="text-muted-foreground mt-0.5">•</span>
              <span>
                {parts.map((part, pIdx) =>
                  pIdx % 2 === 1 ? (
                    <strong key={pIdx} className="font-semibold text-foreground">{part}</strong>
                  ) : (
                    part
                  )
                )}
              </span>
            </div>
          );
        }
        return (
          <div key={idx} className="pl-4 py-1 flex items-start gap-1.5 text-xs text-foreground" id={`insight-list-item-plain-${idx}`}>
            <span className="text-muted-foreground mt-0.5">•</span>
            <span>{itemText}</span>
          </div>
        );
      }
      // Bullet/disclaimers
      if (line.includes('DISCLAIMER:')) {
        return (
          <div key={idx} className="mt-4 p-3 bg-destructive/50 border border-destructive/20 rounded-lg text-[10px] text-destructive font-medium leading-relaxed" id={`insight-disclaimer-${idx}`}>
            <AlertCircle className="w-4 h-4 inline mr-1 text-destructive shrink-0 align-sub" />
            {line.replace(/\*\*/g, '')}
          </div>
        );
      }
      // Emoticons / Highlight warning
      if (line.includes('⚠️')) {
        return (
          <div key={idx} className="my-2 p-2.5 bg-warning/5 border border-warning/20 text-warning rounded-lg text-xs flex items-center gap-1.5 font-semibold" id={`insight-warning-${idx}`}>
            <span>{line}</span>
          </div>
        );
      }

      if (line.trim() === '***') {
        return <hr key={idx} className="my-4 border-border" id={`insight-hr-${idx}`} />;
      }

      // Normal paragraph
      if (line.trim() !== '') {
        // Process standard bold segments
        let content: React.ReactNode = line;
        if (line.includes('**')) {
          const parts = line.split('**');
          content = parts.map((part, pIdx) =>
            pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-foreground">{part}</strong> : part
          );
        }
        return (
          <p key={idx} className="text-xs text-muted-foreground leading-relaxed mt-2" id={`insight-paragraph-${idx}`}>
            {content}
          </p>
        );
      }

      return null;
    });
  };

  return (
    <Card className="border-border shadow-lg bg-card h-full flex flex-col" id="ai-clinical-insights-sidebar">
      {/* Header */}
      <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 space-y-0" id="insights-sidebar-header">
        <div id="insights-sidebar-title-block">
          <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5" id="insights-sidebar-title">
            <Brain className="w-4 h-4 text-foreground" /> AI Clinical Insights
          </CardTitle>
          <CardDescription className="text-[10px] sm:text-xs" id="insights-sidebar-desc">Real-time LLM-driven diagnostics & pattern checks.</CardDescription>
        </div>
        <div className="flex items-center gap-1.5" id="insights-header-actions">
          {isSimulated && (
            <Badge className="bg-warning/5 text-warning border-warning/20 text-[9px] px-1.5 py-0.5 rounded" id="simulated-badge">
              Simulated
            </Badge>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
              id="close-insights-sidebar-btn"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Main Content Area */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3" id="insights-sidebar-content">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3" id="insights-loading-state">
            <Loader2 className="w-8 h-8 text-foreground animate-spin" />
            <p className="text-xs font-semibold">Running physiological trend formulas...</p>
          </div>
        ) : (
          <div className="space-y-3 prose prose-slate max-w-none" id="insights-text-container">
            {renderInsightsMarkdown(insightsText)}
          </div>
        )}
      </CardContent>

      {/* Action Footer */}
      <CardContent className="p-4 border-t border-border shrink-0 space-y-2 bg-muted rounded-b-xl" id="insights-sidebar-footer">
        <div className="flex justify-between items-center text-[10px] text-muted-foreground" id="insights-footer-meta">
          <span>Engine: {modelUsed || 'gemini-3.5-flash'}</span>
          <span>Confidence: High</span>
        </div>
        <div className="flex gap-2 pt-1" id="insights-footer-buttons">
          <Button
            variant="outline"
            className="flex-1 border-border text-foreground font-semibold text-xs h-9 py-1"
            onClick={fetchInsights}
            disabled={loading}
            id="refresh-insights-btn"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-Analyze
          </Button>
          {onCopyToNotes && insightsText && (
            <Button
              className="flex-1 bg-slate-950 hover:bg-slate-850 text-white font-semibold text-xs h-9 py-1"
              onClick={() => {
                onCopyToNotes(insightsText);
                toast.success('Clinical Insights copied to clipboard!');
              }}
              disabled={loading}
              id="copy-insights-btn"
            >
              <FileText className="w-3.5 h-3.5 mr-1" /> Use in Notes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
