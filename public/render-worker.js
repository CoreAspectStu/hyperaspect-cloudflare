/**
 * render-worker.js — OffscreenCanvas + WebCodecs frame renderer
 * 
 * Each worker independently:
 * 1. Creates its own OffscreenCanvas (1920×1080)
 * 2. Draws frames for its assigned range
 * 3. Encodes each frame via WebCodecs VideoEncoder
 * 4. Sends EncodedVideoChunks back to main thread
 * 
 * This is the same pattern that would work distributed across machines
 * via WebRTC — each "worker" becomes a "peer".
 */

let canvas, ctx, encoder, muxer;

// Import GSAP inside the worker
self.importScripts('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js');

const palette = {
  bg: '#0a0a0a', cream: '#fef6e4', red: '#ff0000',
  yellow: '#ffd60a', cyan: '#00e5ff', lime: '#b8ff00', pink: '#ff6ec7',
};

// Animation state — same as the single-worker POC
const state = {
  titleY: -200, titleOpacity: 0, titleScale: 0.5, subtitleOpacity: 0,
  barsProgress: 0, barsScale: [0, 0, 0, 0, 0],
  statsProgress: 0, statValues: [0, 0, 0, 0],
  statTargets: [847, 92, 3400000, 99],
  statLabels: ['VIDEOS', 'BRANDS', 'VIEWS', '% automated'],
  ctaScale: 0, ctaOpacity: 0, bgFlash: 0,
};

function drawFrame() {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, 1920, 1080);
  const t = state;

  // Scene 1: Title slam
  if (t.titleOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = t.titleOpacity;
    ctx.translate(960, 540 + t.titleY);
    ctx.scale(t.titleScale, t.titleScale);
    ctx.font = '900 140px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.red;
    ctx.fillText('BRAND VIDEO', 8, 8);
    ctx.fillStyle = palette.cream;
    ctx.fillText('BRAND VIDEO', 0, 0);
    ctx.restore();
    if (t.subtitleOpacity > 0.01) {
      ctx.save();
      ctx.globalAlpha = t.subtitleOpacity;
      ctx.font = '400 32px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.cyan;
      ctx.fillText('100% browser-rendered · zero server cost · GPU accelerated', 960, 620);
      ctx.restore();
    }
  }

  // Scene 2: Color bars
  if (t.barsProgress > 0.01) {
    const colors = [palette.red, palette.yellow, palette.cyan, palette.lime, palette.pink];
    const barWidth = 300, gap = 20;
    const totalWidth = 5 * barWidth + 4 * gap;
    const startX = (1920 - totalWidth) / 2;
    colors.forEach((color, i) => {
      const scale = t.barsScale[i];
      if (scale < 0.01) return;
      const x = startX + i * (barWidth + gap);
      ctx.save();
      ctx.translate(x + barWidth / 2, 540);
      ctx.scale(scale, scale);
      ctx.translate(-barWidth / 2, -200);
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 8, barWidth, 400);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, barWidth, 400);
      ctx.restore();
    });
  }

  // Scene 3: Stats grid
  if (t.statsProgress > 0.01) {
    const statColors = [palette.cyan, palette.yellow, palette.lime, palette.pink];
    const cardW = 380, cardH = 240, gap = 30;
    const totalW = 4 * cardW + 3 * gap;
    const startX = (1920 - totalW) / 2;
    state.statLabels.forEach((label, i) => {
      const scale = gsap.utils.clamp(0, 1, state.statsProgress * 4 - i * 0.3);
      if (scale < 0.01) return;
      const x = startX + i * (cardW + gap);
      ctx.save();
      ctx.translate(x + cardW / 2, 540);
      ctx.scale(scale, scale);
      ctx.translate(-cardW / 2, -cardH / 2);
      ctx.fillStyle = '#111';
      ctx.fillRect(6, 6, cardW, cardH);
      ctx.strokeStyle = statColors[i];
      ctx.lineWidth = 4;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, cardW, cardH);
      ctx.strokeRect(0, 0, cardW, cardH);
      let displayVal = Math.floor(state.statValues[i]);
      let suffix = '';
      if (displayVal >= 1000000) { displayVal = (displayVal / 1000000).toFixed(1) + 'M'; }
      else if (displayVal >= 1000) { displayVal = (displayVal / 1000).toFixed(0) + 'K'; }
      ctx.font = '900 72px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = statColors[i];
      ctx.fillText(displayVal + suffix, cardW / 2, cardH / 2 - 20);
      ctx.font = '600 22px Inter, sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText(label, cardW / 2, cardH / 2 + 40);
      ctx.restore();
    });
  }

  // Scene 4: CTA
  if (t.ctaOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = t.ctaOpacity;
    if (t.bgFlash > 0.01) {
      ctx.fillStyle = `rgba(0, 229, 255, ${t.bgFlash * 0.3})`;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    ctx.translate(960, 540);
    ctx.scale(t.ctaScale, t.ctaScale);
    const bw = 700, bh = 160;
    ctx.fillStyle = palette.lime;
    ctx.fillRect(-bw / 2 + 8, -bh / 2 + 8, bw, bh);
    ctx.fillStyle = '#000';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = palette.lime;
    ctx.lineWidth = 5;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.font = '900 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.lime;
    ctx.fillText('YOUR MACHINE > OUR SERVER', 0, -15);
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Infinite scale · Zero cost · GPU powered', 0, 30);
    ctx.restore();
  }
}

