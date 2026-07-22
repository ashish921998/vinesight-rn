import * as FileSystem from 'expo-file-system/legacy';
import { getDataAccess } from '@/data-access';
import { validateAndCleanParameters } from './lab-test-utils';

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

export async function parseLabTestFromImage(
  fileUri: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  try {
    const { dataUrl, filename } = await readFileAsBase64(fileUri);

    const { data, error } = await getDataAccess().functions.invoke('dynamic-api', {
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

    return {
      testDate: response.testDate || undefined,
      parameters: validateAndCleanParameters(response.parameters || [], testType),
      recommendations: response.summary || undefined,
      notes: response.rawNotes || undefined,
    };
  } catch (error) {
    console.error('Error parsing lab test:', error);
    throw new Error('Failed to parse lab test data');
  }
}
