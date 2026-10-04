import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Square, Play, Loader2 } from 'lucide-react';
import { api, OutingResult, AppStatus } from '../../api';
import { t } from '../../i18n';

/**
 * Plays the backend's validated spoken summary through ElevenLabs TTS. The
 * server only voices summaries it generated, so audio always matches the text
 * shown here.
 */
export function SpokenSummary({ result, status, textOnly, autoPlay }: { result: OutingResult; status: AppStatus | null; textOnly: boolean; autoPlay: boolean }) {
  const lang = result.spoken.language;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tts = status?.voice.languages[lang]?.tts;

  const stop = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setState('idle');
  };

  const play = async () => {
    if (!result.spoken.text) return;
    setErr(null);
    stop();
    setState('loading');
    try {
      const blob = await api.speak(result.spoken.text, lang);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = urlRef.current;
      a.muted = muted;
      a.onended = () => setState('idle');
      await a.play();
      setState('playing');
    } catch (e: any) {
      setErr(e.message);
      setState('idle');
    }
  };

  useEffect(() => {
    if (autoPlay && !textOnly && result.spoken.text && tts?.supported) void play();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.generatedAt]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (textOnly) stop();
  }, [textOnly]);

  return (
    <section className="bg-slate-900 text-white rounded-2xl p-4 space-y-2" aria-label={t('spokenSummary', lang)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{t('spokenSummary', lang)}</h3>
        {!textOnly && result.spoken.text && (
          <div className="flex gap-1.5">
            {state === 'playing' ? (
              <button onClick={stop} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                <Square className="w-3 h-3" /> {t('stop', lang)}
              </button>
            ) : (
              <button
                onClick={play}
                disabled={state === 'loading' || !tts?.supported}
                title={tts?.supported ? `ElevenLabs ${tts.model}` : tts?.note}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} {t('play', lang)}
              </button>
            )}
            <button onClick={() => setMuted(!muted)} aria-pressed={muted} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 cursor-pointer">
              {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />} {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        )}
      </div>
      {result.spoken.text ? (
        <p className="text-sm leading-relaxed text-slate-100" lang={lang}>
          {result.spoken.text}
        </p>
      ) : (
        <p className="text-xs text-amber-200">{result.spoken.unavailableReason}</p>
      )}
      <p className="text-[10px] text-slate-400">
        {textOnly
          ? 'Text-only mode: audio is off.'
          : tts?.supported
            ? `Audio: ElevenLabs ${tts.model}. The same text drives the audio and this display.`
            : `Audio unavailable for this language: ${tts?.note ?? 'ElevenLabs not configured'}.`}
      </p>
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
    </section>
  );
}
