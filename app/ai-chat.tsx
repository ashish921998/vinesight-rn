import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import Markdown from 'react-native-markdown-display';
import { useFarm } from '@/hooks';
import { aiService } from '@/services/ai-service';
import { ChatMessage } from '@/types/ai';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatTime } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';

const markdownStyles = {
  body: { fontSize: 16, color: '#1c1c1e', lineHeight: 24 },
  heading1: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#1c1c1e',
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#1c1c1e',
    marginTop: 8,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#1c1c1e',
    marginTop: 8,
    marginBottom: 4,
  },
  strong: { fontWeight: 'bold' as const, color: '#1c1c1e' },
  em: { fontStyle: 'italic' as const, color: '#1c1c1e' },
  paragraph: { marginBottom: 8 },
  list_item: { marginBottom: 4, paddingLeft: 4 },
  bullet_list: { marginBottom: 8, marginLeft: 8 },
  ordered_list: { marginBottom: 8, marginLeft: 8 },
  code_inline: {
    backgroundColor: '#f0f0f0',
    color: '#1c1c1e',
    padding: 2,
    borderRadius: 4,
    fontFamily: process.env.EXPO_OS === 'ios' ? 'Courier' : 'monospace',
  },
  code_block: {
    backgroundColor: '#f0f0f0',
    color: '#1c1c1e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    fontFamily: process.env.EXPO_OS === 'ios' ? 'Courier' : 'monospace',
  },
  blockquote: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#408059',
    paddingLeft: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  link: { color: '#408059', textDecorationLine: 'underline' as const },
  table: { borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8 },
  table_header: { backgroundColor: '#408059' },
  table_row: { borderWidth: 1, borderColor: '#e0e0e0' },
  table_cell: { padding: 8, fontSize: 14, color: '#1c1c1e' },
};

export default function AIChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: farmId } = useLocalSearchParams<{ id?: string }>();
  const { data: farm } = useFarm(farmId ? parseInt(farmId, 10) : undefined);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

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

    // Track AI request
    telemetry.capture('ai_request_made', {
      ai_use_case: 'chat',
      language: t('common.currentLanguage'), // Will need to be properly extracted
    });

    try {
      const response = await aiService.sendMessage(messageText, messages, {
        farmName: farm?.name,
        cropVariety: farm?.crop_variety || farm?.crop,
        area: farm?.area,
        region: farm?.region,
        daysSincePruning: farm?.date_of_pruning
          ? Math.floor(
              (new Date().getTime() - new Date(farm.date_of_pruning).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : undefined,
      });

      setMessages((prev) => [...prev, response.message]);
      setSuggestions(response.suggestions || DEFAULT_SUGGESTIONS);

      // Track AI result received
      telemetry.capture('ai_result_received', {
        ai_use_case: 'chat',
        confidence_score: null, // OpenAI doesn't provide confidence scores
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
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const formatMessageTime = (date: Date) => {
    return formatTime(date);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('ai.title'),
          headerStyle: { backgroundColor: '#f2f2f7' },
          headerTintColor: '#000000',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginLeft: spacing[2] }}>
              <UiSymbol name="chevron.left" size={24} color="#000000" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.surface[50] }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}
            contentContainerStyle={{ paddingTop: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
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
                    backgroundColor: colors.primary[100],
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[4],
                  }}
                >
                  <UiSymbol name="lightbulb.fill" size={40} color="#408059" />
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
                        borderColor: colors.surface[100],
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
                      backgroundColor: colors.primary[100],
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing[2],
                      marginTop: spacing[1],
                    }}
                  >
                    <UiSymbol name="lightbulb.fill" size={16} color="#408059" />
                  </View>
                )}
                <View
                  style={{
                    maxWidth: '80%',
                    borderRadius: borderRadius['2xl'],
                    padding: spacing[3],
                    backgroundColor:
                      message.role === 'user' ? colors.primary[600] : 'rgba(255, 255, 255, 0.8)',
                    ...(message.role === 'user'
                      ? { borderBottomRightRadius: borderRadius.sm }
                      : { borderBottomLeftRadius: borderRadius.sm }),
                  }}
                >
                  {message.role === 'assistant' ? (
                    <Markdown style={markdownStyles} mergeStyle={true}>
                      {message.content}
                    </Markdown>
                  ) : (
                    <Text style={{ fontSize: fontSize.base, color: colors.white }}>
                      {message.content}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      marginTop: spacing[1],
                      color:
                        message.role === 'user' ? 'rgba(255, 255, 255, 0.7)' : colors.surface[400],
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
                      backgroundColor: colors.primary[200],
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: spacing[2],
                      marginTop: spacing[1],
                    }}
                  >
                    <UiSymbol name="person.fill" size={16} color="#408059" />
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
                    backgroundColor: colors.primary[100],
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing[2],
                    marginTop: spacing[1],
                  }}
                >
                  <UiSymbol name="lightbulb.fill" size={16} color="#408059" />
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: borderRadius['2xl'],
                    borderBottomLeftRadius: borderRadius.sm,
                  }}
                >
                  <ActivityIndicator size="small" color="#408059" />
                </View>
              </View>
            )}

            {suggestions.length > 0 && !isLoading && messages.length > 0 && (
              <View
                style={{
                  marginTop: spacing[4],
                  paddingTop: spacing[4],
                  borderTopWidth: 1,
                  borderTopColor: colors.surface[100],
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
                        backgroundColor: colors.primary[50],
                        borderRadius: borderRadius.full,
                      }}
                    >
                      <Text style={{ color: colors.primary[700], fontSize: fontSize.sm }}>
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
              backgroundColor: colors.surface[100],
              borderTopWidth: 1,
              borderTopColor: colors.surface[100],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('ai.input.placeholder')}
                placeholderTextColor="#9CA3AF"
                multiline
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  backgroundColor: colors.surface[100],
                  borderRadius: borderRadius['2xl'],
                  color: colors.surface[900],
                  fontSize: fontSize.base,
                }}
                textAlignVertical="top"
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage()}
              />
              <Pressable
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    inputText.trim() && !isLoading ? colors.primary[600] : colors.surface[200],
                }}
              >
                <UiSymbol
                  name="paperplane.fill"
                  size={20}
                  color={inputText.trim() && !isLoading ? '#FFFFFF' : '#9CA3AF'}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
