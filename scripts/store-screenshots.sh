#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && /bin/pwd -P)"
cd "$ROOT_DIR"

log() { printf '\n[screenshots] %s\n' "$*"; }
die() { printf '\n[screenshots] error: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required; see docs/store-screenshots.md"; }

require_command node

SETTINGS_FILE="${SCREENSHOTS_SETTINGS_FILE:-.asc/shots.settings.json}"
[[ -f "$SETTINGS_FILE" ]] || die "screenshot settings not found: $SETTINGS_FILE"

setting() {
  local path="$1" fallback="$2"
  node -e '
    const fs = require("node:fs");
    const [file, settingPath, fallback] = process.argv.slice(1);
    const settings = JSON.parse(fs.readFileSync(file, "utf8"));
    const value = settingPath.split(".").reduce((current, key) => current?.[key], settings);
    process.stdout.write(value == null || value === "" ? fallback : String(value));
  ' "$SETTINGS_FILE" "$path" "$fallback"
}

BUNDLE_ID="${APP_BUNDLE_ID:-$(setting app.bundle_id com.vinesight.ios)}"
WORKSPACE="${IOS_WORKSPACE:-$(setting app.project ios/Vinesight.xcworkspace)}"
SCHEME="${IOS_SCHEME:-$(setting app.scheme Vinesight)}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
DERIVED_DATA="${IOS_DERIVED_DATA:-.build/screenshots/DerivedData}"
PLAN_FILE="${SCREENSHOTS_PLAN:-$(setting paths.plan .asc/screenshots.json)}"
PLAN_FILE="$(node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1]));' "$PLAN_FILE")"
[[ -f "$PLAN_FILE" ]] || die "screenshot plan not found: $PLAN_FILE"
RAW_DIR="${SCREENSHOTS_RAW_DIR:-$(setting paths.raw_dir ./screenshots/raw)}"
FRAMED_DIR="${SCREENSHOTS_FRAMED_DIR:-$(setting paths.framed_dir ./screenshots/framed)}"
REVIEW_DIR="${SCREENSHOTS_REVIEW_DIR:-$(setting paths.review_dir ./screenshots/review)}"
FRAME_DEVICE="${SCREENSHOTS_FRAME_DEVICE:-$(setting pipeline.frame_device iphone-17-pro-max)}"
FRAME_BACKGROUND="${SCREENSHOTS_FRAME_BACKGROUND:-$(setting pipeline.frame_background '#FFFFFF')}"
CAPTION_COLOR="${SCREENSHOTS_CAPTION_COLOR:-$(setting pipeline.caption_color '#173D2D')}"
CAPTION_FONT="${SCREENSHOTS_CAPTION_FONT:-$(setting pipeline.caption_font /System/Library/Fonts/SFNS.ttf)}"
DEVICE_TYPE="${SCREENSHOTS_DEVICE_TYPE:-$(setting upload.device_type IPHONE_69)}"
LOCALE="${SCREENSHOTS_LOCALE:-$(setting pipeline.locale en-US)}"
REQUESTED_UDID="${IOS_SIMULATOR_UDID:-$(setting app.simulator_udid booted)}"
SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-$(setting app.simulator_name 'iPhone 17 Pro Max')}"
GENERATED_ROOT_PATH="$ROOT_DIR/screenshots"
[[ ! -L "$GENERATED_ROOT_PATH" ]] || die "generated root cannot be a symbolic link: $GENERATED_ROOT_PATH"
mkdir -p "$GENERATED_ROOT_PATH"
GENERATED_ROOT="$(node -e 'const fs = require("node:fs"); process.stdout.write(fs.realpathSync(process.argv[1]));' "$GENERATED_ROOT_PATH")"
ACTIVE_STAGE=""
ACTIVE_TARGET=""
ACTIVE_BACKUP=""

cleanup_stage() {
  if [[ -n "$ACTIVE_BACKUP" && -e "$ACTIVE_BACKUP" ]]; then
    if [[ -n "$ACTIVE_TARGET" && ! -e "$ACTIVE_TARGET" ]]; then
      mv "$ACTIVE_BACKUP" "$ACTIVE_TARGET"
    else
      rm -rf -- "$ACTIVE_BACKUP"
    fi
  fi
  if [[ -n "$ACTIVE_STAGE" && -d "$ACTIVE_STAGE" ]]; then
    rm -rf -- "$ACTIVE_STAGE"
  fi
}
trap cleanup_stage EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

