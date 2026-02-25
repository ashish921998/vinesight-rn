import { useEffect } from 'react';

let NativeSpeechRecognitionModule: unknown = null;
let useNativeSpeechRecognitionEvent:
  | ((eventName: string, listener: (event: unknown) => void) => void)
  | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const speechRecognition = require('expo-speech-recognition');
  NativeSpeechRecognitionModule = speechRecognition.ExpoSpeechRecognitionModule;
  useNativeSpeechRecognitionEvent = speechRecognition.useSpeechRecognitionEvent;
} catch {
  // Module not available (Expo Go)
}

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface SpeechRecognitionPermissionResponse {
  status: PermissionStatus | string;
  granted: boolean;
}

export interface SpeechRecognitionStartOptions {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
}

export interface SpeechRecognitionResultEvent {
  results: Array<{ transcript?: string }>;
  isFinal?: boolean;
}

export interface SpeechRecognitionErrorEvent {
  error?: string;
  message?: string;
}

export type SpeechRecognitionEventName = 'start' | 'end' | 'result' | 'error';

interface SpeechRecognitionEventPayloadMap {
  start: undefined;
  end: undefined;
  result: SpeechRecognitionResultEvent;
  error: SpeechRecognitionErrorEvent;
}

interface SpeechRecognitionNativeModule {
  getPermissionsAsync(): Promise<SpeechRecognitionPermissionResponse>;
  requestPermissionsAsync(): Promise<SpeechRecognitionPermissionResponse>;
  start(options: SpeechRecognitionStartOptions): void;
  stop(): void;
  abort(): void;
}

function isNativeModuleAvailable(module: unknown): module is SpeechRecognitionNativeModule {
  if (!module || typeof module !== 'object') {
    return false;
  }

  const candidate = module as Partial<SpeechRecognitionNativeModule>;
  return (
    typeof candidate.getPermissionsAsync === 'function' &&
    typeof candidate.requestPermissionsAsync === 'function' &&
    typeof candidate.start === 'function' &&
    typeof candidate.stop === 'function' &&
    typeof candidate.abort === 'function'
  );
}

const unavailableError = new Error(
  "Native speech recognition module is unavailable (Expo Go doesn't include it).",
);

const fallbackModule: SpeechRecognitionNativeModule = {
  getPermissionsAsync: async () => ({ status: 'denied', granted: false }),
  requestPermissionsAsync: async () => Promise.reject(unavailableError),
  start: () => {
    throw unavailableError;
  },
  stop: () => {},
  abort: () => {},
};

export const isSpeechRecognitionAvailable = isNativeModuleAvailable(NativeSpeechRecognitionModule);

export const SpeechRecognitionModule: SpeechRecognitionNativeModule = isSpeechRecognitionAvailable
  ? (NativeSpeechRecognitionModule as unknown as SpeechRecognitionNativeModule)
  : fallbackModule;

type SpeechRecognitionEventHook = <E extends SpeechRecognitionEventName>(
  eventName: E,
  listener: (event: SpeechRecognitionEventPayloadMap[E]) => void,
) => void;

const useFallbackSpeechRecognitionEvent: SpeechRecognitionEventHook = () => {
  useEffect(() => {
    return;
  }, []);
};

const useNativeSpeechRecognitionEventAdapter: SpeechRecognitionEventHook = (
  eventName,
  listener,
) => {
  // useNativeSpeechRecognitionEvent is guaranteed non-null here because
  // useSpeechRecognitionEventImpl is only set to this adapter when
  // the native module was successfully loaded (module-level constant).
  (useNativeSpeechRecognitionEvent! as SpeechRecognitionEventHook)(eventName, listener);
};

const useSpeechRecognitionEventImpl: SpeechRecognitionEventHook =
  isSpeechRecognitionAvailable && useNativeSpeechRecognitionEvent
    ? useNativeSpeechRecognitionEventAdapter
    : useFallbackSpeechRecognitionEvent;

export function useSpeechRecognitionEvent<E extends SpeechRecognitionEventName>(
  eventName: E,
  listener: (event: SpeechRecognitionEventPayloadMap[E]) => void,
) {
  useSpeechRecognitionEventImpl(eventName, listener);
}
