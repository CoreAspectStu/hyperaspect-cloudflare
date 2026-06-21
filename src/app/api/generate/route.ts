import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logError } from "@/app/api/_error";
import { getTemplateById } from "@/lib/templates";

const RENDER_BASE = "https://render.coreaspectai.com";

// Map HyperAspect gallery template IDs to render backend template names.
// V2: Each ID maps to a specific template manifest with unique style + audio.
const TEMPLATE_MAP: Record<string, string> = {
  // ── Business (8) ── each has its own manifest
  "biz-company-overview": "biz-company-overview",
  "biz-product-demo": "biz-product-demo",
  "biz-kpi-dashboard": "biz-kpi-dashboard",
  "biz-investor-pitch": "biz-investor-pitch",
  "biz-milestones": "biz-milestones",
  "biz-meet-team": "biz-meet-team",
  "biz-case-study": "biz-case-study",
  "biz-annual-report": "biz-annual-report",
  // ── Marketing (8) ── each has its own manifest
  "mkt-product-launch": "mkt-product-launch",
  "mkt-flash-sale": "mkt-flash-sale",
  "mkt-brand-story": "mkt-brand-story",
  "mkt-seasonal": "mkt-seasonal",
  "mkt-how-it-works": "mkt-how-it-works",
  "mkt-before-after": "mkt-before-after",
  "mkt-social-proof": "mkt-social-proof",
  "mkt-retargeting": "mkt-retargeting",
  // ── Real Estate (6) ── each has its own manifest
  "re-property-tour": "realestate-property-tour",
  "re-neighborhood": "re-neighborhood",
  "re-open-house": "re-open-house",
  "re-price-reduction": "re-price-reduction",
  "re-just-sold": "re-just-sold",
  "re-agent-brand": "re-agent-brand",
  // ── Education (5) ── each has its own manifest
  "edu-course-preview": "edu-course-promo",
  "edu-micro-lesson": "edu-micro-lesson",
  "edu-tutorial": "edu-tutorial",
  "edu-flashcard": "edu-flashcard",
  "edu-study-tips": "edu-study-tips",
  // ── Social Media (7) ── each has its own manifest
  "soc-ig-reel": "social-instagram-reel",
  "soc-tiktok": "soc-tiktok",
  "soc-linkedin": "soc-linkedin",
  "soc-yt-intro": "soc-yt-intro",
  "soc-quote": "soc-quote",
  "soc-countdown": "soc-countdown",
  "soc-story": "soc-story",
  // ── Events (5) ── each has its own manifest
  "evt-invitation": "evt-invitation",
  "evt-recap": "evt-recap",
  "evt-webinar-promo": "evt-webinar-promo",
  "evt-thank-you": "evt-thank-you",
  "evt-speaker-reveal": "evt-speaker-reveal",
  // ── Personal (5) ── each has its own manifest
  "per-birthday": "per-birthday",
  "per-wedding": "per-wedding",
  "per-travel": "per-portfolio",
  "per-resume": "per-resume",
  "per-milestone": "per-milestone",
  // ── Industry / SaaS (6) ── each has its own manifest
  "ind-restaurant": "ind-restaurant",
  "ind-fitness": "ind-fitness",
  "ind-medical": "ind-medical",
  "ind-nonprofit": "ind-nonprofit",
  "ind-saas-changelog": "saas-changelog",
  "ind-advocacy": "ind-advocacy",
};

