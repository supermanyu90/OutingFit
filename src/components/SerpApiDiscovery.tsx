import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  MapPin,
  Car,
  CheckCircle2,
  DollarSign,
  Coffee,
  Info,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { DiscoveredDestination, DiscoveryResult, VenueRecord } from '../types';

interface SerpApiDiscoveryProps {
  onSelectDiscoveredVenue: (venue: DiscoveredDestination) => void;
}

export const SerpApiDiscovery: React.FC<SerpApiDiscoveryProps> = ({
  onSelectDiscoveredVenue,
}) => {
  const [searchQuery, setSearchQuery] = useState('a good Italian restaurant in Bandra');
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const [occasionFilter, setOccasionFilter] = useState<string>('Casual Lunch');
  const [comfortFilter, setComfortFilter] = useState<string>('Indoor AC & Valet Priority');
  
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (queryToSearch = searchQuery) => {
    if (!queryToSearch.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/destinations/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSearch.trim(),
          cuisine: 'Italian',
          budget: budgetFilter,
          occasion: occasionFilter,
          comfort: comfortFilter,
        }),
      });
      if (res.ok) {
        const data: DiscoveryResult = await res.json();
        setDiscoveryResult(data);
      }
    } catch (err) {
      console.warn('SerpApi discovery error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial search on mount if not yet executed
  React.useEffect(() => {
    handleSearch('a good Italian restaurant in Bandra');
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Query Engine */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>SerpApi Destination Discovery · Evidence-Based Provenance</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
            Discover Reputed Mumbai Venues with Verified Provenance
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Search naturally for dining options across Mumbai. OutingFit cross-examines review provenance, links official venue sources, and strictly treats parking, valet, covered drop-offs, and dress codes as <strong>unknown</strong> unless supported by official documentation.
          </p>
        </div>

        {/* Search Bar */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Natural Destination Search Query
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. a good Italian restaurant in Bandra, Bastian, Gustoso, coastal seafood..."
                className="w-full text-sm text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-2xl p-3.5 pl-11 pr-4 focus:outline-hidden focus:ring-4 focus:ring-slate-900/5 transition-all font-medium placeholder:text-slate-400"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Searching SerpApi...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Discover Shortlist</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interactive Demonstration Shortcuts */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Required Demonstration Cases:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setSearchQuery('a good Italian restaurant in Bandra');
                handleSearch('a good Italian restaurant in Bandra');
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>1. &quot;A good Italian restaurant in Bandra&quot;</span>
            </button>

            <button
              onClick={() => {
                setSearchQuery('Bastian');
                handleSearch('Bastian');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Demonstrates disambiguation between Bastian Bandra (curbside valet) and Bastian Dadar (48th floor skyscraper)"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>2. Ambiguous Venue Name: &quot;Bastian&quot;</span>
            </button>

            <button
              onClick={() => {
                setSearchQuery('Gustoso');
                handleSearch('Gustoso');
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold border border-purple-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Demonstrates an authentic restaurant where valet, covered entrance, and dress codes are unknown"
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
              <span>3. Incomplete Amenity Info: &quot;Gustoso (Khar)&quot;</span>
            </button>
          </div>
        </div>

        {/* Preference Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Budget Preference
            </label>
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2 font-medium"
            >
              <option value="all">All Budgets (₹₹ to ₹₹₹₹)</option>
              <option value="₹₹ (Moderate)">₹₹ Moderate (~₹1,500 - ₹2,000 for two)</option>
              <option value="₹₹₹ (Upscale)">₹₹₹ Upscale (~₹2,500 - ₹4,000 for two)</option>
              <option value="₹₹₹₹ (Luxury Fine Dining)">₹₹₹₹ Luxury Fine Dining (~₹4,500+ for two)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Occasion
            </label>
            <select
              value={occasionFilter}
              onChange={(e) => setOccasionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2 font-medium"
            >
              <option value="Casual Lunch">Casual Lunch</option>
              <option value="Sunday Brunch">Sunday Brunch with Friends</option>
              <option value="Romantic Date Dinner">Romantic Date Dinner</option>
              <option value="Milestone Celebration">Milestone Celebration</option>
              <option value="Business Lunch">Business Lunch</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Comfort Priority
            </label>
            <select
              value={comfortFilter}
              onChange={(e) => setComfortFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2 font-medium"
            >
              <option value="Indoor AC & Valet Priority">Indoor AC & Valet Priority</option>
              <option value="Covered Drop-off Critical (Rain / Sun)">Covered Drop-off Critical (Rain / Sun)</option>
              <option value="Outdoor Courtyard Shade">Outdoor Courtyard Shade</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ambiguity Alert Banner (if query is ambiguous like "Bastian") */}
      {discoveryResult && discoveryResult.isAmbiguous && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Ambiguous Venue Name Detected — Choice Required</span>
          </div>
          <p className="text-xs text-amber-950 font-medium leading-relaxed">
            {discoveryResult.ambiguityNotice}
          </p>
          <div className="text-[11px] text-amber-800 italic">
            Each branch has distinct parking accommodations, dress requirements, and route waterlogging corridors. Compare the two locations below before choosing.
          </div>
        </div>
      )}

      {/* Discovery Shortlist Cards */}
      {discoveryResult && discoveryResult.shortlist.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold text-slate-800">
              Found {discoveryResult.shortlist.length} Curated Dining Options for &quot;{discoveryResult.query}&quot;
            </span>
            <span className="font-mono text-[11px]">
              Source: {discoveryResult.dataSource}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {discoveryResult.shortlist.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900 font-display">
                        {item.name}
                      </h3>
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.priceTier}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{item.address}</span>
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {item.cuisineTypes.map((c, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium text-indigo-800 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Links & CTA */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {item.officialWebsiteUrl && (
                      <a
                        href={item.officialWebsiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors inline-flex items-center gap-1"
                      >
                        <span>Official Website</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <a
                      href={item.mapListingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Google Listing</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => onSelectDiscoveredVenue(item)}
                      className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all inline-flex items-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer"
                    >
                      <span>Select Venue & Plan Outing</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>

                {/* Review Provenance Section */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Review Provenance & Evidence Basis</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {item.reviewProvenance.map((rev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{rev.platform}</span>
                          {rev.rating && (
                            <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                              {rev.rating} ★ {rev.reviewCount ? `(${rev.reviewCount.toLocaleString()} reviews)` : ''}
                            </span>
                          )}
                        </div>
                        {rev.excerpt && (
                          <p className="text-slate-600 text-[11px] leading-relaxed italic">
                            &quot;{rev.excerpt}&quot;
                          </p>
                        )}
                        <span className="text-[10px] text-slate-400 block pt-0.5">
                          Verified: {new Date(rev.sourceTimestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Match Reasons for Her Brief */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Why This Matches Her Preferences
                  </span>
                  <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-2xl p-3.5 text-xs text-indigo-950 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <strong className="block text-indigo-900 text-[11px]">Cuisine Alignment:</strong>
                      <span>{item.matchReasons.cuisineFit}</span>
                    </div>
                    <div>
                      <strong className="block text-indigo-900 text-[11px]">Budget Match:</strong>
                      <span>{item.matchReasons.budgetFit}</span>
                    </div>
                    <div>
                      <strong className="block text-indigo-900 text-[11px]">Occasion Fit:</strong>
                      <span>{item.matchReasons.occasionFit}</span>
                    </div>
                    <div>
                      <strong className="block text-indigo-900 text-[11px]">Comfort & Setting:</strong>
                      <span>{item.matchReasons.comfortFit}</span>
                    </div>
                  </div>
                </div>

                {/* Amenity Verification Grid (Strict Unknown Attribution) */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between">
                    <span>Amenity Verification Status</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Strict Policy: Unknown unless verified by official sources
                    </span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    {/* Valet Parking */}
                    <div
                      className={`rounded-xl p-3 border space-y-1 ${
                        item.amenities.valetParking.status === 'verified_official'
                          ? 'bg-emerald-50/60 border-emerald-200/80'
                          : 'bg-amber-50/50 border-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-[11px]">Valet Parking</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.amenities.valetParking.status === 'verified_official'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {item.amenities.valetParking.status === 'verified_official' ? 'Official' : 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        {item.amenities.valetParking.details}
                      </p>
                      <span className="text-[9px] text-slate-400 block font-mono truncate">
                        Src: {item.amenities.valetParking.sourceCitation}
                      </span>
                    </div>

                    {/* Covered Entrance */}
                    <div
                      className={`rounded-xl p-3 border space-y-1 ${
                        item.amenities.coveredEntrance.status === 'verified_official'
                          ? 'bg-emerald-50/60 border-emerald-200/80'
                          : 'bg-amber-50/50 border-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-[11px]">Covered Entrance</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.amenities.coveredEntrance.status === 'verified_official'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {item.amenities.coveredEntrance.status === 'verified_official' ? 'Official' : 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        {item.amenities.coveredEntrance.details}
                      </p>
                      <span className="text-[9px] text-slate-400 block font-mono truncate">
                        Src: {item.amenities.coveredEntrance.sourceCitation}
                      </span>
                    </div>

                    {/* Indoor AC */}
                    <div
                      className={`rounded-xl p-3 border space-y-1 ${
                        item.amenities.indoorAirConditioning.status === 'verified_official'
                          ? 'bg-emerald-50/60 border-emerald-200/80'
                          : 'bg-amber-50/50 border-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-[11px]">Indoor AC</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.amenities.indoorAirConditioning.status === 'verified_official'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {item.amenities.indoorAirConditioning.status === 'verified_official' ? 'Official' : 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        {item.amenities.indoorAirConditioning.details}
                      </p>
                      <span className="text-[9px] text-slate-400 block font-mono truncate">
                        Src: {item.amenities.indoorAirConditioning.sourceCitation}
                      </span>
                    </div>

                    {/* Dress Code Policy */}
                    <div
                      className={`rounded-xl p-3 border space-y-1 ${
                        item.amenities.dressCodePolicy.status === 'verified_official'
                          ? 'bg-emerald-50/60 border-emerald-200/80'
                          : 'bg-amber-50/50 border-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-[11px]">Dress Code</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.amenities.dressCodePolicy.status === 'verified_official'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {item.amenities.dressCodePolicy.status === 'verified_official' ? 'Official' : 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        {item.amenities.dressCodePolicy.details}
                      </p>
                      <span className="text-[9px] text-slate-400 block font-mono truncate">
                        Src: {item.amenities.dressCodePolicy.sourceCitation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explicit Road Safety Guardrail Banner */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 text-[11px] text-rose-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Road Safety Separation Rule:</strong> {item.roadSafetyNote}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
