import { ActivityIndicator, View, type ActivityIndicatorProps } from 'react-native';
import { Host, LoadingIndicator } from '@expo/ui/jetpack-compose';

// Android: prominent (large / unsized) spinners use the Material 3
// LoadingIndicator. Small inline spinners (buttons, cards) keep RN's
// ActivityIndicator — the compose indicator has a fixed ~48dp intrinsic size
// that's too large for those spots.
export function Spinner({ size, color, style, ...rest }: ActivityIndicatorProps) {
  const isSmall = size === 'small' || (typeof size === 'number' && size < 32);
  if (isSmall) {
    return <ActivityIndicator size={size} color={color} style={style} {...rest} />;
  }
  return (
    <View style={style}>
      <Host matchContents>
        <LoadingIndicator color={color} />
      </Host>
    </View>
  );
}
