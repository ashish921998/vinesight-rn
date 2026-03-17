import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '@/components/assistant/ChatScreen';

export default function AssistantScreen() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  return <ChatScreen initialFarmId={farmId} />;
}
