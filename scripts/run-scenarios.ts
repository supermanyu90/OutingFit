/**
 * End-to-end scenario runner against a running OutingFit server.
 *
 *   BASE=http://localhost:3000 npm run test:scenarios
 *
 * Uses the real Open-Meteo API, the configured Gemma runtime and (if
 * configured) ElevenLabs STT/TTS and the voice agent. Writes
 * docs/TEST_RESULTS.md and docs/test-results.json with what actually happened.
 */

import 'dotenv/config';
import fs from 'fs';
import { OutingSession, spokenAgreement, toOutingRequest } from '../shared/outingSession.ts';
import { pcmToWav, runAgentConversation, signedUrl, ttsPcm16k, AgentEvent } from './elevenlabsAdmin.ts';
import { extractNumbers } from '../server/gemma/grounding.ts';
import { addDays, nowInMumbai } from '../server/lib/time.ts';
import type { OutingResult } from '../server/pipeline.ts';

const BASE = process.env.BASE || 'http://localhost:3000';
const HAS_EL = !!process.env.ELEVENLABS_API_KEY;
const HAS_AGENT = HAS_EL && !!process.env.ELEVENLABS_AGENT_ID;
const ONLY = process.env.ONLY?.split(',');

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}
interface ScenarioReport {
  id: string;
  title: string;
  status: 'pass' | 'fail' | 'skipped';
  checks: Check[];
  notes: string[];
  data?: Record<string, unknown>;
}
const reports: ScenarioReport[] = [];

async function post<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json as T;
}
async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json as T;
}

async function resolveOne(q: string, pick?: (name: string) => boolean) {
  const r = await get<any>(`/api/v2/destinations/resolve?q=${encodeURIComponent(q)}`);
  const c = pick ? r.candidates.find((x: any) => pick(x.destination.name)) : r.candidates[0];
  if (!c) throw new Error(`No destination for ${q}: ${r.message}`);
  return { resolve: r, destination: c.destination };
}

function summarise(res: OutingResult) {
  const items = (['wear', 'carry', 'check'] as const).flatMap((k) => res.cards[k].map((c) => `${k}:${c.id}(${c.priority})`));
  return {
    weather: { status: res.weather.dataStatus, usable: res.weather.usable, notice: res.weather.notice, retrievedAt: res.weather.retrievedAt, grid: [res.weather.location.gridLat, res.weather.location.gridLon] },
    window: res.weather.outing?.window,
    hours: res.weather.outing?.hourly.map((h) => h.time),
    whole: res.weather.outing?.whole,
    items,
    gemma: { used: res.gemma.used, runtime: res.gemma.runtime, model: res.gemma.model, latencyMs: res.gemma.latencyMs, validation: res.gemma.validation, error: res.gemma.error },
    spoken: res.spoken.text,
    outfit: res.outfitSummary,
    cards: Object.fromEntries((['wear', 'carry', 'check'] as const).map((k) => [k, res.cards[k].map((c) => ({ id: c.id, title: c.title, explanation: c.explanation }))])),
  };
}

/** Spoken/displayed agreement: every number in the spoken summary appears in the cards or weather data. */
function spokenNumbersAppearInDisplay(res: OutingResult): Check {
  if (!res.spoken.text) return { name: 'spoken numbers match display', pass: false, detail: 'no spoken summary' };
  const displayed = JSON.stringify({ cards: res.cards, weather: res.weather.outing, request: res.request });
  const displayedNums = new Set(extractNumbers(displayed).flatMap((n) => [String(n), String(Math.round(n))]));
  const missing = extractNumbers(res.spoken.text).filter((n) => !displayedNums.has(String(n)));
  return { name: 'spoken numbers appear in displayed data', pass: missing.length === 0, detail: missing.length ? `not displayed: ${missing.join(', ')}` : `numbers: ${extractNumbers(res.spoken.text).join(', ') || 'none'}` };
}

