/**
 * YouTube URL/ID helpers for the youtube-ai-video admin integration.
 *
 * Used by /admin/youtube-pipeline to (a) gate the Process button on a valid
 * source URL and (b) render the embedded source-video iframe (E3-S1, FR-5,
 * ADR-006). Pure and side-effect free so it is unit-testable without a DOM.
 */

// Matches the 11-char YouTube id across the common URL surfaces. Not anchored
// to the start of the string so it tolerates scheme/www/mobile prefixes.
const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// A bare 11-char id on its own — what the backend stores in `video_id`.
const BARE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract the 11-char YouTube video id from a URL (watch / embed / shorts /
 * live / youtu.be), or null. URL-only by design: the Process button is gated on
 * this, so a bare id must NOT pass here (the backend needs a real URL to ingest).
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(YT_ID_RE);
  return m ? m[1] : null;
}

/**
 * Build a privacy-enhanced embed URL for a YouTube video, accepting either a
 * bare 11-char id (e.g. a stored `video_id`) or any YouTube URL. Uses
 * youtube-nocookie.com (privacy-enhanced mode) so the admin sandbox does not
 * seed YouTube's tracking cookies when embedding arbitrary submitted URLs.
 * Returns null if no id can be resolved.
 */
export function youtubeEmbedUrl(idOrUrl: string): string | null {
  if (!idOrUrl) return null;
  const trimmed = idOrUrl.trim();
  const id = BARE_ID_RE.test(trimmed) ? trimmed : extractYouTubeId(trimmed);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

// --- Generated-videos grid: playback + thumbnails (E3-S2, FR-6, ADR-006) -----

/**
 * Build the playback href for a generated video from the job's
 * `final_video_url` — a path relative to the Python API root (e.g.
 * "/videos/{job_id}/file", set by the runner). Routes it through the Next.js
 * /api/youtube/* gateway so the admin cookie authenticates the stream
 * (ADR-005). Returns null when the job has no playable artifact yet (still
 * processing / errored), which the grid card uses to show its placeholder.
 */
export function playbackHref(finalVideoUrl: string | null): string | null {
  if (!finalVideoUrl) return null;
  return "/api/youtube/" + finalVideoUrl.replace(/^\//, "");
}

/**
 * YouTube source-thumbnail URL (hqdefault) for a bare 11-char video id. Used
 * as the grid-card poster for a generated video so there is an instant visual
 * before the (heavier) generated MP4 would need to load.
 */
export function sourceThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Resolve a poster image for a generated-video grid card. Prefers the
 * backend-provided `thumbnail_url`, then falls back to the source YouTube
 * thumbnail derived from `video_id`. Returns null when neither is available
 * (the card then degrades to the generated video's own first frame via
 * preload="metadata"). Kept pure so the fallback chain is unit-testable.
 */
export function videoPoster(video: {
  thumbnail_url: string | null;
  video_id: string | null;
}): string | null {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.video_id) return sourceThumbnailUrl(video.video_id);
  return null;
}
