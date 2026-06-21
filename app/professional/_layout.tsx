import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ProfessionalLayout() {
  const { t } = useTranslation();
  return <Stack screenOptions={{ headerBackTitle: t('common.back') }} />;
}
