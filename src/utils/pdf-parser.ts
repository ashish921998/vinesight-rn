import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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

// Matches the test-reports bucket's file_size_limit. Storage rejects larger
// uploads outright, so we pre-check to fail with a friendlier message.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadFile {
  base64: string;
  mimeType: string;
  ext: string;
}

// Expo's file/image APIs return unwrapped base64, but normalize defensively:
// the size math below and base64-arraybuffer's decode both assume no embedded
// whitespace (unlike atob, base64-arraybuffer corrupts rather than skips it).
function normalizeBase64(value: string): string {
  return value.replace(/[\t\n\f\r ]/g, '');
}

// The Sarvam OCR pipeline in the dynamic-api edge function only accepts a PDF or
// a JPEG/PNG image. We detect the real type from magic bytes (not the URI
// extension, which lies on iOS where a HEIC image can arrive as `.jpg`). PDFs
// and real JPEG/PNG pass through untouched.
function detectPassthrough(bytes: Uint8Array): { mimeType: string; ext: string } | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  // %PDF
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { mimeType: 'application/pdf', ext: 'pdf' };
  // \x89 P N G
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { mimeType: 'image/png', ext: 'png' };
  // JPEG SOI marker
  if (startsWith([0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', ext: 'jpg' };
  return null; // HEIC/HEIF/WebP/TIFF/GIF/etc — convert to JPEG below.
}

async function prepareUpload(uri: string): Promise<UploadFile> {
  let base64: string;
  try {
    base64 = normalizeBase64(
      await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
    );
  } catch (error) {
    console.error('[PDF Parser] Error reading file:', error);
    throw new Error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Sniff the first bytes (24 chars of base64 -> 18 bytes) for a format the OCR
  // pipeline accepts directly.
  const headBytes = new Uint8Array(decodeBase64(base64.slice(0, 24)));
  const passthrough = detectPassthrough(headBytes);
  if (passthrough) {
    return { base64, mimeType: passthrough.mimeType, ext: passthrough.ext };
  }

  // Anything else the picker can hand us (iOS HEIC/HEIF camera photos, WebP,
  // TIFF, GIF) is converted to JPEG on-device so the upload is always in a
  // format Sarvam can OCR.
  try {
    // No transform actions — a no-op re-encode to JPEG. compress 0.9 keeps text
    // legible for OCR while trimming size toward the 10MB cap.
    const result = await manipulateAsync(uri, [], {
      format: SaveFormat.JPEG,
      compress: 0.9,
      base64: true,
    });
    if (!result.base64) throw new Error('Image conversion returned no data');
    return { base64: normalizeBase64(result.base64), mimeType: 'image/jpeg', ext: 'jpg' };
  } catch (error) {
    console.error('[PDF Parser] Image conversion failed:', error);
    throw new Error('Unsupported file. Please upload a PDF or an image (JPG, PNG, HEIC, WebP).');
  }
}

export async function parseLabTestFromImage(
  fileUri: string,
  testType: 'soil' | 'petiole',
): Promise<ParsedLabTest> {
  const { base64, mimeType, ext } = await prepareUpload(fileUri);

  // base64 decodes to 3/4 of its length minus any trailing '=' padding.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength > MAX_FILE_SIZE) {
    throw new Error('This report is too large. Please upload a file under 10MB.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error('You must be signed in to upload a lab report.');
  }
  const user = userData.user;

  // Upload to Storage first, then hand the edge function just the path. The
  // path is timestamped so it is unique per upload; `upsert: false` keeps us
  // to the insert-only RLS policy (no UPDATE policy exists on this bucket).
  // Random suffix (not just Date.now()) so a double-tap or fast retry in the
  // same millisecond can't collide — with upsert:false a collision would 409.
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${user.id}/${uniqueId}-lab-report.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, decodeBase64(base64), { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error('Lab report upload failed:', uploadError);
    throw new Error(`Failed to upload report: ${uploadError.message}`);
  }

  // Cleanup contract: the edge function deletes the object once it downloads
  // it. This catch covers failures before that point (network error, auth
  // failure, validation 400) so orphans don't accumulate in the bucket.
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
      // FunctionsHttpError carries the edge Response in `context`; its JSON
      // body holds the real { error, details } the function returned, which is
      // far more useful than the generic "non-2xx status code" message.
      let detail = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const errBody = await ctx.json();
          if (errBody?.error) {
            detail = errBody.details ? `${errBody.error}: ${errBody.details}` : errBody.error;
          }
        } catch {
          // Non-JSON body — keep the generic message.
        }
      }
      console.error(`dynamic-api invoke failed | name=${error.name} | detail=${detail}`);
      throw new Error(`AI proxy request failed: ${detail}`);
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
}
