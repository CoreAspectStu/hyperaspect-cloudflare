import { describe, it, expect } from "vitest";
import { applyStructuralEdits } from "./project";
import { deriveScenes } from "./derive";

/**
 * Projection (structural-edit) tests — the 7-op engine + contiguous retiming.
 * Self-contained fixture (a 3-scene composition) so tests don't depend on a
 * specific template's assets/markup. deal-01 is exercised separately via the
 * /tmp smoke scripts during brick development.
 */
const FIXTURE = `<div id="root" data-composition-id="test" data-width="1920" data-height="1080" data-start="0" data-duration="9">
  <div id="s1" class="scene clip" data-start="0" data-duration="3"><div id="s1-h">Hello</div></div>
  <div id="s2" class="scene clip" data-start="3" data-duration="3"><img id="s2-img" src="a.mp4"></div>
  <div id="s3" class="scene clip" data-start="6" data-duration="3"><div id="s3-h">{{slot}}</div></div>
</div>`;

const contiguous = (sc: ReturnType<typeof deriveScenes>) => {
  for (let i = 1; i < sc.length; i++) {
    if (Math.abs(sc[i].start - (sc[i - 1].start + sc[i - 1].duration)) > 0.001) return false;
  }
  return true;
};

describe("projection: in-place ops", () => {
  it("sceneDuration patches data-duration + records a diff", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "sceneDuration", sceneId: "s2", duration: 5 }]);
    expect(r.diff).toHaveLength(1);
    expect(r.diff[0]).toMatchObject({ target: "scene s2", attr: "data-duration", from: "3", to: "5" });
    expect(r.errors).toHaveLength(0);
    expect(r.html).toContain('id="s2" class="scene clip" data-start="3" data-duration="5"');
  });

  it("trackRef patches a media element src", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "trackRef", trackId: "s2-img", ref: "b.mp4" }]);
    expect(r.diff[0]).toMatchObject({ attr: "src", from: "a.mp4", to: "b.mp4" });
    expect(r.html).toContain('id="s2-img" src="b.mp4"');
  });

  it("trackRef rejects a non-media element", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "trackRef", trackId: "s1-h", ref: "x" }]);
    expect(r.errors).toHaveLength(1);
    expect(r.diff).toHaveLength(0);
  });

  it("trackTiming patches start + duration", () => {
    const r = applyStructuralEdits(FIXTURE, [
      { op: "trackTiming", trackId: "s2-img", start: 1, duration: 2 },
    ]);
    expect(r.diff).toHaveLength(2);
  });

  it("text patches literal text content", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "text", trackId: "s1-h", text: "World" }]);
    expect(r.html).toContain('id="s1-h">World<');
  });

  it("text escapes markup", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "text", trackId: "s1-h", text: "A < B & C" }]);
    expect(r.html).toContain("A &lt; B &amp; C");
  });

  it("text refuses to clobber a {{slot}} token", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "text", trackId: "s3-h", text: "X" }]);
    expect(r.errors).toHaveLength(1);
    expect(r.html).toContain("{{slot}}");
  });
});

describe("projection: validation", () => {
  it("rejects unknown scene/track ids and applies nothing", () => {
    const r = applyStructuralEdits(FIXTURE, [
      { op: "sceneDuration", sceneId: "s99", duration: 1 },
      { op: "trackRef", trackId: "nope", ref: "x" },
    ]);
    expect(r.errors).toHaveLength(2);
    expect(r.diff).toHaveLength(0);
  });
});

describe("projection: contiguous retiming", () => {
  it("duration change shifts later scenes (no gap)", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "sceneDuration", sceneId: "s2", duration: 5 }]);
    // s1(3) + s2(5) = 8 → s3 shifts from 6 to 8
    expect(r.html).toContain('id="s3" class="scene clip" data-start="8"');
    expect(r.html).toContain('data-duration="11"'); // root total 3+5+3
    expect(contiguous(deriveScenes(r.html))).toBe(true);
  });

  it("is a no-op for text-only edits (total unchanged)", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "text", trackId: "s1-h", text: "X" }]);
    expect(r.html).toContain('data-duration="9"');
  });
});

describe("projection: removeScene", () => {
  it("removes a scene + closes the gap (contiguous)", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "removeScene", sceneId: "s2" }]);
    const sc = deriveScenes(r.html);
    expect(sc.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(r.html).toContain('data-duration="6"'); // 3+3
    expect(contiguous(sc)).toBe(true);
    expect(r.diff[0]).toMatchObject({ op: "removeScene", target: "scene s2", attr: "removed" });
  });
});

describe("projection: reorderScene", () => {
  it("moves a scene before/after an anchor (retimed)", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "reorderScene", sceneId: "s1", after: "s3" }]);
    const sc = deriveScenes(r.html);
    expect(sc.map((s) => s.id)).toEqual(["s2", "s3", "s1"]); // s1 moved to last
    expect(contiguous(sc)).toBe(true);
    expect(r.html).toContain('data-duration="9"'); // total unchanged
  });

  it("rejects reorder without before/after", () => {
    const r = applyStructuralEdits(FIXTURE, [{ op: "reorderScene", sceneId: "s1" } as never]);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("projection: addScene", () => {
  it("adds a scene after an anchor (contiguous, content rendered)", () => {
    const r = applyStructuralEdits(FIXTURE, [
      { op: "addScene", sceneId: "s4", after: "s3", duration: 2, headline: "Call Now", subtext: "0400" },
    ]);
    const sc = deriveScenes(r.html);
    expect(sc.map((s) => s.id)).toContain("s4");
    expect(sc[sc.length - 1]?.id).toBe("s4");
    expect(contiguous(sc)).toBe(true);
    expect(r.html).toContain("Call Now");
    expect(r.html).toContain("0400");
    expect(r.html).toContain('data-duration="11"'); // 9 + 2
  });

  it("rejects an id that already exists", () => {
    const r = applyStructuralEdits(FIXTURE, [
      { op: "addScene", sceneId: "s1", after: "s2", duration: 2, headline: "X" },
    ]);
    expect(r.errors).toHaveLength(1);
  });

  it("rejects an unknown anchor", () => {
    const r = applyStructuralEdits(FIXTURE, [
      { op: "addScene", sceneId: "s9", after: "zzz", duration: 2, headline: "X" },
    ]);
    expect(r.errors).toHaveLength(1);
  });
});
