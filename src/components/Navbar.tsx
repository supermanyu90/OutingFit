import React from 'react';
import { Compass, CloudSun, ShieldAlert, Cpu, Sparkles, Car, Activity } from 'lucide-react';
import { WeatherEvidence } from '../types';

interface NavbarProps {
  currentTab: 'discover' | 'planner' | 'scenarios' | 'waterlogging';
  setCurrentTab: (tab: 'discover' | 'planner' | 'scenarios' | 'waterlogging') => void;
  weather: WeatherEvidence | null;
  onOpenModelDocs: () => void;
  onOpenTelemetry: () => void;
  modelIdentifier: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  weather,
  onOpenModelDocs,
  onOpenTelemetry,
  modelIdentifier,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Zone */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('discover')}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-md shadow-slate-900/10 group-hover:bg-amber-600 transition-colors">
                <Car className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 font-display block leading-none">
                  OutingFit
                </span>
                <span className="text-[11px] font-semibold text-slate-500 tracking-wide">
                  Mumbai Car-Outing Stylist
                </span>
              </div>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
            <button
              onClick={() => setCurrentTab('discover')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'discover'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              Discover (SerpApi)
            </button>
            <button
              onClick={() => setCurrentTab('planner')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentTab === 'planner'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3-Card Outing Strategy
            </button>
            <button
              onClick={() => setCurrentTab('scenarios')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'scenarios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Sunny vs. Rainy Demo
            </button>
            <button
              onClick={() => setCurrentTab('waterlogging')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'waterlogging'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Waterlogging Monitor
            </button>
          </nav>

          {/* Right Action & Model Tag */}
          <div className="flex items-center gap-2.5">
            {weather && (
              <div className="hidden sm:flex items-center gap-2 bg-amber-50/80 border border-amber-200/60 rounded-xl px-2.5 py-1 text-xs">
                <span className="font-semibold text-amber-950 tabular-nums">
                  {weather.temperatureC}°C
                </span>
                <span className="text-amber-800/60">·</span>
                <span className="text-amber-800 text-[11px]">
                  UV {weather.uvIndex}
                </span>
                <span className="text-amber-800/60">·</span>
                <span className="text-amber-800 text-[11px] font-medium">
                  {weather.humidityPercent}% Hum
                </span>
              </div>
            )}

            <button
              onClick={onOpenTelemetry}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-950 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer border border-indigo-200"
              title="Inspect Sentry Agent Tracing & Failure Diagnostics"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold text-[11px] hidden sm:inline">Sentry Traces</span>
            </button>

            <button
              onClick={onOpenModelDocs}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200"
              title="Inspect Central Gemma Model & Provider Adapter"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-mono text-[11px] hidden sm:inline">{modelIdentifier.split('/')[1] || 'Gemma-4-31B'}</span>
              <span className="sm:hidden font-mono text-[11px]">Gemma</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-1.5 px-2 bg-white">
        <button
          onClick={() => setCurrentTab('discover')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
            currentTab === 'discover' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'
          }`}
        >
          Discover
        </button>
        <button
          onClick={() => setCurrentTab('planner')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
            currentTab === 'planner' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'
          }`}
        >
          3-Card Strategy
        </button>
        <button
          onClick={() => setCurrentTab('scenarios')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md flex items-center gap-1 ${
            currentTab === 'scenarios' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'
          }`}
        >
          Demo
        </button>
        <button
          onClick={() => setCurrentTab('waterlogging')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md flex items-center gap-1 ${
            currentTab === 'waterlogging' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'
          }`}
        >
          Waterlogging
        </button>
      </div>
    </header>
  );
};
function Spark1(props: any) {
  return <Sparkles {...props} />;
}
