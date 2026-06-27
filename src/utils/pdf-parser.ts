import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
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

// Private bucket the report is uploaded to. The dynamic-api edge function reads
// it by path with the service role, so the file never travels as a request
// body (edge-function bodies over ~1-2MB hang).
const STORAGE_BUCKET = 'test-reports';

interface ReadFileResult {
  base64: string;
  mimeType: string;
  ext: string;
}

async function readFile(uri: string): Promise<ReadFileResult> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const lowerUri = uri.toLowerCase();
    let mimeType = 'image/jpeg';
    let ext = 'jpg';

    if (lowerUri.endsWith('.pdf')) {
      mimeType = 'application/pdf';
      ext = 'pdf';
    } else if (lowerUri.endsWith('.png')) {
      mimeType = 'image/png';
      ext = 'png';
    } else if (lowerUri.endsWith('.webp')) {
      mimeType = 'image/webp';
      ext = 'webp';
    } else if (lowerUri.endsWith('.gif')) {
      mimeType = 'image/gif';
      ext = 'gif';
    }

    return { base64, mimeType, ext };
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
    const { base64, mimeType, ext } = await readFile(fileUri);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to upload a lab report.');
    }

    // Upload to Storage first, then hand the edge function just the path.
    const storagePath = `${user.id}/${Date.now()}-lab-report.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, decodeBase64(base64), { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error('Lab report upload failed:', uploadError);
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }

    const { data, error } = await supabase.functions.invoke('dynamic-api', {
      body: {
        action: 'parse',
        storage_path: storagePath,
        filename: `lab-report.${ext}`,
        test_type: testType,
      },
    });

    if (error) {
      const ctx = (error as { context?: unknown }).context;
      console.error(
        `dynamic-api invoke failed | name=${error.name} | message=${error.message} | context=` +
          (ctx ? JSON.stringify(ctx, Object.getOwnPropertyNames(ctx)) : 'none'),
      );
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
