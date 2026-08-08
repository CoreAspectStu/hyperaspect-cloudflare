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
