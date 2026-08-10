#!/bin/bash
#
# Upload App Store screenshots once version 3.3.25 exits review.
# Run this after the version is approved or rejected (editable state).
#
# Usage:  bash store/screenshots/upload-to-asc.sh
#
set -e

APP_ID="6756113329"
VERSION="3.3.25"
SCREENSHOTS_DIR="$(dirname "$0")/upload"

echo "=== Uploading screenshots to App Store Connect ==="
echo "  App:     Vinesight ($APP_ID)"
echo "  Version: $VERSION"
echo "  Locale:  en-GB"
echo ""

# Validate dimensions first
echo "Validating screenshot dimensions..."
asc screenshots validate \
  --path "$SCREENSHOTS_DIR/en-GB" \
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
