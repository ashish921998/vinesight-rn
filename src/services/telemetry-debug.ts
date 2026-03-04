import { telemetry, telemetryEnabled, telemetryConfig } from './telemetry';

export const telemetryDebug = {
  ...telemetry,
  capture: (event: string, properties?: any) => {
    console.log('📊 PostHog Capture:', { event, properties, enabled: telemetryEnabled });
    telemetry.capture(event, properties);
  },
  screen: (name: string, properties?: any) => {
    console.log('📱 PostHog Screen:', { name, properties, enabled: telemetryEnabled });
    telemetry.screen(name, properties);
  },
  identify: (distinctId: string, properties?: any) => {
    console.log('👤 PostHog Identify:', { distinctId, properties, enabled: telemetryEnabled });
    telemetry.identify(distinctId, properties);
  },
  reset: () => {
    console.log('🔄 PostHog Reset');
    telemetry.reset();
  },
  flush: async () => {
    console.log('⏳ PostHog Flush');
    await telemetry.flush();
  },
};

export const showTelemetryConfig = () => {
  console.log('PostHog Config:', telemetryConfig);
};
