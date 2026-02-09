import { useProfile } from './use-profile';
import { getDefaultCurrency } from '@/i18n/currency';

export function useCurrency(): string {
  const { data: profile } = useProfile();
  return profile?.currency_preference ?? getDefaultCurrency();
}
