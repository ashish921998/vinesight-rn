import { create } from 'zustand';
import type {
  FarmAssistantStatus,
  QueryIntent,
  AssistantAnswer,
  ClarificationPrompt,
} from '@/types/voice-assistant';

interface FarmAssistantState {
  isModalVisible: boolean;
  status: FarmAssistantStatus;
  transcript: string;
  intent: QueryIntent | null;
  answer: AssistantAnswer | null;
  clarification: ClarificationPrompt | null;
  error: string | null;
  isMicAvailable: boolean;
}

interface FarmAssistantActions {
  openModal: () => void;
  closeModal: () => void;
  setStatus: (status: FarmAssistantStatus) => void;
  setTranscript: (text: string) => void;
  setIntent: (intent: QueryIntent) => void;
  setAnswer: (answer: AssistantAnswer) => void;
  setClarification: (clarification: ClarificationPrompt | null) => void;
  setError: (error: string) => void;
  setMicAvailable: (available: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE: FarmAssistantState = {
  isModalVisible: false,
  status: 'idle',
  transcript: '',
  intent: null,
  answer: null,
  clarification: null,
  error: null,
  isMicAvailable: true,
};

export const useFarmAssistantStore = create<FarmAssistantState & FarmAssistantActions>((set) => ({
  ...INITIAL_STATE,

  openModal: () => set({ isModalVisible: true }),
  closeModal: () => set((state) => ({ ...INITIAL_STATE, isMicAvailable: state.isMicAvailable })),
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setIntent: (intent) => set({ intent }),
  setAnswer: (answer) => set({ answer, status: 'answered' }),
  setClarification: (clarification) =>
    set({ clarification, status: clarification ? 'clarifying' : 'idle' }),
  setError: (error) => set({ error, status: 'error' }),
  setMicAvailable: (isMicAvailable) => set({ isMicAvailable }),
  reset: () =>
    set((state) => ({
      ...INITIAL_STATE,
      isModalVisible: true,
      isMicAvailable: state.isMicAvailable,
    })),
}));
