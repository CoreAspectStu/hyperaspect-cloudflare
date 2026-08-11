# HyperAspect Studio — How-To Guide

This guide covers the two things you can do today, and the one thing that's
**not yet wired up** (so you don't go looking for it).

> **Short version:** You can **edit an existing template** (e.g. `deal-01`)
> end-to-end, and you can **create a brand-new video** from a prompt. But a
> freshly-created video **does not yet open in the editor** with its content —
> that bridge is the main missing piece (see Part 3).

---

## Part 1 — Edit an existing video (Studio Editor) ✅ works

**Open it:** `http://localhost:3200/studio/editor?template=deal-01`
(prod: `https://video.coreaspectai.com/studio/editor?template=deal-01`)

> Only templates registered in the template store work here. Today that's
> `deal-01`. (See Part 3 for why generated videos don't appear here yet.)

### The screen (3 panels)

| Panel | What it's for |
|---|---|
| **Left — Scenes** | The list of scenes in the video. Click one to select + edit it. **Add scene** appends a new one. |
| **Center — Preview + Timeline** | A **live preview** of the selected scene (updates instantly, no render needed). The strip below is the **timeline** — scenes sized by duration; click to select. |
| **Right — Inspector** | The editing controls, in 4 tabs (below). |

### The 4 inspector tabs

- **Beats** — per-scene content: headline, narration/subtext, duration, layout, caption style, transition. Also reorder / add / delete scenes.
- **Style** — colors + fonts for the whole video.
- **Audio** — narration voice, music bed, sound effects.
- **Slots** — the **per-client variables** (deal status, address, agent names/phones, areas…). These are the `{{tokens}}` that fill the template. **Edit a slot → Save → the live preview updates** without a render.

### Edit something and see it

1. Click a scene in the left rail (or the timeline).
2. The center preview shows that scene live.
3. Edit a **Slot** (e.g. change deal status) → click **Save** in the Slots tab → preview recomposes instantly.
4. Or edit the **Beat** (headline, duration, etc.).

### Ask the AI to edit for you

Bottom bar → **Ask AI**:
- Pick **Slots** (“change status to SOLD, warmer accent colour”) or **Structure** (“shorten scene 3 to 5s”, “add a closing CTA scene”).
- Type the instruction → the AI proposes a **diff**.
- **Accept** → it applies → the preview updates → the gate runs.

### Render + ship (the Gate)

The bottom bar's actions run the verification pipeline:

1. **Check** — lint + runtime validation (~30 s).
2. **Render Video** — render the composition to mp4 (farm; ~1.5 min on dell-xps, ~12 min local).
3. **Review** — vision-QA: GLM scores 12 frames out of 10.
4. **Run Gate** — does Check → Render → Review in sequence, then **waits for you to Approve**.
5. **Approve** — sign off on the current render.
6. **Deliver** — ships the approved mp4 and gives you a **Share** link. (Delivery is gated on a current approval — if you re-render, you must re-approve.)

**Status pills** at the bottom show where things stand (approved/score, delivered, gate running, errors).

---

## Part 2 — Create a video from scratch ✅ works

**Start:** the home page (`/`) opens an **onboarding wizard**:

1. **Persona** — pick your role (Industrial / Commercial / Residential Agent, Recruiter, Hiring Manager).
2. **Listing** — paste a property URL (auto-extracts details) and/or enter the address, specs, agent info. Optionally a company website for brand colours.
3. **Brand** — confirm/adjust colours + logo.
4. **Format** — 16:9 or 9:16, voice, music. Click **Create Video**.

The platform then:
- Calls the relay to **generate content / a manifest** (GLM writes the scenes).
- **Composes + renders** the video on the farm.
- Polls until done (~2–5 min) and shows the finished **mp4** in a player.

You get a finished video you can **Download** or **Share**.

> You can also skip the wizard and use the **“Describe It”** tile (type a plain-English prompt) or a **Story Mode** (Property Tour / Job Ad / YouTube Clone).

---

## Part 3 — Edit a video you just created ⚠️ NOT wired up yet

This is the gap. **A freshly-generated video does not open in the Studio Editor with its content.** If you click “Timeline Editor” on a result (or go to `/studio/editor?template=<generated-id>`), the editor opens but shows **generic default scenes**, not your video.

### Why

Two separate systems that aren't connected:

- **Generation** writes the video to the **render farm** (`videos/<name>/`, e.g. `videos/ha-083b3d4d/`).
- **The Studio Editor** reads only from the **template store** (`templates/<id>/`, e.g. `templates/deal-01/`).

Nothing copies a generated video into the template store, so the editor can't see it. `deal-01` works only because its `templates/deal-01/` was manually pointed at the farm copy.

### Workaround (manual, for now)

To edit a generated video `ha-xxxx`:

1. On the farm, copy `videos/ha-xxxx/index.html` + assets into `templates/ha-xxxx/`.
2. Create a `templates/ha-xxxx/template.json` sidecar (slots + scenes).
3. Open `/studio/editor?template=ha-xxxx`.

(This is exactly how `deal-01` was set up. It's manual today.)

### The real fix (recommended next build)

After generation completes, **auto-register the video as a template**: write its
composition HTML + a generated `template.json` (slots/scenes derived from the
manifest) into the template store (R2 in prod). Then the result screen's
“Timeline Editor” button, and `/studio/editor?template=<generated-id>`, would
open the actual content for editing. This single bridge closes the whole loop:
**create → edit → gate → deliver**.

---

## Part 4 — Quick reference

| Want to… | Do this |
|---|---|
| Edit `deal-01` | `/studio/editor?template=deal-01` |
| Create a new property video | Home page → onboarding wizard (or “Describe It”) |
| See a scene live | Click it in the left rail / timeline |
| Change a client detail | Slots tab → edit → Save (preview updates) |
| Let AI propose edits | Bottom bar → Ask AI (Slots or Structure) → Accept diff |
| Render + ship | Run Gate → Approve → Deliver |
| Edit a video you just generated | ⚠️ Not yet supported — see Part 3 |