validate_locale() {
  [[ "$LOCALE" =~ ^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$ ]] || die "invalid screenshot locale: $LOCALE"
}

resolve_generated_target() {
  local candidate="$1" resolved
  [[ -n "$candidate" ]] || die 'generated directory path cannot be empty'
  resolved="$(node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const [candidate, root] = process.argv.slice(1);
    const target = path.resolve(candidate);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      process.exit(2);
    }

    let current = root;
    for (const component of relative.split(path.sep).slice(0, -1)) {
      current = path.join(current, component);
      if (!fs.existsSync(current)) break;
      if (fs.lstatSync(current).isSymbolicLink()) process.exit(3);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    const realParent = fs.realpathSync(path.dirname(target));
    const realRelative = path.relative(root, realParent);
    if (realRelative.startsWith(`..${path.sep}`) || realRelative === ".." || path.isAbsolute(realRelative)) {
      process.exit(4);
    }
    process.stdout.write(path.join(realParent, path.basename(target)));
  ' "$candidate" "$GENERATED_ROOT")" || die "generated paths must be non-symlinked descendants of $GENERATED_ROOT: $candidate"
  [[ ! -L "$resolved" ]] || die "generated path cannot be a symbolic link: $candidate"
  printf '%s\n' "$resolved"
}

RAW_DIR="$(resolve_generated_target "$RAW_DIR")"
FRAMED_DIR="$(resolve_generated_target "$FRAMED_DIR")"
REVIEW_DIR="$(resolve_generated_target "$REVIEW_DIR")"
[[ "$RAW_DIR" != "$FRAMED_DIR" && "$RAW_DIR" != "$REVIEW_DIR" && "$FRAMED_DIR" != "$REVIEW_DIR" ]] || die 'raw, framed, and review directories must be distinct'

create_stage() {
  local target="$1" parent base
  parent="$(dirname "$target")"
  base="$(basename "$target")"
  mkdir -p "$parent"
  ACTIVE_STAGE="$(mktemp -d "$parent/.${base}.staging.XXXXXX")"
}

publish_stage() {
  local target stage backup
  target="$1"
  stage="$ACTIVE_STAGE"
  backup="${target}.backup.$$"
  [[ -n "$stage" && -d "$stage" ]] || die "no staged output available for $target"
  [[ ! -e "$backup" ]] || die "backup path already exists: $backup"
  ACTIVE_TARGET="$target"
  ACTIVE_BACKUP="$backup"

  if [[ -e "$target" ]]; then
    mv "$target" "$backup"
  fi

  if mv "$stage" "$target"; then
    ACTIVE_STAGE=""
    rm -rf -- "$backup"
    ACTIVE_TARGET=""
    ACTIVE_BACKUP=""
    return
  fi

  if [[ -e "$backup" ]]; then
    mv "$backup" "$target"
  fi
  ACTIVE_TARGET=""
  ACTIVE_BACKUP=""
  die "could not publish staged output to $target"
}

validate_gallery_set() {
  local directory="$1"
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const [planPath, directory] = process.argv.slice(1);
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const expected = (plan.gallery ?? []).map((entry) => entry.name).sort();
    if (expected.length === 0 || new Set(expected).size !== expected.length) {
      console.error("screenshot gallery names must be non-empty and unique");
      process.exit(1);
    }
    const collect = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) return collect(child);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".png")
        ? [path.basename(entry.name, path.extname(entry.name))]
        : [];
    });
    const actual = collect(directory).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`screenshot set mismatch\nexpected: ${expected.join(", ")}\nactual:   ${actual.join(", ")}`);
      process.exit(1);
    }
  ' "$PLAN_FILE" "$directory" || die "screenshot output does not match the gallery in $PLAN_FILE"
}

