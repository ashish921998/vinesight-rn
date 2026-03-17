/**
 * Farm Query Routing Module
 * Route decision (decideChatRoute), clarification response handling, and all message builders.
 */

import type { ActivityLogExtractionResult } from './intent.ts';
import type { HybridChatRoute, VoiceLogDraft, VoiceLogMissingField, QueryIntent } from './types.ts';
import {
  ADVISORY_INTENT_MIN_CONFIDENCE,
  LOG_INTENT_MIN_CONFIDENCE,
  QUERY_INTENT_MIN_CONFIDENCE,
  ROUTE_MARGIN,
  VOICE_PATTERNS,
  detectActivityTypeFromText,
  hasLoggingSignal,
  isLikelyLogHistoryQuery,
  scoreFromDeterministicQueryIntent,
} from './intent-patterns.ts';

// ============================================================
// MARK: - Route Scoring
// ============================================================

function scoreFromLLMIntent(
  extraction: ActivityLogExtractionResult | null | undefined,
  targetIntent: ActivityLogExtractionResult['intent'],
): number {
  if (!extraction || extraction.intent !== targetIntent) return 0;
  const rawScore = extraction.intentConfidence ?? extraction.confidence;
  return Math.min(1, Math.max(0, rawScore));
}

// ============================================================
// MARK: - Route Decision
// ============================================================

/**
 * Decide the route for a chat message based on transcript and extraction results.
 */
export function decideChatRoute(input: {
  transcript: string;
  hasActiveDraft: boolean;
  llmExtraction?: ActivityLogExtractionResult | null;
  deterministicQueryIntent?: QueryIntent | null;
}): HybridChatRoute {
  const { transcript, hasActiveDraft, llmExtraction, deterministicQueryIntent } = input;

  const queryScore = Math.max(
    scoreFromLLMIntent(llmExtraction, 'query_history'),
    scoreFromDeterministicQueryIntent(deterministicQueryIntent),
  );
  const logScore = scoreFromLLMIntent(llmExtraction, 'log_activity');
  const advisoryScore = scoreFromLLMIntent(llmExtraction, 'advisory');

  // If there's an active draft, prioritise voice_log unless there's strong alternate intent
  if (hasActiveDraft) {
    const hasExplicitQueryIntent =
      /\b(show|history|how\s+much|how\s+many|total|list|records?)\b/i.test(transcript) ||
      /दिखाओ|दिखाएं|दाखवा|इतिहास|कितना|कितने|किती/i.test(transcript);
    const hasExplicitAdvisoryIntent =
      /\b(should\s+i|what\s+should|recommend|suggest|advice|how\s+to)\b/i.test(transcript) ||
      /सुझाव|सलाह|सल्ला|कैसे|कसा|मुझे\s+क्या/i.test(transcript);

    const wantsToEscapeDraft = hasExplicitQueryIntent || hasExplicitAdvisoryIntent;
    const hasStrongAlternateIntent =
      (queryScore >= QUERY_INTENT_MIN_CONFIDENCE ||
        advisoryScore >= ADVISORY_INTENT_MIN_CONFIDENCE) &&
      logScore < LOG_INTENT_MIN_CONFIDENCE - 0.1;

    if (!wantsToEscapeDraft || !hasStrongAlternateIntent) return 'voice_log';
  }

  // Advisory takes precedence if high confidence
  if (
    advisoryScore >= ADVISORY_INTENT_MIN_CONFIDENCE &&
    advisoryScore >= queryScore + ROUTE_MARGIN &&
    advisoryScore >= logScore + ROUTE_MARGIN
  ) {
    return 'advisory';
  }

  // Ambiguous between query and log
  if (
    queryScore >= QUERY_INTENT_MIN_CONFIDENCE &&
    logScore >= LOG_INTENT_MIN_CONFIDENCE &&
    Math.abs(queryScore - logScore) <= ROUTE_MARGIN &&
    advisoryScore < Math.max(queryScore, logScore)
  ) {
    return 'clarify_route';
  }

  // Clear query intent
  if (
    queryScore >= QUERY_INTENT_MIN_CONFIDENCE &&
    queryScore >= logScore + ROUTE_MARGIN &&
    queryScore >= advisoryScore + ROUTE_MARGIN
  ) {
    return 'farm_query';
  }

  // Clear log intent
  if (
    logScore >= LOG_INTENT_MIN_CONFIDENCE &&
    logScore >= queryScore + ROUTE_MARGIN &&
    logScore >= advisoryScore + ROUTE_MARGIN
  ) {
    return 'voice_log';
  }

  // Advisory with moderate confidence
  if (
    advisoryScore >= ADVISORY_INTENT_MIN_CONFIDENCE &&
    advisoryScore >= Math.max(logScore, queryScore)
  ) {
    return 'advisory';
  }

  // Weak signals — fallback to patterns
  if (queryScore >= QUERY_INTENT_MIN_CONFIDENCE) return 'farm_query';
  if (logScore >= LOG_INTENT_MIN_CONFIDENCE) return 'voice_log';
  if (isLikelyLogHistoryQuery(transcript)) return 'farm_query';
  if (hasLoggingSignal(transcript) && detectActivityTypeFromText(transcript)) return 'voice_log';

  return 'fallback_llm';
}

