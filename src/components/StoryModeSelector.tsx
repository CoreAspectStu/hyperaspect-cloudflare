"use client";

import type { CSSProperties } from "react";
import { STORY_MODES, type StoryModeDefinition } from "@/lib/story-modes";

interface StoryModeSelectorProps {
  onSelect: (mode: StoryModeDefinition) => void;
}

const ACCENT = "#ff2d2d";

const containerStyle: CSSProperties = {
  background: "#fef6e4",
  padding: "32px 24px",
  minHeight: "100%",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 20,
  maxWidth: 1200,
  margin: "0 auto",
};

const cardBase: CSSProperties = {
  background: "#ffffff",
  border: "3px solid #0a0a0a",
  borderRadius: 0,
  boxShadow: "4px 4px 0 #0a0a0a",
  padding: "20px 20px 18px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  transition: "transform 120ms ease, box-shadow 120ms ease",
};

const emojiStyle: CSSProperties = {
  fontSize: 40,
  lineHeight: 1,
};

const nameStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0a0a0a",
  margin: 0,
  letterSpacing: "-0.02em",
};

const descStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#3a3a3a",
  margin: 0,
  flex: 1,
};

const durationBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  alignSelf: "flex-start",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#0a0a0a",
  background: "#fef6e4",
  border: "2px solid #0a0a0a",
  padding: "4px 10px",
};

const selectButtonStyle: CSSProperties = {
  marginTop: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 800,
  color: "#ffffff",
  background: ACCENT,
  border: "3px solid #0a0a0a",
  boxShadow: "3px 3px 0 #0a0a0a",
  padding: "8px 14px",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const categoryTagStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: ACCENT,
};

const headerStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto 24px",
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0a0a0a",
  margin: 0,
  letterSpacing: "-0.03em",
};

const subtitleStyle: CSSProperties = {
  fontSize: 15,
  color: "#3a3a3a",
  margin: "4px 0 0",
};

export default function StoryModeSelector({ onSelect }: StoryModeSelectorProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Choose a Story Mode</h1>
        <p style={subtitleStyle}>
          Pick a guided format and answer a few questions — we&apos;ll generate the rest.
        </p>
      </div>

      <div style={gridStyle}>
        {STORY_MODES.map((mode) => (
          <div
            key={mode.id}
            style={cardBase}
            onClick={() => onSelect(mode)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-2px, -2px)";
              e.currentTarget.style.boxShadow = "6px 6px 0 #0a0a0a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0, 0)";
              e.currentTarget.style.boxShadow = "4px 4px 0 #0a0a0a";
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(mode);
              }
            }}
          >
            <span style={categoryTagStyle}>{mode.category}</span>
            <span style={emojiStyle} aria-hidden>
              {mode.emoji}
            </span>
            <h2 style={nameStyle}>{mode.name}</h2>
            <p style={descStyle}>{mode.description}</p>

            <span style={durationBadgeStyle}>
              ⏱ {mode.defaultDuration}s default
            </span>

            <button
              type="button"
              style={selectButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(mode);
              }}
            >
              Select →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
