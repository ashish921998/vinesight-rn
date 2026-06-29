/**
 * No-op fallback for platforms without a hardware back button (iOS, web).
 *
 * iOS escape-via-back is blocked at the navigator level instead — the screen
 * that mounts this hook sets `gestureEnabled: false`, and there is no header
 * back chevron, so there is no swipe/pop gesture that can leave the module.
 *
 * The Android implementation lives in `use-home-back-exit.android.ts`.
 */
export function useHomeBackExit(_intervalMs = 2000) {}
