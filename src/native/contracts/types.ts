export type SupportedPlatform = 'ios' | 'android';

export type NativeFramework = 'swiftui' | 'jetpack_compose';

export interface PlatformContract {
  readonly platform: SupportedPlatform;
  readonly framework: NativeFramework;
  readonly minimumOsVersion: string;
}

export interface NativeRouteContract {
  readonly id: string;
  readonly path: string;
  readonly authRequired: boolean;
  readonly nativePriority: 'p0' | 'p1' | 'p2';
}

export interface AnalyticsContract {
  readonly requiredEvents: readonly string[];
  readonly requiredUserProperties: readonly string[];
}

export interface AuthContract {
  readonly states: readonly string[];
  readonly requiredSessionFields: readonly string[];
  readonly loginMethods: readonly string[];
}

export interface NativeUiContractManifest {
  readonly version: number;
  readonly generatedAt: string;
  readonly platforms: readonly PlatformContract[];
  readonly tabs: readonly string[];
  readonly routes: readonly NativeRouteContract[];
  readonly analytics: AnalyticsContract;
  readonly auth: AuthContract;
}
