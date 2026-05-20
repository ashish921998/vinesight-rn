import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface NoteFormData {
  notes?: string;
}

interface NoteFormProps {
  data: NoteFormData;
  onChange: (data: NoteFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
}

export function NoteForm({ data, onChange, onInputFocus }: NoteFormProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ marginRight: 6 }}>
          <SymbolIcon name="note.text" size={16} color={colors.primary[600]} />
        </View>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.surface[800],
          }}
        >
          {t('dailyNoteForm.fields.note')}
        </Text>
      </View>

      <View
        style={{
          minHeight: 140,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.surface[200],
          backgroundColor: colors.surface[100],
        }}
      >
        <TextInput
          style={{
            minHeight: 110,
            padding: 0,
            fontSize: fontSize.base,
            lineHeight: 22,
            color: colors.surface[900],
          }}
          placeholder={t('dailyNoteForm.placeholders.note')}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          value={data.notes ?? ''}
          onChangeText={(notes) => onChange({ notes })}
          multiline
          textAlignVertical="top"
          onFocus={onInputFocus}
        />
      </View>
    </View>
  );
}

export function validateNoteForm(data: NoteFormData): boolean {
  return Boolean(data.notes?.trim());
}

export function createEmptyNoteFormData(): NoteFormData {
  return { notes: '' };
}
