/**
 * Gemma runtime client.
 *
 * Primary: Gemma 4 on the Gemini API (`gemma-4-26b-a4b-it` / `gemma-4-31b-it`,
 * listed at https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api — both
 * support system instructions; JSON response mode is not documented for Gemma,
 * so JSON is requested in the prompt and validated here). GEMMA_MODEL takes a
 * comma-separated list tried in order. Measured 2026-10-04: 26B-A4B answered in
 * 11–15 s; 31B took ~25 s for a trivial prompt and returned 503 "high demand".
 * Fallback: a local Gemma served by Ollama (default `gemma3:4b`).
 *
 * Both are real Gemma inference. If neither answers, callers receive a
 * GemmaUnavailableError and must say so — nothing here fakes model output.
 */


export interface GemmaCallResult {
  text: string;
  runtime: 'gemini_api' | 'ollama';
  model: string;
  latencyMs: number;
  attempts: Array<{ runtime: string; model: string; ok: boolean; error?: string; latencyMs: number }>;
}

export class GemmaUnavailableError extends Error {
  constructor(
    message: string,
    public readonly attempts: GemmaCallResult['attempts']
  ) {
    super(message);
  }
}

export interface GemmaRuntimeConfig {
  geminiApiKey?: string;
  geminiModels: string[];
  ollamaUrl?: string;
  ollamaModel: string;
  timeoutMs: number;
  ollamaTimeoutMs: number;
  /**
   * Gemma 4 on the Gemini API "thinks" by default (~700 hidden tokens, ~3x
   * slower, and long prompts can exhaust the output budget with an empty reply).
   * The decision layer already did the reasoning, so 'minimal' is the default.
   * Set GEMMA_THINKING_LEVEL=default to leave the model's setting alone.
   */
  thinkingLevel?: string;
  /** How long to bypass Gemini after a timeout/overload. */
  breakerMs: number;
}

