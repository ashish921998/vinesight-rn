import { NativeModules, Platform } from 'react-native';

interface AndroidSmsRetrieverBridgeModule {
  isSupported?: () => Promise<boolean>;
  startListening?: () => Promise<string | null>;
  stopListening?: () => Promise<void>;
}

const androidSmsRetrieverBridge = NativeModules.AndroidSmsRetrieverBridge as
  | AndroidSmsRetrieverBridgeModule
  | undefined;

export async function isAndroidSmsRetrieverSupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !androidSmsRetrieverBridge?.isSupported) {
    return false;
  }

  try {
    return await androidSmsRetrieverBridge.isSupported();
  } catch {
    return false;
  }
}

export async function startAndroidSmsRetriever(): Promise<string | null> {
  if (Platform.OS !== 'android' || !androidSmsRetrieverBridge?.startListening) {
    return null;
  }

  try {
    return await androidSmsRetrieverBridge.startListening();
  } catch {
    return null;
  }
}

export async function stopAndroidSmsRetriever(): Promise<void> {
  if (Platform.OS !== 'android' || !androidSmsRetrieverBridge?.stopListening) {
    return;
  }

  try {
    await androidSmsRetrieverBridge.stopListening();
  } catch {
    // Best effort cleanup only.
  }
}
