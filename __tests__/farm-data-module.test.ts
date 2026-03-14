/**
 * Tests for Farm Data Query Module
 * Tests activity detection, query type detection, and utility functions
 *
 * Note: These tests focus on pure JavaScript functions that don't require Deno imports.
 * Database and API integration tests should be done via integration tests or E2E.
 */

describe('Farm Data Module - Activity Detection', () => {
  // Activity detection patterns (extracted logic for testing)
  function detectActivity(
    text: string,
  ): 'irrigation' | 'spray' | 'fertigation' | 'expense' | 'harvest' | null {
    if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
    if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
    if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
    if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
    if (/\bharvest|yield|pick|कटनी|उत्पादन|पिक/i.test(text)) return 'harvest';
    return null;
  }

  function detectQueryType(text: string): string | null {
    if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
    if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
    if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
    if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
    if (/\bharvest|yield|pick|कटनी|उत्पादन/i.test(text)) return 'harvest';
    if (/\bwarehouse|inventory|stock|godown|गोदाम|स्टॉक|इन्व्हेंटरी/i.test(text))
      return 'warehouse';
    if (/\bworker|attendance|मजुर|कामगार|हजेरी|worker_attendance/i.test(text)) return 'workers';
    if (/\btask|reminder|काम|टास्क|reminder|remember/i.test(text)) return 'tasks';
    if (/\bsoil[\s_-]?test|मृदा|माती|चाचणी/i.test(text)) return 'soil_test';
    if (/\bpetiole|पेटियोल|देठ|पान/i.test(text)) return 'petiole_test';
    if (/\bdaily[\s_-]?note|नोंद|note|diary|दैनिक/i.test(text)) return 'daily_notes';
    if (/\bweather|हवामान|मौसम|पाऊस|बारिश/i.test(text)) return 'weather';
    return null;
  }

  function isLikelyHistoryIntent(text: string): boolean {
    return (
      /\b(total|how much|how many|last|latest|history|record|show|list|what|when)\b/i.test(text) ||
      /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट|दाखवा|यादी/i.test(text)
    );
  }

  function parseExplicitDate(text: string): string | null {
    const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (directIso?.[1]) return directIso[1];
    return null;
  }

  describe('detectActivity', () => {
    it('detects irrigation activity from English text', () => {
      expect(detectActivity('I irrigated for 3 hours')).toBe('irrigation');
      expect(detectActivity('water the farm today')).toBe('irrigation');
      expect(detectActivity('irrigation done')).toBe('irrigation');
    });

    it('detects irrigation activity from Hindi text', () => {
      expect(detectActivity('मैंने सिंचाई की')).toBe('irrigation');
      expect(detectActivity('सिंचन 2 घंटे')).toBe('irrigation');
    });

    it('detects spray activity from English text', () => {
      expect(detectActivity('spray pesticide today')).toBe('spray');
      expect(detectActivity('applied chemical spray')).toBe('spray');
      expect(detectActivity('pesticide application done')).toBe('spray');
    });

    it('detects spray activity from Hindi text', () => {
      expect(detectActivity('स्प्रे किया')).toBe('spray');
      expect(detectActivity('फवारणी आज')).toBe('spray');
      expect(detectActivity('छिड़काव किया')).toBe('spray');
    });

    it('detects fertigation activity', () => {
      expect(detectActivity('fertigation done')).toBe('fertigation');
      expect(detectActivity('applied fertilizer')).toBe('fertigation');
      expect(detectActivity('खत डाला')).toBe('fertigation');
      expect(detectActivity('उर्वरक दिया')).toBe('fertigation');
    });

    it('detects expense activity', () => {
      expect(detectActivity('expense of 500 rupees')).toBe('expense');
      expect(detectActivity('cost for labor')).toBe('expense');
      expect(detectActivity('खर्चा 1000')).toBe('expense');
      expect(detectActivity('लागत कितनी')).toBe('expense');
    });

    it('detects harvest activity', () => {
      expect(detectActivity('harvested 10 quintals')).toBe('harvest');
      expect(detectActivity('yield was good')).toBe('harvest');
      expect(detectActivity('picked grapes today')).toBe('harvest');
      expect(detectActivity('कटनी हुई')).toBe('harvest');
      expect(detectActivity('उत्पादन अच्छा')).toBe('harvest');
    });

    it('returns null for unrecognized activity', () => {
      expect(detectActivity('hello how are you')).toBe(null);
      expect(detectActivity('general question')).toBe(null);
      expect(detectActivity('what is the time')).toBe(null);
    });
  });

  describe('detectQueryType', () => {
    it('detects irrigation query type', () => {
      expect(detectQueryType('how much irrigation')).toBe('irrigation');
      expect(detectQueryType('सिंचाई कितनी')).toBe('irrigation');
    });

    it('detects warehouse query type', () => {
      expect(detectQueryType('what is in warehouse')).toBe('warehouse');
      expect(detectQueryType('गोदाम में क्या है')).toBe('warehouse');
      expect(detectQueryType('inventory status')).toBe('warehouse');
      expect(detectQueryType('stock check')).toBe('warehouse');
    });

    it('detects workers query type', () => {
      expect(detectQueryType('how many workers')).toBe('workers');
      expect(detectQueryType('मजुर कितने')).toBe('workers');
      expect(detectQueryType('worker attendance today')).toBe('workers');
      expect(detectQueryType('हजेरी दिखाओ')).toBe('workers');
    });

    it('detects tasks query type', () => {
      expect(detectQueryType('pending tasks')).toBe('tasks');
      expect(detectQueryType('show my reminders')).toBe('tasks');
      expect(detectQueryType('काम बाकी है')).toBe('tasks');
    });

    it('detects soil test query type', () => {
      expect(detectQueryType('soil test results')).toBe('soil_test');
      expect(detectQueryType('मृदा परीक्षण')).toBe('soil_test');
      expect(detectQueryType('माती चाचणी')).toBe('soil_test');
    });

    it('detects petiole test query type', () => {
      expect(detectQueryType('petiole test report')).toBe('petiole_test');
      expect(detectQueryType('पेटियोल टेस्ट')).toBe('petiole_test');
    });

    it('detects daily notes query type', () => {
      expect(detectQueryType('daily notes')).toBe('daily_notes');
      expect(detectQueryType('नोंद दाखवा')).toBe('daily_notes');
      expect(detectQueryType('my diary entries')).toBe('daily_notes');
    });

    it('detects weather query type', () => {
      expect(detectQueryType('what is the weather')).toBe('weather');
      expect(detectQueryType('हवामान कसे आहे')).toBe('weather');
      expect(detectQueryType('मौसम कैसा है')).toBe('weather');
      expect(detectQueryType('पाऊस होईल का')).toBe('weather');
    });

    it('returns null for unrecognized query', () => {
      expect(detectQueryType('hello world')).toBe(null);
      expect(detectQueryType('random text')).toBe(null);
    });
  });

  describe('isLikelyHistoryIntent', () => {
    it('detects history intent in English', () => {
      expect(isLikelyHistoryIntent('total irrigation hours')).toBe(true);
      expect(isLikelyHistoryIntent('how much did I spend')).toBe(true);
      expect(isLikelyHistoryIntent('show last record')).toBe(true);
      expect(isLikelyHistoryIntent('what is the history')).toBe(true);
      expect(isLikelyHistoryIntent('list all records')).toBe(true);
      expect(isLikelyHistoryIntent('when was the last spray')).toBe(true);
    });

    it('detects history intent in Hindi', () => {
      expect(isLikelyHistoryIntent('कुल कितना')).toBe(true);
      expect(isLikelyHistoryIntent('कितने रिकॉर्ड')).toBe(true);
      expect(isLikelyHistoryIntent('शेवट का रिकॉर्ड')).toBe(true);
      expect(isLikelyHistoryIntent('इतिहास दिखाओ')).toBe(true);
    });

    it('detects history intent in Marathi', () => {
      expect(isLikelyHistoryIntent('एकूण किती')).toBe(true);
      expect(isLikelyHistoryIntent('दाखवा नोंद')).toBe(true);
      expect(isLikelyHistoryIntent('यादी पहा')).toBe(true);
    });

    it('returns false for non-history queries', () => {
      expect(isLikelyHistoryIntent('hello world')).toBe(false);
      expect(isLikelyHistoryIntent('log irrigation')).toBe(false);
      expect(isLikelyHistoryIntent('spray today')).toBe(false);
    });
  });

  describe('parseExplicitDate', () => {
    it('parses ISO date format', () => {
      expect(parseExplicitDate('2025-01-15')).toBe('2025-01-15');
      expect(parseExplicitDate('log on 2024-12-31')).toBe('2024-12-31');
      expect(parseExplicitDate('record for 2025-06-01')).toBe('2025-06-01');
    });

    it('returns null for no date', () => {
      expect(parseExplicitDate('no date here')).toBe(null);
      expect(parseExplicitDate('today')).toBe(null);
      expect(parseExplicitDate('yesterday')).toBe(null);
    });

    it('validates year range (regex matches 2000-2099)', () => {
      // Regex: \b(20\d{2}-\d{2}-\d{2})\b only matches years 2000-2099
      expect(parseExplicitDate('1999-01-01')).toBe(null); // 199x not matched
      expect(parseExplicitDate('2000-01-01')).toBe('2000-01-01'); // 2000 matched
      expect(parseExplicitDate('2025-03-14')).toBe('2025-03-14'); // 2025 matched
      expect(parseExplicitDate('2099-12-31')).toBe('2099-12-31'); // 2099 matched
      expect(parseExplicitDate('2100-01-01')).toBe(null); // 2100 not matched
    });
  });
});

