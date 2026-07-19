import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

// iOS / fallback: RN's ActivityIndicator. Android swaps large/default spinners
// for the Material 3 LoadingIndicator via spinner.android.tsx.
export function Spinner(props: ActivityIndicatorProps) {
  return <ActivityIndicator {...props} />;
}
