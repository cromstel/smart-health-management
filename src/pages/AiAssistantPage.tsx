import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Settings2, 
  FileText, 
  ShieldAlert, 
  Copy,
  Brain,
  MessageSquare,
  HelpCircle,
  Globe,
  ExternalLink,
  BookOpen,
  Search
} from 'lucide-react';

interface GroundingMetadata {
  searchQueries?: string[];
  sources?: { title: string; uri: string }[];
  grounded?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulated?: boolean;
  groundingMetadata?: GroundingMetadata;
}

interface Persona {
  id: string;
  name: string;
  icon: any;
  description: string;
  systemInstruction: string;
  suggestedPrompts: string[];
}

const PERSONAS: Persona[] = [
  {
    id: 'medical_research',
    name: 'Medical Research & Guidelines Grounding',
    icon: BookOpen,
    description: 'Grounds queries in real-time medical literature, PubMed, WHO, CDC, and peer-reviewed clinical trials.',
    systemInstruction: `You are an expert Clinical Research & Guidelines Specialist with real-time Google Search grounding. Your mission is to provide up-to-date, evidence-based clinical research, recent clinical practice guideline updates (2025/2026), drug efficacy trials, and epidemiological findings.\n\nCRITICAL CONSTRAINTS:\n1. Ground your answers in current peer-reviewed publications (NEJM, The Lancet, JAMA, BMJ) and authoritative guidelines (ADA, ACC/AHA, WHO, CDC, KDIGO).\n2. Clearly cite recommendations and recent consensus statements.\n3. Always append the standard disclaimer: "DISCLAIMER: This analysis is an AI-generated clinical aid for licensed professionals. It does not replace independent clinical judgment or direct patient examination."`,
    suggestedPrompts: [
      "What are the latest 2025/2026 clinical guidelines for GLP-1 receptor agonists in CKD and heart failure?",
      "Summarize the latest ACC/AHA blood pressure target benchmarks and recommended first-line combination therapy.",
      "What is the current evidence-based protocol for managing resistant hypertension with renal denervation?"
    ]
  },
  {
    id: 'clinical_diagnostic',
    name: 'Clinical Diagnostic Assistant',
    icon: Brain,
    description: 'Expert reasoning for symptoms analysis, ICD-10 suggestions, and guidelines.',
    systemInstruction: `You are an expert Clinical Diagnostic Assistant. Your role is to assist healthcare practitioners by analyzing symptoms, suggesting potential differential diagnoses, recommending diagnostic protocols, and identifying relevant ICD-10 codes.\n\nCRITICAL CONSTRAINTS:\n1. Always provide professional, evidence-based clinical reasoning.\n2. Do NOT establish a definitive medical diagnosis.\n3. Always append a clear medical disclaimer: "DISCLAIMER: This analysis is an AI-generated clinical aid for licensed professionals. It does not replace independent clinical judgment or direct patient examination."`,
    suggestedPrompts: [
      "Analyze a 45yo patient with acute chest pain spreading to left arm.",
      "What are the ICD-10 suggestions for Type 2 Diabetes with neuropathy?",
      "Provide guideline-based diagnostic steps for suspected adult asthma."
    ]
  },
  {
    id: 'communication_copilot',
    name: 'Patient Communication Copilot',
    icon: MessageSquare,
    description: 'Simplifies complex clinical jargon into patient-friendly explanations and drafts.',
    systemInstruction: `You are a Patient Communication Copilot. Your job is to translate complex medical findings, lab results, and medication guidelines into simple, empathetic, and easily understandable language for patients and their families.\n\nCRITICAL CONSTRAINTS:\n1. Eliminate all complex medical jargon or explain it immediately with everyday analogies.\n2. Adopt a compassionate, warm, and supportive tone.\n3. Draft patient-facing messages, discharge letters, or clinical instructions clearly.`,
    suggestedPrompts: [
      "Explain hypertension and why taking Lisinopril daily is critical, in terms a 10-year-old can understand.",
      "Draft an empathetic discharge summary letter explaining a recent appendectomy surgery.",
      "Translate this lab result: 'Moderate microalbuminuria with preserved eGFR' for a patient."
    ]
  },
  {
    id: 'soap_scribe',
    name: 'Clinical SOAP Note Scribe',
    icon: FileText,
    description: 'Structures unstructured patient interactions into standard professional clinical notes.',
    systemInstruction: `You are a Clinical SOAP Note Scribe. Your role is to convert unstructured consultation notes, transcripts, or patient complaints into high-quality, professional, and standard SOAP (Subjective, Objective, Assessment, Plan) format clinical documentation.\n\nCRITICAL CONSTRAINTS:\n1. Format output clearly with headers: Subjective (S), Objective (O), Assessment (A), and Plan (P).\n2. Maintain extreme clinical precision and professional tone.\n3. Keep paragraphs concise and bullet points highly structured.`,
    suggestedPrompts: [
      "Convert this to SOAP: Patient says her head is pounding for 3 days, worse with light, took paracetamol but it didn't help. BP today is 140/90, temp is 37C. I think it is migraine, prescribing sumatriptan and follow-up in 2 weeks.",
      "Scribe SOAP for: Kofi Annan came in complaining of chronic knee joint pain. No swelling, normal range of motion. Appears to be early osteoarthritis. Recommending physical therapy 2x/week, naproxen for pain, review in 1 month.",
      "Create a standard SOAP template for a routine wellness checkup."
    ]
  },
  {
    id: 'operational_optimizer',
    name: 'Operational Throughput Expert',
    icon: Settings2,
    description: 'Solves hospital scheduling, appointment density, and clinic workflow bottlenecks.',
    systemInstruction: `You are a Hospital Operational Throughput Expert. Your role is to analyze hospital patient flows, appointment density, scheduling models, and peak hours to optimize operational throughput and reduce bottlenecks.\n\nCRITICAL CONSTRAINTS:\n1. Provide highly analytical, structured, and operational optimization suggestions.\n2. Reference patient scheduling density matrices (like the appointment density heat map) to advise on resource allocation.\n3. Keep recommendations actionable, practical, and focused on staff-to-patient ratio balancing.`,
    suggestedPrompts: [
      "Our Monday morning appointments are severely congested. How can we optimize staff scheduling to reduce wait times?",
      "Suggest a scheduling strategy to utilize our low-density weekend and afternoon slots more effectively.",
      "How can we streamline the transition of patients from triage to consulting rooms to improve daily clinic flow?"
    ]
  }
];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const { logAction } = useAudit();
  
  const [modelType, setModelType] = useState<'pro' | 'flash' | 'lite'>('flash');
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [customInstruction, setCustomInstruction] = useState<string>(PERSONAS[0].systemInstruction);
  const [enableSearchGrounding, setEnableSearchGrounding] = useState<boolean>(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Automatically sync custom instruction when persona changes
  useEffect(() => {
    setCustomInstruction(selectedPersona.systemInstruction);
  }, [selectedPersona]);

  // Load welcome message when chat is cleared or empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello ${user?.name || 'Doctor'}, I am your **${selectedPersona.name}** with **Google Search Grounding** enabled.\n\nI can retrieve up-to-date medical research, guideline consensus, clinical trials, and drug safety alerts. Feel free to use one of the quick suggestions below or write your custom clinical inquiry!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          groundingMetadata: {
            grounded: true,
            searchQueries: ['WHO clinical guidelines 2025/2026', 'PubMed medical updates'],
            sources: [
              { title: 'World Health Organization (WHO) Clinical Portal', uri: 'https://www.who.int' },
              { title: 'National Library of Medicine (PubMed)', uri: 'https://pubmed.ncbi.nlm.nih.gov' }
            ]
          }
        }
      ]);
    }
  }, [messages, selectedPersona, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      // Build context of previous messages
      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      // Audit log the AI request
      logAction('AI_ASSIST_REQUEST', 'dashboard', {
        newValue: `Queried Clinical AI (${selectedPersona.name}) using model type ${modelType} with search grounding ${enableSearchGrounding ? 'ON' : 'OFF'}`
      });

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          modelType,
          systemInstruction: customInstruction,
          enableSearchGrounding
        })
      });

      if (!response.ok) {
        throw new Error('API server returned an error response.');
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed,
        simulated: data.simulated,
        groundingMetadata: data.groundingMetadata
      };

      setMessages((prev) => [...prev, aiMsg]);
      
      if (data.simulated) {
        toast.info('Running in Simulated Preview Mode', {
          description: 'Set GEMINI_API_KEY to activate live reasoning with Google Search.'
        });
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Clinical API Connection Error**\n\nFailed to establish connection with Gemini services. This is likely because the \`GEMINI_API_KEY\` is not declared or is invalid. Please review your Environment configuration in the **Settings** panel.\n\n*Error details: ${error.message || 'Network unreachable'}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, errorMsg]);
      toast.error('Clinical AI service unavailable');
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Conversation history cleared');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-500" />
            Clinical AI & Research Workspace
          </h1>
          <p className="text-muted-foreground text-sm">
            Harness secure, full-stack Gemini intelligence with Google Search grounding for up-to-date medical literature, clinical protocols, and diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Google Search Grounding Active
          </Badge>
          <Button variant="outline" size="sm" onClick={clearChat} className="h-8 text-xs font-medium">
            <Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            Clear History
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Config Panel (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-indigo-500" />
                Assistant Workspace Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Configure your model engine, search grounding, and underlying clinical guidelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Search Grounding Switch */}
              <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-indigo-500" />
                    <Label htmlFor="search-grounding-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
                      Google Search Grounding
                    </Label>
                  </div>
                  <Switch
                    id="search-grounding-toggle"
                    checked={enableSearchGrounding}
                    onCheckedChange={setEnableSearchGrounding}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Enables real-time web retrieval against peer-reviewed journals, WHO, CDC, and latest 2025/2026 clinical guidelines.
                </p>
              </div>

              {/* Model selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Gemini Model Engine</span>
                  <span title="Pro is recommended for clinical evaluations, Flash for general inquiries, and Lite for quick tasks.">
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </span>
                </Label>
                <Select value={modelType} onValueChange={(val: any) => setModelType(val)}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro" className="text-xs">
                      Clinical Specialist (gemini-3.1-pro-preview)
                    </SelectItem>
                    <SelectItem value="flash" className="text-xs">
                      General Assistant (gemini-3.5-flash)
                    </SelectItem>
                    <SelectItem value="lite" className="text-xs">
                      Quick Responder (gemini-3.1-flash-lite)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Routing automatically directs requests to your chosen Gemini engine to optimize speed and clinical precision.
                </p>
              </div>

              {/* Persona selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Select AI Clinical Role</Label>
                <div className="grid gap-2">
                  {PERSONAS.map((p) => {
                    const PersonaIcon = p.icon;
                    const isSelected = selectedPersona.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPersona(p)}
                        className={`text-left p-3 rounded-lg border text-xs transition-all duration-150 ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500' 
                            : 'border-border/60 hover:bg-muted/40 hover:border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
                          <PersonaIcon className={`h-4 w-4 ${isSelected ? 'text-indigo-500' : 'text-muted-foreground'}`} />
                          <span>{p.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System instructions */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Current System Instruction</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">Editable</Badge>
                </Label>
                <Textarea 
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  className="min-h-[120px] text-[11px] leading-relaxed font-mono text-foreground"
                  placeholder="Clinical guidelines and constraints..."
                />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  These system-level instructions enforce diagnostic boundaries, soap layouts, or vocabulary limits directly inside the Gemini API.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick clinical safety notice */}
          <Card className="border border-amber-500/10 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400">Clinical Safety Advisory</h5>
                <p className="text-[10px] text-amber-700 dark:text-amber-300/80 leading-normal">
                  Clinical AI insights are reference aids designed to support licensed medical professionals. They do not constitute diagnostic validation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Chat Panel (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col h-[740px] border border-border rounded-lg bg-card overflow-hidden">
          {/* Active Chat Header */}
          <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                <selectedPersona.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{selectedPersona.name}</h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Engine: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{modelType.toUpperCase()}</strong></span>
                  {enableSearchGrounding && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Grounded Web Search
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {sending && (
              <Badge variant="outline" className="text-[10px] animate-pulse bg-indigo-500/5 text-indigo-500 border-indigo-500/20">
                AI is searching & formulating output...
              </Badge>
            )}
          </div>

          {/* Messages Stream Container */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-slate-950/20"
          >
            {messages.map((m) => {
              const isAi = m.role === 'assistant';
              const hasGrounding = isAi && m.groundingMetadata && (
                (m.groundingMetadata.searchQueries && m.groundingMetadata.searchQueries.length > 0) ||
                (m.groundingMetadata.sources && m.groundingMetadata.sources.length > 0)
              );

              return (
                <div key={m.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                  <div className={`flex gap-3 max-w-[88%] ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Avatar */}
                    <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border ${
                      isAi 
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' 
                        : 'bg-muted border-border text-foreground'
                    }`}>
                      {isAi ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>

                    {/* Message Card */}
                    <div className="space-y-2 w-full">
                      <div className={`p-4 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap ${
                        isAi 
                          ? 'bg-card border-border text-foreground shadow-sm' 
                          : 'bg-indigo-600 text-white border-indigo-600'
                      }`}>
                        {m.content}
                      </div>

                      {/* Google Search Grounding Sources Card */}
                      {hasGrounding && (
                        <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Google Search Grounding & Medical Literature Sources</span>
                          </div>

                          {m.groundingMetadata?.searchQueries && m.groundingMetadata.searchQueries.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                <Search className="h-3 w-3" /> Queries Executed:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {m.groundingMetadata.searchQueries.map((query, qIdx) => (
                                  <Badge key={qIdx} variant="secondary" className="text-[10px] font-normal py-0.5 px-2 bg-background border border-border">
                                    "{query}"
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {m.groundingMetadata?.sources && m.groundingMetadata.sources.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                <BookOpen className="h-3 w-3" /> Grounded References & Citations:
                              </span>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {m.groundingMetadata.sources.map((src, sIdx) => (
                                  <a
                                    key={sIdx}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="flex items-center justify-between gap-1.5 p-1.5 rounded bg-background hover:bg-muted border border-border/80 text-[10px] text-foreground font-medium transition-colors group"
                                  >
                                    <span className="truncate group-hover:text-indigo-600">{src.title}</span>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-indigo-600 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info & Meta labels */}
                      <div className={`flex items-center gap-2 text-[10px] text-muted-foreground px-1 ${isAi ? 'justify-start' : 'justify-end'}`}>
                        <span>{m.timestamp}</span>
                        {isAi && m.modelUsed && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{m.modelUsed}</span>
                          </>
                        )}
                        {isAi && m.simulated && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-500 font-medium bg-indigo-500/5 px-1 rounded border border-indigo-500/10">Simulation</span>
                          </>
                        )}
                        {isAi && (
                          <button 
                            onClick={() => copyToClipboard(m.content)}
                            className="hover:text-foreground text-muted-foreground transition-colors ml-1 p-0.5 rounded hover:bg-muted"
                            title="Copy output content"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {sending && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%] items-center">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1.5 p-3 rounded-xl border border-border bg-card shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggested Prompts Section */}
          {messages.length <= 1 && (
            <div className="p-4 border-t border-border bg-muted/10 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested clinical queries for this persona:
              </span>
              <div className="flex flex-col gap-2">
                {selectedPersona.suggestedPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputValue(p);
                      handleSendMessage(p);
                    }}
                    className="text-left w-full p-2.5 rounded border border-border/60 bg-card hover:bg-indigo-500/5 hover:border-indigo-500/30 text-xs text-foreground/80 font-medium transition-all duration-150 flex items-center gap-2 group"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500 opacity-60 group-hover:opacity-100 shrink-0" />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Chat Input Form */}
          <div className="p-4 border-t border-border bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Query your ${selectedPersona.name}...`}
                disabled={sending}
                className="flex-1 text-xs"
              />
              <VoiceDictationButton onTranscript={(txt) => setInputValue(txt)} />
              <Button 
                type="submit" 
                disabled={sending || !inputValue.trim()}
                className="h-9 w-9 p-0 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Conversations are securely routed through server-side clinical APIs with Google Search Grounding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
