import type { StoryModeDefinition } from "./types";

export const pitchdeckPresentationMode: StoryModeDefinition = {
  id: "pitchdeck-presentation",
  name: "Pitch Deck Presentation",
  emoji: "📊",
  description:
    "A high-impact investor pitch video — vision, problem, solution, and ask, distilled into a compelling narrative.",
  defaultDuration: 60,
  category: "Business",
  narrativePattern: "vision-problem-solution-ask",
  defaultStylePreset: "dark-pro",
  questions: [
    {
      key: "company_name",
      question: "What is the company name?",
      type: "text",
      required: true,
    },
    {
      key: "vision",
      question: "What's the big vision?",
      type: "text",
      required: true,
      hint: "e.g. Make clean energy affordable for every household",
    },
    {
      key: "problem",
      question: "What problem are you solving?",
      type: "text",
      required: true,
      hint: "e.g. Home solar installation is 3x more expensive than it needs to be",
    },
    {
      key: "solution",
      question: "What's your solution?",
      type: "text",
      required: true,
      hint: "e.g. A modular solar kit that installs in a single afternoon",
    },
    {
      key: "market_size",
      question: "How big is the market?",
      type: "text",
      hint: "e.g. $120B TAM, growing 18% YoY",
    },
    {
      key: "traction",
      question: "What traction do you have?",
      type: "text",
      hint: "e.g. $2M ARR, 500+ paying customers, 15% MoM growth",
    },
    {
      key: "funding_ask",
      question: "What are you raising?",
      type: "text",
      hint: "e.g. Raising $5M Series A to scale go-to-market",
    },
  ],
};
