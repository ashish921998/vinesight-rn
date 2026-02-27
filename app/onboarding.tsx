import React from 'react';
import { Redirect } from 'expo-router';

export default function DeprecatedOnboardingRoute() {
  return <Redirect href="/(tabs)/settings" />;
}
