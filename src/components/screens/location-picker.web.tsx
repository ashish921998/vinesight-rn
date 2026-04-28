import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (latitude: number, longitude: number, locationName?: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

// Web stub: react-native-maps does not support web. Show a clear unavailable
// state instead of crashing the bundle. Native (.tsx) variant is used on iOS/Android.
export default function LocationPicker({ visible, onClose }: LocationPickerProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.card, { backgroundColor: m3.colorScheme.surface }]}>
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
            {t('common.unavailableOnWeb', { defaultValue: 'Map picker is not available on web' })}
          </Text>
          <Text style={[styles.body, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('common.useMobileForMap', {
              defaultValue: 'Please use the iOS or Android app to set a farm location on the map.',
            })}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: m3.colorScheme.primary }]}
          >
            <Text style={[styles.buttonText, { color: m3.colorScheme.onPrimary }]}>
              {t('common.close', { defaultValue: 'Close' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: spacing[6],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  button: {
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    alignSelf: 'flex-end',
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
