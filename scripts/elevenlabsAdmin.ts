/**
 * ElevenLabs admin helpers for setup and the voice test harness (Node only).
 */

import fs from 'fs';
import path from 'path';

export const EL_API = 'https://api.elevenlabs.io';

export async function el<T = any>(pathname: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set (add it to .env)');
  const res = await fetch(`${EL_API}${pathname}`, {
    ...init,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${pathname} → HTTP ${res.status}: ${text.slice(0, 600)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Set or replace KEY=value lines in .env without touching other lines. */
export function upsertEnv(vars: Record<string, string>, file = path.resolve('.env')) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`;
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = line;
    else lines.push(line);
    process.env[k] = v;
  }
  lines = lines.filter((l, i, a) => !(l === '' && i === a.length - 1));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

export async function signedUrl(agentId: string): Promise<string> {
  const r = await el<{ signed_url: string }>(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`);
  return r.signed_url;
}

/** TTS to raw 16 kHz mono PCM (the agent's documented user_input_audio_format). */
export async function ttsPcm16k(text: string, voiceId: string, modelId: string, languageCode?: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY!;
  const body: Record<string, unknown> = { text, model_id: modelId };
  if (languageCode && modelId !== 'eleven_multilingual_v2') body.language_code = languageCode;
  const res = await fetch(`${EL_API}/v1/text-to-speech/${voiceId}?output_format=pcm_16000`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Wrap 16-bit mono PCM in a WAV header (for sending to Scribe batch STT). */
export function pcmToWav(pcm: Buffer, sampleRate = 16000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export interface AgentEvent {
  t: number;
  type: string;
  text?: string;
  tool?: string;
  params?: unknown;
  result?: string;
}

export interface AgentRunOptions {
  signedUrl: string;
  language: 'en' | 'hi' | 'mr';
  dynamicVariables: Record<string, string>;
  textOnly?: boolean;
  /** Each turn is either PCM audio (spoken by the "user") or a text message. */
  turns: Array<{ audio?: Buffer; text?: string }>;
  tools: Record<string, (p: any) => Promise<string> | string>;
  /** Stop after this predicate is satisfied (checked after each agent response). */
  doneWhen?: (events: AgentEvent[]) => boolean;
  timeoutMs?: number;
  log?: (e: AgentEvent) => void;
}

/**
 * Drive a real ElevenLabs agent conversation over the documented WebSocket
 * protocol: send user audio (or text), execute client tool calls locally, and
 * record transcripts, agent responses and tool traffic.
 */
export function runAgentConversation(opts: AgentRunOptions): Promise<{ events: AgentEvent[]; audioBytes: number; metadata: any }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(opts.signedUrl);
    const events: AgentEvent[] = [];
    const t0 = Date.now();
    let audioBytes = 0;
    /** A real user waits while a tool runs; don't speak over a pending call. */
    let toolsInFlight = 0;
    /** When the agent's audio would finish playing on a real client (audio arrives faster than real time). */
    let playbackEndsAt = 0;
    let bytesPerSecond = 32000; // pcm_16000 s16le mono; updated from metadata
    let metadata: any = null;
    let turnIdx = 0;
    let sending = false;
    let finished = false;
    const push = (e: Omit<AgentEvent, 't'>) => {
      const ev = { t: Date.now() - t0, ...e };
      events.push(ev);
      opts.log?.(ev);
    };
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      err ? reject(Object.assign(err, { events })) : resolve({ events, audioBytes, metadata });
    };
    const timer = setTimeout(() => finish(), opts.timeoutMs ?? 120000);

    const sendNextTurn = async () => {
      if (sending || turnIdx >= opts.turns.length) return;
      sending = true;
      const turn = opts.turns[turnIdx++];
      if (turn.text) {
        ws.send(JSON.stringify({ type: 'user_message', text: turn.text }));
        push({ type: 'user_text_sent', text: turn.text });
      } else if (turn.audio) {
        push({ type: 'user_audio_sent', text: `${(turn.audio.length / 32000).toFixed(1)}s of audio` });
        const chunk = 3200; // 100 ms at 16 kHz s16le
        const silence = Buffer.alloc(chunk);
        // Lead-in silence: synthesized speech starts at sample 0, and the agent's voice
        // activity detection otherwise clips the first word.
        const padded = Buffer.concat([...Array(6).fill(silence), turn.audio, ...Array(15).fill(silence)]);
        for (let i = 0; i < padded.length && !finished; i += chunk) {
          ws.send(JSON.stringify({ user_audio_chunk: padded.subarray(i, i + chunk).toString('base64') }));
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      sending = false;
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'conversation_initiation_client_data',
          conversation_config_override: {
            agent: { language: opts.language },
            ...(opts.textOnly ? { conversation: { text_only: true } } : {}),
          },
          dynamic_variables: opts.dynamicVariables,
        })
      );
    };
    ws.onerror = (e: any) => finish(new Error(`WebSocket error: ${e?.message || 'unknown'}`));
    ws.onclose = (e: any) => {
      push({ type: 'closed', text: `${e.code} ${e.reason || ''}`.trim() });
      finish();
    };
    ws.onmessage = async (msg: any) => {
      const data = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());
      switch (data.type) {
        case 'conversation_initiation_metadata':
          metadata = data.conversation_initiation_metadata_event;
          {
            const m = String(metadata?.agent_output_audio_format || '').match(/pcm_(\d+)/);
            if (m) bytesPerSecond = Number(m[1]) * 2;
          }
          // Never log session tokens into test output that may be committed.
          push({ type: 'metadata', text: JSON.stringify({ ...metadata, persistent_session_token: metadata?.persistent_session_token ? '[redacted]' : null }) });
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', event_id: data.ping_event.event_id }));
          break;
        case 'audio':
          {
            const bytes = data.audio_event?.audio_base_64 ? Math.floor((data.audio_event.audio_base_64.length * 3) / 4) : 0;
            audioBytes += bytes;
            playbackEndsAt = Math.max(playbackEndsAt, Date.now()) + (bytes / bytesPerSecond) * 1000;
          }
          break;
        case 'user_transcript':
          push({ type: 'user_transcript', text: data.user_transcription_event?.user_transcript });
          break;
        case 'agent_response':
          push({ type: 'agent_response', text: data.agent_response_event?.agent_response });
          if (opts.doneWhen?.(events)) {
            setTimeout(() => finish(), 4000);
            break;
          }
          // Reply only after the agent's audio has stopped arriving; speaking over the
          // agent counts as an interruption and clips the start of the user's turn.
          {
            const waitForQuiet = () => {
              if (finished) return;
              if (toolsInFlight === 0 && (opts.textOnly || Date.now() > playbackEndsAt + 700)) void sendNextTurn();
              else setTimeout(waitForQuiet, 250);
            };
            setTimeout(waitForQuiet, opts.textOnly ? 200 : 1000);
          }
          break;
        case 'agent_response_correction':
          push({ type: 'agent_response_correction', text: data.agent_response_correction_event?.corrected_agent_response });
          break;
        case 'client_tool_call': {
          const { tool_name, tool_call_id, parameters } = data.client_tool_call;
          push({ type: 'tool_call', tool: tool_name, params: parameters });
          toolsInFlight++;
          let result: string;
          let isError = false;
          try {
            const fn = opts.tools[tool_name];
            if (!fn) throw new Error(`Unknown tool ${tool_name}`);
            result = await fn(parameters || {});
          } catch (err: any) {
            result = err.message;
            isError = true;
          }
          toolsInFlight--;
          push({ type: 'tool_result', tool: tool_name, result });
          ws.send(JSON.stringify({ type: 'client_tool_result', tool_call_id, result, is_error: isError }));
          break;
        }
        default:
          break;
      }
    };
  });
}
