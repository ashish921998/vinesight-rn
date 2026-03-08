import { NativeModules, Platform } from 'react-native';

interface PhoneNumberHintBridgeModule {
  isSupported?: () => Promise<boolean>;
  requestPhoneNumberHint?: () => Promise<string | null>;
}

const phoneNumberHintBridge = NativeModules.PhoneNumberHintBridge as
  | PhoneNumberHintBridgeModule
  | undefined;

export async function isPhoneNumberHintSupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !phoneNumberHintBridge?.isSupported) {
    return false;
  }

  try {
    return await phoneNumberHintBridge.isSupported();
  } catch {
    return false;
  }
}

export async function requestPhoneNumberHint(): Promise<string | null> {
  if (Platform.OS !== 'android' || !phoneNumberHintBridge?.requestPhoneNumberHint) {
    return null;
  }

  try {
    return await phoneNumberHintBridge.requestPhoneNumberHint();
  } catch {
    return null;
  }
}
