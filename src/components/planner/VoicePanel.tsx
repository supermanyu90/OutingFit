import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Square, Keyboard, MessageSquareText, PhoneCall, PhoneOff, Volume2, VolumeX, Loader2, Send, AudioLines } from 'lucide-react';
import { api, AppStatus, ParseResult, ResolveResult } from '../../api';
import { Language, LANGUAGE_OPTIONS } from '../../i18n';
import { spokenAgreement } from '../../../shared/outingSession';

type Mode = 'agent' | 'dictate' | 'type';

interface Line {
  role: 'user' | 'agent' | 'tool' | 'system';
  text: string;
}

export interface VoicePanelProps {
  language: Language;
  status: AppStatus | null;
  textOnly: boolean;
  clientTools: Record<string, (p: any) => Promise<string> | string>;
  onParsed: (p: ParseResult & { destination: ResolveResult | null }) => void;
  /** Latest backend spoken summary, used to check the agent said exactly that. */
  spokenSummary: string | null;
}

const FIELD_NAMES: Record<string, string> = {
  destinationLatin: 'destination',
  date: 'date',
  departure: 'departure',
  return: 'return',
  outdoorExposure: 'time outdoors',
  transport: 'travel',
  coveredDropOff: 'covered drop-off',
  venueSetting: 'venue setting',
  indoorAc: 'AC',
  feelsColdInAc: 'feels cold in AC',
  occasion: 'occasion',
  formality: 'dress level',
  colourPreference: 'colour',
};

/** Lists what Gemma filled in so the user can check it against what they said. */
function filledFields(p: Record<string, unknown>): string {
  const filled = Object.entries(FIELD_NAMES)
    .filter(([k]) => p[k] !== null && p[k] !== undefined && p[k] !== '')
    .map(([k, label]) => `${label}: ${String(p[k])}`);
  return filled.length ? `Gemma filled — please check: ${filled.join('; ')}.` : 'Gemma could not extract any details.';
}

export function VoicePanel(props: VoicePanelProps) {
  // Keep tool handlers current without re-creating the provider.
  const toolsRef = useRef(props.clientTools);
  toolsRef.current = props.clientTools;
  const stableTools = useMemo(
    () =>
      Object.fromEntries(
        ['set_outing_details', 'choose_destination', 'confirm_details', 'get_outing_advice'].map((name) => [
          name,
          (p: any) => toolsRef.current[name](p),
        ])
      ),
    []
  );
  const [micMuted, setMicMuted] = useState(false);
  return (
    <ConversationProvider clientTools={stableTools} isMuted={micMuted} onMutedChange={setMicMuted}>
      <VoicePanelInner {...props} micMuted={micMuted} setMicMuted={setMicMuted} />
    </ConversationProvider>
  );
}

