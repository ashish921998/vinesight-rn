/**
 * Subscription & Capability Types
 */

export type PlanId = 'free' | 'pro' | string;

export type SubscriptionStatus = 'active' | 'trialing' | 'expired' | 'grace' | 'canceled';

export interface Subscription {
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  provider: 'revenuecat' | string;
}

export type CapabilityLimit = number | 'unlimited';

export interface Capabilities {
  farms: {
    maxFarms: CapabilityLimit;
  };
  logs: {
    retentionMonths: CapabilityLimit;
  };
  workers: {
    maxWorkers: CapabilityLimit;
  };
  attendance: {
    historyWeeks: CapabilityLimit;
  };
  labTests: {
    trends: boolean;
    autoParsing: boolean;
  };
  soilWater: {
    manualUpdate: boolean;
    moistureTrends: boolean;
  };
  ai: {
    chatbot: boolean;
  };
}

export interface CapabilitySet {
  id: string;
  capabilities: Capabilities;
}

export interface EffectiveCapabilitiesResponse {
  planId: PlanId;
  status: SubscriptionStatus;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  capabilities: Capabilities;
}
