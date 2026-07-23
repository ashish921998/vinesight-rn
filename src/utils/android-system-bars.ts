// Safe-area-context reports the actual inset for the device's current navigation
// mode. Do not replace it with a fixed estimate: gesture and three-button modes
// have different geometry, and the inset can change while the app is running.
export function getAndroidBottomSystemInset(reportedBottomInset: number) {
  return Math.max(0, reportedBottomInset);
}