resolve_udid() {
  require_command xcrun
  local devices_json udid state
  devices_json="$(xcrun simctl list devices available -j)"
  read -r udid state < <(printf '%s' "$devices_json" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const [requested, preferredName] = process.argv.slice(1);
      const values = Object.values(JSON.parse(input).devices ?? {}).flat();
      const available = values.filter((device) => device.isAvailable !== false);
      let selected;
      if (requested !== "booted") {
        selected = available.find((device) => device.udid === requested);
      } else {
        selected = available.find((device) => device.name === preferredName && device.state === "Booted")
          ?? available.find((device) => device.name?.startsWith("iPhone") && device.state === "Booted")
          ?? available.find((device) => device.name === preferredName);
      }
      if (!selected) process.exit(1);
      process.stdout.write(`${selected.udid} ${selected.state}\n`);
    });
  ' "$REQUESTED_UDID" "$SIMULATOR_NAME") || die "no available '$SIMULATOR_NAME' simulator found; set IOS_SIMULATOR_UDID or IOS_SIMULATOR_NAME"

  if [[ "$state" != 'Booted' ]]; then
    xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  fi
  xcrun simctl bootstatus "$udid" -b >/dev/null
  printf '%s\n' "$udid"
}

ensure_ios_project() {
  if [[ -d "$WORKSPACE" ]]; then
    return
  fi

  require_command npx
  log 'Generating the ignored iOS project with Expo prebuild'
  npx expo prebuild --platform ios --no-install
  [[ -d "$WORKSPACE" ]] || die "Expo prebuild did not create $WORKSPACE"
}

install_pods() {
  if [[ -d ios/Pods ]]; then
    return
  fi
  require_command pod
  log 'Installing CocoaPods dependencies'
  (cd ios && pod install)
}

build() {
  require_command xcodebuild
  ensure_ios_project
  install_pods

  local udid app_path
  udid="$(resolve_udid)"

  log "Building $SCHEME for simulator $udid"
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -destination "platform=iOS Simulator,id=$udid" \
    -derivedDataPath "$DERIVED_DATA" \
    build

  app_path="$(find "$DERIVED_DATA/Build/Products" -type d -name "$SCHEME.app" -print -quit)"
  [[ -n "$app_path" ]] || die "could not find $SCHEME.app under $DERIVED_DATA/Build/Products"

  xcrun simctl install "$udid" "$app_path"
  xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  printf '\nBuilt and launched %s on simulator %s\n' "$BUNDLE_ID" "$udid"
}

capture() {
  require_command asc
  local udid stage
  udid="$(resolve_udid)"
  create_stage "$RAW_DIR"
  stage="$ACTIVE_STAGE"

  log "Capturing the plan in $PLAN_FILE"
  asc screenshots run \
    --plan "$PLAN_FILE" \
    --bundle-id "$BUNDLE_ID" \
    --udid "$udid" \
    --output-dir "$stage" \
    --output json \
    --pretty

  validate_gallery_set "$stage"
  publish_stage "$RAW_DIR"
}

compose_caption() {
  local input="$1" screenshot_id title subtitle width height device_width device_height
  local title_size subtitle_size title_offset subtitle_offset device_offset temporary
  screenshot_id="$(basename "$input" .png)"
  title="$(node -e '
    const plan = require(process.argv[1]);
    const item = plan.gallery?.find((entry) => entry.name === process.argv[2]);
    if (!item?.caption?.title) process.exit(1);
    process.stdout.write(item.caption.title);
  ' "$PLAN_FILE" "$screenshot_id")" || die "missing title for $screenshot_id in $PLAN_FILE"
  subtitle="$(node -e '
    const plan = require(process.argv[1]);
    const item = plan.gallery?.find((entry) => entry.name === process.argv[2]);
    if (!item?.caption?.subtitle) process.exit(1);
    process.stdout.write(item.caption.subtitle);
  ' "$PLAN_FILE" "$screenshot_id")" || die "missing subtitle for $screenshot_id in $PLAN_FILE"

  width="$(magick identify -format '%w' "$input")"
  height="$(magick identify -format '%h' "$input")"
  device_width=$((width * 86 / 100))
  device_height=$((height * 76 / 100))
  title_size=$((width * 5 / 100))
  subtitle_size=$((width * 5 / 100))
  title_offset=$((height * 5 / 100))
  subtitle_offset=$((title_offset + title_size * 13 / 10))
  device_offset=$((height * 2 / 100))
  temporary="$(mktemp "${input}.XXXXXX")"

  if ! magick \
    -size "${width}x${height}" "xc:$FRAME_BACKGROUND" \
    -font "$CAPTION_FONT" -fill "$CAPTION_COLOR" -gravity north \
    -pointsize "$title_size" -annotate "+0+$title_offset" "$title" \
    -pointsize "$subtitle_size" -annotate "+0+$subtitle_offset" "$subtitle" \
    \( "$input" -resize "${device_width}x${device_height}>" \) \
    -gravity south -geometry "+0+$device_offset" -composite \
    -alpha off -depth 8 -type TrueColor "PNG24:$temporary"; then
    rm -f "$temporary"
    die "could not compose captioned screenshot $input"
  fi

  mv -f "$temporary" "$input"
}

