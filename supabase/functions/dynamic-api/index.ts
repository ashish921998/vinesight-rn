import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { zipSync } from 'https://esm.sh/fflate@0.8.2';
import { corsOptionsResponse, jsonResponse } from '../_shared/http.ts';
import { decodeBase64ToBytes, estimateBase64Bytes } from '../_shared/encoding.ts';

// All-Sarvam lab-report parser.
//
// Input: the client (src/utils/pdf-parser.ts) uploads the report to the
// private `test-reports` bucket and sends { storage_path }. We read the file
// by path with the service role (a base64 file in the body would exceed the
// edge-function body limit and hang). `file_data` is a back-compat shim for
// app builds that predate the Storage-upload flow (see resolveReportBytes).
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
// pages and finish in seconds. We bound the poll by a wall-clock deadline (not a
// fixed attempt count) so per-request status/JSON latency is counted too, and we
// return a controlled timeout before the platform kills the request.
const POLL_INTERVAL_MS = 2500;
const POLL_BUDGET_MS = 45_000; // stays safely under the edge-function wall clock

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, matches the test-reports bucket file_size_limit

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
    return corsOptionsResponse();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
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
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!SARVAM_API_KEY) {
      return jsonResponse({ error: 'Sarvam API key not configured on server' }, 500);
    }

    let body: ParseRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (body.action !== 'parse') {
      return jsonResponse({ error: 'Invalid action. Use action: "parse"' }, 400);
    }

    if (body.test_type !== 'soil' && body.test_type !== 'petiole') {
      return jsonResponse({ error: 'Invalid test_type. Use "soil" or "petiole".' }, 400);
    }

    const resolved = await resolveReportBytes(body, user.id, supabaseUrl);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { bytes, mimeType } = resolved;

    // Sarvam Document Intelligence accepts a single PDF or a ZIP of JPEG/PNG
    // images. PDFs upload directly; a captured image is wrapped in a ZIP.
    //
    // Anything else is rejected by design. Current clients convert camera
    // formats (WebP/GIF/HEIC) to JPEG on-device before upload; legacy file_data
    // clients sending image/webp or image/gif have always failed here — Sarvam
    // cannot ingest those formats, and transcoding server-side would require a
    // WASM image codec just to serve pre-Storage-flow app builds.
    let uploadName: string;
    let uploadBytes: Uint8Array;
    let uploadContentType: string;

    if (mimeType === 'application/pdf') {
      uploadName = 'report.pdf';
      uploadBytes = bytes;
      uploadContentType = 'application/pdf';
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      // level: 0 (store) — the payload is already-compressed JPEG/PNG, so
      // deflating it burns edge-isolate CPU for ~0% gain. The ZIP is only the
      // container Sarvam requires.
      uploadBytes = zipSync({ [`page-1.${ext}`]: [bytes, { level: 0 }] });
      uploadName = 'report.zip';
      uploadContentType = 'application/zip';
    } else {
      return jsonResponse(
        { error: `Unsupported file type "${mimeType}". Upload a PDF, JPEG, or PNG.` },
        400,
      );
    }

    // 1. Digitize the report to Markdown via Document Intelligence.
    let markdown: string;
    try {
      markdown = await digitizeDocument(uploadName, uploadBytes, uploadContentType);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Sarvam document digitization failed',
          details: error instanceof Error ? error.message : String(error),
        },
        502,
      );
    }

    if (!markdown.trim()) {
      return jsonResponse({ error: 'No readable text found in the report' }, 422);
    }

    // 2. Extract structured parameters from the Markdown via the chat model.
    try {
      const result = await extractParameters(markdown, body.test_type);
      return jsonResponse({ ...result });
    } catch (error) {
      return jsonResponse(
        {
          error: 'Sarvam extraction failed',
          details: error instanceof Error ? error.message : String(error),
        },
        502,
      );
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});

