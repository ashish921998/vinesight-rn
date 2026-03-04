function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return defaultValue;
}

export interface NativeUiFeatureFlags {
  nativeUiEnabled: boolean;
  onboardingEnabled: boolean;
}

export const nativeUiFeatureFlags: NativeUiFeatureFlags = {
  nativeUiEnabled: parseBool(process.env.EXPO_PUBLIC_NATIVE_UI_ENABLED, false),
  onboardingEnabled: parseBool(process.env.EXPO_PUBLIC_NATIVE_UI_ONBOARDING_ENABLED, false),
};
