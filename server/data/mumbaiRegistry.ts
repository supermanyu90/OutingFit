/**
 * Mumbai Reputed Venue & Civic Infrastructure Registry
 * 
 * Sources:
 * - Direct Venue Operations & Concierge Records
 * - BMC Disaster Management Cell Waterlogging Prone Spot Index
 * - Mumbai Traffic Police Monsoon Advisory
 */

export interface VenueRecord {
  id: string;
  name: string;
  aliases: string[];
  placeTypes: string[];
  neighborhood: string;
  /** GeoNames locality used as the forecast point (venues themselves are not geocodable). */
  forecastLocality?: string;
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

export const REPUTED_VENUES: VenueRecord[] = [
  {
    id: 'bombay-canteen',
    name: 'The Bombay Canteen',
    aliases: ['bombay canteen', 'tbc', 'kamala mills indian', 'canteen lower parel'],
    placeTypes: ['contemporary-indian', 'fine-dining', 'cocktails', 'dinner', 'lunch', 'celebration'],
    neighborhood: 'Kamala Mills, Lower Parel',
    forecastLocality: 'Parel',
    reputationNote: "Consistently ranked among Asia's 50 Best Restaurants; pioneer of regional Indian gastronomic dining.",
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Complimentary valet desk at Kamala Mills Gate 4. Token issued immediately upon arrival.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Covered canopy under mill compound porch. Full protection from sudden monsoon rain and overhead sun.',
    dressCode: 'Smart Casual. No beachwear, athletic shorts, or flip-flops in main dining room.',
    isIndoor: true,
    indoorAcDegree: '19°C (Brisk central AC)',
    sunExposureLevel: 'none',
    waterloggingProneNearby: ['Lower Parel Senapati Bapat Marg', 'Parel TT Junction', 'Hindmata Flyover Slips'],
    sourceCitation: 'Venue Operations Desk & Guest Concierge (Kamala Mills Compound)',
    sourceTimestamp: '2026-10-01T11:00:00+05:30',
  },
  {
    id: 'olive-bandra',
    name: 'Olive Bar & Kitchen',
    aliases: ['olive bandra', 'olive', 'olive pali hill', 'mediterranean bandra', 'sunday brunch bandra'],
    placeTypes: ['mediterranean', 'brunch', 'cocktails', 'romantic-dinner', 'bistro', 'outdoor-dining'],
    neighborhood: 'Pali Hill, Bandra West',
    forecastLocality: 'Khar West',
    reputationNote: 'Legendary Mumbai culinary institution famous for Mediterranean dining, celebrity clientele, and iconic white-walled courtyard.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Dedicated valet parking attendants on Union Park / Pali Hill road.',
    coveredDropOff: false,
    dropOffWalkMinutes: 1,
    dropOffNote: 'Car pulls up curbside at gate. Cobblestone white-gravel courtyard. Valet staff holds large golf umbrellas during rain.',
    dressCode: 'Chic Casual / Resort Elegant. Fashionable daytime or evening wear.',
    isIndoor: false,
    indoorAcDegree: '21°C in indoor salon, outdoor courtyard relies on ceiling fans & sea breeze',
    sunExposureLevel: 'high',
    waterloggingProneNearby: ['Khar Subway', 'Linking Road Waterfield Road Junction', 'Bandra Talkies S.V. Road'],
    sourceCitation: 'Olive Hospitality Operations & Guest Services',
    sourceTimestamp: '2026-09-28T14:30:00+05:30',
  },
  {
    id: 'wasabi-taj',
    name: 'Wasabi by Morimoto',
    aliases: ['wasabi', 'wasabi taj', 'japanese colaba', 'taj mahal palace wasabi'],
    placeTypes: ['japanese', 'fine-dining', 'luxury', 'sushi', 'romantic-dinner', 'celebration'],
    neighborhood: 'The Taj Mahal Palace, Colaba (South Mumbai)',
    forecastLocality: 'Colaba',
    reputationNote: 'Iconic Iron Chef Masaharu Morimoto luxury dining room overlooking the Gateway of India.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: '5-Star Taj hotel valet service with dedicated vehicular porch and bellhop support.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Grand heritage portico canopy. 100% weather shielded drop-off and pickup.',
    dressCode: 'Smart Elegant / Formal. Collared shirts or smart ethnic wear. Closed footwear mandatory for gentlemen.',
    isIndoor: true,
    indoorAcDegree: '18°C (Chilled luxury hotel AC)',
    sunExposureLevel: 'none',
    waterloggingProneNearby: ['Colaba Post Office junction during high tide storm surges', 'Marine Drive wave-overtopping'],
    sourceCitation: 'The Taj Mahal Palace Guest Relations & Food & Beverage Bureau',
    sourceTimestamp: '2026-10-02T10:00:00+05:30',
  },
  {
    id: 'o-pedro-bkc',
    name: 'O Pedro',
    aliases: ['o pedro', 'pedro bkc', 'goan bkc', 'portuguese bkc'],
    placeTypes: ['contemporary-indian', 'bistro', 'cocktails', 'lunch', 'dinner', 'casual-fine-dining'],
    neighborhood: 'Bandra-Kurla Complex (BKC)',
    forecastLocality: 'Bandra Kurla Complex',
    reputationNote: 'Critically acclaimed Goan & Portuguese bistro by Hunger Inc. Hospitality, revered for sourdoughs, seafood, and tropical cocktails.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Building valet desk at Jet Airways Godrej BKC entrance.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Covered glass-and-steel commercial tower driveway. Zero direct rain or sun exposure at car door.',
    dressCode: 'Smart Casual.',
    isIndoor: true,
    indoorAcDegree: '19°C (Crisp corporate tower AC)',
    sunExposureLevel: 'partial',
    waterloggingProneNearby: ['Kalanagar Junction / Western Express Highway Exit', 'BKC Connector Lower Slip'],
    sourceCitation: 'Hunger Inc. Guest Experience Desk',
    sourceTimestamp: '2026-10-01T16:00:00+05:30',
  },
  {
    id: 'cecconis-juhu',
    name: 'Cecconi’s Mumbai',
    aliases: ['cecconis', 'cecconi', 'soho house italian', 'juhu beach italian'],
    placeTypes: ['italian', 'fine-dining', 'coastal', 'beachfront', 'brunch', 'romantic-dinner', 'pizza-pasta'],
    neighborhood: 'Soho House, Juhu Tara Road',
    forecastLocality: 'Juhu',
    reputationNote: 'Classic Northern Italian seaside dining with wood-fired ovens, handmade pasta, and ocean sunset panoramas.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Valet parking at Soho House main entrance gate on Juhu Tara Road.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Covered entryway canopy at main door. Terrace seating has retractable weather awnings.',
    dressCode: 'Smart Casual / Beach Chic.',
    isIndoor: true,
    indoorAcDegree: '20°C inside; open sea-breeze terrace outside',
    sunExposureLevel: 'high',
    waterloggingProneNearby: ['Milan Subway (Santacruz)', 'Juhu Tara Road sea runoff', 'JVPD Circle low point'],
    sourceCitation: 'Soho House Mumbai Concierge Desk',
    sourceTimestamp: '2026-09-30T15:00:00+05:30',
  },
  {
    id: 'trishna-fort',
    name: 'Trishna',
    aliases: ['trishna', 'trishna fort', 'trishna seafood', 'butter pepper garlic crab'],
    placeTypes: ['seafood', 'coastal', 'heritage', 'lunch', 'dinner', 'casual-fine-dining'],
    neighborhood: 'Kala Ghoda, Fort',
    forecastLocality: 'Kala Ghoda',
    reputationNote: 'Legendary Mangalorean seafood restaurant internationally renowned for its signature Butter Pepper Garlic Crab.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Valet desk stationed on Ropewalk Lane. Attendants park in nearby heritage pay-and-park zones.',
    coveredDropOff: false,
    dropOffWalkMinutes: 1,
    dropOffNote: 'Narrow heritage lane curbside stop. No overhead roof canopy. Umbrella required if stepping out during rain.',
    dressCode: 'Casual to Smart Casual. Welcoming and relaxed, but reputed.',
    isIndoor: true,
    indoorAcDegree: '20°C (Air conditioned historic hall)',
    sunExposureLevel: 'none',
    waterloggingProneNearby: ['Flora Fountain / Hutatma Chowk low spots', 'Ballard Estate perimeter drains'],
    sourceCitation: 'Trishna Restaurant Management Record',
    sourceTimestamp: '2026-09-25T12:00:00+05:30',
  },
  {
    id: 'masque-mahalaxmi',
    name: 'Masque',
    aliases: ['masque', 'masque tasting menu', 'masque mahalaxmi'],
    placeTypes: ['fine-dining', 'contemporary-indian', 'tasting-menu', 'celebration', 'romantic-dinner'],
    neighborhood: 'Shakti Mills Lane, Mahalaxmi',
    forecastLocality: 'Mahalakshmi',
    reputationNote: "Ranked among the World's 50 Best Discovery and Asia's 50 Best; avant-garde botanical 10-course Indian tasting experience.",
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Valet desk positioned at Shakti Mills warehouse entrance.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Industrial canopy entrance directly at mill door.',
    dressCode: 'Smart Elegant.',
    isIndoor: true,
    indoorAcDegree: '18.5°C',
    sunExposureLevel: 'none',
    waterloggingProneNearby: ['Mahalaxmi Station Bridge lower road', 'Famous Studio Lane runoff'],
    sourceCitation: 'Masque Guest Relations Bureau',
    sourceTimestamp: '2026-10-02T18:00:00+05:30',
  },
  {
    id: 'cincin-bkc',
    name: 'CinCin',
    aliases: ['cincin', 'cin cin', 'cincin bkc', 'italian bkc'],
    placeTypes: ['italian', 'wine-bar', 'lunch', 'dinner', 'pasta-pizza', 'business-lunch'],
    neighborhood: 'Raheja Towers, BKC',
    forecastLocality: 'Bandra Kurla Complex',
    reputationNote: 'Vibrant Venetian cicchetti and wine bar celebrating authentic Italian handmade pasta and limoncello.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Raheja Towers multi-level basement valet parking.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Extensive glass tower portico canopy. Complete protection from rain and direct sun.',
    dressCode: 'Smart Casual.',
    isIndoor: true,
    indoorAcDegree: '19.5°C',
    sunExposureLevel: 'partial',
    waterloggingProneNearby: ['Kalanagar Junction', 'Bandra East Highway Underpass'],
    sourceCitation: 'Raheja Towers Commercial Complex Records',
    sourceTimestamp: '2026-10-01T13:00:00+05:30',
  },
  {
    id: 'subko-bandra',
    name: 'Subko Specialty Coffee & Craftery',
    aliases: ['subko', 'subko bandra', 'subko ranwar', 'artisanal coffee bandra'],
    placeTypes: ['cafe', 'coffee', 'bakery', 'breakfast', 'brunch', 'art-craft'],
    neighborhood: 'Ranwar Village, Bandra West',
    forecastLocality: 'Khar West',
    reputationNote: "India's premier single-origin specialty coffee roastery and sourdough craftery, located in a restored 1925 Portuguese-Goan village cottage.",
    isVerified: true,
    valetAvailable: false,
    valetDetails: 'NO VALET. Pedestrian heritage village alley. Cars cannot enter Ranwar village interior lanes.',
    coveredDropOff: false,
    dropOffWalkMinutes: 3,
    dropOffNote: 'Car drop-off at St. John Baptist Road / Waroda Road corner. Requires 3-minute walk through paved village alley.',
    dressCode: 'Casual & Creative.',
    isIndoor: true,
    indoorAcDegree: '21°C inside; open courtyard seating with fans',
    sunExposureLevel: 'high',
    waterloggingProneNearby: ['Hill Road / Mehboob Studio junction', 'Khar Subway'],
    sourceCitation: 'Subko Hospitality Operations',
    sourceTimestamp: '2026-09-29T10:00:00+05:30',
  },
  {
    id: 'bastian-dadar',
    name: 'Bastian - At The Top',
    aliases: ['bastian dadar', 'bastian kohinoor', 'bastian rooftop', 'bastian at the top'],
    placeTypes: ['seafood', 'pan-asian', 'fine-dining', 'cocktails', 'rooftop', 'celebration'],
    neighborhood: 'Kohinoor Square, Dadar West',
    forecastLocality: 'Dadar West',
    reputationNote: 'Skyline dining 48 floors up with panoramic 360-degree Mumbai sea views and opulent seafood.',
    isVerified: true,
    valetAvailable: true,
    valetDetails: 'Dedicated skyscraper lobby valet with electronic car-summon tokens.',
    coveredDropOff: true,
    dropOffWalkMinutes: 0,
    dropOffNote: 'Covered triple-height vehicular lobby.',
    dressCode: 'Glamorous / Smart Chic. Strict evening dress code: no open footwear for men, no athletic gear.',
    isIndoor: true,
    indoorAcDegree: '18°C',
    sunExposureLevel: 'none',
    waterloggingProneNearby: ['Hindmata Flyover lower surface lanes', 'Dadar TT Circle'],
    sourceCitation: 'Kohinoor Square Facility Management',
    sourceTimestamp: '2026-10-02T14:00:00+05:30',
  },
  {
    id: 'bastian-bandra',
    name: 'Bastian (Bandra West)',
    aliases: ['bastian bandra', 'bastian linking road'],
    placeTypes: ['seafood', 'dinner', 'cocktails'],
    neighborhood: 'Linking Road, Bandra West',
    forecastLocality: 'Khar West',
    reputationNote: 'Seafood restaurant sharing the Bastian name with the Dadar rooftop branch.',
    isVerified: false,
    valetAvailable: false,
    valetDetails: 'Not confirmed.',
    coveredDropOff: false,
    dropOffWalkMinutes: 2,
    dropOffNote: 'Not confirmed — ask the venue.',
    dressCode: 'Not confirmed.',
    isIndoor: true,
    indoorAcDegree: 'Not confirmed',
    sunExposureLevel: 'partial',
    waterloggingProneNearby: [],
    sourceCitation: 'OutingFit curated registry (name only; amenities unconfirmed)',
    sourceTimestamp: '2026-10-04T00:00:00+05:30',
  },
];

export const WATERLOGGING_MONITOR_FEED: WaterloggingSpot[] = [
  {
    id: 'spot-hindmata',
    name: 'Hindmata Flyover Ground Slips',
    corridor: 'Dadar - Parel Dr. B.A. Road Corridor',
    severity: 'high',
    currentStatus: 'monitored',
    source: 'BMC Disaster Management Emergency Control Feed (Demo Sensor Feed v1.4)',
    timestamp: '2026-10-03T19:45:00+05:30',
    notes: 'Ground slip lanes beneath flyover gather 1.5 - 2.5 ft water during continuous heavy rain (>40mm/hr). Recommended action: Instruct driver to stay on the elevated flyover.',
  },
  {
    id: 'spot-milan-subway',
    name: 'Milan Subway (Santacruz West to East)',
    corridor: 'Western Suburbs Railway Culvert',
    severity: 'severe',
    currentStatus: 'slow_traffic',
    source: 'Mumbai Traffic Police Advisory Feed',
    timestamp: '2026-10-03T19:30:00+05:30',
    notes: 'Subway water pumps operating. Slow-moving vehicular crawl. Recommended route: Use Santacruz Milan Flyover instead of underpass.',
  },
  {
    id: 'spot-khar-subway',
    name: 'Khar Subway',
    corridor: 'Bandra - Khar Link',
    severity: 'high',
    currentStatus: 'monitored',
    source: 'H/West Ward Municipal Engineering Desk',
    timestamp: '2026-10-03T19:15:00+05:30',
    notes: 'Prone to rapid water buildup within 20 minutes of coastal squall. Avoid low-clearance sedans if rain alerts are active.',
  },
  {
    id: 'spot-kings-circle',
    name: 'Gandhi Market & King’s Circle',
    corridor: 'Matunga - Sion Arterial',
    severity: 'high',
    currentStatus: 'monitored',
    source: 'BMC Monsoon Control Unit',
    timestamp: '2026-10-03T18:50:00+05:30',
    notes: 'Natural depression zone. High tide delays storm-water gravity outflow to Mahim creek.',
  },
  {
    id: 'spot-marine-drive',
    name: 'Marine Drive Promenade Parapet',
    corridor: 'South Mumbai Coastal Road',
    severity: 'moderate',
    currentStatus: 'clear',
    source: 'Mumbai Port Trust Marine & Tide Desk',
    timestamp: '2026-10-03T20:10:00+05:30',
    notes: 'High tide wave spray reaches outer vehicular carriage-way between 4 PM - 7 PM. Salt spray on windshield.',
  },
];

export const MANDATORY_WATERLOGGING_DISCLAIMER =
  'MANDATORY ADVISORY: Missing or clear waterlogging reports from municipal feeds NEVER imply a clear route. In Mumbai’s coastal environment, sudden localized cloud bursts and high tide backflows can accumulate dangerous water in railway subways and low culverts within 15 minutes. Always instruct your driver to prioritize flyovers and elevated arterial roads.';

export function searchVenues(query: string): {
  isAmbiguous: boolean;
  isPlaceType: boolean;
  exactMatch: VenueRecord | null;
  suggestions: VenueRecord[];
} {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return { isAmbiguous: false, isPlaceType: false, exactMatch: null, suggestions: [] };
  }

