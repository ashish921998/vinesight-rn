import { sendAssistantTurn, AssistantGatewayErrorCode } from '@/services/assistant-gateway';

const mockInvoke = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/data-access', () => {
  const dataAccess = {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

describe('assistant-gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
  });

  it('maps ai-gateway response into assistant turn metadata', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        assistant_text: 'Irrigation total is 6.5 hours.',
        assistant_audio_b64: 'ZmFrZS1hdWRpbw==',
        assistant_audio_mime_type: 'audio/mpeg',
        audio_provider_used: 'sarvam',
        model_used: 'gpt-4o',
        citations: [
          {
            id: 'c1',
            title: 'Irrigation logs',
            source_type: 'farm_record',
            confidence: 0.95,
          },
        ],
        safety_flags: {
          blocked: false,
          risk_level: 'low',
          reasons: [],
          escalation_suggested: false,
        },
        trace_id: 'trace-1',
        latency_ms: 812,
        conversation_id: 'conversation-1',
        turn_id: 'turn-1',
        route_decision: 'voice_log',
        voice_log_action: {
          kind: 'clarify',
          draft: {
            type: 'irrigation',
            farmId: 22,
            farmName: 'Sunset Farm',
            date: '2026-02-13',
            irrigation: { durationHours: null },
            spray: { waterVolume: null, chemicals: [] },
            harvest: { quantity: null, grade: null, price: null, buyer: null },
            expense: { cost: null, expenseType: null, remarks: null },
            fertigation: { waterVolume: null, fertilizers: [] },
          },
          missing_fields: ['duration'],
          expected_field: 'duration',
          clarify_attempts: 1,
        },
        stt_provider_used: 'sarvam',
        stt_confidence: 0.86,
        stt_latency_ms: 420,
        tts_generation_ms: 560,
      },
      error: null,
    });

    const response = await sendAssistantTurn({
      conversationId: 'conversation-1',
      userMessage: 'How much irrigation this month?',
      language: 'en',
      inputMode: 'text',
      conversationHistory: [],
      attachments: [],
      farmContext: {
        farmId: 22,
        farmName: 'Sunset Farm',
      },
    });

    expect(response.message.content).toBe('Irrigation total is 6.5 hours.');
    expect(response.message.audio?.provider).toBe('sarvam');
    expect(response.message.citations).toHaveLength(1);
    expect(response.message.traceId).toBe('trace-1');
    expect(response.latencyMs).toBe(812);
    expect(response.routeDecision).toBe('voice_log');
    expect(response.voiceLogAction?.kind).toBe('clarify');
    expect(response.voiceLogAction?.expectedField).toBe('duration');
    expect(response.sttProviderUsed).toBe('sarvam');
    expect(response.sttConfidence).toBe(0.86);
    expect(response.sttLatencyMs).toBe(420);
    expect(response.ttsGenerationMs).toBe(560);
  });

  it('throws a server error when ai-gateway fails (no legacy fallback)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Function not found' },
    });

    await expect(
      sendAssistantTurn({
        conversationId: null,
        userMessage: 'What should I do for powdery mildew?',
        language: 'en',
        inputMode: 'text',
        conversationHistory: [],
        attachments: [],
        farmContext: {
          farmId: 22,
        },
      }),
    ).rejects.toMatchObject({ code: AssistantGatewayErrorCode.SERVER_ERROR });
  });

  it('downgrades audio input mode to text when raw audio payload is missing', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        assistant_text: 'Captured your question from transcript.',
        model_used: 'gpt-4o',
        conversation_id: 'conversation-1',
        turn_id: 'turn-2',
      },
      error: null,
    });

    const response = await sendAssistantTurn({
      conversationId: 'conversation-1',
      userMessage: 'How much irrigation today?',
      language: 'en',
      inputMode: 'audio',
      conversationHistory: [],
      attachments: [],
      farmContext: {
        farmId: 22,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'ai-gateway',
      expect.objectContaining({
        body: expect.objectContaining({
          input_mode: 'text',
          input_text: 'How much irrigation today?',
          input_audio_b64: null,
        }),
      }),
    );
    expect(response.message.inputMode).toBe('text');
  });

  it('sends audio payload to gateway when voice bytes are available', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        assistant_text: 'Processed voice input.',
        model_used: 'gpt-4o',
        conversation_id: 'conversation-1',
        turn_id: 'turn-3',
      },
      error: null,
    });

    const response = await sendAssistantTurn({
      conversationId: 'conversation-1',
      userMessage: 'Log irrigation for 2 hours',
      language: 'en',
      inputMode: 'audio',
      inputAudioBase64: 'ZmFrZS1hdWRpby1ieXRlcw==',
      audioFormat: 'audio/wav',
      conversationHistory: [],
      attachments: [],
      farmContext: {
        farmId: 22,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'ai-gateway',
      expect.objectContaining({
        body: expect.objectContaining({
          input_mode: 'audio',
          input_audio_b64: 'ZmFrZS1hdWRpby1ieXRlcw==',
          audio_format: 'audio/wav',
        }),
      }),
    );
    expect(response.message.inputMode).toBe('audio');
  });

  it('forwards client user-turn persistence hint to gateway', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        assistant_text: 'Acknowledged.',
        model_used: 'gpt-4o',
        conversation_id: 'conversation-1',
        turn_id: 'turn-4',
      },
      error: null,
    });

    await sendAssistantTurn({
      conversationId: 'conversation-1',
      userMessage: 'Show irrigation total',
      language: 'en',
      inputMode: 'text',
      clientPersistedUserTurn: true,
      conversationHistory: [],
      attachments: [],
      farmContext: {
        farmId: 22,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'ai-gateway',
      expect.objectContaining({
        body: expect.objectContaining({
          client_capabilities: expect.objectContaining({
            client_persisted_user_turn: true,
          }),
        }),
      }),
    );
  });
});
