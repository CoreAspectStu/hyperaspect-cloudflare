import { NextRequest, NextResponse } from "next/server";
import { getTemplateById, type Template, type TemplateSlot } from "@/lib/templates";

// AI Interview Engine — asks guided questions based on input
// This is the "creative director" brain of hyperAspect
// When a template is selected, questions are generated from the template's
// slot definitions so the interview feels like a smart assistant filling in
// the template, not a generic questionnaire.

interface InterviewState {
  type: string;
  content: string;
  messages: { role: string; content: string }[];
  brief: Record<string, string>;
  template_id?: string;
}

type QuestionResult = {
  question: string;
  options?: string[];
  styleChoices?: { name: string; colors: string[] }[];
};

// ─── Generic question flow (used when no template is selected) ───
const GENERIC_QUESTION_FLOW: {
  key: string;
  question: (input: string, brief: Record<string, string>) => QuestionResult;
}[] = [
  {
    key: "purpose",
    question: (input: string) => {
      const lower = input.toLowerCase();
      if (lower.includes("ad") || lower.includes("sell") || lower.includes("business")) {
        return { question: "Is this a product ad, a service promotion, or something else?", options: ["Product ad", "Service promotion", "Brand awareness", "Something else"] };
      }
      if (lower.includes("tutorial") || lower.includes("how") || lower.includes("guide")) {
        return { question: "Is this a step-by-step tutorial, a quick tip, or a full course?", options: ["Quick tip", "Step-by-step tutorial", "Full course", "Explainer"] };
      }
      return { question: "What kind of video are we creating?", options: ["Product/Service Ad", "Explainer Video", "Social Media Post", "Tutorial/How-to", "Presentation", "Story/Animation"] };
    },
  },
  {
    key: "format",
    question: () => ({
      question: "Where will this video live? This determines the format.",
      options: ["Instagram/TikTok (9:16)", "YouTube (16:9)", "Website/Demo (16:9)", "Square (1:1)", "Not sure"],
    }),
  },
  {
    key: "tone",
    question: () => ({
      question: "What vibe feels right? Pick a style:",
      styleChoices: [
        { name: "Bold & Energetic", colors: ["#FF5252", "#FFD740", "#FFEB3B"] },
        { name: "Clean & Professional", colors: ["#1a365d", "#3182ce", "#e2e8f0"] },
        { name: "Dark & Dramatic", colors: ["#0a0a0a", "#8b0000", "#d4af37"] },
        { name: "Warm & Friendly", colors: ["#fbbf24", "#f97316", "#fef3c7"] },
        { name: "Minimalist", colors: ["#111", "#666", "#f5f5f5"] },
        { name: "Playful & Fun", colors: ["#22c55e", "#3b82f6", "#fbbf24"] },
      ],
    }),
  },
  {
    key: "duration",
    question: (input: string, brief: Record<string, string>) => {
      if (brief.purpose?.includes("Social")) {
        return { question: "How long?", options: ["15 seconds", "30 seconds", "60 seconds", "Let AI decide"] };
      }
      return { question: "How long should the video be?", options: ["15 seconds", "30 seconds", "60 seconds", "2-3 minutes", "Let AI decide"] };
    },
  },
  {
    key: "sound",
    question: () => ({
      question: "Do you want narration and/or background music?",
      options: ["Narration + Music", "Narration only", "Music only", "Silent (text only)"],
    }),
  },
  {
    key: "cta",
    question: (input: string, brief: Record<string, string>) => {
      if (brief.purpose?.includes("Ad") || brief.purpose?.includes("promotion")) {
        return { question: "What should the viewer DO after watching? (call to action)", options: ["Visit website", "Buy/Sign up", "Follow on social", "Call phone number", "Download app"] };
      }
      return { question: "Anything you want the viewer to do after watching?", options: ["Subscribe/Follow", "Visit website", "Just inform/educate", "Share with friends"] };
    },
  },
];

