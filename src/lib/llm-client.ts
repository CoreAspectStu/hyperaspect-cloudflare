/**
 * LLM client for the gated-diff's caller surface (architecture D4).
 *  - Slot tier (brick 14): an LLM PROPOSES slot-value edits, constrained to the
 *    template's declared slot schema (can't invent fields — enforced again
 *    server-side in the propose route via validateSlotValues).
 *  - Structural tier (brick 15): an LLM PROPOSES scene-structural edits
 *    (resize/retime/swap-asset/structural-text), constrained to the derived
 *    scene/track model; the projection (project.ts) turns them into HTML patches.
 * Both are diff-reviewed by the producer and never auto-apply.
 *
 * The Worker has no tailnet access, so it reaches GLM through the render relay's
 * existing chat-completions proxy (server.mjs `/api/coding/paas/v4/chat/completions`,
 * model allowlist glm-4.6/5.1/4.5-air), which forwards to the local z.ai gateway
 * with the real key. Auth: shared bearer RENDER_SECRET (same as the render/gate
 * routes). No new relay endpoint for the LLM call itself.
 */
import type { Scene, Slot } from "./template-store/types";
import type { StructuralEdit } from "./template-store/project";
import { RelayError } from "./render-bridge";

const RENDER_BASE = "https://render.coreaspectai.com";
const CHAT_PATH = "/api/coding/paas/v4/chat/completions";
const MODEL = "glm-4.6";

/** A single LLM-proposed slot change (raw — not yet schema-validated). */
export interface ProposedChange {
  slotId: string;
  value: string | number;
  reason: string;
}

/** Raw slot-proposal output before schema validation + diff enrichment. */
export interface Proposal {
  changes: ProposedChange[];
  summary: string;
}

function bearer(): string {
  const secret = process.env.RENDER_SECRET;
  if (!secret) throw new RelayError(500, "RENDER_SECRET not configured");
  return `Bearer ${secret}`;
}

/**
 * Call GLM via the relay chat proxy. Returns the message content string. Throws
 * RelayError on relay/gateway failure or empty content. `jsonMode` sets
 * response_format json_object (GLM supports it — server.mjs:1530).
 */
async function chat(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}${CHAT_PATH}`, {
      method: "POST",
      headers: { authorization: bearer(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new RelayError(502, `LLM relay unreachable: ${(e as Error).message}`);
  }
  if (resp.status === 401) throw new RelayError(502, "LLM relay rejected RENDER_SECRET (401)");
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new RelayError(502, `LLM relay ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await resp.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new RelayError(502, "LLM returned no content");
  return content;
}

/**
 * Parse GLM's (possibly fence-wrapped / prose-wrapped) JSON. GLM often returns
 * ```json\n{...}\n``` or leading prose despite json_mode. Tolerant: strip fences,
 * then fall back to the first balanced {...} substring. Returns null if unparseable.
 */
