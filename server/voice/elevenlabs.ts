/**
 * ElevenLabs server-side integration. The API key never leaves the server:
 * the browser receives only short-lived conversation tokens, transcripts and
 * synthesized audio.
 *
 * Documented support (checked 2026-10-04, elevenlabs.io/docs):
 * - Scribe v2 speech-to-text: Hindi (hin) and Marathi (mar) listed, both in
 *   the ">5% to ≤10% WER" band. Code-switching is not documented.
 * - TTS: Hindi in eleven_multilingual_v2, flash_v2_5, v3, v4; Marathi only in
 *   eleven_v3 / eleven_v4 / eleven_v4_turbo (not multilingual_v2 / flash_v2_5).
 * - Agents: "All the languages supported by our v3 Conversational and Flash
 *   v2.5 models". Language is fixed per call. `hinglish_mode` exists for Hindi.
 *   Agent LLMs are a fixed list (no Gemma) or a custom OpenAI-compatible LLM.
 * Runtime truth comes from GET /v1/models (per-model language lists), which
 * capabilities() queries so the UI never claims more than the account offers.
 */

import { Language } from '../domain.ts';

const API = 'https://api.elevenlabs.io';

export interface VoiceEnv {
  apiKey?: string;
  agentId?: string;
  /** Marathi needs its own agent: the agents API rejects "mr" as a language preset. */
  agentIdMr?: string;
  voiceId?: string;
  voiceIds: Partial<Record<Language, string>>;
  ttsModel?: string;
  sttModel: string;
}

export function voiceEnvFromProcess(): VoiceEnv {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY || undefined,
    agentId: process.env.ELEVENLABS_AGENT_ID || undefined,
    agentIdMr: process.env.ELEVENLABS_AGENT_ID_MR || undefined,
    voiceId: process.env.ELEVENLABS_VOICE_ID || undefined,
    voiceIds: {
      en: process.env.ELEVENLABS_VOICE_ID_EN || undefined,
      hi: process.env.ELEVENLABS_VOICE_ID_HI || undefined,
      mr: process.env.ELEVENLABS_VOICE_ID_MR || undefined,
    },
    ttsModel: process.env.ELEVENLABS_TTS_MODEL || undefined,
    sttModel: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2',
  };
}

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
  }
}