function VoicePanelInner({
  language,
  status,
  textOnly,
  onParsed,
  spokenSummary,
  micMuted,
  setMicMuted,
}: VoicePanelProps & { micMuted: boolean; setMicMuted: (m: boolean) => void }) {
  const caps = status?.voice.languages[language];
  const agentAvailable = caps?.agent.supported === true;
  const sttAvailable = !!caps?.stt.supported;
  const [mode, setMode] = useState<Mode>('type');
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [agentMutedOut, setAgentMutedOut] = useState(false);
  const [agreement, setAgreement] = useState<{ score: number; said: string } | null>(null);
  const awaitingSummary = useRef(false);
  const summaryRef = useRef(spokenSummary);
  summaryRef.current = spokenSummary;

  const conversation = useConversation({
    onMessage: (m: { message: string; role?: string; source?: string }) => {
      const role = m.role === 'agent' || m.source === 'ai' ? 'agent' : 'user';
      setLines((l) => [...l, { role, text: m.message }]);
      if (role === 'agent' && awaitingSummary.current && summaryRef.current) {
        awaitingSummary.current = false;
        setAgreement({ score: spokenAgreement(m.message, summaryRef.current), said: m.message });
      }
    },
    onAgentToolResponse: (e: any) => {
      const name = e?.tool_name ?? e?.agent_tool_response?.tool_name;
      if (name) setLines((l) => [...l, { role: 'tool', text: `tool: ${name}` }]);
    },
    onError: (e: any) => setErr(typeof e === 'string' ? e : e?.message || 'Voice agent error'),
  } as any);

  // Detect when the agent has just received a spoken summary from get_outing_advice.
  useEffect(() => {
    if (spokenSummary && conversation.status === 'connected') {
      awaitingSummary.current = true;
      setAgreement(null);
    }
  }, [spokenSummary]);

  useEffect(() => {
    if (!agentAvailable && mode === 'agent') setMode(sttAvailable && !textOnly ? 'dictate' : 'type');
    if (textOnly && mode === 'dictate') setMode('type');
  }, [agentAvailable, sttAvailable, textOnly]);

  const connected = conversation.status === 'connected';

  async function startAgent() {
    setErr(null);
    setLines([]);
    setAgreement(null);
    try {
      setBusy('Connecting…');
      const today = status?.now.date ?? '';
      const weekday = today ? new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '';
      const common = {
        overrides: { agent: { language: language as any }, conversation: { textOnly } },
        dynamicVariables: { today, weekday },
      };
      if (textOnly) {
        const { signedUrl } = await api.signedUrl(language);
        conversation.startSession({ ...common, signedUrl, textOnly: true } as any);
      } else {
        // Microphone access is requested only here, after the user pressed Start.
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const { token } = await api.conversationToken(language);
        conversation.startSession({ ...common, conversationToken: token } as any);
      }
    } catch (e: any) {
      setErr(e?.name === 'NotAllowedError' ? 'Microphone permission was denied. Use Type instead, or allow the microphone.' : e.message);
    } finally {
      setBusy(null);
    }
  }

  function stopAgent() {
    conversation.endSession();
  }

  function toggleAgentVoice() {
    const next = !agentMutedOut;
    setAgentMutedOut(next);
    conversation.setVolume({ volume: next ? 0 : 1 });
  }

  // ------------------------------------------------------------ dictation
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  async function startRecording() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        setBusy('Transcribing with ElevenLabs Scribe…');
        try {
          const tr = await api.transcribe(blob, language);
          setDraft(tr.text);
          setLines((l) => [...l, { role: 'system', text: `Scribe (${tr.model}) heard ${tr.languageCode ?? 'unknown language'}${tr.languageProbability ? ` (p=${tr.languageProbability.toFixed(2)})` : ''}. Edit the transcript if needed, then use it.` }]);
        } catch (e: any) {
          setErr(`Transcription failed: ${e.message}`);
        } finally {
          setBusy(null);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      setErr(e?.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.message);
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function useText() {
    const text = draft.trim();
    if (!text) return;
    if (connected) {
      conversation.sendUserMessage(text);
      setDraft('');
      return;
    }
    setErr(null);
    setBusy('Gemma is reading your request…');
    try {
      const p = await api.parse(text);
      if (!p.parsed) throw new Error(p.error || 'Could not read the request');
      onParsed(p);
      setLines((l) => [
        ...l,
        { role: 'user', text },
        {
          role: 'system',
          text:
            [
              filledFields(p.parsed as unknown as Record<string, unknown>),
              p.missing.length ? `Still needed: ${p.missing.join(', ')}.` : '',
              p.confirmations.length ? p.confirmations.map((c) => c.reason).join(' ') : '',
              p.destination?.status === 'ambiguous' ? 'Several places match — choose one in the form.' : '',
            ]
              .filter(Boolean)
              .join(' ') || 'Form updated. Check the details and confirm.',
        },
      ]);
      setDraft('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  const langName = LANGUAGE_OPTIONS.find((l) => l.code === language)?.label;
  const ModeButton = ({ m, icon, label, disabled, title }: { m: Mode; icon: React.ReactNode; label: string; disabled?: boolean; title?: string }) => (
    <button
      onClick={() => setMode(m)}
      disabled={disabled}
      title={title}
      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
        mode === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3" aria-label="Tell OutingFit about your outing">
      <div className="flex gap-2">
        <ModeButton
          m="agent"
          icon={<PhoneCall className="w-3.5 h-3.5" />}
          label="Talk"
          disabled={!agentAvailable}
          title={agentAvailable ? 'Voice conversation (ElevenLabs agent)' : caps?.agent.note || 'Voice agent unavailable'}
        />
        <ModeButton
          m="dictate"
          icon={<Mic className="w-3.5 h-3.5" />}
          label="Dictate"
          disabled={!sttAvailable || textOnly}
          title={textOnly ? 'Text-only mode is on' : caps?.stt.note || 'Speech-to-text unavailable'}
        />
        <ModeButton m="type" icon={<Keyboard className="w-3.5 h-3.5" />} label="Type" />
      </div>

      {mode === 'agent' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {textOnly
              ? `Text conversation with the ElevenLabs agent in ${langName}. No microphone or audio is used.`
              : `Voice conversation with the ElevenLabs agent in ${langName}. The microphone is used only after you press Start. The agent fills in the form; all advice comes from OutingFit's backend.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {!connected ? (
              <button
                onClick={startAgent}
                disabled={!!busy || conversation.status === 'connecting'}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Start {textOnly ? 'text' : 'voice'} conversation
              </button>
            ) : (
              <button onClick={stopAgent} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <PhoneOff className="w-3.5 h-3.5" /> End
              </button>
            )}
            {connected && !textOnly && (
              <>
                <button
                  onClick={() => setMicMuted(!micMuted)}
                  aria-pressed={micMuted}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:border-slate-400"
                >
                  {micMuted ? <MicOff className="w-3.5 h-3.5 text-rose-600" /> : <Mic className="w-3.5 h-3.5" />} {micMuted ? 'Unmute mic' : 'Mute mic'}
                </button>
                <button
                  onClick={toggleAgentVoice}
                  aria-pressed={agentMutedOut}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:border-slate-400"
                >
                  {agentMutedOut ? <VolumeX className="w-3.5 h-3.5 text-rose-600" /> : <Volume2 className="w-3.5 h-3.5" />} {agentMutedOut ? 'Unmute agent' : 'Mute agent'}
                </button>
                <span className="text-[11px] text-slate-500 self-center flex items-center gap-1">
                  <AudioLines className="w-3.5 h-3.5" /> {conversation.isSpeaking ? 'Agent speaking' : 'Listening'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'dictate' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Record yourself in {langName} (mixing in English is fine to try). ElevenLabs Scribe transcribes it; you can correct the text before Gemma reads it.
          </p>
          {!recording ? (
            <button onClick={startRecording} disabled={!!busy} className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Mic className="w-3.5 h-3.5" /> Start recording
            </button>
          ) : (
            <button onClick={stopRecording} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer animate-pulse">
              <Square className="w-3.5 h-3.5" /> Stop and transcribe
            </button>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 max-h-56 overflow-y-auto space-y-1.5" aria-live="polite" aria-label="Transcript">
        {lines.length === 0 ? (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" /> Transcript appears here.
          </p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`text-xs leading-relaxed ${l.role === 'user' ? 'text-slate-900' : l.role === 'agent' ? 'text-emerald-900' : 'text-slate-500 italic'}`}>
              <span className="font-bold mr-1">{l.role === 'user' ? 'You' : l.role === 'agent' ? 'Agent' : l.role === 'tool' ? '' : 'Note'}</span>
              {l.text}
            </div>
          ))
        )}
      </div>

      {agreement && (
        <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${agreement.score >= 0.85 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
          Spoken vs displayed summary: {Math.round(agreement.score * 100)}% match
          {agreement.score < 0.85 && ' — the agent did not repeat the summary exactly; rely on the cards.'}
        </div>
      )}

      {/* Editable text / transcript correction */}
      <div className="space-y-2">
        <label htmlFor="outing-text" className="text-[11px] font-semibold text-slate-600">
          {connected ? 'Type to the agent (corrections welcome)' : mode === 'dictate' ? 'Transcript (edit before using)' : `Describe your outing in ${langName}`}
        </label>
        <textarea
          id="outing-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={
            language === 'hi'
              ? 'जैसे: कल शाम 7 बजे बास्टियन जाना है, 11 बजे तक लौटूँगी, AC में ठंड लगती है'
              : language === 'mr'
                ? 'उदा: उद्या संध्याकाळी 7 वाजता बास्टियनला जायचं आहे, 11 पर्यंत परत'
                : 'e.g. Lunch at Olive in Bandra tomorrow 12:30 to 3:30, some walking, I get cold in AC'
          }
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          onClick={useText}
          disabled={!draft.trim() || !!busy}
          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" /> {connected ? 'Send to agent' : 'Fill the form from this text'}
        </button>
      </div>

      {busy && (
        <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}
        </p>
      )}
      {err && <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{err}</p>}
    </section>
  );
}
