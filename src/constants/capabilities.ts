import type { Capabilities, CapabilitySet } from '@/types';

export const FREE_CAPABILITIES: Capabilities = {
  farms: {
    maxFarms: 1,
  },
  logs: {
    retentionMonths: 3,
  },
  workers: {
    maxWorkers: 1,
  },
  attendance: {
    historyWeeks: 4,
  },
  labTests: {
    trends: false,
    autoParsing: false,
  },
  soilWater: {
    manualUpdate: false,
    moistureTrends: false,
  },
  ai: {
    chatbot: false,
  },
};

export const PRO_CAPABILITIES: Capabilities = {
  farms: {
    maxFarms: 'unlimited',
  },
  logs: {
    retentionMonths: 'unlimited',
  },
  workers: {
    maxWorkers: 'unlimited',
  },
  attendance: {
    historyWeeks: 'unlimited',
  },
  labTests: {
    trends: true,
    autoParsing: true,
  },
  soilWater: {
    manualUpdate: true,
    moistureTrends: true,
  },
  ai: {
    chatbot: true,
  },
};

export const DEFAULT_CAPABILITY_SET: CapabilitySet = {
  id: 'free',
  capabilities: FREE_CAPABILITIES,
};
