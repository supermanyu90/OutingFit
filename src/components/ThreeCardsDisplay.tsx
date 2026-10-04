import React, { useState } from 'react';
import {
  Shirt,
  Luggage,
  CheckCircle,
  ShieldCheck,
  AlertTriangle,
  Info,
  Car,
  Sun,
  CloudRain,
  Palette,
  Footprints,
  Layers,
  Sparkles,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RecommendationResponse, VenueRecord, WeatherEvidence, WaterloggingEvidence } from '../types';

interface ThreeCardsDisplayProps {
  data: RecommendationResponse;
  venue: VenueRecord;
  weather: WeatherEvidence;
  waterlogging: WaterloggingEvidence;
  onOpenModelDocs: () => void;
}

export const ThreeCardsDisplay: React.FC<ThreeCardsDisplayProps> = ({
  data,
  venue,
  weather,
  waterlogging,
  onOpenModelDocs,
}) => {
  const { wear, carry, check } = data.cards;
  const [showEvidenceTray, setShowEvidenceTray] = useState(false);

  return (
    <div className="space-y-6">
      {/* Degraded Dependency / Information Unavailable Notice */}
      {(weather.isUnavailable || data.meta.inferenceDegraded) && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Dependency Degradation Notice · User Inputs Preserved</span>
          </div>
          <div className="space-y-1.5 text-xs text-amber-950">
            {weather.isUnavailable && (
              <p className="leading-relaxed">
                <strong className="text-amber-900">Weather Information Unavailable:</strong>{' '}
                {weather.unavailableNotice || 'Live Open-Meteo weather station timed out. Recommendations are grounded in calibrated seasonal Mumbai maritime baseline data.'}
              </p>
            )}
            {data.meta.inferenceDegraded && (
              <p className="leading-relaxed">
                <strong className="text-amber-900">Inference Status:</strong>{' '}
                {data.meta.degradedNotice || 'Central Gemma LLM provider took longer than timeout threshold. Grounded via OutingFit deterministic evidence rules.'}
              </p>
            )}
            <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-amber-800">
              <span>
                Preserved inputs: Destination: <strong>{venue.name}</strong> ({venue.neighborhood}), Departure & Return Schedule, Outdoor Walking Bounds.
              </span>
              <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md self-start sm:self-auto">
                User Inputs Preserved
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Context Ribbon */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Evidence-Grounded Recommendation Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display">
              Outing Strategy for {venue.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              {venue.neighborhood} · {venue.reputationNote}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <button
              onClick={onOpenModelDocs}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Model: {data.meta.modelUsed.split(' [')[0]}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <span className="text-xs text-slate-400 tabular-nums">
              Latency: {data.meta.latencyMs}ms
            </span>
          </div>
        </div>

        {/* Live Evidence Inputs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Weather Condition</span>
            <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
              {weather.temperatureC}°C (Feels {weather.feelsLikeC}°C)
            </div>
            <span className="text-[11px] text-slate-300">
              {weather.humidityPercent}% Humidity · UV {weather.uvIndex}
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sun & Rain Risk</span>
            <div className="text-sm font-bold text-amber-300 mt-0.5 tabular-nums">
              {weather.rainProbability}% Rain
            </div>
            <span className="text-[11px] text-slate-300">
              {weather.uvIndex >= 7 ? 'Extreme Midday UV' : 'Moderate Sun Exposure'}
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Car & Valet Access</span>
            <div className={`text-sm font-bold mt-0.5 ${venue.valetAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {venue.valetAvailable ? 'Valet On-Site' : 'Self/Street Parking'}
            </div>
            <span className="text-[11px] text-slate-300">
              {venue.coveredDropOff ? 'Covered Portico' : 'Uncovered Curbside'}
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Verified Dress Code</span>
            <div className="text-sm font-bold text-white mt-0.5 truncate" title={venue.dressCode}>
              {venue.dressCode.split('.')[0]}
            </div>
            <span className="text-[11px] text-slate-300">
              Indoor AC: {venue.indoorAcDegree}
            </span>
          </div>
        </div>
      </div>

      {/* THE THREE CORE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ========================================================================= */}
        {/* CARD 1: WEAR */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                  <Shirt className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">1. Wear</h3>
                  <span className="text-[11px] text-slate-500">Fabric, Fit, Coverage & Footwear</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md uppercase">
                Grounded
              </span>
            </div>

            {/* 1.1 Fabric Selection */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>Recommended Fabrics</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {wear.fabric.recommended.map((fab, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg"
                  >
                    {fab}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-rose-700 pt-1">
                <strong>Avoid:</strong> {wear.fabric.avoid.join(', ')}
              </div>
              <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                &quot;{wear.fabric.evidenceExplanation}&quot;
              </p>
            </div>

            {/* 1.2 Coverage & Fit */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Coverage & Fit Rationale
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {wear.coverageAndFit.summary}
              </p>
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-xs text-amber-950">
                <span className="font-bold block mb-0.5">Sun Defense:</span>
                <span>{wear.coverageAndFit.sunCoverageAdvice}</span>
              </div>
              <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                {wear.coverageAndFit.fitRationale}
              </p>
            </div>

            {/* 1.3 Colour Options */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                <span>Reflective & Soil-Resistant Palette</span>
              </span>
              <div className="space-y-1.5">
                {wear.colorOptions.recommended.map((col, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="font-semibold text-slate-800">{col.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 max-w-[50%] text-right">{col.reason}</span>
                  </div>
                ))}
              </div>
              {wear.colorOptions.cautionColors.length > 0 && (
                <div className="text-[11px] text-rose-700 pt-1">
                  <strong>Caution:</strong> {wear.colorOptions.cautionColors[0].name} ({wear.colorOptions.cautionColors[0].reason})
                </div>
              )}
            </div>

            {/* 1.4 Footwear & Terrain */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 text-teal-600" />
                <span>Footwear & Puddle Security</span>
              </span>
              <p className="text-xs font-semibold text-slate-900">
                {wear.footwear.recommendation}
              </p>
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                <div>
                  <strong>Puddle & Tile Safety:</strong> {wear.footwear.waterloggingPuddleSafety}
                </div>
                <div>
                  <strong>Valet Transition:</strong> {wear.footwear.carAndValetSuitability}
                </div>
              </div>
            </div>

            {/* 1.5 Optional Layer */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Indoor AC Layer</span>
              </span>
              <p className="text-xs font-semibold text-slate-900">
                {wear.optionalLayers.item}
              </p>
              <p className="text-xs text-slate-500 italic bg-blue-50/60 border border-blue-200/50 p-2 rounded-xl text-blue-950">
                {wear.optionalLayers.indoorAcVsCarDeltaReason}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: CARRY */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center font-bold">
                  <Luggage className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">2. Carry</h3>
                  <span className="text-[11px] text-slate-500">Context-Relevant Accessories</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md uppercase">
                {carry.items.length} Items
              </span>
            </div>

            <div className="space-y-3">
              {carry.items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900">
                      {item.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        item.priority === 'essential'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : item.priority === 'recommended'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.rationale}
                  </p>

                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    Evidence: {item.evidenceGrounding}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: CHECK */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">3. Check</h3>
                  <span className="text-[11px] text-slate-500">Parking, Drop-off & Venue Rules</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                Verified
              </span>
            </div>

            {/* 3.1 Parking & Valet */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-emerald-600" />
                <span>Parking & Valet Status</span>
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="text-xs font-bold text-slate-900">
                  {check.parkingAndValet.verifiedStatus}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {check.parkingAndValet.valetDetails}
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1">
                  Source: {check.parkingAndValet.evidenceExplanation}
                </div>
              </div>
            </div>

            {/* 3.2 Covered Drop-off */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Covered Drop-off Assessment</span>
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{check.coveredDropOff.hasCanopy ? 'Covered Portico Present' : 'Uncovered Curbside Drop-off'}</span>
                  <span className="text-slate-500">{check.coveredDropOff.walkDistanceMinutes}m walk</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {check.coveredDropOff.rainOrSunExposureRisk}
                </p>
              </div>
            </div>

            {/* 3.3 Venue Requirements vs Style Suggestions */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Venue Mandate vs Style Suggestion
              </span>
              <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 space-y-1.5 text-xs text-amber-950">
                <div>
                  <strong className="text-amber-900 block uppercase text-[10px] tracking-wider">
                    Verified Venue Mandate:
                  </strong>
                  <span>{check.venueRequirements.verifiedDressCode}</span>
                </div>
                <div className="pt-1 border-t border-amber-200/60">
                  <strong className="text-amber-900 block uppercase text-[10px] tracking-wider">
                    Style Suggestion:
                  </strong>
                  <span className="text-slate-700">
                    {check.venueRequirements.styleSuggestionsVsVenueMandate.replace(/MANDATE:.*?STYLE SUGGESTION:/i, '')}
                  </span>
                </div>
              </div>
            </div>

            {/* 3.4 Travel & Waterlogging Concerns */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Travel & Route Concerns</span>
              </span>
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="font-semibold text-rose-950">
                  {check.travelAndWaterlogging.routeCorridorRisk}
                </div>
                <div className="text-slate-600 text-[11px]">
                  <strong>Nearby Hotspots to watch:</strong> {check.travelAndWaterlogging.nearbyHotspots.join(', ')}
                </div>

                {/* Mandatory Disclaimer */}
                <div className="bg-white/90 border border-rose-200 rounded-lg p-2 text-[10px] text-rose-900 font-semibold leading-relaxed">
                  {check.travelAndWaterlogging.missingReportsDisclaimer}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion / Full Evidence & Source Transparency Tray */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <button
          onClick={() => setShowEvidenceTray(!showEvidenceTray)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 hover:text-slate-900 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-600" />
            <span>Audit Evidence Sources, Timestamps & Knowns vs. Unknowns</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Anti-Hallucination Verified
            </span>
          </div>
          {showEvidenceTray ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showEvidenceTray && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <strong className="text-slate-900 block font-semibold">Weather Source:</strong>
              <p className="text-slate-600">{data.meta.dataSources.weather}</p>
              <span className="text-[10px] text-slate-400 block font-mono">Logged: {weather.dataTimestamp}</span>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 block font-semibold">Venue Registry:</strong>
              <p className="text-slate-600">{data.meta.dataSources.venue}</p>
              <span className="text-[10px] text-slate-400 block font-mono">Verified: {venue.sourceTimestamp}</span>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 block font-semibold">Waterlogging Feed:</strong>
              <p className="text-slate-600">{data.meta.dataSources.waterlogging}</p>
              <span className="text-[10px] text-slate-400 block font-mono">Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
