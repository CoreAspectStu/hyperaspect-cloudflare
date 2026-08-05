/**
 * CoreAspect Video Studio — template + scene + slot model.
 * Architecture decision D3: the LLM-edit surface is *scenes* (addressable, typed
 * objects); the composition HTML is the render target. Scenes are DERIVED from the
 * composition by convention (data-scene-id / data-track-type attributes) or DECLARED
 * in a sidecar template.json until the HTML-derivation parser exists.
 *
 * This file is the contract every part of the platform (store, routes, editor,
 * generation, verification gate) builds on. Keep it dependency-free and stable.
 */

export type TrackType =
  | "video"
  | "image"
  | "speech"
  | "audio"
  | "text"
  | "transition";

export type SlotType = "text" | "color" | "number" | "media" | "select";

/** A single addressable media element within a scene — what an edit targets. */
export interface Track {
  id: string;
  type: TrackType;
  /** Asset path or value reference, e.g. "assets/drone.mp4" or a slot id. */
  ref?: string;
  /** Seconds, relative to scene start. */
  start?: number;
  duration?: number;
  meta?: Record<string, unknown>;
}

/** A timeline scene — the unit the LLM edits ("scene 3's drone clip"). */
export interface Scene {
  id: string;
  index: number;
  /** Seconds, on the composition timeline. */
  start: number;
  /** Seconds. */
  duration: number;
  tracks: Track[];
}

/** A deterministic, fillable value (the generalised DEAL block). */
export interface Slot {
  id: string;
  type: SlotType;
  label: string;
  default?: string | number;
  /** For type "select". */
  options?: string[];
}

/** A video family — "deal-video", "agent-presented", "job-ad", … */
export type TemplateFamily = string;

/**
 * A reusable template. A *video* = template + filled slots + per-scene overrides.
 * `compositionPath` points at the HyperFrames index.html within the template dir.
 */
export interface Template {
  id: string;
  family: TemplateFamily;
  name: string;
  description?: string;
  aspect?: { width: number; height: number };
  /** Total duration in seconds. */
  durationSec?: number;
  slots: Slot[];
  /** Derived (HTML) or declared (sidecar). HTML-derivation is the production goal. */
  scenes: Scene[];
  brandProfileRef?: string;
  /** Per-family media-generation config (which APIs, which recipe). */
  generationConfig?: Record<string, unknown>;
  /** Path to index.html within the template dir (default "index.html"). */
  compositionPath?: string;
}

/** Lightweight row for the template library list view. */
export interface TemplateSummary {
  id: string;
  family: TemplateFamily;
  name: string;
}
