// HyperAspect Template Catalog — 50 templates across 8 categories
// Each template is a proven composition skeleton with variable slots

export type SlotType = "text" | "image_url" | "color" | "number" | "duration" | "enum";

export interface TemplateSlot {
  type: SlotType;
  label: string;
  required?: boolean;
  example?: string;
  default?: string;
}

export interface AnimationKeyframe {
  duration?: number;   // seconds (e.g., 0.8)
  delay?: number;      // seconds (e.g., 0.2)
  ease?: string;       // GSAP ease (e.g., "power3.out", "back.out(1.3)")
  stagger?: number;    // seconds between staggered children
  from?: Record<string, string | number>;  // GSAP from vars (e.g., { opacity: 0, y: 50 })
  to?: Record<string, string | number>;    // GSAP to vars (e.g., { opacity: 1, y: 0 })
}

// Per-scene animation config. Keys are element IDs the backend generates
// (e.g., "headline_enter", "tagline_enter", "scene_exit", "items_stagger").
export interface SceneAnimation {
  [elementKey: string]: AnimationKeyframe;
}

export interface SceneTransition {
  type: "blur" | "zoom" | "push" | "slide" | "fade" | "cut";
  duration?: number;  // seconds
  ease?: string;      // GSAP ease
}

export interface TemplateScene {
  id: string;
  duration_sec: number;
  type: "title_card" | "text_overlay" | "image_showcase" | "stat_display" | "split_screen" | "countdown" | "quote" | "grid" | "timeline" | "cta";
  slots: Record<string, TemplateSlot>;
  animation?: SceneAnimation;      // Per-element GSAP keyframes
  transition_in?: SceneTransition;  // How this scene enters (from previous)
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  emoji: string;
  description: string;
  tags: string[];
  default_duration_sec: number;
  aspect_ratios: {
    recommended: string[];
    supported: string[];
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  popularity_rank: number;
  accent_color: string;
  slots: Record<string, TemplateSlot>;
  scenes: TemplateScene[];
  what_you_need: string[];
}

export type TemplateCategory =
  | "Business" | "Marketing" | "Real Estate" | "Education"
  | "Social Media" | "Events" | "Personal" | "Industry";

export const CATEGORIES: { name: TemplateCategory; emoji: string; color: string }[] = [
  { name: "Business", emoji: "📊", color: "#4dabf7" },
  { name: "Marketing", emoji: "📣", color: "#ff6b6b" },
  { name: "Real Estate", emoji: "🏠", color: "#51cf66" },
  { name: "Education", emoji: "📚", color: "#ffd43b" },
  { name: "Social Media", emoji: "📱", color: "#da77f2" },
  { name: "Events", emoji: "🎉", color: "#ff922b" },
  { name: "Personal", emoji: "👤", color: "#22d3ee" },
  { name: "Industry", emoji: "🏭", color: "#a78bfa" },
];

// Helper to create text slots quickly
const t = (label: string, required = true, example = ""): TemplateSlot => ({
  type: "text", label, required, example
});
const img = (label: string, required = false): TemplateSlot => ({
  type: "image_url", label, required
});
const num = (label: string, example = ""): TemplateSlot => ({
  type: "number", label, example
});
const col = (label: string, defaultVal = "#E63946"): TemplateSlot => ({
  type: "color", label, default: defaultVal
});

export const TEMPLATES: Template[] = [
  // ═══════════════════════════════════════════════
  // 📊 BUSINESS (8)
  // ═══════════════════════════════════════════════
  {
    id: "biz-company-overview",
    name: "Company Overview",
    category: "Business", emoji: "🏢",
    description: "30-second introduction to who you are, what you do, and why it matters.",
    tags: ["intro", "about-us", "brand"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1", "4:5"] },
    difficulty: "beginner", popularity_rank: 1, accent_color: "#4dabf7",
    slots: {
      headline: t("Company Name", true, "CoreAspect AI"),
      tagline: t("One-line description", false, "AI-powered video creation"),
      founded_year: num("Founded Year", "2023"),
      team_size: num("Team Size", "12"),
      key_metric: t("Key Metric", false, "10M+ videos created"),
      brand_color: col("Primary Brand Color"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { headline: t("Company Name"), tagline: t("Tagline", false) },
        animation: {
          headline_enter: { duration: 0.7, delay: 0.2, ease: "expo.out", from: { opacity: 0, y: 50, scale: 0.95 } },
          tagline_enter:  { duration: 0.5, delay: 0.6, ease: "power2.out", from: { opacity: 0, y: 20 } },
          scene_exit:     { duration: 0.3, delay: 3.5, ease: "power2.in", to: { opacity: 0, filter: "blur(12px)" } },
        },
        transition_in: { type: "blur", duration: 0.3, ease: "power3.out" },
      },
      { id: "what-we-do", duration_sec: 8, type: "text_overlay", slots: { description: t("What you do") } },
      { id: "metrics", duration_sec: 6, type: "stat_display", slots: { metric: t("Key Metric"), founded: num("Founded") } },
      { id: "team", duration_sec: 6, type: "grid", slots: { team_size: num("Team Size") } },
      { id: "cta", duration_sec: 6, type: "cta", slots: { cta_text: t("Call to Action") } },
    ],
    what_you_need: ["Company name", "One-line description", "Founded year", "Team size", "Key metric"],
  },
  {
    id: "biz-product-demo",
    name: "Product Demo Reel",
    category: "Business", emoji: "🎬",
    description: "Feature walkthrough with screen recordings and text overlays.",
    tags: ["demo", "product", "features"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 2, accent_color: "#4dabf7",
    slots: {
      product_name: t("Product Name", true, "HyperAspect"),
      features: t("Key Features (3-5)", true, "AI interview, templates, instant render"),
      cta_url: t("CTA URL", false, "https://example.com"),
      brand_color: col("Accent Color"),
    },
    scenes: [
      { id: "hook", duration_sec: 5, type: "title_card", slots: { product_name: t("Product Name") } },
      { id: "feature-1", duration_sec: 8, type: "image_showcase", slots: { feature_1: t("Feature 1") } },
      { id: "feature-2", duration_sec: 8, type: "image_showcase", slots: { feature_2: t("Feature 2") } },
      { id: "feature-3", duration_sec: 8, type: "image_showcase", slots: { feature_3: t("Feature 3") } },
      { id: "cta", duration_sec: 6, type: "cta", slots: { cta_url: t("CTA URL") } },
    ],
    what_you_need: ["Product name", "3-5 key features", "CTA URL"],
  },
  {
    id: "biz-kpi-dashboard",
    name: "KPI Dashboard Pulse",
    category: "Business", emoji: "📈",
    description: "Quarterly metrics highlights with animated number count-ups.",
    tags: ["metrics", "kpi", "quarterly", "data"],
    default_duration_sec: 25,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "beginner", popularity_rank: 3, accent_color: "#4dabf7",
    slots: {
      period: t("Period", true, "Q2 2026"),
      metric_labels: t("Metric Labels", true, "Revenue, Users, Retention"),
      metric_values: t("Metric Values", true, "$2.4M, 150K, 87%"),
      trend: t("Trend Direction", true, "up"),
    },
    scenes: [
      { id: "header", duration_sec: 4, type: "title_card", slots: { period: t("Period") } },
      { id: "stat-1", duration_sec: 5, type: "stat_display", slots: { label: t("Label 1"), value: num("Value 1") } },
      { id: "stat-2", duration_sec: 5, type: "stat_display", slots: { label: t("Label 2"), value: num("Value 2") } },
      { id: "stat-3", duration_sec: 5, type: "stat_display", slots: { label: t("Label 3"), value: num("Value 3") } },
      { id: "summary", duration_sec: 6, type: "text_overlay", slots: { summary: t("Summary") } },
    ],
    what_you_need: ["Time period", "3-5 metric labels and values"],
  },
  {
    id: "biz-investor-pitch",
    name: "Investor Pitch Teaser",
    category: "Business", emoji: "💡",
    description: "45s hook for fundraising: problem → solution → traction → ask.",
    tags: ["pitch", "fundraising", "investors", "startup"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "advanced", popularity_rank: 4, accent_color: "#4dabf7",
    slots: {
      problem: t("Problem Statement", true, "Video creation is too expensive"),
      solution: t("Your Solution", true, "AI-powered video at 1/10th cost"),
      traction_metric: t("Traction Metric", true, "10K users, $500K ARR"),
      raise_amount: t("Raise Amount", true, "$3M Series A"),
      contact: t("Contact Info", true, "founder@example.com"),
    },
    scenes: [
      { id: "problem", duration_sec: 10, type: "text_overlay", slots: { problem: t("Problem") } },
      { id: "solution", duration_sec: 12, type: "text_overlay", slots: { solution: t("Solution") } },
      { id: "traction", duration_sec: 10, type: "stat_display", slots: { traction: t("Traction") } },
      { id: "ask", duration_sec: 8, type: "title_card", slots: { raise_amount: t("Raise Amount") } },
      { id: "contact", duration_sec: 5, type: "cta", slots: { contact: t("Contact") } },
    ],
    what_you_need: ["Problem statement", "Your solution", "Traction metric", "Raise amount", "Contact info"],
  },
  {
    id: "biz-milestones",
    name: "Company Milestones",
    category: "Business", emoji: "🏆",
    description: "Timeline celebration of key achievements.",
    tags: ["timeline", "achievements", "celebration"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "beginner", popularity_rank: 5, accent_color: "#4dabf7",
    slots: {
      founded_year: num("Founded Year", "2020"),
      milestones: t("Milestones (date — title — desc)", true, "2020: Founded, 2022: Series A, 2024: 1M users"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { title: t("Company Name") } },
      { id: "timeline", duration_sec: 20, type: "timeline", slots: { milestones: t("Milestones") } },
      { id: "cta", duration_sec: 6, type: "cta", slots: { cta: t("Next Step") } },
    ],
    what_you_need: ["Company name", "Founded year", "3-5 key milestones with dates"],
  },
  {
    id: "biz-meet-team",
    name: "Meet the Team",
    category: "Business", emoji: "👥",
    description: "Grid introductions with photo, name, role, and fun fact.",
    tags: ["team", "people", "culture"],
    default_duration_sec: 35,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 6, accent_color: "#4dabf7",
    slots: {
      team_members: t("Team Members (name, role, photo, fun fact)", true, "Jane CEO, John CTO, Sarah Designer"),
    },
    scenes: [
      { id: "intro", duration_sec: 5, type: "title_card", slots: { title: t("Team Name") } },
      { id: "grid", duration_sec: 20, type: "grid", slots: { members: t("Team Members") } },
      { id: "join", duration_sec: 5, type: "cta", slots: { cta: t("We're hiring!") } },
    ],
    what_you_need: ["Team member names", "Roles", "Photos (optional)", "Fun facts"],
  },
  {
    id: "biz-case-study",
    name: "Case Study Spotlight",
    category: "Business", emoji: "📋",
    description: "Client success story: challenge → solution → result.",
    tags: ["case-study", "testimonial", "results"],
    default_duration_sec: 40,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 7, accent_color: "#4dabf7",
    slots: {
      client_name: t("Client Name", true, "Acme Corp"),
      challenge: t("Challenge", true, "Low engagement on social media"),
      solution: t("Solution", true, "Implemented HyperAspect video campaigns"),
      result_metric: t("Result Metric", true, "300% increase in engagement"),
      testimonial_quote: t("Testimonial", false, "\"Game-changing for our brand.\""),
    },
    scenes: [
      { id: "client", duration_sec: 5, type: "title_card", slots: { client_name: t("Client Name") } },
      { id: "challenge", duration_sec: 8, type: "text_overlay", slots: { challenge: t("Challenge") } },
      { id: "solution", duration_sec: 10, type: "text_overlay", slots: { solution: t("Solution") } },
      { id: "result", duration_sec: 8, type: "stat_display", slots: { result: t("Result Metric") } },
      { id: "quote", duration_sec: 9, type: "quote", slots: { quote: t("Testimonial") } },
    ],
    what_you_need: ["Client name", "Challenge description", "Your solution", "Result metric", "Testimonial quote"],
  },
  {
    id: "biz-annual-report",
    name: "Annual Report Highlights",
    category: "Business", emoji: "📅",
    description: "Year-in-review with key stats and memorable moments.",
    tags: ["annual", "report", "year-in-review"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 8, accent_color: "#4dabf7",
    slots: {
      year: num("Year", "2026"),
      highlights: t("Key Highlights", true, "Launched v2, expanded to EU, won Best SaaS"),
      revenue: t("Revenue", false, "$5.2M ARR"),
      growth_pct: t("Growth %", false, "150% YoY"),
      team_growth: num("Team Growth", "25→60 people"),
    },
    scenes: [
      { id: "year-intro", duration_sec: 5, type: "title_card", slots: { year: num("Year") } },
      { id: "highlights", duration_sec: 15, type: "text_overlay", slots: { highlights: t("Highlights") } },
      { id: "growth", duration_sec: 10, type: "stat_display", slots: { revenue: t("Revenue"), growth_pct: t("Growth %") } },
      { id: "team", duration_sec: 8, type: "stat_display", slots: { team_growth: num("Team Growth") } },
      { id: "thanks", duration_sec: 7, type: "text_overlay", slots: { thanks: t("Thank You Message") } },
    ],
    what_you_need: ["Year", "Key highlights (3-5)", "Revenue figure", "Growth %", "Team size change"],
  },

  // ═══════════════════════════════════════════════
  // 📣 MARKETING (8)
  // ═══════════════════════════════════════════════
  {
    id: "mkt-product-launch",
    name: "Product Launch Announcement",
    category: "Marketing", emoji: "🚀",
    description: "Cinematic reveal with countdown and feature tease.",
    tags: ["launch", "reveal", "product"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9", "9:16"], supported: ["16:9", "9:16", "1:1"] },
    difficulty: "intermediate", popularity_rank: 9, accent_color: "#ff6b6b",
    slots: {
      product_name: t("Product Name", true, "Nova 3.0"),
      launch_date: t("Launch Date", true, "July 1, 2026"),
      features: t("Key Features (3-5)", true, "AI editing, real-time render, 4K export"),
      reveal_image: img("Reveal Image", true),
    },
    scenes: [
      { id: "tease", duration_sec: 6, type: "countdown", slots: { tease_text: t("Tease Text") },
        animation: {
          number_pop:    { duration: 0.4, delay: 0, ease: "back.out(1.6)", from: { opacity: 0, scale: 0.3 } },
          tease_text_in: { duration: 0.5, delay: 0.3, ease: "power3.out", from: { opacity: 0, y: 30 } },
          scene_exit:    { duration: 0.2, delay: 5.7, ease: "power3.in", to: { opacity: 0, scale: 1.15, filter: "blur(10px)" } },
        },
        transition_in: { type: "cut", duration: 0 },
      },
      { id: "reveal", duration_sec: 8, type: "title_card", slots: { product_name: t("Product Name") },
        animation: {
          product_name_enter: { duration: 0.8, delay: 0.15, ease: "expo.out", from: { opacity: 0, y: 80, scale: 0.9 } },
          glow_pulse:         { duration: 1.5, delay: 0.5, ease: "sine.inOut", from: { opacity: 0.3 }, to: { opacity: 0.6 } },
          scene_exit:         { duration: 0.3, delay: 7.5, ease: "power2.in", to: { opacity: 0, filter: "blur(15px)" } },
        },
        transition_in: { type: "zoom", duration: 0.35, ease: "power3.out" },
      },
      { id: "features", duration_sec: 10, type: "text_overlay", slots: { features: t("Features") } },
      { id: "date", duration_sec: 6, type: "title_card", slots: { launch_date: t("Launch Date") } },
    ],
    what_you_need: ["Product name", "Launch date", "Key features", "Reveal image"],
  },
  {
    id: "mkt-flash-sale",
    name: "Flash Sale Promo",
    category: "Marketing", emoji: "🔥",
    description: "Urgency-driven limited offer with countdown timer.",
    tags: ["sale", "discount", "urgent"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 10, accent_color: "#ff6b6b",
    slots: {
      discount_pct: num("Discount %", "50"),
      product_name: t("Product Name", true, "Premium Plan"),
      original_price: t("Original Price", true, "$99"),
      sale_price: t("Sale Price", true, "$49"),
      expires_in: t("Expires In", true, "24 hours"),
      promo_code: t("Promo Code", true, "FLASH50"),
    },
    scenes: [
      { id: "discount", duration_sec: 4, type: "title_card", slots: { discount_pct: num("Discount %") } },
      { id: "product", duration_sec: 4, type: "image_showcase", slots: { product_name: t("Product") } },
      { id: "price", duration_sec: 4, type: "split_screen", slots: { original: t("Original"), sale: t("Sale Price") } },
      { id: "urgency", duration_sec: 3, type: "countdown", slots: { expires_in: t("Expires In") } },
    ],
    what_you_need: ["Discount %", "Product name", "Original price", "Sale price", "Expiry", "Promo code"],
  },
  {
    id: "mkt-brand-story",
    name: "Brand Story Narrative",
    category: "Marketing", emoji: "📖",
    description: "Emotional founder/mission story arc.",
    tags: ["story", "brand", "founder", "emotional"],
    default_duration_sec: 60,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "advanced", popularity_rank: 11, accent_color: "#ff6b6b",
    slots: {
      founder_name: t("Founder Name", true, "Jane Doe"),
      origin_story: t("Origin Story", true, "Started in a garage with $500..."),
      mission: t("Mission", true, "Make video creation accessible to everyone"),
      brand_images: img("Brand Images (3-5)"),
    },
    scenes: [
      { id: "opening", duration_sec: 10, type: "title_card", slots: { founder_name: t("Founder") } },
      { id: "origin", duration_sec: 20, type: "text_overlay", slots: { origin_story: t("Origin Story") } },
      { id: "mission", duration_sec: 15, type: "quote", slots: { mission: t("Mission") } },
      { id: "vision", duration_sec: 15, type: "image_showcase", slots: { vision: t("Vision Statement") } },
    ],
    what_you_need: ["Founder name", "Origin story", "Mission statement", "Brand images (optional)"],
  },
  {
    id: "mkt-seasonal",
    name: "Seasonal Campaign",
    category: "Marketing", emoji: "🎄",
    description: "Holiday/season-themed promotional spot.",
    tags: ["seasonal", "holiday", "campaign"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["1:1", "9:16"], supported: ["1:1", "9:16", "16:9"] },
    difficulty: "beginner", popularity_rank: 12, accent_color: "#ff6b6b",
    slots: {
      season: t("Season/Holiday", true, "Summer Sale"),
      offer: t("Special Offer", true, "30% off everything"),
      imagery_theme: t("Visual Theme", true, "Beach, sunshine, tropical"),
      messaging: t("Campaign Message", true, "Dive into savings"),
    },
    scenes: [
      { id: "season-intro", duration_sec: 5, type: "title_card", slots: { season: t("Season") } },
      { id: "offer", duration_sec: 7, type: "stat_display", slots: { offer: t("Offer") } },
      { id: "cta", duration_sec: 8, type: "cta", slots: { messaging: t("Message") } },
    ],
    what_you_need: ["Season/holiday", "Special offer", "Visual theme", "Campaign message"],
  },
  {
    id: "mkt-how-it-works",
    name: "How-It-Works Explainer",
    category: "Marketing", emoji: "⚙️",
    description: "3-5 step process breakdown with icons.",
    tags: ["explainer", "how-to", "process"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "beginner", popularity_rank: 13, accent_color: "#ff6b6b",
    slots: {
      steps: t("Steps (title + description)", true, "1. Sign up 2. Choose template 3. Customize 4. Export"),
      product_name: t("Product Name", true, "HyperAspect"),
      cta: t("Call to Action", true, "Start free trial"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { product_name: t("Product") } },
      { id: "step-1", duration_sec: 5, type: "text_overlay", slots: { step: t("Step 1") } },
      { id: "step-2", duration_sec: 5, type: "text_overlay", slots: { step: t("Step 2") } },
      { id: "step-3", duration_sec: 5, type: "text_overlay", slots: { step: t("Step 3") } },
      { id: "step-4", duration_sec: 5, type: "text_overlay", slots: { step: t("Step 4") } },
      { id: "cta", duration_sec: 6, type: "cta", slots: { cta: t("CTA") } },
    ],
    what_you_need: ["Product name", "3-5 process steps", "Call to action"],
  },
  {
    id: "mkt-before-after",
    name: "Before & After",
    category: "Marketing", emoji: "✨",
    description: "Side-by-side transformation reveal.",
    tags: ["transformation", "comparison", "results"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["1:1", "16:9"], supported: ["1:1", "16:9", "9:16"] },
    difficulty: "beginner", popularity_rank: 14, accent_color: "#ff6b6b",
    slots: {
      before_label: t("Before Label", true, "Before"),
      after_label: t("After Label", true, "After"),
      before_image: img("Before Image", true),
      after_image: img("After Image", true),
      transformation_desc: t("Description", false, "30 days of consistent use"),
    },
    scenes: [
      { id: "before", duration_sec: 5, type: "image_showcase", slots: { before_image: img("Before"), before_label: t("Before Label") } },
      { id: "transition", duration_sec: 3, type: "text_overlay", slots: { transformation_desc: t("Description") } },
      { id: "after", duration_sec: 7, type: "split_screen", slots: { after_image: img("After"), after_label: t("After Label") } },
    ],
    what_you_need: ["Before image", "After image", "Labels", "Transformation description"],
  },
  {
    id: "mkt-social-proof",
    name: "Social Proof Compilation",
    category: "Marketing", emoji: "⭐",
    description: "Customer logos, quotes, and stats montage.",
    tags: ["social-proof", "testimonials", "reviews"],
    default_duration_sec: 25,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 15, accent_color: "#ff6b6b",
    slots: {
      testimonials: t("Testimonials (quote + author)", true, "\"Best tool ever!\" - Jane, CEO"),
      logos: img("Customer Logos (3-5)"),
      aggregate_rating: num("Aggregate Rating", "4.9"),
      customer_count: num("Customer Count", "50000"),
    },
    scenes: [
      { id: "rating", duration_sec: 5, type: "stat_display", slots: { aggregate_rating: num("Rating"), customer_count: num("Customers") } },
      { id: "quote-1", duration_sec: 7, type: "quote", slots: { quote_1: t("Testimonial 1") } },
      { id: "quote-2", duration_sec: 7, type: "quote", slots: { quote_2: t("Testimonial 2") } },
      { id: "logos", duration_sec: 6, type: "grid", slots: { logos: img("Logos") } },
    ],
    what_you_need: ["2-3 testimonial quotes", "Customer logos (optional)", "Aggregate rating", "Customer count"],
  },
  {
    id: "mkt-retargeting",
    name: "Retargeting Ad",
    category: "Marketing", emoji: "🎯",
    description: "\"Still thinking about it?\" bring-back message.",
    tags: ["retargeting", "abandoned", "remarketing"],
    default_duration_sec: 10,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 16, accent_color: "#ff6b6b",
    slots: {
      product_name: t("Product Name", true, "Your Cart"),
      abandoned_item: t("Abandoned Item", true, "Premium Plan"),
      discount_offer: t("Discount Offer", true, "Get 20% off — complete now"),
      cta_url: t("CTA URL", true, "https://example.com/cart"),
    },
    scenes: [
      { id: "hook", duration_sec: 3, type: "title_card", slots: { hook: t("Hook", true, "Still thinking?") } },
      { id: "reminder", duration_sec: 4, type: "image_showcase", slots: { abandoned_item: t("Item") } },
      { id: "offer", duration_sec: 3, type: "stat_display", slots: { discount_offer: t("Offer") } },
    ],
    what_you_need: ["Product name", "Abandoned item", "Discount offer", "CTA URL"],
  },

  // ═══════════════════════════════════════════════
  // 🏠 REAL ESTATE (6)
  // ═══════════════════════════════════════════════
  {
    id: "re-property-tour",
    name: "Property Listing Tour",
    category: "Real Estate", emoji: "🏡",
    description: "Full home walkthrough: exterior → interior → amenities → price.",
    tags: ["property", "listing", "tour", "home"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9", "9:16"], supported: ["16:9", "9:16", "1:1"] },
    difficulty: "intermediate", popularity_rank: 17, accent_color: "#51cf66",
    slots: {
      address: t("Property Address", true, "123 Main St, Sydney NSW"),
      price: t("Price", true, "$850,000"),
      beds: num("Bedrooms", "3"),
      baths: num("Bathrooms", "2"),
      sqft: num("Square Feet", "1,800"),
      photos: img("Property Photos (5-10)", true),
      highlights: t("Key Highlights", true, "Renovated kitchen, pool, walk to beach"),
    },
    scenes: [
      { id: "exterior", duration_sec: 8, type: "image_showcase", slots: { address: t("Address"), photo: img("Exterior") } },
      { id: "interior", duration_sec: 15, type: "image_showcase", slots: { photos: img("Interior Photos") } },
      { id: "specs", duration_sec: 10, type: "stat_display", slots: { beds: num("Beds"), baths: num("Baths"), sqft: num("Sqft") } },
      { id: "highlights", duration_sec: 7, type: "text_overlay", slots: { highlights: t("Highlights") } },
      { id: "price", duration_sec: 5, type: "cta", slots: { price: t("Price") } },
    ],
    what_you_need: ["Property address", "Price", "Bedrooms/bathrooms/sqft", "5-10 photos", "Key highlights"],
  },
  {
    id: "re-neighborhood",
    name: "Neighborhood Guide",
    category: "Real Estate", emoji: "📍",
    description: "Area highlights: schools, dining, transit, and vibe.",
    tags: ["neighborhood", "area", "guide", "local"],
    default_duration_sec: 35,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "9:16"] },
    difficulty: "beginner", popularity_rank: 18, accent_color: "#51cf66",
    slots: {
      neighborhood: t("Neighborhood Name", true, "Bondi Beach"),
      city: t("City", true, "Sydney"),
      highlights: t("Highlights (schools, dining, transit)", true, "Top schools, beachfront cafes, 15min to CBD"),
      walk_score: num("Walk Score", "92"),
      photos: img("Area Photos (3-5)"),
    },
    scenes: [
      { id: "area-intro", duration_sec: 5, type: "title_card", slots: { neighborhood: t("Neighborhood"), city: t("City") } },
      { id: "highlights", duration_sec: 15, type: "text_overlay", slots: { highlights: t("Highlights") } },
      { id: "walk", duration_sec: 7, type: "stat_display", slots: { walk_score: num("Walk Score") } },
      { id: "vibe", duration_sec: 8, type: "image_showcase", slots: { photos: img("Photos") } },
    ],
    what_you_need: ["Neighborhood name", "City", "Highlights (schools, dining, transit)", "Walk score", "Area photos"],
  },
  {
    id: "re-open-house",
    name: "Open House Announcement",
    category: "Real Estate", emoji: "🔑",
    description: "Date/time invitation with property tease.",
    tags: ["open-house", "invitation", "event"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 19, accent_color: "#51cf66",
    slots: {
      address: t("Property Address", true, "123 Main St"),
      open_house_date: t("Date", true, "Saturday, June 25"),
      open_house_time: t("Time", true, "10 AM — 12 PM"),
      price: t("Price Guide", true, "Offers over $800K"),
      feature_image: img("Feature Image", true),
      agent_contact: t("Agent Contact", true, "Jane: 0400 123 456"),
    },
    scenes: [
      { id: "announcement", duration_sec: 5, type: "title_card", slots: { title: t("Open House!") } },
      { id: "property", duration_sec: 5, type: "image_showcase", slots: { feature_image: img("Property"), address: t("Address") } },
      { id: "when", duration_sec: 5, type: "stat_display", slots: { date: t("Date"), time: t("Time") } },
      { id: "agent", duration_sec: 5, type: "cta", slots: { agent_contact: t("Agent") } },
    ],
    what_you_need: ["Property address", "Open house date & time", "Price guide", "Feature image", "Agent contact"],
  },
  {
    id: "re-price-reduction",
    name: "Price Reduction Alert",
    category: "Real Estate", emoji: "📉",
    description: "Eye-catching \"just reduced\" notification.",
    tags: ["price-reduction", "alert", "deal"],
    default_duration_sec: 12,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 20, accent_color: "#51cf66",
    slots: {
      address: t("Address", true, "123 Main St"),
      old_price: t("Old Price", true, "$900,000"),
      new_price: t("New Price", true, "$799,000"),
      reduction_pct: num("Reduction %", "11"),
      photos: img("Property Photos (2-3)"),
    },
    scenes: [
      { id: "alert", duration_sec: 3, type: "title_card", slots: { alert: t("JUST REDUCED!") } },
      { id: "property", duration_sec: 4, type: "image_showcase", slots: { address: t("Address"), photos: img("Photos") } },
      { id: "price-drop", duration_sec: 5, type: "stat_display", slots: { old_price: t("Was"), new_price: t("Now"), reduction_pct: num("Drop %") } },
    ],
    what_you_need: ["Address", "Old price", "New price", "Reduction %", "Property photos"],
  },
  {
    id: "re-just-sold",
    name: "Just Sold Celebration",
    category: "Real Estate", emoji: "🎉",
    description: "Closing announcement to build agent credibility.",
    tags: ["sold", "closing", "credibility"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["1:1", "16:9"], supported: ["1:1", "16:9", "9:16"] },
    difficulty: "beginner", popularity_rank: 21, accent_color: "#51cf66",
    slots: {
      address: t("Address", true, "123 Main St"),
      sale_price: t("Sale Price", true, "$875,000"),
      days_on_market: num("Days on Market", "12"),
      agent_name: t("Agent Name", true, "Jane Smith"),
      agent_photo: img("Agent Photo"),
    },
    scenes: [
      { id: "sold", duration_sec: 4, type: "title_card", slots: { title: t("SOLD!") } },
      { id: "property", duration_sec: 4, type: "image_showcase", slots: { address: t("Address") } },
      { id: "price", duration_sec: 4, type: "stat_display", slots: { sale_price: t("Sale Price"), days: num("Days on Market") } },
      { id: "agent", duration_sec: 3, type: "cta", slots: { agent_name: t("Agent") } },
    ],
    what_you_need: ["Address", "Sale price", "Days on market", "Agent name", "Agent photo"],
  },
  {
    id: "re-agent-brand",
    name: "Agent Personal Brand",
    category: "Real Estate", emoji: "🤝",
    description: "Realtor intro: bio, specialties, recent sales, and contact.",
    tags: ["agent", "personal-brand", "realtor"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9", "9:16"], supported: ["16:9", "9:16", "1:1"] },
    difficulty: "intermediate", popularity_rank: 22, accent_color: "#51cf66",
    slots: {
      agent_name: t("Agent Name", true, "Jane Smith"),
      title: t("Title", true, "Senior Real Estate Agent"),
      bio: t("Bio", true, "15 years experience, $500M+ in sales"),
      specialties: t("Specialties", true, "Luxury homes, Investment properties"),
      recent_sales_count: num("Recent Sales Count", "127"),
      contact_info: t("Contact", true, "jane@realestate.com · 0400 123 456"),
      headshot: img("Headshot", true),
    },
    scenes: [
      { id: "intro", duration_sec: 6, type: "title_card", slots: { agent_name: t("Name"), title: t("Title") } },
      { id: "bio", duration_sec: 8, type: "image_showcase", slots: { headshot: img("Photo"), bio: t("Bio") } },
      { id: "stats", duration_sec: 7, type: "stat_display", slots: { recent_sales_count: num("Sales") } },
      { id: "specialties", duration_sec: 5, type: "text_overlay", slots: { specialties: t("Specialties") } },
      { id: "contact", duration_sec: 4, type: "cta", slots: { contact_info: t("Contact") } },
    ],
    what_you_need: ["Agent name & title", "Bio", "Specialties", "Recent sales count", "Contact info", "Headshot"],
  },

  // ═══════════════════════════════════════════════
  // 📚 EDUCATION (5)
  // ═══════════════════════════════════════════════
  {
    id: "edu-course-preview",
    name: "Course Preview",
    category: "Education", emoji: "🎓",
    description: "Module teaser to drive enrollment.",
    tags: ["course", "education", "enrollment"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "beginner", popularity_rank: 23, accent_color: "#ffd43b",
    slots: {
      course_title: t("Course Title", true, "Mastering Video Marketing"),
      instructor: t("Instructor Name", true, "Dr. Jane Smith"),
      module_count: num("Module Count", "8"),
      duration_hours: num("Duration (hours)", "6"),
      topics: t("Topics Covered", true, "Storytelling, Editing, Distribution, Analytics"),
      enroll_url: t("Enroll URL", true, "https://academy.example.com"),
    },
    scenes: [
      { id: "title", duration_sec: 5, type: "title_card", slots: { course_title: t("Course Title") } },
      { id: "instructor", duration_sec: 5, type: "image_showcase", slots: { instructor: t("Instructor") } },
      { id: "modules", duration_sec: 8, type: "stat_display", slots: { module_count: num("Modules"), duration_hours: num("Hours") } },
      { id: "topics", duration_sec: 7, type: "text_overlay", slots: { topics: t("Topics") } },
      { id: "enroll", duration_sec: 5, type: "cta", slots: { enroll_url: t("Enroll URL") } },
    ],
    what_you_need: ["Course title", "Instructor name", "Module count", "Duration", "Topics", "Enroll URL"],
  },
  {
    id: "edu-micro-lesson",
    name: "60-Second Micro-Lesson",
    category: "Education", emoji: "⚡",
    description: "Single concept explainer in one minute.",
    tags: ["lesson", "micro-learning", "short"],
    default_duration_sec: 60,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 24, accent_color: "#ffd43b",
    slots: {
      topic: t("Topic", true, "The Pareto Principle"),
      definition: t("Definition", true, "80% of results come from 20% of efforts"),
      example: t("Example", true, "80% of sales from 20% of customers"),
      key_takeaway: t("Key Takeaway", true, "Focus on the vital few, not the trivial many"),
    },
    scenes: [
      { id: "question", duration_sec: 8, type: "title_card", slots: { topic: t("Topic") } },
      { id: "definition", duration_sec: 15, type: "text_overlay", slots: { definition: t("Definition") } },
      { id: "example", duration_sec: 20, type: "split_screen", slots: { example: t("Example") } },
      { id: "takeaway", duration_sec: 17, type: "quote", slots: { key_takeaway: t("Key Takeaway") } },
    ],
    what_you_need: ["Topic", "Definition", "Example", "Key takeaway"],
  },
  {
    id: "edu-tutorial",
    name: "Step-by-Step Tutorial",
    category: "Education", emoji: "📝",
    description: "Multi-step how-to guide with visual cues.",
    tags: ["tutorial", "how-to", "guide"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9", "9:16"], supported: ["16:9", "9:16", "1:1"] },
    difficulty: "intermediate", popularity_rank: 25, accent_color: "#ffd43b",
    slots: {
      task_title: t("Task Title", true, "How to Set Up a Video Studio at Home"),
      steps: t("Steps (instruction + visual cue)", true, "1. Choose room 2. Lighting setup 3. Audio 4. Camera 5. Background"),
      difficulty_level: t("Difficulty", true, "Intermediate"),
      tools_needed: t("Tools Needed", true, "Camera, mic, lights, backdrop"),
    },
    scenes: [
      { id: "intro", duration_sec: 5, type: "title_card", slots: { task_title: t("Task"), difficulty_level: t("Difficulty") } },
      { id: "tools", duration_sec: 7, type: "grid", slots: { tools_needed: t("Tools") } },
      { id: "step-1", duration_sec: 6, type: "text_overlay", slots: { step_1: t("Step 1") } },
      { id: "step-2", duration_sec: 6, type: "text_overlay", slots: { step_2: t("Step 2") } },
      { id: "step-3", duration_sec: 6, type: "text_overlay", slots: { step_3: t("Step 3") } },
      { id: "step-4", duration_sec: 6, type: "text_overlay", slots: { step_4: t("Step 4") } },
      { id: "summary", duration_sec: 9, type: "text_overlay", slots: { summary: t("Summary") } },
    ],
    what_you_need: ["Task title", "4-6 step instructions", "Difficulty level", "Tools needed"],
  },
  {
    id: "edu-flashcard",
    name: "Knowledge Flashcard",
    category: "Education", emoji: "🗂️",
    description: "Question → pause → reveal answer format.",
    tags: ["flashcard", "quiz", "study"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1"] },
    difficulty: "beginner", popularity_rank: 26, accent_color: "#ffd43b",
    slots: {
      question: t("Question", true, "What is compound interest?"),
      hint: t("Hint (optional)", false, "Think about earning on earnings"),
      answer: t("Answer", true, "Interest calculated on initial principal + accumulated interest"),
      category: t("Category", true, "Finance"),
      difficulty: t("Difficulty", true, "Beginner"),
    },
    scenes: [
      { id: "category", duration_sec: 3, type: "title_card", slots: { category: t("Category") } },
      { id: "question", duration_sec: 6, type: "text_overlay", slots: { question: t("Question") } },
      { id: "hint", duration_sec: 3, type: "text_overlay", slots: { hint: t("Hint") } },
      { id: "reveal", duration_sec: 3, type: "quote", slots: { answer: t("Answer") } },
    ],
    what_you_need: ["Question", "Hint (optional)", "Answer", "Category", "Difficulty"],
  },
  {
    id: "edu-study-tips",
    name: "Study Strategy Tips",
    category: "Education", emoji: "💡",
    description: "Productivity/learning advice carousel.",
    tags: ["study", "tips", "productivity", "learning"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 27, accent_color: "#ffd43b",
    slots: {
      tips: t("Tips (title + description)", true, "1. Spaced repetition 2. Active recall 3. Feynman technique 4. Pomodoro"),
      subject_area: t("Subject Area", true, "General Study Skills"),
      source: t("Source/Credibility", false, "Based on cognitive science research"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { subject_area: t("Subject") } },
      { id: "tip-1", duration_sec: 6, type: "text_overlay", slots: { tip_1: t("Tip 1") } },
      { id: "tip-2", duration_sec: 6, type: "text_overlay", slots: { tip_2: t("Tip 2") } },
      { id: "tip-3", duration_sec: 6, type: "text_overlay", slots: { tip_3: t("Tip 3") } },
      { id: "tip-4", duration_sec: 5, type: "text_overlay", slots: { tip_4: t("Tip 4") } },
      { id: "source", duration_sec: 3, type: "text_overlay", slots: { source: t("Source") } },
    ],
    what_you_need: ["4-5 study tips", "Subject area", "Source/credibility reference"],
  },

  // ═══════════════════════════════════════════════
  // 📱 SOCIAL MEDIA (7)
  // ═══════════════════════════════════════════════
  {
    id: "soc-ig-reel",
    name: "Instagram Reel",
    category: "Social Media", emoji: "📸",
    description: "Vertical 9:16 short-form with trending structure.",
    tags: ["instagram", "reel", "vertical", "short-form"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["9:16"], supported: ["9:16"] },
    difficulty: "beginner", popularity_rank: 28, accent_color: "#da77f2",
    slots: {
      hook: t("Hook (first 3 sec)", true, "Stop scrolling! This changes everything"),
      main_content: t("Main Content (3-5 points)", true, "Point 1, Point 2, Point 3"),
      cta: t("Call to Action", true, "Follow for more!"),
      music_mood: t("Music Mood", false, "Upbeat / Energetic"),
    },
    scenes: [
      { id: "hook", duration_sec: 3, type: "title_card", slots: { hook: t("Hook") },
        animation: {
          hook_slam:  { duration: 0.35, delay: 0, ease: "power4.out", from: { opacity: 0, y: 100, scale: 1.1 } },
          hook_shake: { duration: 0.15, delay: 0.35, ease: "elastic.out(1, 0.5)", from: { x: -10 }, to: { x: 0 } },
          scene_exit: { duration: 0.15, delay: 2.8, ease: "power2.in", to: { opacity: 0, x: -300, filter: "blur(8px)" } },
        },
        transition_in: { type: "cut", duration: 0 },
      },
      { id: "content-1", duration_sec: 3, type: "text_overlay", slots: { point_1: t("Point 1") },
        animation: {
          text_enter: { duration: 0.3, delay: 0.1, ease: "power3.out", from: { opacity: 0, x: 50 } },
          scene_exit: { duration: 0.15, delay: 2.8, ease: "power2.in", to: { opacity: 0, x: -300, filter: "blur(8px)" } },
        },
        transition_in: { type: "push", duration: 0.2, ease: "power3.out" },
      },
      { id: "content-2", duration_sec: 3, type: "text_overlay", slots: { point_2: t("Point 2") } },
      { id: "content-3", duration_sec: 3, type: "text_overlay", slots: { point_3: t("Point 3") } },
      { id: "cta", duration_sec: 3, type: "cta", slots: { cta: t("CTA") } },
    ],
    what_you_need: ["Hook (first 3 sec)", "3-5 content points", "CTA", "Music mood (optional)"],
  },
  {
    id: "soc-tiktok",
    name: "TikTok Trend Format",
    category: "Social Media", emoji: "🎵",
    description: "Trending sound/pattern adaptation.",
    tags: ["tiktok", "trend", "viral"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["9:16"], supported: ["9:16"] },
    difficulty: "intermediate", popularity_rank: 29, accent_color: "#da77f2",
    slots: {
      trend_type: t("Trend Type", true, "Day in the Life / POV / Tutorial"),
      text_overlays: t("Text Overlays (3-5)", true, "\"POV: You discover...\""),
      sound_suggestion: t("Sound Suggestion", false, "Trending audio suggestion"),
      hashtags: t("Hashtags", true, "#fyp #viral #tutorial"),
    },
    scenes: [
      { id: "setup", duration_sec: 3, type: "title_card", slots: { trend_type: t("Trend Type") } },
      { id: "beat-1", duration_sec: 3, type: "text_overlay", slots: { text_1: t("Text 1") } },
      { id: "beat-2", duration_sec: 3, type: "text_overlay", slots: { text_2: t("Text 2") } },
      { id: "beat-3", duration_sec: 3, type: "text_overlay", slots: { text_3: t("Text 3") } },
      { id: "hashtags", duration_sec: 3, type: "text_overlay", slots: { hashtags: t("Hashtags") } },
    ],
    what_you_need: ["Trend type", "3-5 text overlays", "Sound suggestion (optional)", "Hashtags"],
  },
  {
    id: "soc-linkedin",
    name: "LinkedIn Thought Leader",
    category: "Social Media", emoji: "💼",
    description: "Professional insight carousel-as-video.",
    tags: ["linkedin", "professional", "thought-leadership"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["1:1", "16:9"], supported: ["1:1", "16:9"] },
    difficulty: "intermediate", popularity_rank: 30, accent_color: "#da77f2",
    slots: {
      insight_title: t("Insight Title", true, "Why remote-first teams outperform"),
      key_points: t("Key Points (3-5)", true, "1. Async by default 2. Documentation culture 3. Results over hours"),
      author_name: t("Author Name", true, "Jane Doe"),
      author_title: t("Author Title", true, "VP Engineering @ TechCorp"),
      company: t("Company", false, "TechCorp"),
    },
    scenes: [
      { id: "hook", duration_sec: 6, type: "title_card", slots: { insight_title: t("Title") } },
      { id: "point-1", duration_sec: 8, type: "text_overlay", slots: { point_1: t("Point 1") } },
      { id: "point-2", duration_sec: 8, type: "text_overlay", slots: { point_2: t("Point 2") } },
      { id: "point-3", duration_sec: 8, type: "text_overlay", slots: { point_3: t("Point 3") } },
      { id: "author", duration_sec: 8, type: "title_card", slots: { author_name: t("Author"), author_title: t("Title") } },
      { id: "engage", duration_sec: 7, type: "cta", slots: { cta: t("Thoughts? Comment below") } },
    ],
    what_you_need: ["Insight title", "3-5 key points", "Author name & title", "Company (optional)"],
  },
  {
    id: "soc-yt-intro",
    name: "YouTube Channel Intro",
    category: "Social Media", emoji: "▶️",
    description: "5-10s branding sting for video openers.",
    tags: ["youtube", "intro", "branding", "sting"],
    default_duration_sec: 8,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9"] },
    difficulty: "beginner", popularity_rank: 31, accent_color: "#da77f2",
    slots: {
      channel_name: t("Channel Name", true, "Tech Insights Daily"),
      tagline: t("Tagline", false, "Where tech meets tomorrow"),
      logo_url: img("Logo (optional)"),
      subscribe_cta: t("Subscribe CTA", true, "Subscribe for daily tech insights!"),
    },
    scenes: [
      { id: "logo-reveal", duration_sec: 3, type: "title_card", slots: { channel_name: t("Channel Name") } },
      { id: "tagline", duration_sec: 3, type: "text_overlay", slots: { tagline: t("Tagline") } },
      { id: "subscribe", duration_sec: 2, type: "cta", slots: { subscribe_cta: t("Subscribe CTA") } },
    ],
    what_you_need: ["Channel name", "Tagline", "Logo (optional)", "Subscribe CTA"],
  },
  {
    id: "soc-quote",
    name: "Quote Graphic",
    category: "Social Media", emoji: "💬",
    description: "Inspirational/motivational text animation.",
    tags: ["quote", "inspirational", "motivational"],
    default_duration_sec: 10,
    aspect_ratios: { recommended: ["1:1", "9:16"], supported: ["1:1", "9:16", "16:9"] },
    difficulty: "beginner", popularity_rank: 32, accent_color: "#da77f2",
    slots: {
      quote: t("Quote", true, "The best time to plant a tree was 20 years ago. The second best time is now."),
      author: t("Author", true, "Chinese Proverb"),
      background_image: img("Background Image (optional)"),
      text_color: col("Text Color", "#ffffff"),
    },
    scenes: [
      { id: "quote-open", duration_sec: 3, type: "title_card", slots: {} },
      { id: "quote-full", duration_sec: 5, type: "quote", slots: { quote: t("Quote"), author: t("Author") } },
      { id: "outro", duration_sec: 2, type: "text_overlay", slots: {} },
    ],
    what_you_need: ["Quote text", "Author/attribution", "Background image (optional)"],
  },
  {
    id: "soc-countdown",
    name: "Hype Countdown",
    category: "Social Media", emoji: "🔢",
    description: "Multi-day teaser building to launch/event.",
    tags: ["countdown", "teaser", "hype", "launch"],
    default_duration_sec: 10,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1"] },
    difficulty: "beginner", popularity_rank: 33, accent_color: "#da77f2",
    slots: {
      event_name: t("Event Name", true, "Product Launch: Nova 3.0"),
      target_date: t("Target Date", true, "July 1, 2026"),
      tease_messages: t("Tease Messages (3-5)", true, "\"Something big is coming\" → \"3 days...\" → \"Tomorrow...\" → \"IT'S HERE\""),
    },
    scenes: [
      { id: "tease-1", duration_sec: 3, type: "countdown", slots: { tease_1: t("Tease 1") } },
      { id: "tease-2", duration_sec: 3, type: "countdown", slots: { tease_2: t("Tease 2") } },
      { id: "reveal", duration_sec: 4, type: "title_card", slots: { event_name: t("Event Name"), target_date: t("Date") } },
    ],
    what_you_need: ["Event name", "Target date", "3-5 tease messages"],
  },
  {
    id: "soc-story",
    name: "Story Sequence",
    category: "Social Media", emoji: "📱",
    description: "3-5 part vertical story arc for IG/Snapchat.",
    tags: ["story", "sequence", "vertical", "narrative"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["9:16"], supported: ["9:16"] },
    difficulty: "beginner", popularity_rank: 34, accent_color: "#da77f2",
    slots: {
      story_parts: t("Story Parts (text + image per part)", true, "Part 1: Setup, Part 2: Conflict, Part 3: Resolution"),
      platform: t("Platform", true, "Instagram"),
    },
    scenes: [
      { id: "part-1", duration_sec: 5, type: "text_overlay", slots: { part_1: t("Part 1") } },
      { id: "part-2", duration_sec: 5, type: "text_overlay", slots: { part_2: t("Part 2") } },
      { id: "part-3", duration_sec: 5, type: "text_overlay", slots: { part_3: t("Part 3") } },
      { id: "cta", duration_sec: 5, type: "cta", slots: { cta: t("Swipe up!") } },
    ],
    what_you_need: ["3-5 story parts (text + image)", "Target platform"],
  },

  // ═══════════════════════════════════════════════
  // 🎉 EVENTS (5)
  // ═══════════════════════════════════════════════
  {
    id: "evt-invitation",
    name: "Event Invitation",
    category: "Events", emoji: "✉️",
    description: "Save-the-date with all key details.",
    tags: ["invitation", "save-the-date", "event"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["1:1", "16:9"], supported: ["1:1", "16:9", "9:16"] },
    difficulty: "beginner", popularity_rank: 35, accent_color: "#ff922b",
    slots: {
      event_name: t("Event Name", true, "Annual Tech Summit 2026"),
      date: t("Date", true, "September 15-17, 2026"),
      time: t("Time", true, "9:00 AM"),
      location: t("Location", true, "Sydney Convention Centre"),
      description: t("Description", true, "3 days of talks, workshops, and networking"),
      rsvp_url: t("RSVP URL", true, "https://event.example.com/rsvp"),
    },
    scenes: [
      { id: "save-date", duration_sec: 5, type: "title_card", slots: { event_name: t("Event Name") } },
      { id: "when-where", duration_sec: 6, type: "stat_display", slots: { date: t("Date"), time: t("Time"), location: t("Location") } },
      { id: "about", duration_sec: 5, type: "text_overlay", slots: { description: t("Description") } },
      { id: "rsvp", duration_sec: 4, type: "cta", slots: { rsvp_url: t("RSVP") } },
    ],
    what_you_need: ["Event name", "Date & time", "Location", "Description", "RSVP URL"],
  },
  {
    id: "evt-recap",
    name: "Conference Recap",
    category: "Events", emoji: "🎬",
    description: "Highlights reel from a past event.",
    tags: ["recap", "highlights", "conference"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 36, accent_color: "#ff922b",
    slots: {
      event_name: t("Event Name", true, "Tech Summit 2026"),
      highlights: t("Highlights (3-5 moments)", true, "Keynote, panel debate, product demo, networking"),
      attendee_count: num("Attendee Count", "2000"),
      speaker_quotes: t("Speaker Quotes (2-3)", false, "\"This changes everything\" — CEO"),
      photos: img("Event Photos (5-10)"),
    },
    scenes: [
      { id: "intro", duration_sec: 5, type: "title_card", slots: { event_name: t("Event") } },
      { id: "highlight-1", duration_sec: 8, type: "image_showcase", slots: { highlight_1: t("Highlight 1") } },
      { id: "highlight-2", duration_sec: 8, type: "image_showcase", slots: { highlight_2: t("Highlight 2") } },
      { id: "stats", duration_sec: 7, type: "stat_display", slots: { attendee_count: num("Attendees") } },
      { id: "quotes", duration_sec: 10, type: "quote", slots: { speaker_quotes: t("Quotes") } },
      { id: "outro", duration_sec: 7, type: "text_overlay", slots: { outro: t("See you next year!") } },
    ],
    what_you_need: ["Event name", "3-5 highlight moments", "Attendee count", "Speaker quotes (optional)", "Event photos"],
  },
  {
    id: "evt-webinar-promo",
    name: "Webinar Promo",
    category: "Events", emoji: "🖥️",
    description: "Drive registrations with topic + speaker + value prop.",
    tags: ["webinar", "promo", "registration"],
    default_duration_sec: 25,
    aspect_ratios: { recommended: ["16:9", "1:1"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "beginner", popularity_rank: 37, accent_color: "#ff922b",
    slots: {
      webinar_title: t("Webinar Title", true, "AI in Video Production: 2026 Trends"),
      date: t("Date", true, "June 30, 2026"),
      speaker_name: t("Speaker Name", true, "Dr. Jane Smith"),
      speaker_title: t("Speaker Title", true, "AI Research Lead, TechCorp"),
      value_points: t("Value Points (3-5)", true, "Latest AI trends, case studies, live Q&A"),
      register_url: t("Register URL", true, "https://webinar.example.com/register"),
    },
    scenes: [
      { id: "title", duration_sec: 5, type: "title_card", slots: { webinar_title: t("Title") } },
      { id: "speaker", duration_sec: 6, type: "image_showcase", slots: { speaker_name: t("Speaker"), speaker_title: t("Title") } },
      { id: "value", duration_sec: 7, type: "text_overlay", slots: { value_points: t("Value Points") } },
      { id: "when", duration_sec: 3, type: "stat_display", slots: { date: t("Date") } },
      { id: "register", duration_sec: 4, type: "cta", slots: { register_url: t("Register") } },
    ],
    what_you_need: ["Webinar title", "Date", "Speaker name & title", "Value points", "Register URL"],
  },
  {
    id: "evt-thank-you",
    name: "Post-Event Thank You",
    category: "Events", emoji: "🙏",
    description: "Gratitude + key moments + next steps.",
    tags: ["thank-you", "post-event", "follow-up"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["16:9", "1:1"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "beginner", popularity_rank: 38, accent_color: "#ff922b",
    slots: {
      event_name: t("Event Name", true, "Tech Summit 2026"),
      attendee_count: num("Attendee Count", "2000"),
      highlights: t("Highlights (2-3)", true, "Amazing keynotes, great networking"),
      next_event_hint: t("Next Event Hint", false, "See you in 2027!"),
      feedback_url: t("Feedback URL", true, "https://survey.example.com"),
    },
    scenes: [
      { id: "thanks", duration_sec: 5, type: "title_card", slots: { event_name: t("Event"), message: t("Thank You!") } },
      { id: "stats", duration_sec: 5, type: "stat_display", slots: { attendee_count: num("Attendees") } },
      { id: "highlights", duration_sec: 5, type: "text_overlay", slots: { highlights: t("Highlights") } },
      { id: "feedback", duration_sec: 5, type: "cta", slots: { feedback_url: t("Give Feedback") } },
    ],
    what_you_need: ["Event name", "Attendee count", "2-3 highlights", "Feedback URL"],
  },
  {
    id: "evt-speaker-reveal",
    name: "Keynote Speaker Reveal",
    category: "Events", emoji: "🎤",
    description: "Dramatic announcement of featured speaker.",
    tags: ["speaker", "reveal", "announcement"],
    default_duration_sec: 15,
    aspect_ratios: { recommended: ["1:1", "16:9"], supported: ["1:1", "16:9", "9:16"] },
    difficulty: "beginner", popularity_rank: 39, accent_color: "#ff922b",
    slots: {
      speaker_name: t("Speaker Name", true, "Elon Musk"),
      credentials: t("Credentials", true, "CEO of Tesla, SpaceX"),
      topic: t("Topic", true, "The Future of Energy"),
      event_name: t("Event Name", true, "Tech Summit 2026"),
      event_date: t("Event Date", true, "September 15, 2026"),
    },
    scenes: [
      { id: "tease", duration_sec: 4, type: "title_card", slots: { tease: t("Announcing...") } },
      { id: "reveal", duration_sec: 5, type: "title_card", slots: { speaker_name: t("Name") } },
      { id: "creds", duration_sec: 3, type: "text_overlay", slots: { credentials: t("Credentials") } },
      { id: "topic", duration_sec: 3, type: "quote", slots: { topic: t("Topic") } },
    ],
    what_you_need: ["Speaker name", "Credentials", "Topic", "Event name", "Event date"],
  },

  // ═══════════════════════════════════════════════
  // 👤 PERSONAL (5)
  // ═══════════════════════════════════════════════
  {
    id: "per-birthday",
    name: "Birthday Celebration",
    category: "Personal", emoji: "🎂",
    description: "Personalized birthday greeting montage.",
    tags: ["birthday", "celebration", "personal"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "beginner", popularity_rank: 40, accent_color: "#22d3ee",
    slots: {
      name: t("Person's Name", true, "Sarah"),
      age: num("Age", "30"),
      photos: img("Photos (3-5)"),
      personal_message: t("Personal Message", true, "Happy birthday! Here's to another amazing year"),
      music_mood: t("Music Mood", false, "Upbeat / Fun"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { name: t("Name"), age: num("Age") } },
      { id: "memories", duration_sec: 10, type: "image_showcase", slots: { photos: img("Photos") } },
      { id: "message", duration_sec: 6, type: "quote", slots: { personal_message: t("Message") } },
    ],
    what_you_need: ["Person's name", "Age", "3-5 photos", "Personal message"],
  },
  {
    id: "per-wedding",
    name: "Wedding / Engagement",
    category: "Personal", emoji: "💍",
    description: "Save-the-date or announcement with couple's story.",
    tags: ["wedding", "engagement", "save-the-date", "romance"],
    default_duration_sec: 25,
    aspect_ratios: { recommended: ["16:9", "1:1"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "intermediate", popularity_rank: 41, accent_color: "#22d3ee",
    slots: {
      names: t("Couple's Names", true, "Jane & John"),
      date: t("Wedding Date", true, "December 12, 2026"),
      venue: t("Venue", true, "Beverly Hills Hotel"),
      story: t("Love Story", true, "Met in college, engaged in Paris"),
      couple_photo: img("Couple Photo", true),
    },
    scenes: [
      { id: "announcement", duration_sec: 5, type: "title_card", slots: { names: t("Names") } },
      { id: "story", duration_sec: 10, type: "text_overlay", slots: { story: t("Story") } },
      { id: "details", duration_sec: 5, type: "stat_display", slots: { date: t("Date"), venue: t("Venue") } },
      { id: "photo", duration_sec: 5, type: "image_showcase", slots: { couple_photo: img("Photo") } },
    ],
    what_you_need: ["Couple's names", "Wedding date", "Venue", "Love story", "Couple photo"],
  },
  {
    id: "per-travel",
    name: "Travel Recap",
    category: "Personal", emoji: "✈️",
    description: "Trip highlights with location stamps.",
    tags: ["travel", "recap", "adventure", "vacation"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["9:16", "16:9"], supported: ["9:16", "16:9", "1:1"] },
    difficulty: "beginner", popularity_rank: 42, accent_color: "#22d3ee",
    slots: {
      destinations: t("Destinations", true, "Tokyo, Kyoto, Osaka"),
      trip_dates: t("Trip Dates", true, "May 1-15, 2026"),
      photos: img("Travel Photos (8-12)"),
      highlights: t("Highlights (3-5)", true, "Cherry blossoms, street food, temples"),
      music_mood: t("Music Mood", false, "Adventurous / Energetic"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { destinations: t("Destinations") } },
      { id: "location-1", duration_sec: 6, type: "image_showcase", slots: { photos: img("Photos"), location_1: t("Location 1") } },
      { id: "location-2", duration_sec: 6, type: "image_showcase", slots: { location_2: t("Location 2") } },
      { id: "highlights", duration_sec: 8, type: "text_overlay", slots: { highlights: t("Highlights") } },
      { id: "outro", duration_sec: 6, type: "quote", slots: { trip_dates: t("Dates") } },
    ],
    what_you_need: ["Destinations visited", "Trip dates", "8-12 travel photos", "Highlights"],
  },
  {
    id: "per-resume",
    name: "Visual Resume / Portfolio",
    category: "Personal", emoji: "📄",
    description: "Professional highlight reel for job seekers.",
    tags: ["resume", "portfolio", "career", "job"],
    default_duration_sec: 45,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 43, accent_color: "#22d3ee",
    slots: {
      name: t("Your Name", true, "Jane Smith"),
      title: t("Professional Title", true, "Senior Product Designer"),
      experience_highlights: t("Experience Highlights (3-5)", true, "5 years at Google, led design for Maps"),
      skills: t("Key Skills", true, "Figma, Prototyping, User Research, Design Systems"),
      contact: t("Contact", true, "jane@example.com"),
      portfolio_url: t("Portfolio URL", true, "https://jane.design"),
    },
    scenes: [
      { id: "intro", duration_sec: 6, type: "title_card", slots: { name: t("Name"), title: t("Title") } },
      { id: "experience", duration_sec: 15, type: "text_overlay", slots: { experience_highlights: t("Experience") } },
      { id: "skills", duration_sec: 10, type: "grid", slots: { skills: t("Skills") } },
      { id: "portfolio", duration_sec: 8, type: "image_showcase", slots: { portfolio_url: t("Portfolio") } },
      { id: "contact", duration_sec: 6, type: "cta", slots: { contact: t("Contact") } },
    ],
    what_you_need: ["Your name", "Professional title", "Experience highlights", "Key skills", "Contact", "Portfolio URL"],
  },
  {
    id: "per-milestone",
    name: "Family Milestone",
    category: "Personal", emoji: "👨‍👩‍👧",
    description: "Baby announcement, graduation, anniversary.",
    tags: ["family", "milestone", "announcement"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["1:1", "9:16"], supported: ["1:1", "9:16", "16:9"] },
    difficulty: "beginner", popularity_rank: 44, accent_color: "#22d3ee",
    slots: {
      milestone_type: t("Milestone Type", true, "New Baby / Graduation / Anniversary"),
      names: t("Names", true, "The Smith Family"),
      date: t("Date", true, "June 18, 2026"),
      details: t("Details", true, "Welcome baby James! 7lb 3oz, 20 inches"),
      photos: img("Photos (2-3)"),
    },
    scenes: [
      { id: "announcement", duration_sec: 5, type: "title_card", slots: { milestone_type: t("Milestone") } },
      { id: "details", duration_sec: 7, type: "text_overlay", slots: { details: t("Details") } },
      { id: "family", duration_sec: 5, type: "image_showcase", slots: { photos: img("Photos"), names: t("Names") } },
      { id: "date", duration_sec: 3, type: "stat_display", slots: { date: t("Date") } },
    ],
    what_you_need: ["Milestone type", "Names", "Date", "Details", "Photos"],
  },

  // ═══════════════════════════════════════════════
  // 🏭 INDUSTRY-SPECIFIC (6)
  // ═══════════════════════════════════════════════
  {
    id: "ind-restaurant",
    name: "Restaurant Menu Highlight",
    category: "Industry", emoji: "🍽️",
    description: "Mouth-watering dish showcase.",
    tags: ["restaurant", "food", "menu"],
    default_duration_sec: 25,
    aspect_ratios: { recommended: ["1:1", "9:16"], supported: ["1:1", "9:16", "16:9"] },
    difficulty: "beginner", popularity_rank: 45, accent_color: "#a78bfa",
    slots: {
      restaurant_name: t("Restaurant Name", true, "Bella Italia"),
      dishes: t("Dishes (name + desc + price + image)", true, "Margherita Pizza $18, Carbonara $22, Tiramisu $12"),
      location: t("Location", true, "123 Main St, Sydney"),
      ordering_url: t("Ordering URL", true, "https://order.bellaitalia.com"),
    },
    scenes: [
      { id: "intro", duration_sec: 4, type: "title_card", slots: { restaurant_name: t("Restaurant") } },
      { id: "dish-1", duration_sec: 6, type: "image_showcase", slots: { dish_1: t("Dish 1") } },
      { id: "dish-2", duration_sec: 6, type: "image_showcase", slots: { dish_2: t("Dish 2") } },
      { id: "dish-3", duration_sec: 5, type: "image_showcase", slots: { dish_3: t("Dish 3") } },
      { id: "order", duration_sec: 4, type: "cta", slots: { ordering_url: t("Order Now") } },
    ],
    what_you_need: ["Restaurant name", "3-5 dishes with descriptions & prices", "Location", "Ordering URL"],
  },
  {
    id: "ind-fitness",
    name: "Fitness Program Promo",
    category: "Industry", emoji: "💪",
    description: "Workout program marketing with transformations.",
    tags: ["fitness", "workout", "transformation", "health"],
    default_duration_sec: 30,
    aspect_ratios: { recommended: ["9:16", "1:1"], supported: ["9:16", "1:1", "16:9"] },
    difficulty: "intermediate", popularity_rank: 46, accent_color: "#a78bfa",
    slots: {
      program_name: t("Program Name", true, "30-Day Shred"),
      duration_weeks: num("Duration (weeks)", "4"),
      results_promise: t("Results Promise", true, "Lose 10lb in 30 days or your money back"),
      difficulty: t("Difficulty Level", true, "Intermediate"),
      enroll_url: t("Enroll URL", true, "https://fit.example.com/enroll"),
      before_after: img("Before/After Photos (optional)"),
    },
    scenes: [
      { id: "hook", duration_sec: 5, type: "title_card", slots: { program_name: t("Program") } },
      { id: "promise", duration_sec: 7, type: "stat_display", slots: { results_promise: t("Promise"), duration_weeks: num("Weeks") } },
      { id: "difficulty", duration_sec: 5, type: "text_overlay", slots: { difficulty: t("Difficulty") } },
      { id: "transform", duration_sec: 8, type: "split_screen", slots: { before_after: img("Transformations") } },
      { id: "enroll", duration_sec: 5, type: "cta", slots: { enroll_url: t("Enroll") } },
    ],
    what_you_need: ["Program name", "Duration (weeks)", "Results promise", "Difficulty", "Enroll URL", "Before/after photos (optional)"],
  },
  {
    id: "ind-medical",
    name: "Medical Practice Intro",
    category: "Industry", emoji: "🏥",
    description: "Trust-building healthcare provider overview.",
    tags: ["medical", "healthcare", "practice", "trust"],
    default_duration_sec: 35,
    aspect_ratios: { recommended: ["16:9"], supported: ["16:9", "1:1"] },
    difficulty: "intermediate", popularity_rank: 47, accent_color: "#a78bfa",
    slots: {
      practice_name: t("Practice Name", true, "City Medical Centre"),
      specialties: t("Specialties", true, "General Practice, Pediatrics, Women's Health"),
      location: t("Location", true, "456 Health Ave, Sydney"),
      accepting_patients: t("Accepting New Patients?", true, "Yes — book today"),
      booking_url: t("Booking URL", true, "https://book.citymedical.com"),
      provider_photo: img("Provider Photo"),
    },
    scenes: [
      { id: "intro", duration_sec: 6, type: "title_card", slots: { practice_name: t("Practice") } },
      { id: "specialties", duration_sec: 8, type: "grid", slots: { specialties: t("Specialties") } },
      { id: "trust", duration_sec: 7, type: "image_showcase", slots: { provider_photo: img("Photo") } },
      { id: "info", duration_sec: 7, type: "stat_display", slots: { location: t("Location"), accepting_patients: t("Accepting?") } },
      { id: "book", duration_sec: 7, type: "cta", slots: { booking_url: t("Book Now") } },
    ],
    what_you_need: ["Practice name", "Specialties", "Location", "Booking URL", "Provider photo"],
  },
  {
    id: "ind-nonprofit",
    name: "Nonprofit Impact Story",
    category: "Industry", emoji: "🤲",
    description: "Cause awareness with beneficiary stories.",
    tags: ["nonprofit", "charity", "impact", "cause"],
    default_duration_sec: 40,
    aspect_ratios: { recommended: ["16:9", "1:1"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "intermediate", popularity_rank: 48, accent_color: "#a78bfa",
    slots: {
      organization_name: t("Organization Name", true, "Clean Oceans Foundation"),
      mission: t("Mission Statement", true, "Removing plastic from our oceans by 2030"),
      impact_stats: t("Impact Stats (2-3)", true, "2M kg removed, 500 beaches cleaned, 50K volunteers"),
      beneficiary_quote: t("Beneficiary Quote", false, "\"Our beach is clean again\" — Local resident"),
      donate_url: t("Donate URL", true, "https://cleanoceans.org/donate"),
    },
    scenes: [
      { id: "intro", duration_sec: 6, type: "title_card", slots: { organization_name: t("Org") } },
      { id: "mission", duration_sec: 10, type: "quote", slots: { mission: t("Mission") } },
      { id: "impact", duration_sec: 12, type: "stat_display", slots: { impact_stats: t("Impact") } },
      { id: "story", duration_sec: 7, type: "text_overlay", slots: { beneficiary_quote: t("Quote") } },
      { id: "donate", duration_sec: 5, type: "cta", slots: { donate_url: t("Donate") } },
    ],
    what_you_need: ["Organization name", "Mission statement", "Impact stats", "Beneficiary quote (optional)", "Donate URL"],
  },
  {
    id: "ind-saas-changelog",
    name: "SaaS Changelog Update",
    category: "Industry", emoji: "🔄",
    description: "New feature announcement for existing users.",
    tags: ["saas", "changelog", "update", "features"],
    default_duration_sec: 20,
    aspect_ratios: { recommended: ["16:9", "1:1"], supported: ["16:9", "1:1", "9:16"] },
    difficulty: "beginner", popularity_rank: 49, accent_color: "#a78bfa",
    slots: {
      product_name: t("Product Name", true, "HyperAspect"),
      version: t("Version", true, "v2.5"),
      features: t("Features (name + benefit)", true, "Batch rendering, Dark mode, API access"),
      release_date: t("Release Date", true, "June 18, 2026"),
    },
    scenes: [
      { id: "announcement", duration_sec: 4, type: "title_card", slots: { product_name: t("Product"), version: t("Version") } },
      { id: "feature-1", duration_sec: 5, type: "text_overlay", slots: { feature_1: t("Feature 1") } },
      { id: "feature-2", duration_sec: 5, type: "text_overlay", slots: { feature_2: t("Feature 2") } },
      { id: "feature-3", duration_sec: 4, type: "text_overlay", slots: { feature_3: t("Feature 3") } },
      { id: "date", duration_sec: 2, type: "stat_display", slots: { release_date: t("Date") } },
    ],
    what_you_need: ["Product name", "Version number", "3-5 features with benefits", "Release date"],
  },
  {
    id: "ind-advocacy",
    name: "Issue Advocacy Campaign",
    category: "Industry", emoji: "📢",
    description: "Awareness drive for a cause or policy position.",
    tags: ["advocacy", "campaign", "awareness", "policy"],
    default_duration_sec: 35,
    aspect_ratios: { recommended: ["16:9", "9:16"], supported: ["16:9", "9:16", "1:1"] },
    difficulty: "intermediate", popularity_rank: 50, accent_color: "#a78bfa",
    slots: {
      issue: t("Issue", true, "Net Neutrality"),
      position: t("Your Position", true, "Keep the internet free and open"),
      key_facts: t("Key Facts (3-5)", true, "ISPs could throttle competitors, higher costs for consumers"),
      cta: t("Call to Action", true, "Sign the petition / Share this video / Contact your rep"),
    },
    scenes: [
      { id: "hook", duration_sec: 6, type: "title_card", slots: { issue: t("Issue") } },
      { id: "position", duration_sec: 8, type: "quote", slots: { position: t("Position") } },
      { id: "facts", duration_sec: 12, type: "text_overlay", slots: { key_facts: t("Key Facts") } },
      { id: "act", duration_sec: 9, type: "cta", slots: { cta: t("Take Action") } },
    ],
    what_you_need: ["Issue", "Your position", "3-5 key facts", "Call to action"],
  },
];

// Utility functions
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATES.filter(t => t.category === category);
}

export function searchTemplates(query: string): Template[] {
  const q = query.toLowerCase();
  return TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function getPopularTemplates(limit = 8): Template[] {
  return [...TEMPLATES].sort((a, b) => a.popularity_rank - b.popularity_rank).slice(0, limit);
}
