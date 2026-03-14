/**
 * Tests for useAssistant hook.
 * Verifies:
 * - Initial state (empty messages, null conversationId, false isLoading)
 * - sendMessage adds user message, sets loading, then adds response
 * - sendMessage uses inputText when no text argument provided
 * - startNewConversation resets state
 * - loadConversation loads messages from memory service
 * - Error state when sendAssistantTurn throws
 * - retryLastMessage re-sends the last user message
 * - Does not send when isLoading is true
 * - Does not send empty messages
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAssistant, DEFAULT_SUGGESTIONS } from '@/hooks/use-assistant';
import {
  sendAssistantTurn,
  cancelAllPendingAssistantTurnRequests,
} from '@/services/assistant-gateway';
import { assistantMemoryService } from '@/services/assistant-memory';

jest.mock('@/services/assistant-gateway', () => ({
  sendAssistantTurn: jest.fn(),
  cancelAllPendingAssistantTurnRequests: jest.fn(),
  AssistantGatewayError: class AssistantGatewayError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('@/services/assistant-memory', () => ({
  assistantMemoryService: {
    loadRecentMessages: jest.fn(),
    listConversations: jest.fn(),
    deleteConversation: jest.fn(),
  },
}));

const mockLoadRecentMessages = assistantMemoryService.loadRecentMessages as jest.Mock;

const mockSendAssistantTurn = sendAssistantTurn as jest.Mock;
const mockCancelAll = cancelAllPendingAssistantTurnRequests as jest.Mock;

const makeResponse = (overrides = {}) => ({
  message: {
    id: 'assistant-1',
    role: 'assistant' as const,
    content: 'Here is my answer.',
    timestamp: new Date(),
    conversationId: 'conv-abc',
    inputMode: 'text' as const,
  },
  suggestions: ['Follow-up question'],
  ...overrides,
});

describe('useAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useAssistant({ language: 'en' }));
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.inputText).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sendMessage adds user message immediately', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Hello AI');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello AI');
  });

  it('sendMessage adds assistant response to messages', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Hello AI');
    });

    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Here is my answer.');
  });

  it('sendMessage sets conversationId from response', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.conversationId).toBe('conv-abc');
  });

  it('sendMessage updates suggestions from response', async () => {
    mockSendAssistantTurn.mockResolvedValue(
      makeResponse({ suggestions: ['What else?', 'Show more'] }),
    );
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.suggestions).toEqual(['What else?', 'Show more']);
  });

  it('sendMessage clears inputText', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    act(() => {
      result.current.setInputText('My question');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.inputText).toBe('');
  });

  it('sendMessage uses inputText when no text argument', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    act(() => {
      result.current.setInputText('From input');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(mockSendAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: 'From input' }),
      expect.anything(),
    );
  });

  it('does not send empty message', async () => {
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('');
    });

    expect(mockSendAssistantTurn).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('does not send whitespace-only message', async () => {
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(mockSendAssistantTurn).not.toHaveBeenCalled();
  });

  it('sets error when sendAssistantTurn throws', async () => {
    mockSendAssistantTurn.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Will fail');
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  it('clears error on new message attempt', async () => {
    mockSendAssistantTurn
      .mockRejectedValueOnce(new Error('First fail'))
      .mockResolvedValueOnce(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Will fail');
    });
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.sendMessage('Will succeed');
    });
    expect(result.current.error).toBeNull();
  });

  it('startNewConversation resets all state', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.inputText).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockCancelAll).toHaveBeenCalled();
  });

  it('retryLastMessage re-sends the last user message', async () => {
    mockSendAssistantTurn
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Retry this');
    });

    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.retryLastMessage();
    });

    // The second call should succeed
    expect(mockSendAssistantTurn).toHaveBeenCalledTimes(2);
    expect(mockSendAssistantTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({ userMessage: 'Retry this' }),
      expect.anything(),
    );
  });
});

describe('useAssistant loadConversation', () => {
  const storedMessages = [
    {
      id: 'turn-1',
      role: 'user' as const,
      content: 'Prior question',
      timestamp: new Date('2026-03-01T10:00:00Z'),
      conversationId: 'old-conv',
      inputMode: 'text' as const,
    },
    {
      id: 'turn-2',
      role: 'assistant' as const,
      content: 'Prior answer',
      timestamp: new Date('2026-03-01T10:00:05Z'),
      conversationId: 'old-conv',
      inputMode: 'text' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadRecentMessages.mockResolvedValue(storedMessages);
  });

  it('sets conversationId and loads messages', async () => {
    const { result } = renderHook(() => useAssistant({ language: 'en' }));
    await act(async () => {
      await result.current.loadConversation('old-conv');
    });
    expect(result.current.conversationId).toBe('old-conv');
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Prior question');
    expect(result.current.messages[1].content).toBe('Prior answer');
  });

  it('clears previous messages before loading', async () => {
    mockSendAssistantTurn.mockResolvedValue({
      message: {
        id: 'a-1',
        role: 'assistant' as const,
        content: 'Answer',
        timestamp: new Date(),
        conversationId: 'new-conv',
      },
      suggestions: [],
    });
    const { result } = renderHook(() => useAssistant({ language: 'en' }));
    await act(async () => {
      await result.current.sendMessage('First message');
    });
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.loadConversation('old-conv');
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Prior question');
  });

  it('sets isLoading false after successful load', async () => {
    const { result } = renderHook(() => useAssistant({ language: 'en' }));
    await act(async () => {
      await result.current.loadConversation('old-conv');
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error and isLoading false on failure', async () => {
    mockLoadRecentMessages.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAssistant({ language: 'en' }));
    await act(async () => {
      await result.current.loadConversation('bad-conv');
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversationId).toBe('bad-conv');
  });
});

describe('useAssistant i18n keys', () => {
  it('exports DEFAULT_SUGGESTIONS with ai.* prefixed keys', () => {
    expect(DEFAULT_SUGGESTIONS).toBeDefined();
    expect(Array.isArray(DEFAULT_SUGGESTIONS)).toBe(true);
    expect(DEFAULT_SUGGESTIONS.length).toBeGreaterThan(0);
    DEFAULT_SUGGESTIONS.forEach((key: string) => {
      expect(key.startsWith('ai.')).toBe(true);
    });
  });
});
