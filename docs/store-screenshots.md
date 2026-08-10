# Store screenshot pipeline

This repository keeps the screenshot pipeline entrypoint and its default plan in
source control. The generated PNGs are intentionally ignored. The pipeline uses
[`asc screenshots`](https://github.com/rorkai/App-Store-Connect-CLI) for simulator
capture, framing, review, and App Store Connect upload.

## Requirements

Run the pipeline on macOS with:

- Xcode and an iOS Simulator (the command-line tools must be available through
  `xcodebuild` and `xcrun`)
- Node.js and the repository dependencies (`npm install`)
- CocoaPods (`brew install cocoapods`)
- App Store Connect CLI (`brew install asc`)
- Koubou 0.18.1 for framing:
  `python3 -m pip install --user koubou==0.18.1`
- ImageMagick for flattening framed PNGs:
  `brew install imagemagick`

Verify the two pipeline dependencies before starting:

```bash
asc screenshots --help
kou --version
kou setup-frames
```

`kou setup-frames` only needs to be run once per machine and may need network
access to download device frames. `asc` is maintained at
<https://github.com/rorkai/App-Store-Connect-CLI>; use its current release if
the Homebrew formula is unavailable.

The native `ios/` directory is ignored in this repository. On a fresh checkout,
the build command generates it with Expo prebuild and installs its CocoaPods
dependencies. Copy `.env.example` to `.env` and provide the app's normal Expo,
Supabase, and other runtime values before building.

## Commands

The runnable entrypoint is `scripts/store-screenshots.sh` and is also exposed
through npm scripts:

```bash
npm run screenshots:build
npm run screenshots:capture
npm run screenshots:frame
npm run screenshots:review
npm run screenshots:approve
npm run screenshots:upload
```

To run the complete local workflow through review:

```bash
npm run screenshots:all
```

The commands perform these steps:

1. `build` runs Expo prebuild when needed, runs `xcodebuild` for the `Vinesight`
   simulator target, installs the app, and launches it.
2. `capture` runs the tracked `.asc/screenshots.json` plan with
   `asc screenshots run`.
3. `frame` converts every PNG in `screenshots/raw/` into a device-framed PNG in
   `screenshots/framed/` using the pinned Koubou version, then composites each
   output onto the configured opaque background.
4. `review` writes an HTML review and manifest to `screenshots/review/`.
   Set `OPEN_REVIEW=1` to open the report automatically.
5. `approve` records the reviewed files as ready for upload.
6. `upload` sends the framed files to App Store Connect. Use
   `UPLOAD_DRY_RUN=1` to validate the upload without changing App Store Connect.

The default simulator is the iPhone 17 Pro Max with UDID
`55FFD765-28F0-434B-A873-9087E8A06C39`. Override it with an explicit UDID
when using another simulator:

```bash
IOS_SIMULATOR_UDID="SIMULATOR-UDID" npm run screenshots:build
IOS_SIMULATOR_UDID="SIMULATOR-UDID" npm run screenshots:capture
```

The native project, bundle ID, paths, device type, and upload defaults are
tracked in `.asc/shots.settings.json`. The shell entrypoint also accepts these
environment overrides: `APP_BUNDLE_ID`, `IOS_WORKSPACE`, `IOS_SCHEME`,
`IOS_CONFIGURATION`, `IOS_DERIVED_DATA`, `SCREENSHOTS_RAW_DIR`,
`SCREENSHOTS_FRAMED_DIR`, `SCREENSHOTS_REVIEW_DIR`,
`SCREENSHOTS_FRAME_DEVICE`, `SCREENSHOTS_FRAME_BACKGROUND`, and
`SCREENSHOTS_DEVICE_TYPE`. Framing composites each output onto the configured
background (default `#FFFFFF`) and writes an opaque 8-bit RGB PNG. Review,
approval, and upload stop if any framed PNG is transparent or is not an 8-bit
RGB PNG.

## Capture plan

`.asc/screenshots.json` is the tracked five-image gallery plan. It expects an
authenticated fixture account containing the seeded `Sassy` farm, then navigates
through Farming, farm detail, Reports, Home, and AI Assistant. The plan records
the approved screenshot names, captions, and layout roles alongside the
executable steps. Supported plan actions are `launch`, `tap`, `type`, `wait`,
`wait_for`, and `screenshot`; keep each screenshot step named and deterministic.
Re-run `npm run screenshots:capture` to regenerate the complete gallery.

Use the `asc screenshots run --help` output for the current plan schema and
flags. Re-run `npm run screenshots:capture` after changing the plan; raw output
is written to `screenshots/raw/`.

## App Store Connect credentials and upload targets

Capture, frame, and review do not require App Store Connect credentials. Upload
does. Configure the CLI once on the release operator's machine:

```bash
asc auth login
asc auth status
```

Use an App Store Connect API key with permission to modify screenshots for this
app. `asc` stores credentials in the system keychain when available; environment
variables and a repo-local `.asc/config.json` are supported by the CLI as
fallbacks. Never commit API private keys or `.asc/config.json` containing
secrets.

For a single localization, provide its App Store version localization resource
ID (not a locale code):

```bash
VERSION_LOCALIZATION_ID="..." npm run screenshots:upload
```

Alternatively, let `asc` resolve the version and localization fan-out from the
App Store Connect app ID and version string:

```bash
APP_STORE_APP_ID="..." APP_STORE_VERSION="3.3.25" npm run screenshots:upload
```

The default upload device type is `IPHONE_69` for the 6.9-inch gallery; override
it with `SCREENSHOTS_DEVICE_TYPE` when the framed set targets another supported
device.
Use `asc localizations list --version VERSION_ID --output json` to resolve
localization IDs and `asc screenshots sizes` to check Apple’s current size
requirements before upload.

### Google Play handoff

`asc` uploads only to App Store Connect. For Google Play, run the same
build/capture/frame/review flow, verify the final PNG dimensions and copy the
approved files from `screenshots/framed/` into the Google Play Console manually.
This repository does not store Google Play credentials or automate Play Console
uploads. The generated directory is ignored, so retain or archive the approved
PNG set outside Git if it must be reused for a later release.

## Generated files

The following paths are generated and ignored by Git:

- `screenshots/raw/` — simulator captures
- `screenshots/framed/` — Koubou-framed output used for upload
- `screenshots/review/` — review HTML, manifest, and approval state
- `.build/screenshots/` — Xcode-derived data
- `ios/` — Expo-generated native project

Review the generated artifacts before approving or uploading them. The local
capture and framing commands are experimental features of `asc`; if a command
changes, check `asc screenshots --help` first.
