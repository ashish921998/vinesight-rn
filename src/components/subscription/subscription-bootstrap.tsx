import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { subscriptionService } from '@/services/subscription-service';
import { useCapabilities } from '@/hooks/use-capabilities';
import { telemetry } from '@/services/telemetry';

export function SubscriptionBootstrap() {
  const user = useAuthStore((s) => s.user);
  const clearLastKnown = useSubscriptionStore((s) => s.clear);
  const { data } = useCapabilities();
  const previousRef = useRef<{ planId: string; status: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      void subscriptionService.configure(user.id);
      return;
    }
    void subscriptionService.logOut();
    clearLastKnown();
  }, [user?.id, clearLastKnown]);

  useEffect(() => {
    previousRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    const prev = previousRef.current;
    const next = { planId: data.planId, status: data.status };

    if (prev) {
      if (prev.planId !== next.planId && prev.planId !== 'free' && next.planId === 'free') {
        telemetry.capture('downgraded_to_free', {
          previous_plan: prev.planId,
        });
      }
      if (prev.status !== next.status) {
        if (prev.status === 'trialing' && next.status === 'active') {
          telemetry.capture('subscription_converted', {
            plan_id: next.planId,
          });
        }
        if (next.status === 'canceled' || next.status === 'expired') {
          telemetry.capture('subscription_canceled', {
            plan_id: next.planId,
            previous_status: prev.status,
          });
        }
      }
    }

    previousRef.current = next;
  }, [data.planId, data.status]);

  return null;
}
