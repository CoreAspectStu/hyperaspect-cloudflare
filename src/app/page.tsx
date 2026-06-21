"use client";

import AuthGate from "@/components/AuthGate";
import TemplateGallery from "@/components/TemplateGallery";
import ThematicEditor from "@/components/ThematicEditor";
import type { Template } from "@/lib/templates";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Video, Type, Link2, Mic, FileText, Upload, Sparkles, Settings2,
  ArrowRight, ArrowLeft, Bell, Play, Download, Share2, RefreshCw,
  Grid3x3, Clock, Mail, Zap, Check, Square, AlertCircle, X, LayoutGrid,
  Palette, ImageIcon, Type as TypeIcon
} from "lucide-react";
import { isClientRenderSupported, renderInBrowser, detectOptimalWorkers } from "@/lib/client-renderer";
import AdminPanel, { AdminGearButton, loadAdminConfig, saveAdminConfig, isAdminMode, type AdminRenderConfig, DEFAULT_ADMIN_CONFIG } from "@/components/AdminPanel";
import StoryModeSelector from "@/components/StoryModeSelector";
import StoryModeFlow from "@/components/StoryModeFlow";
import type { StoryModeDefinition } from "@/lib/story-modes";

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

const INPUT_METHODS: { type: InputType; icon: typeof Video; label: string; desc: string; color: string }[] = [
  { type: "text", icon: Type, label: "Describe It", desc: "Type your idea in plain English", color: "#ff0000" },
  { type: "url", icon: Link2, label: "Paste URL", desc: "Turn any website into a video", color: "#ffd60a" },
  { type: "video", icon: Video, label: "Upload Video", desc: "Remix or improve existing footage", color: "#00e5ff" },
  { type: "voice", icon: Mic, label: "Voice Note", desc: "Speak your concept aloud", color: "#b8ff00" },
  { type: "document", icon: FileText, label: "Upload Doc", desc: "PDF, CSV, or DOCX input", color: "#ff6ec7" },
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
  const [adminConfig, setAdminConfig] = useState<AdminRenderConfig>(DEFAULT_ADMIN_CONFIG);
  const [adminMode, setAdminMode] = useState(false);
  const [activeStoryMode, setActiveStoryMode] = useState<StoryModeDefinition | null>(null);
  const [emailNotify, setEmailNotify] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [galleryVideos, setGalleryVideos] = useState<GalleryVideo[]>([]);
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [advSettings, setAdvSettings] = useState<AdvancedSettings>({
    style: "auto", captions: "auto", transition: "auto", voice: "auto", music: "auto"
  });
  const [showGoPro, setShowGoPro] = useState(false);
  const [activeVideo, setActiveVideo] = useState<GalleryVideo | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem("ha_onboarded")) {
        const t = setTimeout(() => setShowOnboarding(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  // Load admin config on mount
  useEffect(() => {
    setAdminConfig(loadAdminConfig());
    setAdminMode(isAdminMode());
  }, []);

  // Brand customization state
  const [showBrand, setShowBrand] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const [brandColors, setBrandColors] = useState({ primary: "", accent: "", bg: "" });
  const [brandFonts, setBrandFonts] = useState({ heading: "", body: "" });
  const brandLogoRef = useRef<HTMLInputElement>(null);
  const [brandExtracting, setBrandExtracting] = useState(false);
  const [brandExtractNote, setBrandExtractNote] = useState<string | null>(null);

  // Body scroll lock whenever any modal/popup is open
  useEffect(() => {
    const anyModalOpen = !!activeVideo || showGoPro;
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [activeVideo, showGoPro]);

  const handleTemplateSelect = (template: Template) => {
    // Pre-fill the brief with template info and go to interview
    setBrief(prev => ({
      ...prev,
      _template_id: template.id,
      _template_name: template.name,
      _template_category: template.category,
      _template_duration: String(template.default_duration_sec),
    }));
    setInputValue(`I want to create a ${template.name} video. ${template.description}`);
    setInputType("text");
    setShowTemplates(false);
    setStep("configure");
  };
  const [galleryFilter, setGalleryFilter] = useState<string>("all");
  const [galleryLimit, setGalleryLimit] = useState(6);
  const [shareCopied, setShareCopied] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File upload state + ref. The render backend cannot ingest files yet, so the
  // File object is held here and its metadata is forwarded in the brief.
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const brandFileRef = useRef<HTMLInputElement>(null);
  const uploadedFileRef = useRef<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<VideoJob | null>(null);
  jobRef.current = job;

  useEffect(() => { fetchGallery(); }, []);

  // P0-4 fix: Resume in-progress job after page refresh (up to 10 min)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ha_active_job");
      if (!saved) return;
      const { id, savedAt } = JSON.parse(saved);
      const ageMin = (Date.now() - savedAt) / 60000;
      if (ageMin > 10 || !id || id.startsWith("error") || id.startsWith("pending") || id.startsWith("client-")) {
        localStorage.removeItem("ha_active_job");
        return;
      }
      // Resume — set job + step so polling picks up
      setJob({ id, status: "queued", progress: 0, estimatedSeconds: 120 });
      setStep("generating");
    } catch {}
  }, []);

  // P0-4 fix: Persist active job ID to localStorage for refresh recovery
  useEffect(() => {
    if (job && job.id && !job.id.startsWith("error") && !job.id.startsWith("pending") && !job.id.startsWith("client-")) {
      if (job.status === "done" || job.status === "error") {
        localStorage.removeItem("ha_active_job");
      } else {
        localStorage.setItem("ha_active_job", JSON.stringify({ id: job.id, savedAt: Date.now() }));
      }
    }
  }, [job]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    let pollCount = 0;
    const MAX_POLLS = 120; // 10 minutes at 5s intervals
    const interval = setInterval(async () => {
      const current = jobRef.current;
      if (!current || current.status === "done" || current.status === "error") return;
      if (!current.id || current.id === "pending") return; // Skip polling until real job ID arrives
      pollCount++;
      if (pollCount > MAX_POLLS) {
        // Timeout — show error instead of infinite spinner (P0-1 fix)
        setJob({ ...current, status: "error", error: "Render timed out (10 min). Please try again." });
        generatingRef.current = false;
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${current.id}`);
        const data = await res.json();
        // Merge: update status, progress, error, and resultUrl from poll response
        const updated = {
          ...current,
          status: data.status,
          progress: data.progress,
          error: data.error || current.error,
          resultUrl: data.resultUrl || current.resultUrl,
        };
        setJob(updated);
        if (data.status === "done") {
          setStep("result");
          fetchGallery();
          // Send email notification if user opted in
          if (emailSaved && emailNotify) {
            fetch("/api/notify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: emailNotify,
                jobId: current.id,
                videoName: current.id,
                status: "done",
                videoUrl: data.resultUrl
                  ? `${window.location.origin}${data.resultUrl}`
                  : undefined,
              }),
            }).catch(() => {});
          }
        }
        if (data.status === "error") {
          // Notify on failure too
          if (emailSaved && emailNotify) {
            fetch("/api/notify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: emailNotify,
                jobId: current.id,
                videoName: current.id,
                status: "error",
              }),
            }).catch(() => {});
          }
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
    setUploadStatus("idle"); setUploadProgress(0); setUploadError(null);
    setTranscribeError(null);
    uploadedFileRef.current = null;
    setStep("configure");
  };

  // ─── URL → Brand Extraction ───
  const handleBrandExtract = async (url: string) => {
    if (!url.trim() || !/^https?:\/\//.test(url.trim())) return;
    setBrandExtracting(true);
    setBrandExtractNote(null);
    try {
      const res = await fetch("/api/brand-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Extraction failed (${res.status})`);
      }
      const data = await res.json();
      if (data.brand) {
        setBrandColors({
          primary: data.brand.colors?.primary || "",
          accent: data.brand.colors?.accent || "",
          bg: data.brand.colors?.bg || "",
        });
        if (data.brand.fonts) {
          setBrandFonts({
            heading: data.brand.fonts.heading || "",
            body: data.brand.fonts.body || "",
          });
        }
        setShowBrand(true);
        setBrandExtractNote(data.brand.notes || `Brand extracted (confidence: ${data.brand.confidence || "unknown"})`);
      }
      // Also pre-fill the text input with scraped content if empty
      if (data.scrapedText && !inputValue) {
        const st = data.scrapedText;
        const summary = [st.h1, st.metaDescription || st.firstParagraph]
          .filter(Boolean).join(" — ").slice(0, 300);
        if (summary) setInputValue(`From ${url}:\n${summary}`);
      }
    } catch (err) {
      setBrandExtractNote(err instanceof Error ? err.message : "Brand extraction failed");
    } finally {
      setBrandExtracting(false);
    }
  };

  // ─── Brand Extract from File (PDF/Image) ───
  const handleBrandExtractFile = async (file: File) => {
    const validTypes = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      setBrandExtractNote(`Unsupported format. Use: ${validTypes.join(", ")}`);
      return;
    }
    setBrandExtracting(true);
    setBrandExtractNote(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/brand-extract-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Extraction failed (${res.status})`);
      }
      const data = await res.json();
      if (data.brand) {
        setBrandColors({
          primary: data.brand.colors?.primary || "",
          accent: data.brand.colors?.accent || "",
          bg: data.brand.colors?.bg || "",
        });
        if (data.brand.fonts) {
          setBrandFonts({
            heading: data.brand.fonts.heading || "",
            body: data.brand.fonts.body || "",
          });
        }
        setShowBrand(true);
        setBrandExtractNote(
          data.brand.notes ||
            `Brand extracted from ${data.source || file.name} (confidence: ${data.brand.confidence || "unknown"})`
        );
      } else {
        setBrandExtractNote(
          data.warning || "No brand info detected in this file."
        );
      }
    } catch (err) {
      setBrandExtractNote(
        err instanceof Error ? err.message : "File brand extraction failed"
      );
    } finally {
      setBrandExtracting(false);
    }
  };

  // ─── Brand Logo Upload ───
  const handleBrandLogoUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      alert("Logo too large. Maximum 4MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }
    setBrandLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/brand-upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      if (data.logoUrl) setBrandLogo(data.logoUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setBrandLogoUploading(false);
    }
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
    setUploadStatus("idle"); setUploadProgress(0); setUploadError(null);
    setTranscribeError(null);
    uploadedFileRef.current = null;
    // Reset brand state
    setShowBrand(false); setBrandLogo(null);
    setBrandColors({ primary: "", accent: "", bg: "" });
    setBrandFonts({ heading: "", body: "" });
    setBrandExtracting(false); setBrandExtractNote(null);
  };

  // ─── Voice Recording ───
  const startRecording = async () => {
    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        if (blob.size === 0) return;
        // Real transcription via /api/transcribe (replaces the client-side mock)
        setIsTranscribing(true);
        setTranscribeError(null);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
          const data = await res.json();
          const text = (data.text || "").trim();
          if (!text) throw new Error("No transcript returned");
          setInputValue(text);
        } catch (err) {
          setTranscribeError(err instanceof Error ? err.message : "Transcription failed. Please try typing your idea instead.");
        } finally {
          setIsTranscribing(false);
        }
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
  // The render backend cannot ingest files yet. We validate client-side, hold
  // the File object in uploadedFileRef, and forward its metadata (name/size/
  // type) in the generation brief. processUpload() reports progress now and can
  // be swapped for a real fetch('/api/upload', { body: formData }) later.
  const processUpload = (file: File) =>
    new Promise<void>((resolve, reject) => {
      if (file.size === 0) { reject(new Error("File is empty")); return; }
      let pct = 0;
      const interval = setInterval(() => {
        pct = Math.min(100, pct + 12 + Math.random() * 18);
        setUploadProgress(Math.round(pct));
        if (pct >= 100) { clearInterval(interval); resolve(); }
      }, 70);
    });

  const handleVideoFile = async (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      setUploadError("File too large. Maximum 500MB.");
      setUploadStatus("error");
      return;
    }
    setUploadError(null);
    setUploadStatus("uploading");
    setUploadProgress(0);
    try {
      await processUpload(file);
      uploadedFileRef.current = file;
      setInputValue(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      setUploadStatus("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("error");
    }
  };

  const handleDocFile = async (file: File) => {
    const validTypes = [".pdf", ".csv", ".doc", ".docx", ".txt"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      setUploadError(`Unsupported format. Please upload: ${validTypes.join(", ")}`);
      setUploadStatus("error");
      return;
    }
    setUploadError(null);
    setUploadStatus("uploading");
    setUploadProgress(0);
    try {
      await processUpload(file);
      uploadedFileRef.current = file;
      setInputValue(`${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
      setUploadStatus("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("error");
    }
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
      if (inputType === "voice") {
        setTranscribeError("Please record a voice note first.");
        return;
      }
      if (inputType === "video") {
        setUploadError("Please select or drop a video file.");
        setUploadStatus("error");
        return;
      }
      if (inputType === "document") {
        setUploadError("Please select or drop a document.");
        setUploadStatus("error");
        return;
      }
      return;
    }
    if (inputType === "voice" && isTranscribing) {
      setTranscribeError("Transcription in progress. Please wait."); return;
    }
    if ((inputType === "video" || inputType === "document") && uploadStatus !== "done") {
      setUploadError("Please wait for upload to complete."); return;
    }

    setBrief(prev => ({ ...prev, aspectRatio }));
    setStep("interview");
    setIsAiTyping(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: inputType,
          content: inputValue,
          messages: [],
          template_id: brief._template_id,
          brief,
        }),
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

  // ─── Story Mode completion handler ──────────────────────────────────────
  // Called when StoryModeFlow finishes: takes the generated storyboard manifest
  // and triggers the render pipeline via /api/generate
  const handleStoryModeComplete = async (customManifest: any, modeName: string) => {
    setStep("generating");
    setJob({
      id: "pending",
      status: "queued",
      progress: 0,
      estimatedSeconds: 180,
    });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboardManifest: customManifest,
          brief: { aspectRatio: customManifest?.aspect_ratio || "16:9" },
          renderConfig: adminMode ? adminConfig : undefined,
        }),
      });
      if (!res.ok) throw new Error("Generation request failed");
      const data = await res.json();
      setJob(data);
    } catch {
      setJob({ id: "error", status: "error", progress: 0, estimatedSeconds: 0, error: "Failed to start story mode generation" });
    }
  };

  const generatingRef = useRef(false); // P2-4: double-submit guard

  const startGeneration = async (finalBrief: Record<string, string>) => {
    // P2-4 fix: prevent double-submit (double-click, Enter key, etc.)
    if (generatingRef.current) return;
    generatingRef.current = true;
    setStep("generating");
    // Set placeholder job immediately so the generating UI shows instantly
    setJob({
      id: "pending",
      status: "queued",
      progress: 0,
      estimatedSeconds: adminConfig.engine === "client" ? 10 : 120,
    });

    // ─── Determine render engine ───────────────────────────────────────────
    // adminConfig.engine: "auto" | "server" | "client"
    // IMPORTANT: client rendering is a POC that renders a hardcoded demo animation,
    // NOT the user's actual content. Only use it when explicitly selected via admin.
    // "auto" defaults to server render for all real generation paths.
    const useClientRender = adminConfig.engine === "client" && isClientRenderSupported();

    if (useClientRender) {
      try {
        // Dimensions from aspect ratio
        const dims = aspectRatio === "9:16" ? { w: 1080, h: 1920 }
          : aspectRatio === "1:1" ? { w: 1080, h: 1080 }
          : { w: 1920, h: 1080 };

        // Duration from admin config or default 10s
        const renderDuration = adminMode ? adminConfig.durationCap : 10;
        const renderFps = adminMode ? adminConfig.framerate : 30;

        setJob({
          id: "client-" + Date.now().toString(36),
          status: "rendering",
          progress: 2,
          estimatedSeconds: 5,
        });

        const result = await renderInBrowser({
          duration: renderDuration,
          fps: renderFps,
          width: dims.w,
          height: dims.h,
          onProgress: (frame, total) => {
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    progress: Math.round((frame / total) * 100),
                    estimatedSeconds: Math.max(1, Math.round((total - frame) / 60)),
                  }
                : prev,
            );
          },
        });

        // Create a local URL for the rendered video
        const url = URL.createObjectURL(result.blob);

        // Report telemetry to server for admin dashboard (fire and forget)
        fetch("/api/client-render-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: brief._template_id || "browser-render",
            renderTime: result.duration,
            framesEncoded: result.framesEncoded,
            workerCount: result.workerCount,
            codec: result.codec,
            hardwareAccelerated: result.hardwareAccelerated,
            fileSize: result.blob.size,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});

        setJob({
          id: "client-" + Date.now().toString(36),
          status: "done",
          progress: 100,
          estimatedSeconds: 0,
          resultUrl: url,
        });
        setStep("result");
        fetchGallery();
        return; // Skip server render
      } catch (err) {
        // Browser render failed — fall through to server render
        console.warn("Browser render failed, falling back to server:", err);
      }
    }

    // ─── Server render path (existing pipeline — unchanged) ─────────────
    // Forward uploaded file metadata in the brief so the render backend can use
    // it. The File object itself is held in uploadedFileRef and will be sent
    // once the backend supports file ingestion.
    const uploadedFile = uploadedFileRef.current;
    const fileMeta = uploadedFile
      ? { _file_name: uploadedFile.name, _file_size: String(uploadedFile.size), _file_type: uploadedFile.type }
      : {};
    // Forward brand overrides (set by BrandPanel)
    const brandMeta: Record<string, string> = {};
    if (brandLogo) brandMeta._brand_logo = brandLogo;
    if (brandColors.primary) brandMeta._brand_primary = brandColors.primary;
    if (brandColors.accent) brandMeta._brand_accent = brandColors.accent;
    if (brandColors.bg) brandMeta._brand_bg = brandColors.bg;
    if (brandFonts.heading) brandMeta._brand_font_heading = brandFonts.heading;
    if (brandFonts.body) brandMeta._brand_font_body = brandFonts.body;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputType, inputValue,
          brief: { ...brief, ...finalBrief, ...fileMeta, ...brandMeta, aspectRatio },
          advanced: showAdvanced ? advSettings : undefined,
          renderConfig: adminMode ? adminConfig : undefined,
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

  const handleEmailNotify = async () => {
    if (!emailNotify.includes("@")) return;
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNotify, type: "render-notify", jobId: job?.id }),
      });
    } catch { /* non-critical */ }
    setEmailSaved(true);
  };

  const reset = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setStep("input"); setInputType(null); setInputValue(""); setMessages([]);
    setBrief({}); setJob(null); setEmailNotify(""); setEmailSaved(false); setShowAdvanced(false);
    localStorage.removeItem("ha_active_job"); // P0-4: clear persisted job
    generatingRef.current = false; // P2-4: reset double-submit guard
    setIsRecording(false); setRecordingTime(0); setShareCopied(false); setAspectRatio("16:9");
    setUploadStatus("idle"); setUploadProgress(0); setUploadError(null);
    setTranscribeError(null); uploadedFileRef.current = null;
    setActiveStoryMode(null);
    // Reset brand state
    setShowBrand(false); setBrandLogo(null);
    setBrandColors({ primary: "", accent: "", bg: "" });
    setBrandFonts({ heading: "", body: "" });
    setBrandExtracting(false); setBrandExtractNote(null);
  };

  const statusLabel = (status: VideoJob["status"]) => {
    switch (status) {
      case "analyzing": return "Analyzing your input";
      case "generating": return "Generating visuals with AI";
      case "rendering": return "Rendering your video";
      case "queued": return "Queued — waiting for render slot";
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
            <button onClick={() => { setStep("input"); fetchGallery(); setTimeout(() => document.getElementById('gallery-section')?.scrollIntoView({ behavior: 'smooth' }), 200); }} className="btn-secondary hidden sm:flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '0.75rem' }}>
              <Grid3x3 className="w-4 h-4" /> <span>Gallery</span>
            </button>
            <button onClick={() => setShowGoPro(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 20px', fontSize: '0.875rem' }}><Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Go Pro</span></button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ═══ STORY MODE FLOW — Interview → Storyboard → Generate ═══ */}
        {step === "input" && activeStoryMode && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center px-4 sm:px-8 md:px-20 lg:px-32 py-12">
            <StoryModeFlow
              mode={activeStoryMode}
              onBack={() => setActiveStoryMode(null)}
              onComplete={handleStoryModeComplete}
            />
          </div>
        )}

        {/* ═══ INPUT STEP — Tiles + Gallery ═══ */}
        {step === "input" && !activeStoryMode && (
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col items-center px-4 sm:px-8 md:px-20 lg:px-32 py-12 sm:py-20 md:py-32">
            {/* Hero */}
            <div className="text-center mb-12 sm:mb-24 md:mb-32 max-w-4xl slide-up">
              <div className="badge mb-10">
                <Zap className="w-3.5 h-3.5 text-[var(--text)]" fill="currentColor" />
                <span>AI-Powered Video Creation</span>
              </div>
              <h1 className="hero-title mb-8" style={{ lineHeight: 1.1, fontSize: 'clamp(2rem, 7vw, 3.75rem)' }}>
                What do you want to <span className="accent-text">create?</span>
              </h1>
              <p className="hero-subtitle mx-auto" style={{ lineHeight: 1.7 }}>
                Drop anything in. Our AI director asks a few quick questions, then crafts a professional video — automatically.
              </p>
            </div>

            {/* View toggle: Create from scratch vs Browse Templates */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 slide-up delay-1 w-full max-w-lg">
              <button
                onClick={() => setShowTemplates(false)}
                className="btn-secondary"
                style={{
                  padding: "10px 20px", fontSize: "0.85rem", fontWeight: 800,
                  backgroundColor: !showTemplates ? "#0a0a0a" : "var(--surface)",
                  color: !showTemplates ? "var(--bg-base)" : "var(--text)",
                  border: "4px solid var(--border)",
                  boxShadow: "4px 4px 0 var(--border)",
                }}
              >
                <Sparkles className="w-4 h-4" /> Create from Scratch
              </button>
              <button
                onClick={() => setShowTemplates(true)}
                className="btn-primary"
                style={{
                  padding: "10px 20px", fontSize: "0.85rem", fontWeight: 800,
                  backgroundColor: showTemplates ? "var(--accent)" : "var(--surface)",
                  color: showTemplates ? "#fff" : "var(--text)",
                  border: "4px solid var(--border)",
                  boxShadow: "4px 4px 0 var(--border)",
                }}
              >
                <LayoutGrid className="w-4 h-4" /> Browse Templates (50)
              </button>
            </div>

            {/* Template Gallery OR Input tiles */}
            {showTemplates ? (
              <div className="w-full max-w-6xl slide-up delay-1">
                <TemplateGallery onSelectTemplate={handleTemplateSelect} />
              </div>
            ) : (
            <>
            {/* Input method tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 w-full max-w-5xl mb-16 sm:mb-24 md:mb-28 slide-up delay-1">
              {INPUT_METHODS.map(({ type, icon: Icon, label, desc, color }) => (
                <button
                  key={type}
                  onClick={() => handleTileClick(type)}
                  className="input-card relative w-full flex flex-col items-center justify-center text-center cursor-pointer"
                  style={{ backgroundColor: color }}
                >
                  <div className="input-card-icon-wrap">
                    <Icon className="w-7 h-7" style={{ color: '#0a0a0a' }} />
                  </div>
                  <span className="input-card-title">{label}</span>
                  <span className="input-card-desc">{desc}</span>
                </button>
              ))}
            </div>

            {/* Story Mode Selector */}
            {!showTemplates && (
              <div className="w-full max-w-6xl slide-up delay-2 mt-4">
                <div className="flex items-center gap-4 mb-6">
                  <span className="section-label">Story Modes</span>
                  <div className="flex-1 h-[3px] bg-[var(--border)]" />
                  <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wide">Guided AI Director</span>
                </div>
                <StoryModeSelector onSelect={(mode) => {
                  if (mode.id === "custom") {
                    setShowTemplates(false);
                  } else {
                    setActiveStoryMode(mode);
                  }
                }} />
              </div>
            )}

            {/* Gallery */}
            {galleryVideos.length > 0 && (
              <div id="gallery-section" className="w-full max-w-5xl mt-12 slide-up">
                <div className="flex items-center gap-4 mb-8">
                  <span className="section-label">Recent Creations</span>
                  <div className="flex-1 h-[3px] bg-[var(--border)]" />
                </div>
                <div className="flex gap-3 mb-8 flex-wrap">
                  {["all", "16:9", "9:16", "1:1"].map(f => (
                    <button key={f} onClick={() => setGalleryFilter(f)} className="chip" style={galleryFilter === f ? { backgroundColor: '#ff0000', color: '#fff' } : {}}>
                      {f === "all" ? "All" : f === "16:9" ? "16:9 Landscape" : f === "9:16" ? "9:16 Portrait" : "1:1 Square"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                  {galleryVideos.filter(v => galleryFilter === "all" || (v.format || "16:9") === galleryFilter).slice(0, galleryLimit).map((v) => {
                    const fmt = v.format || "16:9";
                    const tClass = fmt === "9:16" ? "thumb-9-16" : fmt === "1:1" ? "thumb-1-1" : "thumb-16-9";
                    return (
                      <div onClick={() => setActiveVideo(v)} key={v.id} className="video-card relative w-full overflow-hidden cursor-pointer group">
                        <div className="video-card-thumbnail w-full h-auto object-cover mb-4" style={{ aspectRatio: fmt === "9:16" ? '9 / 16' : fmt === "1:1" ? '1 / 1' : '16 / 9', overflow: 'hidden' }}>
                          <img src={v.thumbnail} alt={v.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div className="video-card-play">
                            <div className="video-card-play-icon">
                              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                          <span className="video-card-duration">{v.duration}</span>
                          <span className="video-card-format" style={{ position: 'absolute', top: '8px', left: '8px' }}>{fmt}</span>
                        </div>
                        <div className="video-card-body">
                          <h4 className="video-card-title">{v.title}</h4>
                          <p className="video-card-meta">AI Generated</p>
                        </div>
                      </div>
                    );
                  })}
                  {galleryVideos.filter(v => galleryFilter === "all" || (v.format || "16:9") === galleryFilter).length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                        No {galleryFilter} videos yet — create one!
                      </p>
                    </div>
                  )}
                </div>
                {(() => {
                  const total = galleryVideos.filter(v => galleryFilter === "all" || (v.format || "16:9") === galleryFilter).length;
                  if (total > galleryLimit) {
                    return (
                      <div style={{ textAlign: "center", marginTop: "3rem" }}>
                        <button
                          onClick={() => setGalleryLimit(galleryLimit + 6)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '14px 32px',
                            backgroundColor: 'var(--accent)', color: 'var(--bg-base)',
                            fontSize: '0.95rem', fontWeight: '900', textTransform: 'uppercase',
                            borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)',
                            boxShadow: 'var(--shadow)', transition: 'all 0.2s ease-out',
                            cursor: 'pointer',
                          }}
                        >
                          Load More ({total - galleryLimit} remaining)
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            </>
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
                        {transcribeError && (
                        <p className="text-red-500 text-sm mt-3">Error: {transcribeError}</p>
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

                {/* Brand Extract from File — shown for all input types */}
                <div style={{ marginTop: "12px" }}>
                  <input
                    ref={brandFileRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBrandExtractFile(f);
                    }}
                  />
                  <button
                    onClick={() => brandFileRef.current?.click()}
                    disabled={brandExtracting}
                    className="btn-ghost"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 20px",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      opacity: brandExtracting ? 0.5 : 1,
                      cursor: brandExtracting ? "wait" : "pointer",
                    }}
                  >
                    {brandExtracting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Extracting brand...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Extract Brand from PDF/Image</span>
                      </>
                    )}
                  </button>
                  {brandExtractNote && inputType !== "url" && (
                    <p
                      style={{
                        marginTop: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                      }}
                    >
                      {brandExtractNote}
                    </p>
                  )}
                </div>

                {/* Text / URL */}
                {(inputType === "text" || inputType === "url") && (
                  <div>
                    {inputType === "url" && (
                      <label htmlFor="url-input" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text)', marginBottom: '8px' }}>
                        Website URL
                      </label>
                    )}
                    <textarea
                      id="url-input"
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
                    {inputType === "url" && (
                      <div style={{ marginTop: "12px" }}>
                        <button
                          onClick={() => handleBrandExtract(inputValue)}
                          disabled={!inputValue.trim() || !/^https?:\/\//.test(inputValue.trim()) || brandExtracting}
                          className="btn-ghost"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "10px 20px", fontSize: "0.85rem", fontWeight: 800,
                            opacity: (!inputValue.trim() || !/^https?:\/\//.test(inputValue.trim()) || brandExtracting) ? 0.5 : 1,
                            cursor: brandExtracting ? "wait" : "pointer",
                          }}
                        >
                          {brandExtracting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Extracting brand...</span>
                            </>
                          ) : (
                            <>
                              <Palette className="w-4 h-4" />
                              <span>Auto-Extract Brand from URL</span>
                            </>
                          )}
                        </button>
                        {brandExtractNote && (
                          <p style={{ marginTop: "8px", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            {brandExtractNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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

              {/* Brand Customization */}
              <div className="mb-10">
                <button
                  onClick={() => setShowBrand(!showBrand)}
                  className="btn-ghost flex items-center gap-2"
                >
                  <Palette className="w-4 h-4" /> Brand Kit
                  {(brandLogo || brandColors.primary || brandColors.accent) && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: "20px", height: "20px",
                      backgroundColor: "var(--accent)", color: "#fff",
                      fontSize: "0.65rem", fontWeight: 900, borderRadius: "50%",
                      border: "2px solid var(--border)",
                    }}>✓</span>
                  )}
                </button>
                {showBrand && (
                  <div className="fade-in mt-6">
                    <BrandPanel
                      logoUrl={brandLogo}
                      onLogoUpload={handleBrandLogoUpload}
                      onLogoRemove={() => setBrandLogo(null)}
                      uploading={brandLogoUploading}
                      logoInputRef={brandLogoRef}
                      colors={brandColors}
                      onColorsChange={setBrandColors}
                      fonts={brandFonts}
                      onFontsChange={setBrandFonts}
                    />
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
          <div className="min-h-[calc(100vh-var(--header-height))] flex flex-col justify-start md:justify-center max-w-2xl mx-auto px-4 sm:px-6 py-8 slide-up overflow-y-auto">
            <div className="flex items-center gap-3 mb-6 sm:mb-8 flex-shrink-0">
              <div className="w-12 h-12 bg-[var(--accent)] border-[var(--border-width)] border-[var(--border)] flex items-center justify-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-[var(--text)] tracking-[-0.01em] uppercase">AI Director</p>
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Let&apos;s craft your video</p>
              </div>
            </div>

            <div className="space-y-6 mb-4">
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
                <h2 className="text-3xl font-black mb-4 tracking-[-0.03em] uppercase">Render failed</h2>
                <p className="text-[var(--text-secondary)] mb-4 text-center font-semibold uppercase tracking-wide text-sm max-w-md">
                  {job.error || "We couldn't generate your video. Please try again."}
                </p>
                {job.id && job.id.includes("-") && (
                  <p className="text-[var(--text-secondary)] mb-8 text-center text-xs opacity-60">
                    Job ID: <code>{job.id}</code>
                  </p>
                )}
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
        {job && job.resultUrl && (
        <ThematicEditor
          videoUrl={job.resultUrl}
          brief={brief}
          templateId={brief._template_id}
          jobId={job.id}
        />
      )}

        {/* ─── Waitlist CTA ─── */}
        {step === "input" && (
          <div className="w-full max-w-3xl mx-auto px-8 md:px-20 lg:px-32 py-20 mb-20 text-center slide-up">
            <div className="badge mb-8" style={{ display: 'inline-flex' }}>
              <Mail className="w-3.5 h-3.5" />
              <span>Get Early Access</span>
            </div>
            <h2 className="hero-title mb-6" style={{ fontSize: '2.5rem' }}>
              Want <span className="accent-text">pro features?</span>
            </h2>
            <p className="hero-subtitle mb-10" style={{ maxWidth: '500px', margin: '0 auto 40px' }}>
              Join the waitlist for priority access, custom branding, HD exports, and more.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement;
                const feedback = document.getElementById('waitlist-feedback');
                const val = input.value.trim();
                if (!val) return;
                if (feedback) { feedback.textContent = ''; feedback.style.color = ''; }
                try {
                  const res = await fetch('/api/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: val }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    input.value = '';
                    input.placeholder = 'your@email.com';
                    if (feedback) {
                      feedback.textContent = '✓ ' + data.message;
                      feedback.style.color = '#00c853';
                    }
                  } else {
                    if (feedback) {
                      feedback.textContent = '✗ ' + data.message;
                      feedback.style.color = '#ff1744';
                    }
                  }
                } catch {
                  if (feedback) {
                    feedback.textContent = '✗ Network error. Please try again.';
                    feedback.style.color = '#ff1744';
                  }
                }
              }}
              className="flex gap-4 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="input-base flex-1"
                style={{
                  height: '56px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-surface)',
                  borderWidth: 'var(--border-width)', borderStyle: 'solid', borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow)',
                }}
              />
              <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '14px 28px' }}>
                Join Waitlist
              </button>
            </form>
            <div id="waitlist-feedback" style={{ minHeight: '24px', marginTop: '12px', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }} />
          </div>
        )}
      </main>

      {/* ─── Onboarding Modal ─── */}
      {showOnboarding && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => {
          setShowOnboarding(false);
          try { localStorage.setItem("ha_onboarded", "1"); } catch {}
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'var(--bg-surface)',
            border: '4px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            padding: '40px',
            maxWidth: '540px',
            width: '90%',
            position: 'relative',
          }}>
            <button onClick={() => {
              setShowOnboarding(false);
              try { localStorage.setItem("ha_onboarded", "1"); } catch {}
            }} style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.5rem', fontWeight: 900,
            }}>✕</button>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '64px', height: '64px',
                backgroundColor: 'var(--accent)',
                border: '4px solid var(--border)',
                boxShadow: 'var(--shadow)',
                marginBottom: '24px',
              }}>
                <Sparkles style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>

              <h2 style={{
                fontSize: '1.75rem', fontWeight: 900,
                color: 'var(--text)', marginBottom: '16px',
                textTransform: 'uppercase', letterSpacing: '-0.02em',
              }}>
                Welcome to HyperAspect
              </h2>

              <p style={{
                fontSize: '1rem', fontWeight: 600,
                color: 'var(--text-muted)', marginBottom: '32px',
                lineHeight: 1.5,
              }}>
                Create professional videos in 30 seconds. Here's how:
              </p>

              <div style={{ textAlign: 'left', marginBottom: '32px' }}>
                {[
                  { icon: TypeIcon, title: '1. Describe', desc: 'Type your idea or paste a URL' },
                  { icon: LayoutGrid, title: '2. Pick a Template', desc: '50+ templates for any industry' },
                  { icon: Sparkles, title: '3. Generate', desc: 'AI does the rest — narration, music, captions' },
                  { icon: Download, title: '4. Download', desc: 'Get your video or upload to YouTube' },
                ].map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '12px 0',
                    borderBottom: i < 3 ? '2px dashed var(--border)' : 'none',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '40px', height: '40px', flexShrink: 0,
                      backgroundColor: 'var(--bg-base)',
                      border: '3px solid var(--border)',
                    }}>
                      <step.icon style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                        {step.title}
                      </div>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => {
                setShowOnboarding(false);
                try { localStorage.setItem("ha_onboarded", "1"); } catch {}
              }} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '14px 32px',
                backgroundColor: 'var(--accent)', color: 'white',
                fontSize: '1rem', fontWeight: 900,
                textTransform: 'uppercase',
                border: '4px solid var(--border)',
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
              }}>
                Let's Go <ArrowRight style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Video Player Modal (Portal) ─── */}
      {activeVideo && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setActiveVideo(null)} style={{ overflowY: 'auto' }}>
        <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#fef6e4',
            border: '4px solid #0a0a0a',
            boxShadow: '10px 10px 0px #0a0a0a',
            padding: '32px',
            maxWidth: activeVideo.format === '9:16' ? '400px' : activeVideo.format === '1:1' ? '600px' : '900px',
            width: '90%',
            position: 'relative',
            margin: 'auto',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <button onClick={() => setActiveVideo(null)} style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: '#fef6e4',
              border: '4px solid #0a0a0a',
              boxShadow: '4px 4px 0px #0a0a0a',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
            }} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <div style={{
              border: '4px solid #0a0a0a',
              boxShadow: '6px 6px 0px #0a0a0a',
              marginBottom: '20px',
              aspectRatio: activeVideo.format === '9:16' ? '9 / 16' : activeVideo.format === '1:1' ? '1 / 1' : '16 / 9',
              backgroundColor: '#000',
              maxHeight: activeVideo.format === '9:16' ? '70vh' : 'auto',
              margin: activeVideo.format === '9:16' ? '0 auto' : '0',
              width: activeVideo.format === '9:16' ? 'auto' : '100%',
            }}>
              <video
                src={activeVideo.url}
                controls
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              {activeVideo.title}
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                backgroundColor: '#ff0000',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}>{activeVideo.format || '16:9'}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b6b6b', textTransform: 'uppercase' }}>AI Generated</span>
              {activeVideo.duration && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b6b6b' }}>{activeVideo.duration}</span>}
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
              <a
                href={activeVideo.url}
                download
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '12px 20px', backgroundColor: '#ff0000', color: '#fff',
                  fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase',
                  border: '4px solid #0a0a0a', boxShadow: '4px 4px 0px #0a0a0a',
                  cursor: 'pointer', textDecoration: 'none',
                }}
              >
                <Download className="w-4 h-4" /> Download
              </a>
              <button
                onClick={async () => {
                  const fullUrl = window.location.origin + activeVideo.url;
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: activeVideo.title, url: fullUrl });
                    } else {
                      await navigator.clipboard.writeText(fullUrl);
                    }
                  } catch { /* cancelled */ }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '12px 20px', backgroundColor: '#fef6e4', color: '#0a0a0a',
                  fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase',
                  border: '4px solid #0a0a0a', boxShadow: '4px 4px 0px #0a0a0a',
                  cursor: 'pointer',
                }}
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
        </div>,
        document.body
      )}

      {/* ─── Go Pro Modal (Portal) ─── */}
      {showGoPro && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 fade-in" style={{ overflowY: 'auto' }} onClick={() => setShowGoPro(false)}>
        <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div className="bg-[var(--bg-surface)] max-w-md w-full p-8 relative" style={{ border: 'var(--border-width) solid var(--border)', boxShadow: 'var(--shadow-lg)', margin: 'auto' }} onClick={e => e.stopPropagation()}>
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
        </div>,
        document.body
      )}

      {/* Admin render config — visible when ?admin=1 or Ctrl+Shift+A */}
      {adminMode && (
        <AdminGearButton
          config={adminConfig}
          onChange={(c) => {
            setAdminConfig(c);
            saveAdminConfig(c);
          }}
        />
      )}
    </div>
  );
}

