# CoreAspect Video Studio — session restart (2026-08-13)

> Self-contained handoff. A fresh chat in `/data/projects/hyperframes-v2/hyperaspect-cloudflare` needs only
> this + the memory files. As of 2026-08-13 the studio editor + create→edit bridge are feature-complete,
> deployed to prod, and merged to main.

**Doc path:** `/data/projects/hyperframes-v2/hyperaspect-cloudflare/SESSION-RESTART.md`

---

## Read first
1. **Memory:** `~/.claude/projects/-data-projects-hyperframes-v2-hyperaspect-cloudflare/memory/MEMORY.md` → `editor-loop-broken-at-relay.md` + `live-scene-preview-a0.md` + `visually-verify-work.md`.
2. **Studio guide:** `docs/studio-guide.md` (how-to for the editor + create flow + the gap notes).
3. **E2E test:** `e2e/create-register-edit.spec.ts` (`npm run test:e2e`, or `E2E_VIDEO=<id> npm run test:e2e` for fast path).

## The app
`hyperframes-v2/hyperaspect-cloudflare` — Next **16.2.9** + React 19 + **OpenNext** on Cloudflare Workers
(`wrangler.jsonc` main=`.open-next/worker.js`; R2 binding `TEMPLATES`→`hyperaspect-templates`). **AGENTS.md:
read `node_modules/next/dist/docs/` before Next-specific code.** Live at `video.coreaspectai.com`. Dev = `pnpm
exec next dev -p 3200` (**always curl :3200**, not :3000/:3100).

## What was built this session (ALL on `main`, ALL deployed prod)

### Editor redesign (commits 6c8a510 → 353c36a)
- **Live scene preview** (`ScenePreview.tsx`): same-origin iframe loads the recomposed composition HTML,
  drives the GSAP timeline (`window.__timelines` — OBJECT not array; `.seek()` only, never `.render()`),
  isolates the selected scene (hides out-of-window `[data-start]` elements), CSS-scales to fit.
- **▶ Play button**: plays the full GSAP timeline through ALL scenes; progress bar; active scene tracks in
  timeline during playback (via `onTimeUpdate` callback → `setSelectedBeat`).
- **2-panel layout** (was 3-panel; left rail removed — timeline strip is the scene selector).
- **Light theme**: tokens in `COLORS` (bg #f7f8fa, surface #fff, accent indigo #4f46e5, soft shadows).
- **Help panel**: "?" button in header → modal explaining every section + which tabs work.
- **"Scenes" tab** (renamed from "Beats" — same concept, unified naming).
- **Render-poll fix** (`render/[jobId]` route): output-probe fallback for dell-xps renders (mp4 mtime >
  job createdAt → completion detected, so the gate doesn't hang at "running").

### Create → Edit bridge (commits 8ff1021 + 14a7de8)
- **Dev**: `POST /api/studio/register` copies farm `videos/<name>/` → `templates/<name>/` (index.html +
  assets + template.json with `family:"generated"`, empty slots). Scenes auto-derived by `deriveScenes`.
- **Prod**: register route detects Workers → pulls from relay (`/video-composition/:id` → {html, assets} +
  `/video-asset/:id/<path>` → bytes) → writes to R2 via `store.writeFile`. Relay endpoints added to
  propodoc `server.mjs` (handleVideoCompositionGet + handleVideoAssetGet + listAssetsRecursive + mimeFor).
- Triggered on generation `done` (`page.tsx` status branch → `POST /api/studio/register {videoName}`).
- **"Timeline Editor"** on the result screen → navigates to `/studio/editor?template=<videoName>`.

### `/studio` gallery (`page.tsx`)
- Lists all templates (deal-01 + generated ha-*) as clickable cards → `/studio/editor?template=<id>`.
- "Create new video" link → home.

### E2E test (`e2e/create-register-edit.spec.ts`)
- Full: generate → register → template loads → editor opens → preview + scene switch seeks. Green (~3.6min).
- Fast: `E2E_VIDEO=<id> npm run test:e2e` (skips generation, ~8s).

## The render pipeline (unchanged)
Worker → relay (`render.coreaspectai.com`, Bearer `RENDER_SECRET`) → `hf-queue.py` → systemd
`hyperframes-render@<name>.service` (`hf-render.sh` → dell-xps via `.render-dellxps` marker, else local).
Gate routes: `/api/studio/template/[id]/{check,review,approve,render,deliver,propose,propose-structural,apply-structural}`.
Generate: `/api/generate` → relay `/generate-manifest` → `/video-create`.

## ⚠ Key gotchas
- **Dev server**: restart + `rm -rf .next` if routes 404 after `pnpm add` (stale Turbopack — the pnpm
  node_modules path hash shifts + corrupts the cache). Symptom: "module factory not available" / blank page.
- **Preview first paint is slow** (~5-10s): relay recompose + gsap CDN load. Subsequent scene switches are
  instant. Shows "Rendering scene…" until `__timelines` registers (10s timeout).
- **Generated videos have no `{{token}}` slots** → edit via Beats (local) or Ask AI → Structure (persists
  via the gate). Slots tab is empty for generated videos. Style/Audio tabs are generate-time only (don't
  affect existing templates).
- **`hf-compose.py`** (~/bin, NOT in repo): has the image-promotion guard (Layer A + portrait
  `image-hero` preference). At drift risk — mirror to a tracked location if not done yet.
- **Relay `server.mjs`**: edit the REPO copy (`/data/projects/propodoc/services/propodoc-render/server.mjs`),
  then `./deploy.sh` (cp repo→runtime + restart). Never edit the runtime copy directly.
- **Visual verification**: the `Read` tool on images returns only a CDN URL here — use
  `mcp__zai-vision__analyze_image` to actually SEE screenshots. Playwright at
  `/data/projects/autocoder/node_modules/playwright` or `@playwright/test` (installed).
- **Build/deploy**: `npx @opennextjs/cloudflare build` (>2min) → `npx wrangler deploy`. Deploys the whole
  working tree. Each feature = branch + commit + push to main.

## What's left (optional — no architectural gaps)
1. **Style/Audio tabs**: don't work for existing templates (generate-time only). Either hide them or wire
   them to actually restyle the composition HTML.
2. **Slot-ify generated videos**: declare per-scene text slots + write a mustache source so the Slots tab +
   live slot-preview work for generated videos (currently Beats/Structure only).
3. **Generated-video richness**: generated videos are text-only (no images/branding). The image-promotion
   guard in `hf-compose.py` helps, but the generate flow's compositions need actual image generation.
4. **Webhook registration robustness**: register from the server-side webhook (`webhook/route.ts`) too, so
   registration succeeds even if the user closes the tab before `done`.
5. **`hf-compose.py` persistence**: mirror to a tracked repo (currently ~/bin only).

## First steps for the new session
1. `pnpm exec next dev -p 3200` + `curl localhost:3200/studio` → gallery with deal-01 + generated videos.
2. `curl localhost:3200/studio/editor?template=deal-01` → the 2-panel editor with live preview + play button.
3. `E2E_VIDEO=ha-c5abbf2f npm run test:e2e` → fast e2e green.
4. Pick an optional item above, or iterate on UX.
