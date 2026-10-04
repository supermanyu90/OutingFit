import React from 'react';
import { CloudSun, AlertTriangle, FlaskConical, Clock, MapPin, Sunrise, Sunset } from 'lucide-react';
import type { OutingResult } from '../../api';

type W = OutingResult['weather'];
type Num = number | null | undefined;

const fmt = (v: Num, unit: string, digits = 0) => (v === null || v === undefined ? 'unavailable' : `${digits ? v.toFixed(digits) : Math.round(v * 10) / 10}${unit}`);
const hhmm = (local?: string | null) => (local ? local.slice(11, 16) : '—');

function istTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
}

const STATUS_STYLE: Record<W['dataStatus'], { label: string; cls: string }> = {
  live: { label: 'Live forecast', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  cached: { label: 'Cached forecast', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  stale: { label: 'STALE — not live', cls: 'bg-amber-100 text-amber-900 border-amber-400' },
  unavailable: { label: 'Unavailable', cls: 'bg-rose-100 text-rose-900 border-rose-300' },
  fixture: { label: 'TEST FIXTURE — not live', cls: 'bg-violet-100 text-violet-900 border-violet-300' },
};

export function WeatherPanel({ weather }: { weather: W }) {
  const o = weather.outing;
  const st = STATUS_STYLE[weather.dataStatus];
  const rows: Array<{ label: string; valid: string; t: Num; f: Num; h: Num; p: Num; mm: Num; mmLabel: string; uv: Num; w: Num; g: Num; c: Num; fMin?: Num }> = [];
  if (o?.departure)
    rows.push({ label: 'Departure', valid: `${hhmm(o.departure.time)}–${String(Number(hhmm(o.departure.time).slice(0, 2)) + 1).padStart(2, '0')}:00`, t: o.departure.temperatureC, f: o.departure.feelsLikeC, h: o.departure.humidityPct, p: o.departure.rainProbabilityPct, mm: o.departure.precipitationMm, mmLabel: 'that hour', uv: o.departure.uvIndex, w: o.departure.windKmh, g: o.departure.gustKmh, c: o.departure.cloudCoverPct });
  if (o?.outdoor?.period.source === 'user' && o.outdoor.aggregate) {
    const a = o.outdoor.aggregate;
    rows.push({ label: 'Outdoor period', valid: `${hhmm(a.from)}–${hhmm(a.to)} (max)`, t: a.temperatureMaxC, f: a.feelsLikeMaxC, h: a.humidityMaxPct, p: a.rainProbabilityMaxPct, mm: a.precipitationTotalMm, mmLabel: 'total', uv: a.uvIndexMaxHourly, w: a.windMaxKmh, g: a.gustMaxKmh, c: a.cloudCoverMeanPct });
  }
  if (o?.return)
    rows.push({ label: 'Return', valid: `${hhmm(o.return.time)} hour`, t: o.return.temperatureC, f: o.return.feelsLikeC, h: o.return.humidityPct, p: o.return.rainProbabilityPct, mm: o.return.precipitationMm, mmLabel: 'that hour', uv: o.return.uvIndex, w: o.return.windKmh, g: o.return.gustKmh, c: o.return.cloudCoverPct });
  if (o?.whole) {
    const a = o.whole;
    rows.push({ label: 'Whole outing', valid: `${hhmm(a.from)}–${hhmm(a.to)} (max; cloud = mean)`, t: a.temperatureMaxC, f: a.feelsLikeMaxC, h: a.humidityMaxPct, p: a.rainProbabilityMaxPct, mm: a.precipitationTotalMm, mmLabel: 'total', uv: a.uvIndexMaxHourly, w: a.windMaxKmh, g: a.gustMaxKmh, c: a.cloudCoverMeanPct });
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3" aria-label="Weather for your outing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <CloudSun className="w-4 h-4 text-amber-600" /> Weather for the outing window
        </h3>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
      </div>

      {weather.fixtureLabel && (
        <p className="text-xs bg-violet-50 border border-violet-200 text-violet-900 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> {weather.fixtureLabel}
        </p>
      )}
      {weather.notice && (
        <p className="text-xs bg-amber-50 border border-amber-300 text-amber-950 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {weather.notice}
        </p>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <div className="flex gap-1">
          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
          <dt className="font-semibold">Forecast location:</dt>
          <dd>
            {weather.location.label}
            {weather.location.gridLat !== undefined && ` — model grid point ${weather.location.gridLat.toFixed(3)}, ${weather.location.gridLon!.toFixed(3)}`}
          </dd>
        </div>
        <div className="flex gap-1">
          <Clock className="w-3 h-3 mt-0.5 shrink-0" />
          <dt className="font-semibold">Retrieved:</dt>
          <dd>
            {istTime(weather.retrievedAt)}
            {weather.cacheAgeSeconds ? ` (${Math.round(weather.cacheAgeSeconds / 60)} min ago, cached)` : ''}
          </dd>
        </div>
        {o && (
          <div className="flex gap-1">
            <dt className="font-semibold">Outing window:</dt>
            <dd>
              {o.window.start.replace('T', ' ')} → {o.window.end.replace('T', ' ')} Asia/Kolkata
            </dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt className="font-semibold">Provider:</dt>
          <dd>
            {weather.dataStatus === 'fixture' ? (
              'Test fixture in Open-Meteo format (no provider data)'
            ) : (
              <>
                <a href={weather.provider.attributionUrl} target="_blank" rel="noreferrer" className="underline">
                  {weather.provider.attribution}
                </a>{' '}
                ({weather.provider.licence}) · hourly forecast
              </>
            )}
          </dd>
        </div>
      </dl>

      {rows.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] text-left min-w-[640px]">
            <caption className="sr-only">Forecast values for the outing</caption>
            <thead className="text-slate-500">
              <tr>
                <th className="px-1 py-1 font-semibold">Forecast for</th>
                <th className="px-1 py-1 font-semibold">Temp</th>
                <th className="px-1 py-1 font-semibold">Feels like</th>
                <th className="px-1 py-1 font-semibold">Humidity</th>
                <th className="px-1 py-1 font-semibold">Rain chance</th>
                <th className="px-1 py-1 font-semibold">Rain amount</th>
                <th className="px-1 py-1 font-semibold">UV (hourly)</th>
                <th className="px-1 py-1 font-semibold">Wind</th>
                <th className="px-1 py-1 font-semibold">Gusts</th>
                <th className="px-1 py-1 font-semibold">Cloud</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100">
                  <th scope="row" className="px-1 py-1.5 font-semibold text-slate-800">
                    {r.label}
                    <span className="block font-normal text-slate-500">{r.valid}</span>
                  </th>
                  <td className="px-1">{fmt(r.t, '°C')}</td>
                  <td className="px-1">{fmt(r.f, '°C')}</td>
                  <td className="px-1">{fmt(r.h, '%')}</td>
                  <td className="px-1">{fmt(r.p, '%')}</td>
                  <td className="px-1">
                    {fmt(r.mm, ' mm')} <span className="text-slate-400">{r.mm !== null && r.mm !== undefined ? r.mmLabel : ''}</span>
                  </td>
                  <td className="px-1">{fmt(r.uv, '')}</td>
                  <td className="px-1">{fmt(r.w, ' km/h')}</td>
                  <td className="px-1">{fmt(r.g, ' km/h')}</td>
                  <td className="px-1">{fmt(r.c, '%')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {o?.daily && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
          <span className="flex items-center gap-1">
            <Sunrise className="w-3.5 h-3.5 text-amber-600" /> Sunrise {hhmm(o.daily.sunrise)}
          </span>
          <span className="flex items-center gap-1">
            <Sunset className="w-3.5 h-3.5 text-orange-600" /> Sunset {hhmm(o.daily.sunset)}
          </span>
          <span>
            Daily maximum UV: {fmt(o.daily.uvIndexMaxDaily, '')} <span className="text-slate-400">(whole day — the table shows UV for your hours)</span>
          </span>
        </div>
      )}

      {o?.current && (
        <p className="text-[11px] text-slate-600 border-t border-slate-100 pt-2">
          <strong>Right now</strong> (model estimate valid {hhmm(o.current.validTime)} IST, 15-minute data — not a station observation): {fmt(o.current.temperatureC, '°C')}, feels like{' '}
          {fmt(o.current.feelsLikeC, '°C')}, humidity {fmt(o.current.humidityPct, '%')}, UV {fmt(o.current.uvIndex, '')}, wind {fmt(o.current.windKmh, ' km/h')}.
        </p>
      )}

      {weather.warnings.length > 0 && <p className="text-[11px] text-amber-800">Data checks: {weather.warnings.join('; ')}</p>}
      <p className="text-[10px] text-slate-400">{weather.provider.resolutionNote}</p>
    </section>
  );
}