// ─── Template-aware question phrasing ───
// Turns a slot definition into a natural-language question + optional options.
function phraseSlotQuestion(slotKey: string, slot: TemplateSlot): QuestionResult {
  const label = slot.label;
  const key = slotKey.toLowerCase();
  const labelLower = label.toLowerCase();

  // Color slots
  if (slot.type === "color") {
    return {
      question: `What's your ${labelLower}? Pick one or type your own hex:`,
      options: ["#FF5252 Red", "#4dabf7 Blue", "#51cf66 Green", "#ffd43b Yellow", "#ff6b6b Coral", "#a78bfa Purple", "Use default"],
    };
  }

  // Number slots
  if (slot.type === "number") {
    if (key.includes("year") || labelLower.includes("year") || key.includes("founded")) {
      return { question: `When was it ${labelLower.includes("founded") ? "founded" : "established"}? (year)` };
    }
    if (key.includes("size") || labelLower.includes("size") || key.includes("team") || labelLower.includes("team")) {
      return { question: `How large is the team?`, options: ["1-5", "6-20", "21-50", "51-200", "200+"] };
    }
    if (key.includes("price") || labelLower.includes("price") || key.includes("cost") || labelLower.includes("cost")) {
      return { question: `What's the ${label}?` };
    }
    if (key.includes("bed") || labelLower.includes("bedroom")) {
      return { question: `How many bedrooms?`, options: ["1", "2", "3", "4", "5+"] };
    }
    if (key.includes("bath") || labelLower.includes("bathroom")) {
      return { question: `How many bathrooms?`, options: ["1", "2", "3", "4+"] };
    }
    return { question: `What's the ${label}?` };
  }

  // Image URL slots — ask for a URL or let AI handle it
  if (slot.type === "image_url") {
    return {
      question: `Got an image for "${labelLower}"? Paste a URL, or say "AI pick" and we'll find one.`,
      options: ["AI pick for me"],
    };
  }

  // Text slots — use keyword heuristics for natural phrasing
  if (key.includes("name") || labelLower.includes("name")) {
    return { question: `What's the ${label}?` };
  }
  if (key.includes("headline") || labelLower.includes("headline")) {
    return { question: `What headline should we use? (${label})` };
  }
  if (key.includes("tagline") || labelLower.includes("tagline")) {
    return { question: `Got a tagline or ${labelLower}?` };
  }
  if (key.includes("description") || labelLower.includes("description")) {
    return { question: `What's your ${labelLower}?` };
  }
  if (key.includes("feature")) {
    return { question: `What ${labelLower} should we highlight? List them out.` };
  }
  if (key === "cta" || key.includes("call_to_action") || labelLower.includes("call to action")) {
    return {
      question: `What should viewers do after watching? (call to action)`,
      options: ["Visit website", "Sign up / Buy", "Learn more", "Contact us", "Book now"],
    };
  }
  if (key.includes("url") || labelLower.includes("url") || key.includes("website") || labelLower.includes("website")) {
    return { question: `What's the ${label}? (URL)` };
  }
  if (key.includes("metric") || labelLower.includes("metric") || key.includes("stat") || labelLower.includes("stat")) {
    return { question: `What ${labelLower} would you like to show off?` };
  }
  if (key.includes("address") || labelLower.includes("address") || key.includes("location") || labelLower.includes("location")) {
    return { question: `What's the ${labelLower}?` };
  }
  if (key.includes("price") || labelLower.includes("price") || key.includes("offer") || labelLower.includes("offer")) {
    return { question: `What's the ${labelLower}?` };
  }
  if (key.includes("quote") || labelLower.includes("quote") || key.includes("testimonial")) {
    return { question: `What's the ${labelLower} you'd like to feature?` };
  }
  if (key.includes("date") || labelLower.includes("date") || key.includes("time") || labelLower.includes("time") || key.includes("deadline") || labelLower.includes("deadline")) {
    return { question: `What's the ${labelLower}?` };
  }
  if (key.includes("title") || labelLower === "title") {
    return { question: `What's the ${labelLower}?` };
  }

  // Generic fallback — use the label directly
  return { question: `What's the ${label}?${slot.example ? ` (e.g. ${slot.example})` : ""}` };
}

// Build a question flow from a template's slot definitions.
// Required slots are asked first, then optional ones, then generic "polish"
// questions (tone + sound) that aren't part of the template slots.
function buildTemplateFlow(template: Template): {
  key: string;
  question: () => QuestionResult;
}[] {
  const slotEntries = Object.entries(template.slots);

  const requiredSlots = slotEntries.filter(([, s]) => s.required);
  const optionalSlots = slotEntries.filter(([, s]) => !s.required);

  const flow: { key: string; question: () => QuestionResult }[] = [
    ...requiredSlots.map(([key, slot]) => ({
      key,
      question: () => phraseSlotQuestion(key, slot),
    })),
    ...optionalSlots.map(([key, slot]) => ({
      key,
      question: () => phraseSlotQuestion(key, slot),
    })),
  ];

  // Append polish questions (tone + sound) that apply to all videos
  flow.push({
    key: "tone",
    question: () => ({
      question: "Great! Now — what vibe feels right? Pick a style:",
      styleChoices: [
        { name: "Bold & Energetic", colors: ["#FF5252", "#FFD740", "#FFEB3B"] },
        { name: "Clean & Professional", colors: ["#1a365d", "#3182ce", "#e2e8f0"] },
        { name: "Dark & Dramatic", colors: ["#0a0a0a", "#8b0000", "#d4af37"] },
        { name: "Warm & Friendly", colors: ["#fbbf24", "#f97316", "#fef3c7"] },
        { name: "Minimalist", colors: ["#111", "#666", "#f5f5f5"] },
        { name: "Playful & Fun", colors: ["#22c55e", "#3b82f6", "#fbbf24"] },
      ],
    }),
  });
  flow.push({
    key: "sound",
    question: () => ({
      question: "Last one! Do you want narration and/or background music?",
      options: ["Narration + Music", "Narration only", "Music only", "Silent (text only)"],
    }),
  });

  return flow;
}

