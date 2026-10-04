/**
 * Creates (or updates) the OutingFit ElevenLabs agent and its client tools,
 * then verifies each language with a live agent session.
 *
 *   npm run setup:agent
 *
 * Writes ELEVENLABS_AGENT_ID, ELEVENLABS_VOICE_ID and per-language
 * verification results to .env.
 */

import 'dotenv/config';
import { AGENT_LLM, AGENT_NAME, AGENT_PROMPT, CLIENT_TOOLS, FIRST_MESSAGES } from './agentConfig.ts';
import { el, runAgentConversation, signedUrl, ttsPcm16k, upsertEnv } from './elevenlabsAdmin.ts';
import { nowInMumbai } from '../server/lib/time.ts';

type Lang = 'en' | 'hi' | 'mr';
const LANGS: Lang[] = ['en', 'hi', 'mr'];

/** Agent TTS per language: Flash v2 for English; v3 Conversational covers Hindi and Marathi (Flash v2.5 has no Marathi). */
const AGENT_TTS: Record<Lang, string> = {
  en: process.env.ELEVENLABS_AGENT_TTS_EN || 'eleven_flash_v2',
  hi: process.env.ELEVENLABS_AGENT_TTS_HI || 'eleven_v3_conversational',
  mr: process.env.ELEVENLABS_AGENT_TTS_MR || 'eleven_v3_conversational',
};

