import React from 'react';
import { Waves, HelpCircle } from 'lucide-react';
import type { OutingResult } from '../../api';

/** Waterlogging is shown separately from rain: a rain forecast cannot establish road flooding. */
export function WaterloggingPanel({ status }: { status: OutingResult['waterlogging'] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2" aria-label="Waterlogging status">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <Waves className="w-4 h-4 text-sky-700" /> Waterlogging (separate from the rain forecast)
      </h3>
      {status.status === 'unknown' ? (
        <p className="text-xs text-slate-700 flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
          <span>
            <strong>Local waterlogging status unknown.</strong> {status.message.replace(/^Local waterlogging status unknown\.\s*/, '')}
          </span>
        </p>
      ) : (
        <>
          <p className="text-xs text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5">{status.message}</p>
          <ul className="space-y-1.5">
            {status.reports.map((r, i) => (
              <li key={i} className="text-xs text-slate-800 border border-slate-200 rounded-lg px-3 py-2">
                <strong>{r.location}</strong> — {r.description}
                <span className="block text-[11px] text-slate-500">
                  Source: {r.source} · reported {r.ageMinutes} min ago ({new Date(r.reportedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST)
                  {r.isDemo ? ' · DEMO' : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