  // Exact ID or Alias match
  const exact = REPUTED_VENUES.find(
    (v) =>
      v.id.toLowerCase() === normalized ||
      v.name.toLowerCase() === normalized ||
      v.aliases.some((alias) => alias.toLowerCase() === normalized)
  );

  if (exact) {
    return { isAmbiguous: false, isPlaceType: false, exactMatch: exact, suggestions: [exact] };
  }

  // Place type matching (e.g. "italian", "seafood", "fine-dining", "cafe", "mediterranean", "contemporary-indian", "rooftop", "brunch")
  const matchingPlaceTypes = REPUTED_VENUES.filter(
    (v) =>
      v.placeTypes.some((pt) => normalized.includes(pt.replace('-', ' ')) || pt.includes(normalized)) ||
      normalized.includes(v.placeTypes[0])
  );

  if (matchingPlaceTypes.length > 0) {
    return {
      isAmbiguous: matchingPlaceTypes.length > 1,
      isPlaceType: true,
      exactMatch: null,
      suggestions: matchingPlaceTypes,
    };
  }

  // Substring or Neighborhood matching
  const matchingSubstrings = REPUTED_VENUES.filter(
    (v) =>
      v.name.toLowerCase().includes(normalized) ||
      v.neighborhood.toLowerCase().includes(normalized) ||
      v.aliases.some((a) => a.toLowerCase().includes(normalized))
  );

  if (matchingSubstrings.length === 1) {
    return {
      isAmbiguous: false,
      isPlaceType: false,
      exactMatch: matchingSubstrings[0],
      suggestions: matchingSubstrings,
    };
  }

  return {
    isAmbiguous: matchingSubstrings.length > 1,
    isPlaceType: false,
    exactMatch: null,
    suggestions: matchingSubstrings.length > 0 ? matchingSubstrings : REPUTED_VENUES.slice(0, 4),
  };
}
