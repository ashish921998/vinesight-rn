import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { zipSync } from 'https://esm.sh/fflate@0.8.2';

// All-Sarvam lab-report parser.
//
// Input: the client (src/utils/pdf-parser.ts) uploads the report to the
// private `test-reports` bucket and sends { storage_path }. We read the file
// by path with the service role (a base64 file in the body would exceed the
// edge-function body limit and hang). `file_data` is kept as a small-file
// fallback.
//
// Pipeline:
//   1. Sarvam Document Intelligence (Sarvam Vision) OCRs the report -> Markdown.
//   2. Sarvam chat completions extracts the structured nutrient parameters
//      from that Markdown against a strict JSON schema.

const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY');
// Chat model used for the structured-extraction step. Valid API models are
// sarvam-105b (flagship) and sarvam-30b (cheaper). NOTE: sarvam-m is
// deprecated and no longer served by the API. Override via env, no code change.
const SARVAM_CHAT_MODEL = Deno.env.get('SARVAM_CHAT_MODEL') ?? 'sarvam-105b';

// Clients upload the report to this private bucket and pass only the object
// path, so the request body stays tiny. Edge-function request bodies over
// ~1-2MB (plan-dependent) hang, so a base64 file in the body is not viable.
// The file is read + deleted server-side with the service role.
const STORAGE_BUCKET = 'test-reports';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const SARVAM_BASE = 'https://api.sarvam.ai';
const DI_BASE = `${SARVAM_BASE}/doc-digitization/job/v1`;
const CHAT_URL = `${SARVAM_BASE}/v1/chat/completions`;

const OCR_LANGUAGE = 'en-IN';
const OCR_OUTPUT_FORMAT = 'md';

// Polling budget for the async Document Intelligence job. Lab reports are 1-2
// pages and finish in seconds; this caps us well under the function timeout.
const POLL_INTERVAL_MS = 2500;
// ~60s worst case, kept safely under the edge-function wall-clock limit so a
// slow job hits this controlled timeout rather than being killed by the platform.
const POLL_MAX_ATTEMPTS = 24;

