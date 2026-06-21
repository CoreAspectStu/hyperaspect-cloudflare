import type { StoryModeDefinition } from "./types";

export const editorialExplainerMode: StoryModeDefinition = {
  id: "editorial-explainer",
  name: "Editorial Explainer",
  emoji: "📰",
  description:
    "A journalistic explainer video — break down a complex topic with data, stakeholders, and a clear takeaway.",
  defaultDuration: 75,
  category: "Journalism",
  narrativePattern: "context-evidence-implication",
  defaultStylePreset: "editorial-posterized",
  questions: [
    {
      key: "topic",
      question: "What's the topic?",
      type: "text",
      required: true,
      hint: "e.g. The rise of gig-worker unions in major cities",
    },
    {
      key: "why_it_matters",
      question: "Why does it matter now?",
      type: "text",
      required: true,
      hint: "e.g. New legislation could reshape labor for 60M workers",
    },
    {
      key: "key_data",
      question: "What's the key data point?",
      type: "text",
      hint: "e.g. Gig workers earn 32% less than traditional employees",
    },
    {
      key: "stakeholders",
      question: "Who are the key stakeholders?",
      type: "text",
      hint: "e.g. Workers, platforms, regulators, consumers",
    },
    {
      key: "takeaway",
      question: "What's the main takeaway?",
      type: "text",
      hint: "e.g. The next 12 months will define labor rights for a generation",
    },
    {
      key: "tone",
      question: "Choose a tone.",
      type: "styleChoices",
      required: true,
      styleOptions: [
        { name: "Neutral", value: "neutral", colors: ["#3d3d3d", "#e6e6e6", "#ffffff"] },
        { name: "Investigative", value: "investigative", colors: ["#0a0a0a", "#e71d36", "#f5f5f5"] },
        { name: "Analytical", value: "analytical", colors: ["#1a3a5c", "#a0c4e8", "#fef6e4"] },
      ],
    },
  ],
};
