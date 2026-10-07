// One recording at a time. Click arms it (recording waits for sound), click again saves it.
// The capture runs in an offscreen document, since service workers have no audio APIs.
// The worker can be killed mid-recording, so it keeps no state: the offscreen document existing
// means a recording is armed or running, and the title rides along in the messages.

chrome.action.onClicked.addListener(toggle);

async function toggle(tab) {
  if (await recorderOpen()) return chrome.runtime.sendMessage({ to: 'offscreen', type: 'stop' });

  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Record tab audio',
    });
    chrome.runtime.sendMessage({ to: 'offscreen', type: 'start', streamId, title: tab.title });
    look('armed');
  } catch {
    // Browser pages (settings, the extension store) can't be captured, nor can a tab another app is capturing.
    cantRecord();
  }
}

async function recorderOpen() {
  const [open] = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return Boolean(open);
}

async function cantRecord() {
  look('error');
  await new Promise((wait) => setTimeout(wait, 3000));
  if (!(await recorderOpen())) look('idle');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.to !== 'background') return;
  if (msg.type === 'tick') look('recording', clock(msg.seconds));
  if (msg.type === 'saving') look('saving');
  if (msg.type === 'done') {
    if (msg.url) save(msg.url, msg.title, msg.ext);
    else finish(); // stopped before any sound: nothing to save
  }
  if (msg.type === 'failed') {
    chrome.offscreen.closeDocument().catch(() => {});
    cantRecord();
  }
});

async function save(url, title, ext) {
  let id;
  try {
    id = await chrome.downloads.download({ url, filename: `${fileName(title)}.${ext}` });
  } catch {
    // Chrome rejects some names fileName doesn't catch. Losing the title beats losing the recording.
    id = await chrome.downloads.download({ url, filename: `${fileName()}.${ext}` });
  }
  // The blob URL lives in the offscreen document, so keep it open until the file is written.
  chrome.downloads.onChanged.addListener(function onChange(d) {
    if (d.id !== id || !d.state || d.state.current === 'in_progress') return;
    chrome.downloads.onChanged.removeListener(onChange);
    finish();
  });
}

function finish() {
  chrome.offscreen.closeDocument().catch(() => {});
  look('idle');
}

function fileName(title) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
  const clean = (title || '')
    .replace(/[\p{Cc}\\/:*?"<>|~]/gu, ' ')
    // Chrome rejects names with invisible marks (RTL marks, the joiners inside emoji like 👩‍💻) or a leading dot.
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+/, '');
  // Cut by code point so an emoji isn't split in half.
  const short = [...clean].slice(0, 80).join('').trim();
  return `${short || 'Tab audio'} ${stamp}`;
}

// Badge text fits about 4 characters before the browser clips it, hence the coarser
// steps once a recording passes 10 minutes and an hour.
function clock(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = String(seconds % 60).padStart(2, '0');
  if (h) return `${h}h${String(m).padStart(2, '0')}`;
  if (m < 10) return `${m}:${s}`;
  return `${m}m`;
}

const ICON = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' };
const RED = { 16: 'icons/recording-16.png', 32: 'icons/recording-32.png' };
const LOOKS = {
  idle: { icon: ICON, text: '', color: '#000', tip: "Record this tab's audio" },
  armed: { icon: ICON, text: 'ON', color: '#d97706', tip: 'Waiting for sound. Click to cancel.' },
  recording: { icon: RED, color: '#18181b', tip: 'Recording. Click to stop and save.' },
  saving: { icon: RED, text: '...', color: '#18181b', tip: 'Saving' },
  error: { icon: ICON, text: '!', color: '#dc2626', tip: "Can't record this page. Try a regular website tab." },
};

function look(name, text = LOOKS[name].text) {
  chrome.action.setIcon({ path: LOOKS[name].icon });
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: LOOKS[name].color });
  chrome.action.setTitle({ title: LOOKS[name].tip });
}
