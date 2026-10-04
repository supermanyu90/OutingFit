import React from 'react';
import { Sun, CloudRain, Snowflake, Languages, ServerCrash, FlaskConical } from 'lucide-react';
import type { OutingForm } from '../../../shared/outingSession';
import type { Language } from '../../i18n';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  weather: string;
  /** Destination text to resolve, plus form fields to apply. */
  destinationQuery?: string;
  pickCandidate?: string;
  form?: Partial<OutingForm>;
  /** Free text (any language) to run through the transcript → Gemma extraction path. */
  utterance?: { text: string; language: Language };
  autoRun: boolean;
}

export function buildScenarios(today: string, tomorrow: string, nowTime: string): Scenario[] {
  const dayFor = (start: string) => (start > nowTime ? today : tomorrow);
  return [
    {
      id: 'sunny',
      title: '1 · Sunny afternoon, lots of time outdoors',
      description: 'Juhu, 13:00–17:00, walking outdoors 13:30–16:30. Uses a labelled clear-sky fixture so the result is reproducible.',
      icon: <Sun className="w-4 h-4 text-amber-600" />,
      weather: 'FIXTURE (UV peaks at 9, feels like 39°C)',
      destinationQuery: 'Juhu',
      form: {
        date: dayFor('13:00'),
        departure: '13:00',
        return: '17:00',
        scheduleConfirmed: true,
        outdoorExposure: 'extended',
        outdoorStart: '13:30',
        outdoorEnd: '16:30',
        transport: 'car',
        coveredDropOff: 'no',
        venueSetting: 'outdoor',
        occasion: 'Beach walk with friends',
        formality: 'casual',
        weatherFixture: 'sunny_afternoon',
        fault: undefined,
      },
      autoRun: true,
    },
    {
      id: 'rainy',
      title: '2 · Humid, rainy evening, short car-to-entrance walk',
      description: 'The Bombay Canteen, 19:30–22:30, car, uncovered drop-off, minimal walking. Labelled rain fixture plus a DEMO waterlogging report.',
      icon: <CloudRain className="w-4 h-4 text-sky-700" />,
      weather: 'FIXTURE (85% rain chance, 6.2 mm/h, gusts 46 km/h)',
      destinationQuery: 'Bombay Canteen',
      form: {
        date: dayFor('19:30'),
        departure: '19:30',
        return: '22:30',
        scheduleConfirmed: true,
        outdoorExposure: 'minimal',
        transport: 'car',
        coveredDropOff: 'no',
        venueSetting: 'indoor',
        occasion: 'Dinner with family',
        formality: 'smart_casual',
        weatherFixture: 'humid_rainy_evening',
        fault: undefined,
      },
      autoRun: true,
    },
    {
      id: 'ac',
      title: '3 · Indoor dinner, I feel cold in AC',
      description: 'Bastian – At The Top (Dadar), 20:00–23:00, user expects AC and feels cold in it. Live weather.',
      icon: <Snowflake className="w-4 h-4 text-cyan-700" />,
      weather: 'LIVE Open-Meteo forecast',
      destinationQuery: 'Bastian At The Top',
      form: {
        date: dayFor('20:00'),
        departure: '20:00',
        return: '23:00',
        scheduleConfirmed: true,
        outdoorExposure: 'minimal',
        transport: 'car',
        coveredDropOff: 'unknown',
        venueSetting: 'indoor',
        indoorAc: 'user_expects',
        feelsColdInAc: true,
        occasion: 'Anniversary dinner',
        formality: 'smart_casual',
        weatherFixture: undefined,
        fault: undefined,
      },
      autoRun: true,
    },
    {
      id: 'ambiguous',
      title: '4 · Hindi request with an ambiguous venue',
      description:
        '"कल शाम सात बजे बास्टियन जाना है, ग्यारह बजे तक लौटूँगी, मुझे AC में ठंड लगती है" — "Bastian" has two branches and "कल" can mean yesterday or tomorrow, so both must be confirmed before weather is fetched. For the voice version, use Dictate or Talk in Hindi.',
      icon: <Languages className="w-4 h-4 text-violet-700" />,
      weather: 'LIVE (after you confirm)',
      utterance: { text: 'कल शाम सात बजे बास्टियन जाना है, ग्यारह बजे तक लौटूँगी, मुझे AC में ठंड लगती है', language: 'hi' },
      autoRun: false,
    },
    {
      id: 'failure',
      title: '5 · Weather provider failure',
      description:
        'Forces the Open-Meteo call to fail. If a forecast for this place was fetched in the last 3 hours it is shown as STALE; otherwise weather is marked unavailable and no weather-based advice is given.',
      icon: <ServerCrash className="w-4 h-4 text-rose-700" />,
      weather: 'Simulated outage',
      destinationQuery: 'Colaba',
      form: {
        date: dayFor('18:00'),
        departure: '18:00',
        return: '21:00',
        scheduleConfirmed: true,
        outdoorExposure: 'moderate',
        transport: 'car',
        coveredDropOff: 'unknown',
        venueSetting: 'mixed',
        occasion: 'Evening stroll and dinner',
        formality: 'casual',
        weatherFixture: undefined,
        fault: 'weather_down',
      },
      autoRun: true,
    },
  ];
}

export function ScenarioLab({ scenarios, onRun, running }: { scenarios: Scenario[]; onRun: (s: Scenario) => void; running: string | null }) {
  return (
    <section className="space-y-3" aria-label="Test scenarios">
      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <FlaskConical className="w-4 h-4 text-violet-700" /> Clearly labelled test scenarios. Each one fills in the planner and runs the real pipeline: weather, decision rules, Gemma and the spoken summary.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scenarios.map((s) => (
          <div key={s.id} className="glass rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              {s.icon} {s.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
            <p className="text-[11px] text-slate-500">Weather: {s.weather}</p>
            <button
              onClick={() => onRun(s)}
              disabled={!!running}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {running === s.id ? 'Running…' : 'Run scenario'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
