#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUNDLE_ID="${APP_BUNDLE_ID:-com.vinesight.ios}"
WORKSPACE="${IOS_WORKSPACE:-ios/Vinesight.xcworkspace}"
SCHEME="${IOS_SCHEME:-Vinesight}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
DERIVED_DATA="${IOS_DERIVED_DATA:-.build/screenshots/DerivedData}"
RAW_DIR="${SCREENSHOTS_RAW_DIR:-screenshots/raw}"
FRAMED_DIR="${SCREENSHOTS_FRAMED_DIR:-screenshots/framed}"
REVIEW_DIR="${SCREENSHOTS_REVIEW_DIR:-screenshots/review}"
FRAME_DEVICE="${SCREENSHOTS_FRAME_DEVICE:-iphone-air}"
DEVICE_TYPE="${SCREENSHOTS_DEVICE_TYPE:-IPHONE_65}"
REQUESTED_UDID="${IOS_SIMULATOR_UDID:-booted}"

log() { printf '\n[screenshots] %s\n' "$*"; }
die() { printf '\n[screenshots] error: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required; see docs/store-screenshots.md"; }

resolve_udid() {
  if [[ "$REQUESTED_UDID" != "booted" ]]; then
    printf '%s\n' "$REQUESTED_UDID"
    return
  fi

  local booted
  booted="$(xcrun simctl list devices booted | sed -nE 's/.*iPhone.*\\(([A-F0-9-]+)\\).*/\\1/p' | head -n 1)"
  if [[ -n "$booted" ]]; then
    printf '%s\n' "$booted"
    return
  fi

  local available
  available="$(xcrun simctl list devices available | sed -nE 's/.*iPhone.*\\(([A-F0-9-]+)\\).*/\\1/p' | head -n 1)"
  [[ -n "$available" ]] || die 'no available iPhone simulator found; set IOS_SIMULATOR_UDID'
  xcrun simctl boot "$available" >/dev/null 2>&1 || true
  printf '%s\n' "$available"
}

ensure_ios_project() {
  if [[ -d "$WORKSPACE" ]]; then
    return
  fi

  require_command npx
  log "Generating the ignored iOS project with Expo prebuild"
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
  require_command xcrun
  ensure_ios_project
  install_pods

  local udid app_path
  udid="$(resolve_udid)"
  xcrun simctl boot "$udid" >/dev/null 2>&1 || true

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
  mkdir -p "$RAW_DIR"
  log "Capturing the plan in .asc/screenshots.json"
  asc screenshots run \
    --plan .asc/screenshots.json \
    --bundle-id "$BUNDLE_ID" \
    --udid "$REQUESTED_UDID" \
    --output-dir "$RAW_DIR" \
    --output json \
    --pretty
}

frame() {
  require_command asc
  command -v kou >/dev/null 2>&1 || die "'kou' is required; install koubou==0.18.1 as documented in docs/store-screenshots.md"
  find "$RAW_DIR" -type f -name '*.png' -print -quit | grep -q . || die "no raw PNGs found in $RAW_DIR; run capture first"
  mkdir -p "$FRAMED_DIR"

  while IFS= read -r -d '' input; do
    log "Framing $input"
    asc screenshots frame \
      --input "$input" \
      --output-dir "$FRAMED_DIR" \
      --device "$FRAME_DEVICE" \
      --output json
  done < <(find "$RAW_DIR" -type f -name '*.png' -print0 | sort -z)
}

review() {
  require_command asc
  [[ -d "$FRAMED_DIR" ]] || die "no framed screenshots found in $FRAMED_DIR; run frame first"
  mkdir -p "$REVIEW_DIR"
  asc screenshots review-generate \
    --framed-dir "$FRAMED_DIR" \
    --output-dir "$REVIEW_DIR"
  printf '\nReview generated at %s/index.html\n' "$REVIEW_DIR"
  if [[ "${OPEN_REVIEW:-0}" == '1' ]]; then
    asc screenshots review-open --output-dir "$REVIEW_DIR"
  fi
}

upload() {
  require_command asc
  [[ -d "$FRAMED_DIR" ]] || die "no framed screenshots found in $FRAMED_DIR; run frame first"

  local target_args=()
  if [[ -n "${VERSION_LOCALIZATION_ID:-}" ]]; then
    target_args=(--version-localization "$VERSION_LOCALIZATION_ID")
  elif [[ -n "${APP_STORE_APP_ID:-}" && -n "${APP_STORE_VERSION:-}" ]]; then
    target_args=(--app "$APP_STORE_APP_ID" --version "$APP_STORE_VERSION")
  else
    die 'set VERSION_LOCALIZATION_ID, or set APP_STORE_APP_ID and APP_STORE_VERSION, before upload'
  fi

  local dry_run=()
  if [[ "${UPLOAD_DRY_RUN:-0}" == '1' ]]; then
    dry_run=(--dry-run)
  fi

  asc screenshots upload \
    "${target_args[@]}" \
    --path "$FRAMED_DIR" \
    --device-type "$DEVICE_TYPE" \
    "${dry_run[@]}" \
    --output json \
    --pretty
}

approve() {
  require_command asc
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
  capture  Run .asc/screenshots.json into screenshots/raw
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
