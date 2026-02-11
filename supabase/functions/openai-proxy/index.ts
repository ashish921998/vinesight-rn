import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const DEFAULT_MODEL = 'gpt-4o-mini';
const ALLOWED_MODELS = new Set([DEFAULT_MODEL]);
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1000;
const MAX_MAX_TOKENS = 4000;
const MAX_MESSAGES = 20;
const MAX_PARTS_PER_MESSAGE = 24;
const MAX_IMAGE_URL_LENGTH = 3_000_000;
const MAX_TEXT_PART_LENGTH = 24_000;
const MAX_TOTAL_TEXT_LENGTH = 120_000;
const MAX_IMAGES = 6;

type ProxyRole = 'system' | 'user' | 'assistant';

interface ProxyImagePart {
  type: 'image_url';
  image_url: { url: string };
}

interface ProxyTextPart {
  type: 'text';
  text: string;
}

type ProxyContentPart = ProxyImagePart | ProxyTextPart;

interface ProxyMessage {
  role: ProxyRole;
  content: string | ProxyContentPart[];
}

interface ProxyRequestBody {
  messages?: unknown;
  model?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  response_format?: unknown;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeModel(rawModel: unknown): { model?: string; error?: string } {
  if (rawModel === undefined || rawModel === null) {
    return { model: DEFAULT_MODEL };
  }
  if (typeof rawModel !== 'string') {
    return { error: 'Invalid model' };
  }
  if (!ALLOWED_MODELS.has(rawModel)) {
    return { error: `Model not allowed. Allowed models: ${Array.from(ALLOWED_MODELS).join(', ')}` };
  }
  return { model: rawModel };
}

function sanitizeTemperature(rawTemperature: unknown): { temperature?: number; error?: string } {
  if (rawTemperature === undefined || rawTemperature === null) {
    return { temperature: DEFAULT_TEMPERATURE };
  }
  if (typeof rawTemperature !== 'number' || !Number.isFinite(rawTemperature)) {
    return { error: 'Invalid temperature' };
  }
  return { temperature: Math.max(0, Math.min(2, rawTemperature)) };
}

function sanitizeMaxTokens(rawMaxTokens: unknown): { maxTokens?: number; error?: string } {
  if (rawMaxTokens === undefined || rawMaxTokens === null) {
    return { maxTokens: DEFAULT_MAX_TOKENS };
  }
  if (typeof rawMaxTokens !== 'number' || !Number.isFinite(rawMaxTokens)) {
    return { error: 'Invalid max_tokens' };
  }
  const rounded = Math.floor(rawMaxTokens);
  if (rounded <= 0) {
    return { error: 'max_tokens must be greater than 0' };
  }
  return { maxTokens: Math.min(rounded, MAX_MAX_TOKENS) };
}

function sanitizeResponseFormat(rawResponseFormat: unknown): {
  responseFormat?: { type: 'json_object' };
  error?: string;
} {
  if (rawResponseFormat === undefined || rawResponseFormat === null) {
    return {};
  }
  if (!isRecord(rawResponseFormat) || rawResponseFormat.type !== 'json_object') {
    return { error: 'Invalid response_format. Only { type: "json_object" } is allowed.' };
  }
  return { responseFormat: { type: 'json_object' } };
}

function sanitizeMessages(rawMessages: unknown): { messages?: ProxyMessage[]; error?: string } {
  if (!Array.isArray(rawMessages)) {
    return { error: 'messages must be an array' };
  }
  if (rawMessages.length === 0) {
    return { error: 'messages must not be empty' };
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return { error: `Too many messages. Maximum is ${MAX_MESSAGES}.` };
  }

  let totalTextLength = 0;
  let imageCount = 0;
  const sanitized: ProxyMessage[] = [];

  for (const rawMessage of rawMessages) {
    if (!isRecord(rawMessage)) {
      return { error: 'Invalid message format' };
    }

    const role = rawMessage.role;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      return { error: 'Invalid message role' };
    }

    const rawContent = rawMessage.content;
    if (typeof rawContent === 'string') {
      if (!rawContent.trim()) {
        return { error: 'Message content must not be empty' };
      }
      if (rawContent.length > MAX_TEXT_PART_LENGTH) {
        return { error: `Message content too long. Maximum ${MAX_TEXT_PART_LENGTH} characters.` };
      }
      totalTextLength += rawContent.length;
      if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
        return {
          error: `Total text content too long. Maximum ${MAX_TOTAL_TEXT_LENGTH} characters.`,
        };
      }
      sanitized.push({ role, content: rawContent });
      continue;
    }

