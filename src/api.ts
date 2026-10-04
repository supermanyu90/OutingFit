import type { OutingResult } from '../server/pipeline.ts';
import type { VoiceCapabilities } from '../server/voice/elevenlabs.ts';
import type { ParseResult } from '../server/gemma/parseRequest.ts';
import type { ResolveResult } from '../server/places/resolve.ts';
import type { Language } from '../server/domain.ts';

export type { OutingResult, VoiceCapabilities, ParseResult, ResolveResult };

export interface AppStatus {
  now: { date: string; time: string; localIso: string };
  timezone: string;
  gemma: {
    primary: { runtime: string; model: string } | null;
    fallback: { runtime: string; model: string; url: string } | null;
    timeoutMs: number;
  };
  weather: { name: string; attribution: string; attributionUrl: string; licence: string; usageLimits: string; resolutionNote: string; cacheTtlSeconds: number };
  voice: VoiceCapabilities;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any).error || `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  status: () => fetch('/api/v2/status').then((r) => json<AppStatus>(r)),
  parse: (text: string) =>
    fetch('/api/v2/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then((r) =>
      json<ParseResult & { destination: ResolveResult | null }>(r)
    ),
  transcribe: (audio: Blob, lang: Language | 'auto') =>
    fetch(`/api/v2/voice/transcribe?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': audio.type || 'audio/webm' }, body: audio }).then(
      (r) => json<{ text: string; languageCode: string | null; languageProbability: number | null; model: string }>(r)
    ),
  speak: async (text: string, language: Language): Promise<Blob> => {
    const res = await fetch('/api/v2/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || `HTTP ${res.status}`);
    return res.blob();
  },
  signedUrl: (lang: Language) => fetch(`/api/v2/voice/signed-url?lang=${lang}`).then((r) => json<{ signedUrl: string }>(r)),
  conversationToken: (lang: Language) => fetch(`/api/v2/voice/token?lang=${lang}`).then((r) => json<{ token: string }>(r)),
};
