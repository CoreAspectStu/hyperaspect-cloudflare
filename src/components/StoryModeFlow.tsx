"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { StoryModeDefinition, StoryModeQuestion } from "@/lib/story-modes";
import { ArrowLeft, ArrowRight, Sparkles, Clock, ImageIcon, FileText, AlertCircle, RefreshCw } from "lucide-react";

interface StoryModeFlowProps {
  mode: StoryModeDefinition;
  onBack: () => void;
  onComplete: (customManifest: any, modeName: string) => void;
}

type Step = "interview" | "storyboard" | "generating";

const ACCENT = "#ff2d2d";
const BG = "#fef6e4";
const BORDER = "#0a0a0a";

// ─── Shared styles (neo-brutalist) ───────────────────────────────────

const wrapperStyle: CSSProperties = {
  background: BG,
  minHeight: "100%",
  padding: "24px 20px 48px",
};

const innerStyle: CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 28,
};

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 800,
  color: BORDER,
  background: "#ffffff",
  border: `3px solid ${BORDER}`,
  boxShadow: "3px 3px 0 #0a0a0a",
  padding: "8px 14px",
  cursor: "pointer",
};

const modeEmojiStyle: CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
};

const modeNameStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: BORDER,
  letterSpacing: "-0.02em",
};

// ─── Interview step ──────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: `3px solid ${BORDER}`,
  boxShadow: "4px 4px 0 #0a0a0a",
  padding: "28px 24px",
};

const progressStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: ACCENT,
  marginBottom: 14,
};

const progressBarWrapStyle: CSSProperties = {
  height: 8,
  background: BG,
  border: `2px solid ${BORDER}`,
  marginBottom: 24,
  overflow: "hidden",
};

const progressBarFillStyle: CSSProperties = {
  height: "100%",
  background: ACCENT,
};

const questionStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: BORDER,
  letterSpacing: "-0.02em",
  margin: 0,
  lineHeight: 1.3,
};

const hintStyle: CSSProperties = {
  fontSize: 14,
  color: "#6b6b6b",
  margin: "8px 0 0",
  lineHeight: 1.5,
};

const textInputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  border: `3px solid ${BORDER}`,
  background: "#fff",
  fontSize: 16,
  fontWeight: 500,
  outline: "none",
  boxShadow: "4px 4px 0 #0a0a0a",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const choiceGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const choiceBtnBase: CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  border: `3px solid ${BORDER}`,
  background: "#fff",
  fontSize: 15,
  fontWeight: 700,
  color: BORDER,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const styleChoiceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 24,
  gap: 12,
};

const skipBtnStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#6b6b6b",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "8px 4px",
};

const nextBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 15,
  fontWeight: 900,
  color: "#ffffff",
  background: ACCENT,
  border: `3px solid ${BORDER}`,
  boxShadow: "3px 3px 0 #0a0a0a",
  padding: "10px 18px",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

// ─── Loading step ────────────────────────────────────────────────────

const loadingCenterStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "60px 24px",
};

const spinnerBoxStyle: CSSProperties = {
  width: 64,
  height: 64,
  border: `4px solid ${BORDER}`,
  borderRadius: "50%",
  borderTopColor: ACCENT,
  animation: "spin 0.8s linear infinite",
  marginBottom: 24,
};

const loadingTitleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: BORDER,
  margin: 0,
  letterSpacing: "-0.02em",
};

const loadingSubStyle: CSSProperties = {
  fontSize: 15,
  color: "#6b6b6b",
  margin: "10px 0 0",
};

// ─── Storyboard preview ──────────────────────────────────────────────

const previewHeaderStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: BORDER,
  letterSpacing: "-0.02em",
  margin: "0 0 6px",
};

const previewSubStyle: CSSProperties = {
  fontSize: 14,
  color: "#6b6b6b",
  margin: "0 0 20px",
};

const beatsListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const beatCardStyle: CSSProperties = {
  background: "#fff",
  border: `3px solid ${BORDER}`,
  boxShadow: "4px 4px 0 #0a0a0a",
  padding: "18px 18px",
};

const beatHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
  gap: 12,
};

const beatNumberStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  background: ACCENT,
  color: "#fff",
  border: `3px solid ${BORDER}`,
  fontSize: 15,
  fontWeight: 900,
  flexShrink: 0,
};

const beatPurposeStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ACCENT,
  flex: 1,
};

const durationBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  background: BG,
  border: `2px solid ${BORDER}`,
  padding: "3px 8px",
  color: BORDER,
};

const beatHeadlineStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: BORDER,
  margin: "0 0 4px",
  lineHeight: 1.35,
};

const beatSubtextStyle: CSSProperties = {
  fontSize: 14,
  color: "#3a3a3a",
  margin: "0 0 10px",
  lineHeight: 1.5,
};

const promptRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 13,
  color: "#6b6b6b",
  fontStyle: "italic",
  lineHeight: 1.45,
};

const aiBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: BORDER,
  background: "#fde68a",
  border: `2px solid ${BORDER}`,
  padding: "2px 8px",
  marginTop: 10,
};

// ─── Error state ─────────────────────────────────────────────────────

const errorBoxStyle: CSSProperties = {
  background: "#fff",
  border: `3px solid ${BORDER}`,
  boxShadow: "4px 4px 0 #0a0a0a",
  padding: "32px 24px",
  textAlign: "center",
};

const errorIconStyle: CSSProperties = {
  color: ACCENT,
  marginBottom: 12,
};

const errorMsgStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: BORDER,
  margin: "0 0 20px",
  lineHeight: 1.5,
};

const retryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
  background: ACCENT,
  border: `3px solid ${BORDER}`,
  boxShadow: "3px 3px 0 #0a0a0a",
  padding: "10px 18px",
  cursor: "pointer",
  textTransform: "uppercase",
};

// ─── Generate step ───────────────────────────────────────────────────

const generateFooterStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 24,
  flexWrap: "wrap",
};

const ghostBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 800,
  color: BORDER,
  background: "#fff",
  border: `3px solid ${BORDER}`,
  boxShadow: "3px 3px 0 #0a0a0a",
  padding: "10px 16px",
  cursor: "pointer",
};

const generateBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
  background: ACCENT,
  border: `3px solid ${BORDER}`,
  boxShadow: "4px 4px 0 #0a0a0a",
  padding: "12px 24px",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  flex: 1,
  justifyContent: "center",
  minWidth: 200,
};

// ─── Helpers ─────────────────────────────────────────────────────────

/** Build the description string for the storyboard API from collected answers. */
function buildDescription(answers: Record<string, string>, mode: StoryModeDefinition): string {
  const keys = Object.keys(answers);
  if (keys.length === 0) return mode.name;

  // Prefer a long-form text answer as the primary description.
  const firstText = keys
    .map((k) => answers[k])
    .find((v) => v && v.length > 10);
  if (firstText) return firstText;

  // Fall back to a comma-joined summary.
  const parts = keys.map((k) => `${k}: ${answers[k]}`).filter((p) => !p.endsWith(": "));
  return parts.join("; ") || mode.name;
}

/** P2-5 fix: Check if the user has provided at least one substantive answer. */
function hasSubstantiveAnswers(answers: Record<string, string>): boolean {
  return Object.values(answers).some((v) => v && v.trim().length >= 5);
}

// ─── Component ───────────────────────────────────────────────────────

