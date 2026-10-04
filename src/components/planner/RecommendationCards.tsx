import React, { useEffect, useState } from 'react';
import { Shirt, Briefcase, ClipboardCheck, Info, Check, Cpu } from 'lucide-react';
import type { OutingResult } from '../../api';
import { Language, t } from '../../i18n';

type CardItem = OutingResult['cards']['wear'][number];
type Evidence = CardItem['evidence'][number];

const FIELD: Record<string, string> = {
  feels_like_max: 'feels like',
  temperature_max: 'temp',
  humidity_max: 'humidity',
  uv_index_max_hourly: 'UV (hourly max)',
  uv_index_max_daily: 'UV (daily max)',
  rain_probability_max: 'rain chance',
  precipitation_total: 'rain amount',
  precipitation_max_hourly: 'heaviest hour',
  gust_max: 'gusts',
  wind_max: 'wind',
};

function evidenceChip(e: Evidence): { text: string; kind: string } {
  switch (e.kind) {
    case 'weather':
      return {
        kind: 'weather',
        text: `${FIELD[e.field] ?? e.field} ${e.value}${e.unit}${e.at ? ` at ${e.at.slice(11, 16)}` : ''}${e.threshold !== undefined ? ` (rule ≥ ${e.threshold}${e.unit})` : ''}`,
      };
    case 'weather_time':
      return { kind: 'weather', text: `${e.field} ${e.value}` };
    case 'preference':
      return { kind: 'preference', text: `you said: ${e.field.replace(/_/g, ' ')} = ${e.value.replace(/_/g, ' ')}` };
    case 'venue':
      return { kind: 'venue', text: `venue ${e.field.replace(/_/g, ' ')}: ${e.value}${e.confirmed ? '' : ' (unconfirmed)'}` };
    case 'status':
      return { kind: 'status', text: `${e.field}: ${e.value}` };
  }
}

const CHIP: Record<string, string> = {
  weather: 'bg-sky-50 text-sky-900 border-sky-200',
  preference: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  venue: 'bg-amber-50 text-amber-900 border-amber-200',
  status: 'bg-slate-100 text-slate-700 border-slate-200',
};

const PRIORITY: Record<CardItem['priority'], string> = {
  essential: 'bg-rose-600 text-white',
  recommended: 'bg-slate-900 text-white',
  optional: 'bg-slate-200 text-slate-700',
  info: 'bg-slate-100 text-slate-500',
};

function Item({ item, lang, owned, onOwned }: { item: CardItem; lang: Language; owned: boolean; onOwned: (v: boolean) => void }) {
  return (
    <li className={`rounded-xl border p-3 space-y-1.5 ${owned ? 'border-emerald-300/80 bg-emerald-50/60 backdrop-blur-sm' : 'glass-subtle'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${PRIORITY[item.priority]}`}>{item.priority}</span>
      </div>
      {item.explanation && <p className="text-xs text-slate-700 leading-relaxed">{item.explanation}</p>}
      <div className="flex flex-wrap gap-1" aria-label={t('because', lang)}>
        {item.evidence.map((e, i) => {
          const c = evidenceChip(e);
          return (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${CHIP[c.kind]}`}>
              {c.text}
            </span>
          );
        })}
      </div>
      {item.productNote && (
        <p className="text-[11px] text-slate-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0" /> {item.productNote}
        </p>
      )}
      {item.ownable && (
        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={owned} onChange={(e) => onOwned(e.target.checked)} className="accent-emerald-700" />
          {owned ? (
            <span className="text-emerald-800 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> {t('owned', lang)}
            </span>
          ) : (
            t('alreadyOwn', lang)
          )}
        </label>
      )}
    </li>
  );
}

const OWNED_KEY = 'outingfit.owned';

export function RecommendationCards({ result }: { result: OutingResult }) {
  const lang = result.request.language;
  const [owned, setOwned] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(OWNED_KEY) || '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
    } catch {}
  }, [owned]);

  const cards: Array<{ key: 'wear' | 'carry' | 'check'; icon: React.ReactNode }> = [
    { key: 'wear', icon: <Shirt className="w-4 h-4" /> },
    { key: 'carry', icon: <Briefcase className="w-4 h-4" /> },
    { key: 'check', icon: <ClipboardCheck className="w-4 h-4" /> },
  ];
  const toBuy = [...result.cards.carry, ...result.cards.wear].filter((i) => i.ownable && !owned[i.id] && i.priority !== 'info');

  return (
    <section className="space-y-3" aria-label="Recommendations">
      {result.outfitSummary && <p className="text-sm text-slate-800 glass rounded-2xl px-4 py-3">{result.outfitSummary}</p>}
      {!result.gemma.used && (
        <p className="text-xs bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-3 py-2">
          Gemma did not return validated text ({result.gemma.error}). Items below are the rule engine's own wording, in English.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {cards.map(({ key, icon }) => (
          <div key={key} className="glass rounded-2xl p-3 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              {icon} {t(key, lang)}
            </h3>
            {result.cards[key].length === 0 ? (
              <p className="text-xs text-slate-500">Nothing specific for this outing.</p>
            ) : (
              <ul className="space-y-2">
                {result.cards[key].map((it) => (
                  <Item key={it.id} item={it} lang={lang} owned={!!owned[it.id]} onOwned={(v) => setOwned((o) => ({ ...o, [it.id]: v }))} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {toBuy.length > 0 && (
        <p className="text-[11px] text-slate-600">
          Not marked as owned: {toBuy.map((i) => i.title).join(' · ')}. Tick "{t('alreadyOwn', lang)}" for anything you already have — OutingFit never needs you to buy something new.
        </p>
      )}
      <p className="text-[10px] text-slate-400 flex items-center gap-1">
        <Cpu className="w-3 h-3" />
        Items and priorities: OutingFit decision rules. Wording: {result.gemma.used ? `Gemma (${result.gemma.model} via ${result.gemma.runtime}, ${result.gemma.latencyMs} ms, output validated${result.gemma.validation.retried ? ' after one retry' : ''})` : 'rule engine (Gemma unavailable)'}.
      </p>
    </section>
  );
}
