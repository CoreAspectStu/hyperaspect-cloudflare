/**
 * Scene derivation from a composition's index.html (architecture D3).
 *
 * The composition HTML is the single source of truth; scenes + tracks are DERIVED
 * from it by convention (no parallel sidecar manifest to drift). This parser reads
 * HyperFrames' own attributes — `class="scene clip"` wrappers with `data-start`/
 * `data-duration`, media tags with `src`, and id'd text elements — and projects them
 * into the canonical {@link Scene}/{@link Track} model the editor + gate consume.
 *
 * Runtime-agnostic: no node:fs, no DOM. Depends on `node-html-parser` (pure JS,
 * works under Workers `nodejs_compat` and Node dev).
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { Scene, Track, TrackType } from "./types";

/** Text-track elements follow an `s<scene>-<name>` id convention. */
const SCENE_ID_RE = /^s\d+-/;
const MEDIA_TAGS = new Set(["video", "audio", "img", "source"]);

export interface CompositionMeta {
  width?: number;
  height?: number;
  duration?: number;
  compositionId?: string;
}

function num(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const winKey = (start: number, duration: number) => `${start}|${duration}`;

/** Read composition-level metadata from the `#root` element. */
export function deriveMeta(html: string): CompositionMeta | null {
  const root = parse(html).querySelector("#root");
  if (!root) return null;
  const a = root.attributes;
  return {
    width: num(a["data-width"]),
    height: num(a["data-height"]),
    duration: num(a["data-duration"]),
    compositionId: a["data-composition-id"],
  };
}

/**
 * Derive the scene/track model from a composition's HTML.
 *
 * Rules:
 *  - Scenes = `.scene.clip` wrappers (id, data-start, data-duration), ordered by start.
 *  - Inner media (`<video>/<audio>/<img>` descendants of a scene) → tracks of that scene.
 *  - Inner text (descendants with `id` `s\\d+-`, non-media, non-empty text) → text tracks.
 *  - Root-level media/clips that are NOT scene wrappers (standalone `<video>` clips, bgm
 *    `<audio>`) → assigned to the scene whose `(start,duration)` window matches; no match
 *    (e.g. composition-global bgm) → attached to the first scene with `meta.composition`.
 */
export function deriveScenes(html: string): Scene[] {
  const root = parse(html).querySelector("#root");
  if (!root) return [];

  const sceneEls = root.querySelectorAll(".scene.clip");
  const pairs = sceneEls
    .map((el) => ({
      el,
      id: el.id || "",
      start: num(el.attributes["data-start"]) ?? 0,
      duration: num(el.attributes["data-duration"]) ?? 0,
    }))
    .sort((a, b) => a.start - b.start);

  const scenes: Scene[] = pairs.map((p, i) => ({
    id: p.id || `scene-${i + 1}`,
    index: i,
    start: p.start,
    duration: p.duration,
    tracks: [],
  }));
  const sceneElSet = new Set<HTMLElement>(sceneEls);
  const byWindow = new Map<string, Scene>();
  pairs.forEach((p, i) => byWindow.set(winKey(p.start, p.duration), scenes[i]!));

  const fallbackId = (sceneId: string, type: TrackType, n: number) =>
    `${sceneId}-${type}-${n}`;

  // 1) Inner tracks per scene wrapper (descendants).
  pairs.forEach((p, i) => {
    const scene = scenes[i]!;
    let auto = 0;
    // media
    for (const m of p.el.querySelectorAll("video, audio, img")) {
      const t = mediaTrack(m, root, (type) => fallbackId(scene.id, type, ++auto));
      if (t) scene.tracks.push(t);
    }
    // text: id'd (`s<n>-…`), non-media, non-empty text — keep the OUTERMOST candidate
    // (skip one that has another candidate as an ancestor) so nested id'd spans such as
    // a count-up `<span id="s3-n1">` inside a row `<div id="s3-r1">` aren't double-counted.
    const textCands = p.el.querySelectorAll("[id]").filter((el) => {
      if (!el.id || !SCENE_ID_RE.test(el.id)) return false;
      if (MEDIA_TAGS.has(el.tagName.toLowerCase())) return false;
      return (el.text ?? "").trim().length > 0;
    });
    const candSet = new Set<HTMLElement>(textCands);
    for (const el of textCands) {
      let cur: HTMLElement | null = el.parentNode as HTMLElement | null;
      let nested = false;
      while (cur && cur !== p.el) {
        if (candSet.has(cur)) {
          nested = true;
          break;
        }
        cur = cur.parentNode as HTMLElement | null;
      }
      if (nested) continue;
      scene.tracks.push({
        id: el.id,
        type: "text",
        ref: el.id,
        meta: { text: (el.text ?? "").trim() },
      });
    }
  });

  // 2) Root-level media/clips (standalone video clips + composition-global audio).
  //    Use a parent===root filter so we never re-handle inner media (handled above).
  const seen = new Set<HTMLElement>();
  const rootLevel: HTMLElement[] = [];
  for (const sel of [".clip", "video", "audio", "img"]) {
    for (const el of root.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (sceneElSet.has(el)) continue; // a scene wrapper, not a track
      if ((el.parentNode as HTMLElement | null) !== root) continue; // not root-level
      rootLevel.push(el);
    }
  }
  for (const el of rootLevel) {
    const start = num(el.attributes["data-start"]) ?? 0;
    const duration = num(el.attributes["data-duration"]) ?? 0;
    const t = mediaTrack(el, root, (type) =>
      fallbackId(byWindow.get(winKey(start, duration))?.id ?? "comp", type, 0),
    );
    if (!t) continue;
    const scene = byWindow.get(winKey(start, duration));
    if (scene) scene.tracks.push(t);
    else
      scenes[0]?.tracks.push({
        ...t,
        meta: { ...(t.meta ?? {}), composition: true },
      });
  }

  return scenes;
}

/** Build a Track from a media element (tag→type, src→ref), pulling timing + slot attrs. */
function mediaTrack(
  el: HTMLElement,
  root: HTMLElement,
  makeId: (type: TrackType) => string,
): Track | null {
  const tag = el.tagName.toLowerCase();
  let type: TrackType;
  if (tag === "video") type = "video";
  else if (tag === "audio") type = "audio";
  else if (tag === "img") type = "image";
  else return null;

  const ref = el.attributes.src;
  const id = el.id || nearestIdAncestor(el, root) || makeId(type);
  const start = num(el.attributes["data-start"]);
  const duration = num(el.attributes["data-duration"]);

  const meta: Record<string, unknown> = {};
  const ti = el.attributes["data-track-index"];
  if (ti != null) meta.trackIndex = num(ti);
  const vol = el.attributes["data-volume"];
  if (vol != null) meta.volume = num(vol);

  const track: Track = { id, type };
  if (ref) track.ref = ref;
  if (start != null) track.start = start;
  if (duration != null) track.duration = duration;
  if (Object.keys(meta).length) track.meta = meta;
  return track;
}

/** First ancestor (up to root) whose id matches the `s<scene>-` text-track convention. */
function nearestIdAncestor(el: HTMLElement, root: HTMLElement): string | null {
  let cur: HTMLElement | null = el.parentNode as HTMLElement | null;
  while (cur && cur !== root) {
    if (cur.id && SCENE_ID_RE.test(cur.id)) return cur.id;
    cur = cur.parentNode as HTMLElement | null;
  }
  return null;
}