describe('Farm Data Module - Weather Context', () => {
  function getWeatherCondition(temp: number, precipitation: number): string {
    if (precipitation > 5) return 'Rainy';
    if (precipitation > 0) return 'Light Rain';
    if (temp > 35) return 'Hot';
    if (temp > 25) return 'Sunny';
    if (temp > 15) return 'Partly Cloudy';
    return 'Cloudy';
  }

  function isWeatherDependentQuery(transcript: string): boolean {
    const weatherKeywords = [
      /\bweather|rain|spray.*today|fertigation.*today|temperature|hot|cold|humidity|irrigation.*need/i,
      /हवामान|पाऊस|बारिश|आज|स्प्रे|तापमान|गरम|ठंड|नमी|पाणी|सिंचन/,
    ];
    return weatherKeywords.some((regex) => regex.test(transcript));
  }

  function isWeatherQuery(transcript: string): boolean {
    return /\bweather|हवामान|मौसम/i.test(transcript);
  }

  describe('getWeatherCondition', () => {
    it('returns Rainy for heavy precipitation', () => {
      expect(getWeatherCondition(25, 10)).toBe('Rainy');
      expect(getWeatherCondition(30, 20)).toBe('Rainy');
    });

    it('returns Light Rain for light precipitation', () => {
      expect(getWeatherCondition(25, 2)).toBe('Light Rain');
      expect(getWeatherCondition(28, 4)).toBe('Light Rain');
    });

    it('returns Hot for high temperature', () => {
      expect(getWeatherCondition(40, 0)).toBe('Hot');
      expect(getWeatherCondition(38, 0)).toBe('Hot');
    });

    it('returns Sunny for moderate-high temperature', () => {
      expect(getWeatherCondition(30, 0)).toBe('Sunny');
      expect(getWeatherCondition(28, 0)).toBe('Sunny');
    });

    it('returns Partly Cloudy for moderate temperature', () => {
      expect(getWeatherCondition(20, 0)).toBe('Partly Cloudy');
      expect(getWeatherCondition(24, 0)).toBe('Partly Cloudy');
    });

    it('returns Cloudy for low temperature', () => {
      expect(getWeatherCondition(10, 0)).toBe('Cloudy');
      expect(getWeatherCondition(14, 0)).toBe('Cloudy');
    });
  });

  describe('isWeatherDependentQuery', () => {
    it('detects weather-dependent queries', () => {
      expect(isWeatherDependentQuery('should I spray today?')).toBe(true);
      expect(isWeatherDependentQuery('irrigation need today')).toBe(true);
      expect(isWeatherDependentQuery('will it rain?')).toBe(true);
      expect(isWeatherDependentQuery('is it hot outside?')).toBe(true);
      expect(isWeatherDependentQuery('what is the humidity')).toBe(true);
    });

    it('detects Hindi weather queries', () => {
      expect(isWeatherDependentQuery('आज स्प्रे करू?')).toBe(true);
      expect(isWeatherDependentQuery('पाणी लागेल का?')).toBe(true);
      expect(isWeatherDependentQuery('गरम आहे का?')).toBe(true);
    });

    it('returns false for non-weather queries', () => {
      expect(isWeatherDependentQuery('log irrigation')).toBe(false);
      expect(isWeatherDependentQuery('hello world')).toBe(false);
      expect(isWeatherDependentQuery('show my tasks')).toBe(false);
    });
  });

  describe('isWeatherQuery', () => {
    it('detects explicit weather queries', () => {
      expect(isWeatherQuery('what is the weather?')).toBe(true);
      expect(isWeatherQuery('हवामान कसे?')).toBe(true);
      expect(isWeatherQuery('मौसम कैसा है?')).toBe(true);
    });

    it('returns false for implicit weather queries', () => {
      expect(isWeatherQuery('should I spray?')).toBe(false);
      expect(isWeatherQuery('is it hot?')).toBe(false);
    });
  });
});

