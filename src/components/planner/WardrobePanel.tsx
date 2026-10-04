import React, { useEffect, useState } from 'react';
import { Shirt, Check, AlertTriangle, Layers, Loader2 } from 'lucide-react';
import type { OutingResult } from '../../api';
import { t } from '../../i18n';

type Wardrobe = OutingResult['wardrobe'];
type Level = Wardrobe['formality'];

const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart_casual', label: 'Smart casual' },
  { value: 'formal', label: 'Formal' },
];

const OWNED_KEY = 'outingfit.owned.wardrobe';

export function WardrobePanel({
  wardrobe,
  language,
  loading,
  onChangeFormality,
}: {
  wardrobe: Wardrobe;
  language: OutingResult['request']['language'];
  loading: boolean;
  onChangeFormality: (level: Level) => void;
}) {
  const [family, setFamily] = useState<string>('all');
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
  useEffect(() => {
    if (family !== 'all' && !wardrobe.families.some((f) => f.family === family)) setFamily('all');
  }, [wardrobe]);

  const shown = wardrobe.families.filter((f) => family === 'all' || f.family === family);

  return (
    <section className="glass rounded-2xl p-4 space-y-3" aria-label="Wardrobe ideas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Shirt className="w-4 h-4 text-amber-600" /> Wardrobe ideas
        </h3>
        <div className="flex items-center gap-1 glass-pill rounded-lg p-0.5" role="radiogroup" aria-label="Dress level">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              role="radio"
              aria-checked={wardrobe.formality === l.value}
              disabled={loading}
              onClick={() => wardrobe.formality !== l.value && onChangeFormality(l.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer disabled:cursor-wait ${
                wardrobe.formality === l.value ? 'bg-white/90 text-slate-900 shadow-xs ring-1 ring-white' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              {l.label}
            </button>
          ))}
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 mx-1" />}
        </div>
      </div>
      <p className="text-[11px] text-slate-600">
        {wardrobe.formalityNote} {wardrobe.inclusiveNote}
      </p>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Garment families">
        {[{ family: 'all', label: 'All' }, ...wardrobe.families.map((f) => ({ family: f.family, label: f.label }))].map((f) => (
          <button
            key={f.family}
            role="tab"
            aria-selected={family === f.family}
            onClick={() => setFamily(f.family)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
              family === f.family ? 'bg-slate-900/90 text-white border-slate-900' : 'glass-subtle text-slate-700 hover:bg-white/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.map((f) => (
        <div key={f.family} className="space-y-2">
          {family === 'all' && <h4 className="text-xs font-bold text-slate-700">{f.label}</h4>}
          <ul className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
            {f.ideas.map((idea) => (
              <li key={idea.id} className={`rounded-xl border p-3 space-y-1.5 ${owned[idea.id] ? 'border-emerald-300/80 bg-emerald-50/60 backdrop-blur-sm' : 'glass-subtle'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-snug" lang={language}>
                    {idea.name}
                    {language !== 'en' && <span className="block text-[11px] font-normal text-slate-500">{idea.nameEn}</span>}
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                      idea.fit === 'good' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {idea.fit === 'good' ? 'Good fit' : 'With care'}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{idea.pieces}</p>
                <ul className="space-y-0.5">
                  {idea.reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-emerald-900 flex items-start gap-1">
                      <Check className="w-3 h-3 mt-0.5 shrink-0" /> {r.text}
                    </li>
                  ))}
                  {idea.cautions.map((c, i) => (
                    <li key={`c${i}`} className="text-[11px] text-amber-900 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {c.text}
                    </li>
                  ))}
                  {idea.layer && (
                    <li className="text-[11px] text-sky-900 flex items-start gap-1">
                      <Layers className="w-3 h-3 mt-0.5 shrink-0" /> For the AC: {idea.layer}
                    </li>
                  )}
                </ul>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer w-fit">
                  <input type="checkbox" checked={!!owned[idea.id]} onChange={(e) => setOwned((o) => ({ ...o, [idea.id]: e.target.checked }))} className="accent-emerald-700" />
                  {owned[idea.id] ? <span className="text-emerald-800 font-semibold">{t('owned', language)}</span> : t('alreadyOwn', language)}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[10px] text-slate-400">
        Outfit ideas are chosen by OutingFit's rules from the same weather and preferences as the cards above. No brands or products are recommended — use what you already have.
      </p>
    </section>
  );
}
