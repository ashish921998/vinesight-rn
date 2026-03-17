/**
 * Safety Module Index
 * Re-exports all safety functions for clean imports.
 */

export {
  buildBlockedAdviceMessage,
  buildSafetyFlags,
  hasDosageSignal,
  hasEscalationSignal,
  hasPpeSignal,
  hasUncertaintySignal,
  isSprayOrFertigationTopic,
  type SafetyFlags,
} from './checker.ts';
