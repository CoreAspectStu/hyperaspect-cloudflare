import { describe, it, expect } from "vitest";
import { slotifyComposition } from "./slotify";

/**
 * Slot-ifier tests — declaring per-scene text slots for generated compositions.
 * The fixture mirrors the relay `composeManifest` output (classed text inside
 * `#scene-N .cw`, a root-level bgm `<audio>`, an empty `.cta`).
 */
const FIXTURE = `<div id="root" data-composition-id="composed" data-width="1920" data-height="1080" data-start="0" data-duration="20">
  <div id="scene-1" class="scene clip" data-start="0" data-duration="4"><div class="cw"><div class="hd">88 Market Street</div><div class="sub">Richmond VIC</div></div></div>
  <div id="scene-2" class="scene clip" data-start="4" data-duration="6"><div class="cw"><div class="hd">Expansive &amp; Bright</div></div></div>
  <div id="scene-3" class="scene clip" data-start="10" data-duration="5"><div class="cw"><div class="stat-v">1200</div><div class="stat-l">SQM</div></div></div>
  <div id="scene-4" class="scene clip" data-start="15" data-duration="5"><div class="cw"><div class="cta"></div><div class="company">CoreAspect</div></div></div>
  <audio id="bgm" src="assets/bgm/a.mp3" data-start="0" data-duration="20"></audio>
</div>`;

describe("slotifyComposition", () => {
  it("declares a slot per editable text class with id, default + label", () => {
    const { slots } = slotifyComposition(FIXTURE);
    const byId = Object.fromEntries(slots.map((s) => [s.id, s]));

    expect(byId.scene_1_hd).toMatchObject({ type: "text", default: "88 Market Street", label: "Scene 1 · Headline" });
    expect(byId.scene_1_sub).toMatchObject({ default: "Richmond VIC", label: "Scene 1 · Subtext" });
    expect(byId.scene_2_hd).toMatchObject({ default: "Expansive & Bright", label: "Scene 2 · Headline" });
    expect(byId.scene_3_stat_v).toMatchObject({ default: "1200", label: "Scene 3 · Stat value" });
    expect(byId.scene_3_stat_l).toMatchObject({ default: "SQM", label: "Scene 3 · Stat label" });
    expect(byId.scene_4_cta).toMatchObject({ default: "", label: "Scene 4 · Call to action" });
    expect(byId.scene_4_company).toMatchObject({ default: "CoreAspect", label: "Scene 4 · Company" });
  });

  it("returns slots in scene then document order", () => {
    const { slots } = slotifyComposition(FIXTURE);
    expect(slots.map((s) => s.id)).toEqual([
      "scene_1_hd",
      "scene_1_sub",
      "scene_2_hd",
      "scene_3_stat_v",
      "scene_3_stat_l",
      "scene_4_cta",
      "scene_4_company",
    ]);
  });

  it("replaces each slotted element's text with a {{slotId}} token", () => {
    const { tokenizedHtml } = slotifyComposition(FIXTURE);
    expect(tokenizedHtml).toContain("{{scene_1_hd}}");
    expect(tokenizedHtml).toContain("{{scene_3_stat_v}}");
    expect(tokenizedHtml).toContain("{{scene_4_cta}}");
    // The original literal text is gone from the slotted elements…
    expect(tokenizedHtml).not.toContain(">88 Market Street<");
    // …but structure + non-text attrs are intact.
    expect(tokenizedHtml).toContain('id="scene-1" class="scene clip" data-start="0" data-duration="4"');
    expect(tokenizedHtml).toContain('id="bgm" src="assets/bgm/a.mp3"');
  });

  it("includes empty text elements (e.g. an unfilled cta)", () => {
    const { slots } = slotifyComposition(FIXTURE);
    const cta = slots.find((s) => s.id === "scene_4_cta")!;
    expect(cta).toBeTruthy();
    expect(cta.default).toBe("");
  });

  it("is idempotent: re-running on tokenized html does not double-wrap", () => {
    const first = slotifyComposition(FIXTURE);
    const second = slotifyComposition(first.tokenizedHtml);
    // HTML is unchanged (no nested {{...{{... tokens).
    expect(second.tokenizedHtml).toBe(first.tokenizedHtml);
    expect((second.tokenizedHtml.match(/\{\{/g) ?? []).length).toBe(first.slots.length);
  });

  it("never touches a hand-authored s\\d+- composition (no text classes)", () => {
    const sConventions = `<div id="root" data-duration="9">
      <div id="s1" class="scene clip" data-start="0" data-duration="3"><div id="s1-h">Hello</div></div>
      <div id="s2" class="scene clip" data-start="3" data-duration="6"><img id="s2-img" src="a.mp4"></div>
    </div>`;
    const { slots, tokenizedHtml } = slotifyComposition(sConventions);
    expect(slots).toEqual([]);
    expect(tokenizedHtml).not.toContain("{{");
    expect(tokenizedHtml).toContain(">Hello<");
  });

  it("handles a composition with no scenes", () => {
    const { slots, tokenizedHtml } = slotifyComposition(`<div id="root"><div class="hd">loose text</div></div>`);
    expect(slots).toEqual([]);
    expect(tokenizedHtml).toContain("loose text");
  });
});