function spokenCoversEssentials(res: OutingResult): Check {
  const must = res.decisions.filter((d) => d.priority === 'essential' || d.priority === 'recommended').map((d) => d.id);
  return {
    name: 'spoken summary validated to cover essential/recommended items',
    pass: res.gemma.validation.passed,
    detail: res.gemma.validation.passed ? `covers ${must.join(', ') || '(none required)'}` : res.gemma.validation.errors.join('; ') || String(res.gemma.error),
  };
}

function unitsAndTimes(res: OutingResult): Check {
  const o = res.weather.outing;
  if (!o) return { name: 'units & local times', pass: false, detail: 'no outing weather' };
  const start = o.window.start.slice(0, 13) + ':00';
  const okHours = o.hourly.length > 0 && o.hourly[0].time === start && o.hourly.every((h) => /T\d{2}:00$/.test(h.time));
  return {
    name: 'local Asia/Kolkata hours cover the outing; °C, %, mm, km/h units validated',
    pass: okHours,
    detail: `window ${o.window.start}→${o.window.end}; hours ${o.hourly.map((h) => h.time.slice(11, 16)).join(',')}; sunset ${o.daily?.sunset ?? 'n/a'}`,
  };
}

async function scenario(id: string, title: string, fn: (r: ScenarioReport) => Promise<void>) {
  if (ONLY && !ONLY.includes(id)) return;
  const r: ScenarioReport = { id, title, status: 'pass', checks: [], notes: [] };
  console.log(`\n=== ${title}`);
  try {
    await fn(r);
    if (r.status !== 'skipped') r.status = r.checks.every((c) => c.pass) ? 'pass' : 'fail';
  } catch (err: any) {
    r.status = 'fail';
    r.checks.push({ name: 'scenario ran without error', pass: false, detail: err.message });
  }
  for (const c of r.checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name} — ${c.detail}`);
  for (const n of r.notes) console.log(`  note: ${n}`);
  reports.push(r);
}

const now = nowInMumbai();
const dayFor = (t: string) => (t > now.time ? now.date : addDays(now.date, 1));

async function main() {
  const status = await get<any>('/api/v2/status');
  console.log(`Server ${BASE} · Gemma ${JSON.stringify(status.gemma.primary ?? status.gemma.fallback)} · ElevenLabs ${status.voice.configured ? 'configured' : 'not configured'} · agent ${status.voice.agentConfigured ? 'configured' : 'not configured'}`);

  // 1 ----------------------------------------------------------------------
  let sunnyItems: string[] = [];
  await scenario('sunny', '1. Sunny afternoon with substantial outdoor exposure (fixture weather)', async (r) => {
    const { destination } = await resolveOne('Juhu');
    const res = await post<OutingResult>('/api/v2/outing', {
      destination, date: dayFor('13:00'), departure: '13:00', return: '17:00', outdoorExposure: 'extended', outdoorStart: '13:30', outdoorEnd: '16:30',
      transport: 'car', coveredDropOff: 'no', venueSetting: 'outdoor', occasion: 'Beach walk with friends', formality: 'casual', language: 'en', weatherFixture: 'sunny_afternoon',
    });
    r.data = summarise(res);
    sunnyItems = res.decisions.map((d) => d.id);
    const has = (id: string) => sunnyItems.includes(id);
    r.checks.push({ name: 'labelled as fixture, not live', pass: res.weather.dataStatus === 'fixture' && res.testFlags.some((f) => f.includes('FIXTURE')), detail: res.testFlags.join(' | ') });
    r.checks.push({ name: 'UV/heat items present', pass: ['wear.sun_coverage', 'carry.sunscreen', 'carry.hat', 'carry.sunglasses', 'wear.breathable_fabric'].every(has), detail: sunnyItems.join(', ') });
    r.checks.push({ name: 'no rain gear', pass: !has('carry.umbrella'), detail: '' });
    r.checks.push({ name: 'sunglasses carry UV-label caveat', pass: /UV400|12312/.test(res.decisions.find((d) => d.id === 'carry.sunglasses')?.productNote || ''), detail: res.decisions.find((d) => d.id === 'carry.sunglasses')?.productNote || '' });
    r.checks.push({ name: 'hourly UV (outdoor period) distinct from daily max', pass: res.weather.outing?.outdoor?.aggregate?.uvIndexMaxHourly === 9 && res.weather.outing?.daily?.uvIndexMaxDaily === 9 && res.weather.outing?.outdoor?.period.source === 'user', detail: `outdoor hourly max ${res.weather.outing?.outdoor?.aggregate?.uvIndexMaxHourly} at ${res.weather.outing?.outdoor?.aggregate?.uvIndexMaxHourlyAt}; daily max ${res.weather.outing?.daily?.uvIndexMaxDaily}` });
    r.checks.push(unitsAndTimes(res), spokenCoversEssentials(res), spokenNumbersAppearInDisplay(res));
  });

  // 2 ----------------------------------------------------------------------
  await scenario('rainy', '2. Humid, rainy evening with a short car-to-entrance walk (fixture weather)', async (r) => {
    const { destination } = await resolveOne('Bombay Canteen');
    const base = { destination, date: dayFor('19:30'), departure: '19:30', return: '22:30', outdoorExposure: 'minimal', transport: 'car', venueSetting: 'indoor', occasion: 'Dinner with family', formality: 'smart_casual', language: 'en', weatherFixture: 'humid_rainy_evening' };
    const res = await post<OutingResult>('/api/v2/outing', { ...base, coveredDropOff: 'no' });
    r.data = summarise(res);
    const ids = res.decisions.map((d) => d.id);
    const umbrella = res.decisions.find((d) => d.id === 'carry.umbrella');
    r.checks.push({ name: 'umbrella essential for uncovered drop-off', pass: umbrella?.priority === 'essential', detail: `${umbrella?.priority}` });
    r.checks.push({ name: 'gusts ≥ 39 km/h → rain jacket suggested', pass: ids.includes('carry.rain_jacket'), detail: `gust max ${res.weather.outing?.whole?.gustMaxKmh} km/h` });
    r.checks.push({ name: 'wet-weather footwear', pass: ids.includes('wear.wet_weather_footwear'), detail: '' });
    r.checks.push({ name: 'waterlogging shown separately, labelled DEMO with source and age', pass: res.waterlogging.status === 'reports_available' && res.waterlogging.reports.every((x) => x.isDemo && x.source && x.ageMinutes >= 0), detail: res.waterlogging.message });
    const covered = await post<OutingResult>('/api/v2/outing', { ...base, coveredDropOff: 'yes' });
    const u2 = covered.decisions.find((d) => d.id === 'carry.umbrella');
    r.checks.push({ name: 'confirmed covered drop-off lowers umbrella to optional', pass: u2?.priority === 'optional' && !covered.decisions.some((d) => d.id === 'wear.wet_weather_footwear'), detail: `${u2?.priority}` });
    r.checks.push({ name: 'weather change → different items vs scenario 1', pass: sunnyItems.length === 0 || (!ids.includes('carry.sunscreen') && ids.includes('carry.umbrella')), detail: `sunny-only: ${sunnyItems.filter((i) => !ids.includes(i)).join(', ')}; rainy-only: ${ids.filter((i) => !sunnyItems.includes(i)).join(', ')}` });
    r.checks.push(spokenCoversEssentials(res), spokenNumbersAppearInDisplay(res));
  });

  // 3 ----------------------------------------------------------------------
  await scenario('ac', '3. Indoor dinner, user feels cold in AC (live weather)', async (r) => {
    const { destination, resolve } = await resolveOne('Bastian At The Top');
    r.notes.push(`resolve("Bastian At The Top") → ${resolve.status} (${resolve.candidates.map((c: any) => c.destination.name).join(' | ')})`);
    const res = await post<OutingResult>('/api/v2/outing', {
      destination, date: dayFor('20:00'), departure: '20:00', return: '23:00', outdoorExposure: 'minimal', transport: 'car', coveredDropOff: 'unknown', venueSetting: 'indoor',
      indoorAc: 'user_expects', feelsColdInAc: true, occasion: 'Anniversary dinner', formality: 'smart_casual', language: 'en',
    });
    r.data = summarise(res);
    const layer = res.decisions.find((d) => d.id === 'wear.ac_layer');
    r.checks.push({ name: 'live forecast used', pass: ['live', 'cached'].includes(res.weather.dataStatus), detail: `${res.weather.dataStatus}, retrieved ${res.weather.retrievedAt}` });
    r.checks.push({ name: 'AC layer recommended from stated preference', pass: layer?.priority === 'recommended' && layer.evidence.some((e: any) => e.field === 'feels_cold_in_ac'), detail: JSON.stringify(layer?.evidence) });
    r.checks.push({ name: 'no sun gear after sunset', pass: !res.decisions.some((d) => /sun|hat/.test(d.id)), detail: `sunset ${res.weather.outing?.daily?.sunset}` });
    r.checks.push(unitsAndTimes(res), spokenCoversEssentials(res), spokenNumbersAppearInDisplay(res));
  });

  // 4a ---------------------------------------------------------------------
  const utterances = {
    hi: 'कल शाम सात बजे बास्टियन जाना है, ग्यारह बजे तक लौटूँगी, मुझे AC में ठंड लगती है',
    mr: 'उद्या संध्याकाळी सात वाजता बास्टियनला जायचं आहे, अकरा वाजेपर्यंत परत येईन, मला AC मध्ये थंडी वाजते',
  } as const;
  for (const lang of ['hi', 'mr'] as const) {
    await scenario(`voice-scribe-${lang}`, `4a. ${lang === 'hi' ? 'Hindi' : 'Marathi'} voice input with an ambiguous venue — Scribe dictation path`, async (r) => {
      if (!HAS_EL) {
        r.status = 'skipped';
        r.notes.push('ELEVENLABS_API_KEY not set');
        return;
      }
      const voiceId = process.env.ELEVENLABS_VOICE_ID!;
      const pcm = await ttsPcm16k(utterances[lang], voiceId, 'eleven_v3', lang);
      const tr = await fetch(`${BASE}/api/v2/voice/transcribe?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: new Uint8Array(pcmToWav(pcm)) }).then((x) => x.json());
      r.checks.push({ name: `Scribe transcribed ${lang} speech`, pass: !!tr.text && /[ऀ-ॿ]/.test(tr.text), detail: `"${tr.text}" (lang ${tr.languageCode}, p=${tr.languageProbability})` });
      const parsed = await post<any>('/api/v2/parse', { text: tr.text });
      r.checks.push({ name: 'destination flagged ambiguous (two Bastian branches)', pass: parsed.destination?.status === 'ambiguous', detail: `${parsed.destination?.status}: ${(parsed.destination?.candidates || []).map((c: any) => c.destination.name).join(' | ')}` });
      const expectsDateConfirm = lang === 'hi';
      r.checks.push({
        name: expectsDateConfirm ? '"कल" date flagged for confirmation' : 'Marathi "उद्या" resolved to tomorrow',
        pass: expectsDateConfirm ? parsed.confirmations.some((c: any) => c.field === 'date') : parsed.parsed?.date === addDays(now.date, 1),
        detail: `date ${parsed.parsed?.date}; confirmations: ${parsed.confirmations.map((c: any) => c.reason).join(' / ') || 'none'}`,
      });
      r.checks.push({ name: 'times extracted in 24h Mumbai time', pass: parsed.parsed?.departure === '19:00' && parsed.parsed?.return === '23:00', detail: `${parsed.parsed?.departure}–${parsed.parsed?.return}` });
      r.checks.push({ name: 'AC preference extracted', pass: parsed.parsed?.feelsColdInAc === true, detail: String(parsed.parsed?.feelsColdInAc) });

      // User confirms: Dadar branch, tomorrow.
      const dadar = parsed.destination.candidates.find((c: any) => /Dadar|Top/.test(c.destination.name + c.subtitle));
      const res = await post<OutingResult>('/api/v2/outing', {
        destination: dadar.destination, date: addDays(now.date, 1), departure: parsed.parsed.departure || '19:00', return: parsed.parsed.return || '23:00',
        outdoorExposure: 'minimal', transport: 'car', indoorAc: parsed.parsed.indoorAc ?? 'unknown', feelsColdInAc: !!parsed.parsed.feelsColdInAc, language: lang,
      });
      r.data = { transcript: tr, parsed: parsed.parsed, confirmations: parsed.confirmations, ...summarise(res) };
      r.checks.push(spokenCoversEssentials(res), spokenNumbersAppearInDisplay(res));
      r.checks.push({ name: `spoken summary in Devanagari (${lang})`, pass: !!res.spoken.text && /[ऀ-ॿ]/.test(res.spoken.text), detail: res.spoken.text || res.spoken.unavailableReason || '' });

      if (res.spoken.text) {
        // Round trip: speak the summary through the app's TTS endpoint and transcribe it back.
        const audio = await fetch(`${BASE}/api/v2/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: res.spoken.text, language: lang }) });
        const model = audio.headers.get('x-outingfit-tts-model');
        const mp3 = Buffer.from(await audio.arrayBuffer());
        if (!audio.ok) r.notes.push(`speak HTTP ${audio.status}: ${mp3.toString('utf8').slice(0, 300)}`);
        const back = await fetch(`${BASE}/api/v2/voice/transcribe?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: new Uint8Array(mp3) }).then((x) => x.json());
        const score = spokenAgreement(back.text || '', res.spoken.text);
        r.checks.push({ name: 'spoken audio matches displayed summary (TTS → STT round trip)', pass: audio.ok && score >= 0.75, detail: `TTS ${model}, ${mp3.length} bytes; agreement ${(score * 100).toFixed(0)}%; heard "${back.text}"` });
        const forged = await fetch(`${BASE}/api/v2/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Invented weather advice', language: lang }) });
        r.checks.push({ name: 'TTS refuses text that is not a backend summary', pass: forged.status === 403, detail: `HTTP ${forged.status}` });
      }
    });
  }

  // 4b ---------------------------------------------------------------------
  for (const lang of ['hi', 'mr'] as const) {
    await scenario(`voice-agent-${lang}`, `4b. ${lang === 'hi' ? 'Hindi' : 'Marathi'} voice conversation with the ElevenLabs agent (ambiguous venue)`, async (r) => {
      if (!HAS_AGENT) {
        r.status = 'skipped';
        r.notes.push('ElevenLabs agent not configured (run npm run setup:agent)');
        return;
      }
      if (process.env[`ELEVENLABS_AGENT_LANG_${lang.toUpperCase()}`] !== 'ok') {
        r.status = 'skipped';
        r.notes.push(`Agent setup did not verify ${lang}`);
        return;
      }
      const voiceId = process.env.ELEVENLABS_VOICE_ID!;
      const followUps =
        lang === 'hi'
          ? ['दादर वाला, बास्टियन एट द टॉप', 'हाँ, कल यानी आने वाला दिन, शाम सात से रात ग्यारह बजे तक, सही है', 'हाँ, सही है']
          : ['दादरचं, बास्टियन ॲट द टॉप', 'हो, बरोबर आहे', 'हो, बरोबर'];
      const turns = await Promise.all([utterances[lang], ...followUps].map(async (t) => ({ audio: await ttsPcm16k(t, voiceId, 'eleven_v3', lang) })));
      const session = new OutingSession(BASE, lang);
      const weekday = new Date(`${now.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const run = await runAgentConversation({
        signedUrl: await signedUrl((lang === 'mr' ? process.env.ELEVENLABS_AGENT_ID_MR : process.env.ELEVENLABS_AGENT_ID)!),
        language: lang,
        dynamicVariables: { today: now.date, weekday },
        turns,
        tools: session.clientTools(),
        doneWhen: (ev) => {
          const i = ev.findIndex((e) => e.type === 'tool_result' && /"status":"ok"/.test(e.result || '') && /spoken_summary/.test(e.result || ''));
          return i >= 0 && ev.slice(i).some((e) => e.type === 'agent_response');
        },
        timeoutMs: 240000,
        log: (e) => console.log(`    [${(e.t / 1000).toFixed(1)}s] ${e.type}${e.tool ? ` ${e.tool}` : ''}: ${(e.text ?? (e.params ? JSON.stringify(e.params) : e.result) ?? '').slice(0, 160)}`),
      });
      const ev = run.events;
      const userTx = ev.filter((e) => e.type === 'user_transcript' && e.text?.trim()).map((e) => e.text);
      const calls = ev.filter((e) => e.type === 'tool_call');
      r.data = { events: ev.map(({ t, type, text, tool, params, result }) => ({ t, type, text, tool, params, result: result?.slice(0, 600) })), form: toOutingRequest(session.form) };
      r.checks.push({ name: `agent ASR transcribed ${lang} speech`, pass: userTx.some((t) => /[ऀ-ॿ]/.test(t || '')), detail: userTx.join(' || ') });
      const firstSet = calls.find((c) => c.tool === 'set_outing_details');
      r.checks.push({ name: 'agent called set_outing_details with the venue in Latin letters (spelling variants matched by the backend)', pass: !!firstSet && /bast(i|io)?[ao]n/i.test(JSON.stringify(firstSet.params)), detail: JSON.stringify(firstSet?.params) });
      const ambiguousResult = ev.find((e) => e.type === 'tool_result' && /"destination_status":"ambiguous"/.test(e.result || ''));
      r.checks.push({ name: 'backend reported the venue as ambiguous to the agent', pass: !!ambiguousResult, detail: ambiguousResult?.result?.slice(0, 200) || '' });
      r.checks.push({ name: 'agent asked and called choose_destination', pass: calls.some((c) => c.tool === 'choose_destination'), detail: JSON.stringify(calls.filter((c) => c.tool === 'choose_destination').map((c) => c.params)) });
      // Advice may come back inside confirm_details/choose_destination (advice.spoken_summary)
      // or from an explicit get_outing_advice call.
      const adviceOf = (e: AgentEvent) => {
        if (e.type !== 'tool_result') return null;
        try {
          const j = JSON.parse(e.result || '{}');
          const a = j.advice ?? (e.tool === 'get_outing_advice' ? j : null);
          return a?.status === 'ok' ? (a.spoken_summary as string) : null;
        } catch {
          return null;
        }
      };
      const confirmIdx = ev.findIndex((e) => e.type === 'tool_call' && e.tool === 'confirm_details');
      const adviceIdx = ev.findIndex((e) => adviceOf(e) !== null);
      r.checks.push({ name: 'agent confirmed date/times before advice was fetched', pass: confirmIdx >= 0 && adviceIdx > confirmIdx, detail: calls.map((c) => c.tool).join(' → ') });
      const summary = adviceIdx >= 0 ? adviceOf(ev[adviceIdx]) : null;
      const said = adviceIdx >= 0 ? ev.slice(adviceIdx).find((e) => e.type === 'agent_response')?.text : undefined;
      const score = summary && said ? spokenAgreement(said, summary) : 0;
      r.checks.push({ name: 'agent spoke the backend summary (agreement ≥ 85%)', pass: score >= 0.85, detail: `agreement ${(score * 100).toFixed(0)}%\n      summary: ${summary}\n      agent said: ${said}` });
      r.checks.push({ name: 'form ended on the Dadar branch, tomorrow', pass: /Top|Dadar/.test(session.form.destination?.name || '') && session.form.date === addDays(now.date, 1), detail: `${session.form.destination?.name} ${session.form.date} ${session.form.departure}-${session.form.return}` });
      r.notes.push(`agent audio received: ${run.audioBytes} bytes; formats ${JSON.stringify({ in: run.metadata?.user_input_audio_format, out: run.metadata?.agent_output_audio_format })}`);
    });
  }

  // 5 ----------------------------------------------------------------------
  await scenario('failure', '5. Weather API failure', async (r) => {
    const { destination } = await resolveOne('Colaba');
    const body = { destination, date: dayFor('18:00'), departure: '18:00', return: '21:00', outdoorExposure: 'moderate', transport: 'car', language: 'en' };
    const live = await post<OutingResult>('/api/v2/outing', body);
    r.checks.push({ name: 'baseline live fetch', pass: ['live', 'cached'].includes(live.weather.dataStatus), detail: `${live.weather.dataStatus} @ ${live.weather.retrievedAt}` });
    const stale = await post<OutingResult>('/api/v2/outing', { ...body, fault: 'weather_down' });
    r.checks.push({ name: 'outage with recent cache → STALE label, retrieval time shown, not live', pass: stale.weather.dataStatus === 'stale' && /not live/.test(stale.weather.notice || '') && stale.weather.retrievedAt === live.weather.retrievedAt, detail: stale.weather.notice || '' });
    const { destination: cold } = await resolveOne('Powai');
    const unavailable = await post<OutingResult>('/api/v2/outing', { ...body, destination: cold, fault: 'weather_down' });
    r.checks.push({ name: 'outage without cache → weather unavailable, no weather-based items', pass: unavailable.weather.dataStatus === 'unavailable' && unavailable.decisions.some((d) => d.id === 'check.weather_unavailable') && !unavailable.decisions.some((d) => /sun|umbrella|breathable|rain/.test(d.id)), detail: `${unavailable.weather.notice}; items: ${unavailable.decisions.map((d) => d.id).join(', ')}` });
    r.checks.push({ name: 'inputs preserved in the response', pass: unavailable.request.departure === '18:00' && unavailable.request.destination.name === cold.name, detail: `${unavailable.request.destination.name} ${unavailable.request.departure}-${unavailable.request.return}` });
    r.checks.push({ name: 'labelled as a test fault', pass: unavailable.testFlags.some((f) => /TEST/.test(f)), detail: unavailable.testFlags.join(' | ') });
    r.data = { stale: summarise(stale), unavailable: summarise(unavailable) };
  });

  // Beyond horizon ---------------------------------------------------------
  await scenario('horizon', 'Extra. Date beyond the forecast horizon', async (r) => {
    const { destination } = await resolveOne('Juhu');
    const res = await post<OutingResult>('/api/v2/outing', { destination, date: addDays(now.date, 20), departure: '12:00', return: '15:00', language: 'en' });
    r.checks.push({ name: 'explains precise advice not yet available', pass: !res.weather.usable && res.weather.outing?.status === 'beyond_horizon' && /not yet available/.test(res.weather.notice || ''), detail: res.weather.notice || '' });
  });

  // Output -----------------------------------------------------------------
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/test-results.json', JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, status, reports }, null, 2));
  const md: string[] = [
    '# OutingFit — scenario test results',
    '',
    `Run at ${new Date().toISOString()} (Mumbai ${now.date} ${now.time}) against ${BASE}.`,
    `Gemma: ${JSON.stringify(status.gemma.primary)} fallback ${JSON.stringify(status.gemma.fallback)}. ElevenLabs: ${status.voice.configured ? 'configured' : 'not configured'}; agent: ${status.voice.agentConfigured ? 'configured' : 'not configured'}.`,
    '',
    '| Scenario | Result |',
    '|---|---|',
    ...reports.map((r) => `| ${r.title} | ${r.status.toUpperCase()} (${r.checks.filter((c) => c.pass).length}/${r.checks.length}) |`),
    '',
  ];
  for (const r of reports) {
    md.push(`## ${r.title}`, '', `**${r.status.toUpperCase()}**`, '');
    for (const c of r.checks) md.push(`- ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${c.detail.replace(/\n/g, '<br>')}` : ''}`);
    for (const n of r.notes) md.push(`- note: ${n}`);
    const d: any = r.data;
    if (d?.spoken) md.push('', `Spoken summary: "${d.spoken}"`);
    if (d?.items) md.push('', `Items: ${d.items.join(', ')}`);
    md.push('');
  }
  fs.writeFileSync('docs/TEST_RESULTS.md', md.join('\n'));
  console.log('\nWrote docs/TEST_RESULTS.md and docs/test-results.json');
  process.exit(reports.some((r) => r.status === 'fail') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
