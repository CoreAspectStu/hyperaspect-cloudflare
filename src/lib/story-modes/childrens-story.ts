import type { StoryModeDefinition } from "./types";

export const childrensStoryMode: StoryModeDefinition = {
  id: "childrens-story",
  name: "Children's Story",
  emoji: "📚",
  description:
    "Turn a simple premise into a narrated, illustrated storybook video with a beginning, middle, and end.",
  defaultDuration: 60,
  category: "Education",
  narrativePattern: "classic-arc",
  defaultStylePreset: "warm-storybook",
  questions: [
    {
      key: "protagonist",
      question: "Who is the main character?",
      type: "text",
      required: true,
      hint: "e.g. A curious little fox named Pip",
    },
    {
      key: "protagonist_description",
      question: "Describe the protagonist's personality or appearance.",
      type: "text",
      hint: "e.g. Orange fur, bright eyes, always asking questions",
    },
    {
      key: "setting",
      question: "Where does the story take place?",
      type: "text",
      required: true,
      hint: "e.g. A misty forest at the edge of a village",
    },
    {
      key: "conflict",
      question: "What problem or challenge arises?",
      type: "text",
      required: true,
      hint: "e.g. Pip loses his way home as the sun sets",
    },
    {
      key: "resolution",
      question: "How is the problem resolved?",
      type: "text",
      required: true,
      hint: "e.g. Pip follows the fireflies back to the village",
    },
    {
      key: "lesson",
      question: "What is the moral or takeaway?",
      type: "text",
      hint: "e.g. It's okay to ask for help when you're lost",
    },
    {
      key: "art_style",
      question: "Choose an art style.",
      type: "styleChoices",
      required: true,
      styleOptions: [
        { name: "Watercolor", value: "watercolor", colors: ["#a8d8ea", "#ffb5a7", "#fcd5ce"] },
        { name: "Cartoon", value: "cartoon", colors: ["#ff9f1c", "#2ec4b6", "#e71d36"] },
        { name: "Paper cutout", value: "paper-cutout", colors: ["#f4a261", "#e76f51", "#264653"] },
      ],
    },
    {
      key: "duration",
      question: "How long should the video be?",
      type: "choice",
      options: ["30s", "60s", "90s"],
    },
  ],
};