export async function POST(req: NextRequest) {
  let body: InterviewState;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "Field 'messages' is required and must be an array" },
      { status: 400 }
    );
  }
  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Field 'content' is required and must be a string" },
      { status: 400 }
    );
  }

  // ─── Resolve template (from request body or brief) ───
  const templateId = body.template_id || body.brief?._template_id;
  const template = templateId ? getTemplateById(templateId) : undefined;

  if (template) {
    return handleTemplateInterview(body, template);
  }

  // ─── Generic (no-template) interview ───
  return handleGenericInterview(body);
}

// ─── Template-aware interview handler ───
function handleTemplateInterview(
  body: InterviewState,
  template: Template
): NextResponse {
  const flow = buildTemplateFlow(template);
  const brief = { ...(body.brief || {}) };

  // First message — kick off with a personalized greeting
  if (body.messages.length === 0) {
    const firstQ = flow[0].question();
    const greeting = `${template.emoji} Love it — let's build your "${template.name}" video! I just need a few details to fill it in. ${firstQ.question}`;
    return NextResponse.json({
      question: greeting,
      options: firstQ.options,
      styleChoices: firstQ.styleChoices,
      brief: {
        ...brief,
        _template_id: template.id,
        _template_name: template.name,
        _template_category: template.category,
        _template_duration: String(template.default_duration_sec),
        _analyzed: `Template: ${template.name}`,
        input: body.content,
      },
    });
  }

  // Subsequent messages — track progress by counting AI questions asked
  const aiMessageCount = body.messages.filter(m => m.role === "ai").length;

  // Record the last user answer under the slot key for the question they just answered
  const lastUserMessage = body.messages[body.messages.length - 1];
  if (lastUserMessage && lastUserMessage.role === "user") {
    const flowKey = flow[aiMessageCount - 1]?.key;
    if (flowKey && !brief[flowKey]) {
      brief[flowKey] = lastUserMessage.content;
    }
  }

  // Interview complete?
  if (aiMessageCount >= flow.length) {
    return NextResponse.json({
      complete: true,
      finalBrief: brief,
    });
  }

  // Ask next question
  const nextQ = flow[aiMessageCount].question();
  return NextResponse.json({
    question: nextQ.question,
    options: nextQ.options,
    styleChoices: nextQ.styleChoices,
    brief,
  });
}

// ─── Generic (no-template) interview handler — original logic ───
function handleGenericInterview(body: InterviewState): NextResponse {
  // If first message — analyze input and start questioning
  if (body.messages.length === 0) {
    const analyzed = analyzeInput(body.type, body.content);
    const firstQuestion = GENERIC_QUESTION_FLOW[0].question(body.content, {});

    return NextResponse.json({
      question: `${analyzed.greeting} ${firstQuestion.question}`,
      options: firstQuestion.options,
      styleChoices: firstQuestion.styleChoices,
      brief: { _analyzed: analyzed.summary, input: body.content },
    });
  }

  // Determine what question we're on
  const brief = body.brief || {};
  const answeredKeys = Object.keys(brief).filter((k) => !k.startsWith("_"));
  const currentQuestionIndex = answeredKeys.length;

  // Record the last user answer into brief
  const lastUserMessage = body.messages[body.messages.length - 1];
  if (lastUserMessage && lastUserMessage.role === "user") {
    const flowKey = GENERIC_QUESTION_FLOW[currentQuestionIndex - 1]?.key;
    if (flowKey) {
      brief[flowKey] = lastUserMessage.content;
    }
  }

  // Check if interview is complete
  if (currentQuestionIndex >= GENERIC_QUESTION_FLOW.length) {
    return NextResponse.json({
      complete: true,
      finalBrief: brief,
    });
  }

  // Ask next question
  const nextQuestion = GENERIC_QUESTION_FLOW[currentQuestionIndex].question(
    body.content,
    brief
  );

  return NextResponse.json({
    question: nextQuestion.question,
    options: nextQuestion.options,
    styleChoices: nextQuestion.styleChoices,
    brief,
  });
}

function analyzeInput(type: string, content: string): { greeting: string; summary: string } {
  const lower = content.toLowerCase();

  if (type === "url") {
    return {
      greeting: "I've analyzed the website. I can see what you're about.",
      summary: `Website content analyzed: ${content.substring(0, 200)}`,
    };
  }

  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("restaurant")) {
    return { greeting: "Love it — a food/drink business! 🍵", summary: "Food/beverage business" };
  }

  if (lower.includes("plumb") || lower.includes("electric") || lower.includes("build") || lower.includes("trade")) {
    return { greeting: "A trades business — let's make something that brings in jobs! 🔧", summary: "Trades/construction business" };
  }

  if (lower.includes("app") || lower.includes("software") || lower.includes("saas") || lower.includes("tech")) {
    return { greeting: "A tech product — let's make it look slick! 💻", summary: "Tech/software product" };
  }

  return { greeting: "Got it! Let me ask a few quick questions to make this perfect.", summary: content.substring(0, 200) };
}
