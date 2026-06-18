import { NextRequest, NextResponse } from "next/server";

// AI Interview Engine — asks guided questions based on input
// This is the "creative director" brain of hyperAspect

interface InterviewState {
  type: string;
  content: string;
  messages: { role: string; content: string }[];
  brief: Record<string, string>;
}

// Question flow — adaptive based on answers
type QuestionResult = { question: string; options?: string[]; styleChoices?: { name: string; colors: string[] }[] };
const QUESTION_FLOW: { key: string; question: (input: string, brief: Record<string, string>) => QuestionResult }[] = [
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

export async function POST(req: NextRequest) {
  let body: InterviewState;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
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

  // If first message — analyze input and start questioning
  if (body.messages.length === 0) {
    const analyzed = analyzeInput(body.type, body.content);
    const firstQuestion = QUESTION_FLOW[0].question(body.content, {});

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
    const flowKey = QUESTION_FLOW[currentQuestionIndex - 1]?.key;
    if (flowKey) {
      brief[flowKey] = lastUserMessage.content;
    }
  }

  // Check if interview is complete
  if (currentQuestionIndex >= QUESTION_FLOW.length) {
    return NextResponse.json({
      complete: true,
      finalBrief: brief,
    });
  }

  // Ask next question
  const nextQuestion = QUESTION_FLOW[currentQuestionIndex].question(body.content, brief);

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
