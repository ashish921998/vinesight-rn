import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui/button';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useOfferings } from '@/hooks/use-offerings';
import { subscriptionService } from '@/services/subscription-service';
import { telemetry } from '@/services/telemetry';
import { REVENUECAT_OFFERING_ID } from '@/constants/subscription';
import { colorWithOpacity } from '@/utils/color';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

function formatPeriod(period: string | null): string {
  if (!period) return '';
  if (period === 'P1M') return 'month';
  if (period === 'P1Y') return 'year';
  if (period === 'P1W') return 'week';
  return period.replace('P', '').toLowerCase();
}

function getPackageLabel(aPackage: PurchasesPackage) {
  const title = aPackage.product.title?.trim();
  if (title) return title;
  const period = formatPeriod(aPackage.product.subscriptionPeriod);
  if (!period) return 'Plan';
  return `Plan · ${period}`;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { t } = useTranslation();
  const { data: capabilities, refetch } = useCapabilities();
  const { data: offerings, isLoading } = useOfferings();
  const insets = useSafeAreaInsets();

  const hasPaidPlan = capabilities.planId !== 'free' && capabilities.status !== 'expired';

  const offering = useMemo(() => {
    if (!offerings) return null;
    return offerings.all?.[REVENUECAT_OFFERING_ID] || offerings.current;
  }, [offerings]);

  const packages = useMemo(() => {
    if (!offering) return [] as PurchasesPackage[];
    return offering.availablePackages;
  }, [offering]);

  const defaultPackage = useMemo(() => {
    if (!offering) return null;
    return (
      offering.annual ||
      offering.sixMonth ||
      offering.threeMonth ||
      offering.twoMonth ||
      offering.monthly ||
      offering.weekly ||
      offering.lifetime ||
      packages[0] ||
      null
    );
  }, [offering, packages]);

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    if (defaultPackage) {
      setSelectedPackage(defaultPackage);
    }
  }, [defaultPackage]);

  useEffect(() => {
    telemetry.capture('paywall_viewed', {
      source: source ?? 'unknown',
      current_plan: capabilities.planId,
    });
  }, [source, capabilities.planId]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setIsPurchasing(true);
    telemetry.capture('upgrade_clicked', {
      source: source ?? 'paywall',
      package_id: selectedPackage.identifier,
      product_id: selectedPackage.product.identifier,
    });

    try {
      const result = await subscriptionService.purchasePackage(selectedPackage);
      const activeEntitlements = result.customerInfo?.entitlements?.active ?? {};
      const inTrial = Object.values(activeEntitlements).some(
        (ent) => ent && ent.periodType === 'TRIAL',
      );
      if (inTrial) {
        telemetry.capture('subscription_trial_started', {
          product_id: selectedPackage.product.identifier,
        });
      }
      await subscriptionService.syncPurchases();
      refetch();
      Alert.alert(t('subscription.successTitle'), t('subscription.successBody'));
      router.back();
    } catch (error) {
      if (__DEV__) {
        console.error('Purchase failed', error);
      }
      Alert.alert(
        t('subscription.errors.purchaseFailedTitle'),
        t('subscription.errors.purchaseFailedBody'),
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await subscriptionService.restorePurchases();
      await subscriptionService.syncPurchases();
      refetch();
      Alert.alert(t('subscription.restoreTitle'), t('subscription.restoreBody'));
    } catch (_error) {
      Alert.alert(
        t('subscription.errors.restoreFailedTitle'),
        t('subscription.errors.restoreFailedBody'),
      );
    }
  };

  if (!subscriptionService.isSupported) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}
      >
        <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
          {t('subscription.notSupported')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
      <Stack.Screen
        options={{
          title: t('subscription.paywallTitle'),
          headerStyle: { backgroundColor: m3.colorScheme.surface },
          headerTintColor: m3.colorScheme.onSurface,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: Math.max(spacing[4], insets.top),
          paddingHorizontal: spacing[4],
          paddingBottom: Math.max(spacing[8], insets.bottom + spacing[6]),
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            marginTop: spacing[3],
            borderRadius: borderRadius['3xl'],
            padding: spacing[6],
            backgroundColor: m3.colorScheme.surface,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: 260,
              height: 260,
              borderRadius: borderRadius.full,
              right: -140,
              top: -150,
              backgroundColor: m3.colorScheme.primaryContainer,
              opacity: 0.8,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: borderRadius.full,
              left: -90,
              bottom: -120,
              backgroundColor: m3.colorScheme.secondaryContainer,
              opacity: 0.8,
            }}
          />
          <Text
            selectable
            style={{
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
              lineHeight: 38,
            }}
          >
            {t('subscription.paywallHeadline')}
          </Text>
          <Text
            selectable
            style={{
              fontSize: fontSize.base,
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[2],
            }}
          >
            {t('subscription.paywallSubhead')}
          </Text>
          <View
            style={{
              marginTop: spacing[4],
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[4],
              alignSelf: 'flex-start',
              borderRadius: borderRadius.full,
              backgroundColor: m3.colorScheme.primaryContainer,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              selectable
              style={{
                color: m3.colorScheme.onPrimaryContainer,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.sm,
              }}
            >
              {t('subscription.trialCopy')}
            </Text>
          </View>
        </View>

        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: m3.colorScheme.surface,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
          }}
        >
          {[
            t('subscription.features.unlimitedFarms'),
            t('subscription.features.unlimitedWorkers'),
            t('subscription.features.fullRetention'),
            t('subscription.features.labTrends'),
            t('subscription.features.soilTrends'),
            t('subscription.features.aiChat'),
            t('subscription.features.autoParsing'),
          ].map((feature, index) => (
            <View
              key={feature}
              style={{
                paddingVertical: spacing[2],
                borderBottomWidth: index === 6 ? 0 : 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: m3.colorScheme.primaryContainer,
                }}
              >
                <UiSymbol name="lock.fill" size={14} color={m3.colorScheme.primary} />
              </View>
              <Text selectable style={{ color: m3.colorScheme.onSurface, flex: 1 }}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: m3.colorScheme.surface,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Text
            selectable
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('subscription.paywallTitle')}
          </Text>

          {isLoading && (
            <View style={{ alignItems: 'center', paddingVertical: spacing[6] }}>
              <ActivityIndicator size="large" color={m3.colorScheme.primary} />
            </View>
          )}
          {!isLoading && packages.length === 0 && (
            <Text selectable style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('subscription.errors.noPackages')}
            </Text>
          )}
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            const isYearly = pkg.product.subscriptionPeriod === 'P1Y';
            return (
              <Pressable
                key={pkg.identifier}
                onPress={() => setSelectedPackage(pkg)}
                style={{
                  marginTop: spacing[3],
                  borderRadius: borderRadius['2xl'],
                  borderWidth: 2,
                  borderColor: isSelected ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
                  padding: spacing[4],
                  backgroundColor: isSelected
                    ? m3.colorScheme.primaryContainer
                    : m3.surface.surfaceContainerLow,
                  boxShadow: isSelected ? '0 14px 26px rgba(18, 44, 33, 0.16)' : 'none',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.full,
                      borderWidth: 2,
                      borderColor: isSelected
                        ? m3.colorScheme.primary
                        : m3.colorScheme.outlineVariant,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? m3.colorScheme.primary : 'transparent',
                    }}
                  >
                    {isSelected ? (
                      <UiSymbol name="checkmark" size={12} color={m3.colorScheme.onPrimary} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      selectable
                      style={{ fontWeight: fontWeight.bold, color: m3.colorScheme.onSurface }}
                    >
                      {getPackageLabel(pkg)} {isYearly ? `(${t('subscription.bestValue')})` : ''}
                    </Text>
                    <Text
                      selectable
                      style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}
                    >
                      {pkg.product.priceString} /{' '}
                      {formatPeriod(pkg.product.subscriptionPeriod) || t('subscription.period')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing[3] }}>
          <Button
            title={hasPaidPlan ? t('subscription.alreadyPro') : t('subscription.cta')}
            onPress={handlePurchase}
            disabled={isPurchasing || hasPaidPlan || !selectedPackage}
            isLoading={isPurchasing}
          />
          <Button title={t('subscription.restore')} variant="ghost" onPress={handleRestore} />
        </View>
      </ScrollView>
    </View>
  );
}
