# Tab Audio Recorder

Manifest V3 extension for Chromium browsers that records a tab's audio to M4A. One button, no options. The extension is the plain files in `extension/`, with no build step and no runtime dependencies.

## Rules

- Keep it one button. Push back on new UI, options, or permissions.
- No network requests, analytics, or remote code.
- The README is for non-technical users. Keep it short, neutral, and professional.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`).
- No em or en dashes.
- Ask before adding a dependency or permission, or pushing a tag (it publishes a release).

## Commands

```sh
npm test                                # end-to-end: records a tone in a real browser
npm test -- "/path/to/Brave Browser"    # same, in another Chromium browser
```

Run `npm test` outside the macOS sandbox, since Chromium can't start inside it. Icons are generated from `assets/*.svg` by `assets/build-icons.sh`.

To release, bump the version in `extension/manifest.json` and `package.json`, add a `CHANGELOG.md` section, and push tag `vX.Y.Z`.

## Gotchas

- The tab title needs `activeTab`. With only `tabCapture`, Chrome hides it.
- Chrome rejects download names with control characters, invisible marks (RTL marks, emoji joiners), or a leading dot. `fileName()` strips them, and the test's page title checks this.
- The background worker keeps no state, since it can be killed mid-recording. An open offscreen document means a recording is running.
