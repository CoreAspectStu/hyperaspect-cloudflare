import type { StoryModeDefinition } from "./types";

export const realestatePropertyMode: StoryModeDefinition = {
  id: "realestate-property",
  name: "Real Estate Property",
  emoji: "🏠",
  description:
    "A cinematic property showcase — highlight the location, features, and lifestyle that make a listing irresistible.",
  defaultDuration: 45,
  category: "Marketing",
  narrativePattern: "feature-tour-cta",
  defaultStylePreset: "dark-pro",
  questions: [
    {
      key: "property_type",
      question: "What type of property is it?",
      type: "text",
      required: true,
      hint: "e.g. Modern 3-bedroom villa, Downtown loft",
    },
    {
      key: "location",
      question: "Where is the property located?",
      type: "text",
      required: true,
      hint: "e.g. Austin, TX — Zilker neighborhood",
    },
    {
      key: "key_feature",
      question: "What's the standout feature?",
      type: "text",
      required: true,
      hint: "e.g. Floor-to-ceiling windows with hill views",
    },
    {
      key: "price_range",
      question: "What's the price range?",
      type: "text",
      hint: "e.g. $850,000 – $920,000",
    },
    {
      key: "bedrooms",
      question: "How many bedrooms and bathrooms?",
      type: "text",
      hint: "e.g. 4 bed / 3 bath",
    },
    {
      key: "special_amenity",
      question: "Any special amenities?",
      type: "text",
      hint: "e.g. Heated pool, chef's kitchen, smart-home system",
    },
    {
      key: "cta_text",
      question: "What's the call to action?",
      type: "text",
      hint: "e.g. Book a private tour this weekend",
    },
  ],
};
