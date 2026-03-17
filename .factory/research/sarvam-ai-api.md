# Sarvam AI API Research

## APIs Available

| API | Endpoint | Description |
|-----|----------|-------------|
| Speech to Text (STT) | `/speech-to-text` | Transcribe audio in 23 languages |
| Text to Speech (TTS) | `/text-to-speech` | Convert text to speech, 11 languages |
| Translate | `/translate` | Text translation between 23 languages |
| Language ID | `/detect-language` | Detect language from text |

## Models

| Model | Purpose | Notes |
|-------|---------|-------|
| Saaras v3 | STT (latest) | 23 languages, auto-detect, code-mixing |
| Bulbul v3 | TTS (latest) | 11 languages, 39 voices, max 2500 chars |

## Authentication
- Header: `api-subscription-key: YOUR_API_KEY`
- Base URL: `https://api.sarvam.ai`

## STT API
- Endpoint: `POST /speech-to-text`
- Content-Type: multipart/form-data
- Fields: `file` (audio), `model` (saaras:v3), `language_code` (e.g., hi-IN, mr-IN, en-IN, or "unknown" for auto-detect)
- Supported formats: WAV, MP3, AAC, OGG, OPUS, FLAC, M4A, AMR, WMA, WebM, PCM (16kHz)
- Response: `{ request_id, transcript, language_code }`

## TTS API
- Endpoint: `POST /text-to-speech`
- Content-Type: application/json
- Body: `{ text, target_language_code, speaker, model, pace, temperature }`
- Bulbul v3: max 2500 chars, 39 speakers, pace 0.5-2.0
- Output codecs: mp3, wav, opus, flac, aac
- Response: `{ request_id, audios: [base64_string] }`

## Speakers (Bulbul v3)
- 39 voices (23 male, 16 female)
- Key speakers: `shubh` (default), `priya`, etc.
- Locale-specific selection recommended

## Pricing
- STT: ₹30/hour
- TTS Bulbul v3: ₹30/10K chars
- Rate limit: 60 req/min (Starter plan)

## Key Differences from Old Implementation
- Old: Saarika v2.5 (11 languages) → New: Saaras v3 (23 languages, auto-detect)
- Saaras v3 supports `language_code: "unknown"` for auto-detection
- Saaras v3 handles code-mixed speech natively (Hinglish, Marathi-English)
- M4A format is NOW supported by Saaras v3 (was not by Saarika v2.5)
