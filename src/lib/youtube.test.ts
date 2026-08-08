import { describe, it, expect } from "vitest";
import { extractYouTubeId, youtubeEmbedUrl } from "./youtube";

/**
 * Unit tests for the YouTube source-video display helpers (E3-S1, FR-5).
 *
 * These power both the Process-button gate (extractYouTubeId) and the embedded
 * source iframe (youtubeEmbedUrl) on /admin/youtube-pipeline. Pure functions,
 * no DOM required.
 */

describe("extractYouTubeId", () => {
  it("parses a standard watch URL", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses a youtu.be short URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses a shorts URL", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses an embed URL", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses a live URL", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("ignores trailing query params and timestamps", () => {
    expect(
      extractYouTubeId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLfoo",
      ),
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=10"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("tolerates mobile / no-scheme variants", () => {
    expect(
      extractYouTubeId("m.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a bare id (URL-only — gates the Process button)", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null for empty / non-YouTube input", () => {
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("https://vimeo.com/12345")).toBeNull();
    expect(extractYouTubeId("not a url at all")).toBeNull();
  });
});

describe("youtubeEmbedUrl", () => {
  it("builds a privacy-enhanced embed from a bare id", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("builds a privacy-enhanced embed from a watch URL", () => {
    expect(
      youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("always uses the nocookie domain (privacy-enhanced mode)", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toContain(
      "www.youtube-nocookie.com",
    );
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).not.toContain(
      "youtube.com/embed",
    );
  });

  it("trims whitespace around the input", () => {
    expect(youtubeEmbedUrl("  dQw4w9WgXcQ  ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("returns null for empty / unresolvable input", () => {
    expect(youtubeEmbedUrl("")).toBeNull();
    expect(youtubeEmbedUrl("https://vimeo.com/12345")).toBeNull();
  });
});
