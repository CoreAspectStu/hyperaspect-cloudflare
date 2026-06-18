'use client';
import React, { useState, useEffect, useRef } from 'react';
import { CREAM_BG, DARK_TEXT, YOUTUBE_RED, BORDER, SHADOW, SHADOW_LG } from '@/lib/constants';
import AuthGate from '@/components/AuthGate';
import { Mic, FileText, Video, Link2, PencilLine, X, Loader2, Download, Mail, Settings2 } from 'lucide-react';

type VideoItem = {
  id: string; title: string; thumbnail: string; videoUrl: string;
  aspectRatio: string; duration: string; format: string;
};

const HomePage: React.FC = () => {
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [workflowState, setWorkflowState] = useState<'idle' | 'interview' | 'generating' | 'result'>('idle');
  const [gallery, setGallery] = useState<VideoItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | '16:9' | '9:16' | '1:1'>('ALL');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [progress, setProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState({ aspectRatio: '16:9', style: 'Professional', duration: 60, emailNotify: false, email: '' });
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch('/api/gallery').then(r => r.json()).then(setGallery).catch(() => {});
  }, []);

  // Poll progress when generating
  useEffect(() => {
    if (workflowState !== 'generating') return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setWorkflowState('result'); return 100; }
        return p + Math.random() * 15;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [workflowState]);

  const filteredGallery = filter === 'ALL' ? gallery : gallery.filter(v => v.aspectRatio === filter);

  const startGeneration = () => {
    setWorkflowState('generating');
    setProgress(0);
    fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inputValue, type: activeInput, options: advanced }) }).catch(() => {});
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'voice.webm');
          const resp = await fetch('/api/transcribe', { method: 'POST', body: fd });
          const data = await resp.json();
          setTranscribedText(data.text || '');
          setInputValue(data.text || '');
        } catch { setTranscribedText('Transcription failed'); }
      };
      recorder.start();
      setIsRecording(true);
    } catch (e) { console.error('Mic error:', e); }
  };

  const inputTiles = [
    { id: 'describe', icon: PencilLine, title: 'Describe It', desc: "Tell us your idea in words", placeholder: "A 30-second promo for my coffee shop..." },
    { id: 'url', icon: Link2, title: 'Paste URL', desc: 'Import content from any link', placeholder: 'https://...' },
    { id: 'video', icon: Video, title: 'Upload Video', desc: 'Remix or enhance footage', placeholder: '' },
    { id: 'document', icon: FileText, title: 'Upload Document', desc: 'Transform docs into video', placeholder: '' },
    { id: 'voice', icon: Mic, title: 'Voice Note', desc: 'Just talk — we handle the rest', placeholder: '' },
  ];

  const btnBase: React.CSSProperties = {
    backgroundColor: YOUTUBE_RED, color: CREAM_BG, border: BORDER, boxShadow: SHADOW,
    padding: '0.75rem 1.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
    transition: 'transform 0.1s, box-shadow 0.1s', textTransform: 'uppercase' as const,
  };

  const cardBase: React.CSSProperties = {
    border: BORDER, boxShadow: SHADOW, backgroundColor: CREAM_BG, padding: '1.5rem',
  };

  const modalSizes: Record<string, number> = { '16:9': 800, '9:16': 400, '1:1': 600 };

  const Inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 5rem)', padding: '2rem 1rem', color: DARK_TEXT, backgroundColor: CREAM_BG }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 'bold', marginBottom: '1rem', display: 'inline-block', border: BORDER, padding: '1rem 2rem', boxShadow: SHADOW_LG, backgroundColor: CREAM_BG }}>
          Create Your AI-Powered Videos
        </h1>
        <p style={{ fontSize: '1.2rem', maxWidth: '600px', marginTop: '1rem' }}>
          Pick an input method below and let AI do the heavy lifting.
        </p>
      </div>

      {/* Workflow: Idle */}
      {workflowState === 'idle' && (
        <>
          {/* Input Tiles */}
          <div style={{ width: '100%', maxWidth: '1200px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>Choose Your Input</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {inputTiles.map(tile => {
                const Icon = tile.icon;
                const isActive = activeInput === tile.id;
                return (
                  <div key={tile.id} onClick={() => { setActiveInput(tile.id); setInputValue(''); setTranscribedText(''); }}
                    style={{ ...cardBase, cursor: 'pointer', borderColor: isActive ? YOUTUBE_RED : DARK_TEXT, transform: isActive ? 'translate(-2px,-2px)' : 'none', boxShadow: isActive ? SHADOW_LG : SHADOW, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = SHADOW_LG; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = SHADOW; } }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <Icon size={28} color={isActive ? YOUTUBE_RED : DARK_TEXT} />
                      <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{tile.title}</h3>
                    </div>
                    <p style={{ opacity: 0.7, fontSize: '0.95rem' }}>{tile.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Input Panel */}
          {activeInput && (
            <div style={{ ...cardBase, width: '100%', maxWidth: '800px', marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem', margin: 0 }}>{inputTiles.find(t => t.id === activeInput)?.title}</h3>
                <button onClick={() => setActiveInput(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
              </div>

              {activeInput === 'describe' && (
                <textarea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={inputTiles.find(t => t.id === activeInput)?.placeholder}
                  style={{ width: '100%', minHeight: '120px', padding: '1rem', border: BORDER, boxShadow: SHADOW, fontSize: '1rem', backgroundColor: CREAM_BG, color: DARK_TEXT, resize: 'vertical' }} />
              )}

              {activeInput === 'url' && (
                <input type="url" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={inputTiles.find(t => t.id === activeInput)?.placeholder}
                  style={{ width: '100%', padding: '1rem', border: BORDER, boxShadow: SHADOW, fontSize: '1rem', backgroundColor: CREAM_BG, color: DARK_TEXT }} />
              )}

              {(activeInput === 'video' || activeInput === 'document') && (
                <div style={{ border: BORDER, boxShadow: SHADOW, padding: '3rem', textAlign: 'center', cursor: 'pointer', backgroundColor: CREAM_BG }}
                  onClick={() => alert('File upload would open here')}>
                  <p style={{ fontSize: '1.1rem' }}>📁 Click to upload or drag &amp; drop</p>
                  <p style={{ opacity: 0.6, marginTop: '0.5rem' }}>{activeInput === 'video' ? 'MP4, MOV, WebM' : 'PDF, DOCX, TXT'}</p>
                </div>
              )}

              {activeInput === 'voice' && (
                <div style={{ textAlign: 'center' }}>
                  <button onClick={handleVoiceRecord} style={{ ...btnBase, backgroundColor: isRecording ? '#ff4444' : YOUTUBE_RED, borderRadius: '50%', width: '80px', height: '80px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mic size={32} />
                  </button>
                  <p style={{ marginTop: '1rem' }}>{isRecording ? '🔴 Recording... Click to stop' : 'Click to start recording'}</p>
                  {transcribedText && (
                    <div style={{ marginTop: '1rem', padding: '1rem', border: BORDER, boxShadow: SHADOW, textAlign: 'left' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: YOUTUBE_RED }}>✓ Transcribed</span>
                      <p style={{ marginTop: '0.5rem' }}>{transcribedText}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Options Toggle */}
              <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ marginTop: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings2 size={18} /> Advanced Options
              </button>
              {showAdvanced && (
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Aspect Ratio</span>
                    <select value={advanced.aspectRatio} onChange={e => setAdvanced({...advanced, aspectRatio: e.target.value})} style={{ padding: '0.5rem', border: BORDER, boxShadow: SHADOW, backgroundColor: CREAM_BG }}>
                      <option value="16:9">16:9 Landscape</option><option value="9:16">9:16 Portrait</option><option value="1:1">1:1 Square</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Style</span>
                    <select value={advanced.style} onChange={e => setAdvanced({...advanced, style: e.target.value})} style={{ padding: '0.5rem', border: BORDER, boxShadow: SHADOW, backgroundColor: CREAM_BG }}>
                      <option>Professional</option><option>Casual</option><option>Animated</option><option>Documentary</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Duration: {advanced.duration}s</span>
                    <input type="range" min="15" max="120" value={advanced.duration} onChange={e => setAdvanced({...advanced, duration: Number(e.target.value)})} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={advanced.emailNotify} onChange={e => setAdvanced({...advanced, emailNotify: e.target.checked})} />
                    <Mail size={16} /> Email me when done
                  </label>
                  {advanced.emailNotify && (
                    <input type="email" placeholder="your@email.com" value={advanced.email} onChange={e => setAdvanced({...advanced, email: e.target.value})} style={{ padding: '0.5rem', border: BORDER, boxShadow: SHADOW, backgroundColor: CREAM_BG }} />
                  )}
                </div>
              )}

              <button onClick={startGeneration} style={{ ...btnBase, marginTop: '1.5rem', width: '100%' }}>
                Generate Video →
              </button>
            </div>
          )}
        </>
      )}

      {/* Workflow: Generating */}
      {workflowState === 'generating' && (
        <div style={{ ...cardBase, width: '100%', maxWidth: '600px', textAlign: 'center' }}>
          <Loader2 size={48} color={YOUTUBE_RED} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>Generating Your Video...</h2>
          <div style={{ border: BORDER, boxShadow: SHADOW, height: '30px', backgroundColor: CREAM_BG, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', backgroundColor: YOUTUBE_RED, transition: 'width 0.5s' }} />
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>{Math.round(Math.min(progress, 100))}%</p>
        </div>
      )}

      {/* Workflow: Result */}
      {workflowState === 'result' && (
        <div style={{ ...cardBase, width: '100%', maxWidth: '800px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>✅ Your Video is Ready!</h2>
          <div style={{ border: BORDER, boxShadow: SHADOW, aspectRatio: advanced.aspectRatio.replace(':', ' / '), backgroundColor: '#1a1a1a', color: CREAM_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <p>Video Preview</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={btnBase}><Download size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />Download</button>
            <button onClick={() => { setWorkflowState('idle'); setActiveInput(null); setInputValue(''); setProgress(0); }} style={{ ...btnBase, backgroundColor: CREAM_BG, color: DARK_TEXT }}>Create Another</button>
          </div>
        </div>
      )}

      {/* Gallery */}
      <div style={{ width: '100%', maxWidth: '1200px', marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Your Generated Videos</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['ALL', '16:9', '9:16', '1:1'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                border: BORDER, boxShadow: SHADOW, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold',
                backgroundColor: filter === f ? YOUTUBE_RED : CREAM_BG, color: filter === f ? CREAM_BG : DARK_TEXT, fontSize: '0.9rem'
              }}>{f === '16:9' ? 'LANDSCAPE' : f === '9:16' ? 'PORTRAIT' : f === '1:1' ? 'SQUARE' : 'ALL'}</button>
            ))}
          </div>
        </div>
        {filteredGallery.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No videos in this format yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {filteredGallery.map(v => (
              <div key={v.id} onClick={() => setSelectedVideo(v)} style={{ ...cardBase, cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = SHADOW_LG; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = SHADOW; }}>
                <div style={{ position: 'relative', aspectRatio: v.aspectRatio.replace(':', ' / '), backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: YOUTUBE_RED, color: CREAM_BG, padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', border: BORDER }}>{v.aspectRatio}</span>
                  <span style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.8)', color: CREAM_BG, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>{v.duration}</span>
                </div>
                <div style={{ padding: '1rem' }}><h3 style={{ fontSize: '1.1rem', margin: 0 }}>{v.title}</h3></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div onClick={() => setSelectedVideo(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: CREAM_BG, border: BORDER, boxShadow: SHADOW_LG, padding: '1.5rem', maxWidth: `${modalSizes[selectedVideo.aspectRatio]}px`, width: '100%', position: 'relative' }}>
            <button onClick={() => setSelectedVideo(null)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            <h2 style={{ marginBottom: '1rem' }}>{selectedVideo.title}</h2>
            <div style={{ border: BORDER, aspectRatio: selectedVideo.aspectRatio.replace(':', ' / '), backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: CREAM_BG }}>Video Player</span>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.25rem 0.5rem', border: BORDER, fontSize: '0.85rem' }}>{selectedVideo.aspectRatio}</span>
              <span style={{ padding: '0.25rem 0.5rem', border: BORDER, fontSize: '0.85rem' }}>{selectedVideo.duration}</span>
              <span style={{ padding: '0.25rem 0.5rem', border: BORDER, fontSize: '0.85rem' }}>{selectedVideo.format}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return <AuthGate>{Inner}</AuthGate>;
};

export default HomePage;
