// Legacy redirect route — kept as a distinct URL so existing deep links to
// /log-entry/quick continue to resolve. The redirect logic is identical to
// /log-entry/add, so this route re-exports that implementation instead of
// duplicating it. Per-route screen options (presentation: 'modal') are set in
// the root _layout.tsx Stack.Screen config and remain unchanged.
export { default, screenOptions } from './add';
