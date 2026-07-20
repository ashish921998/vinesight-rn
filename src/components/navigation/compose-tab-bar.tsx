// Fallback for non-Android platforms. iOS uses expo-router's NativeTabs, so this
// custom bar is never rendered there — it exists only so the shared import
// resolves. The Android implementation lives in compose-tab-bar.android.tsx.
export function ComposeTabBar() {
  return null;
}