async function main() {
  console.log('1) Checking model language support (GET /v1/models)…');
  try {
    const models: any[] = await el('/v1/models');
    for (const l of LANGS) {
      const tts = models.filter((m) => m.can_do_text_to_speech && m.languages?.some((x: any) => x.language_id === l)).map((m) => m.model_id);
      console.log(`   ${l}: TTS models listing this language → ${tts.join(', ') || 'none'}`);
    }
  } catch (err: any) {
    if (!/models_read/.test(err.message)) throw err;
    console.log('   API key lacks models_read; using documented support. Step 5 still verifies each language live.');
  }

  console.log('2) Choosing a voice…');
  let voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    const voices: any = await el('/v1/voices');
    const premade = (voices.voices || []).filter((v: any) => v.category === 'premade');
    const pick = premade.find((v: any) => /sarah|aria|laura|alice|jessica/i.test(v.name)) || premade[0] || voices.voices?.[0];
    if (!pick) throw new Error('No voices available on this account');
    voiceId = pick.voice_id as string;
    console.log(`   Using premade voice "${pick.name}" (${voiceId}). Override with ELEVENLABS_VOICE_ID.`);
  } else console.log(`   Using ELEVENLABS_VOICE_ID=${voiceId}`);

  console.log('3) Creating/updating client tools…');
  const existing: any = await el('/v1/convai/tools');
  const toolIds: string[] = [];
  for (const cfg of CLIENT_TOOLS) {
    const found = (existing.tools || []).find((t: any) => t.tool_config?.name === cfg.name);
    if (found) {
      await el(`/v1/convai/tools/${found.id}`, { method: 'PATCH', body: JSON.stringify({ tool_config: cfg }) });
      toolIds.push(found.id);
      console.log(`   updated ${cfg.name} (${found.id})`);
    } else {
      const created: any = await el('/v1/convai/tools', { method: 'POST', body: JSON.stringify({ tool_config: cfg }) });
      toolIds.push(created.id);
      console.log(`   created ${cfg.name} (${created.id})`);
    }
  }

  /**
   * Agent config. `primary` is the agent's own language; `presets` are extra
   * languages selectable per call. The agents API accepts Hindi as a preset but
   * rejects Marathi there ("Preset languages must be one of …"), while it
   * accepts Marathi as an agent's primary language — so Marathi gets its own agent.
   */
  const buildConfig = (name: string, primary: Lang, presets: Lang[]) => ({
    name,
    conversation_config: {
      agent: {
        language: primary,
        first_message: FIRST_MESSAGES[primary],
        dynamic_variables: { dynamic_variable_placeholders: { today: nowInMumbai().date, weekday: 'today' } },
        prompt: { prompt: AGENT_PROMPT, llm: AGENT_LLM, temperature: 0, tool_ids: toolIds },
      },
      tts: { model_id: AGENT_TTS[primary], voice_id: voiceId },
      language_presets: Object.fromEntries(
        presets.map((l) => [l, { overrides: { agent: { first_message: FIRST_MESSAGES[l], language: l }, tts: { model_id: AGENT_TTS[l] } } }])
      ),
    },
    platform_settings: {
      auth: { enable_auth: true },
      overrides: {
        conversation_config_override: {
          agent: { language: true, first_message: true },
          conversation: { text_only: true },
        },
      },
    },
  });

  const upsertAgent = async (existingId: string | undefined, body: object): Promise<string> => {
    if (existingId) {
      await el(`/v1/convai/agents/${existingId}`, { method: 'PATCH', body: JSON.stringify(body) });
      return existingId;
    }
    return ((await el('/v1/convai/agents/create', { method: 'POST', body: JSON.stringify(body) })) as any).agent_id;
  };

  const langStatus: Record<Lang, { ok: boolean; note: string }> = {
    en: { ok: true, note: '' },
    hi: { ok: true, note: '' },
    mr: { ok: true, note: '' },
  };

  console.log('4) Creating/updating agents…');
  const mainId = await upsertAgent(process.env.ELEVENLABS_AGENT_ID, buildConfig(AGENT_NAME, 'en', []));
  console.log(`   main agent (en) = ${mainId}`);
  // Add each preset on its own so one rejected language doesn't hide another.
  const accepted: Lang[] = [];
  for (const l of ['hi'] as Lang[]) {
    try {
      await upsertAgent(mainId, buildConfig(AGENT_NAME, 'en', [...accepted, l]));
      accepted.push(l);
      console.log(`   ${l} preset accepted on the main agent`);
    } catch (err: any) {
      langStatus[l] = { ok: false, note: `Agents API rejected the ${l} preset: ${err.message.slice(0, 240)}` };
      console.warn(`   ${l} preset rejected: ${err.message.slice(0, 240)}`);
    }
  }
  let mrId: string | undefined;
  try {
    mrId = await upsertAgent(process.env.ELEVENLABS_AGENT_ID_MR, buildConfig(`${AGENT_NAME} (Marathi)`, 'mr', []));
    console.log(`   Marathi agent (primary language mr) = ${mrId}`);
  } catch (err: any) {
    langStatus.mr = { ok: false, note: `Agents API rejected Marathi as a primary language: ${err.message.slice(0, 240)}` };
    console.warn(`   ${langStatus.mr.note}`);
  }
  const agentFor = (l: Lang) => (l === 'mr' ? mrId : mainId);

  console.log('5) Live verification per language: spoken first message, then agent speech recognition of real speech…');
  const today = nowInMumbai().date;
  const weekday = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const probeUtterance: Record<Lang, string> = {
    en: 'I am going to Juhu tomorrow evening.',
    hi: 'मैं कल शाम जुहू जा रही हूँ।',
    mr: 'मी उद्या संध्याकाळी जुहूला जाणार आहे.',
  };
  let lastNote = '';
  const verifyOnce = async (l: Lang, id: string) => {
    const audio = await ttsPcm16k(probeUtterance[l], voiceId!, 'eleven_v3', l);
    const run = await runAgentConversation({
      signedUrl: await signedUrl(id),
      language: l,
      dynamicVariables: { today, weekday },
      turns: [{ audio }],
      tools: { set_outing_details: () => '{"ready_for_advice":false,"missing":["departure time"]}' },
      doneWhen: (ev) => ev.some((e) => e.type === 'user_transcript' && e.text?.trim()) && ev.filter((e) => e.type === 'agent_response').length >= 2,
      timeoutMs: 40000,
    });
    const first = run.events.find((e) => e.type === 'agent_response')?.text;
    const heard = run.events.find((e) => e.type === 'user_transcript' && e.text?.trim())?.text || '';
    if (!first) throw new Error(`no agent response (events: ${run.events.map((e) => e.type).join(',')})`);
    if (run.audioBytes === 0) throw new Error('agent responded but sent no audio');
    const scriptOk = l === 'en' ? /[a-z]{3,}/i.test(heard) : /[\u0900-\u097F]/.test(heard);
    if (!scriptOk) throw new Error(`no ${l} transcript of the test sentence (heard: "${heard}")`);
    lastNote = `first message "${first.slice(0, 50)}…"; ASR heard "${heard}"; ${run.audioBytes} audio bytes`;
  };
  for (const l of LANGS) {
    const id = agentFor(l);
    if (!langStatus[l].ok || !id) continue;
    const failures: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await verifyOnce(l, id);
        langStatus[l] = { ok: true, note: `${lastNote}${attempt > 1 ? ` (passed on attempt ${attempt}/3; earlier: ${failures.join(' / ')})` : ''}` };
        break;
      } catch (err: any) {
        failures.push(err.message.slice(0, 160));
        langStatus[l] = { ok: false, note: `Live session failed 3/3 times: ${failures.join(' / ')}` };
      }
    }
    console.log(`   ${l}: ${langStatus[l].ok ? 'OK' : 'FAILED'} — ${langStatus[l].note}`);
  }

  const clean = (t: string) => t.replace(/[\r\n"]/g, ' ').slice(0, 200);
  upsertEnv({
    ELEVENLABS_AGENT_ID: mainId,
    ...(mrId ? { ELEVENLABS_AGENT_ID_MR: mrId } : {}),
    ELEVENLABS_VOICE_ID: voiceId!,
    ...Object.fromEntries(LANGS.map((l) => [`ELEVENLABS_AGENT_LANG_${l.toUpperCase()}`, langStatus[l].ok ? 'ok' : 'unsupported'])),
    ...Object.fromEntries(LANGS.map((l) => [`ELEVENLABS_AGENT_TTS_${l.toUpperCase()}`, AGENT_TTS[l]])),
    ...Object.fromEntries(LANGS.filter((l) => !langStatus[l].ok).map((l) => [`ELEVENLABS_AGENT_NOTE_${l.toUpperCase()}`, `"${clean(langStatus[l].note)}"`])),
  });
  console.log('Saved agent settings to .env. Restart the server to pick them up.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
