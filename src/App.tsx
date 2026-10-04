import React, { useState, useEffect } from 'react';
import {
  Car,
  Sun,
  CloudRain,
  Sparkles,
  ShieldAlert,
  Cpu,
  BookOpen,
  Info,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { DestinationSearch } from './components/DestinationSearch';
import { ThreeCardsDisplay } from './components/ThreeCardsDisplay';
import { ScenarioDemo } from './components/ScenarioDemo';
import { WaterloggingAdvisory } from './components/WaterloggingAdvisory';
import { ModelDocsModal } from './components/ModelDocsModal';
import { SerpApiDiscovery } from './components/SerpApiDiscovery';
import { TelemetryModal } from './components/TelemetryModal';
import {
  VenueRecord,
  WeatherEvidence,
  WaterloggingEvidence,
  WaterloggingSpot,
  RecommendationResponse,
  ScenarioDemoData,
  ProviderDocumentation,
  DiscoveredDestination,
} from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'discover' | 'planner' | 'scenarios' | 'waterlogging'>('discover');
  const [allVenues, setAllVenues] = useState<VenueRecord[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);

  // User input parameters
  const [departureTime, setDepartureTime] = useState('12:30 PM');
  const [returnTime, setReturnTime] = useState('03:30 PM');
  const [occasion, setOccasion] = useState('Casual Lunch');
  const [expectedOutdoorWalking, setExpectedOutdoorWalking] = useState<'minimal' | 'moderate' | 'extended'>('minimal');
  const [simulatedScenarioKey, setSimulatedScenarioKey] = useState<'sunny_lunch' | 'rainy_dinner' | undefined>(undefined);
  const [simulatedFailureKey, setSimulatedFailureKey] = useState<'weather' | 'inference' | undefined>(undefined);

  // Recommendations and evidence state
  const [recommendationData, setRecommendationData] = useState<RecommendationResponse | null>(null);
  const [weatherEvidence, setWeatherEvidence] = useState<WeatherEvidence | null>(null);
  const [waterloggingEvidence, setWaterloggingEvidence] = useState<WaterloggingEvidence | null>(null);
  const [waterloggingSpots, setWaterloggingSpots] = useState<WaterloggingSpot[]>([]);
  const [mandatoryDisclaimer, setMandatoryDisclaimer] = useState<string>('');
  const [demoData, setDemoData] = useState<ScenarioDemoData | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderDocumentation | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isModelDocsOpen, setIsModelDocsOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  // Fetch initial registry & metadata
  useEffect(() => {
    const initData = async () => {
      try {
        const [venuesRes, wlRes, provRes, demoRes] = await Promise.all([
          fetch('/api/destinations'),
          fetch('/api/waterlogging'),
          fetch('/api/provider-info'),
          fetch('/api/scenarios/demo'),
        ]);

        if (venuesRes.ok) {
          const venues: VenueRecord[] = await venuesRes.json();
          setAllVenues(venues);
          if (venues.length > 0) {
            setSelectedVenue(venues[1]); // Default to Olive Bar & Kitchen (Bandra)
          }
        }

        if (wlRes.ok) {
          const wl = await wlRes.json();
          setWaterloggingSpots(wl.alerts || []);
          setMandatoryDisclaimer(wl.mandatoryUnknownsNotice || '');
        }

        if (provRes.ok) {
          const prov = await provRes.json();
          setProviderInfo(prov);
        }

        if (demoRes.ok) {
          const demo = await demoRes.json();
          setDemoData(demo);
        }
      } catch (err) {
        console.warn('Initial data load error:', err);
      }
    };

    initData();
  }, []);

  // Generate Recommendations via Gemma
  const handleGenerate = async (overrideParams?: {
    venue?: VenueRecord;
    depTime?: string;
    retTime?: string;
    scenarioKey?: 'sunny_lunch' | 'rainy_dinner';
    simulateFailure?: 'weather' | 'inference';
  }) => {
    const venueToUse = overrideParams?.venue || selectedVenue || allVenues[0];
    if (!venueToUse) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId: venueToUse.id,
          departureTime: overrideParams?.depTime || departureTime,
          returnTime: overrideParams?.retTime || returnTime,
          occasion,
          expectedOutdoorWalking,
          simulatedWeatherScenario: overrideParams?.scenarioKey !== undefined ? overrideParams.scenarioKey : simulatedScenarioKey,
          simulateFailure: overrideParams?.simulateFailure !== undefined ? overrideParams.simulateFailure : simulatedFailureKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRecommendationData(data.recommendation);
        setWeatherEvidence(data.weatherEvidence);
        setWaterloggingEvidence(data.waterloggingEvidence);
      }
    } catch (err) {
      console.error('Failed to generate recommendation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger initial recommendation once venue is ready
  useEffect(() => {
    if (selectedVenue && !recommendationData) {
      handleGenerate();
    }
  }, [selectedVenue]);

  // Handle Scenario Demo apply
  const handleApplyScenarioFromDemo = (
    venue: VenueRecord,
    depTime: string,
    retTime: string,
    scenarioKey: 'sunny_lunch' | 'rainy_dinner'
  ) => {
    setSelectedVenue(venue);
    setDepartureTime(depTime);
    setReturnTime(retTime);
    setSimulatedScenarioKey(scenarioKey);
    setCurrentTab('planner');
    handleGenerate({ venue, depTime, retTime, scenarioKey });
  };

  // Handle Venue Selected from SerpApi Discovery
  const handleSelectDiscoveredVenue = (discovered: DiscoveredDestination) => {
    const venueRecord: VenueRecord = {
      id: discovered.id,
      name: discovered.name,
      aliases: [discovered.name.toLowerCase()],
      placeTypes: discovered.cuisineTypes,
      neighborhood: discovered.neighborhood,
      reputationNote: `${discovered.reviewProvenance[0]?.rating || 4.4}★ (${discovered.reviewProvenance[0]?.reviewCount || 500} verified reviews via ${discovered.reviewProvenance[0]?.platform || 'Google Maps'}). ${discovered.priceTier}`,
      isVerified: discovered.amenities.valetParking.status === 'verified_official',
      valetAvailable: discovered.amenities.valetParking.status === 'verified_official',
      valetDetails: discovered.amenities.valetParking.details,
      coveredDropOff: discovered.amenities.coveredEntrance.status === 'verified_official',
      dropOffWalkMinutes: discovered.amenities.coveredEntrance.status === 'verified_official' ? 0 : 2,
      dropOffNote: discovered.amenities.coveredEntrance.details,
      dressCode: discovered.amenities.dressCodePolicy.details,
      isIndoor: discovered.amenities.indoorAirConditioning.status === 'verified_official',
      indoorAcDegree: '20°C typical indoor AC',
      sunExposureLevel: 'partial',
      waterloggingProneNearby: ['Subways along transit route to ' + discovered.neighborhood],
      sourceCitation: discovered.reviewProvenance[0]?.sourceUrl || discovered.officialWebsiteUrl || 'SerpApi Verified Evidence Feed',
      sourceTimestamp: new Date().toISOString(),
    };

    setSelectedVenue(venueRecord);
    setCurrentTab('planner');
    handleGenerate({ venue: venueRecord });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E293B] flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        weather={weatherEvidence}
        onOpenModelDocs={() => setIsModelDocsOpen(true)}
        onOpenTelemetry={() => setIsTelemetryOpen(true)}
        modelIdentifier={providerInfo?.modelIdentifier || 'models/gemma-4-31b-it'}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scenario Quick-Bar Ribbon */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Quick Demonstrations:</span>
              <span className="text-xs text-slate-500 hidden md:inline">
                Compare how advice shifts between weather conditions:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const olive = allVenues.find((v) => v.id === 'olive-bandra') || allVenues[1];
                  setSimulatedFailureKey(undefined);
                  handleApplyScenarioFromDemo(olive, '12:30 PM', '03:30 PM', 'sunny_lunch');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  simulatedScenarioKey === 'sunny_lunch' && !simulatedFailureKey
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                    : 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200/70'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>Sunny Outdoor Lunch (Olive Bandra)</span>
              </button>

              <button
                onClick={() => {
                  const canteen = allVenues.find((v) => v.id === 'bombay-canteen') || allVenues[0];
                  setSimulatedFailureKey(undefined);
                  handleApplyScenarioFromDemo(canteen, '07:30 PM', '11:00 PM', 'rainy_dinner');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  simulatedScenarioKey === 'rainy_dinner' && !simulatedFailureKey
                    ? 'bg-indigo-100 text-indigo-900 border-indigo-300 shadow-2xs'
                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 border-indigo-200/70'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5 text-indigo-600" />
                <span>Rainy Indoor Dinner (Bombay Canteen)</span>
              </button>
            </div>
          </div>

          {/* Dependency Failure Verification Controls */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Verification Checklist: Test Graceful Dependency Failure Handling</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setSimulatedFailureKey('weather');
                  handleGenerate({ simulateFailure: 'weather' });
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                  simulatedFailureKey === 'weather'
                    ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                    : 'bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border-slate-200'
                }`}
                title="Test how the system behaves when the live weather station fails"
              >
                Test Weather Station Failure
              </button>

              <button
                onClick={() => {
                  setSimulatedFailureKey('inference');
                  handleGenerate({ simulateFailure: 'inference' });
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                  simulatedFailureKey === 'inference'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                    : 'bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200'
                }`}
                title="Test how the system behaves when the LLM provider exceeds the 8s SLA"
              >
                Test Inference SLA Timeout
              </button>

              <button
                onClick={() => setIsTelemetryOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-300 shadow-2xs flex items-center gap-1"
                title="Inspect Sentry Agent Tracing & Reproducible Failure Evidence"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sentry Diagnostics & Failure Evidence</span>
              </button>

              {simulatedFailureKey && (
                <button
                  onClick={() => {
                    setSimulatedFailureKey(undefined);
                    handleGenerate({ simulateFailure: undefined });
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 underline cursor-pointer"
                >
                  Reset Live
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab 0: SerpApi Destination Discovery */}
        {currentTab === 'discover' && (
          <SerpApiDiscovery
            onSelectDiscoveredVenue={handleSelectDiscoveredVenue}
          />
        )}

        {/* Tab 1: Outing Planner & Three Cards */}
        {currentTab === 'planner' && (
          <div className="space-y-6">
            {/* Input Form with Venue Disambiguation */}
            <DestinationSearch
              selectedVenue={selectedVenue}
              onSelectVenue={(v) => {
                setSelectedVenue(v);
                setSimulatedScenarioKey(undefined);
              }}
              departureTime={departureTime}
              setDepartureTime={setDepartureTime}
              returnTime={returnTime}
              setReturnTime={setReturnTime}
              occasion={occasion}
              setOccasion={setOccasion}
              expectedOutdoorWalking={expectedOutdoorWalking}
              setExpectedOutdoorWalking={setExpectedOutdoorWalking}
              onGenerate={() => handleGenerate()}
              isLoading={isLoading}
              allVenues={allVenues}
            />

            {/* The 3 Core Output Cards (Wear, Carry, Check) */}
            {recommendationData && selectedVenue && weatherEvidence && waterloggingEvidence && (
              <ThreeCardsDisplay
                data={recommendationData}
                venue={selectedVenue}
                weather={weatherEvidence}
                waterlogging={waterloggingEvidence}
                onOpenModelDocs={() => setIsModelDocsOpen(true)}
              />
            )}
          </div>
        )}

        {/* Tab 2: Comparative Demonstration Vertical Slice */}
        {currentTab === 'scenarios' && (
          <ScenarioDemo
            demoData={demoData}
            onApplyScenario={handleApplyScenarioFromDemo}
          />
        )}

        {/* Tab 3: Waterlogging Monitor & Route Guardrails */}
        {currentTab === 'waterlogging' && (
          <WaterloggingAdvisory
            spots={waterloggingSpots}
            mandatoryDisclaimer={mandatoryDisclaimer}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center">
            <Car className="w-4 h-4 text-slate-800" />
            <span className="font-bold text-slate-900 font-display">OutingFit</span>
            <span>·</span>
            <span>Grounded in Gemma 4 31B (models/gemma-4-31b-it) & Verified Mumbai Municipal Logs</span>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={() => setIsModelDocsOpen(true)}
              className="text-amber-800 hover:text-amber-950 font-semibold cursor-pointer underline"
            >
              Model Verification & Adapter Docs
            </button>
            <span>·</span>
            <span>Missing reports never imply a clear route</span>
          </div>
        </div>
      </footer>

      {/* Gemma Model & Provider Documentation Modal */}
      <ModelDocsModal
        isOpen={isModelDocsOpen}
        onClose={() => setIsModelDocsOpen(false)}
        providerInfo={providerInfo}
      />

      {/* Sentry Telemetry & Failure Diagnosis Modal */}
      <TelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />
    </div>
  );
}
