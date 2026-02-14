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

export interface AssistantFeatureFlags {
  serverVoiceEnabled: boolean;
  memoryEnabled: boolean;
  ragEnabled: boolean;
  providerFallbackEnabled: boolean;
  routeOnServerEnabled: boolean;
}

export const assistantFeatureFlags: AssistantFeatureFlags = {
  serverVoiceEnabled: parseBool(process.env.EXPO_PUBLIC_ASSISTANT_SERVER_VOICE_ENABLED, true),
  memoryEnabled: parseBool(process.env.EXPO_PUBLIC_ASSISTANT_MEMORY_ENABLED, true),
  ragEnabled: parseBool(process.env.EXPO_PUBLIC_ASSISTANT_RAG_ENABLED, true),
  providerFallbackEnabled: parseBool(
    process.env.EXPO_PUBLIC_ASSISTANT_PROVIDER_FALLBACK_ENABLED,
    true,
  ),
  routeOnServerEnabled: parseBool(process.env.EXPO_PUBLIC_ASSISTANT_ROUTE_ON_SERVER_ENABLED, false),
};

export const assistantModelConfig = {
  advisoryModel: 'gpt-4o-mini',
  extractionModel: 'gpt-4o-mini',
};
