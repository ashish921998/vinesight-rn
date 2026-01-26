import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import Markdown from 'react-native-markdown-display';
import { useFarm } from '@/hooks';
import { aiService } from '@/services/aiService';
import { ChatMessage } from '@/types/ai';

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
  const router = useRouter();
  const { id: farmId } = useLocalSearchParams<{ id?: string }>();
  const { data: farm } = useFarm(farmId ? parseInt(farmId, 10) : undefined);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const DEFAULT_SUGGESTIONS = [
    'How much water do I need?',
    'Check for common diseases',
    'Fertilizer recommendations',
    'Pruning tips for grapes',
  ];

  useEffect(() => {
    if (!aiService.isConfigured()) {
      Alert.alert(
        'API Key Required',
        'Please configure your OpenAI API key in the environment settings.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  }, [router]);

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
      scrollToBottom();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to get response from AI',
        [{ text: 'OK' }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Vinesight AI',
          headerStyle: { backgroundColor: '#f2f2f7' },
          headerTintColor: '#000000',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <Symbol name="chevron.left" size={24} color="#000000" />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        className="flex-1 bg-surface-50"
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 90 : 0}
      >
        <View className="flex-1">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 pb-4"
            contentContainerStyle={{ paddingTop: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <View className="flex-1 items-center justify-center py-8">
                <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
                  <Symbol name="lightbulb.fill" size={40} color="#408059" />
                </View>
                <Text className="text-xl font-bold text-surface-900 mb-2">Vinesight AI</Text>
                <Text className="text-base text-surface-500 text-center mb-6 px-8">
                  Your personal farming assistant. Ask me anything about grape farming, irrigation,
                  diseases, or harvest!
                </Text>
                <View className="w-full gap-2">
                  {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      className="p-3 bg-white rounded-xl border border-surface-100"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      }}
                    >
                      <Text className="text-sm text-surface-700 text-center">{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                className={`flex-row mb-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-2 mt-1">
                    <Symbol name="lightbulb.fill" size={16} color="#408059" />
                  </View>
                )}
                <View
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 rounded-br-sm'
                      : 'bg-white rounded-bl-sm'
                  }`}
                  style={
                    message.role === 'assistant'
                      ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        }
                      : {}
                  }
                >
                  {message.role === 'assistant' ? (
                    <Markdown style={markdownStyles} mergeStyle={true}>
                      {message.content}
                    </Markdown>
                  ) : (
                    <Text className="text-base text-white">{message.content}</Text>
                  )}
                  <Text
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-white/70' : 'text-surface-400'
                    }`}
                  >
                    {formatMessageTime(message.timestamp)}
                  </Text>
                </View>
                {message.role === 'user' && (
                  <View className="w-8 h-8 bg-primary-200 rounded-full items-center justify-center ml-2 mt-1">
                    <Symbol name="person.fill" size={16} color="#408059" />
                  </View>
                )}
              </View>
            ))}

            {isLoading && (
              <View className="flex-row items-start justify-start mb-3">
                <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-2 mt-1">
                  <Symbol name="lightbulb.fill" size={16} color="#408059" />
                </View>
                <View
                  className="px-4 py-3 bg-white rounded-2xl rounded-bl-sm"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <ActivityIndicator size="small" color="#408059" />
                </View>
              </View>
            )}

            {suggestions.length > 0 && !isLoading && messages.length > 0 && (
              <View className="mt-4 pt-4 border-t border-surface-100">
                <Text className="text-xs text-surface-500 mb-2">Suggested questions:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleSuggestionPress(suggestion)}
                      className="mr-2 px-4 py-2 bg-primary-50 rounded-full"
                    >
                      <Text className="text-sm text-primary-700">{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View className="p-4 bg-white border-t border-surface-100">
            <View className="flex-row items-end gap-2">
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask about farming..."
                placeholderTextColor="#9CA3AF"
                multiline
                className="flex-1 min-h-[44px] max-h-[120px] px-4 py-3 bg-surface-100 rounded-2xl text-surface-900 text-base"
                textAlignVertical="top"
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage()}
              />
              <TouchableOpacity
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  inputText.trim() && !isLoading ? 'bg-primary-600' : 'bg-surface-200'
                }`}
              >
                <Symbol
                  name="paperplane.fill"
                  size={20}
                  color={inputText.trim() && !isLoading ? '#FFFFFF' : '#9CA3AF'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
