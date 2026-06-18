"use client";

import AuthGate from "@/components/AuthGate";
import { useState, useRef, useEffect } from "react";
import {
  Video, Type, Link2, Mic, FileText, Upload, Sparkles, Settings2,
  ArrowRight, ArrowLeft, Bell, Play, Download, Share2, RefreshCw,
  Grid3x3, Clock, Mail, Zap, Check, Square, AlertCircle, X
} from "lucide-react";

type Step = "input" | "configure" | "interview" | "generating" | "result";
type InputType = "video" | "text" | "url" | "voice" | "document";
type AspectRatio = "16:9" | "9:16" | "1:1";

interface ChatMessage {
  role: "ai" | "user";
  content: string;
  options?: string[];
  styleChoices?: { name: string; colors: string[] }[];
}

interface VideoJob {
  id: string;
  status: "queued" | "analyzing" | "generating" | "rendering" | "done" | "error";
  progress: number;
  estimatedSeconds: number;
  resultUrl?: string;
  error?: string;
}

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration?: string;
  format?: string;
}

interface AdvancedSettings {
  style: string;
  captions: string;
  transition: string;
  voice: string;
  music: string;
}

const INPUT_METHODS: { type: InputType; icon: typeof Video; label: string; desc: string }[] = [
  { type: "text", icon: Type, label: "Describe It", desc: "Type your idea in plain English" },
  { type: "url", icon: Link2, label: "Paste URL", desc: "Turn any website into a video" },
  { type: "video", icon: Video, label: "Upload Video", desc: "Remix or improve existing footage" },
  { type: "voice", icon: Mic, label: "Voice Note", desc: "Speak your concept aloud" },
  { type: "document", icon: FileText, label: "Upload Doc", desc: "PDF, CSV, or DOCX input" },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; sub: string; w: number; h: number }[] = [
  { value: "16:9", label: "Landscape", sub: "YouTube", w: 52, h: 30 },
  { value: "9:16", label: "Portrait", sub: "Shorts / Reels", w: 30, h: 52 },
  { value: "1:1", label: "Square", sub: "Feed Post", w: 40, h: 40 },
];

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [inputType, setInputType] = useState<InputType | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [emailNotify, setEmailNotify] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [galleryVideos, setGalleryVideos] = useState<GalleryVideo[]>([]);
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [advSettings, setAdvSettings] = useState<AdvancedSettings>({
    style: "auto", captions: "auto", transition: "auto", voice: "auto", music: "auto"
  });
  const [showGoPro, setShowGoPro] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<VideoJob | null>(null);
  jobRef.current = job;

  useEffect(() => { fetchGallery(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    const interval = setInterval(async () => {
      const current = jobRef.current;
      if (!current || current.status === "done" || current.status === "error") return;
      try {
        const res = await fetch(`/api/status?id=${current.id}`);
        const data = await res.json();
        setJob(data);
        if (data.status === "done") {
          setStep("result");
          fetchGallery();
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      const videos = (data.videos || []).map((v: GalleryVideo) => ({
        ...v,
        thumbnail: v.thumbnail.startsWith("/") ? v.thumbnail : `/${v.thumbnail}`,
        duration: v.duration || "0:30",
        format: v.format || "16:9",
      }));
      setGalleryVideos(videos);
    } catch {
      setGalleryVideos([]);
    }
  };

  // ─── Tile click → go to configure step ───
  const handleTileClick = (type: InputType) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    setInputType(type);
    setInputValue("");
    setMessages([]);
    setBrief({});
    setStep("configure");
  };

  const handleBackToTiles = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setStep("input");
    setInputType(null);
    setInputValue("");
    setIsRecording(false);
    setRecordingTime(0);
  };

  // ─── Voice Recording ───
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const mockTranscripts = [
          "A 30-second promotional video for my coffee shop highlighting our seasonal menu",
          "Create a product demo video showing how our app helps teams collaborate",
          "Make a brand story video about our sustainable fashion company",
        ];
        const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        setInputValue(`[Voice] ${transcript}`);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) { stopRecording(); return 60; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // ─── File Upload ───
  const handleVideoFile = (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      alert("File too large. Maximum 500MB.");
      return;
    }
    setInputValue(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  };

  const handleDocFile = (file: File) => {
    const validTypes = [".pdf", ".csv", ".doc", ".docx", ".txt"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      alert(`Unsupported format. Please upload: ${validTypes.join(", ")}`);
      return;
    }
    setInputValue(`${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) handleVideoFile(file);
    else alert("Please drop a video file (MP4, MOV, AVI, WebM)");
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleDocFile(file);
  };

  // ─── Submit from configure → interview ───
  const handleInputSubmit = async () => {
    if (!inputType) return;
    if (!inputValue.trim()) {
      if (inputType === "voice") { alert("Please record a voice note first."); return; }
      if (inputType === "video") { alert("Please select or drop a video file."); return; }
      if (inputType === "document") { alert("Please select or drop a document."); return; }
      return;
    }
    setBrief(prev => ({ ...prev, aspectRatio }));
    setStep("interview");
    setIsAiTyping(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: inputType, content: inputValue, messages: [] }),
      });
      if (!res.ok) throw new Error("Interview request failed");
      const data = await res.json();
      setMessages([{ role: "ai", content: data.question, options: data.options, styleChoices: data.styleChoices }]);
      setBrief(prev => ({ ...prev, ...(data.brief || {}) }));
    } catch {
      setMessages([{ role: "ai", content: "I couldn't process that. Could you try again?" }]);
    }
    setIsAiTyping(false);
  };

  const handleChatReply = async (reply: string) => {
    const newMessages = [...messages, { role: "user" as const, content: reply }];
    setMessages(newMessages);
    setCurrentInput("");
    setIsAiTyping(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: inputType, content: inputValue, messages: newMessages, brief }),
      });
      if (!res.ok) throw new Error("Interview reply failed");
      const data = await res.json();
      if (data.complete) {
        setTimeout(() => startGeneration(data.finalBrief), 800);
      } else {
        setMessages(prev => [...prev, { role: "ai", content: data.question, options: data.options, styleChoices: data.styleChoices }]);
        setBrief(prev => ({ ...prev, ...data.brief }));
      }
    } catch {
      setMessages(prev => [...prev, { role: "ai", content: "Connection issue. Try again?" }]);
    }
    setIsAiTyping(false);
  };

  const startGeneration = async (finalBrief: Record<string, string>) => {
    setStep("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputType, inputValue,
          brief: { ...brief, ...finalBrief, aspectRatio },
          advanced: showAdvanced ? advSettings : undefined,
        }),
      });
      if (!res.ok) throw new Error("Generation request failed");
      const data = await res.json();
      setJob(data);
    } catch {
      setJob({ id: "error", status: "error", progress: 0, estimatedSeconds: 0, error: "Failed to start generation" });
    }
  };

  const handleShare = async () => {
    if (!job?.resultUrl) return;
    const fullUrl = window.location.origin + job.resultUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Check out my AI-generated video!", url: fullUrl });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch { /* cancelled */ }
  };

  const handleEmailNotify = () => {
    if (!emailNotify.includes("@")) return;
    setEmailSaved(true);
  };

  const reset = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setStep("input"); setInputType(null); setInputValue(""); setMessages([]);
    setBrief({}); setJob(null); setEmailNotify(""); setEmailSaved(false); setShowAdvanced(false);
    setIsRecording(false); setRecordingTime(0); setShareCopied(false); setAspectRatio("16:9");
  };

  const statusLabel = (status: VideoJob["status"]) => {
    switch (status) {
      case "analyzing": return "Analyzing your input";
      case "generating": return "Generating visuals with AI";
      case "rendering": return "Rendering final frames";
      case "queued": return "Queued for processing";
      case "error": return "Generation failed";
      default: return "Working";
    }
  };

  const canSubmit = () => {
    if (!inputType) return false;
    return inputValue.trim().length > 0;
  };

  const activeMethod = INPUT_METHODS.find(m => m.type === inputType);
  const thumbClass = aspectRatio === "9:16" ? "thumb-9-16" : aspectRatio === "1:1" ? "thumb-1-1" : "thumb-16-9";
  const previewClass = aspectRatio === "9:16" ? "preview-9-16" : aspectRatio === "1:1" ? "preview-1-1" : "preview-16-9";

  return (
    <div className="min-h-screen relative">
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 md:px-20 lg:px-32" style={{ height: 'var(--header-height)', backgroundColor: 'var(--bg-base)', borderBottom: 'var(--border-width) solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="w-full max-w-[var(--max-w)] mx-auto flex items-center justify-between">
          <div className="nav-logo" onClick={reset}>
            <div className="nav-logo-icon">
              <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
            </div>
            <span className="nav-logo-text">hyper<span className="accent-text">Aspect</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setStep("input"); fetchGallery(); }} className="nav-link hidden sm:flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" /> <span>Gallery</span>
            </button>
            <button onClick={() => setShowGoPro(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '0.875rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}><Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Go Pro</span></button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ═══ INPUT STEP — Tiles + Gallery ═══ */}
        {step === "input" && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center px-8 md:px-20 lg:px-32 py-20 md:py-32">
            {/* Hero */}
            <div className="text-center mb-24 md:mb-32 max-w-4xl slide-up">
              <div className="badge mb-10">
                <Zap className="w-3.5 h-3.5 text-[var(--text)]" fill="currentColor" />
                <span>AI-Powered Video Creation</span>
              </div>
              <h1 className="hero-title mb-8" style={{ lineHeight: 1.1 }}>
                What do you want to <span className="accent-text">create?</span>
              </h1>
              <p className="hero-subtitle mx-auto" style={{ lineHeight: 1.7 }}>
                Drop anything in. Our AI director asks a few quick questions, then crafts a professional video — automatically.
              </p>
            </div>

            {/* Input method tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 lg:gap-8 w-full max-w-5xl mb-32 slide-up delay-1">
              {INPUT_METHODS.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => handleTileClick(type)}
                  className="relative w-full aspect-[1/0.8] bg-[var(--accent)] border-[var(--border-width)] border-[var(--border)] shadow-[var(--shadow)] flex flex-col items-center justify-center text-center p-10 cursor-pointer transition-all duration-200 ease-out hover:shadow-[var(--shadow-lg)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                >
                  <div className="input-card-icon-wrap">
                    <Icon className="w-7 h-7 text-[var(--accent)]" />
                  </div>
                  <span className="input-card-title">{label}</span>
                  <span className="input-card-desc">{desc}</span>
                </button>
              ))}
            </div>

            {/* Gallery */}
            {galleryVideos.length > 0 && (
              <div className="w-full max-w-5xl mt-12 slide-up">
                <div className="flex items-center gap-4 mb-12">
                  <span className="section-label">Recent Creations</span>
                  <div className="flex-1 h-[3px] bg-[var(--border)]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                  {galleryVideos.slice(0, 6).map((v) => {
                    const fmt = v.format || "16:9";
                    const tClass = fmt === "9:16" ? "thumb-9-16" : fmt === "1:1" ? "thumb-1-1" : "thumb-16-9";
                    return (
                      <a href={v.url} target="_blank" rel="noopener noreferrer" key={v.id} className="relative w-full bg-[var(--bg-surface)] border-[var(--border-width)] border-[var(--border)] shadow-[var(--shadow)] p-8 overflow-hidden cursor-pointer transition-all duration-200 ease-out hover:shadow-[var(--shadow-lg)] hover:translate-x-[-2px] hover:translate-y-[-2px] group">
                        <div className="w-full h-auto object-cover border-[var(--border-width)] border-[var(--border)] mb-4 aspect-video">
                          <img src={v.thumbnail} alt={v.title} loading="lazy" />
                          <div className="video-card-play">
                            <div className="video-card-play-icon">
                              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                          <span className="video-card-duration">{v.duration}</span>
                        </div>
                        <div className="video-card-body">
                          <h4 className="video-card-title">{v.title}</h4>
                          <p className="video-card-meta">AI Generated</p>
                          {fmt !== "16:9" && <span className="video-card-format">{fmt}</span>}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CONFIGURE STEP — Input interface for selected method ═══ */}
        {step === "configure" && inputType && activeMethod && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center px-6 md:px-10 py-16 md:py-24 fade-in">
            <div className="w-full max-w-3xl">
              {/* Back button */}
              <button onClick={handleBackToTiles} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '3rem', color: 'var(--text)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}>
                <ArrowLeft className="w-4 h-4" /> Back to Options
              </button>

              {/* Header */}
              <div className="configure-header">
                <div className="configure-header-icon">
                  <activeMethod.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2>{activeMethod.label}</h2>
                  <p>{activeMethod.desc}</p>
                </div>
              </div>

              {/* Input area */}
              <div className="mb-12">
                {/* Video Upload */}
                {inputType === "video" && (
                  <div
                    className="flex flex-col items-center justify-center text-center p-16"
                    onDrop={handleVideoDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => e.preventDefault()}
                    onClick={() => videoFileRef.current?.click()}
                    style={{ cursor: "pointer", backgroundColor: 'var(--bg-surface)', border: 'var(--border-width) solid var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}
                  >
                    <input
                      ref={videoFileRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }}
                    />
                    <div className="input-card-icon-wrap mx-auto mb-6">
                      <Upload className="w-7 h-7 text-[var(--accent)]" />
                    </div>
                    <p className="text-xl font-black text-[var(--text)] uppercase tracking-wide mb-2">
                      {inputValue ? "✓ " + inputValue.slice(0, 40) : "Drop a video here"}
                    </p>
                    <p className="text-base text-[var(--text-muted)] mt-2">Click to browse · MP4, MOV, AVI up to 500MB</p>
                  </div>
                )}

                {/* Voice Recording */}
                {inputType === "voice" && (
                  <div className="flex flex-col items-center gap-8 p-16 bg-[var(--bg-surface)] border-[var(--border-width)] border-[var(--border)]" style={{ boxShadow: "var(--shadow)" }}>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-28 h-28 border-[var(--border-width)] border-[var(--border)] flex items-center justify-center transition-all ${isRecording ? "bg-[var(--lime)]" : "bg-[var(--accent)] pulse-glow"}`}
                      style={{ boxShadow: "var(--shadow-lg)" }}
                    >
                      {isRecording ? (
                        <Square className="w-10 h-10 text-[var(--text)]" fill="currentColor" />
                      ) : (
                        <Mic className="w-10 h-10 text-white" />
                      )}
                    </button>
                    <div className="text-center">
                      {isRecording ? (
                        <>
                          <p className="text-xl font-black text-[var(--text)] uppercase tracking-wide">
                            Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                          </p>
                          <p className="text-base text-[var(--text-muted)] mt-3 font-semibold uppercase tracking-wide">Tap to stop</p>
                        </>
                      ) : inputValue ? (
                        <>
                          <p className="text-base font-bold text-[var(--text)] uppercase tracking-wide mb-2">✓ Transcribed</p>
                          <p className="text-base text-[var(--text-muted)] italic">{inputValue}</p>
                        </>
                      ) : (
                        <p className="text-base font-bold text-[var(--text)] uppercase tracking-wide mb-6">Tap to speak. We&apos;ll transcribe your idea.</p>
                      )}
                    </div>
                    {isRecording && (
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3, 4].map(n => (
                          <div
                            key={n}
                            className="w-2 bg-[var(--accent)] rounded-full"
                            style={{ height: "24px", animation: `pulse 0.8s ease-in-out ${n * 0.1}s infinite` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Document Upload */}
                {inputType === "document" && (
                  <div
                    className="flex flex-col items-center justify-center text-center p-16"
                    onDrop={handleDocDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => e.preventDefault()}
                    onClick={() => docFileRef.current?.click()}
                    style={{ cursor: "pointer", backgroundColor: 'var(--bg-surface)', border: 'var(--border-width) solid var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}
                  >
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.csv,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocFile(f); }}
                    />
                    <div className="input-card-icon-wrap mx-auto mb-6">
                      <FileText className="w-7 h-7 text-[var(--accent)]" />
                    </div>
                    <p className="text-xl font-black text-[var(--text)] uppercase tracking-wide mb-2">
                      {inputValue ? "✓ " + inputValue.slice(0, 40) : "Drop a document here"}
                    </p>
                    <p className="text-base text-[var(--text-muted)] mt-2">Click to browse · PDF, CSV, DOCX up to 50MB</p>
                  </div>
                )}

                {/* Text / URL */}
                {(inputType === "text" || inputType === "url") && (
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      inputType === "url" ? "https://your-website.com" :
                      "Describe your video idea... e.g., 'A 30-second ad for my coffee shop highlighting seasonal drinks'"
                    }
                    className="flex-1 min-h-[160px] resize-none text-base outline-none px-5 py-3.5" style={{ width: '100%', backgroundColor: 'var(--bg-surface)', color: 'var(--text)', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out', borderRadius: '0' }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleInputSubmit();
                    }}
                  />
                )}
              </div>

              {/* Aspect Ratio Selector */}
              <div className="mb-12">
                <label className="block text-sm font-black text-[var(--text)] mb-5 uppercase tracking-wide">
                  Aspect Ratio
                </label>
                <div className="aspect-selector">
                  {ASPECT_RATIOS.map(({ value, label, sub, w, h }) => (
                    <button
                      key={value}
                      onClick={() => setAspectRatio(value)}
                      className={`relative w-full border-[var(--border-width)] border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)] flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-200 ease-out hover:shadow-[var(--shadow-lg)] hover:translate-x-[-2px] hover:translate-y-[-2px] ${aspectRatio === value ? "bg-[var(--yellow)] shadow-[var(--shadow-lg)] translate-x-[-2px] translate-y-[-2px]" : ""}`}
                    >
                      <div
                        className="aspect-option-shape"
                        style={{ width: `${w}px`, height: `${h}px` }}
                      />
                      <div className="aspect-option-label">{label}</div>
                      <div className="aspect-option-sub">{value} · {sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="mb-10">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="btn-ghost flex items-center gap-2"
                >
                  <Settings2 className="w-4 h-4" /> Advanced Options
                </button>
                {showAdvanced && (
                  <div className="fade-in mt-6">
                    <AdvancedPanel settings={advSettings} onChange={setAdvSettings} />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleInputSubmit}
                disabled={!canSubmit()}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out', width: '100%' }}
              >
                Start Creating <ArrowRight className="w-5 h-5" style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ INTERVIEW STEP ═══ */}
        {step === "interview" && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col max-w-2xl mx-auto px-6 py-8 slide-up">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-[var(--accent)] border-[var(--border-width)] border-[var(--border)] flex items-center justify-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-[var(--text)] tracking-[-0.01em] uppercase">AI Director</p>
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Let&apos;s craft your video</p>
              </div>
            </div>

            <div className="flex-1 space-y-6 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] fade-in">
                    <div className={`px-5 py-4 text-base leading-relaxed ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
                      {msg.content}
                    </div>
                    {msg.options && msg.options.length > 0 && msg.role === "ai" && i === messages.length - 1 && (
                      <div className="flex flex-wrap gap-3 mt-4">
                        {msg.options.map((opt) => (
                          <button key={opt} onClick={() => handleChatReply(opt)} className="chip">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.styleChoices && msg.styleChoices.length > 0 && msg.role === "ai" && i === messages.length - 1 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                        {msg.styleChoices.map((style) => (
                          <button key={style.name} onClick={() => handleChatReply(style.name)} className="style-choice">
                            <div className="style-choice-colors">
                              {style.colors.map((c, ci) => (
                                <div key={ci} className="flex-1" style={{ background: c }} />
                              ))}
                            </div>
                            <div className="style-choice-label">{style.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isAiTyping && (
                <div className="flex items-center gap-3 fade-in">
                  <div className="w-10 h-10 bg-[var(--accent)] border-[var(--border-width)] border-[var(--border)] flex items-center justify-center flex-shrink-0" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="chat-bubble-ai flex gap-1.5 items-center py-3 px-4">
                    {[0, 1, 2].map((n) => (
                      <div key={n} className="typing-dot" style={{ animationDelay: `${n * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isAiTyping && messages.length > 0 && (
              <div className="sticky bottom-0 bg-[var(--bg-base)] border-t-[var(--border-width)] border-[var(--border)] pt-4 pb-4 -mx-6 px-6">
                <div className="flex gap-3 items-end">
                  <textarea
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Type your answer..."
                    className="input-base flex-1 min-h-[52px] max-h-32 resize-none !py-3.5"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (currentInput.trim()) handleChatReply(currentInput);
                      }
                    }}
                  />
                  <button
                    onClick={() => currentInput.trim() && handleChatReply(currentInput)}
                    disabled={!currentInput.trim()}
                    className="btn-primary !p-3.5 flex-shrink-0"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ GENERATING STEP ═══ */}
        {step === "generating" && job && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center px-6 fade-in">
            {job.status === "error" ? (
              <>
                <div className="w-20 h-20 mb-8 bg-[var(--accent)] border-[var(--border-width)] border-[var(--border)] flex items-center justify-center" style={{ boxShadow: "var(--shadow)" }}>
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black mb-4 tracking-[-0.03em] uppercase">Something went wrong</h2>
                <p className="text-[var(--text-secondary)] mb-8 text-center font-semibold uppercase tracking-wide text-sm max-w-md">
                  {job.error || "We couldn't generate your video. Please try again."}
                </p>
                <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}>
                  <RefreshCw className="w-5 h-5" style={{ marginRight: '8px' }} /> Try Again
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mb-8 relative">
                  <div className="absolute inset-0 border-[var(--border-width)] border-[var(--border)] bg-[var(--bg-surface)]" style={{ boxShadow: "var(--shadow)" }} />
                  <div className="absolute inset-0 border-[var(--border-width)] border-transparent border-t-[var(--accent)] spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[var(--accent)]" />
                  </div>
                </div>

                <h2 className="text-3xl font-black mb-3 tracking-[-0.03em] uppercase">Creating your video</h2>
                <p className="text-[var(--text-secondary)] mb-10 text-center font-semibold uppercase tracking-wide text-sm">
                  {statusLabel(job.status)}<span className="inline-block animate-pulse">...</span>
                </p>

                <div className="w-full max-w-md">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-[var(--text)] font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {job.status !== "done" ? `Est. ${Math.ceil(job.estimatedSeconds * (1 - job.progress / 100))}s remaining` : "Done!"}
                    </span>
                    <span className="font-black text-[var(--text)] tabular-nums">{job.progress}%</span>
                  </div>
                  <div className="h-8 bg-[var(--bg-surface)] border-[var(--border-width)] border-[var(--border)] p-1" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <div
                      className="h-full bg-[var(--accent)] border-2 border-[var(--border)] transition-all duration-700 ease-out"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-10 w-full max-w-md">
                  <div className="flex items-center gap-3 p-4 bg-[var(--bg-surface)] border-[var(--border-width)] border-[var(--border)] transition-all" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <Mail className="w-5 h-5 text-[var(--text)] flex-shrink-0" />
                    <input
                      type="email"
                      value={emailNotify}
                      onChange={(e) => { setEmailNotify(e.target.value); setEmailSaved(false); }}
                      placeholder="Get notified by email (optional)"
                      className="flex-1 text-sm bg-transparent outline-none text-[var(--text)] placeholder-[var(--text-muted)] font-medium"
                      disabled={emailSaved}
                    />
                    {emailSaved ? (
                      <Check className="w-5 h-5 text-[var(--text)]" />
                    ) : (
                      <button
                        onClick={handleEmailNotify}
                        disabled={!emailNotify.includes("@")}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {emailSaved && (
                    <p className="text-xs text-[var(--text)] text-center mt-3 font-bold uppercase tracking-wide flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" /> We&apos;ll notify you at {emailNotify}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ RESULT STEP ═══ */}
        {step === "result" && job && job.resultUrl && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center px-6 py-16 fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--lime)] border-[var(--border-width)] border-[var(--border)] mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Check className="w-4 h-4 text-[var(--text)]" />
                <span className="text-xs font-black tracking-[0.1em] uppercase text-[var(--text)]">Ready</span>
              </div>
              <h2 className="text-4xl font-black tracking-[-0.03em] uppercase mb-3">Your video is ready</h2>
              <p className="text-[var(--text-secondary)] font-semibold uppercase tracking-wide text-sm">
                {aspectRatio} format · Review, download, or share
              </p>
            </div>

            <div className={`video-preview-wrap ${previewClass} w-full mb-10`}>
              <video src={job.resultUrl} controls className="w-full h-full object-cover" />
            </div>

            <div className="flex flex-wrap gap-3 justify-center mb-16">
              <a href={job.resultUrl} download style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}><Download className="w-5 h-5" style={{ marginRight: '8px' }} /> Download</a>
              <button onClick={handleShare} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--bg-surface)', color: 'var(--text)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}>
                {shareCopied ? <><Check className="w-5 h-5" style={{ marginRight: '8px' }} /> Copied!</> : <><Share2 className="w-5 h-5" style={{ marginRight: '8px' }} /> Share</>}
              </button>
              <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--bg-surface)', color: 'var(--text)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out' }}><RefreshCw className="w-5 h-5" style={{ marginRight: '8px' }} /> New Video</button>
            </div>
          </div>
        )}
      </main>

      {/* ─── Go Pro Modal ─── */}
      {showGoPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 fade-in" onClick={() => setShowGoPro(false)}>
          <div className="bg-[var(--bg-surface)] max-w-md w-full p-8 relative" style={{ border: 'var(--border-width) solid var(--border)', boxShadow: 'var(--shadow-lg)', margin: '0 1rem' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--yellow)] flex items-center justify-center" style={{ borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <Sparkles className="w-6 h-6 text-[var(--text)]" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-[-0.02em]">Go Pro</h3>
              </div>
              <button onClick={() => setShowGoPro(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-6 h-6" />
              </button>
            </div>
            <ul className="space-y-4 mb-8">
              {[
                "Unlimited video generations",
                "4K resolution exports",
                "Custom brand kits & templates",
                "Priority rendering queue",
                "API access for automation",
              ].map(feat => (
                <li key={feat} className="flex items-center gap-3 text-sm font-semibold text-[var(--text)]">
                  <Check className="w-5 h-5 text-[var(--text)] flex-shrink-0" /> {feat}
                </li>
              ))}
            </ul>
            <button onClick={() => setShowGoPro(false)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: 'var(--accent)', color: 'var(--bg-base)', fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', borderRadius: '0', borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)', boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out', width: '100%' }}>
              Join the Waitlist
            </button>
            <p className="text-xs text-[var(--text-muted)] text-center mt-4 font-semibold uppercase tracking-wide">Coming Soon</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvancedPanel({ settings, onChange }: { settings: AdvancedSettings; onChange: (s: AdvancedSettings) => void }) {
  const items = [
    { key: "style" as const, label: "Video Style", options: ["Auto-detect", "Corporate", "Dynamic", "Minimal"] },
    { key: "captions" as const, label: "Caption Style", options: ["Auto-detect", "Dynamic Pop-in", "Clean Bottom"] },
    { key: "transition" as const, label: "Transitions", options: ["Auto-detect", "Seamless", "Cube Effects"] },
    { key: "voice" as const, label: "Voice Style", options: ["Auto-detect", "Male Deep", "Female Energetic"] },
    { key: "music" as const, label: "Background Music", options: ["Auto-detect", "Uplifting", "Corporate Chill"] },
  ];
  return (
    <div className="bg-[var(--bg-surface)] p-6 border-[var(--border-width)] border-[var(--border)]" style={{ boxShadow: "var(--shadow)" }}>
      <h4 className="font-black mb-5 text-lg tracking-[-0.01em] uppercase">Advanced Settings</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((s) => (
          <div key={s.key}>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{s.label}</label>
            <select
              value={settings[s.key]}
              onChange={e => onChange({ ...settings, [s.key]: e.target.value.toLowerCase().split(" ")[0] })}
              className="input-base !py-2.5 !text-sm cursor-pointer"
            >
              {s.options.map(o => <option key={o} value={o.toLowerCase().split(" ")[0]}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