export function parseJsonObject(content: string): unknown | null {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* ══ Slot tier (brick 14) ══ */

function describeSlot(s: Slot, current?: string | number): string {
  const parts = [`id=${s.id}`, `type=${s.type}`, `label="${s.label}"`];
  if (s.options) parts.push(`options=${JSON.stringify(s.options)}`);
  if (current !== undefined && current !== "") parts.push(`current=${JSON.stringify(current)}`);
  return parts.join(" ");
}

function describeScenes(scenes: Scene[]): string {
  return scenes
    .map((sc) => {
      const tracks = sc.tracks
        .map((t) => `${t.type}${t.ref ? `:${t.ref}` : ""}`)
        .join(",");
      return `scene ${sc.index} (${sc.id}) ${sc.start.toFixed(1)}–${(sc.start + sc.duration).toFixed(1)}s [${tracks}]`;
    })
    .join("\n");
}

const SLOT_SYSTEM_PROMPT = `You are a video-composition editing assistant for the CoreAspect studio.
You propose edits to a HyperFrames video template's SLOT VALUES only.

HARD CONSTRAINTS (architecture D4):
- You may ONLY change the value of a DECLARED slot. You CANNOT invent slot ids.
- You CANNOT change scene structure, ordering, durations, assets, or any HTML.
- Match each slot's type: number = numeric (no units), color = #rrggbb hex, select = one of its options, text = plain string.
- Only propose a change when the request actually calls for it. Skip unchanged slots.

Respond with STRICT JSON only — no prose, no markdown fences:
{"changes":[{"slotId":"<id>","value":<typed>,"reason":"<one short line>"}],"summary":"<one sentence>"}
If the request cannot be satisfied with slot edits alone, return {"changes":[],"summary":"<why>"}.

The producer's request is non-deterministic: it will be diff-reviewed and run through a
verification gate (lint → render → vision-QA → human approve) before it can apply, so
prioritize faithful, on-brand, shippable edits.`;

/** Ask GLM to propose slot-value edits. Returns the raw proposal (caller validates). */
export async function proposeSlotEdits(args: {
  prompt: string;
  slots: Slot[];
  slotValues?: Record<string, string | number>;
  scenes?: Scene[];
}): Promise<Proposal> {
  const { prompt, slots, slotValues, scenes } = args;
  const slotsBlock = slots.map((s) => `- ${describeSlot(s, slotValues?.[s.id] ?? s.default)}`).join("\n");
  const scenesBlock = scenes?.length ? describeScenes(scenes) : "(scenes unavailable)";
  const user = `TEMPLATE SLOTS (the only things you may edit):
${slotsBlock}

SCENES (for reference; do not edit):
${scenesBlock}

PRODUCER REQUEST:
${prompt.trim()}

Propose the slot-value changes as strict JSON.`;
  const content = await chat(SLOT_SYSTEM_PROMPT, user, { temperature: 0.3, jsonMode: true });
  return parseProposal(content);
}

/** Parse a slot proposal from GLM content (tolerant of fences/prose). */
export function parseProposal(content: string): Proposal {
  const obj = parseJsonObject(content) as { changes?: unknown; summary?: unknown } | null;
  const rawChanges = Array.isArray(obj?.changes) ? (obj!.changes as unknown[]) : [];
  const summary = typeof obj?.summary === "string" ? (obj!.summary as string) : "";
  const clean: ProposedChange[] = rawChanges
    .map((c) => {
      const cc = c as Record<string, unknown>;
      const slotId = typeof cc.slotId === "string" ? cc.slotId : "";
      if (!slotId) return null;
      return {
        slotId,
        value: (cc.value ?? "") as string | number,
        reason: typeof cc.reason === "string" ? cc.reason : "",
      };
    })
    .filter((c): c is ProposedChange => c !== null);
  return { changes: clean, summary };
}

/* ══ Structural tier (brick 15) ══ */

function describeScenesStruct(scenes: Scene[]): string {
  return scenes
    .map((sc) => {
      const tracks = sc.tracks
        .map((t) => {
          const bits = [`${t.type}:${t.id}`];
          if (t.ref) bits.push(`ref=${t.ref}`);
          if (typeof t.start === "number") bits.push(`start=${t.start}`);
          if (typeof t.duration === "number") bits.push(`dur=${t.duration}`);
          if (t.type === "text" && typeof t.meta?.text === "string")
            bits.push(`text=${JSON.stringify(t.meta.text)}`);
          return bits.join(",");
        })
        .join(" | ");
      return `scene ${sc.index + 1} id=${sc.id} start=${sc.start} dur=${sc.duration}  tracks: ${tracks || "(none)"}`;
    })
    .join("\n");
}

const STRUCTURAL_SYSTEM_PROMPT = `You are a video-composition STRUCTURAL editor for the CoreAspect studio.
You propose edits to a HyperFrames composition's SCENES + TRACKS (NOT slot values).

HARD CONSTRAINTS (architecture D3/D4):
- Target ONLY the EXISTING scene/track ids listed below. You CANNOT invent ids.
- You CANNOT reorder, add, or remove scenes/tracks. Only in-place patches.
- Allowed ops:
  {"op":"sceneDuration","sceneId":"<id>","duration":<seconds>}        resize a scene
  {"op":"trackRef","trackId":"<media id>","ref":"<asset path>"}        swap a media asset
  {"op":"trackTiming","trackId":"<id>","start":<s>,"duration":<s>}     retime a track (omit a field to leave it)
  {"op":"text","trackId":"<text id>","text":"<new copy>"}              rewrite structural text (plain literal text only)
- Numbers are seconds. Asset refs are relative paths (e.g. assets/foo.mp4).

Respond with STRICT JSON only:
{"edits":[...],"summary":"<one sentence>"}
Only propose an edit when the request actually calls for it. If the request needs slot values
or new/removed scenes (which you can't do), return {"edits":[],"summary":"<why>"}.

The edit will be diff-reviewed and run through the verification gate before it applies.`;

/** Coerce one raw LLM object into a StructuralEdit, or null if malformed. */
function coerceEdit(e: unknown): StructuralEdit | null {
  const o = e as Record<string, unknown>;
  const op = typeof o.op === "string" ? o.op : "";
  const str = (k: string): string | undefined => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  const num = (k: string): number | undefined => {
    const v = o[k];
    return typeof v === "number" ? v : typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  switch (op) {
    case "sceneDuration": {
      const sceneId = str("sceneId");
      const duration = num("duration");
      return sceneId && duration != null ? { op, sceneId, duration } : null;
    }
    case "trackRef": {
      const trackId = str("trackId");
      const ref = str("ref");
      return trackId && ref ? { op, trackId, ref } : null;
    }
    case "trackTiming": {
      const trackId = str("trackId");
      const start = num("start");
      const duration = num("duration");
      return trackId && (start != null || duration != null) ? { op, trackId, start, duration } : null;
    }
    case "text": {
      const trackId = str("trackId");
      const text = str("text");
      return trackId && text != null ? { op, trackId, text } : null;
    }
    default:
      return null;
  }
}

/** Ask GLM to propose scene-structural edits. Returns raw edits (caller's projection validates targets). */
export async function proposeStructuralEdits(args: {
  prompt: string;
  scenes: Scene[];
}): Promise<{ edits: StructuralEdit[]; summary: string }> {
  const user = `COMPOSITION SCENES (the only addressable targets):
${describeScenesStruct(args.scenes)}

PRODUCER REQUEST:
${args.prompt.trim()}

Propose structural edits as strict JSON.`;
  const content = await chat(STRUCTURAL_SYSTEM_PROMPT, user, { temperature: 0.2, jsonMode: true });
  const obj = parseJsonObject(content) as { edits?: unknown; summary?: unknown } | null;
  const rawEdits = Array.isArray(obj?.edits) ? (obj!.edits as unknown[]) : [];
  const summary = typeof obj?.summary === "string" ? (obj!.summary as string) : "";
  const edits = rawEdits.map(coerceEdit).filter((e): e is StructuralEdit => e !== null);
  return { edits, summary };
}