const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParseRequest {
  action: 'parse';
  storage_path?: string; // preferred: object path in the test-reports bucket
  file_data?: string; // legacy/fallback: base64 data URL (small files only)
  filename: string;
  test_type: 'soil' | 'petiole';
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    if (!SARVAM_API_KEY) {
      return jsonResponse(500, { error: 'Sarvam API key not configured on server' });
    }

    let body: ParseRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }

    if (body.action !== 'parse') {
      return jsonResponse(400, { error: 'Invalid action. Use action: "parse"' });
    }

    // Resolve the report bytes from Storage (preferred) or an inline base64
    // data URL (legacy/small-file fallback).
    let bytes: Uint8Array;
    let mimeType: string;

    if (body.storage_path) {
      // Prevent IDOR: a user may only reference files under their own folder.
      if (!body.storage_path.startsWith(`${user.id}/`)) {
        return jsonResponse(403, { error: 'storage_path is outside your folder' });
      }
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return jsonResponse(500, { error: 'Service role key not configured on server' });
      }
      const admin = createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY);
      const { data: blob, error: dlError } = await admin.storage
        .from(STORAGE_BUCKET)
        .download(body.storage_path);
      if (dlError || !blob) {
        return jsonResponse(404, {
          error: 'Could not read the uploaded file',
          details: dlError?.message,
        });
      }
      // Guard memory before buffering the whole object (the RLS bucket does not
      // cap object size, so an oversized upload could exhaust the function).
      if (blob.size > MAX_FILE_SIZE) {
        admin.storage
          .from(STORAGE_BUCKET)
          .remove([body.storage_path])
          .catch(() => {});
        return jsonResponse(400, { error: 'File too large. Maximum 32MB.' });
      }
      bytes = new Uint8Array(await blob.arrayBuffer());
      mimeType = blob.type || mimeFromPath(body.storage_path);
      // We have the bytes in memory; remove the stored file (best-effort).
      admin.storage
        .from(STORAGE_BUCKET)
        .remove([body.storage_path])
        .catch(() => {});
    } else if (body.file_data && body.file_data.startsWith('data:')) {
      if (body.file_data.length > MAX_FILE_SIZE * 1.37) {
        return jsonResponse(400, { error: 'File too large. Maximum 32MB.' });
      }
      const match = body.file_data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return jsonResponse(400, { error: 'Invalid data URL format' });
      }
      mimeType = match[1];
      const binaryString = atob(match[2]);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      return jsonResponse(400, { error: 'Provide storage_path or file_data' });
    }

    // Sarvam Document Intelligence accepts a single PDF or a ZIP of JPEG/PNG
    // images. PDFs upload directly; a captured image is wrapped in a ZIP.
    let uploadName: string;
    let uploadBytes: Uint8Array;
    let uploadContentType: string;

    if (mimeType === 'application/pdf') {
      uploadName = 'report.pdf';
      uploadBytes = bytes;
      uploadContentType = 'application/pdf';
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      uploadBytes = zipSync({ [`page-1.${ext}`]: bytes });
      uploadName = 'report.zip';
      uploadContentType = 'application/zip';
    } else {
      return jsonResponse(400, {
        error: `Unsupported file type "${mimeType}". Upload a PDF, JPEG, or PNG.`,
      });
    }

    // 1. Digitize the report to Markdown via Document Intelligence.
    let markdown: string;
    try {
      markdown = await digitizeDocument(uploadName, uploadBytes, uploadContentType);
    } catch (error) {
      return jsonResponse(502, {
        error: 'Sarvam document digitization failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }

    if (!markdown.trim()) {
      return jsonResponse(422, { error: 'No readable text found in the report' });
    }

    // 2. Extract structured parameters from the Markdown via the chat model.
    try {
      const result = await extractParameters(markdown, body.test_type);
      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(502, {
        error: 'Sarvam extraction failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

function diHeaders(): HeadersInit {
  return {
    'api-subscription-key': SARVAM_API_KEY as string,
    'Content-Type': 'application/json',
  };
}

interface DiResponse {
  job_id?: string;
  job_state?: string;
  error_message?: string;
  upload_urls?: Record<string, { file_url?: string }>;
  download_urls?: Record<string, { file_url: string }>;
}

async function diFetchJson(url: string, init: RequestInit, step: string): Promise<DiResponse> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${step} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

// Runs the full async Document Intelligence job and returns the digitized text.
async function digitizeDocument(
  filename: string,
  fileBytes: Uint8Array,
  contentType: string,
): Promise<string> {
  // 1. Create job
  const created = await diFetchJson(
    DI_BASE,
    {
      method: 'POST',
      headers: diHeaders(),
      body: JSON.stringify({
        job_parameters: { language: OCR_LANGUAGE, output_format: OCR_OUTPUT_FORMAT },
      }),
    },
    'Create job',
  );
  const jobId = created.job_id;
  if (!jobId) throw new Error('Create job returned no job_id');

  // 2. Get presigned upload URL
  const uploadLinks = await diFetchJson(
    `${DI_BASE}/upload-files`,
    {
      method: 'POST',
      headers: diHeaders(),
      body: JSON.stringify({ job_id: jobId, files: [filename] }),
    },
    'Get upload URL',
  );
  const fileUrl: string | undefined = uploadLinks?.upload_urls?.[filename]?.file_url;
  if (!fileUrl) throw new Error('No presigned upload URL returned');

  // 3. Upload the file to Azure blob storage (presigned PUT).
  const putRes = await fetch(fileUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
    body: fileBytes,
  });
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '');
    throw new Error(`File upload failed (${putRes.status}): ${detail}`);
  }

  // 4. Start the job
  await diFetchJson(
    `${DI_BASE}/${jobId}/start`,
    { method: 'POST', headers: diHeaders(), body: '{}' },
    'Start job',
  );

  // 5. Poll until terminal
  let finalState = '';
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const status = await diFetchJson(
      `${DI_BASE}/${jobId}/status`,
      { method: 'GET', headers: diHeaders() },
      'Get status',
    );
    const state = status.job_state;
    if (state === 'Completed' || state === 'PartiallyCompleted') {
      finalState = state;
      break;
    }
    if (state === 'Failed') {
      throw new Error(`Digitization job failed: ${status.error_message || 'unknown error'}`);
    }
  }
  if (!finalState) {
    throw new Error('Digitization job timed out');
  }

  // 6. Get download URLs and fetch the digitized output.
  const downloads = await diFetchJson(
    `${DI_BASE}/${jobId}/download-files`,
    { method: 'POST', headers: diHeaders(), body: '{}' },
    'Get download URLs',
  );
  const urls: Record<string, { file_url: string }> = downloads?.download_urls ?? {};
  const names = Object.keys(urls);

  // Prefer the Markdown output; fall back to a JSON page dump.
  const mdName = names.find((n) => n.toLowerCase().endsWith('.md'));
  const jsonName = names.find((n) => n.toLowerCase().endsWith('.json'));
  const target = mdName ?? jsonName;
  if (!target) throw new Error('No output file produced by digitization');

  const downloadUrl = urls[target]?.file_url;
  if (!downloadUrl) throw new Error('Digitization output is missing a download URL');

  const contentRes = await fetch(downloadUrl);
  if (!contentRes.ok) {
    throw new Error(`Failed to download output (${contentRes.status})`);
  }
  const raw = await contentRes.text();

  if (target === mdName) return raw;

  // JSON fallback: flatten any text blocks into a single string.
  try {
    return flattenJsonText(JSON.parse(raw));
  } catch {
    return raw;
  }
}

// Pulls every string value out of the Document Intelligence JSON page dump so
// the chat model still receives the report text when no Markdown is present.
function flattenJsonText(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') {
      parts.push(n);
    } else if (Array.isArray(n)) {
      n.forEach(walk);
    } else if (n && typeof n === 'object') {
      Object.values(n).forEach(walk);
    }
  };
  walk(node);
  return parts.join('\n');
}

