import type { StoryModeDefinition } from "./types";

export const businessProfileMode: StoryModeDefinition = {
  id: "business-profile",
  name: "Business Profile",
  emoji: "🏢",
  description:
    "A polished company overview video — who you are, what you do, and why customers should care.",
  defaultDuration: 45,
  category: "Marketing",
  narrativePattern: "problem-solution-cta",
  defaultStylePreset: "dark-pro",
  questions: [
    {
      key: "company_name",
      question: "What is the company name?",
      type: "text",
      required: true,
    },
    {
      key: "industry",
      question: "What industry are you in?",
      type: "text",
      required: true,
      hint: "e.g. Fintech, Healthcare, SaaS",
    },
    {
      key: "what_you_do",
      question: "What does the company do in one sentence?",
      type: "text",
      required: true,
      hint: "e.g. We help small businesses manage payroll effortlessly",
    },
    {
      key: "target_audience",
      question: "Who is your target audience?",
      type: "text",
      hint: "e.g. Founders of companies with 10–50 employees",
    },
    {
      key: "key_stat",
      question: "Share a key metric or achievement.",
      type: "text",
      hint: "e.g. 10,000+ businesses onboarded in 2 years",
    },
    {
      key: "cta_text",
      question: "What's the call to action?",
      type: "text",
      hint: "e.g. Start your free trial today",
    },
    {
      key: "tone",
      question: "Choose a tone.",
      type: "styleChoices",
      required: true,
      styleOptions: [
        { name: "Professional", value: "professional", colors: ["#0a0a0a", "#3a3a3a", "#e6e6e6"] },
        { name: "Friendly", value: "friendly", colors: ["#2ec4b6", "#ff9f1c", "#fef6e4"] },
        { name: "Bold", value: "bold", colors: ["#e71d36", "#0a0a0a", "#fffd82"] },
      ],
    },
  ],
};