// ============================================================
// MARK: - Route Clarification Response Handling
// ============================================================

/**
 * Resolve route clarification response from user reply
 */
export function resolveRouteClarificationResponse(
  transcript: string,
): Exclude<HybridChatRoute, 'advisory' | 'clarify_route' | 'fallback_llm'> | null {
  const text = transcript.trim();
  if (!text) return null;

  if (/^1$/.test(text)) return 'voice_log';
  if (/^2$/.test(text)) return 'farm_query';

  if (
    /\b(log|record|add|create|new\s+entry|new\s+log)\b/i.test(text) ||
    /लॉग|नोंद|नोंदवा|नयी\s+एंट्री|नई\s+एंट्री|नया\s+लॉग/i.test(text)
  ) {
    return 'voice_log';
  }

  if (
    /\b(history|records?|show|list|total|how\s+many|how\s+much|past)\b/i.test(text) ||
    /कितना|कितने|इतिहास|रेकॉर्ड|रिकॉर्ड|मागील|कुल|एकूण/i.test(text)
  ) {
    return 'farm_query';
  }

  return null;
}

/**
 * Check if user wants to cancel route clarification
 */
export function isRouteClarificationCancelResponse(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return false;
  if (VOICE_PATTERNS.cancel.some((pattern) => pattern.test(text))) return true;
  return /\b(exit|quit|go\s+back|back)\b/i.test(text);
}

// ============================================================
// MARK: - Voice Log Message Builders
// ============================================================

function getMissingFieldLabel(locale: 'en' | 'hi' | 'mr', field: VoiceLogMissingField): string {
  if (locale === 'hi') {
    if (field === 'farm') return 'खेत';
    if (field === 'duration') return 'अवधि';
    if (field === 'waterVolume') return 'पानी मात्रा';
    if (field === 'chemicals') return 'रसायन';
    if (field === 'quantity') return 'मात्रा';
    if (field === 'grade') return 'ग्रेड';
    if (field === 'cost') return 'राशि';
    if (field === 'expenseType') return 'खर्च प्रकार';
    return 'उर्वरक';
  }
  if (locale === 'mr') {
    if (field === 'farm') return 'शेत';
    if (field === 'duration') return 'कालावधी';
    if (field === 'waterVolume') return 'पाणी प्रमाण';
    if (field === 'chemicals') return 'रसायने';
    if (field === 'quantity') return 'प्रमाण';
    if (field === 'grade') return 'ग्रेड';
    if (field === 'cost') return 'रक्कम';
    if (field === 'expenseType') return 'खर्च प्रकार';
    return 'खते';
  }
  if (field === 'farm') return 'farm';
  if (field === 'duration') return 'duration';
  if (field === 'waterVolume') return 'water volume';
  if (field === 'chemicals') return 'chemicals';
  if (field === 'quantity') return 'quantity';
  if (field === 'grade') return 'grade';
  if (field === 'cost') return 'cost';
  if (field === 'expenseType') return 'expense type';
  return 'fertilizers';
}