validate_opaque_pngs() {
  local directory="$1" found=0 input channels depth lower_channels
  while IFS= read -r -d '' input; do
    found=1
    channels="$(magick identify -format '%[channels]' "$input")" || die "could not inspect framed PNG $input"
    depth="$(magick identify -format '%[depth]' "$input")" || die "could not inspect framed PNG $input"
    lower_channels="$(printf '%s' "$channels" | tr '[:upper:]' '[:lower:]')"
    [[ "$lower_channels" != *a* ]] || die "framed PNG still has an alpha channel: $input"
    [[ "$lower_channels" == *rgb* && "$depth" == '8' ]] || die "framed PNG is not an opaque 24-bit RGB PNG: $input"
  done < <(find "$directory" -type f -name '*.png' -print0 | sort -z)

  (( found == 1 )) || die "no framed PNGs found in $directory; run frame first"
}

frame() {
  require_command asc
  require_command magick
  validate_locale
  command -v kou >/dev/null 2>&1 || die "'kou' is required; install koubou==0.18.1 as documented in docs/store-screenshots.md"
  [[ -f "$CAPTION_FONT" ]] || die "caption font not found: $CAPTION_FONT"
  [[ -d "$RAW_DIR" ]] || die "no raw screenshots found in $RAW_DIR; run capture first"
  validate_gallery_set "$RAW_DIR"

  local stage output
  create_stage "$FRAMED_DIR"
  stage="$ACTIVE_STAGE"
  mkdir -p "$stage/$LOCALE"

  while IFS= read -r -d '' input; do
    output="$stage/$LOCALE/$(basename "$input")"
    log "Framing $input"
    asc screenshots frame \
      --input "$input" \
      --output-path "$output" \
      --device "$FRAME_DEVICE" \
      --output json
    compose_caption "$output"
  done < <(find "$RAW_DIR" -type f -name '*.png' -print0 | sort -z)

  validate_gallery_set "$stage"
  validate_opaque_pngs "$stage"
  publish_stage "$FRAMED_DIR"
}

review() {
  require_command asc
  require_command magick
  [[ -d "$RAW_DIR" ]] || die "no raw screenshots found in $RAW_DIR; run capture first"
  [[ -d "$FRAMED_DIR" ]] || die "no framed screenshots found in $FRAMED_DIR; run frame first"
  validate_gallery_set "$RAW_DIR"
  validate_gallery_set "$FRAMED_DIR"
  validate_opaque_pngs "$FRAMED_DIR"

  local stage
  create_stage "$REVIEW_DIR"
  stage="$ACTIVE_STAGE"
  asc screenshots review-generate \
    --raw-dir "$RAW_DIR" \
    --framed-dir "$FRAMED_DIR" \
    --output-dir "$stage"
  publish_stage "$REVIEW_DIR"

  printf '\nReview generated at %s/index.html\n' "$REVIEW_DIR"
  if [[ "${OPEN_REVIEW:-0}" == '1' ]]; then
    asc screenshots review-open --output-dir "$REVIEW_DIR"
  fi
}

