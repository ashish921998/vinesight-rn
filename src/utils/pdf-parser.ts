/**
 * Lab Test Parser Utility using OpenAI (via Supabase Edge Function)
 * Extracts lab test data from PDF reports or images
 */

import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../constants/lab-test-parameters';

export interface ParsedLabTest {
  testDate?: string;
  parameters: Record<string, number>;
  recommendations?: string;
  notes?: string;
}

interface ParseResponse {
  parameters: Array<{ name: string; value: number }>;
  summary: string | null;
  rawNotes: string | null;
  confidence: number | null;
  testDate: string | null;
}

async function readFileAsBase64(uri: string): Promise<{ dataUrl: string; filename: string }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const lowerUri = uri.toLowerCase();
    let mimeType = 'image/jpeg';
    let filename = 'report.jpg';

    if (lowerUri.endsWith('.pdf')) {
      mimeType = 'application/pdf';
      filename = 'lab-report.pdf';
    } else if (lowerUri.endsWith('.png')) {
      mimeType = 'image/png';
      filename = 'report.png';
    } else if (lowerUri.endsWith('.webp')) {
      mimeType = 'image/webp';
      filename = 'report.webp';
    } else if (lowerUri.endsWith('.gif')) {
      mimeType = 'image/gif';
      filename = 'report.gif';
    }

    const dataUrl = `data:${mimeType};base64,${base64}`;
    return { dataUrl, filename };
  } catch (error) {
    console.error('[PDF Parser] Error reading file:', error);
    throw new Error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Parse lab test data from image or PDF using OpenAI
 */
export async function parseLabTestFromImage(
  fileUri: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  const parameters = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;

  try {
    const { dataUrl, filename } = await readFileAsBase64(fileUri);

    const { data, error } = await supabase.functions.invoke('dynamic-api', {
      body: {
        action: 'parse',
        file_data: dataUrl,
        filename,
        test_type: testType,
      },
    });

    if (error) {
      console.error('AI proxy request error:', JSON.stringify(error, null, 2));
      throw new Error(`AI proxy request failed: ${error.message}`);
    }

    if (data?.error) {
      console.error('AI proxy returned error:', JSON.stringify(data.error, null, 2));
      throw new Error(`AI proxy error: ${data.error.message ?? JSON.stringify(data.error)}`);
    }

    const response = data as ParseResponse;

    const chemicalNameMap: Record<string, string> = {
      'no3-n': 'nitrate_nitrogen',
      'nh4-n': 'ammoniacal_nitrogen',
      nitrate_n: 'nitrate_nitrogen',
      ammonium_n: 'ammoniacal_nitrogen',
      'n-no3': 'nitrate_nitrogen',
      'n-nh4': 'ammoniacal_nitrogen',
    };

    const cleanParameters: Record<string, number> = {};
    for (const { name, value } of response.parameters || []) {
      const lowerName = name.trim().toLowerCase();

      if (chemicalNameMap[lowerName]) {
        const param = parameters.find((p) => p.key === chemicalNameMap[lowerName]);
        if (param && typeof value === 'number' && !isNaN(value)) {
          cleanParameters[param.key] = value;
        }
        continue;
      }

      let normalizedKey = lowerName.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      if (normalizedKey === 'ammonical_nitrogen') {
        normalizedKey = 'ammoniacal_nitrogen';
      }

      const param = parameters.find((p) => p.key === normalizedKey || p.key === name.toLowerCase());
      if (param && typeof value === 'number' && !isNaN(value)) {
        cleanParameters[param.key] = value;
      }
    }

    return {
      testDate: response.testDate || undefined,
      parameters: cleanParameters,
      recommendations: response.summary || undefined,
      notes: response.rawNotes || undefined,
    };
  } catch (error) {
    console.error('Error parsing lab test:', error);
    throw new Error('Failed to parse lab test data');
  }
}

/**
 * Parse lab test data from text using OpenAI
 */
export async function parseLabTestFromText(
  text: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  const parameters = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;

  try {
    const { data, error } = await supabase.functions.invoke('dynamic-api', {
      body: {
        action: 'parse_text',
        text,
        test_type: testType,
      },
    });

    if (error) {
      throw new Error(`AI proxy request failed: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`AI proxy error: ${data.error.message ?? JSON.stringify(data.error)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI proxy');
    }

    const parsed = JSON.parse(content);

    const cleanParameters: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.parameters || {})) {
      const param = parameters.find((p) => p.key === key);
      if (param && typeof value === 'number' && !isNaN(value)) {
        cleanParameters[key] = value;
      }
    }

    return {
      testDate: parsed.testDate,
      parameters: cleanParameters,
      recommendations: parsed.recommendations,
      notes: parsed.notes,
    };
  } catch (error) {
    console.error('Error parsing lab test from text:', error);
    throw new Error('Failed to parse lab test data from text');
  }
}
