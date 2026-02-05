import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import {
  REVENUECAT_API_KEYS,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
  REVENUECAT_PRODUCT_IDS,
} from '@/constants/subscription';

class SubscriptionService {
  private configuredForUserId: string | null = null;
  private configuring = false;

  get entitlementId() {
    return REVENUECAT_ENTITLEMENT_ID;
  }

  get offeringId() {
    return REVENUECAT_OFFERING_ID;
  }

  get productIds() {
    return REVENUECAT_PRODUCT_IDS;
  }

  get isSupported() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  private getApiKey(): string {
    if (Platform.OS === 'ios') return REVENUECAT_API_KEYS.ios;
    if (Platform.OS === 'android') return REVENUECAT_API_KEYS.android;
    return '';
  }

  async configure(userId: string | null) {
    if (!this.isSupported) return;
    if (!userId) return;
    if (this.configuring) return;
    if (this.configuredForUserId === userId) return;
    if (__DEV__ && Constants.appOwnership === 'expo') {
      if (__DEV__) {
        console.warn('RevenueCat is not available in Expo Go. Use a dev build or Test Store key.');
      }
      return;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (__DEV__) {
        console.warn('RevenueCat API key missing for platform');
      }
      return;
    }

    this.configuring = true;
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({
        apiKey,
        appUserID: userId,
      });
      this.configuredForUserId = userId;
    } finally {
      this.configuring = false;
    }
  }

  async logOut() {
    if (!this.isSupported) return;
    try {
      await Purchases.logOut();
    } catch (_error) {
      // Ignore logout failures
    } finally {
      this.configuredForUserId = null;
    }
  }

  async getOfferings() {
    if (!this.isSupported) return null;
    return Purchases.getOfferings();
  }

  async purchasePackage(aPackage: PurchasesPackage) {
    if (!this.isSupported) {
      throw new Error('Purchases not supported on this platform');
    }
    return Purchases.purchasePackage(aPackage);
  }

  async restorePurchases() {
    if (!this.isSupported) return null;
    return Purchases.restorePurchases();
  }

  async syncPurchases() {
    if (!this.isSupported) return null;
    try {
      return await Purchases.syncPurchasesForResult();
    } catch (_error) {
      return null;
    }
  }

  async showManageSubscriptions() {
    if (!this.isSupported) return;
    return Purchases.showManageSubscriptions();
  }
}

export const subscriptionService = new SubscriptionService();
