// Captures the tab, plays it back so it stays audible, and starts recording at the first sound.
// The recorder hears the audio LEAD seconds late, so the first note isn't clipped by the
// time it takes to notice the sound.

const LEAD = 0.25; // seconds; several detection ticks of slack
const TICK = 20; // ms between sound checks
const THRESHOLD = 0.001; // peak level; tab silence is exact zeros, so anything audible clears this

// AAC in MP4 plays everywhere. Browsers without an AAC encoder (some Linux builds) get WebM;
// plain 'audio/mp4' isn't a fallback, since it can mean Opus in a .m4a that players reject.
const TYPES = [
  ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
  ['audio/webm;codecs=opus', 'webm'],
];

let stream, ctx, recorder, timer, title, stopping;
const chunks = [];

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.to !== 'offscreen') return;
  if (msg.type === 'start') {
    title = msg.title;
    start(msg.streamId).catch(() => send({ type: 'failed' }));
  }
  if (msg.type === 'stop') stop();
});

async function start(streamId) {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });
  stream.getAudioTracks()[0].addEventListener('ended', stop); // tab closed

  ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  source.connect(ctx.destination); // capturing mutes the tab; route it back to the speakers

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = LEAD;
  const out = ctx.createMediaStreamDestination();
  source.connect(delay).connect(out);

  const [mimeType, ext] = TYPES.find(([t]) => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(out.stream, { mimeType, audioBitsPerSecond: 256000 });
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
    send({ type: 'done', url, ext, title });
  };

  const buf = new Float32Array(analyser.fftSize);
  timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    if (!buf.some((v) => Math.abs(v) > THRESHOLD)) return;
    clearInterval(timer);
    recorder.start(1000);
    const began = Date.now();
    const tick = () => send({ type: 'tick', seconds: Math.floor((Date.now() - began) / 1000) });
    tick();
    timer = setInterval(tick, 1000);
  }, TICK);
}

function stop() {
  if (stopping) return; // a second click while the tail drains
  stopping = true;
  clearInterval(timer);
  stream?.getTracks().forEach((t) => t.stop());
  if (recorder?.state === 'recording') {
    send({ type: 'saving' });
    // Let the delayed tail reach the recorder before cutting it.
    setTimeout(() => {
      recorder.stop();
      ctx.close();
    }, LEAD * 1000 + 100);
  } else {
    ctx?.close();
    send({ type: 'done' });
  }
}

function send(msg) {
  chrome.runtime.sendMessage({ to: 'background', ...msg });
}