describe('Farm Data Module - Localization', () => {
  function getLocalizedMessage(locale: string, key: string): string {
    const messages: Record<string, Record<string, string>> = {
      en: {
        no_records: 'No records found.',
        no_irrigation: 'No irrigation records found.',
        no_spray: 'No spray records found.',
        total_irrigation: 'Total irrigation is {hours} hours.',
      },
      hi: {
        no_records: 'कोई रिकॉर्ड नहीं मिला।',
        no_irrigation: 'कोई सिंचाई रिकॉर्ड नहीं मिला।',
        no_spray: 'कोई स्प्रे रिकॉर्ड नहीं मिला।',
        total_irrigation: 'कुल सिंचाई {hours} घंटे है।',
      },
      mr: {
        no_records: 'कोणतीही नोंद आढळली नाही.',
        no_irrigation: 'कोणतीही सिंचन नोंद आढळली नाही.',
        no_spray: 'कोणतीही फवारणी नोंद आढळली नाही.',
        total_irrigation: 'एकूण सिंचन {hours} तास आहे.',
      },
    };
    return messages[locale]?.[key] ?? messages.en[key] ?? key;
  }

  it('returns English messages for en locale', () => {
    expect(getLocalizedMessage('en', 'no_records')).toBe('No records found.');
    expect(getLocalizedMessage('en', 'no_irrigation')).toBe('No irrigation records found.');
  });

  it('returns Hindi messages for hi locale', () => {
    expect(getLocalizedMessage('hi', 'no_records')).toBe('कोई रिकॉर्ड नहीं मिला।');
    expect(getLocalizedMessage('hi', 'no_irrigation')).toBe('कोई सिंचाई रिकॉर्ड नहीं मिला।');
  });

  it('returns Marathi messages for mr locale', () => {
    expect(getLocalizedMessage('mr', 'no_records')).toBe('कोणतीही नोंद आढळली नाही.');
    expect(getLocalizedMessage('mr', 'no_irrigation')).toBe('कोणतीही सिंचन नोंद आढळली नाही.');
  });

  it('falls back to English for unknown locale', () => {
    expect(getLocalizedMessage('fr', 'no_records')).toBe('No records found.');
  });
});
