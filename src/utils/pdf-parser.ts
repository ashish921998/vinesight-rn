/**
 * Lab Test Parser Utility using OpenAI
 * Extracts lab test data from PDF reports or images
 */

import * as FileSystem from 'expo-file-system';
import OpenAI from 'openai';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../constants/lab-test-parameters';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // Required for Expo/React Native
});

export interface ParsedLabTest {
  testDate?: string;
  parameters: Record<string, number>;
  recommendations?: string;
  notes?: string;
}

/**
 * Read image file as base64
 */
async function readImageAsBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // Determine MIME type based on URI
    let mimeType = 'image/jpeg';
    if (uri.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (uri.endsWith('.webp')) {
      mimeType = 'image/webp';
    } else if (uri.endsWith('.gif')) {
      mimeType = 'image/gif';
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error reading image:', error);
    throw new Error('Failed to read image file');
  }
}

/**
 * Parse lab test data from image using OpenAI Vision
 */
export async function parseLabTestFromImage(
  imageUri: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  const parameters = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const paramKeys = parameters.map((p) => `${p.key} (${p.label})`).join(', ');
  const paramKeyNames = parameters.map((p) => p.key).join(', ');

  try {
    const base64Image = await readImageAsBase64(imageUri);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting lab test data from agricultural test reports.

Available parameters: ${paramKeys}

Extract the test data from the image and return a JSON object with this exact structure:
{
  "testDate": "YYYY-MM-DD" (optional, extract from report if available),
  "parameters": {
    "key": numeric_value (only include parameters that are present in the report)
  },
  "recommendations": "text" (optional, extract recommendations if available),
  "notes": "text" (optional, extract any additional notes)
}

Only include parameters that are explicitly mentioned with values in the report.
Use parameter keys from this list exactly: ${paramKeyNames}
Convert all numeric values to numbers (not strings).
Pay attention to units and convert if necessary to match the expected units.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ${testType} test data from this lab report image:`,
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Validate and clean parameters
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
    console.error('Error parsing lab test from image:', error);
    throw new Error('Failed to parse lab test data from image');
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
  const paramKeys = parameters.map((p) => `${p.key} (${p.label})`).join(', ');
  const paramKeyNames = parameters.map((p) => p.key).join(', ');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting lab test data from agricultural test reports.

Available parameters: ${paramKeys}

Extract the test data from the provided text and return a JSON object with this exact structure:
{
  "testDate": "YYYY-MM-DD" (optional, extract from report if available),
  "parameters": {
    "key": numeric_value (only include parameters that are present in the report)
  },
  "recommendations": "text" (optional, extract recommendations if available),
  "notes": "text" (optional, extract any additional notes)
}

Only include parameters that are explicitly mentioned with values in the report.
Use parameter keys from this list exactly: ${paramKeyNames}
Convert all numeric values to numbers (not strings).
Pay attention to units and convert if necessary to match the expected units.`,
        },
        {
          role: 'user',
          content: `Extract ${testType} test data from this lab report text:\n\n${text}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Validate and clean parameters
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
