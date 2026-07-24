export function getAndroidBottomSystemInset(reportedBottomInset: number) {
  // Edge-to-edge devices legitimately report zero here. Adding a synthetic
  // inset creates a second system-bar-sized band below native Compose bars.
  return Math.max(0, reportedBottomInset);
}
