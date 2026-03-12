import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
// Speech recognition is now handled server-side
// import { SpeechRecognitionModule } from '@/services/speech-recognition';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import Markdown from 'react-native-markdown-display';
import { useFarm, useFarms } from '@/hooks';
import { aiService } from '@/services/ai-service';
import type { AssistantInputMode } from '@/types/ai';
import { AIMessageAttachmentInput, ChatMessage } from '@/types/ai';
import { classifyIntent, executeQuery } from '@/services/farm-assistant-service';
import {
  buildVoiceLogFormPrefill,
  decideChatRoute,
  getVoiceLogMissingFields,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
} from '@/services/voice-log-assistant';
import {
  AssistantGatewayError,
  AssistantGatewayErrorCode,
  cancelPendingAssistantTurnRequest,
  sendAssistantTurn,
} from '@/services/assistant-gateway';
import { assistantFeatureFlags } from '@/constants/assistant-flags';
import { assistantMemoryService } from '@/services/assistant-memory';
import type { AssistantConversationSummary } from '@/services/assistant-memory';
import { voiceOutputService } from '@/services/voice-output';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate, formatTime } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { useModalStore } from '@/stores';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { AssistantAnswer, QueryIntent } from '@/types/voice-assistant';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { VoiceLogDraft, VoiceLogMissingField } from '@/types/voice-log';

type VoiceInputState = 'idle' | 'recording' | 'processing';
type VoiceConversationMode = 'auto' | 'manual';
interface ChatAttachment {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  kind: 'image' | 'document';
}

interface VoiceAudioPayload {
  inputAudioBase64: string;
  audioFormat: string;
  durationMs?: number | null;
}

interface FailedChatRequest {
  text: string;
  source: 'text' | 'voice';
  voicePayload: VoiceAudioPayload | null;
  attachments: ChatAttachment[];
}

interface AssistantTurnDiagnostics {
  source: string;
  traceId?: string | null;
  routeDecision?: string | null;
  providerUsed?: string | null;
  modelUsed?: string | null;
  latencyMs?: number | null;
  voiceCaptureDurationMs?: number | null;
  voiceUploadBytes?: number | null;
  sttProviderUsed?: string | null;
  sttConfidence?: number | null;
  sttLatencyMs?: number | null;
  ttsGenerationMs?: number | null;
  ttsSkippedReason?: string | null;
  fallbackReason?: string | null;
}

const SHOW_LOCAL_DIAGNOSTICS = false;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_VOICE_AUDIO_DURATION_MS = 800;
const MIN_VOICE_AUDIO_BASE64_LENGTH = 800;
const MIN_VOICE_AUDIO_ESTIMATED_BYTES = 600;

/**
 * Voice recording options optimized for STT providers.
 * - iOS: WAV format (16kHz, mono) - best for Sarvam/OpenAI STT
 * - Android: We try to get the best format available
 * - Web: WebM with Opus codec
 *
 * Note: Android AAC works with OpenAI Whisper but Sarvam prefers WAV.
 * The server will fallback to OpenAI STT if Sarvam rejects the format.
 */
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    // Android MediaRecorder doesn't support WAV directly in all versions
    // Use AAC which is widely supported and works with OpenAI Whisper
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  ios: {
    // iOS supports WAV with linear PCM - best quality for STT
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/markdown',
]);

const TEXT_DOCUMENT_EXTENSIONS = new Set(['txt', 'csv', 'json', 'md', 'xml', 'html', 'htm', 'log']);
const TEXT_DOCUMENT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
]);
const MAX_DOCUMENT_CHARS = 12000;

function getFileExtension(nameOrUri: string): string | null {
  const cleanName = nameOrUri.split('?')[0]?.split('#')[0] ?? nameOrUri;
  const index = cleanName.lastIndexOf('.');
  if (index < 0 || index === cleanName.length - 1) return null;
  return cleanName.slice(index + 1).toLowerCase();
}

function inferAttachmentMimeType(attachment: ChatAttachment): string {
  if (attachment.mimeType) return attachment.mimeType;

  const extension = getFileExtension(attachment.name) ?? getFileExtension(attachment.uri);
  if (!extension) {
    return attachment.kind === 'image' ? 'image/jpeg' : 'application/octet-stream';
  }

  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'txt') return 'text/plain';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'json') return 'application/json';
  if (extension === 'xml') return 'application/xml';
  if (extension === 'md') return 'text/markdown';

  return attachment.kind === 'image' ? 'image/jpeg' : 'application/octet-stream';
}

function isTextDocument(attachment: ChatAttachment, mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  if (TEXT_DOCUMENT_MIME_TYPES.has(mimeType)) return true;
  const extension = getFileExtension(attachment.name) ?? getFileExtension(attachment.uri);
  return extension ? TEXT_DOCUMENT_EXTENSIONS.has(extension) : false;
}

async function prepareAttachmentForAI(
  attachment: ChatAttachment,
): Promise<AIMessageAttachmentInput> {
  const mimeType = inferAttachmentMimeType(attachment);

  if (attachment.kind === 'image') {
    try {
      const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: 'base64',
      });
      return {
        kind: 'image',
        name: attachment.name,
        mimeType,
        sourceUri: attachment.uri,
        dataUrl: `data:${mimeType};base64,${base64}`,
      };
    } catch {
      return {
        kind: 'image',
        name: attachment.name,
        mimeType,
        sourceUri: attachment.uri,
      };
    }
  }

  if (isTextDocument(attachment, mimeType)) {
    try {
      const text = await FileSystem.readAsStringAsync(attachment.uri);
      return {
        kind: 'document',
        name: attachment.name,
        mimeType,
        sourceUri: attachment.uri,
        textContent: text.slice(0, MAX_DOCUMENT_CHARS),
      };
    } catch {
      return {
        kind: 'document',
        name: attachment.name,
        mimeType,
        sourceUri: attachment.uri,
      };
    }
  }

  return {
    kind: 'document',
    name: attachment.name,
    mimeType,
    sourceUri: attachment.uri,
  };
}

async function prepareAttachmentsForAI(
  attachments: ChatAttachment[],
): Promise<AIMessageAttachmentInput[]> {
  return Promise.all(attachments.map((attachment) => prepareAttachmentForAI(attachment)));
}

function resolveLanguageCode(language: string): SupportedLanguageCode {
  if (language.startsWith('mr')) return 'mr';
  if (language.startsWith('hi')) return 'hi';
  return 'en';
}

function formatAttachmentSummary(attachments: ChatAttachment[]): string {
  if (attachments.length === 0) return '';
  const lines = attachments.map(
    (attachment, index) => `- ${index + 1}. ${attachment.name} (${attachment.kind})`,
  );
  return `Attached files:\n${lines.join('\n')}`;
}

function inferAudioMimeType(uri: string): string {
  const extension = getFileExtension(uri);
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'caf') return 'audio/x-caf';
  if (extension === '3gp') return 'audio/3gpp';
  if (extension === 'amr') return 'audio/amr';
  if (extension === 'm4a') return 'audio/x-m4a';
  if (extension === 'mp4') return 'audio/mp4';
  return 'audio/mpeg';
}

function estimateBase64Bytes(base64Payload: string | null | undefined): number | null {
  if (!base64Payload) return null;
  const normalized = base64Payload.trim();
  if (!normalized) return null;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function resolveAttachmentFileSizeBytes(
  assetSize: number | undefined,
  fileInfo: { size?: number } | null | undefined,
): number | undefined {
  if (typeof assetSize === 'number' && Number.isFinite(assetSize)) return assetSize;
  if (fileInfo && typeof fileInfo.size === 'number' && Number.isFinite(fileInfo.size)) {
    return fileInfo.size;
  }
  const totalBytes = (fileInfo as { totalBytes?: number } | null | undefined)?.totalBytes;
  return typeof totalBytes === 'number' && Number.isFinite(totalBytes) ? totalBytes : undefined;
}

function validateVoiceAudioPayload(payload: VoiceAudioPayload | null): {
  ok: boolean;
  reason?: string;
  estimatedBytes?: number | null;
} {
  if (!payload?.inputAudioBase64?.trim()) {
    return { ok: false, reason: 'empty_audio_payload', estimatedBytes: null };
  }

  const estimatedBytes = estimateBase64Bytes(payload.inputAudioBase64);
  const durationMs = payload.durationMs ?? null;
  const hasSufficientBase64 = payload.inputAudioBase64.length >= MIN_VOICE_AUDIO_BASE64_LENGTH;
  const hasSufficientBytes =
    estimatedBytes !== null &&
    Number.isFinite(estimatedBytes) &&
    estimatedBytes >= MIN_VOICE_AUDIO_ESTIMATED_BYTES;

  // Some devices report an obviously wrong duration after stop() even when the audio payload
  // itself is healthy. Treat short duration as a hard failure only when the payload is also tiny.
  if (
    durationMs !== null &&
    durationMs > 0 &&
    durationMs < MIN_VOICE_AUDIO_DURATION_MS &&
    !hasSufficientBase64 &&
    !hasSufficientBytes
  ) {
    return { ok: false, reason: 'audio_duration_too_short', estimatedBytes };
  }

  if (!hasSufficientBase64) {
    return { ok: false, reason: 'audio_base64_too_short', estimatedBytes };
  }

  if (!hasSufficientBytes) {
    return { ok: false, reason: 'audio_bytes_too_small', estimatedBytes };
  }

  return { ok: true, estimatedBytes };
}

function formatVoicePayloadDebug(params: {
  reason?: string;
  durationMs?: number | null;
  base64Length?: number | null;
  estimatedBytes?: number | null;
  captureError?: string | null;
}): string {
  return [
    `reason=${params.reason ?? 'unknown'}`,
    `duration_ms=${params.durationMs ?? 'null'}`,
    `base64_len=${params.base64Length ?? 0}`,
    `estimated_bytes=${params.estimatedBytes ?? 'null'}`,
    `capture_error=${params.captureError ?? 'null'}`,
  ].join(' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAllowedDocumentMimeType(
  mimeType: string | undefined,
  name: string,
  uri: string,
): boolean {
  if (!mimeType) {
    const extension = getFileExtension(name) ?? getFileExtension(uri);
    return extension ? TEXT_DOCUMENT_EXTENSIONS.has(extension) || extension === 'pdf' : false;
  }
  if (mimeType.startsWith('text/')) return true;
  return ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
}

function formatDiagnosticValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : '-';
}

function promptOpenSettings(title: string, message: string, t: (key: string) => string) {
  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.ok'),
      onPress: () => {
        Linking.openSettings().catch(() => null);
      },
    },
  ]);
}

const FARM_DATA_QUERY_PATTERNS = [
  /\bhow\s+much\b/i,
  /\bhow\s+many\b/i,
  /\btotal\b/i,
  /\blast\b/i,
  /\blatest\b/i,
  /\bmost\s+recent\b/i,
  /\bshow\b/i,
  /\bhistory\b/i,
  /\brecord(s)?\b/i,
  /\bmy\b/i,
  /\bdid\s+i\b/i,
  /कितना/i,
  /कितने/i,
  /किती/i,
  /कुल/i,
  /एकूण/i,
  /पिछले?\s+महीने/i,
  /(मागच्या|गेल्या|मागील)\s+महिन/i,
];

const ADVISORY_QUERY_PATTERNS = [
  /\bshould\b/i,
  /\brecommend\b/i,
  /\bsuggest\b/i,
  /\badvice\b/i,
  /\bbest\b/i,
  /\bcan\s+i\b/i,
  /\bwhat\s+to\s+do\b/i,
  /\bhow\s+to\b/i,
  /\bकाय\s+करू\b/i,
  /\bसल्ला\b/i,
  /\bसुझाव\b/i,
  /\bकैसे\b/i,
  /\bकसा\b/i,
];

function shouldUseFarmDataEngine(transcript: string, intent: QueryIntent): boolean {
  if (!intent.category) return false;
  if (ADVISORY_QUERY_PATTERNS.some((pattern) => pattern.test(transcript))) return false;
  if (intent.queryType !== 'history' || intent.timeRange) return true;
  return FARM_DATA_QUERY_PATTERNS.some((pattern) => pattern.test(transcript));
}

function formatFarmDataAnswer(answer: AssistantAnswer): string {
  const summaryValue =
    answer.summary.unit === '₹'
      ? `₹${Number(answer.summary.value).toLocaleString('en-IN')}`
      : `${answer.summary.value}${answer.summary.unit ? ` ${answer.summary.unit}` : ''}`;

  const header = `${answer.summary.label}: ${summaryValue}`;

  if (answer.rows.length === 0) {
    return header;
  }

  const topRows = answer.rows.slice(0, 3);
  const rowLines = topRows.map((row) => {
    const detail = row.secondary ? ` (${row.secondary})` : '';
    return `- ${row.date}: ${row.primary}${detail}`;
  });

  return `${header}\n\n${rowLines.join('\n')}`;
}

