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
 * - Request cancellation: new message cancels pending in-flight request (VAL-CROSS-011)
 * - Does not send empty messages
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAssistant, DEFAULT_SUGGESTIONS } from '@/hooks/use-assistant';
import { sendAssistantTurn, cancelPendingAssistantTurnRequest } from '@/services/assistant-gateway';
import { assistantMemoryService } from '@/services/assistant-memory';

jest.mock('@/services/assistant-gateway', () => ({
  sendAssistantTurn: jest.fn(),
  cancelPendingAssistantTurnRequest: jest.fn(),
  AssistantGatewayError: class AssistantGatewayError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  AssistantGatewayErrorCode: {
    CANCELED: 'CANCELED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    AUDIO_VALIDATION_FAILED: 'AUDIO_VALIDATION_FAILED',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    RATE_LIMITED: 'RATE_LIMITED',
    UNKNOWN: 'UNKNOWN',
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
const mockCancelPending = cancelPendingAssistantTurnRequest as jest.Mock;

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
    expect(mockCancelPending).not.toHaveBeenCalled();
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

  it('retryLastMessage does not add a duplicate user message bubble', async () => {
    mockSendAssistantTurn
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Retry this');
    });

    // After failure: 1 user bubble, error set
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.retryLastMessage();
    });

    // After retry success: 2 messages (user + assistant), NOT 3
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].role).toBe('assistant');
  });

  it('retryLastMessage preserves attachments from the original send', async () => {
    mockSendAssistantTurn
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeResponse());
    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    // Add an attachment before sending
    act(() => {
      result.current.addAttachment({
        kind: 'image',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,abc',
      });
    });

    await act(async () => {
      await result.current.sendMessage('With attachment');
    });

    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.retryLastMessage();
    });

    // The retry call should include the stored attachment
    expect(mockSendAssistantTurn).toHaveBeenCalledTimes(2);
    expect(mockSendAssistantTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userMessage: 'With attachment',
        attachments: [expect.objectContaining({ kind: 'image', name: 'photo.jpg' })],
      }),
      expect.anything(),
    );
  });

  it('includes farmContext in API request when provided', async () => {
    mockSendAssistantTurn.mockResolvedValue(makeResponse());
    const farmContext = {
      farmId: 1,
      farmName: 'My Farm',
      cropVariety: 'Shiraz',
      area: 5,
      region: 'Nashik',
    };
    const { result } = renderHook(() => useAssistant({ language: 'en', farmContext }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(mockSendAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ farmContext }),
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

describe('useAssistant request cancellation (VAL-CROSS-011)', () => {
  // Helper to get the AssistantGatewayError mock class
  const getMockError = (code: string, message: string): Error & { code: string } => {
    const { AssistantGatewayError } = jest.requireMock('@/services/assistant-gateway') as {
      AssistantGatewayError: new (code: string, message: string) => Error & { code: string };
    };
    return new AssistantGatewayError(code, message);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not show error when sendAssistantTurn throws CANCELED (simulates cancellation)', async () => {
    // When the backend reports CANCELED (e.g., because the request was aborted),
    // the hook should silently discard the error and not show it to the user.
    mockSendAssistantTurn.mockRejectedValueOnce(getMockError('CANCELED', 'Request was canceled'));

    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Some message');
    });

    // CANCELED error must not be surfaced to the user
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sends next message successfully after a CANCELED error', async () => {
    // First message is cancelled; second message should succeed normally.
    mockSendAssistantTurn
      .mockRejectedValueOnce(getMockError('CANCELED', 'Request was canceled'))
      .mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    // First send — simulated cancellation
    await act(async () => {
      await result.current.sendMessage('First message');
    });
    expect(result.current.error).toBeNull();

    // Second send — should succeed normally
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    expect(mockSendAssistantTurn).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.messages[result.current.messages.length - 1].role).toBe('assistant');
  });

  it('clears isLoading after cancelled request followed by successful request', async () => {
    mockSendAssistantTurn
      .mockRejectedValueOnce(getMockError('CANCELED', 'Canceled'))
      .mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    await act(async () => {
      await result.current.sendMessage('Message 1');
    });

    await act(async () => {
      await result.current.sendMessage('Message 2');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('calls cancelPendingAssistantTurnRequest when new message sent while first is in-flight', async () => {
    // Use a controlled promise to keep the first request pending while second starts
    let resolveFirstRequest!: (v: unknown) => void;
    const firstPendingPromise = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });
    mockSendAssistantTurn
      .mockReturnValueOnce(firstPendingPromise)
      .mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() => useAssistant({ language: 'en' }));

    // Wrap in act: fire first message (doesn't resolve) then fire second
    await act(async () => {
      // Fire first without awaiting — it stays pending
      const firstSendPromise = result.current.sendMessage('First message');
      // Now fire second, which should cancel the first
      await result.current.sendMessage('Second message');
      // Resolve first to clean up
      resolveFirstRequest(makeResponse());
      await firstSendPromise;
    });

    // cancelPendingAssistantTurnRequest should have been called once (for the first request)
    expect(mockCancelPending).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });
});
