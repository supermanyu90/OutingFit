import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, Compass, CalendarClock, FlaskConical, Type, Cpu, Mic } from 'lucide-react';
import { SerpApiDiscovery } from './components/SerpApiDiscovery';
import { VoicePanel } from './components/planner/VoicePanel';
import { OutingFormPanel } from './components/planner/OutingFormPanel';
import { WeatherPanel } from './components/planner/WeatherPanel';
import { RecommendationCards } from './components/planner/RecommendationCards';
import { SpokenSummary } from './components/planner/SpokenSummary';
import { WaterloggingPanel } from './components/planner/WaterloggingPanel';
import { WardrobePanel } from './components/planner/WardrobePanel';
import { ScenarioLab, Scenario, buildScenarios } from './components/planner/ScenarioLab';
import { api, AppStatus } from './api';
import { Language, LANGUAGE_OPTIONS } from './i18n';
import { useOutingSession } from './useOutingSession';
import type { DiscoveredDestination } from './types';

type Tab = 'plan' | 'scenarios' | 'discover';

function addDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('plan');
  const [language, setLanguage] = useState<Language>('en');
  const [textOnly, setTextOnly] = useState(false);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [adviceSource, setAdviceSource] = useState<'ui' | 'agent'>('ui');
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const s = useOutingSession('en');

  useEffect(() => {
    api.status().then(setStatus, (e) => setStatusErr(e.message));
  }, []);

  useEffect(() => {
    s.update({ language });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const submit = useCallback(async () => {
    setAdviceSource('ui');
    await s.getAdvice();
  }, [s]);

  // The agent's client tools: same session, but advice requests are marked as agent-initiated
  // so the page does not also auto-play the summary over the agent's voice.
  const clientTools = useMemo(
    () => ({
      ...s.session.clientTools(),
      get_outing_advice: async () => {
        setAdviceSource('agent');
        return s.getAdvice();
      },
    }),
    [s.session, s.getAdvice]
  );

  const scenarios = useMemo(() => {
    const today = status?.now.date ?? new Date().toISOString().slice(0, 10);
    return buildScenarios(today, addDay(today), status?.now.time ?? '00:00');
  }, [status]);

  async function runScenario(sc: Scenario) {
    setRunningScenario(sc.id);
    setTab('plan');
    try {
      s.setResult(null);
      if (sc.utterance) {
        setLanguage(sc.utterance.language);
        s.update({ ...emptyScenarioFields(), language: sc.utterance.language });
        const p = await api.parse(sc.utterance.text);
        s.applyParse(p);
        if (!p.parsed) s.setError(p.error || 'Gemma could not read the request');
        return;
      }
      s.update({ ...emptyScenarioFields(), ...sc.form, language });
      if (sc.destinationQuery) {
        const r = await s.resolve(sc.destinationQuery);
        if (r?.status === 'ambiguous' && sc.pickCandidate) s.choose(sc.pickCandidate);
      }
      if (sc.autoRun) await submit();
    } finally {
      setRunningScenario(null);
    }
  }

  const caps = status?.voice.languages[language];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E293B] flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <Car className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 font-display block leading-none">OutingFit</span>
              <span className="text-[11px] font-semibold text-slate-500">Mumbai outing planner</span>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl" aria-label="Sections">
            {(
              [
                ['plan', 'Plan', <CalendarClock key="p" className="w-3.5 h-3.5" />],
                ['scenarios', 'Test scenarios', <FlaskConical key="s" className="w-3.5 h-3.5" />],
                ['discover', 'Discover', <Compass key="d" className="w-3.5 h-3.5" />],
              ] as const
            ).map(([k, label, icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-current={tab === k ? 'page' : undefined}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer ${tab === k ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Language + output mode */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1" role="radiogroup" aria-label="Language">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l.code}
                role="radio"
                aria-checked={language === l.code}
                onClick={() => setLanguage(l.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${language === l.code ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {l.native}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} className="w-4 h-4 accent-slate-900" />
            <Type className="w-3.5 h-3.5" /> Text only (no microphone, no audio)
          </label>
        </div>

        {/* Capability disclosure for the selected language */}
        <CapabilityStrip language={language} status={status} statusErr={statusErr} />

        {tab === 'plan' && (
          <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">
            <div className="space-y-5">
              <VoicePanel language={language} status={status} textOnly={textOnly} clientTools={clientTools} onParsed={s.applyParse} spokenSummary={s.result?.spoken.text ?? null} />
              <OutingFormPanel
                form={s.form}
                language={language}
                ready={s.ready}
                loading={s.loading}
                onUpdate={s.update}
                onResolve={(q) => void s.resolve(q)}
                onChoose={s.choose}
                onConfirmSchedule={() => s.confirmSchedule()}
                onSubmit={submit}
              />
            </div>
            <div className="space-y-5 min-w-0">
              {s.error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{s.error}</p>}
              {s.result ? (
                <>
                  {s.result.testFlags.length > 0 && (
                    <p className="text-xs font-semibold text-violet-900 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">{s.result.testFlags.join(' · ')}</p>
                  )}
                  <SpokenSummary result={s.result} status={status} textOnly={textOnly} autoPlay={adviceSource === 'ui'} />
                  <RecommendationCards result={s.result} />
                  {s.result.wardrobe && (
                    <WardrobePanel
                      wardrobe={s.result.wardrobe}
                      language={s.result.request.language}
                      loading={s.loading}
                      onChangeFormality={async (level) => {
                        s.update({ formality: level });
                        setAdviceSource('ui');
                        await s.getAdvice();
                      }}
                    />
                  )}
                  <WeatherPanel weather={s.result.weather} />
                  <WaterloggingPanel status={s.result.waterlogging} />
                </>
              ) : (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
                  Tell OutingFit where and when you're going (talk, dictate, type, or fill the form). Weather is fetched only after the place and times are confirmed.
                  {caps && !caps.agent.supported && caps.agent.supported !== null && (
                    <p className="mt-2 text-xs text-amber-800">Voice conversation is not available in this language: {caps.agent.note}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'scenarios' && <ScenarioLab scenarios={scenarios} onRun={runScenario} running={runningScenario} />}

        {tab === 'discover' && (
          <SerpApiDiscovery
            onSelectDiscoveredVenue={async (d: DiscoveredDestination) => {
              setTab('plan');
              const r = await s.resolve(d.name);
              if (!r || r.status === 'not_found') await s.resolve(d.neighborhood.split(/[(,]/)[0].trim());
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row gap-2 justify-between">
          <span>
            Recommendations: OutingFit decision rules + Gemma ({status?.gemma.primary?.model ?? status?.gemma.fallback?.model ?? '—'}). Voice: ElevenLabs. Weather:{' '}
            <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>{' '}
            (CC BY 4.0). Places: GeoNames.
          </span>
          <span>Rain forecasts never imply road flooding or safe access.</span>
        </div>
      </footer>
    </div>
  );
}

function emptyScenarioFields() {
  return {
    destination: null,
    destinationQuery: '',
    destinationStatus: 'empty' as const,
    candidates: [],
    outdoorStart: '',
    outdoorEnd: '',
    indoorAc: 'unknown' as const,
    feelsColdInAc: false,
    colourPreference: '',
    scheduleNotes: [],
    fault: undefined,
    weatherFixture: undefined,
  };
}

function CapabilityStrip({ language, status, statusErr }: { language: Language; status: AppStatus | null; statusErr: string | null }) {
  if (statusErr) return <p className="text-xs text-rose-700">Could not load service status: {statusErr}</p>;
  if (!status) return null;
  const c = status.voice.languages[language];
  const name = LANGUAGE_OPTIONS.find((l) => l.code === language)?.label;
  const Badge = ({ ok, label, note }: { ok: boolean | null; label: string; note: string }) => (
    <span title={note} className={`px-2 py-1 rounded-lg border text-[11px] ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : ok === null ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
      {ok ? '✓' : ok === null ? '?' : '✗'} {label}
    </span>
  );
  const gemma = status.gemma.primary ?? status.gemma.fallback;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`What works in ${name}`}>
      <span className="text-[11px] font-semibold text-slate-600 mr-1">{name}:</span>
      <Badge ok={!!status.voice.agentConfigured && c.agent.supported !== false ? (c.agent.supported ?? null) : false} label="Voice conversation" note={c.agent.note} />
      <Badge ok={c.stt.supported} label="Dictation" note={c.stt.note} />
      <Badge ok={c.tts.supported} label="Spoken summary" note={c.tts.note} />
      <Badge ok={true} label="Typing" note="Always available" />
      <span className="text-[11px] text-slate-500 ml-2 flex items-center gap-1">
        <Cpu className="w-3 h-3" /> Gemma: {gemma ? `${gemma.model} (${gemma.runtime})` : 'not configured'}
        {status.gemma.primary && status.gemma.fallback ? `, fallback ${status.gemma.fallback.model}` : ''}
      </span>
      {!status.voice.configured && (
        <span className="text-[11px] text-amber-800 flex items-center gap-1">
          <Mic className="w-3 h-3" /> ElevenLabs is not configured — voice features are off; typing works.
        </span>
      )}
    </div>
  );
}