function parseLocalDate(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  return new Date(year, monthIndex, day);
}

function getMissingFieldPromptKey(field: VoiceLogMissingField): string {
  switch (field) {
    case 'farm':
      return 'ai.logging.followups.common.askFarm';
    case 'duration':
      return 'ai.logging.followups.irrigation.askDuration';
    case 'waterVolume':
      return 'ai.logging.followups.common.askWaterVolume';
    case 'chemicals':
      return 'ai.logging.followups.spray.askChemicals';
    case 'quantity':
      return 'ai.logging.followups.harvest.askQuantity';
    case 'grade':
      return 'ai.logging.followups.harvest.askGrade';
    case 'cost':
      return 'ai.logging.followups.expense.askCost';
    case 'expenseType':
      return 'ai.logging.followups.expense.askType';
    case 'fertilizers':
      return 'ai.logging.followups.fertigation.askFertilizers';
  }
}

function buildVoiceLogClarificationMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  missingFields: VoiceLogMissingField[],
): string {
  const ordered = [...missingFields].sort((a, b) => (a === 'farm' ? -1 : b === 'farm' ? 1 : 0));
  const prompts = ordered.map((field) => t(getMissingFieldPromptKey(field)));
  return prompts.join(' ');
}

function getMissingFieldLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  field: VoiceLogMissingField,
): string {
  switch (field) {
    case 'farm':
      return t('ai.logging.draft.fields.farm');
    case 'duration':
      return t('ai.logging.draft.fields.duration');
    case 'waterVolume':
      return t('ai.logging.draft.fields.waterVolume');
    case 'chemicals':
      return t('ai.logging.draft.fields.chemicals');
    case 'quantity':
      return t('ai.logging.draft.fields.quantity');
    case 'grade':
      return t('ai.logging.draft.fields.grade');
    case 'cost':
      return t('ai.logging.draft.fields.cost');
    case 'expenseType':
      return t('ai.logging.draft.fields.expenseType');
    case 'fertilizers':
      return t('ai.logging.draft.fields.fertilizers');
  }
}

