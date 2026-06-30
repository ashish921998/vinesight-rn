// Android edge-to-edge can report a zero bottom safe-area inset when the system
// navigation bar is transparent, even though 3-button navigation still occupies
// physical space. Keep bottom UI above those controls by reserving a conservative
// fallback inset whenever the reported bottom inset is smaller.
const ANDROID_NAV_BAR_FALLBACK_INSET = 32;

export function getAndroidBottomSystemInset(reportedBottomInset: number) {
  return Math.max(reportedBottomInset, ANDROID_NAV_BAR_FALLBACK_INSET);
}
