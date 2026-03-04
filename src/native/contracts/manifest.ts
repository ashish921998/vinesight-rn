import type { NativeUiContractManifest } from './types';

/**
 * Phase 0 source of truth for native app shell integration.
 * Native iOS (SwiftUI) and Android (Compose) teams implement against this contract.
 */
export const nativeUiContractManifest: NativeUiContractManifest = {
  version: 1,
  generatedAt: '2026-03-03',
  platforms: [
    {
      platform: 'ios',
      framework: 'swiftui',
      minimumOsVersion: '16.0',
    },
    {
      platform: 'android',
      framework: 'jetpack_compose',
      minimumOsVersion: '26',
    },
  ],
  tabs: ['home', 'farms', 'tools', 'workers', 'settings'],
  routes: [
    { id: 'auth.login', path: '/(auth)/login', authRequired: false, nativePriority: 'p0' },
    {
      id: 'auth.phone_login',
      path: '/(auth)/phone-login',
      authRequired: false,
      nativePriority: 'p0',
    },
    {
      id: 'auth.otp_verification',
      path: '/(auth)/otp-verification',
      authRequired: false,
      nativePriority: 'p0',
    },
    {
      id: 'auth.profile_completion',
      path: '/(auth)/profile-completion',
      authRequired: false,
      nativePriority: 'p1',
    },
    { id: 'onboarding', path: '/onboarding', authRequired: false, nativePriority: 'p1' },
    { id: 'tabs.home', path: '/(tabs)', authRequired: true, nativePriority: 'p0' },
    { id: 'tabs.farms', path: '/(tabs)/farms', authRequired: true, nativePriority: 'p1' },
    { id: 'tabs.tools', path: '/(tabs)/tools', authRequired: true, nativePriority: 'p2' },
    { id: 'tabs.workers', path: '/(tabs)/workers', authRequired: true, nativePriority: 'p2' },
    {
      id: 'tabs.settings',
      path: '/(tabs)/settings',
      authRequired: true,
      nativePriority: 'p2',
    },
  ],
  analytics: {
    requiredEvents: [
      'screen_view',
      'login_success',
      'login_failure',
      'otp_sent',
      'otp_verified',
      'tab_selected',
      'farm_selected',
    ],
    requiredUserProperties: ['user_id', 'phone_verified', 'preferred_language', 'active_farm_id'],
  },
  auth: {
    states: [
      'signed_out',
      'otp_pending',
      'profile_incomplete',
      'authenticated',
      'refreshing_session',
    ],
    requiredSessionFields: ['userId', 'phone', 'accessToken', 'refreshToken', 'expiresAt'],
    loginMethods: ['phone_otp', 'apple'],
  },
};
