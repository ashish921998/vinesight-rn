export const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || 'Vinesight Pro';

export const REVENUECAT_OFFERING_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || 'ofrng814b5361c2';

export const REVENUECAT_PRODUCT_IDS = {
  monthly: process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID?.trim() || 'vinesight_pro_monthly',
  yearly: process.env.EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID?.trim() || 'vinesight_pro_yearly',
} as const;

export const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || '',
} as const;
