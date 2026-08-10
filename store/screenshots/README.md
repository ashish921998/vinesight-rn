# Vinesight App Store Screenshots

App Store-ready marketing screenshots with branded backgrounds, benefit-focused
captions (SF Pro Display), and device-style framing — composited from real app
captures on iPhone 17 Pro Max.

## Gallery Order (First 3 Rule)

80% of App Store impressions show only the first 3 screenshots before scrolling.

| # | File | Screen | Caption | Purpose |
|---|------|--------|---------|---------|
| 1 | `01-vineyard-overview.png` | Farms overview with harvest timeline | **See Your Entire Vineyard** / at a Glance | Hero — core value, stop the scroll |
| 2 | `02-ai-assistant.png` | AI Assistant conversation | **Ask Your AI Farming** / Assistant Anything | Key differentiator vs competitors |
| 3 | `03-farm-vitals.png` | Farm detail: vital signs, workboard | **Track Soil, Water & Weather** / in Real Time | Most loved feature |
| 4 | `04-reports.png` | Reports: harvest, revenue, profit | **Know Your Harvest,** / Revenue & Profit | Outcome / social proof |
| 5 | `05-quick-log.png` | Home: quick-log + recent activity | **Log Irrigation, Spray** / & Harvest in Seconds | Supporting feature |

## Directory Structure

```
store/screenshots/
├── appstore-6.7-1290x2796/      # FINAL marketing screenshots — App Store REQUIRED
├── appstore-6.5-1284x2778/      # FINAL marketing screenshots — App Store REQUIRED
├── googleplay/                   # FINAL marketing screenshots — Google Play
├── ios/                          # Raw captures (1320x2868, iPhone 17 Pro Max)
├── compose.sh                    # Script to regenerate marketing assets from raw
└── README.md                     # This file
```

## Platform Specifications

### Apple App Store (iOS)

| Device Class | Dimensions (px) | Status |
|-------------|-----------------|--------|
| iPhone 6.7" (15 Pro Max / 17 Pro Max) | 1290 x 2796 | Ready in `ios-6.7-1290x2796/` |
| iPhone 6.5" (11 Pro Max) | 1284 x 2778 | Ready in `ios-6.5-1284x2778/` |
| iPhone 5.5" (8 Plus) | 1242 x 2208 | Optional — not generated |
| iPad Pro 12.9" | 2048 x 2732 | Generate if iPad app |

- Up to 10 screenshots per localization
- First 3 are visible without scrolling (critical)
- Format: PNG (no alpha/transparency)

### Google Play Store (Android)

| Spec | Value |
|------|-------|
| Dimensions used | 1290 x 2796 (within 320–3840px range) |
| Aspect ratio | 9:16 portrait |
| Max screenshots | 8 |
| Format | PNG (24-bit, no alpha) |

**Still needed:** Feature graphic (1024 x 500 px) for Google Play featuring.

## Caption Guidelines

All captions follow the skill's rules:
- **Max 2 lines** of text
- **Benefit-focused**, not feature-focused
- **30pt+ equivalent** font size (when overlaid on screenshots)

### Caption Do's and Don'ts

| Don't (feature-focused) | Do (benefit-focused) |
|------------------------|---------------------|
| "Farm Dashboard" | "See Your Entire Vineyard at a Glance" |
| "AI Chat Assistant" | "Ask Your AI Farming Assistant Anything" |
| "Vital Signs Monitor" | "Track Soil, Water & Weather in Real Time" |
| "Reports & Analytics" | "Know Your Harvest, Revenue & Profit" |
| "Quick Log Actions" | "Log Irrigation, Spray & Harvest in Seconds" |

## How to Add Captions

These are raw app screenshots without text overlays. To add captions for the App Store:

### Option A: Overlay with ImageMagick
```bash
# Example: add caption to hero screenshot
convert ios-6.7-1290x2796/01-farms-explore.png \
  -gravity North -background "#1E241F" -splice 0x200 \
  -gravity North -fill "#FBF8F3" -font Helvetica-Bold -pointsize 72 \
  -annotate +0+60 "See Your Entire Vineyard at a Glance" \
  ios-6.7-1290x2796/01-farms-explore-captioned.png
```

### Option B: Use design tool (Figma / Canva)
1. Create a 1290x2796 canvas
2. Add a header band with the benefit-focused caption
3. Place the screenshot below
4. Export as PNG

### Option C: Submit without captions
The screenshots are clean enough to submit as-is — the app UI is self-explanatory.

## Screenshots Not Yet Captured

These additional screens would round out a full 8-10 screenshot set:

| Screen | Route | Why it matters | Caption idea |
|--------|-------|---------------|-------------|
| Weather | `/weather` | Agricultural weather per farm | "Weather That Understands Your Crop" |
| Spray Safe Checker | `/spray-safe-checker` | PHI compliance — safety differentiator | "Spray with Confidence, Every Time" |
| Tasks | `/tasks` | Task management (detailed mode) | "Never Miss a Farm Task Again" |
| Soil/Petiole Trends | `/soil-trends` | Data charts — visual analytics | "Spot Trends Before They Become Problems" |
| Worker Attendance | `/(tabs)/workers` | Labor tracking (detailed mode) | "Track Your Crew Effortlessly" |

To capture these: start Metro (`npx expo start`), switch to detailed mode in Settings, navigate to each screen, and screenshot.

## Localization Markets

Priority languages for localized screenshots:

| Market | Localization Level |
|--------|-------------------|
| English | Full (primary) |
| Hindi | Full — app supports HI (key India market) |
| Marathi | Full — app supports MR (key India market) |
| Spanish | Captions only |
| Portuguese (BR) | Captions only |

## A/B Testing (Google Play)

Google Play Console supports store listing experiments:
- Test screenshot order (try AI Assistant as #1)
- Test with/without captions
- Test different first-3 combinations
- Run for 7+ days with 50%+ traffic for significance

## How These Were Captured

1. Booted iPhone 17 Pro Max simulator (iOS 26.5)
2. Launched Vinesight (`com.vinesight.ios`)
3. Navigated to each screen via UI interaction
4. Captured at full resolution (scale: 1.0 PNG)
5. Resized to exact App Store dimensions using `sips`

## Update Checklist

- [ ] Recapture when major UI changes ship
- [ ] Verify captions match current feature set
- [ ] Check dimensions before each submission
- [ ] Localize for priority markets
- [ ] A/B test first 3 screenshot variants