    if (!Array.isArray(rawContent)) {
      return { error: 'Message content must be a string or an array of content parts' };
    }
    if (rawContent.length === 0) {
      return { error: 'Message content parts must not be empty' };
    }
    if (rawContent.length > MAX_PARTS_PER_MESSAGE) {
      return {
        error: `Too many content parts in one message. Maximum is ${MAX_PARTS_PER_MESSAGE}.`,
      };
    }

    const parts: ProxyContentPart[] = [];
    for (const rawPart of rawContent) {
      if (!isRecord(rawPart) || typeof rawPart.type !== 'string') {
        return { error: 'Invalid message content part' };
      }

      if (rawPart.type === 'text') {
        if (typeof rawPart.text !== 'string' || !rawPart.text.trim()) {
          return { error: 'Invalid text content part' };
        }
        if (rawPart.text.length > MAX_TEXT_PART_LENGTH) {
          return { error: `Text part too long. Maximum ${MAX_TEXT_PART_LENGTH} characters.` };
        }
        totalTextLength += rawPart.text.length;
        if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
          return {
            error: `Total text content too long. Maximum ${MAX_TOTAL_TEXT_LENGTH} characters.`,
          };
        }
        parts.push({ type: 'text', text: rawPart.text });
        continue;
      }

      if (rawPart.type === 'image_url') {
        if (!isRecord(rawPart.image_url) || typeof rawPart.image_url.url !== 'string') {
          return { error: 'Invalid image_url content part' };
        }

        const imageUrl = rawPart.image_url.url;
        if (!imageUrl.startsWith('data:image/') && !imageUrl.startsWith('https://')) {
          return { error: 'image_url must be a secure https URL or a data:image payload' };
        }
        if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
          return {
            error: `image_url payload too large. Maximum ${MAX_IMAGE_URL_LENGTH} characters.`,
          };
        }

        imageCount += 1;
        if (imageCount > MAX_IMAGES) {
          return { error: `Too many images. Maximum is ${MAX_IMAGES}.` };
        }

        parts.push({ type: 'image_url', image_url: { url: imageUrl } });
        continue;
      }

      return { error: `Unsupported content part type: ${rawPart.type}` };
    }

    sanitized.push({ role, content: parts });
  }

  return { messages: sanitized };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    if (!OPENAI_API_KEY) {
      return jsonResponse(500, { error: 'OpenAI API key not configured on server' });
    }

    let body: ProxyRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }

    const messageResult = sanitizeMessages(body.messages);
    if (messageResult.error || !messageResult.messages) {
      return jsonResponse(400, { error: messageResult.error ?? 'Invalid messages payload' });
    }

    const modelResult = sanitizeModel(body.model);
    if (modelResult.error || !modelResult.model) {
      return jsonResponse(400, { error: modelResult.error ?? 'Invalid model' });
    }

    const temperatureResult = sanitizeTemperature(body.temperature);
    if (temperatureResult.error || temperatureResult.temperature === undefined) {
      return jsonResponse(400, { error: temperatureResult.error ?? 'Invalid temperature' });
    }

    const maxTokensResult = sanitizeMaxTokens(body.max_tokens);
    if (maxTokensResult.error || maxTokensResult.maxTokens === undefined) {
      return jsonResponse(400, { error: maxTokensResult.error ?? 'Invalid max_tokens' });
    }

    const responseFormatResult = sanitizeResponseFormat(body.response_format);
    if (responseFormatResult.error) {
      return jsonResponse(400, { error: responseFormatResult.error });
    }

    const openaiBody: Record<string, unknown> = {
      model: modelResult.model,
      messages: messageResult.messages,
      temperature: temperatureResult.temperature,
      max_tokens: maxTokensResult.maxTokens,
    };
    if (responseFormatResult.responseFormat) {
      openaiBody.response_format = responseFormatResult.responseFormat;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openaiBody),
    });

    const openaiData = await openaiResponse.json().catch(() => ({
      error: {
        message: 'OpenAI response was not valid JSON',
      },
    }));

    return jsonResponse(openaiResponse.status, openaiData);
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});
