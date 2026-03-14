/**
 * Safety Checker Module
 * Validates spray/fertigation advice for safety compliance.
 */

import type { HybridChatRoute } from '../routing/index.ts';

export interface SafetyFlags {
  blocked: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  escalation_suggested: boolean;
}

/**
 * Check if text contains spray or fertigation topic signals
 */
export function isSprayOrFertigationTopic(text: string): boolean {
  return /(spray|pesticide|fungicide|insecticide|chemical|fertigation|fertiliz|dose|dosage|ppm|ml\/l|gm\/l|फवारणी|स्प्रे|छिड़काव|खत|फर्टिगेशन|उर्वरक)/i.test(
    text,
  );
}

/**
 * Check if text contains dosage signals
 */
export function hasDosageSignal(text: string): boolean {
  return /(\d+(\.\d+)?\s?(ml|mL|gm|g|kg|l|liter|litre|ppm|%)\b|\bdose\b|\bdosage\b|\brange\b)/i.test(
    text,
  );
}

/**
 * Check if text contains PPE signals
 */
export function hasPpeSignal(text: string): boolean {
  return /(ppe|gloves|mask|respirator|goggles|protective|safety kit|long sleeves|हातमोजे|मास्क|सुरक्षा|दस्ताने)/i.test(
    text,
  );
}

/**
 * Check if text contains uncertainty signals
 */
export function hasUncertaintySignal(text: string): boolean {
  return /(uncertain|depends|if symptoms persist|verify|confirm|may vary|likely|confidence|अनिश्चित|तपासा|पुष्टि|कदाचित|बहुधा)/i.test(
    text,
  );
}

/**
 * Check if text contains escalation signals
 */
export function hasEscalationSignal(text: string): boolean {
  return /(consult|agronomist|expert|extension officer|lab test|soil test|escalate|seek local advice|तज्ञ|विशेषज्ञ|कृषी अधिकारी|प्रयोगशाळा)/i.test(
    text,
  );
}

/**
 * Build safety flags for advisory response
 */
export function buildSafetyFlags(input: {
  adviceText: string;
  transcript: string;
  routeDecision: HybridChatRoute;
  citationCount: number;
}): SafetyFlags {
  const reasons: string[] = [];
  const lower = input.adviceText.toLowerCase();
  const combinedText = `${input.transcript}\n${input.adviceText}`;
  const strictGuardrails = isSprayOrFertigationTopic(combinedText);
  const isAdvisoryRoute =
    input.routeDecision === 'advisory' || input.routeDecision === 'fallback_llm';

  if (isAdvisoryRoute && input.citationCount === 0) {
    reasons.push('Advisory response missing citations');
  }

  if (strictGuardrails && !hasDosageSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing dosage range');
  }

  if (strictGuardrails && !hasPpeSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing PPE guidance');
  }

  if (strictGuardrails && !hasUncertaintySignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing uncertainty statement');
  }

  if (strictGuardrails && !hasEscalationSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing escalation trigger');
  }

  if (
    /(mix|dose|ml|gm|kg|liter)/i.test(input.adviceText) &&
    !/(safety|ppe|gloves|mask|protect)/i.test(input.adviceText)
  ) {
    reasons.push('Dosage advice missing explicit safety precautions');
  }

  if (/\bguarantee|100% cure|certainly\b/i.test(lower)) {
    reasons.push('Overconfident claim detected');
  }

  if (/(banned|illegal|unapproved)/i.test(lower)) {
    reasons.push('Potentially unsafe or non-compliant recommendation');
  }

  let risk: SafetyFlags['risk_level'] = 'low';
  if (reasons.length >= 3) risk = 'critical';
  else if (reasons.length === 2) risk = 'high';
  else if (reasons.length === 1) risk = 'medium';

  const blockedByStrictGuardrails = strictGuardrails && reasons.length >= 2;

  return {
    blocked: risk === 'critical' || blockedByStrictGuardrails,
    risk_level: risk,
    reasons,
    escalation_suggested: risk === 'high' || risk === 'critical',
  };
}

/**
 * Build blocked advice message for user
 */
export function buildBlockedAdviceMessage(
  locale: 'en' | 'hi' | 'mr',
  strictGuardrails: boolean,
): string {
  if (strictGuardrails) {
    if (locale === 'hi') {
      return 'सुरक्षित स्प्रे/फर्टिगेशन सलाह देने के लिए आवश्यक जानकारी या सत्यापन पूरा नहीं है। कृपया उत्पाद लेबल, फसल अवस्था और स्थानीय मौसम साझा करें, या स्थानीय कृषि विशेषज्ञ से पुष्टि करें।';
    }
    if (locale === 'mr') {
      return 'सुरक्षित फवारणी/फर्टिगेशन सल्ल्यासाठी आवश्यक माहिती किंवा पडताळणी अपुरी आहे. कृपया उत्पादन लेबल, पिकाची अवस्था आणि स्थानिक हवामान द्या, किंवा स्थानिक कृषी तज्ञांशी खात्री करा.';
    }
    return 'I cannot provide spray/fertigation advice yet because key safety details are missing or unverified. Share product label, crop stage, and local weather, or confirm with a local agronomy expert.';
  }

  if (locale === 'hi') {
    return 'यह सलाह जोखिमपूर्ण लग रही है। कृपया स्थानीय कृषि विशेषज्ञ से पुष्टि करें।';
  }
  if (locale === 'mr') {
    return 'ही सूचना जोखमीची वाटते. कृपया स्थानिक कृषी तज्ञांची खात्री करा.';
  }
  return 'This recommendation appears risky. Please confirm with a local agronomy expert.';
}
