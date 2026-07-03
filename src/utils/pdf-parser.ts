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

// The Sarvam OCR pipeline in the dynamic-api edge function only accepts a PDF
// or a JPEG/PNG image. Detecting the type from the file's magic bytes (rather
// than the URI extension) keeps the client and edge function in agreement and
// catches iOS quirks like a HEIC image handed to us with a `.jpg` extension.
type SupportedType = { mimeType: string; ext: string };

function detectSupportedType(bytes: Uint8Array): SupportedType | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  // %PDF
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { mimeType: 'application/pdf', ext: 'pdf' };
  // \x89 P N G
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { mimeType: 'image/png', ext: 'png' };
  // JPEG SOI marker
  if (startsWith([0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', ext: 'jpg' };
  return null; // GIF, WebP, HEIC, and anything else are unsupported upstream.
}

async function readFile(uri: string): Promise<ReadFileResult> {
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    console.error('[PDF Parser] Error reading file:', error);
    throw new Error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Sniff the first bytes (24 chars of base64 -> 18 bytes) to determine the
  // real content type instead of trusting the file extension.
  const headBytes = new Uint8Array(decodeBase64(base64.slice(0, 24)));
  const detected = detectSupportedType(headBytes);
  if (!detected) {
    throw new Error('Unsupported file. Please upload a PDF, JPEG, or PNG lab report.');
  }

  return { base64, mimeType: detected.mimeType, ext: detected.ext };
}

export async function parseLabTestFromImage(
  fileUri: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  try {
    const { base64, mimeType, ext } = await readFile(fileUri);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      throw new Error('You must be signed in to upload a lab report.');
    }
    const user = userData.user;

    // Upload to Storage first, then hand the edge function just the path. The
    // path is timestamped so it is unique per upload; `upsert: false` keeps us
    // to the insert-only RLS policy (no UPDATE policy exists on this bucket).
    const storagePath = `${user.id}/${Date.now()}-lab-report.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, decodeBase64(base64), { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('Lab report upload failed:', uploadError);
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }

    // The edge function deletes the object on success, but not on every failure
    // path (and not if the invoke never reaches it). Clean up the orphan here on
    // any failure after a successful upload so the bucket doesn't accumulate files.
    try {
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
    } catch (invokeError) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath])
        .catch(() => {});
      throw invokeError;
    }
  } catch (error) {
    console.error('Error parsing lab test:', error);
    throw new Error('Failed to parse lab test data');
  }
}
