/**
 * OutingFit HTTP API (mounted at /api/v2).
 */

import express, { Request, Response, Router } from 'express';
import { createHash } from 'crypto';
import { OutingRequestSchema, LANGUAGES, Language } from './domain.ts';
import { runOutingPipeline, OutingResult } from './pipeline.ts';
import { GemmaClient } from './gemma/gemmaClient.ts';
import { parseOutingText } from './gemma/parseRequest.ts';
import { resolveDestination } from './places/resolve.ts';
import { PROVIDER_INFO, CACHE_TTL_SECONDS } from './weather/openMeteo.ts';
import { loadDecisionConfig } from './decision/config.ts';
import { nowInMumbai } from './lib/time.ts';
import { agentSignedUrl, capabilities, conversationToken, ElevenLabsError, synthesize, transcribe, VoiceEnv } from './voice/elevenlabs.ts';

export interface ApiDeps {
  gemma: GemmaClient;
  voice: VoiceEnv;
  weatherTimeoutMs: number;
}

/**
 * Spoken output must come from a backend result. /voice/speak only voices text
 * that a recent pipeline run produced as its validated spoken summary.
 */
const recentSpoken = new Map<string, number>();
function rememberSpoken(text: string) {
  recentSpoken.set(hash(text), Date.now());
  if (recentSpoken.size > 500) recentSpoken.delete(recentSpoken.keys().next().value!);
}
function hash(text: string) {
  return createHash('sha256').update(text.normalize('NFC').trim()).digest('hex');
}

function sendError(res: Response, err: any, fallbackStatus = 500) {
  const status = err instanceof ElevenLabsError && err.status ? (err.status >= 500 ? 502 : err.status) : fallbackStatus;
  res.status(status).json({ error: err?.message || String(err) });
}

export function createApi(deps: ApiDeps): Router {
  const r = express.Router();

  r.get('/status', async (_req: Request, res: Response) => {
    const voice = await capabilities(deps.voice);
    res.json({
      now: nowInMumbai(),
      timezone: 'Asia/Kolkata',
      gemma: deps.gemma.describe(),
      weather: { ...PROVIDER_INFO, cacheTtlSeconds: CACHE_TTL_SECONDS },
      voice,
      decisionConfig: loadDecisionConfig(),
    });
  });

  r.get('/destinations/resolve', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.trim().length < 2) {
      res.status(400).json({ error: 'q must be at least 2 characters' });
      return;
    }
    try {
      res.json(await resolveDestination(q, deps.weatherTimeoutMs));
    } catch (err) {
      sendError(res, err);
    }
  });

  r.post('/parse', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const parsed = await parseOutingText(deps.gemma, text);
    let destination = null;
    const name = parsed.parsed?.destinationLatin || parsed.parsed?.destinationText;
    if (name) {
      try {
        destination = await resolveDestination(name, deps.weatherTimeoutMs);
      } catch (err: any) {
        destination = { query: name, status: 'not_found', candidates: [], message: err.message };
      }
    }
    res.json({ ...parsed, destination });
  });

  r.post('/outing', async (req: Request, res: Response) => {
    const parsed = OutingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid outing request', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      return;
    }
    try {
      const result: OutingResult = await runOutingPipeline(parsed.data, { gemma: deps.gemma, weatherTimeoutMs: deps.weatherTimeoutMs });
      if (result.spoken.text) rememberSpoken(result.spoken.text);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  r.post('/voice/transcribe', express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '15mb' }), async (req: Request, res: Response) => {
    const lang = String(req.query.lang || 'auto') as Language | 'auto';
    if (lang !== 'auto' && !LANGUAGES.includes(lang as Language)) {
      res.status(400).json({ error: 'lang must be en, hi, mr or auto' });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
      res.status(400).json({ error: 'Audio body missing or too short' });
      return;
    }
    try {
      res.json(await transcribe(deps.voice, req.body, String(req.headers['content-type'] || 'audio/webm'), lang));
    } catch (err) {
      sendError(res, err);
    }
  });

  r.post('/voice/speak', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const language = req.body?.language as Language;
    if (!text || !LANGUAGES.includes(language)) {
      res.status(400).json({ error: 'text and language (en|hi|mr) are required' });
      return;
    }
    if (!recentSpoken.has(hash(text))) {
      res.status(403).json({ error: 'Only spoken summaries produced by a recent OutingFit recommendation can be voiced.' });
      return;
    }
    try {
      const out = await synthesize(deps.voice, text, language);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-OutingFit-TTS-Model', out.model);
      res.send(Buffer.from(out.audio));
    } catch (err) {
      sendError(res, err);
    }
  });

  const langParam = (req: Request): Language => (LANGUAGES.includes(req.query.lang as Language) ? (req.query.lang as Language) : 'en');

  r.get('/voice/token', async (req: Request, res: Response) => {
    try {
      res.json({ token: await conversationToken(deps.voice, langParam(req)) });
    } catch (err) {
      sendError(res, err);
    }
  });

  r.get('/voice/signed-url', async (req: Request, res: Response) => {
    try {
      res.json({ signedUrl: await agentSignedUrl(deps.voice, langParam(req)) });
    } catch (err) {
      sendError(res, err);
    }
  });

  return r;
}
