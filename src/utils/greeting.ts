export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

/** Time-of-day greeting bucket, keyed off the device's local hour. */
export function getGreetingKey(): GreetingKey {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}
