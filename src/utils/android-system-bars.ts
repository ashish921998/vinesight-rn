// Some Android edge-to-edge configurations report zero for three-button
// navigation. Keep bottom controls reachable when the native inset is missing.
const ANDROID_NAV_BAR_FALLBACK_INSET = 32;

export function getAndroidBottomSystemInset(reportedBottomInset: number) {
  return Math.max(reportedBottomInset, ANDROID_NAV_BAR_FALLBACK_INSET);
}