export async function POST(req: NextRequest) {
  // ─── Rate limiting: 5 generate requests per IP per 10 minutes ───
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Too many generation requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brief = body?.brief || {};
  const hasTemplate = !!brief._template_id;
  const hasStoryboardManifest = !!body?.storyboardManifest;
  const templateId = brief._template_id || "";
  const renderTemplate = hasTemplate ? (TEMPLATE_MAP[templateId] || templateId) : "";
  const userDescription = body?.inputValue || brief.input || "";
  const aspectRatio = brief.aspectRatio || body?.aspectRatio || "16:9";
  const inputType = body?.inputType || "text";

  // Admin render config overrides (only sent when admin mode is active)
  const renderConfig = body?.renderConfig; // { engine, framerate, durationCap, workers, quality }
  const durationOverride = renderConfig?.durationCap ? Math.min(renderConfig.durationCap, 30) : undefined;
  const framerateOverride = renderConfig?.framerate || undefined;
  const qualityOverride = renderConfig?.quality || undefined;

  const secret = process.env.RENDER_SECRET;
  if (!secret) {
    return NextResponse.json({
      id: "job_" + Date.now().toString(36),
      status: "error",
      error: "RENDER_SECRET not configured — contact admin",
      title: userDescription.substring(0, 50) || "Your Video",
    }, { status: 500 });
  }

  // Build interview answers from brief (excluding private keys)
  const interviewAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(brief)) {
    if (!key.startsWith("_") && typeof value === "string") {
      interviewAnswers[key] = value;
    }
  }

  // Extract brand overrides from brief (set by BrandPanel in the UI)
  const brand: Record<string, any> = {};
  if (brief._brand_logo) brand.logo_url = brief._brand_logo;
  if (brief._brand_primary) brand.colors = { ...brand.colors, primary: brief._brand_primary };
  if (brief._brand_accent) brand.colors = { ...brand.colors, accent: brief._brand_accent };
  if (brief._brand_bg) brand.colors = { ...brand.colors, bg: brief._brand_bg };
  if (brief._brand_font_heading || brief._brand_font_body) {
    brand.fonts = {};
    if (brief._brand_font_heading) brand.fonts.heading = brief._brand_font_heading;
    if (brief._brand_font_body) brand.fonts.body = brief._brand_font_body;
  }

  // Extract animation configs from the template definition so the render
  // backend can generate GSAP timelines instead of static CSS transitions.
  const templateDef = hasTemplate ? getTemplateById(templateId) : null;
  const sceneAnimations = templateDef?.scenes?.map(s => ({
    id: s.id,
    type: s.type,
    duration_sec: s.duration_sec,
    animation: s.animation || null,
    transition_in: s.transition_in || null,
  })).filter(s => s.animation || s.transition_in) || [];

  try {
    // ─── Build the request body for the render backend ────────────────────
    //
    // Three paths:
    //   0. STORYBOARD: Pre-generated manifest from story mode → skip LLM, send directly
    //   1. TEMPLATE: User picked a template → fill template variables from
    //      their description via GLM, send { template, variables }
    //   2. FREE-FORM: Tile workflow (Describe It, URL, Doc, Voice, Video) →
    //      generate a complete custom manifest via GLM, send { customManifest }
    //
    let videoCreateBody: Record<string, any>;

    if (hasStoryboardManifest) {
      // STORYBOARD PATH: Manifest already generated by /storyboard endpoint
      videoCreateBody = {
        customManifest: body.storyboardManifest,
        variables: {},
        brand: Object.keys(brand).length > 0 ? brand : undefined,
      };
    } else if (hasTemplate) {
      // TEMPLATE PATH: Generate content for template variables
      let variables: Record<string, string> = {};
      if (userDescription.trim().length > 5) {
        try {
          const contentResp = await fetch(`${RENDER_BASE}/generate-content`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
            body: JSON.stringify({ description: userDescription, templateId: renderTemplate, interviewAnswers }),
          });
          if (contentResp.ok) {
            const contentData = await contentResp.json();
            if (contentData.variables) variables = contentData.variables;
          }
        } catch (err) {
          console.error("[generate] Template content generation error:", err);
        }
      }
      videoCreateBody = {
        template: renderTemplate,
        variables,
        brand: Object.keys(brand).length > 0 ? brand : undefined,
        scene_animations: sceneAnimations.length > 0 ? sceneAnimations : undefined,
      };

      // P0-2 fix: If GLM failed to generate variables, return error instead of
      // rendering with empty/placeholder content (silently broken video)
      if (userDescription.trim().length > 5 && Object.keys(variables).length === 0) {
        return NextResponse.json({
          id: "job_" + Date.now().toString(36),
          status: "error",
          error: "Failed to generate content from your description. Please try again.",
          title: userDescription.substring(0, 50) || "Your Video",
        }, { status: 500 });
      }
    } else {
      // FREE-FORM PATH: Generate a custom manifest from the description
      let customManifest: any = null;
      if (userDescription.trim().length > 5) {
        try {
          const manifestResp = await fetch(`${RENDER_BASE}/generate-manifest`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
            body: JSON.stringify({
              description: userDescription,
              interviewAnswers,
              aspectRatio,
              contentSource: inputType,
              duration: durationOverride,
            }),
          });
          if (manifestResp.ok) {
            const manifestData = await manifestResp.json();
            customManifest = manifestData.manifest;
          } else {
            console.error("[generate] Manifest generation failed:", manifestResp.status);
          }
        } catch (err) {
          console.error("[generate] Manifest generation error:", err);
        }
      }

      if (!customManifest) {
        return NextResponse.json({
          id: "job_" + Date.now().toString(36),
          status: "error",
          error: "Failed to generate video manifest. Please try again.",
          title: userDescription.substring(0, 50) || "Your Video",
        }, { status: 500 });
      }

      videoCreateBody = {
        customManifest,
        variables: {},
        brand: Object.keys(brand).length > 0 ? brand : undefined,
      };
    }

    // Add render config overrides (from admin panel)
    const renderOverrides: Record<string, any> = {};
    if (framerateOverride) renderOverrides.framerate = framerateOverride;
    if (durationOverride) renderOverrides.duration = durationOverride;
    if (qualityOverride) renderOverrides.quality = qualityOverride;

    const resp = await fetch(`${RENDER_BASE}/video-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        ...videoCreateBody,
        ...renderOverrides,
        priority: 5,
        webhookUrl: body?.email ? `https://video.coreaspectai.com/api/webhook` : undefined,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({
        id: "job_" + Date.now().toString(36),
        status: "error",
        error: `Render service error (${resp.status}): ${errText.substring(0, 200)}`,
        title: userDescription.substring(0, 50) || "Your Video",
      }, { status: 502 });
    }

    const data = await resp.json();

    return NextResponse.json({
      id: data.jobId,
      status: "queued",
      progress: 0,
      estimatedSeconds: 120,
      renderName: data.videoName,
      template: hasStoryboardManifest ? "storyboard" : (hasTemplate ? renderTemplate : "custom"),
      title: userDescription.substring(0, 50) || (hasStoryboardManifest ? "Story Video" : "Your Video"),
      realRender: true,
    });
  } catch (err: any) {
    logError("generate", err, req);
    return NextResponse.json({
      id: "job_" + Date.now().toString(36),
      status: "error",
      error: `Cannot reach render service: ${err.message}`,
      title: body?.inputValue?.substring(0, 50) || "Your Video",
    }, { status: 502 });
  }
}