export default function StoryModeFlow({ mode, onBack, onComplete }: StoryModeFlowProps) {
  const [step, setStep] = useState<Step>("interview");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [storyboard, setStoryboard] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");

  const questions = mode.questions;
  const totalQuestions = questions.length;

  // ── Interview navigation ──

  const goNext = useCallback(() => {
    setAnswers((prev) => {
      // Persist any in-progress text draft for the current question.
      const q = questions[currentQuestion];
      if (q && q.type === "text" && textDraft.trim()) {
        return { ...prev, [q.key]: textDraft.trim() };
      }
      return prev;
    });

    setTextDraft("");

    if (currentQuestion + 1 >= totalQuestions) {
      // All questions answered → advance to storyboard step.
      setStep("storyboard");
      return;
    }
    setCurrentQuestion((i) => i + 1);
  }, [currentQuestion, totalQuestions, questions, textDraft]);

  const goPrev = useCallback(() => {
    if (currentQuestion === 0) {
      onBack();
      return;
    }
    setTextDraft("");
    setCurrentQuestion((i) => i - 1);
  }, [currentQuestion, onBack]);

  const handleChoice = useCallback(
    (q: StoryModeQuestion, value: string) => {
      setAnswers((prev) => ({ ...prev, [q.key]: value }));
      // Auto-advance after a brief beat so the user sees their selection.
      setTimeout(() => {
        if (currentQuestion + 1 >= totalQuestions) {
          setStep("storyboard");
        } else {
          setCurrentQuestion((i) => i + 1);
        }
      }, 180);
    },
    [currentQuestion, totalQuestions]
  );

  const handleSkip = useCallback(() => {
    setTextDraft("");
    if (currentQuestion + 1 >= totalQuestions) {
      setStep("storyboard");
    } else {
      setCurrentQuestion((i) => i + 1);
    }
  }, [currentQuestion, totalQuestions]);

  // ── Storyboard generation ──

  const generateStoryboard = useCallback(async () => {
    // P2-5 fix: require at least one substantive answer before generating
    if (!hasSubstantiveAnswers(answers)) {
      setError("Please answer at least one question with a few words before generating your storyboard.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setStoryboard(null);

    const description = buildDescription(answers, mode);

    try {
      // Step 1: Create async storyboard job — returns { jobId, status: "pending" }
      const resp = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: mode.id,
          brief: answers,
          description,
          aspectRatio: "16:9",
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Storyboard generation failed");
        setIsLoading(false);
        return;
      }

      // If we got a manifest directly (backwards compat), use it
      if (data.manifest) {
        setStoryboard(data);
        setIsLoading(false);
        return;
      }

      // Step 2: Poll for async job result
      const jobId = data.jobId;
      if (!jobId) {
        setError("Storyboard service did not return a job ID");
        setIsLoading(false);
        return;
      }

      const maxPolls = 30; // 30 × 3s = 90s max
      for (let i = 0; i < maxPolls; i++) {
        if (cancelledRef.current) return; // P1-3: stop polling if user navigated back
        await new Promise((r) => setTimeout(r, 3000));
        if (cancelledRef.current) return; // P1-3: check after sleep too
        try {
          const pollResp = await fetch(`/api/storyboard-status?jobId=${jobId}`);
          const pollData = await pollResp.json();

          if (pollData.status === "done" && pollData.manifest) {
            setStoryboard({ manifest: pollData.manifest });
            setIsLoading(false);
            return;
          }
          if (pollData.status === "error") {
            setError(pollData.error || "Storyboard generation failed");
            setIsLoading(false);
            return;
          }
          // status === "pending" → keep polling
        } catch {
          // Network hiccup — keep polling
        }
      }

      setError("Storyboard generation timed out. Please try again.");
      setIsLoading(false);
    } catch (err: any) {
      setError(`Cannot reach storyboard service: ${err.message}`);
      setIsLoading(false);
    }
  }, [answers, mode]);

  // ── Triggered when storyboard is complete ──

  const handleGenerateVideo = useCallback(() => {
    setStep("generating");
    onComplete(storyboard?.manifest ?? storyboard, mode.name);
  }, [storyboard, mode.name, onComplete]);

  // ── Trigger storyboard fetch automatically when entering step ──
  // We track whether we've already initiated.
  const [initiated, setInitiated] = useState(false);
  const cancelledRef = useRef(false); // P1-3: cancel polling on Back

  useEffect(() => {
    if (step === "storyboard" && !initiated) {
      setInitiated(true);
      cancelledRef.current = false; // P1-3: reset cancel flag on new attempt
      generateStoryboard();
    }
  }, [step, initiated, generateStoryboard]);

  // ─── Render ───

  const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 100;

  // ── Generating step ──
  if (step === "generating") {
    return (
      <div style={wrapperStyle}>
        <div style={innerStyle}>
          <div style={cardStyle}>
            <div style={loadingCenterStyle}>
              <div style={spinnerBoxStyle} />
              <h2 style={loadingTitleStyle}>Generating your {mode.name} video…</h2>
              <p style={loadingSubStyle}>{mode.emoji} {mode.name} mode is now rendering. This may take a few minutes.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Storyboard step (loading or preview) ──
  if (step === "storyboard") {
    // Loading state
    if (isLoading && !storyboard) {
      return (
        <div style={wrapperStyle}>
          <div style={innerStyle}>
            <div style={topBarStyle}>
              <button type="button" style={backBtnStyle} onClick={() => { cancelledRef.current = true; setInitiated(false); setStep("interview"); }}>
                <ArrowLeft size={16} /> Back
              </button>
              <span style={modeEmojiStyle}>{mode.emoji}</span>
              <span style={modeNameStyle}>{mode.name}</span>
            </div>
            <div style={cardStyle}>
              <div style={loadingCenterStyle}>
                <div style={spinnerBoxStyle} />
                <h2 style={{ ...loadingTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={22} style={{ color: ACCENT }} /> AI is planning your video…
                </h2>
                <p style={loadingSubStyle}>Analysing your answers and structuring the storyboard beats.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Error state
    if (error && !storyboard) {
      return (
        <div style={wrapperStyle}>
          <div style={innerStyle}>
            <div style={topBarStyle}>
              <button type="button" style={backBtnStyle} onClick={() => { cancelledRef.current = true; setInitiated(false); setStep("interview"); }}>
                <ArrowLeft size={16} /> Back to questions
              </button>
              <span style={modeEmojiStyle}>{mode.emoji}</span>
              <span style={modeNameStyle}>{mode.name}</span>
            </div>
            <div style={errorBoxStyle}>
              <AlertCircle size={36} style={errorIconStyle} />
              <p style={errorMsgStyle}>{error}</p>
              <button type="button" style={retryBtnStyle} onClick={generateStoryboard}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Preview state
    const beats: any[] = Array.isArray(storyboard?.beats) ? storyboard.beats : [];

    return (
      <div style={wrapperStyle}>
        <div style={innerStyle}>
          <div style={topBarStyle}>
            <button type="button" style={backBtnStyle} onClick={() => { cancelledRef.current = true; setInitiated(false); setStep("interview"); }}>
              <ArrowLeft size={16} /> Edit answers
            </button>
            <span style={modeEmojiStyle}>{mode.emoji}</span>
            <span style={modeNameStyle}>{mode.name}</span>
          </div>

          <h2 style={previewHeaderStyle}>Your Storyboard</h2>
          <p style={previewSubStyle}>
            {beats.length} {beats.length === 1 ? "scene" : "scenes"} planned. Review the beats below, then generate your video.
          </p>

          {beats.length > 0 ? (
            <div style={beatsListStyle}>
              {beats.map((beat, i) => {
                const prompt = beat._image_prompt || beat.image_prompt || beat.prompt || "";
                const promptSummary = prompt ? prompt.substring(0, 80) + (prompt.length > 80 ? "…" : "") : "";
                return (
                  <div key={i} style={beatCardStyle}>
                    <div style={beatHeaderStyle}>
                      <span style={beatNumberStyle}>{i + 1}</span>
                      <span style={beatPurposeStyle}>{beat._narrative_purpose || beat.purpose || beat.narrative_purpose || "Scene"}</span>
                      {beat.duration != null && (
                        <span style={durationBadgeStyle}>
                          <Clock size={12} /> {beat.duration}s
                        </span>
                      )}
                    </div>
                    <p style={beatHeadlineStyle}>{beat.headline || beat.title || ""}</p>
                    {beat.subtext && <p style={beatSubtextStyle}>{beat.subtext}</p>}
                    {promptSummary && (
                      <div style={promptRowStyle}>
                        <ImageIcon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{promptSummary}</span>
                      </div>
                    )}
                    {prompt && (
                      <span style={aiBadgeStyle}>
                        <Sparkles size={11} /> AI will generate this image
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={beatCardStyle}>
              <p style={beatSubtextStyle}>
                <FileText size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Storyboard received. No individual beats were returned — you can still generate the video below.
              </p>
              <pre style={{ fontSize: 12, color: "#6b6b6b", whiteSpace: "pre-wrap", margin: "8px 0 0" }}>
                {JSON.stringify(storyboard, null, 2).substring(0, 500)}
              </pre>
            </div>
          )}

          <div style={generateFooterStyle}>
            <button type="button" style={generateBtnStyle} onClick={handleGenerateVideo}>
              <Sparkles size={18} /> Generate Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Interview step (default) ──
  const q = questions[currentQuestion];

  // If the mode has no questions, jump straight to storyboard.
  if (!q) {
    // This should be rare, but guard against it.
    return (
      <div style={wrapperStyle}>
        <div style={innerStyle}>
          <div style={cardStyle}>
            <p style={beatSubtextStyle}>No questions for this mode.</p>
            <button type="button" style={nextBtnStyle} onClick={() => setStep("storyboard")}>
              <ArrowRight size={16} /> Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentAnswer = answers[q.key] ?? "";
  const isText = q.type === "text";
  // For text questions, sync the draft with any previously saved answer.
  const draftValue = isText ? (textDraft || currentAnswer) : "";

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle}>
        <div style={topBarStyle}>
          <button type="button" style={backBtnStyle} onClick={goPrev}>
            <ArrowLeft size={16} /> {currentQuestion === 0 ? "Modes" : "Back"}
          </button>
          <span style={modeEmojiStyle}>{mode.emoji}</span>
          <span style={modeNameStyle}>{mode.name}</span>
        </div>

        <div style={cardStyle}>
          {totalQuestions > 0 && (
            <>
              <p style={progressStyle}>
                Question {currentQuestion + 1} of {totalQuestions}
              </p>
              <div style={progressBarWrapStyle}>
                <div style={{ ...progressBarFillStyle, width: `${progress}%` }} />
              </div>
            </>
          )}

          <h2 style={questionStyle}>{q.question}</h2>
          {q.hint && <p style={hintStyle}>{q.hint}</p>}

          <div style={{ marginTop: 20 }}>
            {/* Text input */}
            {isText && (
              <textarea
                value={draftValue}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={q.hint || "Type your answer…"}
                rows={3}
                autoFocus
                style={{ ...textInputStyle, resize: "vertical" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    goNext();
                  }
                }}
              />
            )}

            {/* Choice buttons */}
            {q.type === "choice" && q.options && (
              <div style={choiceGridStyle}>
                {q.options.map((opt) => {
                  const selected = currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      style={{
                        ...choiceBtnBase,
                        background: selected ? ACCENT : "#fff",
                        color: selected ? "#fff" : BORDER,
                      }}
                      onClick={() => handleChoice(q, opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Style choice buttons */}
            {q.type === "styleChoices" && q.styleOptions && (
              <div style={styleChoiceGridStyle}>
                {q.styleOptions.map((opt) => {
                  const selected = currentAnswer === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      style={{
                        ...choiceBtnBase,
                        flexDirection: "column",
                        alignItems: "flex-start",
                        background: selected ? ACCENT : "#fff",
                        color: selected ? "#fff" : BORDER,
                      }}
                      onClick={() => handleChoice(q, opt.value)}
                    >
                      <span style={{ fontWeight: 900, fontSize: 16 }}>{opt.name}</span>
                      {opt.colors && (
                        <span style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {opt.colors.map((c) => (
                            <span key={c} style={{ width: 16, height: 16, background: c, border: "2px solid #0a0a0a" }} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Image upload — P2-2 fix: no modes currently use this. If enabled,
                this needs actual upload logic (file → relay → URL), not just filename. */}
            {q.type === "imageUpload" && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleChoice(q, file.name);
                  }}
                  style={{
                    ...textInputStyle,
                    padding: "12px",
                    cursor: "pointer",
                  }}
                />
                {currentAnswer && (
                  <p style={{ ...hintStyle, marginTop: 8 }}>
                    <ImageIcon size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    Selected: {currentAnswer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action row */}
          <div style={actionRowStyle}>
            {!q.required ? (
              <button type="button" style={skipBtnStyle} onClick={handleSkip}>
                Skip
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              style={{
                ...nextBtnStyle,
                opacity: q.required && isText && !draftValue.trim() && !currentAnswer ? 0.4 : 1,
                cursor: q.required && isText && !draftValue.trim() && !currentAnswer ? "not-allowed" : "pointer",
              }}
              disabled={q.required && isText && !draftValue.trim() && !currentAnswer}
              onClick={goNext}
            >
              {currentQuestion + 1 >= totalQuestions ? "Generate Storyboard" : "Next"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
