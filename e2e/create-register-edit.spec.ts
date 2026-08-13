import { test, expect } from "@playwright/test";

/**
 * E2E: create a video from scratch → register it → open + interact in the editor.
 *
 * This is the "bridge" flow end-to-end. It needs the dev server (E2E_BASE_URL,
 * default http://localhost:3200) and the render farm (generation + registration
 * reach the farm). Generation takes ~90s, so the test timeout is generous.
 *
 * Re-run the edit half fast against an existing video without regenerating:
 *   E2E_VIDEO=ha-c5abbf2f npx playwright test
 */
const PROMPT =
  "A 20 second promo for a new property: office suite for lease at 88 Market Street, Richmond VIC. Highlight natural light, A-grade finishes, immediate availability.";

test("create → register → edit a generated video", async ({ request, page }) => {
  test.setTimeout(5 * 60 * 1000);
  const existing = process.env.E2E_VIDEO;
  let videoName: string;

  if (!existing) {
    // 1. Generate a fresh video from a property prompt.
    const gen = await request.post("/api/generate", {
      data: { inputValue: PROMPT, inputType: "text", brief: { aspectRatio: "16:9" } },
    });
    expect(gen.ok()).toBeTruthy();
    const g = await gen.json();
    // The client's auto-register hook needs renderName to be present.
    expect(g.renderName).toBeTruthy();
    videoName = g.renderName;

    // 2. Poll until generation finishes.
    let status = "queued";
    for (let i = 0; i < 60 && status !== "done"; i++) {
      const s = await (await request.get(`/api/status?id=${g.id}`)).json();
      status = s.status;
      if (status === "failed" || status === "error") throw new Error(`generation failed: ${s.error}`);
      if (status !== "done") await new Promise((r) => setTimeout(r, 8000));
    }
    expect(status).toBe("done");
  } else {
    videoName = existing;
  }

  // 3. Register the generated video as an editable template (the call page.tsx fires on done).
  const reg = await request.post("/api/studio/register", {
    data: { videoName, title: "e2e create-register-edit" },
  });
  expect((await reg.json()).ok).toBeTruthy();

  // 4. It now loads as a template with scenes derived from the composition HTML.
  const tpl = await (await request.get(`/api/studio/template/${encodeURIComponent(videoName)}`)).json();
  expect(Array.isArray(tpl.scenes)).toBeTruthy();
  expect(tpl.scenes.length).toBeGreaterThan(0);
  expect(tpl.family).toBe("generated");

  // 4b. Generated videos are slot-ified: per-scene text slots are declared so the
  // Slots tab + live preview work (not just Beats/Structure).
  expect(Array.isArray(tpl.slots)).toBeTruthy();
  expect(tpl.slots.length).toBeGreaterThan(0);

  // 5. The editor opens it with a live preview + the real scenes, no errors.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`/studio/editor?template=${encodeURIComponent(videoName)}`, { waitUntil: "load" });
  await expect(page.locator('iframe[title="Scene preview"]')).toBeVisible();
  await expect(page.locator('button:has-text("Scene")').first()).toBeVisible();
  // The Slots tab is present (generated videos now declare text slots). Match
  // the tab's "Slots (N)" label, not the Ask-AI mode toggle's bare "Slots".
  await expect(page.getByRole("button", { name: /^Slots \(\d+\)/ })).toBeVisible();
  expect(errors).toEqual([]);

  // 6. Interact: selecting a later scene seeks the GSAP timeline forward.
  // First wait for the preview composition to load + register its timeline
  // (relay recompose + gsap can take several seconds on a cold server).
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const f = document.querySelector('iframe[title="Scene preview"]') as HTMLIFrameElement | null;
        const tls = (f?.contentWindow as unknown as { __timelines?: Record<string, unknown> } | null)
          ?.__timelines;
        return !!(tls && Object.keys(tls).length > 0);
      }),
    { timeout: 30_000, message: "preview timeline to register" },
  ).toBeTruthy();

  const seeked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) => /Scene/.test(b.textContent || ""));
    if (!btns[2]) return false;
    (btns[2] as HTMLElement).click();
    return true;
  });
  expect(seeked).toBeTruthy();
  await page.waitForTimeout(1500);
  const time = await page.evaluate(() => {
    const f = document.querySelector('iframe[title="Scene preview"]') as HTMLIFrameElement | null;
    const tls = (f?.contentWindow as unknown as { __timelines?: Record<string, { time?: () => number }> } | null)
      ?.__timelines;
    const tl = tls && Object.values(tls)[0];
    return tl && typeof tl.time === "function" ? Math.round(tl.time() * 100) / 100 : null;
  });
  expect(time).not.toBeNull();
  // Scene 3 of a ~20s / 4-scene video lands well past the first scene.
  expect(time as number).toBeGreaterThan(5);
});
