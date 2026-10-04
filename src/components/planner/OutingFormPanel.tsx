import React, { useEffect, useState } from 'react';
import { MapPin, Search, CheckCircle2, AlertTriangle, Loader2, CalendarCheck, Sparkles } from 'lucide-react';
import type { OutingForm } from '../../../shared/outingSession';
import { Language, t } from '../../i18n';

interface Props {
  form: OutingForm;
  language: Language;
  ready: { ready: boolean; missing: string[] };
  loading: boolean;
  onUpdate: (patch: Partial<OutingForm>) => void;
  onResolve: (q: string) => void;
  onChoose: (id: string) => void;
  onConfirmSchedule: () => void;
  onSubmit: () => void;
}

const field = 'w-full rounded-xl glass-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';
const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

function humanDate(date: string) {
  if (!date) return '';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function OutingFormPanel({ form, language, ready, loading, onUpdate, onResolve, onChoose, onConfirmSchedule, onSubmit }: Props) {
  const [query, setQuery] = useState(form.destinationQuery);
  useEffect(() => setQuery(form.destinationQuery), [form.destinationQuery]);

  // Times/dates picked directly in the form are explicit, so they count as confirmed.
  const setSchedule = (patch: Partial<OutingForm>) => onUpdate({ ...patch, scheduleConfirmed: true, scheduleNotes: [] });
  const returnsNextDay = form.departure && form.return && form.return <= form.departure;

  return (
    <section className="glass rounded-2xl p-4 space-y-4" aria-label="Outing details">
      {/* Destination */}
      <div>
        <label htmlFor="dest" className={label}>
          Destination (venue or Mumbai locality)
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onResolve(query);
          }}
        >
          <input id="dest" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Bastian, Juhu, Olive Bar & Kitchen" className={field} />
          <button type="submit" disabled={query.trim().length < 2} className="px-3 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40">
            {form.destinationStatus === 'resolving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find
          </button>
        </form>
        {form.destinationStatus === 'ambiguous' && (
          <div className="mt-2 rounded-xl border border-amber-300/80 bg-amber-50/70 backdrop-blur-sm p-3 space-y-2" role="group" aria-label="Choose the destination">
            <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {form.destinationMessage}
            </p>
            {form.candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => onChoose(c.id)}
                className="w-full text-left rounded-lg glass-subtle hover:border-amber-500 px-3 py-2 cursor-pointer"
              >
                <span className="block text-sm font-semibold text-slate-900">{c.destination.name}</span>
                <span className="block text-[11px] text-slate-500">{c.subtitle}</span>
              </button>
            ))}
          </div>
        )}
        {form.destinationStatus === 'not_found' && <p className="mt-2 text-xs text-rose-700">{form.destinationMessage}</p>}
        {form.destination && (
          <p className="mt-2 text-xs text-emerald-800 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>{form.destination.name}</strong> · forecast point {form.destination.forecastPoint.label} ({form.destination.forecastPoint.lat.toFixed(3)},{' '}
              {form.destination.forecastPoint.lon.toFixed(3)})
            </span>
          </p>
        )}
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="date" className={label}>
            Date
          </label>
          <input id="date" type="date" value={form.date} onChange={(e) => setSchedule({ date: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="dep" className={label}>
            Departure (Mumbai time)
          </label>
          <input id="dep" type="time" value={form.departure} onChange={(e) => setSchedule({ departure: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="ret" className={label}>
            Expected return
          </label>
          <input id="ret" type="time" value={form.return} onChange={(e) => setSchedule({ return: e.target.value })} className={field} />
          {returnsNextDay && <p className="text-[10px] text-slate-500 mt-1">Returns the next day</p>}
        </div>
      </div>

      {!form.scheduleConfirmed && form.date && form.departure && form.return && (
        <div className="rounded-xl border border-sky-300/80 bg-sky-50/70 backdrop-blur-sm p-3 space-y-2">
          <p className="text-xs text-sky-950">
            Please confirm: <strong>{humanDate(form.date)}</strong>, leaving <strong>{form.departure}</strong>, back by <strong>{form.return}</strong>
            {returnsNextDay ? ' (next day)' : ''} — Asia/Kolkata.
          </p>
          {form.scheduleNotes.map((n, i) => (
            <p key={i} className="text-[11px] text-amber-900 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {n}
            </p>
          ))}
          <button onClick={onConfirmSchedule} className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <CalendarCheck className="w-3.5 h-3.5" /> These are correct
          </button>
        </div>
      )}

      {/* Exposure & travel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="exposure" className={label}>
            Time outdoors
          </label>
          <select id="exposure" value={form.outdoorExposure} onChange={(e) => onUpdate({ outdoorExposure: e.target.value as any })} className={field}>
            <option value="minimal">Minimal — just getting in and out</option>
            <option value="moderate">Moderate — some walking (up to ~30 min)</option>
            <option value="extended">Extended — longer outdoors</option>
          </select>
        </div>
        <div>
          <label htmlFor="transport" className={label}>
            Travel
          </label>
          <select id="transport" value={form.transport} onChange={(e) => onUpdate({ transport: e.target.value as any })} className={field}>
            <option value="car">Car / taxi</option>
            <option value="public_transport">Train / bus / metro</option>
            <option value="walk">Walking</option>
          </select>
        </div>
        {form.outdoorExposure !== 'minimal' && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ostart" className={label}>
                Outdoors from (optional)
              </label>
              <input id="ostart" type="time" value={form.outdoorStart} onChange={(e) => onUpdate({ outdoorStart: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="oend" className={label}>
                Outdoors until (optional)
              </label>
              <input id="oend" type="time" value={form.outdoorEnd} onChange={(e) => onUpdate({ outdoorEnd: e.target.value })} className={field} />
            </div>
          </div>
        )}
        {form.transport === 'car' && (
          <div>
            <label htmlFor="dropoff" className={label}>
              Covered drop-off at the entrance?
            </label>
            <select id="dropoff" value={form.coveredDropOff} onChange={(e) => onUpdate({ coveredDropOff: e.target.value as any })} className={field}>
              <option value="unknown">Not sure</option>
              <option value="yes">Yes, confirmed</option>
              <option value="no">No</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="setting" className={label}>
            Venue setting
          </label>
          <select id="setting" value={form.venueSetting} onChange={(e) => onUpdate({ venueSetting: e.target.value as any })} className={field}>
            <option value="unknown">Not sure</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="mixed">Both</option>
          </select>
        </div>
      </div>

      {/* Comfort & style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ac" className={label}>
            Air-conditioning at the venue
          </label>
          <select id="ac" value={form.indoorAc} onChange={(e) => onUpdate({ indoorAc: e.target.value as any })} className={field}>
            <option value="unknown">Not sure</option>
            <option value="user_expects">I expect AC</option>
            <option value="confirmed">Venue confirmed AC</option>
            <option value="none">No AC</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-800 sm:mt-6 cursor-pointer">
          <input type="checkbox" checked={form.feelsColdInAc} onChange={(e) => onUpdate({ feelsColdInAc: e.target.checked })} className="w-4 h-4 accent-slate-900" />
          I feel cold in air-conditioning
        </label>
        <div>
          <label htmlFor="occasion" className={label}>
            Occasion
          </label>
          <input id="occasion" value={form.occasion} onChange={(e) => onUpdate({ occasion: e.target.value })} placeholder="e.g. birthday dinner" className={field} />
        </div>
        <div>
          <label htmlFor="formality" className={label}>
            Dress level
          </label>
          <select id="formality" value={form.formality} onChange={(e) => onUpdate({ formality: e.target.value as any })} className={field}>
            <option value="unknown">Not specified</option>
            <option value="casual">Casual</option>
            <option value="smart_casual">Smart casual</option>
            <option value="formal">Formal</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="colour" className={label}>
            Colour preference (optional — comfort comes first)
          </label>
          <input id="colour" value={form.colourPreference} onChange={(e) => onUpdate({ colourPreference: e.target.value })} placeholder="e.g. pastels" className={field} />
        </div>
      </div>

      <div className="pt-1 space-y-2">
        <button
          onClick={onSubmit}
          disabled={!ready.ready || loading}
          className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t('getAdvice', language)}
        </button>
        {!ready.ready ? (
          <p className="text-[11px] text-slate-500">Still needed: {ready.missing.join(', ')}</p>
        ) : (
          <p className="text-[11px] text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready — weather is fetched only now, for the confirmed place and times.
          </p>
        )}
      </div>
    </section>
  );
}
