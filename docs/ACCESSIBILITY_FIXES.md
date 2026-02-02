# Font Scaling & Accessibility Fixes - VineSight RN

## Summary of Changes

Fixed critical font scaling and text overflow issues throughout the app to prevent layout breakage when users enable system accessibility settings (larger fonts, bold text, etc.).

## Changes Made

### 1. **App-Wide Font Scaling Policy** (`app/_layout.tsx`)
- Added `Text.defaultProps` configuration to cap font scaling at 130% multiplier
- Prevents extreme font sizes from breaking layouts while still respecting user preferences
- Allows system font changes to be applied to body text

### 2. **Button Component** (`src/components/ui/button.tsx`)
- Fixed hardcoded `paddingVertical: 14` → Changed to `spacing[3]` (12px)
- Ensures button padding scales proportionally with text

### 3. **Input Component** (`src/components/ui/input.tsx`)
- Fixed hardcoded margins/padding:
  - `labelStyle.marginBottom: 6` → `spacing[1]` (4px)
  - `inputStyle.paddingVertical: 14` → `spacing[3]` (12px)
  - `errorContainerStyle.marginTop: 6` → `spacing[1]` (4px)
  - `marginRight: 10` → `spacing[2]` (8px)

### 4. **Form Components** (`src/components/ui/form-components.tsx`)
- Fixed all hardcoded `paddingVertical: 14` values → `spacing[3]`:
  - `FormModal.saveButtonStyle`
  - `FormSection.saveButtonStyle`
  - `FormPillSelector.getPillStyle`
  - `FormNumberInput.inputStyle`

### 5. **Quick Action Button** (`src/components/cards/quick-action-button.tsx`)
- Added `numberOfLines={2}` to title text to prevent overflow
- Ensures text wraps gracefully instead of breaking layout

### 6. **Farm Card** (`src/components/cards/farm-card.tsx`)
- Added `numberOfLines={1}` truncation to:
  - Farm name (header)
  - Crop variety badge
  - "WATER BALANCE" label
  - "REGION" label
- Replaced hardcoded `fontSize: 10` → `fontSize.xs` (12px, scalable)
- Added `minWidth: 12, minHeight: 12` to status indicator dot to prevent shrinking

### 7. **Activity Log Card** (`src/components/cards/activity-log-card.tsx`)
- Added `numberOfLines={1}` to farm name text
- Added `minWidth: 40, minHeight: 40` to icon container to maintain touch targets
- Fixed `marginTop: 4` → `spacing[1]` (4px)

### 8. **Worker Card** (`src/components/cards/worker-card.tsx`)
- Added `numberOfLines={1}` to:
  - Worker name
  - Daily rate display
- Added `minWidth: 48, minHeight: 48` to avatar to maintain circular size
- Ensures names don't overflow and avatar stays circular

### 9. **Stats Card** (`src/components/cards/stats-card.tsx`)
- Fixed `marginTop: 2` → `spacing[0]` for consistency

## Key Principles Applied

1. **Use Theme Spacing**: Replaced all hardcoded pixel values with `spacing` scale tokens
2. **Text Truncation**: Added `numberOfLines` to prevent overflow in constrained containers
3. **Min-Width/Min-Height**: Added constraints to circular elements (avatars, icons) to prevent shrinking
4. **Flexible Layouts**: Used Flexbox with `flex: 1` and responsive values
5. **Font Scaling Cap**: Set global multiplier to prevent extreme scaling

## Testing Recommendations

Test with Android Settings > Display > Font size at:
- **Small** (0.8x multiplier)
- **Default** (1.0x multiplier)
- **Large** (1.3x+ multiplier)
- **Largest** (1.5x+ multiplier)

Also test with **Bold text** enabled (Settings > Display > Bold text)

Verify:
- ✅ All buttons remain clickable and properly sized
- ✅ Text doesn't overflow its container
- ✅ Icons and avatars maintain proper dimensions
- ✅ Spacing between elements scales appropriately
- ✅ Modal/form dialogs remain usable

## Files Modified

- `app/_layout.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/form-components.tsx`
- `src/components/cards/quick-action-button.tsx`
- `src/components/cards/farm-card.tsx`
- `src/components/cards/activity-log-card.tsx`
- `src/components/cards/worker-card.tsx`
- `src/components/cards/stats-card.tsx`
