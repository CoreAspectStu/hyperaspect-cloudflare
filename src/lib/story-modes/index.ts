import type { StoryModeDefinition, StoryModeQuestion } from "./types";

export { childrensStoryMode } from "./childrens-story";
export { businessProfileMode } from "./business-profile";
export { realestatePropertyMode } from "./realestate-property";
export { pitchdeckPresentationMode } from "./pitchdeck-presentation";
export { editorialExplainerMode } from "./editorial-explainer";

export type { StoryModeDefinition, StoryModeQuestion } from "./types";

import { childrensStoryMode } from "./childrens-story";
import { businessProfileMode } from "./business-profile";
import { realestatePropertyMode } from "./realestate-property";
import { pitchdeckPresentationMode } from "./pitchdeck-presentation";
import { editorialExplainerMode } from "./editorial-explainer";

/**
 * The "custom" mode has no guided questions — selecting it redirects the
 * user to the existing template gallery where they can pick a template
 * and configure it manually.
 */
const customMode: StoryModeDefinition = {
  id: "custom",
  name: "Custom",
  emoji: "✨",
  description:
    "Start from scratch with the full template gallery. Full control over every scene, style, and setting.",
  defaultDuration: 60,
  questions: [],
  narrativePattern: "freeform",
  defaultStylePreset: "dark-pro",
  category: "General",
};

export const STORY_MODES: StoryModeDefinition[] = [
  childrensStoryMode,
  businessProfileMode,
  realestatePropertyMode,
  pitchdeckPresentationMode,
  editorialExplainerMode,
  customMode,
];
