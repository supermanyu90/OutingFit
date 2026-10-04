import React, { useState } from 'react';
import {
  Sun,
  CloudRain,
  ArrowRight,
  Shirt,
  Luggage,
  CheckCircle,
  Car,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ScenarioDemoData, VenueRecord } from '../types';

interface ScenarioDemoProps {
  demoData: ScenarioDemoData | null;
  onApplyScenario: (venue: VenueRecord, departureTime: string, returnTime: string, scenarioKey: 'sunny_lunch' | 'rainy_dinner') => void;
}

export const ScenarioDemo: React.FC<ScenarioDemoProps> = ({ demoData, onApplyScenario }) => {
  const [selectedScenario, setSelectedScenario] = useState<'both' | 'sunny' | 'rainy'>('both');

  if (!demoData) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-3"></div>
        <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
      </div>
    );
  }

  const { sunnyLunch, rainyDinner } = demoData;

  return (
    <div className="space-y-6">
      {/* Title & Introduction Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Comparative Demonstration (Working Vertical Slice)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Sunny Outdoor Lunch vs. Rainy Indoor Dinner
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Observe how Gemma dynamically shifts recommendations for fabric weight, sleeve coverage, footwear traction, accessories, valet drop-off, and waterlogging safety based on physical evidence.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setSelectedScenario('both')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedScenario === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setSelectedScenario('sunny')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                selectedScenario === 'sunny' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              Sunny Lunch
            </button>
            <button
              onClick={() => setSelectedScenario('rainy')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                selectedScenario === 'rainy' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
              Rainy Dinner
            </button>
          </div>
        </div>

        {/* The Core Shift Explainer */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3">
            <strong className="text-amber-950 block font-bold mb-1">Wear Shift</strong>
            <p className="text-amber-900 text-[11px] leading-relaxed">
              Solar-reflective ivory linen & long-sleeve UV coverage shifts to deep midnight-navy crepe with water-resistant rubber-sole footwear and an indoor AC pashmina.
            </p>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3">
            <strong className="text-blue-950 block font-bold mb-1">Carry Shift</strong>
            <p className="text-blue-900 text-[11px] leading-relaxed">
              Polarized UV sunglasses, SPF 50+, and windshield sunshade shift to compact windproof umbrella, phone waterproof pouch, and oil-blotting sheets.
            </p>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3">
            <strong className="text-emerald-950 block font-bold mb-1">Check Shift</strong>
            <p className="text-emerald-900 text-[11px] leading-relaxed">
              Open cobblestone courtyard with no car portico shifts to a fully covered Kamala Mills vehicular porch + active alerts for Hindmata / Parel TT waterlogging.
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-Side or Individual Comparison Cards */}
      <div className={`grid gap-6 ${selectedScenario === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* ========================================================================= */}
        {/* SCENARIO A: SUNNY OUTDOOR LUNCH */}
        {/* ========================================================================= */}
        {(selectedScenario === 'both' || selectedScenario === 'sunny') && (
          <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-600" />
                  Scenario A: Sunny Outdoor Lunch
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-display mt-1">
                  {sunnyLunch.venue.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {sunnyLunch.venue.neighborhood} · {sunnyLunch.schedule.departureTime} to {sunnyLunch.schedule.returnTime}
                </p>
              </div>

              <button
                onClick={() =>
                  onApplyScenario(
                    sunnyLunch.venue,
                    sunnyLunch.schedule.departureTime,
                    sunnyLunch.schedule.returnTime,
                    'sunny_lunch'
                  )
                }
                className="text-xs px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <span>Load in Planner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Weather Metrics */}
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-3 grid grid-cols-3 gap-2 text-xs text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Temperature</span>
                <strong className="text-slate-900 text-sm">{sunnyLunch.weather.temperatureC}°C</strong>
                <span className="text-[10px] text-amber-700 block">Feels {sunnyLunch.weather.feelsLikeC}°C</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">UV Index</span>
                <strong className="text-amber-700 text-sm font-bold">{sunnyLunch.weather.uvIndex} / 10</strong>
                <span className="text-[10px] text-rose-700 block font-semibold">Extreme Sun</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Rain Probability</span>
                <strong className="text-slate-900 text-sm">{sunnyLunch.weather.rainProbability}%</strong>
                <span className="text-[10px] text-slate-500 block">Dry & Sunny</span>
              </div>
            </div>

            {/* 1. Wear Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Shirt className="w-3.5 h-3.5 text-amber-600" />
                1. Wear Recommendation
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-800">Fabrics:</span>{' '}
                  <span className="text-emerald-800 font-medium">
                    {sunnyLunch.recommendation.cards.wear.fabric.recommended.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Coverage:</span>{' '}
                  <span className="text-slate-600">
                    {sunnyLunch.recommendation.cards.wear.coverageAndFit.summary}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Footwear:</span>{' '}
                  <span className="text-slate-600">
                    {sunnyLunch.recommendation.cards.wear.footwear.recommendation}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Carry Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Luggage className="w-3.5 h-3.5 text-blue-600" />
                2. Carry Checklist
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                {sunnyLunch.recommendation.cards.carry.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-700">
                    <span className="font-medium">• {item.name}</span>
                    <span className="text-[10px] text-amber-800 font-semibold uppercase">{item.priority}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Check Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                3. Check Verification
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                <div>
                  <span className="font-semibold text-slate-800">Parking / Valet:</span>{' '}
                  <span className="text-emerald-700 font-semibold">{sunnyLunch.venue.valetDetails}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Drop-off:</span>{' '}
                  <span className="text-amber-800">{sunnyLunch.venue.dropOffNote}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Dress Code:</span>{' '}
                  <span className="text-slate-700">{sunnyLunch.venue.dressCode}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCENARIO B: RAINY INDOOR DINNER */}
        {/* ========================================================================= */}
        {(selectedScenario === 'both' || selectedScenario === 'rainy') && (
          <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-sm p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-indigo-600" />
                  Scenario B: Rainy Indoor Dinner
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-display mt-1">
                  {rainyDinner.venue.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {rainyDinner.venue.neighborhood} · {rainyDinner.schedule.departureTime} to {rainyDinner.schedule.returnTime}
                </p>
              </div>

              <button
                onClick={() =>
                  onApplyScenario(
                    rainyDinner.venue,
                    rainyDinner.schedule.departureTime,
                    rainyDinner.schedule.returnTime,
                    'rainy_dinner'
                  )
                }
                className="text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <span>Load in Planner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Weather Metrics */}
            <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-2xl p-3 grid grid-cols-3 gap-2 text-xs text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Temperature</span>
                <strong className="text-slate-900 text-sm">{rainyDinner.weather.temperatureC}°C</strong>
                <span className="text-[10px] text-slate-500 block">Feels {rainyDinner.weather.feelsLikeC}°C</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Humidity</span>
                <strong className="text-blue-900 text-sm font-bold">{rainyDinner.weather.humidityPercent}%</strong>
                <span className="text-[10px] text-blue-700 block font-semibold">High Moisture</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Rain Probability</span>
                <strong className="text-indigo-700 text-sm font-bold">{rainyDinner.weather.rainProbability}%</strong>
                <span className="text-[10px] text-rose-700 block font-semibold">Monsoon Downpour</span>
              </div>
            </div>

            {/* 1. Wear Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Shirt className="w-3.5 h-3.5 text-indigo-600" />
                1. Wear Recommendation
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-800">Fabrics:</span>{' '}
                  <span className="text-indigo-900 font-medium">
                    {rainyDinner.recommendation.cards.wear.fabric.recommended.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Footwear:</span>{' '}
                  <span className="text-slate-700">
                    {rainyDinner.recommendation.cards.wear.footwear.recommendation}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">AC Layer:</span>{' '}
                  <span className="text-slate-600">
                    {rainyDinner.recommendation.cards.wear.optionalLayers.item}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Carry Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Luggage className="w-3.5 h-3.5 text-blue-600" />
                2. Carry Checklist
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                {rainyDinner.recommendation.cards.carry.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-700">
                    <span className="font-medium">• {item.name}</span>
                    <span className="text-[9px] text-indigo-800 font-semibold uppercase">{item.priority}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Check Summary */}
            <div className="space-y-1 text-xs">
              <strong className="text-slate-900 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                3. Check Verification
              </strong>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                <div>
                  <span className="font-semibold text-slate-800">Parking / Valet:</span>{' '}
                  <span className="text-emerald-700 font-semibold">{rainyDinner.venue.valetDetails}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Drop-off:</span>{' '}
                  <span className="text-blue-800 font-semibold">{rainyDinner.venue.dropOffNote}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Waterlogging Alerts:</span>{' '}
                  <span className="text-rose-700 font-semibold">Hindmata & Parel TT monitored</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
