/* Dugout Hub media: videos, photos and PDFs uploaded from a phone or iPad.
   Files go to a private storage space. The hub-media function checks the family code and hands out
   short-lived links; nobody can reach a file without the code. Big videos are shrunk on the device first. */
const HubMedia = (() => {
  const FN = 'https://yglqvmdrocoknogamagr.supabase.co/functions/v1/hub-media';
  const MAX = 45 * 1024 * 1024, PDF_MAX = 10 * 1024 * 1024, VIDEO_CAP_SEC = 300, PHOTO_PX = 2048, POSTER_PX = 320;
  const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
  const mb = n => n < 1048576 ? (n > 0 ? Math.max(1, Math.round(n / 1024)) : 0) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';

  async function call(action, k, body) {
    let res;
    try { res = await fetch(FN, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k, action }, body || {})) }); }
    catch (e) { throw { code: 'offline', msg: 'No internet connection. Try again on Wi-Fi.' }; }
    let d = {}; try { d = await res.json(); } catch (e) {}
    if (res.status === 401) throw { code: 'denied', msg: 'The family code was not accepted.' };
    if (!res.ok) throw { code: 'rejected', msg: d.error || 'The video library had a problem. Try again.' };
    return d;
  }

  function kindOf(f) {
    const t = (f && f.type || '').toLowerCase(), n = (f && f.name || '').toLowerCase();
    if (t.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/.test(n)) return 'video';
    if (t.startsWith('image/') || /\.(jpe?g|png|heic|heif|gif|webp)$/.test(n)) return 'photo';
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    return null;
  }

  const loadImg = f => new Promise((ok, bad) => { const u = URL.createObjectURL(f), i = new Image();
    i.onload = () => ok({ i, done: () => URL.revokeObjectURL(u) }); i.onerror = () => { URL.revokeObjectURL(u); bad({ msg: 'This photo could not be opened. Try a JPEG or PNG.' }); }; i.src = u; });
  const toBlob = (c, q) => new Promise(ok => { try { c.toBlob(b => ok(b || fromData(c, q)), 'image/jpeg', q); } catch (e) { ok(fromData(c, q)); } });
  // Some Safari versions hand back nothing from toBlob on big pictures; build the file from the picture data instead.
  function fromData(c, q) { try { const d = c.toDataURL('image/jpeg', q), bin = atob(d.split(',')[1]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.length > 1000 ? new Blob([a], { type: 'image/jpeg' }) : null; } catch (e) { return null; } }
  function fit(w, h, max) { const s = Math.min(1, max / Math.max(w, h)); return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]; }
  function draw(src, w, h, max) { const [cw, ch] = fit(w, h, max), c = document.createElement('canvas'); c.width = cw; c.height = ch; c.getContext('2d').drawImage(src, 0, 0, cw, ch); return c; }

  // Every photo is redrawn as a JPEG: iPhone HEIC photos become JPEG, big photos drop to 2048 px.
  async function photo(f) {
    const { i, done } = await loadImg(f);
    try {
      let blob = await toBlob(draw(i, i.naturalWidth, i.naturalHeight, PHOTO_PX), 0.85);
      if (!blob) blob = await toBlob(draw(i, i.naturalWidth, i.naturalHeight, 1600), 0.85);
      const poster = draw(i, i.naturalWidth, i.naturalHeight, POSTER_PX).toDataURL('image/jpeg', 0.7);
      if (!blob) throw { msg: 'This photo could not be prepared.' };
      return { blob, ext: 'jpg', type: 'image/jpeg', poster };
    } finally { done(); }
  }

  function openVideo(src) {
    return new Promise((ok, bad) => { const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous';
      const t = setTimeout(() => bad({ msg: 'This video took too long to open. Try a shorter clip.' }), 20000);
      v.onloadeddata = () => { clearTimeout(t); ok(v); }; v.onerror = () => { clearTimeout(t); bad({ msg: 'This video could not be opened here.' }); };
      v.src = src; v.load();
      // iPad Safari sometimes waits for play() before it loads anything; a muted play is allowed.
      setTimeout(() => { if (v.readyState < 2) { const p = v.play(); if (p && p.then) p.then(() => v.pause()).catch(() => {}); } }, 800); });
  }
  const seek = (v, s) => new Promise(ok => { const d = () => { v.removeEventListener('seeked', d); ok(); }; v.addEventListener('seeked', d); v.currentTime = s; setTimeout(d, 3000); });

  async function videoPoster(v) {
    try { await seek(v, Math.min(0.5, (v.duration || 1) / 2)); return draw(v, v.videoWidth, v.videoHeight, POSTER_PX).toDataURL('image/jpeg', 0.7); } catch (e) { return null; }
  }

  // A short trace of what the shrinking did, for device tests.
  const trace = [];
  function note(ev, d) { trace.push([Math.round(performance.now()), ev, d]); if (trace.length > 80) trace.splice(10, 1); }
  const TRIM = 'Trim it in the Photos app (Edit, then drag the ends) so it is under 45 MB, and try again.';
  // Show the video while it shrinks: iPads (especially in Low Power Mode) may refuse to play a hidden one.
  function showLive(v) { const spot = document.getElementById('up-live'); if (spot) { v.className = 'uplive'; spot.replaceChildren(v); } return () => { if (spot) spot.replaceChildren(); }; }

  // Method 1 (iPadOS / iOS 16.4 and newer): frame by frame. Every frame the video shows is redrawn at 720p and
  // re-encoded with its own time stamp. If the device falls behind, playback slows down and backs up to the
  // last saved frame, so a slow device takes longer but never drops frames.
  async function encodeFrames(v, onStep, maxPx, bps) {
    const dur = v.duration, STEP = 1 / 30;
    let [w, h] = fit(v.videoWidth, v.videoHeight, maxPx); w -= w % 2; h -= h % 2;
    let cfg = null;
    // "realtime" makes the encoder hand back each frame right away instead of holding a batch.
    for (const latencyMode of ['realtime', undefined]) for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
      if (cfg) break;
      try { const want = { codec, width: w, height: h, bitrate: bps, framerate: 30, avc: { format: 'avc' } }; if (latencyMode) want.latencyMode = latencyMode;
        const r = await VideoEncoder.isConfigSupported(want); if (r && r.supported) cfg = r.config; } catch (e) {}
    }
    note('config', cfg && (cfg.codec + ' ' + (cfg.latencyMode || 'default')));
    if (!cfg) throw { nowc: true };
    const target = new Mp4Muxer.ArrayBufferTarget();
    const mux = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let fail = null;
    let outs = 0, outAt = Date.now();
    const enc = new VideoEncoder({ output: (chunk, meta) => { outs++; outAt = Date.now(); try { mux.addVideoChunk(chunk, meta); } catch (e) { fail = e; note('mux error', String(e)); } }, error: e => { fail = e; note('encoder error', String(e)); } });
    enc.configure(cfg);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    let last = -1, n = 0, moved = Date.now(), watch, busy = false, stopped = false;
    const hide = showLive(v);
    await seek(v, 0); v.playbackRate = 1;
    try {
      await new Promise((ok, bad) => {
        const frame = async (now, meta) => {
          if (stopped) return;
          if (fail) { stopped = true; return bad({ wc: true }); }
          const t = meta.mediaTime;
          if (n < 5 || n % 30 === 0) note('frame', { n, t: +t.toFixed(3), q: enc.encodeQueueSize, outs, rate: v.playbackRate });
          if (!busy && (last < 0 || t >= last + STEP * 0.75)) {
            if (last >= 0 && t - last > STEP * 2.5 && v.playbackRate > 0.25) {
              // Fell behind: slow down and go back to just after the last saved frame.
              v.playbackRate = v.playbackRate / 2; v.currentTime = last + STEP * 0.5; note('slow down', { rate: v.playbackRate, back: +last.toFixed(3), gap: +(t - last).toFixed(3) });
            } else {
              busy = true;
              ctx.drawImage(v, 0, 0, w, h);
              const f = new VideoFrame(c, { timestamp: Math.round(t * 1e6), duration: Math.round(STEP * 1e6) });
              enc.encode(f, { keyFrame: n % 60 === 0 }); f.close(); n++; last = t; moved = Date.now();
              onStep('Shrinking the video: ' + Math.min(100, Math.round(t / dur * 100)) + '%', t / dur);
              // Let the encoder catch up, but never wait more than a second.
              if (enc.encodeQueueSize > 6) { v.pause(); const until = Date.now() + 1000; while (enc.encodeQueueSize > 1 && !fail && Date.now() < until) await new Promise(r => setTimeout(r, 15)); if (!v.ended) v.play().catch(() => {}); }
              busy = false;
            }
          }
          if (!v.ended) v.requestVideoFrameCallback(frame);
        };
        v.requestVideoFrameCallback(frame);
        v.onended = () => { stopped = true; note('ended', { n, outs }); ok(); };
        v.onerror = () => { stopped = true; bad({ wc: true }); };
        // Stuck for 8 seconds: give up on this method; shrink() then uses the replay method.
        watch = setInterval(() => { if (Date.now() - moved > 8000 || (n > 0 && Date.now() - outAt > 8000)) { stopped = true; note('stalled', { n, outs, q: enc.encodeQueueSize, t: v.currentTime, paused: v.paused }); bad({ wc: true, stall: true }); } }, 1000);
        v.play().catch(e => { stopped = true; note('play refused', String(e)); bad({ wc: true }); });
      });
      await Promise.race([enc.flush(), new Promise((_, bad) => setTimeout(() => bad({ wc: true, stall: true }), 15000))]);
      if (fail) throw { wc: true };
      // Never accept a short or gappy result: every saved frame must come back, and the end must be reached.
      if (outs < n * 0.95 || last < dur - 1) { note('incomplete', { n, outs, last: +last.toFixed(2), dur: +dur.toFixed(2) }); throw { wc: true }; }
      mux.finalize();
    } finally { clearInterval(watch); try { v.pause(); } catch (e) {} v.playbackRate = 1; try { enc.close(); } catch (e) {} hide(); }
    if (!n) throw { wc: true };
    return new Blob([target.buffer], { type: 'video/mp4' });
  }

  // Method 2 (older devices): replay the video in real time into a recording. Slow devices can drop frames.
  async function record(v, onStep, maxPx, bps) {
    const dur = v.duration;
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) throw { msg: 'This device cannot shrink videos. ' + TRIM };
    const c = draw(v, v.videoWidth, v.videoHeight, maxPx), ctx = c.getContext('2d'), stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps }), parts = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    const stopped = new Promise(ok => { rec.onstop = ok; });
    await seek(v, 0);
    let live = true;
    const paint = () => { if (!live) return; ctx.drawImage(v, 0, 0, c.width, c.height); onStep('Shrinking the video: ' + Math.min(100, Math.round(v.currentTime / dur * 100)) + '%', v.currentTime / dur);
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(paint); else requestAnimationFrame(paint); };
    const hide = showLive(v);
    rec.start(1000); paint();
    let last = -1, still = 0, watch;
    try {
      await new Promise((ok, bad) => {
        v.onended = ok; v.onerror = () => bad({ msg: 'The video stopped while shrinking. Try again.' });
        // If the video stops moving for 15 seconds, give up with a clear way forward.
        watch = setInterval(() => { if (v.currentTime > last + 0.01) { last = v.currentTime; still = 0; } else if (++still >= 15) bad({ msg: 'This device stopped while shrinking the video. ' + TRIM }); }, 1000);
        const p = v.play(); if (p && p.catch) p.catch(() => bad({ msg: 'The video could not play to shrink it. Tap Upload again, or trim it in the Photos app first.' }));
      });
    } finally { clearInterval(watch); live = false; try { v.pause(); } catch (e) {} if (rec.state !== 'inactive') rec.stop(); await stopped; stream.getTracks().forEach(t => t.stop()); hide(); }
    const type = mime.split(';')[0];
    return { blob: new Blob(parts, { type }), ext: EXT[type], type };
  }

  // Shrink a video over 45 MB to 720p with a bit rate that lands under the limit. Sound is not kept.
  // If the first try is still too big, it tries once more at 480p.
  async function shrink(v, onStep) {
    const dur = v.duration;
    if (!(dur > 0) || dur > VIDEO_CAP_SEC) throw { msg: 'Videos over 45 MB must be 5 minutes or shorter. ' + TRIM };
    const bps = Math.max(400000, Math.min(2500000, Math.floor((40 * 1048576 * 8) / dur)));
    const tries = [[1280, bps], [854, Math.floor(bps / 2)]];
    if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && v.requestVideoFrameCallback && typeof Mp4Muxer !== 'undefined') {
      try {
        for (const [px, b] of tries) { const blob = await encodeFrames(v, onStep, px, b); if (blob.size <= MAX) return { blob, ext: 'mp4', type: 'video/mp4', method: 'frames' }; }
        throw { msg: 'Even shrunk, this video is over 45 MB. ' + TRIM };
      } catch (e) { if (e && e.msg) throw e; note('switching to replay', e && e.stall ? 'stalled' : 'error'); onStep('Shrinking the video another way...', 0); }   // any frame-by-frame problem falls back to method 2
    }
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw { msg: 'This video is over 45 MB and this device cannot shrink it. ' + TRIM };
    for (const [px, b] of tries) { const out = await record(v, onStep, px, b); if (out.blob.size <= MAX) return Object.assign(out, { method: 'replay' }); }
    throw { msg: 'Even shrunk, this video is over 45 MB. ' + TRIM };
  }

  async function video(f, onStep) {
    const u = URL.createObjectURL(f);
    try {
      const v = await openVideo(u), poster = await videoPoster(v), dur = v.duration || null;
      const type = (f.type || '').toLowerCase() === 'video/x-m4v' ? 'video/mp4' : (f.type || '').toLowerCase();
      if (f.size <= MAX && EXT[type]) return { blob: f, ext: EXT[type], type, poster, dur };
      if (f.size <= MAX && /\.mov$/i.test(f.name)) return { blob: f, ext: 'mov', type: 'video/quicktime', poster, dur };
      if (f.size <= MAX && /\.(mp4|m4v)$/i.test(f.name)) return { blob: f, ext: 'mp4', type: 'video/mp4', poster, dur };
      const out = await shrink(v, onStep);
      return Object.assign(out, { poster, dur, shrunk: true });
    } finally { URL.revokeObjectURL(u); }
  }

  function put(url, blob, type, onPct) {
    return new Promise((ok, bad) => { const x = new XMLHttpRequest();
      x.open('PUT', url); x.setRequestHeader('Content-Type', type); x.setRequestHeader('x-upsert', 'false');
      x.upload.onprogress = e => { if (e.lengthComputable) onPct(e.loaded / e.total); };
      x.onload = () => x.status >= 200 && x.status < 300 ? ok() : bad({ msg: 'The upload was refused (' + x.status + '). Try again.' });
      x.onerror = () => bad({ code: 'offline', msg: 'The upload lost its connection. Try again on Wi-Fi.' });
      x.send(blob); });
  }

  // Prepare and upload one file. Returns what the hub saves about it.
  async function upload(f, k, onStep) {
    const kind = kindOf(f);
    if (!kind) throw { msg: 'That file type is not allowed. Use a video, a photo or a PDF.' };
    onStep('Getting the file ready...', 0);
    let p;
    if (kind === 'photo') p = await photo(f);
    else if (kind === 'pdf') { if (f.size > PDF_MAX) throw { msg: 'PDFs can be up to 10 MB.' }; p = { blob: f, ext: 'pdf', type: 'application/pdf', poster: null }; }
    else p = await video(f, onStep);
    const u = await call('usage', k);
    if (u.used + p.blob.size > u.quota) throw { msg: 'The library is full (' + mb(u.used) + ' of ' + mb(u.quota) + '). Delete some old videos first.' };
    const s = await call('sign_upload', k, { ext: p.ext, size: p.blob.size });
    onStep('Uploading: 0%', 0);
    await put(s.signedUrl, p.blob, s.contentType, pct => onStep('Uploading: ' + Math.round(pct * 100) + '%', pct));
    return { path: s.path, type: kind, size: p.blob.size, poster: p.poster, dur: p.dur ? Math.round(p.dur) : null, shrunk: !!p.shrunk, method: p.method || null };
  }

  const links = {};
  async function link(k, path) {
    const hit = links[path];
    if (hit && hit.until > Date.now()) return hit.url;
    const d = await call('sign_read', k, { paths: [path] }), url = d.urls && d.urls[path];
    if (!url) throw { msg: 'That file is gone from the library.' };
    links[path] = { url, until: Date.now() + 50 * 60 * 1000 };
    return url;
  }
  const remove = (k, path) => call('delete', k, { path });
  const usage = k => call('usage', k);

  return { upload, link, remove, usage, kindOf, mb, MAX, trace };
})();