export function gemmaConfigFromEnv(): GemmaRuntimeConfig {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    geminiModels: (process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    ollamaUrl: process.env.OLLAMA_URL === 'off' ? undefined : process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.OLLAMA_GEMMA_MODEL || 'gemma3:4b',
    timeoutMs: Number(process.env.INFERENCE_TIMEOUT_MS || 25000),
    ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 90000),
    breakerMs: Number(process.env.GEMINI_BREAKER_MS || 120000),
    thinkingLevel: process.env.GEMMA_THINKING_LEVEL === 'default' ? undefined : process.env.GEMMA_THINKING_LEVEL || 'minimal',
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Gemini API generateContent over REST with a real AbortController timeout.
 * (The @google/genai SDK call was observed to hang for ~21 minutes on
 * 2026-10-04 while the same REST request returned in ~1 s; a Promise.race
 * timeout only stopped waiting, it did not cancel the request.)
 */
async function geminiGenerate(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ text: string; finishReason?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini API ${model} HTTP ${res.status}: ${json?.error?.message ?? ''}`.trim());
    const cand = json?.candidates?.[0];
    // Gemma 4 returns thought parts flagged `thought: true`; keep only the answer.
    const text = (cand?.content?.parts ?? [])
      .filter((p: any) => !p.thought && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('');
    return { text, finishReason: cand?.finishReason };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Gemini API ${model} timed out after ${timeoutMs} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class GemmaClient {
  private apiKey: string | null;
  /**
   * Circuit breaker: after a Gemini timeout / overload, skip it until this time
   * so each request falls through to the next runtime instead of waiting again.
   * (Observed 2026-10-04: the endpoint alternated between ~13 s answers, 503
   * "high demand", and requests that never returned.)
   */
  private geminiSkipUntil = 0;
  private geminiSkipReason = '';

  constructor(private cfg: GemmaRuntimeConfig) {
    this.apiKey = cfg.geminiApiKey ?? null;
  }

  describe() {
    return {
      primary: this.apiKey ? { runtime: 'gemini_api', model: this.cfg.geminiModels.join(' → ') } : null,
      fallback: this.cfg.ollamaUrl ? { runtime: 'ollama', model: this.cfg.ollamaModel, url: this.cfg.ollamaUrl } : null,
      timeoutMs: this.cfg.timeoutMs,
    };
  }

  async generate(
    system: string,
    user: string,
    opts: { simulateFailure?: boolean; temperature?: number; jsonSchema?: object } = {}
  ): Promise<GemmaCallResult> {
    const attempts: GemmaCallResult['attempts'] = [];
    const temperature = opts.temperature ?? 0.2;

    if (opts.simulateFailure) {
      attempts.push({ runtime: 'all', model: '-', ok: false, error: 'Simulated Gemma outage (test scenario)', latencyMs: 0 });
      throw new GemmaUnavailableError('Simulated Gemma outage (test scenario)', attempts);
    }

    const geminiOpen = Date.now() >= this.geminiSkipUntil;
    if (this.apiKey && !geminiOpen) {
      attempts.push({ runtime: 'gemini_api', model: this.cfg.geminiModels.join(','), ok: false, error: `skipped for ${Math.round((this.geminiSkipUntil - Date.now()) / 1000)} s after: ${this.geminiSkipReason}`, latencyMs: 0 });
    }
    for (const model of this.apiKey && geminiOpen ? this.cfg.geminiModels : []) {
      const t0 = Date.now();
      try {
        const call = (thinking: boolean) =>
          geminiGenerate(
            this.apiKey!,
            model,
            {
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: user }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: 8192,
                ...(thinking && this.cfg.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.cfg.thinkingLevel } } : {}),
              },
            },
            this.cfg.timeoutMs
          );
        const res = await call(true).catch((err) => {
          // Some models reject thinking settings; retry once without them.
          if (/thinking/i.test(String(err?.message)) && !/timed out/.test(String(err?.message))) return call(false);
          throw err;
        });
        const text = res.text ?? '';
        if (!text.trim()) throw new Error(`Empty response (finishReason ${res.finishReason ?? 'unknown'})`);
        const latencyMs = Date.now() - t0;
        attempts.push({ runtime: 'gemini_api', model, ok: true, latencyMs });
        return { text, runtime: 'gemini_api', model, latencyMs, attempts };
      } catch (err: any) {
        const msg = String(err?.message || err);
        attempts.push({ runtime: 'gemini_api', model, ok: false, error: msg.slice(0, 300), latencyMs: Date.now() - t0 });
        if (/timed out|503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED/i.test(msg)) {
          this.geminiSkipUntil = Date.now() + this.cfg.breakerMs;
          this.geminiSkipReason = msg.slice(0, 120);
          break;
        }
      }
    }

    if (this.cfg.ollamaUrl) {
      const t0 = Date.now();
      try {
        const res = await withTimeout(
          fetch(`${this.cfg.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: this.cfg.ollamaModel,
              stream: false,
              // Ollama accepts a JSON schema to constrain decoding (structured outputs).
              format: opts.jsonSchema ?? 'json',
              options: { temperature },
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
            }),
          }),
          this.cfg.ollamaTimeoutMs,
          `Ollama ${this.cfg.ollamaModel}`
        );
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const json: any = await res.json();
        const text = json?.message?.content ?? '';
        if (!text.trim()) throw new Error('Empty response');
        const latencyMs = Date.now() - t0;
        attempts.push({ runtime: 'ollama', model: this.cfg.ollamaModel, ok: true, latencyMs });
        return { text, runtime: 'ollama', model: this.cfg.ollamaModel, latencyMs, attempts };
      } catch (err: any) {
        attempts.push({ runtime: 'ollama', model: this.cfg.ollamaModel, ok: false, error: String(err?.message || err).slice(0, 300), latencyMs: Date.now() - t0 });
      }
    }

    if (attempts.length === 0) {
      throw new GemmaUnavailableError('No Gemma runtime configured (set GEMINI_API_KEY or run Ollama)', attempts);
    }
    throw new GemmaUnavailableError('All Gemma runtimes failed', attempts);
  }
}

/** Extract the first JSON object from model text (handles ```json fences and leading prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(body.slice(start, end + 1));
}
