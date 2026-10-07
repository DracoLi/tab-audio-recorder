// End-to-end test: loads the extension into a throwaway Chromium profile, plays 1s of silence
// then a 2s 440 Hz tone in a tab, clicks the extension, stops after a few seconds, and checks
// the saved file really holds the tone.
// Run: npm test. Pass a browser path to test another Chromium browser, e.g.
//   npm test -- "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const extension = resolve(import.meta.dirname, '../extension');
const dir = mkdtempSync(join(tmpdir(), 'tab-audio-recorder-'));
const tonePage = join(dir, 'tone.html');
// The title has a leading dot, an RTL mark, and a joined emoji, all of which Chrome rejects in file names.
writeFileSync(tonePage, `<title>.Test Tone &#x200F;👩&#x200D;💻</title><script>
  const ctx = new AudioContext();
  setTimeout(() => {
    const o = ctx.createOscillator();
    o.frequency.value = 440;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 2);
  }, 1000);
</script>`);

// Unpacked extension IDs come from a hash of the folder path.
function extensionId(path) {
  const hex = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

const browserPath = process.argv[2];
const context = await chromium.launchPersistentContext(join(dir, 'profile'), {
  ...(browserPath ? { executablePath: browserPath, headless: false } : { channel: 'chromium' }),
  ignoreDefaultArgs: ['--mute-audio'], // a muted tab gives tab capture nothing to record
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    '--autoplay-policy=no-user-gesture-required',
    // Lets tabCapture start without a real toolbar click, which automation can't make.
    `--allowlisted-extension-id=${extensionId(extension)}`,
  ],
});

try {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const tab = await context.newPage();
  await tab.goto(`file://${tonePage}`);
  const badge = () => worker.evaluate(() => chrome.action.getBadgeText({}));

  // Stands in for the toolbar click: calls the same handler with the active tab. A real click
  // grants activeTab, which shows the handler the tab's title, so the title is filled in here.
  const click = async () =>
    worker.evaluate(async (title) => {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await toggle({ ...active, title });
    }, await tab.title());

  // Playwright saves downloads under random names, so note the names Chrome accepts instead.
  await worker.evaluate(() => {
    const download = chrome.downloads.download;
    self.savedNames = [];
    chrome.downloads.download = (options) => download(options).then((id) => (savedNames.push(options.filename), id));
  });

  await click();
  assert.equal(await badge(), 'ON', 'armed and waiting for sound');
  await tab.waitForTimeout(600);
  assert.equal(await badge(), 'ON', 'still waiting during the silence');
  await tab.waitForTimeout(1600);
  assert.match(await badge(), /^0:0[01]$/, 'recording, with the timer running');
  await tab.waitForTimeout(2300);
  await click();

  const download = await worker.evaluate(
    () =>
      new Promise((done) => {
        const check = async () => {
          const [d] = await chrome.downloads.search({});
          if (d && d.state !== 'in_progress') done(d);
          else setTimeout(check, 100);
        };
        check();
      }),
  );
  assert.equal(download.state, 'complete');
  const [savedName] = await worker.evaluate(() => savedNames);
  assert.match(savedName, /^Test Tone 👩💻 \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.(m4a|webm)$/, 'named after the tab');
  assert.equal(await badge(), '', 'back to idle after saving');

  // Decode the saved file in the browser and look at what's in it.
  const bytes = readFileSync(download.filename).toString('base64');
  const audio = await tab.evaluate(async (b64) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    const buf = await new AudioContext().decodeAudioData(data);
    const x = buf.getChannelData(0);
    const loud = x.findIndex((v) => Math.abs(v) > 0.1);
    let last = x.length - 1;
    while (last > 0 && Math.abs(x[last]) <= 0.1) last--;
    let crossings = 0;
    for (let i = loud + 1; i < last; i++) if (x[i - 1] < 0 && x[i] >= 0) crossings++;
    const toneSeconds = (last - loud) / buf.sampleRate;
    return { duration: buf.duration, start: loud / buf.sampleRate, toneSeconds, hz: crossings / toneSeconds };
  }, bytes);

  assert.ok(audio.start > 0.05 && audio.start < 0.5, `lead-in before the first sound (${audio.start.toFixed(2)}s)`);
  assert.ok(Math.abs(audio.toneSeconds - 2) < 0.1, `the whole 2s tone is there (${audio.toneSeconds.toFixed(2)}s)`);
  assert.ok(Math.abs(audio.hz - 440) < 5, `it's the 440 Hz tone (${audio.hz.toFixed(0)} Hz)`);
  console.log(`ok: ${download.mime}, ${audio.duration.toFixed(2)}s long, ${audio.toneSeconds.toFixed(2)}s of ${audio.hz.toFixed(0)} Hz starting at ${audio.start.toFixed(2)}s`);
} finally {
  await context.close();
}