// ─── BrandPanel ─────────────────────────────────────────────────────────────
// Logo upload + color pickers + font selectors for brand customization.
// Overrides are applied by hf-compose.py to every scene in the video.
const FONT_OPTIONS = [
  { value: "", label: "Default (template)" },
  { value: "Inter", label: "Inter — Modern Sans" },
  { value: "Sora", label: "Sora — Geometric Sans" },
  { value: "Space Grotesk", label: "Space Grotesk — Tech" },
  { value: "Fraunces", label: "Fraunces — Editorial Serif" },
  { value: "Playfair Display", label: "Playfair — Elegant Serif" },
  { value: "IBM Plex Sans", label: "IBM Plex — Corporate" },
  { value: "Georgia", label: "Georgia — Classic Serif" },
  { value: "Courier New", label: "Courier — Monospace" },
];

function BrandPanel({
  logoUrl, onLogoUpload, onLogoRemove, uploading, logoInputRef,
  colors, onColorsChange, fonts, onFontsChange,
}: {
  logoUrl: string | null;
  onLogoUpload: (file: File) => void;
  onLogoRemove: () => void;
  uploading: boolean;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  colors: { primary: string; accent: string; bg: string };
  onColorsChange: (c: { primary: string; accent: string; bg: string }) => void;
  fonts: { heading: string; body: string };
  onFontsChange: (f: { heading: string; body: string }) => void;
}) {
  return (
    <div
      className="bg-[var(--bg-surface)] p-6"
      style={{
        borderWidth: "var(--border-width)", borderStyle: "solid",
        borderColor: "var(--border)", boxShadow: "var(--shadow)",
      }}
    >
      <h4 className="font-black mb-5 text-lg tracking-[-0.01em] uppercase flex items-center gap-2">
        <Palette className="w-5 h-5" /> Brand Kit
      </h4>

      {/* Logo Upload */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wide">
          Logo
        </label>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLogoUpload(f);
            e.target.value = "";
          }}
        />
        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center p-3"
              style={{
                width: "80px", height: "80px",
                backgroundColor: "#fff",
                borderWidth: "var(--border-width)", borderStyle: "solid",
                borderColor: "var(--border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Brand logo"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
            <button
              onClick={onLogoRemove}
              className="btn-ghost"
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
            >
              <X className="w-4 h-4" /> Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center text-center p-8"
            style={{
              width: "100%", cursor: uploading ? "wait" : "pointer",
              backgroundColor: "var(--bg-base)",
              borderWidth: "var(--border-width)", borderStyle: "dashed",
              borderColor: "var(--border)",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <ImageIcon className="w-7 h-7 text-[var(--text-muted)] mb-2" />
            <span className="text-sm font-bold text-[var(--text)] uppercase tracking-wide">
              {uploading ? "Uploading..." : "Click to upload logo"}
            </span>
            <span className="text-xs text-[var(--text-muted)] mt-1">PNG, JPG, SVG, WebP · Max 4MB</span>
          </button>
        )}
      </div>

      {/* Color Pickers */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wide">
          Brand Colors
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { key: "primary", label: "Primary" },
            { key: "accent", label: "Accent" },
            { key: "bg", label: "Background" },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="color"
                  value={colors[key] || "#000000"}
                  onChange={(e) => onColorsChange({ ...colors, [key]: e.target.value })}
                  style={{
                    width: "36px", height: "36px",
                    border: "3px solid var(--border)", cursor: "pointer",
                    padding: 0, background: "none",
                  }}
                />
                <span className="text-xs font-bold text-[var(--text)] uppercase">{label}</span>
              </div>
              <input
                type="text"
                value={colors[key]}
                placeholder="#000000"
                onChange={(e) => onColorsChange({ ...colors, [key]: e.target.value })}
                className="input-base !py-2 !text-xs"
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Font Selectors */}
      <div>
        <label className="block text-sm font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wide">
          Fonts
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] mb-2 block uppercase">Heading</span>
            <select
              value={fonts.heading}
              onChange={(e) => onFontsChange({ ...fonts, heading: e.target.value })}
              className="input-base !py-2.5 !text-sm cursor-pointer"
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] mb-2 block uppercase">Body</span>
            <select
              value={fonts.body}
              onChange={(e) => onFontsChange({ ...fonts, body: e.target.value })}
              className="input-base !py-2.5 !text-sm cursor-pointer"
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedPanel({ settings, onChange }: {
  settings: AdvancedSettings;
  onChange: (s: AdvancedSettings) => void;
}) {
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