// Resolves a parse request into the report bytes + MIME type, or a ready error
// Response when the request can't be served.
//
// Cleanup contract: once this function downloads the object from Storage it
// also deletes it — the bytes live in memory from here on. The client
// (src/utils/pdf-parser.ts) only removes the object when the invoke fails
// before reaching this point (network error, auth failure, validation 400).
async function resolveReportBytes(
  body: ParseRequest,
  userId: string,
  supabaseUrl: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | Response> {
  if (body.storage_path) {
    // Prevent IDOR: a user may only reference files under their own folder.
    // The service-role client below bypasses RLS, so this string check is the
    // only authorization gate — validate by exact path segments (not a prefix
    // startsWith, which `${userId}/../<other>/f` would satisfy) and reject any
    // traversal or empty segment.
    const segments = body.storage_path.split('/');
    const pathIsOwned =
      segments.length >= 2 &&
      segments[0] === userId &&
      segments.every((s) => s.length > 0 && s !== '.' && s !== '..');
    if (!pathIsOwned) {
      return jsonResponse({ error: 'storage_path is outside your folder' }, 403);
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Service role key not configured on server' }, 500);
    }
    const admin = createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY);
    // Best-effort removal of the stored object (RLS-bypassing service role).
    // The Storage client resolves with { error } on API failures (rate limits,
    // transient 5xx) rather than rejecting, so a bare .catch(() => {}) would
    // swallow them and leak orphans silently. Inspect the resolved error and
    // log it so the leak stays observable in the function logs. Never throws —
    // cleanup failure must not mask the real error returned to the client.
    const removeUploaded = async () => {
      try {
        const { error } = await admin.storage
          .from(STORAGE_BUCKET)
          .remove([body.storage_path as string]);
        if (error) {
          console.error('Storage cleanup failed:', error.message);
        }
      } catch (error) {
        console.error('Storage cleanup threw:', error);
      }
    };

    // Verify the object size from metadata BEFORE downloading, so an oversized
    // blob is never buffered into function memory. The bucket's file_size_limit
    // blocks client uploads over the cap, but a service-role writer (or a bucket
    // whose limit predates this migration) could still leave a larger object
    // behind. Fail closed: if the size can't be verified, don't download — the
    // object was just uploaded through this same Storage API, so unverifiable
    // metadata means the download is broken too, and the client re-uploads on
    // retry anyway.
    const { data: objectInfo, error: infoError } = await admin.storage
      .from(STORAGE_BUCKET)
      .info(body.storage_path);
    const objectSize = typeof objectInfo?.size === 'number' ? objectInfo.size : null;
    if (infoError || objectSize === null) {
      await removeUploaded();
      return jsonResponse(
        { error: 'Could not verify the uploaded file', details: infoError?.message },
        404,
      );
    }
    if (objectSize > MAX_FILE_SIZE) {
      await removeUploaded();
      return jsonResponse({ error: 'File too large. Maximum 10MB.' }, 400);
    }

    const { data: blob, error: dlError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(body.storage_path);
    if (dlError || !blob) {
      // Same cleanup contract as the sibling error branches: don't leave the
      // object orphaned just because the download leg failed.
      await removeUploaded();
      return jsonResponse(
        { error: 'Could not read the uploaded file', details: dlError?.message },
        404,
      );
    }
    // Backstop: guards drift between the metadata just verified and what
    // download() actually returned (e.g. the object changed in between). Awaited
    // cleanup — the runtime cancels pending promises once the response is sent.
    if (blob.size > MAX_FILE_SIZE) {
      await removeUploaded();
      return jsonResponse({ error: 'File too large. Maximum 10MB.' }, 400);
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Fall back to the path extension when Storage reports no type or a
    // generic octet-stream (which the handler's format gate would reject).
    const mimeType =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : mimeFromPath(body.storage_path);
    // Bytes are in memory; remove the stored file (awaited, best-effort).
    await removeUploaded();
    return { bytes, mimeType };
  }

  // Back-compat shim: app builds released before the Storage-upload flow
  // (<= v1.4.x) send the file inline as a base64 data URL. Remove this branch
  // once those builds no longer call the function.
  if (body.file_data && body.file_data.startsWith('data:')) {
    const match = body.file_data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return jsonResponse({ error: 'Invalid data URL format' }, 400);
    }
    if (estimateBase64Bytes(match[2]) > MAX_FILE_SIZE) {
      return jsonResponse({ error: 'File too large. Maximum 10MB.' }, 400);
    }
    return { bytes: decodeBase64ToBytes(match[2]), mimeType: match[1] };
  }

  return jsonResponse({ error: 'Provide storage_path or file_data' }, 400);
}

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

// Per-request cap on every Sarvam call. Without an abort signal a stalled
// upstream response hangs past the poll deadline (which is only re-checked
// between requests) until the platform kills the function; with it, a stall
// surfaces as a controlled 502 instead.
const DI_REQUEST_TIMEOUT_MS = 15_000;
// The presigned PUT ships the whole report (up to 10MB), so it gets more room.
const DI_UPLOAD_TIMEOUT_MS = 60_000;

async function diFetchJson(
  url: string,
  init: RequestInit,
  step: string,
  timeoutMs = DI_REQUEST_TIMEOUT_MS,
): Promise<DiResponse> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(`${step} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
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
    signal: AbortSignal.timeout(DI_UPLOAD_TIMEOUT_MS),
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

  // 5. Poll until terminal, bounded by an absolute wall-clock deadline so that
  // per-request latency counts against the budget (not just the sleeps).
  let finalState = '';
  const deadline = Date.now() + POLL_BUDGET_MS;
  while (Date.now() < deadline) {
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

  const contentRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(DI_UPLOAD_TIMEOUT_MS),
  });
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
    // Same deadline discipline as the OCR requests: the structured-extraction
    // call must not run unbounded if Sarvam stalls, or the edge function hits
    // the platform wall clock and returns an opaque failure.
    signal: AbortSignal.timeout(DI_UPLOAD_TIMEOUT_MS),
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