export function buildVoiceLogClarificationMessage(
  locale: 'en' | 'hi' | 'mr',
  missingFields: VoiceLogMissingField[],
): string {
  const labels = missingFields.map((f) => getMissingFieldLabel(locale, f)).join(', ');
  if (locale === 'hi') return `कृपया बाकी जानकारी दें: ${labels}`;
  if (locale === 'mr') return `कृपया उरलेले तपशील सांगा: ${labels}`;
  return `Please share the remaining details: ${labels}.`;
}

export function buildVoiceLogCancelledMessage(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') return 'ठीक है, मैंने लॉगिंग फ्लो रद्द कर दिया।';
  if (locale === 'mr') return 'ठीक आहे, नोंदणी प्रक्रिया रद्द केली.';
  return 'Okay, I cancelled the logging flow.';
}

export function buildVoiceLogNoFarmsMessage(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') return 'पहले एक खेत जोड़ें, फिर मैं लॉगिंग फ़ॉर्म खोल दूँगा।';
  if (locale === 'mr') return 'आधी एक शेत जोडा, मग मी नोंदणी फॉर्म उघडतो.';
  return 'Please add a farm first, then I can open a logging form.';
}

export function buildVoiceLogClarifyExhaustedMessage(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') {
    return 'मैं सभी विवरण नहीं समझ पाया। फ़ॉर्म खोल रहा हूँ ताकि आप मैन्युअली पूरा कर सकें।';
  }
  if (locale === 'mr') {
    return 'मला सर्व तपशील समजले नाहीत. फॉर्म उघडत आहे जेणेकरून तुम्ही स्वतः पूर्ण करू शकता.';
  }
  return "I couldn't capture all the details. Opening the form so you can complete it manually.";
}

export function buildVoiceLogOpeningFormMessage(
  locale: 'en' | 'hi' | 'mr',
  draft: VoiceLogDraft,
): string {
  const farmName =
    draft.farmName ??
    (locale === 'en' ? 'Unknown farm' : locale === 'hi' ? 'अज्ञात खेत' : 'अज्ञात शेत');
  if (locale === 'hi') {
    return `मैंने ${draft.type} ${draft.date} को ${farmName} के लिए कैप्चर किया है। कृपया फ़ॉर्म की पुष्टि करके सेव करें।`;
  }
  if (locale === 'mr') {
    return `मी ${draft.type} ${draft.date} रोजी ${farmName} साठी घेतले आहे. कृपया फॉर्म तपासून सेव करा.`;
  }
  return `Captured ${draft.type} on ${draft.date} at ${farmName}. Opening the form for review and submit.`;
}

// ============================================================
// MARK: - Route Clarification Message Builders
// ============================================================

export function buildRouteClarificationPrompt(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') {
    return 'मैं दोनों में मदद कर सकता हूँ। जवाब दें:\n1) नई गतिविधि लॉग करें\n2) पुराने रिकॉर्ड दिखाएँ';
  }
  if (locale === 'mr') {
    return 'मी दोन्हीमध्ये मदत करू शकतो. उत्तर द्या:\n1) नवीन क्रियाकलाप नोंदवा\n2) जुने रेकॉर्ड दाखवा';
  }
  return 'I can help with both. Reply with:\n1) Log a new activity\n2) Show past records';
}

export function buildRouteClarificationRetry(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') return 'कृपया आगे बढ़ने के लिए 1 या 2 लिखें।';
  if (locale === 'mr') return 'कृपया पुढे जाण्यासाठी 1 किंवा 2 लिहा.';
  return 'Please reply with 1 or 2 so I can continue.';
}

export function buildRouteClarificationCancelled(locale: 'en' | 'hi' | 'mr'): string {
  if (locale === 'hi') return 'ठीक है, वह विकल्प रद्द किया। अब आप कुछ भी पूछ सकते हैं।';
  if (locale === 'mr') return 'ठीक आहे, तो पर्याय रद्द केला. आता काहीही विचारा.';
  return 'Okay, I cancelled that choice. Ask me anything else.';
}
