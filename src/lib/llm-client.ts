/**
 * LLM client for the gated-diff's missing caller (architecture D4): an LLM
 * PROPOSES slot-value edits from a free-form producer prompt. Proposals are
 * constrained to the template's declared slot schema — the LLM cannot invent
 * fields (enforced again server-side in the propose route via validateSlotValues);
 * they are diff-reviewed by the producer and never auto-apply.
 *
 * The Worker has no tailnet access, so it reaches GLM through the render relay's
 * existing chat-completions proxy (server.mjs `/api/coding/paas/v4/chat/completions`,
 * model allowlist glm-4.6/5.1/4.5-air), which forwards to the local z.ai gateway
 * with the real key. Auth: shared bearer RENDER_SECRET (same as the render/gate
 * routes). No relay/staging change needed.
 */
import type { Scene, Slot } from "./template-store/types";
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

/** Raw LLM output before schema validation + diff enrichment. */
export interface Proposal {
  changes: ProposedChange[];
  summary: string;
}

function bearer(): string {
  const secret = process.env.RENDER_SECRET;
  if (!secret) throw new RelayError(500, "RENDER_SECRET not configured");
  return `Bearer ${secret}`;
}

/** Compact, LLM-readable slot schema (no defaults leaked as "current" confusion). */
function describeSlot(s: Slot, current?: string | number): string {
  const parts = [`id=${s.id}`, `type=${s.type}`, `label="${s.label}"`];
  if (s.options) parts.push(`options=${JSON.stringify(s.options)}`);
  if (current !== undefined && current !== "") parts.push(`current=${JSON.stringify(current)}`);
  return parts.join(" ");
}

/** Compact scene summary so the producer's scene references resolve (D3). */
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

const SYSTEM_PROMPT = `You are a video-composition editing assistant for the CoreAspect studio.
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

/**
 * Ask GLM to propose slot-value edits for a template given a producer prompt.
 * Returns the raw proposal (caller validates against the schema). Throws
 * RelayError on relay/gateway failure or unparseable output.
 */
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

  let resp: Response;
  try {
    resp = await fetch(`${RENDER_BASE}${CHAT_PATH}`, {
      method: "POST",
      headers: { authorization: bearer(), "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
  } catch (e) {
    throw new RelayError(502, `LLM relay unreachable: ${(e as Error).message}`);
  }

  if (resp.status === 401) {
    throw new RelayError(502, "LLM relay rejected RENDER_SECRET (401)");
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new RelayError(502, `LLM relay ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const data = (await resp.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new RelayError(502, "LLM returned no content");
  }

  return parseProposal(content);
}

/**
 * Parse GLM's (possibly fence-wrapped) JSON into a Proposal. GLM often returns
 * ```json\n{...}\n``` instead of raw JSON (server.mjs notes the same). Tolerant
 * extraction: strip fences, then pull the first {...} block if needed.
 */
export function parseProposal(content: string): Proposal {
  let text = content.trim();
  // Strip ```json / ``` fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fall back: first balanced {...} substring.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        /* handled below */
      }
    }
  }

  const obj = parsed as { changes?: unknown; summary?: unknown } | null;
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
