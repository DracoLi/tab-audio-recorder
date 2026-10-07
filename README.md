<p align="center"><img src="assets/icon.svg" width="96" alt="Tab Audio Recorder icon"></p>

<h1 align="center">Tab Audio Recorder</h1>

<p align="center">
  Record the audio playing in any browser tab and save it as an M4A file.<br>
  If it plays in a tab, you can keep it, even when the site has no download button.
</p>

<p align="center">
  <a href="https://github.com/DracoLi/tab-audio-recorder/releases/latest"><img src="https://img.shields.io/github/v/release/DracoLi/tab-audio-recorder?label=download" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/DracoLi/tab-audio-recorder" alt="MIT license"></a>
</p>

A free, open source Chrome extension for recording audio from a website. It also works in Brave, Edge, Arc, Opera, Vivaldi, and other Chromium browsers on Mac, Windows, Linux, and ChromeOS. Record music, podcasts, lectures, webinars, meetings, livestreams, web radio, or anything else you can hear in a tab. It captures the tab's internal audio directly, not through your mic, so the recording sounds exactly like what's playing.

- **One click.** Click the icon, play something, click again. The file lands in your Downloads.
- **Any site.** Download button or not, if it plays in a tab, you can record it.
- **Starts with the sound.** It waits for audio before recording, so there's no dead air at the start.
- **You keep hearing it.** Audio plays normally while it records.
- **Just that tab.** Your mic, notifications, and other tabs aren't recorded.
- **Private.** No account, no servers, no tracking. Nothing leaves your computer.

## Install

It takes about two minutes. It isn't in the Chrome Web Store yet, so you add it with Developer mode, a built-in browser setting for adding extensions from outside the store.

1. **[Download tab-audio-recorder.zip](https://github.com/DracoLi/tab-audio-recorder/releases/latest/download/tab-audio-recorder.zip)** and unzip it. On a Mac, double-click the zip. On Windows, right-click it and choose **Extract All**.
2. Move the unzipped `tab-audio-recorder` folder somewhere it can stay, like your Documents folder. The browser runs the extension from this folder, so don't delete it.
3. Open your browser's extensions page. Copy the address for your browser, paste it into the address bar, and press Enter:

   | Browser | Address |
   | --- | --- |
   | Chrome, Arc | `chrome://extensions` |
   | Brave | `brave://extensions` |
   | Edge | `edge://extensions` |
   | Opera | `opera://extensions` |
   | Vivaldi | `vivaldi://extensions` |

4. Turn on **Developer mode**. It's a switch at the top right of the page (in Edge, it's on the left).
5. Click **Load unpacked** and choose the `tab-audio-recorder` folder.
6. Click the puzzle piece icon in the toolbar, then click the pin next to **Tab Audio Recorder** so its icon stays visible.

**Seeing "Manifest file is missing or unreadable"?** You picked the wrong folder. Choose the folder that has `manifest.json` directly inside it.

### Updating

To get notified of new versions, click **Watch** at the top of this page, then **Custom**, then **Releases**. To update:

1. Download the new zip and unzip it.
2. Replace the contents of your old `tab-audio-recorder` folder with the new files.
3. On the extensions page, click the reload icon (↻) on **Tab Audio Recorder**.

## Use

1. Go to the tab with the audio and click the icon.
2. Play the audio. Recording starts on its own when sound starts.
3. Click the icon again to stop. The file saves to your Downloads, named after the tab, like `Song Title - YouTube 2026-10-07 14.30.05.m4a`.

The icon shows what it's doing:

| <img src="assets/state-idle.png" width="42" alt=""> | <img src="assets/state-waiting.png" width="42" alt=""> | <img src="assets/state-recording.png" width="42" alt=""> | <img src="assets/state-saving.png" width="42" alt=""> |
| :-: | :-: | :-: | :-: |
| Ready | Waiting for sound | Recording, with time | Saving |

You can switch tabs while it records. It keeps recording the tab you started on, and you can click the icon from any tab to stop. If you close the tab, it saves what it has.

It can't record the browser's own pages, like settings or the extension store. Click it there and the icon shows **!** for a moment.

## FAQ

**Where's my recording?** In your Downloads folder, unless your browser is set to ask where to save each file.

**Does my volume matter?** Your computer's volume doesn't, so you can turn it down or mute your speakers while it records. The site's own volume slider does, so leave that up.

**Can I get an MP3?** It saves M4A (AAC), which plays everywhere: Windows, Mac, iPhone, Android, VLC, iTunes, and Music. If you need MP3, any audio converter can do it.

**What quality is it?** 256 kbps AAC, stereo, 48 kHz. That's about 2 MB per minute.

**Which browsers are tested?** Chromium and Brave, by the automated test. Chrome, Edge, Arc, Opera, and Vivaldi use the same extension system, so they should work too. If one doesn't, [open an issue](https://github.com/DracoLi/tab-audio-recorder/issues).

**Does it work in Firefox or Safari?** No. They don't let extensions capture a tab's audio.

**Does it work on Netflix, Spotify, or other protected sites?** Maybe not. Some sites protect their audio, and then the recording may come out silent.

**Can I record two tabs at once?** No, one recording at a time.

**Is it safe?** The code is short and readable: [`background.js`](extension/background.js) and [`offscreen.js`](extension/offscreen.js) are about 200 lines together. It makes no network requests and asks for four permissions, none of which show a warning when you install it:

- `activeTab` and `tabCapture`: hear the tab you clicked on and read its title for the file name, only after you click.
- `offscreen`: a hidden page to do the recording in, because extensions can't record audio in the background otherwise.
- `downloads`: save the file.

**Can I record anything?** It's a general-purpose recorder, like holding a mic up to your speakers. Whether a recording is OK depends on what it is, where you live, and the site's terms. Only record what you have the right to record. You're responsible for how you use it.

## How it works

Clicking the icon uses Chrome's [`tabCapture`](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) API to get the tab's audio stream, which is handed to an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen). There, Web Audio plays the stream back to your speakers (capturing a tab mutes it otherwise) and watches the level. At the first sound, a [`MediaRecorder`](https://developer.mozilla.org/docs/Web/API/MediaRecorder) starts encoding AAC into an MP4 container. The recorder hears the audio a quarter second late, through a delay node, so the first note isn't cut off while the sound is detected. Clicking again stops the recorder and saves the file with the [`downloads`](https://developer.chrome.com/docs/extensions/reference/api/downloads) API.

If the browser can't encode MP4 audio, it falls back to WebM (Opus).

## Development

No build step. The extension is the plain files in [`extension/`](extension). Load that folder with **Load unpacked** and click the reload icon on the extensions page after editing.

```sh
npm install
npx playwright install chromium
npm test                # records a test tone and checks the saved file
assets/build-icons.sh   # re-renders the icons from the SVGs (needs librsvg and ImageMagick)
```

`npm test` plays one second of silence and then a 2 second 440 Hz tone in a tab, records it, and checks the saved file holds exactly that tone. To run it in another Chromium browser, pass its path: `npm test -- "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`.

To release, bump `version` in [`extension/manifest.json`](extension/manifest.json), add a section to [`CHANGELOG.md`](CHANGELOG.md), and push a matching tag like `v1.0.1`. The [release workflow](.github/workflows/release.yml) builds the zip and publishes it.

Issues and pull requests are welcome. The goal is to keep it to one button that just works, so new options are a hard sell.

## License

[MIT](LICENSE)
