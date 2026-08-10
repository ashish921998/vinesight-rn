#!/bin/bash
#
# Upload App Store screenshots once version 3.3.25 exits review.
# Run this after the version is approved or rejected (editable state).
#
# Usage:  bash store/screenshots/upload-to-asc.sh
#
set -euo pipefail

APP_ID="6756113329"
VERSION="3.3.25"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/appstore-6.7-1290x2796"
SCREENSHOTS_DIR="$SCRIPT_DIR/upload"
LOCALE_DIR="$SCREENSHOTS_DIR/en-GB"

# asc expects localized screenshots under a locale directory. Keep this
# staging area generated and ignored rather than requiring committed copies.
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: generated screenshots not found at $SOURCE_DIR" >&2
  echo "Run: bash store/screenshots/compose.sh" >&2
  exit 1
fi

shopt -s nullglob
source_files=("$SOURCE_DIR"/*.png)
if (( ${#source_files[@]} != 5 )); then
  echo "Error: expected 5 generated screenshots in $SOURCE_DIR, found ${#source_files[@]}" >&2
  echo "Run: bash store/screenshots/compose.sh" >&2
  exit 1
fi

rm -rf "$LOCALE_DIR"
mkdir -p "$LOCALE_DIR"
cp "${source_files[@]}" "$LOCALE_DIR/"

echo "=== Uploading screenshots to App Store Connect ==="
echo "  App:     Vinesight ($APP_ID)"
echo "  Version: $VERSION"
echo "  Locale:  en-GB"
echo ""

# Validate dimensions first
echo "Validating screenshot dimensions..."
asc screenshots validate \
  --path "$LOCALE_DIR" \
  --device-type IPHONE_67 \
  --output table

echo ""
echo "Uploading iPhone 6.7\" screenshots..."
asc screenshots upload \
  --app "$APP_ID" \
  --version "$VERSION" \
  --path "$SCREENSHOTS_DIR" \
  --device-type IPHONE_67

echo ""
echo "Done. Verify at: https://appstoreconnect.apple.com/apps/$APP_ID"
