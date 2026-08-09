import type { StoryModeDefinition } from "./types";

/**
 * YouTube Clone — paste a YouTube URL, pick a style, done.
 * No interview flow: the backend (POST /extract on :3001) pulls everything
 * it needs from the video itself.
 */
export const youtubeCloneMode: StoryModeDefinition = {
  id: "youtube-clone",
  name: "YouTube Clone",
  emoji: "🎬",
  description:
    "Recreate a YouTube video in a new visual style — paste the URL, pick a look, and get a restyled cut.",
  defaultDuration: 60,
  category: "YouTube",
  narrativePattern: "youtube-clone",
  defaultStylePreset: "default",
  questions: [
    {
      key: "youtube_url",
      question: "Paste the YouTube URL",
      type: "text",
      required: true,
      hint: "e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    {
      key: "style",
      question: "Pick a visual style",
      type: "styleChoices",
      required: true,
      styleOptions: [
        { name: "Default", value: "default" },
        {
          name: "Cyberpunk Neon",
          value: "cyberpunk-neon",
          colors: ["#0d0221", "#ff2a6d", "#05d9e8"],
        },
        {
          name: "Corporate Clean",
          value: "corporate-clean",
          colors: ["#ffffff", "#1f2a44", "#2f80ed"],
        },
        {
          name: "Documentary Warm",
          value: "documentary-warm",
          colors: ["#2b1d12", "#c96f2f", "#e8d5b5"],
        },
      ],
    },
  ],
};
