import { useEffect } from 'react';
import {
  ExpoSpeechRecognitionModule as NativeSpeechRecognitionModule,
  useSpeechRecognitionEvent as useNativeSpeechRecognitionEvent,
} from 'expo-speech-recognition';

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
  useNativeSpeechRecognitionEvent(eventName as never, listener as never);
};

const useSpeechRecognitionEventImpl: SpeechRecognitionEventHook = isSpeechRecognitionAvailable
  ? useNativeSpeechRecognitionEventAdapter
  : useFallbackSpeechRecognitionEvent;

export function useSpeechRecognitionEvent<E extends SpeechRecognitionEventName>(
  eventName: E,
  listener: (event: SpeechRecognitionEventPayloadMap[E]) => void,
) {
  useSpeechRecognitionEventImpl(eventName, listener);
}
