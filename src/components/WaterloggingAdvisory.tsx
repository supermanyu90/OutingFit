import React from 'react';
import {
  AlertTriangle,
  Car,
  Clock,
  ShieldAlert,
  Info,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { WaterloggingSpot } from '../types';

interface WaterloggingAdvisoryProps {
  spots: WaterloggingSpot[];
  mandatoryDisclaimer: string;
}

export const WaterloggingAdvisory: React.FC<WaterloggingAdvisoryProps> = ({
  spots,
  mandatoryDisclaimer,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Mumbai Monsoon Waterlogging Monitor</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Car Travel & Route Flooding Intelligence
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
          For someone who finds waterlogging disruptive while traveling by car, Mumbai&apos;s low-lying subways and railway culverts present sudden risks. This feed pairs live municipal monitoring with defensive driving guidelines.
        </p>

        {/* Mandatory Policy Banner */}
        <div className="mt-4 bg-rose-50 border-2 border-rose-200/90 rounded-2xl p-4 text-xs text-rose-950 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-rose-900 uppercase tracking-wider block font-bold text-[11px]">
              Critical System Guardrail:
            </strong>
            <p className="leading-relaxed font-medium">
              {mandatoryDisclaimer}
            </p>
          </div>
        </div>
      </div>

      {/* Monitored Hotspots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {spots.map((spot) => (
          <div
            key={spot.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {spot.name}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    spot.severity === 'severe'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : spot.severity === 'high'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {spot.severity} Risk
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{spot.corridor}</div>

              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {spot.notes}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span className="truncate max-w-[65%]">Source: {spot.source}</span>
              <span className="font-mono">
                {new Date(spot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Instructions Cheat Sheet */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
          <Navigation className="w-4 h-4 text-amber-400" />
          <span>In-Car Driver Protocol (Share with Driver)</span>
        </div>
        <h3 className="text-base font-bold font-display">
          Three Defensive Commands for Mumbai Car Travel in the Rains:
        </h3>
        <ul className="space-y-2 text-xs text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">1.</span>
            <span>
              <strong>Take the Flyover:</strong> Never permit the driver to take the lower ground slip lanes beneath Hindmata or Parel flyovers during active rain.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">2.</span>
            <span>
              <strong>Bypass Subways:</strong> Insist on using the Santacruz Milan Flyover or Linking Road bridge instead of Milan / Khar underpasses.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">3.</span>
            <span>
              <strong>Curbside Positioning:</strong> Instruct driver to pull as flush as possible to the venue awning/curb so your step-out footprint is zero puddle exposure.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
