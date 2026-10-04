import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Car,
  Footprints,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { VenueRecord, SearchResult } from '../types';

interface DestinationSearchProps {
  selectedVenue: VenueRecord | null;
  onSelectVenue: (venue: VenueRecord) => void;
  departureTime: string;
  setDepartureTime: (time: string) => void;
  returnTime: string;
  setReturnTime: (time: string) => void;
  occasion: string;
  setOccasion: (occ: string) => void;
  expectedOutdoorWalking: 'minimal' | 'moderate' | 'extended';
  setExpectedOutdoorWalking: (walk: 'minimal' | 'moderate' | 'extended') => void;
  onGenerate: () => void;
  isLoading: boolean;
  allVenues: VenueRecord[];
}

export const DestinationSearch: React.FC<DestinationSearchProps> = ({
  selectedVenue,
  onSelectVenue,
  departureTime,
  setDepartureTime,
  returnTime,
  setReturnTime,
  occasion,
  setOccasion,
  expectedOutdoorWalking,
  setExpectedOutdoorWalking,
  onGenerate,
  isLoading,
  allVenues,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced Search or Place-Type lookup
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/destinations/search?q=${encodeURIComponent(searchInput.trim())}`);
        if (res.ok) {
          const data: SearchResult = await res.json();
          setSearchResult(data);
        }
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSelectSuggestion = (venue: VenueRecord) => {
    onSelectVenue(venue);
    setSearchInput(venue.name);
    setSearchResult(null);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-7 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
          <Car className="w-3.5 h-3.5 text-amber-600" />
          <span>Mumbai Car-Outing Planner</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Where is she heading in Mumbai?
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Enter an exact restaurant name or a place type (e.g. &quot;Italian&quot;, &quot;Seafood&quot;, &quot;Mediterranean brunch&quot;). If ambiguous, OutingFit asks for venue confirmation before producing location-specific advice.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700">
          Exact Destination or Place Type
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="e.g. The Bombay Canteen, Olive Bandra, Italian in BKC, Seafood, Wasabi..."
            className="w-full text-sm text-slate-900 bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-2xl p-3.5 pl-11 pr-24 focus:outline-hidden focus:ring-4 focus:ring-slate-900/5 transition-all font-medium placeholder:text-slate-400"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />

          {selectedVenue && (
            <span className="absolute right-3.5 top-2.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Venue Selected
            </span>
          )}
        </div>

        {/* Quick Place Type Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-medium text-slate-400">Quick suggestions:</span>
          {['The Bombay Canteen', 'Olive Bandra', 'Wasabi Taj Colaba', 'Cecconi’s Juhu', 'Italian in BKC', 'Coastal Seafood'].map(
            (tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSearchInput(tag)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                {tag}
              </button>
            )
          )}
        </div>
      </div>

      {/* Disambiguation / Suggestions Drawer */}
      {searchResult && searchResult.suggestions.length > 0 && !selectedVenue && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>
                {searchResult.isPlaceType
                  ? 'Select Specific Restaurant for Location-Specific Advice:'
                  : searchResult.isAmbiguous
                  ? 'Multiple Matching Venues Found — Please Select One:'
                  : 'Matching Reputed Venue:'}
              </span>
            </div>
            <span className="text-[11px] text-amber-800/80 font-medium">
              {searchResult.suggestions.length} options
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {searchResult.suggestions.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => handleSelectSuggestion(venue)}
                className="bg-white hover:bg-slate-50 border border-amber-200/90 rounded-xl p-3 text-left transition-all hover:border-slate-800 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-amber-700 transition-colors">
                    {venue.name}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 shrink-0" />
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{venue.neighborhood}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                  <span className={venue.valetAvailable ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    Valet: {venue.valetAvailable ? 'Yes' : 'No'}
                  </span>
                  <span>·</span>
                  <span className={venue.coveredDropOff ? 'text-blue-700 font-semibold' : 'text-amber-700'}>
                    Drop-off: {venue.coveredDropOff ? 'Covered' : 'Uncovered'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Venue Verification Banner */}
      {selectedVenue && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{selectedVenue.name}</h3>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Registry
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{selectedVenue.neighborhood}</span>
                <span>·</span>
                <span className="text-slate-500">{selectedVenue.reputationNote}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectVenue(null as any);
                setSearchInput('');
              }}
              className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer shrink-0"
            >
              Change Venue
            </button>
          </div>

          {/* Verified Evidence Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
            <div className="bg-white border border-slate-200/80 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Valet Parking</span>
              <span className={`font-bold ${selectedVenue.valetAvailable ? 'text-emerald-700' : 'text-rose-700'}`}>
                {selectedVenue.valetAvailable ? 'Verified Available' : 'No Valet on Premise'}
              </span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Covered Drop-off</span>
              <span className={`font-bold ${selectedVenue.coveredDropOff ? 'text-blue-700' : 'text-amber-700'}`}>
                {selectedVenue.coveredDropOff ? 'Covered Portico' : 'Uncovered Curbside'}
              </span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Verified Dress Code</span>
              <span className="font-semibold text-slate-800 truncate block" title={selectedVenue.dressCode}>
                {selectedVenue.dressCode.split('.')[0]}
              </span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Indoor AC Temp</span>
              <span className="font-semibold text-slate-800">
                {selectedVenue.indoorAcDegree}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Schedule, Occasion & Walking Modifiers */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
        {/* Departure Time */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Departure Time
          </label>
          <select
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
          >
            <option value="12:00 PM">12:00 PM (Midday Sun Start)</option>
            <option value="12:30 PM">12:30 PM (Peak Sun Lunch)</option>
            <option value="01:30 PM">01:30 PM (Late Lunch)</option>
            <option value="04:30 PM">04:30 PM (High Tea & Golden Hour)</option>
            <option value="07:30 PM">07:30 PM (Evening Dinner)</option>
            <option value="08:30 PM">08:30 PM (Night Dining & Drinks)</option>
          </select>
        </div>

        {/* Return Time */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            Return Time
          </label>
          <select
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
          >
            <option value="03:00 PM">03:00 PM (Sun still active)</option>
            <option value="03:30 PM">03:30 PM (Mid-afternoon)</option>
            <option value="05:30 PM">05:30 PM (Evening cooling)</option>
            <option value="07:00 PM">07:00 PM (Sunset / Post-tea)</option>
            <option value="11:00 PM">11:00 PM (Night return)</option>
            <option value="11:45 PM">11:45 PM (Late night return)</option>
          </select>
        </div>

        {/* Occasion */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Occasion
          </label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
          >
            <option value="Casual Lunch">Casual Lunch</option>
            <option value="Sunday Brunch">Sunday Brunch with Friends</option>
            <option value="Business Meeting / Lunch">Business Meeting & Dining</option>
            <option value="Romantic Date Dinner">Romantic Date Dinner</option>
            <option value="Celebration Dinner">Celebration & Fine Dining</option>
            <option value="High Tea & Dessert">High Tea & Pastries</option>
          </select>
        </div>

        {/* Expected Outdoor Walking */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Footprints className="w-3.5 h-3.5 text-purple-600" />
            Outdoor Walking
          </label>
          <select
            value={expectedOutdoorWalking}
            onChange={(e) => setExpectedOutdoorWalking(e.target.value as any)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
          >
            <option value="minimal">Minimal (Car-to-Door / Valet only)</option>
            <option value="moderate">Moderate (Short 5m walk from lot)</option>
            <option value="extended">Extended (Compound or street walk)</option>
          </select>
        </div>
      </div>

      {/* Generate Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isLoading}
          className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Synthesizing Wear, Carry, and Check Cards via Gemma...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate Wear, Carry & Check Advice for Her</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
