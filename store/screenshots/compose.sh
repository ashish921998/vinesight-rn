#!/bin/bash
#
# Clean white minimal App Store screenshots.
# White bg + bold headline + app screenshot fills the frame.
#
set -e

FONT_BOLD="/Library/Fonts/SF-Pro-Display-Bold.otf"
FONT_REG="/Library/Fonts/SF-Pro-Display-Regular.otf"

RAW_DIR="store/screenshots/ios"
OUT_67="store/screenshots/appstore-6.7-1290x2796"
OUT_65="store/screenshots/appstore-6.5-1284x2778"
OUT_GP="store/screenshots/googleplay"

mkdir -p "$OUT_67" "$OUT_65" "$OUT_GP"

CW=1290
CH=2796

# Colors
BG="#FFFFFF"
HEADLINE="#1A1A1A"
SUBTITLE="#86868B"

process() {
  local input="$1"
  local output="$2"
  local headline="$3"
  local subtitle="$4"

  echo "→ $output"

  local tmpdir=$(mktemp -d)
  local canvas="$tmpdir/canvas.png"

  # 1. White canvas
  magick -size "${CW}x${CH}" xc:"$BG" "$canvas"

  # 2. Headline — large bold, centered, ~200px from top
  magick "$canvas" \
    -font "$FONT_BOLD" -fill "$HEADLINE" -pointsize 80 \
    -gravity north -annotate "+0+210" "$headline" \
    "$canvas"

  # 3. Subtitle — smaller, gray, below headline
  if [ -n "$subtitle" ]; then
    magick "$canvas" \
      -font "$FONT_REG" -fill "$SUBTITLE" -pointsize 42 \
      -gravity north -annotate "+0+320" "$subtitle" \
      "$canvas"
  fi

  # 4. Resize screenshot to fill width with small side margins
  local margin=30
  local shot_w=$(( CW - margin * 2 ))
  local orig_w=$(magick identify -format "%w" "$input")
  local orig_h=$(magick identify -format "%h" "$input")
  local shot_h=$(( orig_h * shot_w / orig_w ))

  # Scale to fit: start at y=420, max height = CH - 420 - 40
  local max_h=$(( CH - 460 ))
  if [ "$shot_h" -gt "$max_h" ]; then
    shot_h=$max_h
  fi

  # Resize the screenshot
  local shot="$tmpdir/shot.png"
  magick "$input" -resize "${shot_w}x${shot_h}" "$shot"

  # 5. Composite screenshot centered below text
  local shot_y=420
  magick "$canvas" "$shot" \
    -gravity north -geometry "+0+${shot_y}" \
    -compose Over -composite \
    "$canvas"

  # 6. Save outputs
  cp "$canvas" "$OUT_67/$output"
  sips -z 2778 1284 "$canvas" --out "$OUT_65/$output" >/dev/null 2>&1
  cp "$canvas" "$OUT_GP/$output"

  rm -rf "$tmpdir"
}

echo "=== Clean White Minimal — App Store Screenshots ==="
echo ""

process "$RAW_DIR/01-farms-explore.png"  "01-vineyard-overview.png"  "See Your Entire Vineyard" "at a Glance"
process "$RAW_DIR/04-ai-assistant.png"   "02-ai-assistant.png"       "Ask Your AI Farming" "Assistant Anything"
process "$RAW_DIR/03-farm-detail.png"    "03-farm-vitals.png"        "Track Soil, Water & Weather" "in Real Time"
process "$RAW_DIR/05-reports.png"        "04-reports.png"            "Know Your Harvest," "Revenue & Profit"
process "$RAW_DIR/02-home-dashboard.png" "05-quick-log.png"          "Log Irrigation, Spray" "& Harvest in Seconds"

echo ""
echo "Done."
for f in "$OUT_67"/*.png; do
  echo "  $(basename $f) — $(magick identify -format '%wx%h' "$f")"
done