validate_review_approval() {
  local manifest="$REVIEW_DIR/manifest.json" approvals="$REVIEW_DIR/approved.json"
  [[ -f "$manifest" && -f "$approvals" ]] || die 'review approval missing; run screenshots:review and screenshots:approve first'

  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const [manifestPath, approvalsPath, framedDir] = process.argv.slice(1);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const approved = new Set(JSON.parse(fs.readFileSync(approvalsPath, "utf8")).approved ?? []);
    const pending = (manifest.entries ?? []).filter((entry) => entry.status !== "ready" || !approved.has(entry.key));
    if (pending.length > 0 || !manifest.entries?.length) process.exit(1);

    const collectPngs = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const child = path.join(directory, entry.name);
      return entry.isDirectory() ? collectPngs(child) : entry.isFile() && entry.name.endsWith(".png") ? [fs.realpathSync(child)] : [];
    });
    const actual = collectPngs(framedDir).sort();
    const reviewed = manifest.entries.map((entry) => fs.realpathSync(entry.framed_path)).sort();
    if (JSON.stringify(actual) !== JSON.stringify(reviewed)) process.exit(1);

    const manifestAt = fs.statSync(manifestPath).mtimeMs;
    const approvedAt = fs.statSync(approvalsPath).mtimeMs;
    if (manifestAt > approvedAt || reviewed.some((entry) => fs.statSync(entry).mtimeMs > manifestAt)) process.exit(1);
  ' "$manifest" "$approvals" "$FRAMED_DIR" || die 'review is incomplete or framed files changed after review; review and approve again'
}

upload() {
  require_command asc
  require_command magick
  validate_locale
  [[ -d "$FRAMED_DIR" ]] || die "no framed screenshots found in $FRAMED_DIR; run frame first"
  validate_gallery_set "$FRAMED_DIR"
  validate_opaque_pngs "$FRAMED_DIR"
  validate_review_approval

  if [[ -n "${VERSION_LOCALIZATION_ID:-}" ]]; then
    local dry_run=()
    if [[ "${UPLOAD_DRY_RUN:-0}" == '1' ]]; then
      dry_run=(--dry-run)
    fi
    asc screenshots upload \
      --version-localization "$VERSION_LOCALIZATION_ID" \
      --path "$FRAMED_DIR/$LOCALE" \
      --device-type "$DEVICE_TYPE" \
      "${dry_run[@]}" \
      --output json \
      --pretty
  elif [[ -n "${APP_STORE_APP_ID:-}" && -n "${APP_STORE_VERSION:-}" ]]; then
    if [[ "${UPLOAD_DRY_RUN:-0}" == '1' ]]; then
      asc screenshots plan \
        --app "$APP_STORE_APP_ID" \
        --version "$APP_STORE_VERSION" \
        --review-output-dir "$REVIEW_DIR" \
        --output json \
        --pretty
    else
      asc screenshots apply \
        --app "$APP_STORE_APP_ID" \
        --version "$APP_STORE_VERSION" \
        --review-output-dir "$REVIEW_DIR" \
        --confirm \
        --output json \
        --pretty
    fi
  else
    die 'set VERSION_LOCALIZATION_ID, or set APP_STORE_APP_ID and APP_STORE_VERSION, before upload'
  fi
}

approve() {
  require_command asc
  require_command magick
  [[ -d "$FRAMED_DIR" ]] || die "no framed screenshots found in $FRAMED_DIR; run frame first"
  validate_gallery_set "$FRAMED_DIR"
  validate_opaque_pngs "$FRAMED_DIR"
  [[ -d "$REVIEW_DIR" ]] || die "no review found in $REVIEW_DIR; run review first"
  asc screenshots review-approve \
    --all-ready \
    --output-dir "$REVIEW_DIR"
}

usage() {
  cat <<'EOF'
Usage: scripts/store-screenshots.sh <command>

Commands:
  build    Generate iOS native files if needed, build, install, and launch
  capture  Run the configured plan into screenshots/raw
  frame    Frame raw PNGs into screenshots/framed
  review   Generate the review report (set OPEN_REVIEW=1 to open it)
  approve  Mark all reviewed screenshots ready for upload
  upload   Upload framed PNGs using App Store Connect credentials
  all      Run build, capture, frame, and review

The upload command requires VERSION_LOCALIZATION_ID, or APP_STORE_APP_ID and
APP_STORE_VERSION. See docs/store-screenshots.md for setup and customization.
EOF
}

command_name="${1:-help}"
case "$command_name" in
  build) build ;;
  capture) capture ;;
  frame) frame ;;
  review) review ;;
  approve) approve ;;
  upload) upload ;;
  all) build; capture; frame; review ;;
  help|-h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
