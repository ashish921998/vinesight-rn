import React from 'react';
import { SimplifiedHome } from '@/components/screens/simplified-home';

// ============================================================
// MARK: - Home Screen
// ============================================================

// One consistent action-forward Home for both simplified and detailed mode.
// The old analytics dashboard (metric grid + greeting hero) was removed.
export default function DashboardScreen() {
  return <SimplifiedHome />;
}
