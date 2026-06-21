export interface StoryModeQuestion {
  key: string;
  question: string;
  type: "text" | "choice" | "styleChoices" | "imageUpload";
  required?: boolean;
  hint?: string;
  options?: string[];
  styleOptions?: { name: string; value: string; colors?: string[] }[];
}

export interface StoryModeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  defaultDuration: number;
  questions: StoryModeQuestion[];
  narrativePattern: string;
  defaultStylePreset: string;
  category: string;
}
