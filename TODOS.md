# TODOs

## Farm Card

**Priority:** P3
Consider showing "Unknown" water status instead of "Healthy" when `remaining_water` is null — currently `isLowWater()` returns `false` for null data, so farms with no water data look healthy. Deferred from PR #151 /review (user chose to skip).

**Priority:** P3
Season timeline assumes a 130-day season constant for all crops. Consider making `SEASON_LENGTH_DAYS` crop-aware or user-configurable so the timeline is accurate for non-grape crops (olives, berries). Deferred from PR #151 /review.

## Completed