const markdownStyles = (colors: ReturnType<typeof useThemeColors>) => ({
  body: { fontSize: 16, color: colors.surface[900], lineHeight: 24 },
  heading1: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.surface[900],
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.surface[900],
    marginTop: 8,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.surface[900],
    marginTop: 8,
    marginBottom: 4,
  },
  strong: { fontWeight: 'bold' as const, color: colors.surface[900] },
  em: { fontStyle: 'italic' as const, color: colors.surface[900] },
  paragraph: { marginBottom: 8 },
  list_item: { marginBottom: 4, paddingLeft: 4 },
  bullet_list: { marginBottom: 8, marginLeft: 8 },
  ordered_list: { marginBottom: 8, marginLeft: 8 },
  code_inline: {
    backgroundColor: colors.surface[200],
    color: colors.surface[900],
    padding: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  code_block: {
    backgroundColor: colors.surface[200],
    color: colors.surface[900],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  blockquote: {
    backgroundColor: colors.surface[200],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
    paddingLeft: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  link: { color: colors.primary[500], textDecorationLine: 'underline' as const },
  table: { borderWidth: 1, borderColor: colors.surface[300], marginBottom: 8 },
  table_header: { backgroundColor: colors.primary[500] },
  table_row: { borderWidth: 1, borderColor: colors.surface[300] },
  table_cell: { padding: 8, fontSize: 14, color: colors.surface[900] },
});

interface VoiceModeModalProps {
  visible: boolean;
  onClose: () => void;
  isVoiceRecording: boolean;
  isLoading: boolean;
  isAssistantSpeaking: boolean;
  isVoiceModeMicEnabled: boolean;
  voiceConversationMode: VoiceConversationMode;
  voiceModeError: string | null;
  voiceModeNotice: string | null;
  liveVoiceTranscript: string;
  messages: ChatMessage[];
  voiceModeScrollViewRef: React.RefObject<ScrollView | null>;
  onMicPress: () => void;
  onPrimaryActionPress: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  m3: ReturnType<typeof useM3>;
  markdown: ReturnType<typeof markdownStyles>;
  insets: { top: number; bottom: number; left: number; right: number };
}

function VoiceModeModal({
  visible,
  onClose,
  isVoiceRecording,
  isLoading,
  isAssistantSpeaking,
  isVoiceModeMicEnabled,
  voiceConversationMode,
  voiceModeError,
  voiceModeNotice,
  liveVoiceTranscript,
  messages,
  voiceModeScrollViewRef,
  onMicPress,
  onPrimaryActionPress,
  t,
  m3,
  markdown,
  insets,
}: VoiceModeModalProps) {
  const voiceModeMarkdown = useMemo(
    () => ({
      ...markdown,
      body: {
        ...markdown.body,
        color: m3.colorScheme.onBackground,
        fontSize: 20,
        lineHeight: 34,
        marginTop: 0,
        marginBottom: 0,
      },
      heading1: { ...markdown.heading1, color: m3.colorScheme.onBackground },
      heading2: { ...markdown.heading2, color: m3.colorScheme.onBackground },
      heading3: { ...markdown.heading3, color: m3.colorScheme.onBackground },
      strong: { ...markdown.strong, color: m3.colorScheme.onBackground },
      em: { ...markdown.em, color: m3.colorScheme.onBackground },
      code_inline: {
        ...markdown.code_inline,
        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
        color: m3.colorScheme.onBackground,
      },
      code_block: {
        ...markdown.code_block,
        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
        color: m3.colorScheme.onBackground,
      },
      link: { ...markdown.link, color: m3.colorScheme.primary },
    }),
    [m3.colorScheme.onBackground, m3.colorScheme.primary, markdown],
  );

  const hasTranscript = liveVoiceTranscript.trim().length > 0;
  const assistantMessageIndices = useMemo(
    () =>
      messages.reduce<number[]>((acc, message, index) => {
        if (message.role === 'assistant') acc.push(index);
        return acc;
      }, []),
    [messages],
  );
  const recentAssistantIndices = useMemo(
    () => new Set(assistantMessageIndices.slice(-2)),
    [assistantMessageIndices],
  );

  const statusText = isAssistantSpeaking
    ? t('ai.chat.assistantSpeaking')
    : isLoading
      ? t('ai.chat.thinking')
      : isVoiceRecording
        ? t('ai.voice.recording', { defaultValue: 'Recording...' })
        : voiceConversationMode === 'auto'
          ? t('ai.voice.listening', { defaultValue: 'Listening...' })
          : isVoiceModeMicEnabled
            ? t('ai.chat.tapToSpeak')
            : t('ai.voice.microphoneOff', { defaultValue: 'Microphone off' });

  const primaryActionLabel = t('ai.chat.close');
  const primaryActionSymbol = 'xmark';
  const primaryActionA11y = t('ai.chat.close');
  const idleMicBackground = m3.surface.surfaceContainerLowest;
  const idleMicBorder = colorWithOpacity(m3.colorScheme.outline, 0.3);
  const dockShadow = {
    shadowColor: m3.colorScheme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  } as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
        }}
      >
        {isVoiceRecording ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -spacing[10],
              right: -spacing[10],
              bottom: -spacing[16],
              height: 280,
              borderTopLeftRadius: 280,
              borderTopRightRadius: 280,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          />
        ) : null}

        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing[3],
            right: spacing[4],
            zIndex: 3,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('ai.chat.close')}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colorWithOpacity(m3.surface.surfaceContainerHighest, 0.84),
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.outline, 0.25),
            }}
          >
            <UiSymbol name="xmark" size={18} color={m3.colorScheme.onSurfaceVariant} />
          </Pressable>
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <ScrollView
            ref={voiceModeScrollViewRef}
            style={{
              flex: 1,
            }}
            contentContainerStyle={{
              paddingTop: insets.top + spacing[16],
              paddingBottom: Math.max(insets.bottom + 164, 220),
              paddingHorizontal: spacing[5],
              gap: spacing[6],
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, index) => {
              if (message.role === 'assistant') {
                const isRecentAssistant = recentAssistantIndices.has(index);
                return (
                  <View
                    key={`voice-mode-${message.id}`}
                    style={{
                      maxWidth: '96%',
                      opacity: isRecentAssistant ? 1 : 0.88,
                    }}
                  >
                    <Markdown style={voiceModeMarkdown} mergeStyle={true}>
                      {message.content}
                    </Markdown>
                  </View>
                );
              }

              return (
                <View
                  key={`voice-mode-${message.id}`}
                  style={{ flexDirection: 'row', justifyContent: 'flex-end' }}
                >
                  <View
                    style={{
                      maxWidth: '78%',
                      borderRadius: borderRadius['2xl'],
                      borderBottomRightRadius: borderRadius.md,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      backgroundColor: m3.surface.surfaceContainerLow,
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.outline, 0.18),
                    }}
                  >
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.xl,
                        lineHeight: 30,
                      }}
                    >
                      {message.content}
                    </Text>
                  </View>
                </View>
              );
            })}

            {hasTranscript ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    maxWidth: '78%',
                    borderRadius: borderRadius['2xl'],
                    borderBottomRightRadius: borderRadius.md,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    backgroundColor: m3.surface.surfaceContainer,
                    borderWidth: 1,
                    borderColor: colorWithOpacity(m3.colorScheme.outline, 0.15),
                  }}
                >
                  <Text
                    style={{
                      color: colorWithOpacity(m3.colorScheme.onSurface, 0.82),
                      fontSize: fontSize.xl,
                      lineHeight: 30,
                    }}
                  >
                    {liveVoiceTranscript}
                  </Text>
                </View>
              </View>
            ) : null}

            {isLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                <ActivityIndicator size="small" color={m3.colorScheme.primary} />
                <Text
                  style={{
                    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.92),
                    fontSize: fontSize.base,
                  }}
                >
                  {t('ai.chat.thinking')}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing[5],
            paddingBottom: Math.max(insets.bottom + spacing[3], spacing[6]),
            paddingTop: spacing[3],
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
            <Text
              style={{
                color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.95),
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                textAlign: 'center',
              }}
            >
              {statusText}
            </Text>
          </View>

          {voiceModeNotice ? (
            <View
              style={{
                alignSelf: 'center',
                marginBottom: spacing[3],
                maxWidth: '92%',
                borderRadius: borderRadius.xl,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
              }}
            >
              <Text
                style={{
                  color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.95),
                  fontSize: fontSize.sm,
                  lineHeight: 20,
                  textAlign: 'center',
                }}
              >
                {voiceModeNotice}
              </Text>
            </View>
          ) : null}

          {voiceModeError ? (
            <View
              style={{
                alignSelf: 'center',
                marginBottom: spacing[3],
                maxWidth: '92%',
                borderRadius: borderRadius.xl,
                backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.error, 0.18),
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
              }}
            >
              <Text
                style={{
                  color: m3.colorScheme.error,
                  fontSize: fontSize.sm,
                  lineHeight: 20,
                  textAlign: 'center',
                }}
              >
                {voiceModeError}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: spacing[3],
            }}
          >
            <Pressable
              onPress={onMicPress}
              accessibilityRole="button"
              accessibilityLabel={
                isVoiceModeMicEnabled ? t('ai.voice.stopA11y') : t('ai.voice.startA11y')
              }
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isVoiceModeMicEnabled
                  ? m3.colorScheme.primaryContainer
                  : idleMicBackground,
                borderWidth: 1,
                borderColor: isVoiceModeMicEnabled
                  ? colorWithOpacity(m3.colorScheme.primary, 0.3)
                  : idleMicBorder,
                ...dockShadow,
              }}
            >
              <UiSymbol
                name={
                  isVoiceModeMicEnabled
                    ? isVoiceRecording
                      ? 'waveform'
                      : 'mic.fill'
                    : 'mic.slash.fill'
                }
                size={26}
                color={isVoiceModeMicEnabled ? m3.colorScheme.primary : m3.colorScheme.onSurface}
              />
            </Pressable>

            <Pressable
              onPress={onPrimaryActionPress}
              accessibilityRole="button"
              accessibilityLabel={primaryActionA11y}
              style={{
                minWidth: 132,
                height: 64,
                borderRadius: borderRadius.full,
                paddingHorizontal: spacing[5],
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing[2],
                backgroundColor: m3.colorScheme.inverseSurface,
                ...dockShadow,
              }}
            >
              <UiSymbol
                name={primaryActionSymbol}
                size={18}
                color={m3.colorScheme.inverseOnSurface}
              />
              <Text
                style={{
                  color: m3.colorScheme.inverseOnSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {primaryActionLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AIChatScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const markdown = useMemo(() => markdownStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const setAddEntry = useModalStore((s) => s.setAddEntry);
  const insets = useSafeAreaInsets();
  const { id: farmId } = useLocalSearchParams<{ id?: string }>();
  const parsedFarmId = useMemo(() => {
    if (!farmId) return null;
    const parsed = Number.parseInt(farmId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [farmId]);
  const { data: farm } = useFarm(parsedFarmId ?? undefined);
  const { data: farms = [] } = useFarms();
  const contextFarm = useMemo(() => {
    if (parsedFarmId === null) return null;
    return farm ?? farms.find((candidate) => candidate.id === parsedFarmId) ?? null;
  }, [farm, farms, parsedFarmId]);
  const voiceLogOriginContext = parsedFarmId === null ? 'dashboard' : 'farm';
  const candidateFarms = useMemo(() => (contextFarm ? [contextFarm] : farms), [contextFarm, farms]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [voiceLogDraft, setVoiceLogDraft] = useState<VoiceLogDraft | null>(null);
  const [clearedVoiceLogDraft, setClearedVoiceLogDraft] = useState<VoiceLogDraft | null>(null);
  const [voiceLogExpectedField, setVoiceLogExpectedField] = useState<VoiceLogMissingField | null>(
    null,
  );
  const [voiceLogClarifyAttempts, setVoiceLogClarifyAttempts] = useState(0);
  const [routeClarificationPending, setRouteClarificationPending] = useState(false);
  const [pendingAmbiguousTranscript, setPendingAmbiguousTranscript] = useState<string | null>(null);
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>('idle');
  const [voiceConversationMode, setVoiceConversationMode] = useState<VoiceConversationMode>('auto');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isVoiceModeVisible, setIsVoiceModeVisible] = useState(false);
  const [isVoiceModeMicEnabled, setIsVoiceModeMicEnabled] = useState(false);
  const [voiceModeError, setVoiceModeError] = useState<string | null>(null);
  const [voiceModeNotice, setVoiceModeNotice] = useState<string | null>(null);
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState('');
  const [failedRequest, setFailedRequest] = useState<FailedChatRequest | null>(null);
  const [lastAssistantDiagnostics, setLastAssistantDiagnostics] =
    useState<AssistantTurnDiagnostics | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
  const [conversationSummaries, setConversationSummaries] = useState<
    AssistantConversationSummary[]
  >([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const voiceModeScrollViewRef = useRef<ScrollView>(null);
  const voiceModeStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecordingStartTimeRef = useRef<number | null>(null);
  const isProcessingVoiceRef = useRef(false);
  const voiceRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const sendMessageRef = useRef<
    | ((
        text?: string,
        source?: 'text' | 'voice',
        voicePayload?: VoiceAudioPayload | null,
        options?: { overrideAttachments?: ChatAttachment[] },
      ) => Promise<void>)
    | null
  >(null);
  const activeAssistantRequestIdRef = useRef<string | null>(null);
  const activeAssistantAbortControllerRef = useRef<AbortController | null>(null);
  const conversationAsyncTokenRef = useRef(0);
  const isVoiceRecording = voiceInputState === 'recording';
  const languageCode = useMemo(() => resolveLanguageCode(i18n.language), [i18n.language]);
  const visibleConversationSummaries = useMemo(
    () =>
      contextFarm
        ? conversationSummaries.filter((summary) => summary.farmId === contextFarm.id)
        : conversationSummaries,
    [contextFarm, conversationSummaries],
  );
  const cancelInFlightAssistantRequest = useCallback(() => {
    const requestId = activeAssistantRequestIdRef.current;
    const abortController = activeAssistantAbortControllerRef.current;
    activeAssistantRequestIdRef.current = null;
    activeAssistantAbortControllerRef.current = null;

    if (abortController) {
      abortController.abort();
    }
    if (requestId) {
      cancelPendingAssistantTurnRequest(requestId);
    }
  }, []);

  const beginConversationAsyncAction = useCallback(() => {
    conversationAsyncTokenRef.current += 1;
    return conversationAsyncTokenRef.current;
  }, []);

  const isConversationAsyncTokenCurrent = useCallback((token: number) => {
    return conversationAsyncTokenRef.current === token;
  }, []);

  const refreshConversationHistory = useCallback(async () => {
    if (!assistantFeatureFlags.memoryEnabled) return;
    setIsHistoryLoading(true);
    try {
      const summaries = await assistantMemoryService.listConversations({ limit: 30 });
      setConversationSummaries(summaries);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const openConversation = useCallback(
    async (nextConversationId: string) => {
      if (!assistantFeatureFlags.memoryEnabled) return;
      if (!nextConversationId) return;
      setIsHistoryVisible(false);
      cancelInFlightAssistantRequest();
      setIsLoading(false);
      setRouteClarificationPending(false);
      setPendingAmbiguousTranscript(null);
      setVoiceLogDraft(null);
      setVoiceLogExpectedField(null);
      setVoiceLogClarifyAttempts(0);
      setClearedVoiceLogDraft(null);
      if (clearDraftTimeoutRef.current) {
        clearTimeout(clearDraftTimeoutRef.current);
        clearDraftTimeoutRef.current = null;
      }
      const requestToken = beginConversationAsyncAction();
      try {
        const history = await assistantMemoryService.loadRecentMessages(nextConversationId, 50);
        if (!isConversationAsyncTokenCurrent(requestToken)) return;
        setConversationId(nextConversationId);
        setMessages(history);
        setSuggestions([]);
      } catch (error) {
        if (__DEV__) {
          console.warn('Open conversation failed:', error);
        }
        if (!isConversationAsyncTokenCurrent(requestToken)) return;
        Alert.alert(t('common.error'), t('ai.errors.failedResponse'), [{ text: t('common.ok') }]);
      }
    },
    [
      beginConversationAsyncAction,
      cancelInFlightAssistantRequest,
      isConversationAsyncTokenCurrent,
      t,
    ],
  );

  const resetConversationState = useCallback(() => {
    cancelInFlightAssistantRequest();
    conversationAsyncTokenRef.current += 1;
    setIsLoading(false);
    setRouteClarificationPending(false);
    setPendingAmbiguousTranscript(null);
    setVoiceLogDraft(null);
    setVoiceLogExpectedField(null);
    setVoiceLogClarifyAttempts(0);
    setClearedVoiceLogDraft(null);
    if (clearDraftTimeoutRef.current) {
      clearTimeout(clearDraftTimeoutRef.current);
      clearDraftTimeoutRef.current = null;
    }
    setConversationId(null);
    setMessages([]);
    setSuggestions([]);
    setFailedRequest(null);
  }, [cancelInFlightAssistantRequest]);

  const startNewConversation = useCallback(() => {
    setIsHistoryVisible(false);
    resetConversationState();
  }, [resetConversationState]);

  const DEFAULT_SUGGESTIONS = useMemo(
    () => [
      t('ai.defaultSuggestions.waterNeed'),
      t('ai.defaultSuggestions.diseases'),
      t('ai.defaultSuggestions.fertilizer'),
      t('ai.defaultSuggestions.pruning'),
    ],
    [t],
  );

  const handleDeleteConversation = useCallback(
    (targetConversationId: string) => {
      Alert.alert(t('ai.chat.deleteChat'), t('ai.chat.deleteChatConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await assistantMemoryService.deleteConversation(targetConversationId);
            if (!success) {
              Alert.alert(t('common.error'), t('ai.chat.deleteChatFailed'));
              return;
            }
            if (conversationId === targetConversationId) {
              resetConversationState();
              setSuggestions(DEFAULT_SUGGESTIONS);
            }
            void refreshConversationHistory();
          },
        },
      ]);
    },
    [conversationId, DEFAULT_SUGGESTIONS, refreshConversationHistory, resetConversationState, t],
  );
  const voiceLogDraftSummary = useMemo(() => {
    if (!voiceLogDraft) return null;
    const farmValue = voiceLogDraft.farmName || t('ai.logging.draft.missingFarm');
    const missingFields = getVoiceLogMissingFields(voiceLogDraft);
    const statusValue =
      missingFields.length === 0
        ? t('ai.logging.draft.ready')
        : t('ai.logging.draft.waiting', {
            fields: missingFields.map((field) => getMissingFieldLabel(t, field)).join(', '),
          });
    const dateValue = formatDate(parseLocalDate(voiceLogDraft.date), {
      month: 'short',
      day: 'numeric',
    });

    return {
      typeValue: t(`logs.types.${voiceLogDraft.type}`),
      farmValue,
      statusValue,
      dateValue,
    };
  }, [t, voiceLogDraft]);

  const clearDraftUndoTimeout = useCallback(() => {
    if (!clearDraftTimeoutRef.current) return;
    clearTimeout(clearDraftTimeoutRef.current);
    clearDraftTimeoutRef.current = null;
  }, []);

  const hideClearedDraftNotice = useCallback(() => {
    clearDraftUndoTimeout();
    setClearedVoiceLogDraft(null);
  }, [clearDraftUndoTimeout]);

  const handleClearVoiceLogDraft = useCallback(() => {
    if (!voiceLogDraft) return;
    clearDraftUndoTimeout();
    setClearedVoiceLogDraft(voiceLogDraft);
    setVoiceLogDraft(null);
    setVoiceLogExpectedField(null);
    setVoiceLogClarifyAttempts(0);
    clearDraftTimeoutRef.current = setTimeout(() => {
      setClearedVoiceLogDraft(null);
      clearDraftTimeoutRef.current = null;
    }, 6000);
  }, [clearDraftUndoTimeout, voiceLogDraft]);

  const handleUndoClearVoiceLogDraft = useCallback(() => {
    if (!clearedVoiceLogDraft) return;
    clearDraftUndoTimeout();
    setVoiceLogDraft(clearedVoiceLogDraft);
    const restoredMissing = getVoiceLogMissingFields(clearedVoiceLogDraft);
    setVoiceLogExpectedField(restoredMissing[0] ?? null);
    setVoiceLogClarifyAttempts(0);
    setClearedVoiceLogDraft(null);
  }, [clearDraftUndoTimeout, clearedVoiceLogDraft]);

  useEffect(() => {
    return () => clearDraftUndoTimeout();
  }, [clearDraftUndoTimeout]);

  useEffect(() => {
    if (!assistantFeatureFlags.memoryEnabled) return;

    let isCancelled = false;
    cancelInFlightAssistantRequest();
    setIsLoading(false);
    const requestToken = beginConversationAsyncAction();

    const bootstrapConversation = async () => {
      try {
        const summaries = await assistantMemoryService.listConversations({ limit: 30 });
        if (!isCancelled && isConversationAsyncTokenCurrent(requestToken)) {
          setConversationSummaries(summaries);
        }
        if (isCancelled || !isConversationAsyncTokenCurrent(requestToken)) return;
        setRouteClarificationPending(false);
        setPendingAmbiguousTranscript(null);
        setVoiceLogDraft(null);
        setVoiceLogExpectedField(null);
        setVoiceLogClarifyAttempts(0);
        setClearedVoiceLogDraft(null);
        if (clearDraftTimeoutRef.current) {
          clearTimeout(clearDraftTimeoutRef.current);
          clearDraftTimeoutRef.current = null;
        }

        const farmFilteredSummaries = contextFarm
          ? summaries.filter((s) => s.farmId === contextFarm.id)
          : summaries;
        const latestConversation = farmFilteredSummaries[0];
        if (latestConversation) {
          const history = await assistantMemoryService.loadRecentMessages(
            latestConversation.id,
            50,
          );
          if (isCancelled || !isConversationAsyncTokenCurrent(requestToken)) return;
          setConversationId(latestConversation.id);
          setMessages(history);
          setSuggestions([]);
          scrollToBottom();
        } else {
          setConversationId(null);
          setMessages([]);
          setSuggestions(DEFAULT_SUGGESTIONS);
        }
      } catch (error) {
        if (isCancelled || !isConversationAsyncTokenCurrent(requestToken)) return;
        if (__DEV__) {
          console.warn('Conversation bootstrap failed:', error);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: t('ai.conversationBootstrapFailed'),
            timestamp: new Date(),
          } as ChatMessage,
        ]);
      }
    };

    void bootstrapConversation();

    return () => {
      isCancelled = true;
    };
  }, [
    DEFAULT_SUGGESTIONS,
    beginConversationAsyncAction,
    cancelInFlightAssistantRequest,
    contextFarm,
    isConversationAsyncTokenCurrent,
    languageCode,
    parsedFarmId,
    t,
  ]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ============================================================
  // MARK: - Simplified Voice Recording Flow
  // ============================================================

  /**
   * Start recording audio for voice input.
   * This is a clean implementation that:
   * 1. Requests permissions
   * 2. Sets up audio mode
   * 3. Prepares and starts recording
   * 4. Updates state to show recording indicator
   */
  const startVoiceRecording = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setVoiceModeError(t('ai.voice.unavailableBody'));
      return false;
    }

    // Prevent starting if already processing
    if (isProcessingVoiceRef.current || voiceInputState !== 'idle') {
      return false;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceModeError(t('ai.voice.permissionBody'));
        promptOpenSettings(t('ai.voice.permissionTitle'), t('ai.voice.permissionBody'), t);
        return false;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });

      await voiceRecorder.prepareToRecordAsync();
      voiceRecorder.record();
      voiceRecordingStartTimeRef.current = Date.now();
      setVoiceInputState('recording');
      setVoiceModeError(null);
      setVoiceModeNotice(null);
      setLiveVoiceTranscript('');

      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn('Voice recording start failed:', error);
      }
      setVoiceModeError(t('ai.voice.unavailableBody'));
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: false,
        });
      } catch {
        // no-op
      }
      return false;
    }
  }, [t, voiceRecorder, voiceInputState]);

  /**
   * Stop recording and capture the audio payload.
   * Returns the base64 encoded audio and metadata.
   */
  const stopVoiceRecordingAndCapture = useCallback(
    async (options?: { discard?: boolean }): Promise<VoiceAudioPayload | null> => {
      if (isProcessingVoiceRef.current && !options?.discard) {
        return null;
      }

      isProcessingVoiceRef.current = true;

      try {
        const startTime = voiceRecordingStartTimeRef.current;
        const recordingDuration = startTime ? Date.now() - startTime : 0;

        // Stop the recording
        await voiceRecorder.stop();

        // Clear the start time immediately
        voiceRecordingStartTimeRef.current = null;

        // If discarding, reset state and return early
        if (options?.discard) {
          setVoiceInputState('idle');
          setLiveVoiceTranscript('');
          return null;
        }

        // Get the recording URI
        const status = voiceRecorder.getStatus();
        let uri = voiceRecorder.uri ?? status.url;
        let durationMs =
          typeof status.durationMillis === 'number' ? status.durationMillis : recordingDuration;

        // Wait for URI to be available (some devices need a moment)
        for (let attempt = 0; attempt < 10 && !uri; attempt++) {
          await sleep(100);
          const newStatus = voiceRecorder.getStatus();
          uri = voiceRecorder.uri ?? newStatus.url;
          if (!durationMs && typeof newStatus.durationMillis === 'number') {
            durationMs = newStatus.durationMillis;
          }
        }

        if (!uri) {
          setVoiceModeError(t('ai.voice.recordingTooShortBody'));
          setVoiceInputState('idle');
          return null;
        }

        // Wait for file to be fully written
        for (let attempt = 0; attempt < 15; attempt++) {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && typeof info.size === 'number' && info.size > 0) {
            break;
          }
          await sleep(100);
        }

        // Read the audio file as base64
        const inputAudioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });

        if (!inputAudioBase64.trim()) {
          setVoiceModeError(t('ai.voice.recordingTooShortBody'));
          setVoiceInputState('idle');
          return null;
        }

        const audioFormat = inferAudioMimeType(uri);

        if (__DEV__) {
          const estimatedBytes = estimateBase64Bytes(inputAudioBase64);
          console.log(
            `[Voice capture] format=${audioFormat} durationMs=${durationMs} base64len=${inputAudioBase64.length} estimatedBytes=${estimatedBytes}`,
          );
        }

        return {
          inputAudioBase64,
          audioFormat,
          durationMs,
        };
      } catch (error) {
        if (__DEV__) {
          console.warn('Voice recording stop failed:', error);
        }
        setVoiceModeError(t('ai.voice.unavailableBody'));
        setVoiceInputState('idle');
        return null;
      } finally {
        isProcessingVoiceRef.current = false;
        // Reset audio mode to allow playback
        try {
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
            shouldRouteThroughEarpiece: false,
            shouldPlayInBackground: false,
          });
        } catch {
          // no-op
        }
      }
    },
    [t, voiceRecorder],
  );

  /**
   * Send the recorded voice audio to the server for STT and AI processing.
   * This is the main entry point for voice-based queries.
   */
  const sendVoiceAudioToServer = useCallback(
    async (voicePayload: VoiceAudioPayload) => {
      const validation = validateVoiceAudioPayload(voicePayload);

      if (!validation.ok) {
        if (__DEV__) {
          console.warn(
            '[Voice payload rejected]',
            formatVoicePayloadDebug({
              reason: validation.reason,
              durationMs: voicePayload.durationMs,
              base64Length: voicePayload.inputAudioBase64.length,
              estimatedBytes: validation.estimatedBytes,
            }),
          );
        }

        telemetry.capture('voice_payload_rejected', {
          reason: validation.reason ?? 'unknown',
          duration_ms: voicePayload.durationMs ?? null,
          base64_length: voicePayload.inputAudioBase64.length,
          estimated_bytes: validation.estimatedBytes ?? null,
        });

        setVoiceModeError(t('ai.voice.recordingTooShortBody'));
        setVoiceInputState('idle');
        return;
      }

      setVoiceInputState('processing');
      setLiveVoiceTranscript(t('ai.voice.processing', { defaultValue: 'Processing...' }));

      // Send to server - the server will:
      // 1. Transcribe the audio (STT)
      // 2. Process with LLM
      // 3. Generate TTS response
      // 4. Return transcript, AI response, and audio
      void sendMessageRef.current?.(
        '', // No text - server will get transcript from audio
        'voice',
        voicePayload,
      );
    },
    [t],
  );

  /**
   * Discard the current voice recording without sending.
   */
  const discardVoiceRecording = useCallback(async () => {
    if (voiceInputState === 'recording') {
      await stopVoiceRecordingAndCapture({ discard: true });
    }
    setVoiceInputState('idle');
    setLiveVoiceTranscript('');
    setVoiceModeError(null);
  }, [voiceInputState, stopVoiceRecordingAndCapture]);

  /**
   * Handle TTS completion - auto-start recording in conversation mode.
   * This enables hands-free back-and-forth like ChatGPT/Claude voice mode.
   */
  const handleTTSComplete = useCallback(() => {
    if (
      !isVoiceModeVisible ||
      voiceConversationMode !== 'auto' ||
      voiceInputState !== 'idle' ||
      isLoading
    ) {
      return;
    }
    // Small delay for natural conversation feel
    setTimeout(() => {
      if (
        isVoiceModeVisible &&
        voiceConversationMode === 'auto' &&
        voiceInputState === 'idle' &&
        !isLoading &&
        !isAssistantSpeaking
      ) {
        void startVoiceRecording();
      }
    }, 500);
  }, [
    isVoiceModeVisible,
    voiceConversationMode,
    voiceInputState,
    isLoading,
    isAssistantSpeaking,
    startVoiceRecording,
  ]);

  const handleSendMessage = useCallback(
    async (
      text?: string,
      source: 'text' | 'voice' = 'text',
      voicePayload?: VoiceAudioPayload | null,
      options?: { overrideAttachments?: ChatAttachment[] },
    ) => {
      const rawMessageText = text ?? inputText.trim();
      const currentAttachments = options?.overrideAttachments ?? attachments;
      const canSendAudioOnly = source === 'voice' && Boolean(voicePayload);
      if ((!rawMessageText && currentAttachments.length === 0 && !canSendAudioOnly) || isLoading) {
        return;
      }
      setFailedRequest(null);
      if (source === 'voice') {
        setVoiceModeNotice(null);
      }
      if (isAssistantSpeaking) {
        void voiceOutputService.stop();
        setIsAssistantSpeaking(false);
      }
      const attachmentSummary = formatAttachmentSummary(currentAttachments);
      const messageText = rawMessageText;
      const assistantInput = messageText.trim();
      const voiceUploadBytes =
        source === 'voice' ? estimateBase64Bytes(voicePayload?.inputAudioBase64 ?? null) : null;
      const visibleUserContent = [messageText, attachmentSummary]
        .filter(Boolean)
        .join('\n\n')
        .trim();

      // For voice input with audio payload, the server will return the transcript
      const persistedUserContent =
        visibleUserContent ||
        (source === 'voice' ? t('ai.voice.voiceMessage', { defaultValue: 'Voice message' }) : '');

      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: persistedUserContent,
        timestamp: new Date(),
      };

      if (source === 'voice') {
        setLiveVoiceTranscript('');
        setVoiceInputState('processing');
      }

      setMessages((prev) => [...prev, newMessage]);
      setInputText('');
      setAttachments([]);
      setSuggestions([]);
      setIsLoading(true);
      setLastAssistantDiagnostics(null);
      scrollToBottom();
      const conversationActionToken = beginConversationAsyncAction();
      const isStaleConversationAction = () =>
        !isConversationAsyncTokenCurrent(conversationActionToken);

      telemetry.capture('ai_request_made', {
        ai_use_case: 'chat',
        language: i18n.language,
        input_method: source,
        voice_capture_duration_ms: source === 'voice' ? (voicePayload?.durationMs ?? null) : null,
        voice_upload_bytes: voiceUploadBytes,
      });

      try {
        const requestInputMode: AssistantInputMode =
          source === 'voice' && Boolean(voicePayload?.inputAudioBase64) ? 'audio' : 'text';
        const shouldAttachVoiceAudio = requestInputMode === 'audio';
        let activeConversationId = conversationId;
        if (assistantFeatureFlags.memoryEnabled && !activeConversationId) {
          activeConversationId = await assistantMemoryService.createConversation({
            farmId: contextFarm?.id ?? parsedFarmId ?? null,
            locale: languageCode,
          });
          if (isStaleConversationAction()) return;
          if (activeConversationId) {
            setConversationId(activeConversationId);
          }
        }

        let userTurnPersistedClient = false;
        if (activeConversationId) {
          userTurnPersistedClient = await assistantMemoryService.persistTurn({
            conversationId: activeConversationId,
            farmId: contextFarm?.id ?? parsedFarmId ?? null,
            role: 'user',
            content: persistedUserContent,
            inputMode: requestInputMode,
          });
          if (isStaleConversationAction()) return;
        }

        const deterministicTranscript = contextFarm?.name
          ? `${assistantInput} for farm ${contextFarm.name}`
          : assistantInput;
        let llmFallbackInput = assistantInput;

        const deterministicIntent = classifyIntent(deterministicTranscript, candidateFarms);
        let didAttemptRouting = false;
        const persistLocalRoutingAssistantReply = async (content: string) => {
          if (!activeConversationId || !content.trim()) return;
          await assistantMemoryService.persistTurn({
            conversationId: activeConversationId,
            farmId: contextFarm?.id ?? parsedFarmId ?? null,
            role: 'assistant',
            content,
            inputMode: 'text',
            provider: 'client_router',
            model: 'local_route_handler',
          });
        };

        if (
          !assistantFeatureFlags.routeOnServerEnabled &&
          currentAttachments.length === 0 &&
          messageText.trim()
        ) {
          didAttemptRouting = true;
          let forcedRoute: 'voice_log' | 'farm_query' | null = null;
          let effectiveTranscript = messageText;

          if (routeClarificationPending) {
            const clarifiedRoute = resolveRouteClarificationResponse(messageText);
            if (!clarifiedRoute) {
              if (isRouteClarificationCancelResponse(messageText)) {
                setRouteClarificationPending(false);
                setPendingAmbiguousTranscript(null);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: t('ai.logging.routeClarification.cancelled'),
                    timestamp: new Date(),
                  },
                ]);
                scrollToBottom();
                await persistLocalRoutingAssistantReply(
                  t('ai.logging.routeClarification.cancelled'),
                );
                return;
              }

              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: t('ai.logging.routeClarification.retry'),
                  timestamp: new Date(),
                },
              ]);
              scrollToBottom();
              await persistLocalRoutingAssistantReply(t('ai.logging.routeClarification.retry'));
              return;
            }

            forcedRoute = clarifiedRoute;
            setRouteClarificationPending(false);
            if (pendingAmbiguousTranscript) {
              effectiveTranscript = pendingAmbiguousTranscript;
              setPendingAmbiguousTranscript(null);
            }
            telemetry.capture('chat_route_clarified', {
              source,
              clarified_route: clarifiedRoute,
            });
          }
          llmFallbackInput = effectiveTranscript;

          const shouldTryVoiceLogExtraction = shouldAttemptVoiceLogExtraction(
            effectiveTranscript,
            Boolean(voiceLogDraft),
          );
          const llmExtraction = shouldTryVoiceLogExtraction
            ? forcedRoute
              ? null
              : await aiService.extractActivityLoggingIntent({
                  transcript: effectiveTranscript,
                  language: languageCode,
                  farmNames: farms.map((farmItem) => farmItem.name),
                  contextFarmName: contextFarm?.name ?? null,
                })
            : null;
          if (isStaleConversationAction()) return;

          const chatRoute =
            forcedRoute ??
            decideChatRoute({
              transcript: effectiveTranscript,
              hasActiveDraft: Boolean(voiceLogDraft),
              llmExtraction,
              deterministicQueryIntent: deterministicIntent,
            });

          if (chatRoute === 'clarify_route') {
            setRouteClarificationPending(true);
            setPendingAmbiguousTranscript(effectiveTranscript);
            telemetry.capture('chat_route_conflict', {
              source,
              llm_intent: llmExtraction?.intent ?? null,
              llm_intent_confidence: llmExtraction?.intentConfidence ?? null,
              deterministic_category: deterministicIntent.category,
              deterministic_confidence: deterministicIntent.confidence,
            });
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content: t('ai.logging.routeClarification.prompt'),
                timestamp: new Date(),
              },
            ]);
            scrollToBottom();
            await persistLocalRoutingAssistantReply(t('ai.logging.routeClarification.prompt'));
            return;
          }

          telemetry.capture('chat_route_selected', {
            source,
            route: chatRoute,
            has_active_draft: Boolean(voiceLogDraft),
            llm_intent: llmExtraction?.intent ?? null,
            llm_intent_confidence: llmExtraction?.intentConfidence ?? null,
            deterministic_category: deterministicIntent.category,
            deterministic_confidence: deterministicIntent.confidence,
            forced_route: forcedRoute,
          });

          if (chatRoute === 'voice_log') {
            const logTurn = resolveVoiceLogTurn({
              transcript: effectiveTranscript,
              farms,
              contextFarm,
              activeDraft: voiceLogDraft,
              originContext: voiceLogOriginContext,
              llmExtraction,
              expectedField: voiceLogExpectedField,
            });

            if (logTurn.kind === 'cancelled') {
              telemetry.capture('voice_log_cancelled', {
                source,
                has_context_farm: Boolean(contextFarm?.id),
              });
              setVoiceLogDraft(null);
              setVoiceLogExpectedField(null);
              setVoiceLogClarifyAttempts(0);
              hideClearedDraftNotice();
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: t('ai.logging.cancelled'),
                  timestamp: new Date(),
                },
              ]);
              scrollToBottom();
              await persistLocalRoutingAssistantReply(t('ai.logging.cancelled'));
              return;
            }

            if (logTurn.kind === 'clarify') {
              if (
                logTurn.missingFields.includes('farm') &&
                farms.filter(
                  (farmCandidate) => farmCandidate.id !== undefined && farmCandidate.id !== null,
                ).length === 0
              ) {
                setVoiceLogDraft(null);
                setVoiceLogExpectedField(null);
                setVoiceLogClarifyAttempts(0);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: t('ai.logging.noFarms'),
                    timestamp: new Date(),
                  },
                ]);
                scrollToBottom();
                await persistLocalRoutingAssistantReply(t('ai.logging.noFarms'));
                return;
              }

              const previousMissing = voiceLogDraft
                ? getVoiceLogMissingFields(voiceLogDraft)
                : null;
              const madeProgress =
                !previousMissing ||
                logTurn.missingFields.length < previousMissing.length ||
                logTurn.missingFields.join(',') !== previousMissing.join(',');
              const nextAttempts = madeProgress ? 0 : voiceLogClarifyAttempts + 1;

              const MAX_CLARIFY_ATTEMPTS = 3;
              if (voiceLogDraft && nextAttempts >= MAX_CLARIFY_ATTEMPTS) {
                telemetry.capture('voice_log_clarify_exhausted', {
                  source,
                  missing_fields: logTurn.missingFields.join(','),
                  activity_type: logTurn.draft.type,
                });
                setVoiceLogDraft(null);
                setVoiceLogExpectedField(null);
                setVoiceLogClarifyAttempts(0);
                hideClearedDraftNotice();
                const voicePrefill = buildVoiceLogFormPrefill(logTurn.draft);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: t('ai.logging.clarifyExhausted'),
                    timestamp: new Date(),
                  },
                ]);
                scrollToBottom();
                await persistLocalRoutingAssistantReply(t('ai.logging.clarifyExhausted'));

                setAddEntry({
                  tabs: ['log'],
                  initialTab: 'log',
                  initialFarmId: logTurn.draft.farmId,
                  initialLogType: logTurn.draft.type,
                  initialIrrigationDurationHours:
                    logTurn.draft.type === 'irrigation'
                      ? logTurn.draft.irrigation.durationHours
                      : null,
                  initialLogDate: logTurn.draft.date,
                  voiceLogPrefill: voicePrefill,
                  entrySource: 'voice_ai',
                });

                router.push({
                  pathname: '/add-entry',
                  params: {
                    ...(logTurn.draft.farmId != null
                      ? { farmId: String(logTurn.draft.farmId) }
                      : {}),
                    initialTab: 'log',
                    tabs: 'log',
                    initialLogType: logTurn.draft.type,
                    initialLogDate: logTurn.draft.date,
                    entrySource: 'voice_ai',
                  },
                });
                return;
              }

              if (!voiceLogDraft) {
                telemetry.capture('voice_log_started', {
                  source,
                  has_context_farm: Boolean(contextFarm?.id),
                  extraction_confidence: llmExtraction?.confidence ?? null,
                });
              }
              telemetry.capture('voice_log_clarified', {
                source,
                missing_fields: logTurn.missingFields.join(','),
                activity_type: logTurn.draft.type,
              });
              hideClearedDraftNotice();
              setVoiceLogDraft(logTurn.draft);
              setVoiceLogExpectedField(logTurn.missingFields[0] ?? null);
              setVoiceLogClarifyAttempts(nextAttempts);
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: buildVoiceLogClarificationMessage(t, logTurn.missingFields),
                  timestamp: new Date(),
                },
              ]);
              scrollToBottom();
              await persistLocalRoutingAssistantReply(
                buildVoiceLogClarificationMessage(t, logTurn.missingFields),
              );
              return;
            }

            if (logTurn.kind === 'ready') {
              if (!voiceLogDraft) {
                telemetry.capture('voice_log_started', {
                  source,
                  has_context_farm: Boolean(contextFarm?.id),
                  extraction_confidence: llmExtraction?.confidence ?? null,
                });
              }
              telemetry.capture('voice_log_handoff', {
                source,
                farm_id: logTurn.draft.farmId,
                activity_type: logTurn.draft.type,
              });
              setVoiceLogDraft(null);
              setVoiceLogExpectedField(null);
              setVoiceLogClarifyAttempts(0);
              hideClearedDraftNotice();
              const voicePrefill = buildVoiceLogFormPrefill(logTurn.draft);
              const farmName = logTurn.draft.farmName ?? t('tasks.unknownFarm');
              const displayDate = formatDate(parseLocalDate(logTurn.draft.date), {
                month: 'short',
                day: 'numeric',
              });

              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: t('ai.logging.openingForm', {
                    type: t(`logs.types.${logTurn.draft.type}`),
                    farm: farmName,
                    date: displayDate,
                  }),
                  timestamp: new Date(),
                },
              ]);
              scrollToBottom();
              await persistLocalRoutingAssistantReply(
                t('ai.logging.openingForm', {
                  type: t(`logs.types.${logTurn.draft.type}`),
                  farm: farmName,
                  date: displayDate,
                }),
              );

              setAddEntry({
                tabs: ['log'],
                initialTab: 'log',
                initialFarmId: logTurn.draft.farmId,
                initialLogType: logTurn.draft.type,
                initialIrrigationDurationHours:
                  logTurn.draft.type === 'irrigation'
                    ? logTurn.draft.irrigation.durationHours
                    : null,
                initialLogDate: logTurn.draft.date,
                voiceLogPrefill: voicePrefill,
                entrySource: 'voice_ai',
              });

              router.push({
                pathname: '/add-entry',
                params: {
                  ...(logTurn.draft.farmId != null ? { farmId: String(logTurn.draft.farmId) } : {}),
                  initialTab: 'log',
                  tabs: 'log',
                  initialLogType: logTurn.draft.type,
                  initialIrrigationDurationHours:
                    logTurn.draft.type === 'irrigation'
                      ? String(logTurn.draft.irrigation.durationHours ?? '')
                      : undefined,
                  initialLogDate: logTurn.draft.date,
                  entrySource: 'voice_ai',
                },
              });
              return;
            }
          }

          if (chatRoute === 'farm_query' && candidateFarms.length > 0) {
            try {
              const queryText = contextFarm?.name
                ? `${effectiveTranscript} for farm ${contextFarm.name}`
                : effectiveTranscript;

              const farmDataResponse = await executeQuery(queryText, candidateFarms, languageCode);
              if (isStaleConversationAction()) return;

              const content =
                farmDataResponse.answer.verbalizedText ??
                formatFarmDataAnswer(farmDataResponse.answer);

              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content,
                  inputMode: source === 'voice' ? 'audio' : 'text',
                  timestamp: new Date(),
                },
              ]);
              setSuggestions(DEFAULT_SUGGESTIONS);
              setLastAssistantDiagnostics({
                source: 'farm_records',
                routeDecision: 'farm_query',
                providerUsed: 'farm_records',
                modelUsed: 'deterministic_query_engine',
                latencyMs: null,
                voiceCaptureDurationMs:
                  source === 'voice' ? (voicePayload?.durationMs ?? null) : null,
                voiceUploadBytes,
              });

              telemetry.capture('ai_result_received', {
                ai_use_case: 'chat',
                confidence_score: null,
                response_source: 'farm_records',
              });

              if (activeConversationId) {
                void assistantMemoryService.persistTurn({
                  conversationId: activeConversationId,
                  farmId: contextFarm?.id ?? parsedFarmId ?? null,
                  role: 'assistant',
                  content,
                  inputMode: 'text',
                  provider: 'farm_records',
                  model: 'deterministic_query_engine',
                });
              }

              if (source === 'voice') {
                void voiceOutputService.playAssistantTurn(
                  {
                    message: {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content,
                      timestamp: new Date(),
                      conversationId: activeConversationId ?? undefined,
                    },
                  },
                  {
                    language: languageCode,
                    rate: 1,
                    onStateChange: setIsAssistantSpeaking,
                    onDone: handleTTSComplete,
                    allowDeviceFallback: false,
                    onError: () => setVoiceModeNotice(t('ai.voice.replyVoiceUnavailable')),
                  },
                );
              }

              scrollToBottom();
              return;
            } catch (error) {
              if (__DEV__) {
                console.warn('Farm data engine failed, falling back to LLM:', error);
              }
            }
          }
        }

        if (
          !didAttemptRouting &&
          !assistantFeatureFlags.routeOnServerEnabled &&
          currentAttachments.length === 0 &&
          shouldUseFarmDataEngine(messageText, deterministicIntent) &&
          candidateFarms.length > 0
        ) {
          try {
            const farmDataResponse = await executeQuery(
              deterministicTranscript,
              candidateFarms,
              languageCode,
            );
            if (isStaleConversationAction()) return;

            const content =
              farmDataResponse.answer.verbalizedText ??
              formatFarmDataAnswer(farmDataResponse.answer);

            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content,
                inputMode: source === 'voice' ? 'audio' : 'text',
                timestamp: new Date(),
              },
            ]);
            setSuggestions(DEFAULT_SUGGESTIONS);
            setLastAssistantDiagnostics({
              source: 'farm_records',
              routeDecision: 'farm_query',
              providerUsed: 'farm_records',
              modelUsed: 'deterministic_query_engine',
              latencyMs: null,
              voiceCaptureDurationMs:
                source === 'voice' ? (voicePayload?.durationMs ?? null) : null,
              voiceUploadBytes,
            });

            telemetry.capture('ai_result_received', {
              ai_use_case: 'chat',
              confidence_score: null,
              response_source: 'farm_records',
            });

            if (activeConversationId) {
              void assistantMemoryService.persistTurn({
                conversationId: activeConversationId,
                farmId: contextFarm?.id ?? parsedFarmId ?? null,
                role: 'assistant',
                content,
                inputMode: 'text',
                provider: 'farm_records',
                model: 'deterministic_query_engine',
              });
            }

            if (source === 'voice') {
              void voiceOutputService.playAssistantTurn(
                {
                  message: {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content,
                    timestamp: new Date(),
                    conversationId: activeConversationId ?? undefined,
                  },
                },
                {
                  language: languageCode,
                  rate: 1,
                  onStateChange: setIsAssistantSpeaking,
                  onDone: handleTTSComplete,
                  allowDeviceFallback: false,
                  onError: () => setVoiceModeNotice(t('ai.voice.replyVoiceUnavailable')),
                },
              );
            }

            scrollToBottom();
            return;
          } catch (error) {
            if (__DEV__) {
              console.warn('Farm data engine failed, falling back to LLM:', error);
            }
          }
        }

        const aiAttachments = await prepareAttachmentsForAI(currentAttachments);
        if (isStaleConversationAction()) return;
        const assistantRequestId = `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const assistantRequestAbortController = new AbortController();
        activeAssistantRequestIdRef.current = assistantRequestId;
        activeAssistantAbortControllerRef.current = assistantRequestAbortController;
        const response = await sendAssistantTurn(
          {
            conversationId: activeConversationId,
            userMessage: llmFallbackInput,
            language: languageCode,
            inputMode: requestInputMode,
            clientCanPlayAudio: source === 'voice',
            inputAudioBase64: shouldAttachVoiceAudio
              ? (voicePayload?.inputAudioBase64 ?? null)
              : null,
            audioFormat: shouldAttachVoiceAudio ? (voicePayload?.audioFormat ?? null) : null,
            audioDuration:
              shouldAttachVoiceAudio && typeof voicePayload?.durationMs === 'number'
                ? voicePayload.durationMs / 1000
                : null,
            attachments: aiAttachments,
            conversationHistory: messages,
            clientPersistedUserTurn: userTurnPersistedClient,
            farmContext: {
              farmId: contextFarm?.id ?? null,
              farmName: contextFarm?.name,
              cropVariety: contextFarm?.crop_variety || contextFarm?.crop,
              area: contextFarm?.area,
              region: contextFarm?.region,
              daysSincePruning: contextFarm?.date_of_pruning
                ? Math.floor(
                    (new Date().getTime() - new Date(contextFarm.date_of_pruning).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : undefined,
            },
          },
          {
            requestId: assistantRequestId,
            signal: assistantRequestAbortController.signal,
          },
        );
        if (isStaleConversationAction()) return;

        const resolvedConversationId =
          response.message.conversationId ?? activeConversationId ?? null;
        if (resolvedConversationId && resolvedConversationId !== conversationId) {
          setConversationId(resolvedConversationId);
        }

        const assistantMessage = {
          ...response.message,
          conversationId: resolvedConversationId ?? undefined,
        };

        const serverVoiceLogAction = assistantFeatureFlags.routeOnServerEnabled
          ? (response.voiceLogAction ?? null)
          : null;
        const serverReadyDraft =
          serverVoiceLogAction?.kind === 'ready' && serverVoiceLogAction.draft
            ? serverVoiceLogAction.draft
            : null;

        if (assistantFeatureFlags.routeOnServerEnabled) {
          if (response.routeDecision === 'clarify_route') {
            setRouteClarificationPending(true);
            setPendingAmbiguousTranscript(llmFallbackInput);
          } else {
            setRouteClarificationPending(false);
            setPendingAmbiguousTranscript(null);
          }

          if (serverVoiceLogAction?.kind === 'cancelled') {
            setVoiceLogDraft(null);
            setVoiceLogExpectedField(null);
            setVoiceLogClarifyAttempts(0);
            hideClearedDraftNotice();
          } else if (serverVoiceLogAction?.kind === 'clarify' && serverVoiceLogAction.draft) {
            hideClearedDraftNotice();
            setVoiceLogDraft(serverVoiceLogAction.draft);
            setVoiceLogExpectedField(
              serverVoiceLogAction.expectedField ?? serverVoiceLogAction.missingFields?.[0] ?? null,
            );
            setVoiceLogClarifyAttempts(serverVoiceLogAction.clarifyAttempts ?? 0);
          } else if (serverVoiceLogAction?.kind === 'ready') {
            setVoiceLogDraft(null);
            setVoiceLogExpectedField(null);
            setVoiceLogClarifyAttempts(0);
            hideClearedDraftNotice();
          }
        }

        if (response.sttTranscript && source === 'voice') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === newMessage.id ? { ...msg, content: response.sttTranscript! } : msg,
            ),
          );
        }

        setMessages((prev) => [...prev, assistantMessage]);
        setSuggestions(response.suggestions || DEFAULT_SUGGESTIONS);
        setLastAssistantDiagnostics({
          source: response.providerUsed ?? 'ai_gateway',
          traceId: response.traceId ?? null,
          routeDecision: response.routeDecision ?? null,
          providerUsed: response.providerUsed ?? null,
          modelUsed: response.modelUsed ?? null,
          latencyMs: response.latencyMs ?? null,
          voiceCaptureDurationMs: source === 'voice' ? (voicePayload?.durationMs ?? null) : null,
          voiceUploadBytes,
          sttProviderUsed: response.sttProviderUsed ?? null,
          sttConfidence: response.sttConfidence ?? null,
          sttLatencyMs: response.sttLatencyMs ?? null,
          ttsGenerationMs: response.ttsGenerationMs ?? null,
          ttsSkippedReason: response.ttsSkippedReason ?? null,
          fallbackReason: response.providerFallbackReason ?? null,
        });

        telemetry.capture('ai_result_received', {
          ai_use_case: 'chat',
          confidence_score: null,
          response_source: response.providerUsed ?? 'ai_gateway',
          trace_id: response.traceId ?? null,
          latency_ms: response.latencyMs ?? null,
          tool_call_count: response.toolCalls?.length ?? 0,
          model_used: response.modelUsed ?? null,
          voice_audio_attached: shouldAttachVoiceAudio,
          route_decision: response.routeDecision ?? null,
          voice_capture_duration_ms: source === 'voice' ? (voicePayload?.durationMs ?? null) : null,
          voice_upload_bytes: voiceUploadBytes,
          stt_provider_used: response.sttProviderUsed ?? null,
          stt_confidence: response.sttConfidence ?? null,
          stt_latency_ms: response.sttLatencyMs ?? null,
          tts_generation_ms: response.ttsGenerationMs ?? null,
          tts_skipped_reason: response.ttsSkippedReason ?? null,
          provider_fallback_reason: response.providerFallbackReason ?? null,
        });

        const shouldPersistAssistantTurnClient =
          !assistantFeatureFlags.serverVoiceEnabled || response.providerUsed === 'openai-proxy';

        if (resolvedConversationId && shouldPersistAssistantTurnClient) {
          void assistantMemoryService.persistTurn({
            conversationId: resolvedConversationId,
            farmId: contextFarm?.id ?? parsedFarmId ?? null,
            role: 'assistant',
            content: assistantMessage.content,
            inputMode: 'text',
            traceId: response.traceId ?? null,
            latencyMs: response.latencyMs ?? null,
            citations: response.message.citations ?? [],
            safety: response.message.safety ?? null,
            provider: response.providerUsed ?? null,
            model: response.modelUsed ?? null,
          });

          if (assistantFeatureFlags.memoryEnabled && assistantMessage.content.trim()) {
            void assistantMemoryService.writeMemoryFact({
              conversationId: resolvedConversationId,
              farmId: contextFarm?.id ?? parsedFarmId ?? null,
              memoryType: 'summary',
              content: `${assistantInput.slice(0, 120)} -> ${assistantMessage.content.slice(0, 200)}`,
              metadata: {
                trace_id: response.traceId ?? null,
                source: 'ai_chat_screen',
              },
              importance: 0.4,
            });
          }
        }

        if (assistantFeatureFlags.routeOnServerEnabled && serverReadyDraft) {
          const voicePrefill = buildVoiceLogFormPrefill(serverReadyDraft);
          setAddEntry({
            tabs: ['log'],
            initialTab: 'log',
            initialFarmId: serverReadyDraft.farmId,
            initialLogType: serverReadyDraft.type,
            initialIrrigationDurationHours:
              serverReadyDraft.type === 'irrigation'
                ? serverReadyDraft.irrigation.durationHours
                : null,
            initialLogDate: serverReadyDraft.date,
            voiceLogPrefill: voicePrefill,
            entrySource: 'voice_ai',
          });

          router.push({
            pathname: '/add-entry',
            params: {
              ...(serverReadyDraft.farmId != null
                ? { farmId: String(serverReadyDraft.farmId) }
                : {}),
              initialTab: 'log',
              tabs: 'log',
              initialLogType: serverReadyDraft.type,
              initialIrrigationDurationHours:
                serverReadyDraft.type === 'irrigation'
                  ? String(serverReadyDraft.irrigation.durationHours ?? '')
                  : undefined,
              initialLogDate: serverReadyDraft.date,
              entrySource: 'voice_ai',
            },
          });
        }

        if (!serverReadyDraft && source === 'voice') {
          void voiceOutputService.playAssistantTurn(response, {
            language: languageCode,
            rate: 1,
            onStateChange: setIsAssistantSpeaking,
            onDone: handleTTSComplete,
            allowDeviceFallback: false,
            onError: () => {
              setVoiceModeNotice(t('ai.voice.replyVoiceUnavailable'));
              if (__DEV__) {
                console.warn(
                  'Assistant voice playback skipped because provider audio was unavailable',
                  {
                    provider: response.providerUsed ?? null,
                    ttsSkippedReason: response.ttsSkippedReason ?? null,
                    fallbackReason: response.providerFallbackReason ?? null,
                  },
                );
              }
            },
          });
        }

        scrollToBottom();
      } catch (error) {
        if (isStaleConversationAction()) return;
        const requestWasCancelled =
          error instanceof AssistantGatewayError &&
          error.code === AssistantGatewayErrorCode.CANCELED;
        if (requestWasCancelled) {
          return;
        }
        const invalidVoicePayload =
          error instanceof AssistantGatewayError &&
          error.code === AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED;
        if (source === 'voice') {
          setIsVoiceModeMicEnabled(false);
          void discardVoiceRecording();
          setVoiceModeError(
            invalidVoicePayload
              ? t('ai.voice.recordingTooShortBody')
              : error instanceof Error
                ? error.message
                : t('ai.errors.failedResponse'),
          );
        }
        if (invalidVoicePayload) {
          Alert.alert(t('ai.voice.recordingTooShortTitle'), t('ai.voice.recordingTooShortBody'), [
            { text: t('common.ok') },
          ]);
          return;
        }
        setFailedRequest({
          text: messageText,
          source,
          voicePayload: source === 'voice' ? (voicePayload ?? null) : null,
          attachments: [...currentAttachments],
        });
        const message = error instanceof Error ? error.message : t('ai.errors.failedResponse');
        if (__DEV__) {
          console.error('AI chat request failed:', error);
          Alert.alert('AI Gateway Debug', message, [{ text: t('common.ok') }]);
          return;
        }
        Alert.alert(t('common.error'), message, [{ text: t('common.ok') }]);
      } finally {
        if (!isStaleConversationAction()) {
          activeAssistantRequestIdRef.current = null;
          activeAssistantAbortControllerRef.current = null;
          setIsLoading(false);
          if (assistantFeatureFlags.memoryEnabled) {
            void refreshConversationHistory();
          }
        }
      }
    },
    [
      DEFAULT_SUGGESTIONS,
      attachments,
      beginConversationAsyncAction,
      candidateFarms,
      conversationId,
      contextFarm,
      farms,
      i18n.language,
      languageCode,
      inputText,
      isAssistantSpeaking,
      isConversationAsyncTokenCurrent,
      isLoading,
      messages,
      parsedFarmId,
      router,
      routeClarificationPending,
      setAddEntry,
      t,
      hideClearedDraftNotice,
      voiceLogOriginContext,
      voiceLogDraft,
      voiceLogExpectedField,
      voiceLogClarifyAttempts,
      pendingAmbiguousTranscript,
      discardVoiceRecording,
      refreshConversationHistory,
      handleTTSComplete,
    ],
  );

  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (voiceModeStartTimeoutRef.current) {
          clearTimeout(voiceModeStartTimeoutRef.current);
          voiceModeStartTimeoutRef.current = null;
        }
        cancelInFlightAssistantRequest();
        if (voiceRecordingStartTimeRef.current) {
          try {
            await voiceRecorder.stop();
          } catch {
            /* no-op */
          }
        }
        await voiceOutputService.stop();
      };
      void cleanup();
    };
  }, [cancelInFlightAssistantRequest, voiceRecorder]);

  // ============================================================
  // MARK: - Voice Mode UI Handlers
  // ============================================================

  /**
   * Open the voice mode modal and start recording.
   * In auto mode, the conversation flows hands-free.
   */
  const openVoiceMode = useCallback(() => {
    if (Platform.OS === 'web') {
      Alert.alert(t('ai.voice.unavailableTitle'), t('ai.voice.unavailableBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }
    if (voiceModeStartTimeoutRef.current) {
      clearTimeout(voiceModeStartTimeoutRef.current);
      voiceModeStartTimeoutRef.current = null;
    }
    setIsVoiceModeVisible(true);
    setIsVoiceModeMicEnabled(true);
    setVoiceConversationMode('auto'); // Hands-free conversation mode
    setVoiceModeError(null);
    setVoiceModeNotice(null);
    setLiveVoiceTranscript('');
    setVoiceInputState('idle');

    // Start recording after modal opens
    voiceModeStartTimeoutRef.current = setTimeout(() => {
      voiceModeStartTimeoutRef.current = null;
      void startVoiceRecording();
    }, 300);
  }, [t, startVoiceRecording]);

  /**
   * Close voice mode and discard any in-progress recording.
   */
  const closeVoiceMode = useCallback(async () => {
    if (voiceModeStartTimeoutRef.current) {
      clearTimeout(voiceModeStartTimeoutRef.current);
      voiceModeStartTimeoutRef.current = null;
    }
    cancelInFlightAssistantRequest();
    void voiceOutputService.stop();
    setIsAssistantSpeaking(false);

    // Discard any in-progress recording - DO NOT submit
    await discardVoiceRecording();

    setIsVoiceModeVisible(false);
    setIsVoiceModeMicEnabled(false);
    setVoiceConversationMode('auto');
    setVoiceModeError(null);
    setVoiceModeNotice(null);
    setLiveVoiceTranscript('');
  }, [cancelInFlightAssistantRequest, discardVoiceRecording]);

  /**
   * Handle close button in voice mode modal.
   */
  const handleVoiceModePrimaryAction = useCallback(() => {
    void closeVoiceMode();
  }, [closeVoiceMode]);

  /**
   * Handle mic button toggle in voice mode.
   * In auto mode: tap interrupts AI speaking, tap again stops recording.
   * In manual mode: tap to record, tap again to send.
   */
  const handleVoiceModeMicToggle = useCallback(async () => {
    // INTERRUPTION: If AI is speaking, stop it and start listening
    if (isAssistantSpeaking) {
      void voiceOutputService.stop();
      setIsAssistantSpeaking(false);
      // Start recording after brief pause
      setTimeout(() => {
        if (isVoiceModeVisible && voiceInputState === 'idle') {
          void startVoiceRecording();
        }
      }, 100);
      return;
    }

    if (isVoiceModeMicEnabled) {
      // Mic is enabled - user wants to stop recording
      if (voiceInputState === 'recording') {
        // Stop recording and send to server
        setVoiceInputState('processing');
        const payload = await stopVoiceRecordingAndCapture();
        if (payload) {
          await sendVoiceAudioToServer(payload);
        }
      } else if (voiceInputState === 'idle') {
        // Not recording - disable mic (manual mode)
        if (voiceConversationMode === 'manual') {
          setIsVoiceModeMicEnabled(false);
        }
      }
      // If processing, ignore
    } else {
      // Mic is disabled - user wants to start recording (manual mode)
      setIsVoiceModeMicEnabled(true);
      setVoiceModeError(null);
      setVoiceModeNotice(null);
      if (!isLoading && !isAssistantSpeaking && voiceInputState === 'idle') {
        await startVoiceRecording();
      }
    }
  }, [
    isVoiceModeMicEnabled,
    voiceInputState,
    voiceConversationMode,
    isLoading,
    isAssistantSpeaking,
    isVoiceModeVisible,
    startVoiceRecording,
    stopVoiceRecordingAndCapture,
    sendVoiceAudioToServer,
  ]);

  /**
   * Auto-scroll voice mode messages to bottom.
   */
  useEffect(() => {
    if (!isVoiceModeVisible) return;
    const timeout = setTimeout(() => {
      voiceModeScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timeout);
  }, [isVoiceModeVisible, messages, isLoading]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      const mimeType =
        asset.mimeType ??
        inferAttachmentMimeType({
          id: '',
          name: asset.fileName || 'image.jpg',
          uri: asset.uri,
          kind: 'image',
        });
      const fileSize = asset.fileSize ?? undefined;
      if (typeof fileSize === 'number' && fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        Alert.alert(t('common.error'), t('ai.attach.imageTooLarge'), [{ text: t('common.ok') }]);
        return;
      }
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
        Alert.alert(t('common.error'), t('ai.attach.unsupportedImageType'), [
          { text: t('common.ok') },
        ]);
        return;
      }
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (!fileInfo.exists) {
        Alert.alert(t('common.error'), t('ai.attach.imageUnavailable'), [{ text: t('common.ok') }]);
        return;
      }
      const resolvedFileSize = resolveAttachmentFileSizeBytes(fileSize, fileInfo);
      if (typeof resolvedFileSize === 'number' && resolvedFileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        Alert.alert(t('common.error'), t('ai.attach.imageTooLarge'), [{ text: t('common.ok') }]);
        return;
      }
      setAttachments((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${asset.uri}`,
          name: asset.fileName || `image-${prev.length + 1}.jpg`,
          uri: asset.uri,
          mimeType,
          size: resolvedFileSize,
          kind: 'image',
        },
      ]);
    } catch (error) {
      if (__DEV__) {
        console.warn('Image selection failed:', error);
      }
      Alert.alert(t('common.error'), t('ai.errors.failedResponse'), [{ text: t('common.ok') }]);
    }
  }, [t]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      const mimeType = asset.mimeType ?? undefined;
      const fileSize = asset.size ?? undefined;
      if (typeof fileSize === 'number' && fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        Alert.alert(t('common.error'), t('ai.attach.fileTooLarge'), [{ text: t('common.ok') }]);
        return;
      }
      if (!isAllowedDocumentMimeType(mimeType, asset.name || '', asset.uri)) {
        Alert.alert(t('common.error'), t('ai.attach.unsupportedFileType'), [
          { text: t('common.ok') },
        ]);
        return;
      }
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (!fileInfo.exists) {
        Alert.alert(t('common.error'), t('ai.voice.fileUnavailable'), [{ text: t('common.ok') }]);
        return;
      }
      const resolvedFileSize = resolveAttachmentFileSizeBytes(fileSize, fileInfo);
      if (typeof resolvedFileSize === 'number' && resolvedFileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        Alert.alert(t('common.error'), t('ai.attach.fileTooLarge'), [{ text: t('common.ok') }]);
        return;
      }
      setAttachments((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${asset.uri}`,
          name: asset.name || `document-${prev.length + 1}`,
          uri: asset.uri,
          mimeType,
          size: resolvedFileSize,
          kind: 'document',
        },
      ]);
    } catch (error) {
      if (__DEV__) {
        console.warn('Document selection failed:', error);
      }
      Alert.alert(t('common.error'), t('ai.errors.failedResponse'), [{ text: t('common.ok') }]);
    }
  }, [t]);

  const openAttachmentPicker = useCallback(() => {
    Alert.alert(t('ai.attach.title'), t('ai.attach.choosePrompt'), [
      { text: t('ai.attach.image'), onPress: () => void handlePickImage() },
      { text: t('ai.attach.file'), onPress: () => void handlePickDocument() },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [handlePickDocument, handlePickImage, t]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const retryFailedRequest = useCallback(() => {
    if (!failedRequest || isLoading) return;
    void handleSendMessage(failedRequest.text, failedRequest.source, failedRequest.voicePayload, {
      overrideAttachments: failedRequest.attachments,
    });
  }, [failedRequest, handleSendMessage, isLoading]);

  const handleSuggestionPress = (suggestion: string) => {
    void handleSendMessage(suggestion, 'text');
  };

  const formatMessageTime = (date: Date) => {
    return formatTime(date);
  };

  const handleBackPress = useCallback(() => {
    cancelInFlightAssistantRequest();
    router.back();
  }, [cancelInFlightAssistantRequest, router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('ai.title'),
          headerStyle: { backgroundColor: m3.colorScheme.background },
          headerTintColor: m3.colorScheme.onBackground,
          headerLeft: () => (
            <Pressable onPress={handleBackPress} style={{ marginLeft: spacing[2] }}>
              <UiSymbol name="chevron.left" size={24} color={m3.colorScheme.onBackground} />
            </Pressable>
          ),
          headerRight: () =>
            assistantFeatureFlags.memoryEnabled ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  marginRight: spacing[2],
                }}
              >
                {conversationId ? (
                  <Pressable
                    onPress={() => handleDeleteConversation(conversationId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('ai.chat.deleteChat')}
                    accessibilityHint={t('ai.chat.deleteChatHint')}
                    style={{ padding: spacing[1] }}
                  >
                    <UiSymbol name="trash" size={18} color={m3.colorScheme.onBackground} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (!assistantFeatureFlags.memoryEnabled) return;
                    setIsHistoryVisible(true);
                    void refreshConversationHistory();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai.chat.history')}
                  accessibilityHint={t('ai.chat.openHistoryHint')}
                  style={{ padding: spacing[1] }}
                >
                  <UiSymbol name="sidebar.left" size={20} color={m3.colorScheme.onBackground} />
                </Pressable>
              </View>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.surface[50] }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: spacing[4] }}
            contentContainerStyle={{
              paddingTop: insets.top + spacing[4],
              paddingBottom: composerHeight + spacing[4],
            }}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {messages.length === 0 && (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: spacing[8],
                  paddingBottom: spacing[6],
                }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[4],
                  }}
                >
                  <UiSymbol name="lightbulb.fill" size={40} color={m3.colorScheme.primary} />
                </View>
                <Text
                  style={{
                    color: colors.surface[900],
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing[2],
                  }}
                >
                  {t('ai.title')}
                </Text>
                <Text
                  style={{
                    color: colors.surface[700],
                    fontSize: fontSize.base,
                    textAlign: 'center',
                    marginBottom: spacing[5],
                    paddingHorizontal: spacing[5],
                    lineHeight: 42,
                  }}
                >
                  {t('ai.description')}
                </Text>
                <View
                  style={{
                    width: '100%',
                    borderRadius: borderRadius['2xl'],
                    borderWidth: 1,
                    borderColor: colorWithOpacity(colors.surface[300], 0.8),
                    backgroundColor: colorWithOpacity(colors.surface[100], 0.96),
                    padding: spacing[3],
                    gap: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      color: colors.surface[700],
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      paddingHorizontal: spacing[1],
                    }}
                  >
                    {t('ai.suggestedQuestions')}
                  </Text>
                  {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[3],
                        borderRadius: borderRadius.xl,
                        borderWidth: 1,
                        borderColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                      }}
                    >
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          flex: 1,
                        }}
                      >
                        {suggestion}
                      </Text>
                      <UiSymbol
                        name="chevron.right"
                        size={14}
                        color={colorWithOpacity(m3.colorScheme.primary, 0.75)}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                style={{
                  flexDirection: 'row',
                  marginBottom: spacing[3],
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {message.role === 'assistant' && (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing[2],
                      marginTop: spacing[1],
                    }}
                  >
                    <UiSymbol name="lightbulb.fill" size={16} color={m3.colorScheme.primary} />
                  </View>
                )}
                <View
                  style={{
                    maxWidth: '80%',
                    borderRadius: borderRadius['2xl'],
                    padding: spacing[3],
                    backgroundColor:
                      message.role === 'user'
                        ? m3.colorScheme.primary
                        : colorWithOpacity(colors.surface[100], 0.85),
                    ...(message.role === 'user'
                      ? { borderBottomRightRadius: borderRadius.sm }
                      : { borderBottomLeftRadius: borderRadius.sm }),
                  }}
                >
                  {message.role === 'assistant' ? (
                    <Markdown style={markdown} mergeStyle={true}>
                      {message.content}
                    </Markdown>
                  ) : (
                    <Text style={{ fontSize: fontSize.base, color: m3.colorScheme.onPrimary }}>
                      {message.content}
                    </Text>
                  )}
                  {__DEV__ && message.role === 'assistant' && (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: spacing[2],
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[1],
                        borderRadius: borderRadius.full,
                        borderWidth: 1,
                        borderColor: colorWithOpacity(m3.colorScheme.primary, 0.28),
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                      }}
                    >
                      <Text
                        style={{
                          color: m3.colorScheme.primary,
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        audio_provider: {message.audio?.provider ?? 'none'}
                        {'\n'}gateway_provider: {message.audioMeta?.providerUsed ?? 'unknown'}
                        {'\n'}stt_provider: {message.audioMeta?.sttProviderUsed ?? 'none'}
                        {message.audioMeta?.ttsSkippedReason
                          ? `\ntts_skipped: ${message.audioMeta.ttsSkippedReason}`
                          : ''}
                        {message.audioMeta?.providerFallbackReason
                          ? `\nfallback_reason: ${message.audioMeta.providerFallbackReason}`
                          : ''}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      marginTop: spacing[1],
                      color:
                        message.role === 'user'
                          ? colorWithOpacity(m3.colorScheme.onPrimary, 0.7)
                          : colors.surface[400],
                    }}
                  >
                    {formatMessageTime(message.timestamp)}
                  </Text>
                </View>
                {message.role === 'user' && (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: spacing[2],
                      marginTop: spacing[1],
                    }}
                  >
                    <UiSymbol name="person.fill" size={16} color={m3.colorScheme.primary} />
                  </View>
                )}
              </View>
            ))}

            {isLoading && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginBottom: spacing[3],
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing[2],
                    marginTop: spacing[1],
                  }}
                >
                  <UiSymbol name="lightbulb.fill" size={16} color={m3.colorScheme.primary} />
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
                    borderRadius: borderRadius['2xl'],
                    borderBottomLeftRadius: borderRadius.sm,
                  }}
                >
                  <ActivityIndicator size="small" color={m3.colorScheme.primary} />
                </View>
              </View>
            )}

            {suggestions.length > 0 && !isLoading && messages.length > 0 && (
              <View
                style={{
                  marginTop: spacing[4],
                  paddingTop: spacing[4],
                  borderTopWidth: 1,
                  borderTopColor: colors.surface[200],
                }}
              >
                <Text
                  style={{
                    color: colors.surface[500],
                    fontSize: fontSize.xs,
                    marginBottom: spacing[2],
                  }}
                >
                  {t('ai.suggestedQuestions')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: 'row' }}
                >
                  {suggestions.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={{
                        marginRight: spacing[2],
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[2],
                        borderWidth: 1,
                        borderColor: colorWithOpacity(m3.colorScheme.primary, 0.22),
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                        borderRadius: borderRadius.full,
                      }}
                    >
                      <Text
                        style={{
                          color: m3.colorScheme.primary,
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View
            onLayout={(event) => {
              const nextHeight = Math.ceil(event.nativeEvent.layout.height);
              setComposerHeight((currentHeight) =>
                currentHeight === nextHeight ? currentHeight : nextHeight,
              );
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: spacing[4],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              backgroundColor: colorWithOpacity(colors.surface[50], 0.98),
              borderTopWidth: 1,
              borderTopColor: colors.surface[300],
              shadowColor: colors.surface[900],
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: -2 },
              elevation: 6,
            }}
          >
            {attachments.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: spacing[2] }}
                contentContainerStyle={{ gap: spacing[2] }}
              >
                {attachments.map((attachment) => (
                  <Pressable
                    key={attachment.id}
                    onPress={() => removeAttachment(attachment.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      gap: spacing[1],
                    }}
                  >
                    <UiSymbol
                      name={attachment.kind === 'image' ? 'photo' : 'doc.text'}
                      size={14}
                      color={m3.colorScheme.primary}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        maxWidth: 160,
                        color: m3.colorScheme.primary,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {attachment.name}
                    </Text>
                    <UiSymbol name="xmark" size={12} color={m3.colorScheme.primary} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {voiceInputState !== 'idle' && (
              <Text
                style={{
                  marginBottom: spacing[2],
                  color: m3.colorScheme.primary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}
              >
                {voiceInputState === 'recording'
                  ? t('ai.voice.recording', { defaultValue: 'Recording...' })
                  : t('ai.voice.processing', { defaultValue: 'Processing...' })}
              </Text>
            )}
            {isAssistantSpeaking && (
              <Text
                style={{
                  marginBottom: spacing[2],
                  color: m3.colorScheme.primary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}
              >
                {t('ai.chat.assistantSpeaking')}
              </Text>
            )}
            {__DEV__ && SHOW_LOCAL_DIAGNOSTICS && lastAssistantDiagnostics && (
              <View
                style={{
                  marginBottom: spacing[2],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.22),
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  gap: spacing[1],
                }}
              >
                <Text
                  style={{
                    color: m3.colorScheme.primary,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  Local diagnostics
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  source: {formatDiagnosticValue(lastAssistantDiagnostics.source)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  trace_id: {formatDiagnosticValue(lastAssistantDiagnostics.traceId)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  route_decision: {formatDiagnosticValue(lastAssistantDiagnostics.routeDecision)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  provider/model: {formatDiagnosticValue(lastAssistantDiagnostics.providerUsed)} /{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.modelUsed)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  latency_ms: {formatDiagnosticValue(lastAssistantDiagnostics.latencyMs)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  voice_capture_ms / upload_bytes:{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.voiceCaptureDurationMs)} /{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.voiceUploadBytes)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  stt_provider/conf/latency:{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.sttProviderUsed)} /{' '}
                  {lastAssistantDiagnostics.sttConfidence !== null &&
                  lastAssistantDiagnostics.sttConfidence !== undefined &&
                  Number.isFinite(lastAssistantDiagnostics.sttConfidence)
                    ? `${(lastAssistantDiagnostics.sttConfidence * 100).toFixed(1)}%`
                    : '-'}{' '}
                  / {formatDiagnosticValue(lastAssistantDiagnostics.sttLatencyMs)}
                </Text>
                <Text style={{ color: colors.surface[700], fontSize: fontSize.xs }}>
                  tts_ms / skipped / fallback_reason:{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.ttsGenerationMs)} /{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.ttsSkippedReason)} /{' '}
                  {formatDiagnosticValue(lastAssistantDiagnostics.fallbackReason)}
                </Text>
              </View>
            )}
            {voiceLogDraft && voiceLogDraftSummary && (
              <View
                style={{
                  marginBottom: spacing[2],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.35),
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  gap: spacing[2],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <UiSymbol name="waveform.and.mic" size={14} color={m3.colorScheme.primary} />
                    <Text
                      style={{
                        color: m3.colorScheme.primary,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('ai.logging.draft.title')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearVoiceLogDraft}
                    accessibilityRole="button"
                    accessibilityLabel={t('ai.logging.draft.clearA11y')}
                    style={{ padding: spacing[1] }}
                  >
                    <UiSymbol name="xmark" size={12} color={m3.colorScheme.primary} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  <View
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.primary, fontSize: fontSize.xs }}>
                      {t('ai.logging.draft.type')}: {voiceLogDraftSummary.typeValue}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.primary, fontSize: fontSize.xs }}>
                      {t('ai.logging.draft.farm')}: {voiceLogDraftSummary.farmValue}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.primary, fontSize: fontSize.xs }}>
                      {t('ai.logging.draft.status')}: {voiceLogDraftSummary.statusValue}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.primary, fontSize: fontSize.xs }}>
                      {t('ai.logging.draft.date')}: {voiceLogDraftSummary.dateValue}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {!voiceLogDraft && clearedVoiceLogDraft && (
              <View
                style={{
                  marginBottom: spacing[2],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.28),
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing[2],
                }}
              >
                <Text
                  style={{
                    color: m3.colorScheme.primary,
                    fontSize: fontSize.xs,
                    flex: 1,
                  }}
                >
                  {t('ai.logging.draft.cleared')}
                </Text>
                <Pressable
                  onPress={handleUndoClearVoiceLogDraft}
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                  }}
                >
                  <Text
                    style={{
                      color: m3.colorScheme.primary,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('ai.logging.draft.undo')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={hideClearedDraftNotice}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai.logging.draft.dismissA11y')}
                  style={{ padding: spacing[1] }}
                >
                  <UiSymbol name="xmark" size={12} color={m3.colorScheme.primary} />
                </Pressable>
              </View>
            )}
            {failedRequest && !isLoading && (
              <View
                style={{
                  marginBottom: spacing[2],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.error, 0.4),
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.08),
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing[2],
                }}
              >
                <Text style={{ flex: 1, color: m3.colorScheme.error, fontSize: fontSize.xs }}>
                  {t('ai.chat.failedRequest')}
                </Text>
                <Pressable
                  onPress={retryFailedRequest}
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.14),
                  }}
                >
                  <Text
                    style={{
                      color: m3.colorScheme.error,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('ai.chat.retry')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFailedRequest(null)}
                  accessibilityRole="button"
                  style={{ padding: spacing[1] }}
                >
                  <UiSymbol name="xmark" size={12} color={m3.colorScheme.error} />
                </Pressable>
              </View>
            )}
            <View style={{ gap: spacing[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <Pressable
                  onPress={openAttachmentPicker}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai.chat.attachFileA11y')}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.11),
                  }}
                >
                  <UiSymbol name="plus" size={19} color={m3.colorScheme.primary} />
                </Pressable>
                <View
                  style={{
                    flex: 1,
                    minHeight: 48,
                    maxHeight: 120,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.surface[300],
                    backgroundColor: colors.surface[100],
                    paddingLeft: spacing[4],
                    paddingRight: spacing[2],
                    paddingVertical: spacing[1],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={t('ai.input.placeholder')}
                    placeholderTextColor={colorWithOpacity(colors.surface[600], 0.85)}
                    multiline
                    style={{
                      flex: 1,
                      minHeight: 36,
                      maxHeight: 108,
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                      paddingTop: spacing[2],
                      paddingBottom: spacing[2],
                    }}
                    textAlignVertical="center"
                    returnKeyType="send"
                    onSubmitEditing={() => handleSendMessage(undefined, 'text')}
                  />
                  {(inputText.trim() || attachments.length > 0) && !isLoading ? (
                    <Pressable
                      onPress={() => handleSendMessage(undefined, 'text')}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: m3.colorScheme.primary,
                      }}
                    >
                      <UiSymbol name="arrow.up" size={16} color={m3.colorScheme.onPrimary} />
                    </Pressable>
                  ) : null}
                </View>
                {inputText.trim() || attachments.length > 0 ? null : (
                  <Pressable
                    onPress={openVoiceMode}
                    disabled={isLoading && !isVoiceRecording}
                    accessibilityRole="button"
                    accessibilityLabel={t('ai.chat.openVoiceModeA11y')}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isVoiceRecording
                        ? colorWithOpacity(m3.colorScheme.error, 0.2)
                        : colorWithOpacity(m3.colorScheme.primary, 0.12),
                    }}
                  >
                    <UiSymbol
                      name={isVoiceRecording ? 'stop.fill' : 'mic.fill'}
                      size={18}
                      color={isVoiceRecording ? m3.colorScheme.error : m3.colorScheme.primary}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
        {assistantFeatureFlags.memoryEnabled && (
          <Modal
            visible={isHistoryVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setIsHistoryVisible(false)}
          >
            <Pressable
              onPress={() => setIsHistoryVisible(false)}
              style={{
                flex: 1,
                backgroundColor: colorWithOpacity(colors.surface[900], 0.22),
                flexDirection: 'row',
              }}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={{
                  width: '82%',
                  maxWidth: 360,
                  height: '100%',
                  backgroundColor: colors.surface[100],
                  paddingTop: insets.top + spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingBottom: Math.max(insets.bottom, spacing[4]),
                  borderTopRightRadius: borderRadius['2xl'],
                  borderBottomRightRadius: borderRadius['2xl'],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      color: colors.surface[900],
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('ai.chat.history')}
                  </Text>
                  <Pressable
                    onPress={() => setIsHistoryVisible(false)}
                    style={{ padding: spacing[1] }}
                  >
                    <UiSymbol name="xmark" size={16} color={colors.surface[700]} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={startNewConversation}
                  style={{
                    height: 44,
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: spacing[2],
                    marginBottom: spacing[3],
                  }}
                >
                  <UiSymbol name="plus" size={16} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      color: m3.colorScheme.primary,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('ai.chat.newChat')}
                  </Text>
                </Pressable>

                {isHistoryLoading ? (
                  <View style={{ paddingVertical: spacing[6], alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={m3.colorScheme.primary} />
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing[2] }}
                  >
                    {visibleConversationSummaries.map((summary) => {
                      const isActive = summary.id === conversationId;
                      const preview = (summary.lastMessage ?? '').trim();
                      return (
                        <Pressable
                          key={summary.id}
                          onPress={() => void openConversation(summary.id)}
                          style={{
                            borderRadius: borderRadius.xl,
                            borderWidth: 1,
                            borderColor: isActive
                              ? colorWithOpacity(m3.colorScheme.primary, 0.45)
                              : colors.surface[300],
                            backgroundColor: isActive
                              ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                              : colors.surface[50],
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[3],
                            gap: spacing[1],
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.surface[900],
                                fontSize: fontSize.sm,
                                fontWeight: fontWeight.semibold,
                                flex: 1,
                              }}
                            >
                              {preview || t('ai.chat.newConversation')}
                            </Text>
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                handleDeleteConversation(summary.id);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={t('ai.chat.deleteChat')}
                              accessibilityHint={t('ai.chat.deleteChatHint')}
                              hitSlop={8}
                              style={{ padding: spacing[1] }}
                            >
                              <UiSymbol name="trash" size={14} color={colors.surface[500]} />
                            </Pressable>
                          </View>
                          <Text
                            numberOfLines={2}
                            style={{
                              color: colors.surface[600],
                              fontSize: fontSize.xs,
                            }}
                          >
                            {formatDate(summary.lastMessageAt ?? summary.updatedAt)}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {visibleConversationSummaries.length === 0 && (
                      <Text
                        style={{
                          color: colors.surface[600],
                          fontSize: fontSize.sm,
                          textAlign: 'center',
                          paddingVertical: spacing[6],
                        }}
                      >
                        {t('ai.chat.noPreviousChats')}
                      </Text>
                    )}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        )}
        <VoiceModeModal
          visible={isVoiceModeVisible}
          onClose={closeVoiceMode}
          isVoiceRecording={isVoiceRecording}
          isLoading={isLoading}
          isAssistantSpeaking={isAssistantSpeaking}
          isVoiceModeMicEnabled={isVoiceModeMicEnabled}
          voiceConversationMode={voiceConversationMode}
          voiceModeError={voiceModeError}
          voiceModeNotice={voiceModeNotice}
          liveVoiceTranscript={liveVoiceTranscript}
          messages={messages}
          voiceModeScrollViewRef={voiceModeScrollViewRef}
          onMicPress={handleVoiceModeMicToggle}
          onPrimaryActionPress={handleVoiceModePrimaryAction}
          t={t}
          m3={m3}
          markdown={markdown}
          insets={insets}
        />
      </KeyboardAvoidingView>
    </>
  );
}
