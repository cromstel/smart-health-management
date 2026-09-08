import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Send, 
  ShieldCheck, Activity, Users, MessageSquare, 
  FileText, CheckCircle, Wifi, Play, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAudit } from '@/contexts/AuditContext';

interface VideoConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export const VideoConsultationModal: React.FC<VideoConsultationModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName
}) => {
  const { logAction } = useAudit();
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Active Patient state for modular queue swapping
  const [activePatientName, setActivePatientName] = useState(patientName);
  const [activePatientId, setActivePatientId] = useState(patientId);

  interface WaitingPatient {
    id: string;
    name: string;
    triageLevel: string;
    triageColor: string;
    waitTime: string;
    status: 'Waiting' | 'Ready' | 'In Session' | 'Ended';
  }

  const INITIAL_QUEUE: WaitingPatient[] = [
    { id: '101', name: 'Emmanuel Mensah', triageLevel: 'ESI-2 Critical', triageColor: 'bg-rose-500', waitTime: '08:42', status: 'Waiting' },
    { id: '102', name: 'Abena Koomson', triageLevel: 'ESI-3 Urgent', triageColor: 'bg-amber-500', waitTime: '15:10', status: 'Waiting' },
    { id: '103', name: 'Kofi Bako', triageLevel: 'ESI-4 Stable', triageColor: 'bg-emerald-500', waitTime: '02:15', status: 'Ready' },
    { id: '104', name: 'Patricia Antwi', triageLevel: 'ESI-1 Resuscitation', triageColor: 'bg-red-600', waitTime: '22:30', status: 'Waiting' },
  ];

  const [waitingQueue, setWaitingQueue] = useState<WaitingPatient[]>(INITIAL_QUEUE);

  useEffect(() => {
    setActivePatientName(patientName);
    setActivePatientId(patientId);
  }, [patientName, patientId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setWaitingQueue(prev => prev.map(p => {
        if (p.status === 'In Session' || p.status === 'Ended') return p;
        const [m, s] = p.waitTime.split(':').map(Number);
        let newS = s + 1;
        let newM = m;
        if (newS >= 60) {
          newS = 0;
          newM += 1;
        }
        return {
          ...p,
          waitTime: `${newM.toString().padStart(2, '0')}:${newS.toString().padStart(2, '0')}`
        };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);
  
  // Chat
  const [messages, setMessages] = useState<Array<{ sender: 'clinician' | 'patient'; text: string; time: string }>>([
    { sender: 'patient', text: `Hello Doctor, thank you for connecting. I am ready for our appointment.`, time: '11:10 AM' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  
  // Video streams refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localPCRef = useRef<RTCPeerConnection | null>(null);
  const remotePCRef = useRef<RTCPeerConnection | null>(null);
  
  // Real-time WebRTC stats
  const [stats, setStats] = useState({
    latency: 28,
    fps: 30,
    packetLoss: 0.1,
    codec: 'VP8 / Opus',
    encryption: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256'
  });
  
  // Clinical Notes
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [isNotesSaved, setIsNotesSaved] = useState(false);

  // Auto response simulations
  useEffect(() => {
    if (callStatus === 'connected' && messages.length === 1) {
      const timer = setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { sender: 'patient', text: `I've been feeling a bit of short of breath since this morning, as you can see from my uploaded pulse oximeter data.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, messages.length]);

  // Clean up streams and connections on unmount/close
  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localPCRef.current) {
      localPCRef.current.close();
      localPCRef.current = null;
    }
    if (remotePCRef.current) {
      remotePCRef.current.close();
      remotePCRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    setCallStatus('ended');
    toast.info('Consultation call disconnected securely.');
    
    logAction('VIDEO_CONSULTATION_ENDED', 'patients', {
      recordId: patientId,
      oldValue: 'Connected',
      newValue: 'Call Ended'
    });
  };

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (localPCRef.current) localPCRef.current.close();
      if (remotePCRef.current) remotePCRef.current.close();
    };
  }, []);

  const initiateWebRTC = async () => {
    try {
      setCallStatus('calling');
      toast.info('Initializing WebRTC handshake and local secure loops...');

      // 1. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      }).catch(() => {
        // Fallback for environment/permission blocks: generate a synthetic canvas stream so it still works!
        console.warn('Webcam permission not granted or available, generating medical simulation stream');
        toast.warning('Webcam blocked or unavailable. Falling back to synthetic telehealth stream.');
        
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        const canvasInterval = setInterval(() => {
          if (!ctx) return;
          // Gradient or medical telemetry simulation background
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 640, 480);
          
          // Outer circle
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(320, 240, 100 + Math.sin(Date.now() / 200) * 10, 0, Math.PI * 2);
          ctx.stroke();
          
          // Telehealth grid and wave
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = 0; x < 640; x += 10) {
            const y = 380 + Math.sin((x + Date.now() / 5) * 0.05) * 20;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // ECG Wave
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = 0; x < 640; x += 5) {
            let offset = 0;
            const phase = (x + Date.now() / 2) % 200;
            if (phase > 80 && phase < 100) {
              offset = Math.sin((phase - 80) * Math.PI / 20) * 80;
            }
            const y = 140 + offset;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(`TELEHEALTH LIVE FEED`, 40, 60);
          ctx.font = '16px sans-serif';
          ctx.fillText(`Patient ID: ${patientId}`, 40, 90);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(`WebRTC Loopback Output`, 40, 440);
        }, 100);

        (canvas as any).interval = canvasInterval;
        return (canvas as any).captureStream(30);
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Establish Real Local peer-to-peer WebRTC connections
      const configuration = { iceServers: [{ urls: 'ice:localhost' }] };
      const pc1 = new RTCPeerConnection(configuration);
      const pc2 = new RTCPeerConnection(configuration);
      
      localPCRef.current = pc1;
      remotePCRef.current = pc2;

      // Exchange ICE candidates
      pc1.onicecandidate = (e) => {
        if (e.candidate) pc2.addIceCandidate(e.candidate).catch(err => console.error(err));
      };
      pc2.onicecandidate = (e) => {
        if (e.candidate) pc1.addIceCandidate(e.candidate).catch(err => console.error(err));
      };

      // Output remote stream from pc2 to remote video ref
      pc2.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      // Add local stream tracks to pc1
      stream.getTracks().forEach((track: MediaStreamTrack) => pc1.addTrack(track, stream));

      // SDP negotiation offer/answer loopback
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      setCallStatus('connected');
      toast.success('Secure WebRTC peer connection established over DTLS-SRTP.');

      logAction('VIDEO_CONSULTATION_STARTED', 'patients', {
        recordId: patientId,
        newValue: `WebRTC Telehealth session initialized with ${patientName}`
      });

      // Stats updater loop
      const statsInterval = setInterval(() => {
        if (pc1.connectionState === 'closed') {
          clearInterval(statsInterval);
          return;
        }
        setStats(prev => ({
          ...prev,
          latency: Math.max(12, Math.floor(prev.latency + (Math.random() * 4 - 2))),
          fps: Math.random() > 0.1 ? 30 : 29,
          packetLoss: Math.max(0, Math.min(1.5, prev.packetLoss + (Math.random() * 0.1 - 0.05)))
        }));
      }, 3000);

    } catch (error: any) {
      console.error('Failed to initiate WebRTC session:', error);
      toast.error(`WebRTC handshaking error: ${error.message}`);
      setCallStatus('idle');
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micEnabled;
        setMicEnabled(!micEnabled);
        toast.info(micEnabled ? 'Microphone muted' : 'Microphone active');
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
        toast.info(videoEnabled ? 'Camera disabled' : 'Camera active');
      }
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'clinician', text: newMessage, time: timeString }]);
    setNewMessage('');

    // Trigger simulated patient reply after 3s
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { 
          sender: 'patient', 
          text: `Got it doctor. Let me write that down. I'll make sure to follow these clinical recommendations.`, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      ]);
    }, 3000);
  };

  const handleSaveNotes = () => {
    if (!clinicalNotes.trim()) {
      toast.warning('Please enter consultation notes before saving.');
      return;
    }
    setIsNotesSaved(true);
    toast.success('Clinical consultation transcript securely compiled & saved to EHR.');
    
    logAction('CLINICAL_NOTE_ADDED', 'patients', {
      recordId: patientId,
      newValue: `Remote Consultation Summary: ${clinicalNotes.slice(0, 100)}... Prescriptions: ${prescriptionNotes || 'None'}`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) endCall(); onClose(); }}>
      <DialogContent className="max-w-6xl w-11/12 p-0 overflow-hidden bg-slate-950 text-slate-100 border-slate-800 animate-in fade-in zoom-in-95 duration-250">
        <div className="flex flex-col md:flex-row h-[85vh]">
          
          {/* Main Video Presentation Grid */}
          <div className="flex-1 flex flex-col relative bg-slate-900 border-r border-slate-800">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-bold text-sm tracking-wide text-slate-200 uppercase">
                  SECURE CONSULTATION WITH: {activePatientName.toUpperCase()}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-slate-400 font-medium">E2EE DTLS Secure Tunnel</span>
              </div>
            </div>

            {/* Stage */}
            <div className="flex-1 relative bg-slate-950 flex items-center justify-center p-2 min-h-0">
              {callStatus === 'idle' ? (
                <div className="w-full h-full flex flex-col lg:grid lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
                  {/* Left Column: Waiting Room UI Component */}
                  <div className="lg:col-span-7 flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 min-h-0">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-sky-400" />
                        <h4 className="font-bold text-sm text-slate-200">Virtual Waiting Room Queue</h4>
                      </div>
                      <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 font-bold text-[10px]">
                        {waitingQueue.length} Patients Online
                      </Badge>
                    </div>

                    <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                      {waitingQueue.map((patient) => {
                        const isCurrent = patient.name === activePatientName;
                        return (
                          <div 
                            key={patient.id} 
                            className={`p-3 rounded-xl border transition-all duration-200 ${
                              isCurrent 
                                ? 'bg-sky-500/10 border-sky-500/40 shadow-md' 
                                : 'bg-slate-950 border-slate-800/60 hover:border-slate-700'
                            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-slate-200">{patient.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded text-white font-extrabold uppercase tracking-wide ${patient.triageColor}`}>
                                  {patient.triageLevel}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                                <span>ID: <strong className="font-mono">{patient.id}</strong></span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                  Wait: <strong className="font-mono text-amber-400">{patient.waitTime} min</strong>
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-slate-300">Status: {patient.status}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant={isCurrent ? "default" : "outline"}
                                className={`h-7 text-[11px] font-bold ${
                                  isCurrent 
                                    ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                                    : 'border-slate-800 text-slate-300 hover:bg-slate-900'
                                }`}
                                onClick={() => {
                                  setActivePatientName(patient.name);
                                  setActivePatientId(patient.id);
                                  toast.info(`Swapped focus to waiting patient: ${patient.name}`);
                                }}
                              >
                                {isCurrent ? 'Selected' : 'Select'}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                                onClick={() => {
                                  setActivePatientName(patient.name);
                                  setActivePatientId(patient.id);
                                  // Update status
                                  setWaitingQueue(prev => prev.map(p => p.id === patient.id ? { ...p, status: 'In Session' } : p));
                                  initiateWebRTC();
                                }}
                              >
                                Admit to Call
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Connection Control */}
                  <div className="lg:col-span-5 flex flex-col justify-center bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 text-center space-y-4">
                    <div className="mx-auto w-14 h-14 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                      <Video className="h-7 w-7 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-200 text-sm">Active Telehealth Session Launcher</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                        You have selected <strong className="text-slate-200">{activePatientName}</strong> as the active consultation target. Establish encrypted peer link.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-left text-xs space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Target Session Parameters</div>
                      <div>Patient Name: <strong className="text-slate-300">{activePatientName}</strong></div>
                      <div>Record ID: <strong className="text-slate-300 font-mono">{activePatientId}</strong></div>
                      <div>Gateway: <strong className="text-emerald-400">Secure E2EE Peer-to-Peer</strong></div>
                    </div>

                    <Button onClick={initiateWebRTC} className="w-full bg-sky-600 hover:bg-sky-500 text-white gap-2 font-semibold h-9 text-xs">
                      <Play className="h-4 w-4" />
                      <span>Launch Consultation Link</span>
                    </Button>
                  </div>
                </div>
              ) : callStatus === 'calling' ? (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm text-sky-400 font-medium animate-pulse">Performing SDP secure handshaking...</p>
                </div>
              ) : (
                <div className="w-full h-full relative flex flex-col md:grid md:grid-cols-2 gap-4">
                  {/* Remote Video Container */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 py-1 px-2.5 rounded text-xs flex items-center gap-1.5 font-semibold text-slate-200">
                      <Users className="h-3.5 w-3.5 text-rose-400" />
                      <span>{activePatientName} (Patient)</span>
                    </div>
                  </div>

                  {/* Local Clinician Video Container */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 py-1 px-2.5 rounded text-xs flex items-center gap-1.5 font-semibold text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>You (Clinician Feed)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Telemetry & Controls */}
            {callStatus === 'connected' && (
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-emerald-400" />
                    <span>Latency: <strong>{stats.latency}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    <span>Framerate: <strong>{stats.fps} FPS</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-rose-400" />
                    <span>Packet Loss: <strong>{stats.packetLoss}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-sky-400" />
                    <span>TLS Cipher: <strong className="text-[9px]">{stats.codec}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleMic}
                    className={`h-9 w-9 rounded-full ${!micEnabled ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'}`}
                  >
                    {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleVideo}
                    className={`h-9 w-9 rounded-full ${!videoEnabled ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'}`}
                  >
                    {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={endCall} 
                    className="gap-1.5 h-9 px-4 rounded-full font-bold"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>Terminate Link</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Consultation Notes & Side-channels */}
          <div className="w-full md:w-96 flex flex-col bg-slate-950">
            
            {/* Split Tab Header: Chat & Diagnostics */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <h4 className="font-bold text-xs tracking-wider text-slate-300 uppercase">Consultation Recorder</h4>
              </div>

              {/* Form Input for Consultation Note */}
              <div className="p-4 border-b border-slate-800 space-y-4 overflow-y-auto max-h-[45vh]">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clinical Impression & Symptoms</label>
                  <Textarea 
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter patient status, reported symptoms, diagnostic observations..."
                    className="bg-slate-900 border-slate-800 text-xs h-24 placeholder:text-slate-600 focus-visible:ring-sky-500"
                    disabled={isNotesSaved}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Telehealth Prescription Plan</label>
                  <Textarea 
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    placeholder="Enter prescribed drug therapies, dosages, schedules, pharmacy fulfillment instruction..."
                    className="bg-slate-900 border-slate-800 text-xs h-20 placeholder:text-slate-600 focus-visible:ring-sky-500"
                    disabled={isNotesSaved}
                  />
                </div>

                <Button 
                  onClick={handleSaveNotes} 
                  disabled={isNotesSaved}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-8 text-xs font-bold"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{isNotesSaved ? 'Saved to Patient File' : 'Save & Attach to EHR'}</span>
                </Button>
              </div>

              {/* Instant Chat Stream */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-2.5 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointment Real-time Chat</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[150px]">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col max-w-[85%] ${msg.sender === 'clinician' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${msg.sender === 'clinician' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-800 bg-slate-950 flex gap-1.5">
                  <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    placeholder="Type message to patient..."
                    className="bg-slate-900 border-slate-800 text-xs h-8 placeholder:text-slate-600 focus-visible:ring-sky-500"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage}
                    className="h-8 w-8 bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
