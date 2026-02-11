import type { VoiceLogActivityType } from '@/types/voice-log';

interface VoicePatternSet {
  logAction: RegExp[];
  historyQuery: RegExp[];
  cancel: RegExp[];
  activities: Record<VoiceLogActivityType, RegExp[]>;
}

const ENGLISH_PATTERNS: VoicePatternSet = {
  logAction: [
    /\b(log|record|add|create|save|submit|enter)\b/i,
    /\b(i\s+want\s+to|let\s+me|please)\b/i,
  ],
  historyQuery: [
    /\bhow\s+many\b/i,
    /\bhow\s+much\b/i,
    /\bwhat\s+(did|was|were)\b/i,
    /\bshow\b/i,
    /\blist\b/i,
    /\btotal\b/i,
    /\bhistory\b/i,
    /\blast\b/i,
    /\blatest\b/i,
    /\bwhen\s+did\b/i,
    /\bdid\s+(i|we)\b/i,
  ],
  cancel: [/\bcancel\b/i, /\bstop\b/i, /\bnever\s*mind\b/i, /\bskip\b/i],
  activities: {
    irrigation: [/\birrigat(e|ed|ion|ing)\b/i, /\bwater(ing|ed)?\b/i, /\bdrip\b/i],
    spray: [
      /\bspray(ed|ing)?\b/i,
      /\bchemical(s)?\b/i,
      /\bpesticide(s)?\b/i,
      /\bfungicide(s)?\b/i,
      /\binsecticide(s)?\b/i,
    ],
    harvest: [/\bharvest(ed|ing)?\b/i, /\bpick(ing|ed)?\b/i, /\bgrapes?\s+picked\b/i],
    expense: [
      /\bexpense(s)?\b/i,
      /\bcost(s|ed|ing)?\b/i,
      /\bspent?\b/i,
      /\bspending\b/i,
      /\bbill(s)?\b/i,
    ],
    fertigation: [
      /\bfertigat(e|ed|ion|ing)\b/i,
      /\bfertiliz(e|ed|er|ers|ing)\b/i,
      /\bfertilis(e|ed|er|ers|ing)\b/i,
      /\bnutrient(s)?\b/i,
    ],
  },
};

const HINDI_PATTERNS: VoicePatternSet = {
  logAction: [/लॉग/i, /रिकॉर्ड/i, /जोड़/i],
  historyQuery: [/कितना/i, /कितने/i, /कुल/i],
  cancel: [/रद्द/i, /बंद/i],
  activities: {
    irrigation: [/सिंचाई/i, /पानी/i],
    spray: [/स्प्रे/i, /छिड़काव/i],
    harvest: [/कटाई/i, /तोड़ाई/i],
    expense: [/खर्च/i, /लागत/i],
    fertigation: [/उर्वरक/i, /खाद/i, /फर्टिगेशन/i],
  },
};

const MARATHI_PATTERNS: VoicePatternSet = {
  logAction: [/नोंद/i, /नोंदव/i, /सेव/i],
  historyQuery: [/किती/i, /एकूण/i, /दाखव/i, /यादी/i, /शेवट/i, /माग(चा|ची|चे|च्या)/i, /कधी/i],
  cancel: [/थांब/i, /थांबा/i, /बंद/i],
  activities: {
    irrigation: [/पाणी/i, /ठिबक/i],
    spray: [/फवारणी/i],
    harvest: [/कापणी/i, /तोडणी/i],
    expense: [/खर्च/i, /किंमत/i],
    fertigation: [/खत/i],
  },
};

function mergePatternSets(...sets: VoicePatternSet[]): VoicePatternSet {
  const merged: VoicePatternSet = {
    logAction: [],
    historyQuery: [],
    cancel: [],
    activities: {
      irrigation: [],
      spray: [],
      harvest: [],
      expense: [],
      fertigation: [],
    },
  };

  for (const set of sets) {
    merged.logAction.push(...set.logAction);
    merged.historyQuery.push(...set.historyQuery);
    merged.cancel.push(...set.cancel);
    for (const key of Object.keys(merged.activities) as VoiceLogActivityType[]) {
      merged.activities[key].push(...set.activities[key]);
    }
  }

  return merged;
}

export const VOICE_PATTERNS = mergePatternSets(ENGLISH_PATTERNS, HINDI_PATTERNS, MARATHI_PATTERNS);