async function el(path: string, env: VoiceEnv, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  if (!env.apiKey) throw new ElevenLabsError('ELEVENLABS_API_KEY is not configured', 503);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'xi-api-key': env.apiKey, ...(init.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ElevenLabsError(`ElevenLabs ${path.split('?')[0]} HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
    }
    return res;
  } catch (err: any) {
    if (err instanceof ElevenLabsError) throw err;
    throw new ElevenLabsError(err?.name === 'AbortError' ? `ElevenLabs ${path} timed out` : `ElevenLabs request failed: ${err?.message}`);
  } finally {
    clearTimeout(t);
  }
}

// ----------------------------------------------------------- capabilities

const TTS_PREFERENCE = ['eleven_v3', 'eleven_v4', 'eleven_multilingual_v2', 'eleven_flash_v2_5'];

/**
 * Documented TTS language support (elevenlabs.io/docs/overview/models, checked
 * 2026-10-04). Used only when the API key lacks the models_read permission, and
 * labelled as such.
 */
export const DOCUMENTED_TTS_MODELS: Record<Language, string[]> = {
  en: ['eleven_v3', 'eleven_v4', 'eleven_multilingual_v2', 'eleven_flash_v2_5'],
  hi: ['eleven_v3', 'eleven_v4', 'eleven_multilingual_v2', 'eleven_flash_v2_5'],
  mr: ['eleven_v3', 'eleven_v4'],
};

export interface LanguageCapability {
  stt: { supported: boolean; model: string; note: string };
  tts: { supported: boolean; model: string | null; note: string };
  agent: { supported: boolean | null; ttsModel: string | null; note: string };
}

export interface VoiceCapabilities {
  configured: boolean;
  agentConfigured: boolean;
  checkedAt: string | null;
  error?: string;
  languages: Record<Language, LanguageCapability>;
  ttsModelsByLanguage: Partial<Record<Language, string[]>>;
}

let capCache: { at: number; value: VoiceCapabilities } | null = null;

/** Agent support per language as verified by scripts/setup-elevenlabs-agent.ts (stored in env). */
function agentSupport(lang: Language): boolean | null {
  const v = process.env[`ELEVENLABS_AGENT_LANG_${lang.toUpperCase()}`];
  return v === 'ok' ? true : v === 'unsupported' ? false : null;
}

export async function capabilities(env: VoiceEnv): Promise<VoiceCapabilities> {
  if (capCache && Date.now() - capCache.at < 10 * 60_000) return capCache.value;
  const langs: Language[] = ['en', 'hi', 'mr'];
  const base = (): VoiceCapabilities => ({
    configured: !!env.apiKey,
    agentConfigured: !!(env.apiKey && env.agentId),
    checkedAt: null,
    languages: Object.fromEntries(
      langs.map((l) => [
        l,
        {
          stt: { supported: false, model: env.sttModel, note: 'ElevenLabs not configured' },
          tts: { supported: false, model: null, note: 'ElevenLabs not configured' },
          agent: { supported: null, ttsModel: null, note: 'ElevenLabs agent not configured' },
        },
      ])
    ) as Record<Language, LanguageCapability>,
    ttsModelsByLanguage: {},
  });
  const caps = base();
  if (!env.apiKey) return caps;

  try {
    let source = 'GET /v1/models';
    let modelsByLang: Record<Language, string[]>;
    try {
      const res = await el('/v1/models', env, {}, 10000);
      const models: Array<{ model_id: string; can_do_text_to_speech?: boolean; languages?: Array<{ language_id: string }> }> = await res.json();
      modelsByLang = Object.fromEntries(
        langs.map((l) => [l, models.filter((m) => m.can_do_text_to_speech && m.languages?.some((x) => x.language_id === l)).map((m) => m.model_id)])
      ) as Record<Language, string[]>;
    } catch (err) {
      if (!(err instanceof ElevenLabsError && err.status === 401 && /models_read/.test(err.message))) throw err;
      source = 'ElevenLabs docs (API key lacks models_read; not verified against the account)';
      modelsByLang = DOCUMENTED_TTS_MODELS;
    }
    for (const l of langs) {
      const supporting = modelsByLang[l];
      caps.ttsModelsByLanguage[l] = supporting;
      const chosen =
        env.ttsModel && supporting.includes(env.ttsModel)
          ? env.ttsModel
          : TTS_PREFERENCE.find((m) => supporting.includes(m)) ?? supporting[0] ?? null;
      caps.languages[l].tts = chosen
        ? { supported: true, model: chosen, note: `Speech synthesis via ${chosen} (support per ${source})` }
        : { supported: false, model: null, note: `No TTS model lists this language (per ${source})` };
      // Scribe v2 language list (docs): eng, hin, mar all supported.
      caps.languages[l].stt = { supported: true, model: env.sttModel, note: l === 'en' ? 'Scribe v2' : 'Scribe v2 (documented WER band >5%–≤10%)' };
      const a = agentSupport(l);
      caps.languages[l].agent = !agentIdFor(env, l)
        ? { supported: null, ttsModel: null, note: 'Agent not created yet (run npm run setup:agent)' }
        : a === true
          ? { supported: true, ttsModel: process.env[`ELEVENLABS_AGENT_TTS_${l.toUpperCase()}`] || null, note: 'Verified by a live agent session during setup' }
          : a === false
            ? { supported: false, ttsModel: null, note: process.env[`ELEVENLABS_AGENT_NOTE_${l.toUpperCase()}`] || 'Agent rejected this language during setup' }
            : { supported: null, ttsModel: null, note: 'Not verified — re-run agent setup' };
    }
    caps.checkedAt = new Date().toISOString();
  } catch (err: any) {
    caps.error = err.message;
  }
  capCache = { at: Date.now(), value: caps };
  return caps;
}

export function agentIdFor(env: VoiceEnv, language: Language): string | undefined {
  return language === 'mr' ? env.agentIdMr : env.agentId;
}

export function resetCapabilityCache(): void {
  capCache = null;
}

// ------------------------------------------------------------ operations

const ISO3: Record<Language, string> = { en: 'eng', hi: 'hin', mr: 'mar' };

export interface TranscriptResult {
  text: string;
  languageCode: string | null;
  languageProbability: number | null;
  model: string;
}

export async function transcribe(env: VoiceEnv, audio: Buffer, mime: string, language?: Language | 'auto'): Promise<TranscriptResult> {
  const form = new FormData();
  form.append('model_id', env.sttModel);
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }), 'speech');
  form.append('tag_audio_events', 'false');
  if (language && language !== 'auto') form.append('language_code', ISO3[language]);
  const res = await el('/v1/speech-to-text', env, { method: 'POST', body: form }, 60000);
  const json: any = await res.json();
  return {
    text: String(json.text ?? '').trim(),
    languageCode: json.language_code ?? null,
    languageProbability: typeof json.language_probability === 'number' ? json.language_probability : null,
    model: env.sttModel,
  };
}

export async function synthesize(env: VoiceEnv, text: string, language: Language): Promise<{ audio: ArrayBuffer; model: string; voiceId: string }> {
  const caps = await capabilities(env);
  const model = caps.languages[language].tts.model;
  if (!model) throw new ElevenLabsError(`No ElevenLabs TTS model supports ${language} on this account`, 422);
  const voiceId = env.voiceIds[language] || env.voiceId;
  if (!voiceId) throw new ElevenLabsError('ELEVENLABS_VOICE_ID is not configured (run npm run setup:agent)', 503);
  const body: Record<string, unknown> = { text, model_id: model };
  if (model !== 'eleven_multilingual_v2') body.language_code = language;
  const res = await el(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, env, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { audio: await res.arrayBuffer(), model, voiceId };
}

/** Short-lived WebRTC conversation token for the agent (no API key in the browser). */
export async function conversationToken(env: VoiceEnv, language: Language): Promise<string> {
  const agentId = agentIdFor(env, language);
  if (!agentId) throw new ElevenLabsError(`No ElevenLabs agent is configured for ${language} (run npm run setup:agent)`, 503);
  const res = await el(`/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, env, {}, 10000);
  const json: any = await res.json();
  if (!json.token) throw new ElevenLabsError('ElevenLabs returned no conversation token');
  return json.token;
}

/** Short-lived signed WebSocket URL (used for text-only agent sessions). */
export async function agentSignedUrl(env: VoiceEnv, language: Language): Promise<string> {
  const agentId = agentIdFor(env, language);
  if (!agentId) throw new ElevenLabsError(`No ElevenLabs agent is configured for ${language} (run npm run setup:agent)`, 503);
  const res = await el(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, env, {}, 10000);
  const json: any = await res.json();
  if (!json.signed_url) throw new ElevenLabsError('ElevenLabs returned no signed URL');
  return json.signed_url;
}
