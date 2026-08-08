import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  playbackHref,
  sourceThumbnailUrl,
  videoPoster,
  youtubeEmbedUrl,
} from "./youtube";

/**
 * Unit tests for the youtube-ai-video admin integration helpers.
 *
 * E3-S1 (FR-5): the source-video display helpers — extractYouTubeId gates the
 * Process button and youtubeEmbedUrl renders the embedded source iframe.
 * E3-S2 (FR-6): the generated-videos grid helpers — playbackHref routes the
 * MP4 stream through the gateway and videoPoster resolves the card poster.
 * Pure functions, no DOM required.
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

// --- E3-S2: generated-videos grid playback + thumbnails (FR-6) ---------------

describe("playbackHref", () => {
  it("routes a Python-relative video path through the gateway", () => {
    expect(playbackHref("/videos/abc-123/file")).toBe(
      "/api/youtube/videos/abc-123/file",
    );
  });

  it("tolerates a path with no leading slash", () => {
    expect(playbackHref("videos/abc-123/file")).toBe(
      "/api/youtube/videos/abc-123/file",
    );
  });

  it("returns null when there is no final video yet (processing/error)", () => {
    expect(playbackHref(null)).toBeNull();
    expect(playbackHref("")).toBeNull();
  });
});

describe("sourceThumbnailUrl", () => {
  it("builds the hqdefault thumbnail URL for a bare id", () => {
    expect(sourceThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });
});

describe("videoPoster", () => {
  it("prefers the backend thumbnail_url when present", () => {
    expect(
      videoPoster({ thumbnail_url: "/files/abc.png", video_id: "dQw4w9WgXcQ" }),
    ).toBe("/files/abc.png");
  });

  it("falls back to the source YouTube thumbnail from video_id", () => {
    expect(videoPoster({ thumbnail_url: null, video_id: "dQw4w9WgXcQ" })).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("returns null when neither thumbnail nor video_id is available", () => {
    expect(videoPoster({ thumbnail_url: null, video_id: null })).toBeNull();
  });
});
