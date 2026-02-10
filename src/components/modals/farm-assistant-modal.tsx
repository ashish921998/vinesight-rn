import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AssistantAnswerCard } from '@/components/cards/assistant-answer-card';
import { AssistantAnswerSkeleton } from '@/components/cards/assistant-answer-skeleton';
import type {
  FarmAssistantStatus,
  AssistantAnswer,
  ClarificationPrompt,
} from '@/types/voice-assistant';

interface FarmAssistantController {
  status: FarmAssistantStatus;
  transcript: string;
  answer: AssistantAnswer | null;
  clarification: ClarificationPrompt | null;
  error: string | null;
  isMicAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  submitQuery: (text: string) => Promise<void>;
  selectClarification: (option: string) => Promise<void>;
  reset: () => void;
}

interface FarmAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  controller: FarmAssistantController;
}

export function FarmAssistantModal({ visible, onClose, controller }: FarmAssistantModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const m3 = useM3();
  const [inputText, setInputText] = useState('');
  const hasAutoStartedRef = useRef(false);

  const suggestedQuestions = useMemo(
    () => [
      t('farmAssistant.suggestedQuestions.sprayLastMonth'),
      t('farmAssistant.suggestedQuestions.totalIrrigationSeason'),
      t('farmAssistant.suggestedQuestions.lastFertilizer'),
      t('farmAssistant.suggestedQuestions.spendThisMonth'),
    ],
    [t],
  );

  const {
    status,
    transcript,
    answer,
    clarification,
    error,
    isMicAvailable,
    startListening,
    stopListening,
    submitQuery,
    selectClarification,
    reset,
  } = controller;

  // Auto-start listening once per modal open (if mic is available).
  // This avoids start/stop loops when status briefly returns to idle.
  useEffect(() => {
    if (!visible) {
      hasAutoStartedRef.current = false;
      return;
    }

    if (!isMicAvailable || status !== 'idle' || hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;

    // Schedule after UI interactions to avoid timing assumptions about modal animation.
    const interaction = InteractionManager.runAfterInteractions(async () => {
      try {
        await startListening();
      } catch (err) {
        // Silently fail if speech recognition isn't ready
        console.warn('Auto-start listening failed:', err);
        hasAutoStartedRef.current = false;
      }
    });

    return () => interaction.cancel();
  }, [visible, isMicAvailable, status, startListening]);

  const ui = useMemo(
    () => ({
      surface: colors.surface[100],
      border: colors.surface[200],
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: colors.surface[900],
      muted: colors.surface[500],
      overlay: colorWithOpacity(colors.black, 0.35),
      error: m3.colorScheme.error,
    }),
    [colors, m3],
  );

  const handleSubmit = () => {
    if (!inputText.trim()) return;
    submitQuery(inputText.trim());
    setInputText('');
  };

  const handleSuggestionPress = (question: string) => {
    submitQuery(question);
    setInputText('');
  };

  const handleClose = () => {
    setInputText('');
    hasAutoStartedRef.current = false;
    onClose();
  };

  const handleAskAnother = () => {
    setInputText('');
    hasAutoStartedRef.current = false;
    reset();
  };

  const renderContent = () => {
    switch (status) {
      case 'listening':
        return (
          <View style={{ alignItems: 'center', paddingVertical: spacing[6], gap: spacing[3] }}>
            <Pressable
              onPress={stopListening}
              accessibilityLabel={t('farmAssistant.a11y.stopListening')}
              accessibilityRole="button"
              style={{
                width: 64,
                height: 64,
                borderRadius: borderRadius.full,
                backgroundColor: ui.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolIcon name="mic.fill" size={28} color={m3.colorScheme.onPrimary} />
            </Pressable>
            <Text style={{ color: ui.muted, fontSize: fontSize.sm }}>
              {t('farmAssistant.listening')}
            </Text>
          </View>
        );

      case 'processing':
        return <AssistantAnswerSkeleton />;

      case 'clarifying':
        if (!clarification) return null;
        return (
          <View style={{ gap: spacing[3], paddingVertical: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: ui.text,
                textAlign: 'center',
              }}
            >
              {clarification.question}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing[2],
                justifyContent: 'center',
              }}
            >
              {clarification.options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => selectClarification(option)}
                  accessibilityLabel={option}
                  accessibilityRole="button"
                  style={{
                    backgroundColor: ui.primarySoft,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2] + 2,
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Text
                    style={{
                      color: ui.primary,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 'answered':
        if (!answer) return null;
        return <AssistantAnswerCard answer={answer} onAskAnother={handleAskAnother} />;

      case 'error':
        return (
          <View style={{ alignItems: 'center', paddingVertical: spacing[6], gap: spacing[3] }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(ui.error, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolIcon name="exclamationmark.triangle.fill" size={22} color={ui.error} />
            </View>
            <Text
              style={{
                color: ui.text,
                fontSize: fontSize.sm,
                textAlign: 'center',
                lineHeight: 20,
                paddingHorizontal: spacing[4],
              }}
            >
              {error}
            </Text>
            <Pressable
              onPress={handleAskAnother}
              accessibilityLabel={t('farmAssistant.tryAgain')}
              accessibilityRole="button"
              style={{
                backgroundColor: ui.primarySoft,
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[2] + 2,
                borderRadius: borderRadius.full,
              }}
            >
              <Text
                style={{
                  color: ui.primary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t('farmAssistant.tryAgain')}
              </Text>
            </Pressable>
          </View>
        );

      default:
        return (
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[2] }}>
              <Text
                style={{
                  color: ui.muted,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                }}
              >
                {t('farmAssistant.tryAsking')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {suggestedQuestions.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => handleSuggestionPress(q)}
                    accessibilityLabel={q}
                    accessibilityRole="button"
                    style={{
                      backgroundColor: ui.primarySoft,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: borderRadius.full,
                    }}
                  >
                    <Text
                      style={{
                        color: ui.primary,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {q}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        accessibilityLabel={t('farmAssistant.a11y.closeAssistant')}
        accessibilityRole="button"
        style={{ flex: 1, backgroundColor: ui.overlay }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: ui.surface,
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[5],
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: '80%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[4],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <SymbolIcon name="mic.fill" size={18} color={ui.primary} />
                <Text
                  style={{
                    color: ui.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {t('farmAssistant.title')}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                accessibilityLabel={t('farmAssistant.a11y.closeAssistant')}
                accessibilityRole="button"
                style={{
                  backgroundColor: ui.primarySoft,
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolIcon name="xmark" size={16} color={ui.primary} />
              </Pressable>
            </View>

            {transcript && status !== 'idle' && (
              <View
                style={{
                  backgroundColor: colorWithOpacity(ui.primary, 0.06),
                  borderRadius: borderRadius.lg,
                  padding: spacing[3],
                  marginBottom: spacing[3],
                }}
              >
                <Text
                  style={{
                    color: ui.muted,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    marginBottom: spacing[1],
                  }}
                >
                  {t('farmAssistant.yourQuestion')}
                </Text>
                <Text style={{ color: ui.text, fontSize: fontSize.sm }}>{transcript}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {renderContent()}
            </ScrollView>

            {status === 'idle' && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  marginTop: spacing[4],
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: ui.border,
                  paddingHorizontal: spacing[3],
                }}
              >
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={t('farmAssistant.askAboutFarmData')}
                  placeholderTextColor={ui.muted}
                  accessibilityLabel={t('farmAssistant.askAboutFarmData')}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[3],
                    fontSize: fontSize.base,
                    color: ui.text,
                  }}
                />
                {isMicAvailable && (
                  <Pressable
                    onPress={startListening}
                    accessibilityLabel={t('farmAssistant.a11y.openAssistant')}
                    accessibilityRole="button"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: borderRadius.full,
                      backgroundColor: ui.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="mic.fill" size={16} color={ui.primary} />
                  </Pressable>
                )}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!inputText.trim()}
                  accessibilityLabel={t('farmAssistant.a11y.submitQuery')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !inputText.trim() }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: borderRadius.full,
                    backgroundColor: inputText.trim() ? ui.primary : ui.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SymbolIcon
                    name="arrow.up"
                    size={16}
                    color={inputText.trim() ? m3.colorScheme.onPrimary : ui.primary}
                  />
                </Pressable>
              </View>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