interface StructuredPayload {
  parameters: Array<{ name: string; value: number }>;
  summary: string | null;
  rawNotes: string | null;
  confidence: number | null;
  testDate: string | null;
}

async function extractParameters(
  markdown: string,
  testType: 'soil' | 'petiole',
): Promise<StructuredPayload> {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SARVAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SARVAM_CHAT_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are an agronomy assistant extracting numerical nutrient data from laboratory soil and petiole test reports.',
        },
        {
          role: 'user',
          content: `${getPrompt(testType)}\n\nReport content (digitized from the original document):\n\n${markdown}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'test_report_extraction',
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  // Read the body as text first: a non-JSON upstream error page would make
  // res.json() throw and swallow the real status/body.
  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`Chat completion error (${res.status}): ${rawBody.slice(0, 500)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`Chat completion returned non-JSON response: ${rawBody.slice(0, 500)}`);
  }

  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Chat completion returned no content');

  return parseStructured(content);
}

function parseStructured(content: string): StructuredPayload {
  let text = content.trim();
  // Strip ```json ... ``` fences if the model wrapped its output.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as StructuredPayload;
  } catch {
    throw new Error('Failed to parse structured output as JSON');
  }
}

function getPrompt(testType: 'soil' | 'petiole'): string {
  if (testType === 'soil') {
    return `Extract all nutrient and soil health parameters from the soil test report below.

CRITICAL INSTRUCTIONS:
1. The report contains a TABLE with multiple columns
2. The table has columns like: Sr. No., Parameter, Unit, Actual Result, Limit, Status
3. You MUST read values from the "Actual Result" column - NOT from "Limit" column
4. The "Limit" column contains reference ranges (e.g., "6.5 - 7.5", "75 - 150") - DO NOT use these values
5. The "Actual Result" column contains single numbers - these are the values you need
6. DO NOT guess or fabricate values - only extract what you can clearly read

VALUE RULES:
- Return EXACT numbers from "Actual Result" column
- For % values: 1.47% → 1.47
- For ppm values: 156 ppm → 156, 7754 ppm → 7754
- NEVER use values from Limit column
- If "Actual Result" shows "Nil" or "-", skip that parameter

Parameters to extract from "Actual Result" column:
- ph, ec (electrical conductivity)
- organic_carbon (%), organic_matter (%)
- nitrogen, phosphorus, potassium (all in ppm)
- calcium, magnesium, sulfur (all in ppm)
- calcium_carbonate (%)
- iron, manganese, zinc, copper, boron, molybdenum (all in ppm)
- sodium, chloride, carbonate, bicarbonate (all in ppm)

Also find "Analysis Date" field in the header section (format: DD-Mon-YYYY like "09-Apr-2024") and convert to YYYY-MM-DD.

Respond strictly as JSON with the provided schema.`;
  }

  return `Extract nutrient values from the petiole analysis report below.

CRITICAL INSTRUCTIONS:
1. The report contains a TABLE with multiple columns
2. The table typically has columns: Sr. No., Parameter, Unit, Actual Result, Limit/Range, Status
3. You MUST read values from the "Actual Result" column - NOT from "Limit" or "Range" column
4. The "Limit" column contains reference ranges (e.g., "0.8 - 1.2", "1000 - 2000") - DO NOT use these values
5. The "Actual Result" column contains single numbers - these are the values you need
6. DO NOT guess or fabricate values - only extract what you can clearly read

VALUE RULES:
- Return EXACT numbers from "Actual Result" column
- For % values: 1.36% → 1.36
- For mg/kg or ppm values: 350 mg/kg → 350, 1500 ppm → 1500
- NEVER use values from Limit/Range column
- If "Actual Result" shows "Nil", "-", or "BDL", skip that parameter

Parameters to extract from "Actual Result" column:
- total_nitrogen (%), nitrate_nitrogen (mg/kg or ppm), ammoniacal_nitrogen (mg/kg or ppm)
- phosphorus (%), potassium (%)
- calcium (%), magnesium (%), sulfur (%)
- iron (mg/kg), manganese (mg/kg), zinc (mg/kg), copper (mg/kg), boron (mg/kg), molybdenum (mg/kg)
- sodium (%), chloride (%)

Also find "Analysis Date" field in the header section and convert to YYYY-MM-DD format.

Respond strictly as JSON with the provided schema.`;
}

function buildSchema() {
  return {
    type: 'object',
    properties: {
      parameters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['name', 'value'],
          additionalProperties: false,
        },
      },
      summary: {
        type: ['string', 'null'],
      },
      rawNotes: {
        type: ['string', 'null'],
      },
      confidence: {
        type: ['number', 'null'],
        minimum: 0,
        maximum: 1,
      },
      testDate: {
        type: ['string', 'null'],
      },
    },
    required: ['parameters', 'summary', 'rawNotes', 'confidence', 'testDate'],
    additionalProperties: false,
  };
}