function buildTimeline() {
  const tl = gsap.timeline({ paused: true });
  tl.to(state, { titleY: 0, titleOpacity: 1, titleScale: 1, duration: 0.6, ease: 'back.out(1.7)' }, 0)
    .to(state, { subtitleOpacity: 1, duration: 0.4, ease: 'power2.out' }, 0.8)
    .to(state, { titleOpacity: 0, subtitleOpacity: 0, titleY: -50, duration: 0.3, ease: 'power2.in' }, 2.2);
  tl.to(state.barsScale, { 0: 1, duration: 0.3, ease: 'back.out(2)' }, 2.5)
    .to(state.barsScale, { 1: 1, duration: 0.3, ease: 'back.out(2)' }, 2.65)
    .to(state.barsScale, { 2: 1, duration: 0.3, ease: 'back.out(2)' }, 2.8)
    .to(state.barsScale, { 3: 1, duration: 0.3, ease: 'back.out(2)' }, 2.95)
    .to(state.barsScale, { 4: 1, duration: 0.3, ease: 'back.out(2)' }, 3.1)
    .to(state, { barsProgress: 1, duration: 0.01 }, 2.5)
    .to(state.barsScale, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, duration: 0.3, ease: 'power2.in' }, 4.7);
  tl.to(state, { statsProgress: 1, duration: 0.6, ease: 'power2.out' }, 5.0)
    .to(state.statValues, { 0: state.statTargets[0], duration: 1.0, ease: 'power2.out' }, 5.3)
    .to(state.statValues, { 1: state.statTargets[1], duration: 1.0, ease: 'power2.out' }, 5.45)
    .to(state.statValues, { 2: state.statTargets[2], duration: 1.0, ease: 'power2.out' }, 5.6)
    .to(state.statValues, { 3: state.statTargets[3], duration: 1.0, ease: 'power2.out' }, 5.75)
    .to(state, { statsProgress: 0, duration: 0.3, ease: 'power2.in' }, 7.2);
  tl.to(state, { ctaScale: 1, ctaOpacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 7.5)
    .to(state, { bgFlash: 1, duration: 0.15, ease: 'power2.out' }, 7.5)
    .to(state, { bgFlash: 0, duration: 0.4, ease: 'power2.out' }, 7.65)
    .to(state, { ctaScale: 0.8, ctaOpacity: 0, duration: 0.3, ease: 'power2.in' }, 9.5);
  return tl;
}

self.onmessage = async (e) => {
  const { type, workerId, frameStart, frameEnd, fps, width, height, codec, hardwareAccel } = e.data;

  if (type === 'render') {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { alpha: false });

    const tl = buildTimeline();
    const frameDuration = 1_000_000 / fps; // microseconds
    const chunks = [];
    let frameCount = 0;

    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Copy chunk data for transfer
        const data = new Uint8Array(chunk.byteLength);
        data.set(new Uint8Array(chunk.buffer));
        chunks.push({
          data: data.buffer,
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          meta: meta ? {
            decoderConfig: meta.decoderConfig,
            description: meta.description,
          } : null,
        });
      },
      error: (err) => {
        self.postMessage({ type: 'error', workerId, error: err.message });
      },
    });

    encoder.configure({
      codec: codec || 'avc1.42E01E',
      width: width,
      height: height,
      bitrate: 8_000_000,
      framerate: fps,
      hardwareAcceleration: hardwareAccel || 'prefer-software',
      // Force keyframe at the start of each worker's range
      avc: { format: 'avc' },
    });

    const totalFrames = frameEnd - frameStart;

    for (let i = frameStart; i < frameEnd; i++) {
      const timeSec = i / fps;
      tl.seek(timeSec);
      tl.render();
      drawFrame();

      const frame = new VideoFrame(canvas, {
        timestamp: i * frameDuration,
        duration: frameDuration,
      });

      // Force keyframe on first frame of this worker's range
      encoder.encode(frame, { keyFrame: i === frameStart });
      frame.close();

      frameCount++;

      // Backpressure
      if (encoder.encodeQueueSize > 8) {
        await new Promise(r => setTimeout(r, 0));
      }

      // Progress report every 10 frames
      if (frameCount % 10 === 0 || i === frameEnd - 1) {
        self.postMessage({
          type: 'progress',
          workerId,
          rendered: frameCount,
          total: totalFrames,
        });
      }
    }

    await encoder.flush();
    encoder.close();

    self.postMessage({
      type: 'complete',
      workerId,
      frameStart,
      frameEnd,
      chunkCount: chunks.length,
      chunks: chunks,
    });
  }
};
