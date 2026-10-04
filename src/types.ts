export interface VenueRecord {
  id: string;
  name: string;
  aliases: string[];
  placeTypes: string[];
  neighborhood: string;
  reputationNote: string;
  isVerified: boolean;
  valetAvailable: boolean;
  valetDetails: string;
  coveredDropOff: boolean;
  dropOffWalkMinutes: number;
  dropOffNote: string;
  dressCode: string;
  isIndoor: boolean;
  indoorAcDegree: string;
  sunExposureLevel: 'none' | 'partial' | 'high';
  waterloggingProneNearby: string[];
  sourceCitation: string;
  sourceTimestamp: string;
}

export interface WaterloggingSpot {
  id: string;
  name: string;
  corridor: string;
  severity: 'low' | 'moderate' | 'high' | 'severe';
  currentStatus: 'clear' | 'monitored' | 'slow_traffic' | 'waterlogged_diversion';
  source: string;
  timestamp: string;
  notes: string;
}

export interface WeatherEvidence {
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  uvIndex: number;
  rainProbability: number;
  conditionSummary: string;
  dataSource: string;
  dataTimestamp: string;
  isDemoData: boolean;
  isUnavailable?: boolean;
  unavailableNotice?: string;
}

export interface WaterloggingEvidence {
  alerts: Array<{
    location: string;
    riskLevel: 'low' | 'moderate' | 'high' | 'severe';
    reportStatus: string;
    source: string;
    timestamp: string;
  }>;
  mandatoryUnknownsNotice: string;
  hasActiveReports: boolean;
}

export interface WearCardData {
  fabric: {
    recommended: string[];
    avoid: string[];
    evidenceExplanation: string;
  };
  coverageAndFit: {
    summary: string;
    sunCoverageAdvice: string;
    fitRationale: string;
    evidenceExplanation: string;
  };
  colorOptions: {
    recommended: Array<{ name: string; hex: string; reason: string }>;
    cautionColors: Array<{ name: string; reason: string }>;
    evidenceExplanation: string;
  };
  footwear: {
    recommendation: string;
    waterloggingPuddleSafety: string;
    carAndValetSuitability: string;
    evidenceExplanation: string;
  };
  optionalLayers: {
    item: string;
    indoorAcVsCarDeltaReason: string;
    evidenceExplanation: string;
  };
}

export interface CarryCardData {
  items: Array<{
    name: string;
    category: 'sun_protection' | 'water_resistance' | 'car_comfort' | 'grooming';
    priority: 'essential' | 'recommended' | 'optional';
    rationale: string;
    evidenceGrounding: string;
  }>;
}

export interface CheckCardData {
  parkingAndValet: {
    verifiedStatus: string;
    isVerifiedVenueData: boolean;
    valetDetails: string;
    dropOffCoverage: string;
    evidenceExplanation: string;
  };
  coveredDropOff: {
    hasCanopy: boolean;
    walkDistanceMinutes: number;
    rainOrSunExposureRisk: string;
    evidenceExplanation: string;
  };
  venueRequirements: {
    verifiedDressCode: string;
    isStrictRequirement: boolean;
    styleSuggestionsVsVenueMandate: string;
    reservationAndEtiquette: string;
    evidenceExplanation: string;
  };
  travelAndWaterlogging: {
    routeCorridorRisk: string;
    nearbyHotspots: string[];
    activeAlertCount: number;
    missingReportsDisclaimer: string;
    evidenceExplanation: string;
  };
}

export interface RecommendationResponse {
  meta: {
    modelUsed: string;
    providerAdapter: string;
    licensing: string;
    timestamp: string;
    latencyMs: number;
    fallbackTriggered: boolean;
    inferenceDegraded?: boolean;
    degradedNotice?: string;
    dataSources: {
      weather: string;
      venue: string;
      waterlogging: string;
    };
  };
  cards: {
    wear: WearCardData;
    carry: CarryCardData;
    check: CheckCardData;
  };
}

export interface ProviderDocumentation {
  providerName: string;
  centralModel: string;
  modelIdentifier: string;
  officialDocumentationUrl: string;
  licensing: string;
  runtimeRequirements: string;
  evidenceGroundingPolicy: string;
}

export interface ScenarioDetail {
  venue: VenueRecord;
  schedule: {
    departureTime: string;
    returnTime: string;
    timeSlot: 'lunch' | 'dinner';
  };
  weather: WeatherEvidence;
  waterlogging: WaterloggingEvidence;
  recommendation: RecommendationResponse;
}

export interface ScenarioDemoData {
  sunnyLunch: ScenarioDetail;
  rainyDinner: ScenarioDetail;
}

export interface SearchResult {
  isAmbiguous: boolean;
  isPlaceType: boolean;
  exactMatch: VenueRecord | null;
  suggestions: VenueRecord[];
}

export interface ReviewProvenance {
  platform: 'Google Maps' | 'Zomato' | 'TripAdvisor' | 'Conde Nast Traveller' | 'Official Concierge';
  rating?: number;
  reviewCount?: number;
  sourceUrl: string;
  sourceTimestamp: string;
  excerpt?: string;
}

export interface AmenityVerification {
  status: 'verified_official' | 'crowdsourced_unconfirmed' | 'unknown_unsupported';
  sourceCitation: string;
  details: string;
}

export interface DiscoveredDestination {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  cuisineTypes: string[];
  priceTier: '₹₹ (Moderate)' | '₹₹₹ (Upscale)' | '₹₹₹₹ (Luxury Fine Dining)';
  officialWebsiteUrl?: string;
  mapListingUrl: string;
  reviewProvenance: ReviewProvenance[];
  matchReasons: {
    cuisineFit: string;
    budgetFit: string;
    occasionFit: string;
    comfortFit: string;
  };
  amenities: {
    valetParking: AmenityVerification;
    coveredEntrance: AmenityVerification;
    indoorAirConditioning: AmenityVerification;
    dressCodePolicy: AmenityVerification;
  };
  roadSafetyNote: string;
}

export interface DiscoveryResult {
  query: string;
  interpretedFilters: {
    cuisine?: string;
    neighborhood?: string;
    budget?: string;
    occasion?: string;
  };
  isAmbiguous: boolean;
  ambiguityNotice?: string;
  ambiguousChoices?: DiscoveredDestination[];
  shortlist: DiscoveredDestination[];
  dataSource: string;
  timestamp: string;
  isDemoData: boolean;
}
