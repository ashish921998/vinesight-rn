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
} from 'react-native';
import {
  ExpoSpeechRecognitionModule as _SpeechModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import Markdown from 'react-native-markdown-display';
import { useFarm, useFarms } from '@/hooks';
import { aiService } from '@/services/ai-service';
import { ChatMessage } from '@/types/ai';
import { classifyIntent, executeQuery } from '@/services/farm-assistant-service';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatTime } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { AssistantAnswer, QueryIntent } from '@/types/voice-assistant';
import type { SupportedLanguageCode } from '@/i18n/languages';

type VoiceInputState = 'idle' | 'starting' | 'listening';

const ExpoSpeechRecognitionModule = _SpeechModule as typeof _SpeechModule & {
  requestPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
  start(options: { lang: string; interimResults: boolean; continuous: boolean }): void;
  stop(): void;
  abort(): void;
};

function resolveSpeechLocale(language: string): string {
  if (language.startsWith('mr')) return 'mr-IN';
  if (language.startsWith('hi')) return 'hi-IN';
  return 'en-IN';
}

function resolveLanguageCode(language: string): SupportedLanguageCode {
  if (language.startsWith('mr')) return 'mr';
  if (language.startsWith('hi')) return 'hi';
  return 'en';
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

export default function AIChatScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const markdown = useMemo(() => markdownStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
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
  const candidateFarms = useMemo(() => (contextFarm ? [contextFarm] : farms), [contextFarm, farms]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>('idle');
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingVoiceTranscriptRef = useRef('');
  const hasSubmittedVoiceQueryRef = useRef(false);
  const isStartingVoiceInputRef = useRef(false);
  const sendMessageRef =
    useRef<(text?: string, source?: 'text' | 'voice') => Promise<void>>(undefined);
  const speechLocale = useMemo(() => resolveSpeechLocale(i18n.language), [i18n.language]);
  const isVoiceListening = voiceInputState === 'starting' || voiceInputState === 'listening';

  const DEFAULT_SUGGESTIONS = useMemo(
    () => [
      t('ai.defaultSuggestions.waterNeed'),
      t('ai.defaultSuggestions.diseases'),
      t('ai.defaultSuggestions.fertilizer'),
      t('ai.defaultSuggestions.pruning'),
    ],
    [t],
  );

  useEffect(() => {
    if (!aiService.isConfigured()) {
      Alert.alert(t('ai.apiKeyRequiredTitle'), t('ai.apiKeyRequiredBody'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    }
  }, [router, t]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = useCallback(
    async (text?: string, source: 'text' | 'voice' = 'text') => {
      const messageText = text || inputText.trim();
      if (!messageText || isLoading) return;

      if (source !== 'voice' && isVoiceListening) {
        hasSubmittedVoiceQueryRef.current = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          /* no-op */
        }
        setVoiceInputState('idle');
      }

      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newMessage]);
      setInputText('');
      setSuggestions([]);
      setIsLoading(true);
      scrollToBottom();

      telemetry.capture('ai_request_made', {
        ai_use_case: 'chat',
        language: i18n.language,
        input_method: source,
      });

      try {
        const deterministicTranscript = contextFarm?.name
          ? `${messageText} for farm ${contextFarm.name}`
          : messageText;
        const intent = classifyIntent(deterministicTranscript, candidateFarms);

        if (shouldUseFarmDataEngine(messageText, intent) && candidateFarms.length > 0) {
          try {
            const languageCode = resolveLanguageCode(i18n.language);
            const farmDataResponse = await executeQuery(
              deterministicTranscript,
              candidateFarms,
              languageCode,
            );

            const content =
              farmDataResponse.answer.verbalizedText ??
              formatFarmDataAnswer(farmDataResponse.answer);

            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content,
                timestamp: new Date(),
              },
            ]);
            setSuggestions(DEFAULT_SUGGESTIONS);

            telemetry.capture('ai_result_received', {
              ai_use_case: 'chat',
              confidence_score: null,
              response_source: 'farm_records',
            });

            scrollToBottom();
            return;
          } catch (error) {
            if (__DEV__) {
              console.warn('Farm data engine failed, falling back to LLM:', error);
            }
          }
        }

        const response = await aiService.sendMessage(
          messageText,
          messages,
          {
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
          resolveLanguageCode(i18n.language),
        );

        setMessages((prev) => [...prev, response.message]);
        setSuggestions(response.suggestions || DEFAULT_SUGGESTIONS);

        telemetry.capture('ai_result_received', {
          ai_use_case: 'chat',
          confidence_score: null,
        });

        scrollToBottom();
      } catch (error) {
        Alert.alert(
          t('common.error'),
          error instanceof Error ? error.message : t('ai.errors.failedResponse'),
          [{ text: t('common.ok') }],
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      DEFAULT_SUGGESTIONS,
      candidateFarms,
      contextFarm,
      i18n.language,
      inputText,
      isLoading,
      isVoiceListening,
      messages,
      t,
    ],
  );

  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useSpeechRecognitionEvent('start', () => {
    setVoiceInputState('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (!transcript) return;

    pendingVoiceTranscriptRef.current = transcript;
    setInputText(transcript);

    if (event.isFinal && transcript.trim() && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      sendMessageRef.current?.(transcript.trim(), 'voice');
      setVoiceInputState('idle');
    }
  });

  useSpeechRecognitionEvent('end', () => {
    const finalTranscript = pendingVoiceTranscriptRef.current.trim();
    if (finalTranscript && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      sendMessageRef.current?.(finalTranscript, 'voice');
    }
    setVoiceInputState('idle');
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') {
      setVoiceInputState('idle');
      return;
    }
    if (event.error === 'no-speech') {
      setVoiceInputState('idle');
      Alert.alert(t('ai.voice.noSpeechTitle'), t('ai.voice.noSpeechBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }
    if (event.error === 'not-allowed') {
      setVoiceInputState('idle');
      Alert.alert(t('ai.voice.permissionTitle'), t('ai.voice.permissionBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }

    setVoiceInputState('idle');
    Alert.alert(t('ai.voice.unavailableTitle'), t('ai.voice.unavailableBody'), [
      { text: t('common.ok') },
    ]);
  });

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* no-op */
      }
    };
  }, []);

  const startVoiceInput = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('ai.voice.unavailableTitle'), t('ai.voice.unavailableBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }
    if (isLoading || isStartingVoiceInputRef.current || voiceInputState === 'listening') {
      return;
    }

    isStartingVoiceInputRef.current = true;
    setVoiceInputState('starting');
    pendingVoiceTranscriptRef.current = '';
    hasSubmittedVoiceQueryRef.current = false;

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceInputState('idle');
        Alert.alert(t('ai.voice.permissionTitle'), t('ai.voice.permissionBody'), [
          { text: t('common.ok') },
        ]);
        return;
      }

      await Promise.resolve(
        ExpoSpeechRecognitionModule.start({
          lang: speechLocale,
          interimResults: true,
          continuous: false,
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('Voice input start failed:', error);
      }
      setVoiceInputState('idle');
      Alert.alert(t('ai.voice.unavailableTitle'), t('ai.voice.unavailableBody'), [
        { text: t('common.ok') },
      ]);
    } finally {
      isStartingVoiceInputRef.current = false;
    }
  }, [isLoading, speechLocale, t, voiceInputState]);

  const stopVoiceInput = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      if (__DEV__) {
        console.warn('Voice input stop failed:', error);
      }
      setVoiceInputState('idle');
    }
  }, []);

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion, 'text');
  };

  const formatMessageTime = (date: Date) => {
    return formatTime(date);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('ai.title'),
          headerStyle: { backgroundColor: m3.colorScheme.background },
          headerTintColor: m3.colorScheme.onBackground,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginLeft: spacing[2] }}>
              <UiSymbol name="chevron.left" size={24} color={m3.colorScheme.onBackground} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}
            contentContainerStyle={{ paddingTop: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {messages.length === 0 && (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing[8],
                }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
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
                    color: colors.surface[500],
                    fontSize: fontSize.base,
                    textAlign: 'center',
                    marginBottom: spacing[6],
                    paddingHorizontal: spacing[8],
                  }}
                >
                  {t('ai.description')}
                </Text>
                <View style={{ width: '100%', gap: spacing[2] }}>
                  {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={{
                        padding: spacing[3],
                        borderRadius: borderRadius.xl,
                        borderWidth: 1,
                        borderColor: colors.surface[200],
                        backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
                      }}
                    >
                      <Text
                        style={{
                          color: colors.surface[700],
                          fontSize: fontSize.sm,
                          textAlign: 'center',
                        }}
                      >
                        {suggestion}
                      </Text>
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                        borderRadius: borderRadius.full,
                      }}
                    >
                      <Text style={{ color: m3.colorScheme.primary, fontSize: fontSize.sm }}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View
            style={{
              padding: spacing[4],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              backgroundColor: colors.surface[100],
              borderTopWidth: 1,
              borderTopColor: colors.surface[200],
            }}
          >
            {voiceInputState !== 'idle' && (
              <Text
                style={{
                  marginBottom: spacing[2],
                  color: m3.colorScheme.primary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}
              >
                {voiceInputState === 'starting' ? t('ai.voice.starting') : t('ai.voice.listening')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('ai.input.placeholder')}
                placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                multiline
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius['2xl'],
                  color: colors.surface[900],
                  fontSize: fontSize.base,
                }}
                textAlignVertical="top"
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage(undefined, 'text')}
              />
              <Pressable
                onPress={isVoiceListening ? stopVoiceInput : startVoiceInput}
                disabled={isLoading && !isVoiceListening}
                accessibilityRole="button"
                accessibilityLabel={
                  isVoiceListening ? t('ai.voice.stopA11y') : t('ai.voice.startA11y')
                }
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isVoiceListening
                    ? colorWithOpacity(m3.colorScheme.error, 0.16)
                    : colorWithOpacity(m3.colorScheme.primary, 0.12),
                }}
              >
                <UiSymbol
                  name={isVoiceListening ? 'stop.fill' : 'mic.fill'}
                  size={20}
                  color={isVoiceListening ? m3.colorScheme.error : m3.colorScheme.primary}
                />
              </Pressable>
              <Pressable
                onPress={() => handleSendMessage(undefined, 'text')}
                disabled={!inputText.trim() || isLoading}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    inputText.trim() && !isLoading ? m3.colorScheme.primary : colors.surface[200],
                }}
              >
                <UiSymbol
                  name="paperplane.fill"
                  size={20}
                  color={
                    inputText.trim() && !isLoading
                      ? m3.colorScheme.onPrimary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                  }
                />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
