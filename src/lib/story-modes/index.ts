import type { StoryModeDefinition, StoryModeQuestion } from "./types";

export { realestatePropertyMode } from "./realestate-property";
export { recruitmentJobAdMode } from "./recruitment-job-ad";
export { youtubeCloneMode } from "./youtube-clone";

export type { StoryModeDefinition, StoryModeQuestion } from "./types";

import { realestatePropertyMode } from "./realestate-property";
import { recruitmentJobAdMode } from "./recruitment-job-ad";
import { youtubeCloneMode } from "./youtube-clone";

/**
 * Focused product: Real Estate + Recruitment.
 * Other modes (business-profile, childrens-story, editorial-explainer,
 * pitchdeck-presentation) are archived — code preserved but not shown in UI.
 */
export const STORY_MODES: StoryModeDefinition[] = [
  realestatePropertyMode,
  recruitmentJobAdMode,
  youtubeCloneMode,
];
