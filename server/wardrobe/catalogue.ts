/**
 * Wardrobe catalogue: concrete outfit ideas, grouped by garment family — not by
 * gender. Anyone can wear any family; the UI says so.
 *
 * Attributes describe the garment generically (formality it suits, how much skin
 * it covers, hem length, whether it can be made in breathable fabric). Fabric
 * advice comes from the decision layer, not from these entries.
 */

import type { Language } from '../domain.ts';

export type Family = 'dresses_skirts' | 'shirts_trousers' | 'indian_wear' | 'coords_jumpsuits';
export type Formality = 'casual' | 'smart_casual' | 'formal';

export interface GarmentIdea {
  id: string;
  family: Family;
  name: Record<Language, string>;
  /** What the outfit is made of, e.g. "midi dress + flat sandals". */
  pieces: string;
  formality: Formality[];
  /** Sleeves/legs: 'full' covers arms and legs, 'partial' covers some, 'minimal' leaves most exposed. */
  coverage: 'full' | 'partial' | 'minimal';
  /** floor-length hems drag through puddles; 'ankle' is borderline; 'above' clears wet ground. */
  hem: 'floor' | 'ankle' | 'above';
  /** Typical breathable fabrics this garment is commonly made in. */
  breathableFabrics: string[];
  /** Fabrics this garment often comes in that suit heat/rain poorly. */
  watchFabrics: string[];
  /** A matching layer for air-conditioned interiors. */
  layer: string;
}

export const FAMILY_LABELS: Record<Family, Record<Language, string>> = {
  dresses_skirts: { en: 'Dresses & skirts', hi: 'ड्रेस और स्कर्ट', mr: 'ड्रेस आणि स्कर्ट' },
  shirts_trousers: { en: 'Shirts & trousers', hi: 'शर्ट और ट्राउज़र', mr: 'शर्ट आणि ट्राउझर' },
  indian_wear: { en: 'Indian wear', hi: 'भारतीय परिधान', mr: 'भारतीय पोशाख' },
  coords_jumpsuits: { en: 'Co-ords & jumpsuits', hi: 'को-ऑर्ड और जंपसूट', mr: 'को-ऑर्ड आणि जंपसूट' },
};

export const CATALOGUE: GarmentIdea[] = [
  // ------------------------------------------------------- dresses & skirts
  {
    id: 'sundress',
    family: 'dresses_skirts',
    name: { en: 'Sundress', hi: 'सनड्रेस', mr: 'सनड्रेस' },
    pieces: 'Knee-length sleeveless or strappy dress + flat sandals',
    formality: ['casual'],
    coverage: 'minimal',
    hem: 'above',
    breathableFabrics: ['cotton', 'linen', 'rayon'],
    watchFabrics: ['polyester'],
    layer: 'Light cotton shrug or shirt worn open',
  },
  {
    id: 'shirt_dress',
    family: 'dresses_skirts',
    name: { en: 'Shirt dress', hi: 'शर्ट ड्रेस', mr: 'शर्ट ड्रेस' },
    pieces: 'Collared button-front dress (sleeves rolled or full) + loafers or block heels',
    formality: ['casual', 'smart_casual'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['cotton poplin', 'linen', 'chambray'],
    watchFabrics: ['polyester'],
    layer: 'Unbuttoned linen overshirt or cardigan',
  },
  {
    id: 'midi_wrap_dress',
    family: 'dresses_skirts',
    name: { en: 'Midi wrap dress', hi: 'मिडी रैप ड्रेस', mr: 'मिडी रॅप ड्रेस' },
    pieces: 'Mid-calf wrap dress with elbow or full sleeves + block heels or dressy flats',
    formality: ['smart_casual', 'formal'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['viscose crepe', 'cotton voile', 'linen blend'],
    watchFabrics: ['satin polyester', 'jersey polyester'],
    layer: 'Light stole or cropped cardigan',
  },
  {
    id: 'maxi_dress',
    family: 'dresses_skirts',
    name: { en: 'Long-sleeve maxi dress', hi: 'लंबी बाजू की मैक्सी ड्रेस', mr: 'लांब बाहीचा मॅक्सी ड्रेस' },
    pieces: 'Ankle-length flowing dress with long sleeves + flat sandals',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'ankle',
    breathableFabrics: ['cotton mulmul', 'voile', 'linen'],
    watchFabrics: ['chiffon polyester'],
    layer: 'Not usually needed — the sleeves already cover; add a stole for strong AC',
  },
  {
    id: 'skirt_blouse',
    family: 'dresses_skirts',
    name: { en: 'Midi skirt + blouse', hi: 'मिडी स्कर्ट + ब्लाउज़', mr: 'मिडी स्कर्ट + ब्लाउज' },
    pieces: 'A-line or pleated midi skirt + tucked blouse + loafers or heels',
    formality: ['smart_casual', 'formal'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['cotton', 'linen', 'silk-cotton'],
    watchFabrics: ['pure silk', 'polyester'],
    layer: 'Fitted blazer or fine-knit cardigan',
  },
  {
    id: 'cocktail_dress',
    family: 'dresses_skirts',
    name: { en: 'Cocktail / evening dress', hi: 'कॉकटेल / ईवनिंग ड्रेस', mr: 'कॉकटेल / इव्हनिंग ड्रेस' },
    pieces: 'Knee- to midi-length tailored dress + heels or dressy flats',
    formality: ['formal'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['crepe', 'linen-silk blend'],
    watchFabrics: ['velvet', 'heavy satin', 'sequinned polyester'],
    layer: 'Structured blazer or pashmina',
  },
  // ------------------------------------------------------ shirts & trousers
  {
    id: 'camp_shirt_shorts',
    family: 'shirts_trousers',
    name: { en: 'Short-sleeve shirt + shorts', hi: 'हाफ़ शर्ट + शॉर्ट्स', mr: 'हाफ शर्ट + शॉर्ट्स' },
    pieces: 'Camp-collar or plain short-sleeve shirt + knee-length shorts + sandals or sneakers',
    formality: ['casual'],
    coverage: 'minimal',
    hem: 'above',
    breathableFabrics: ['linen', 'cotton', 'seersucker'],
    watchFabrics: ['polyester'],
    layer: 'Light overshirt',
  },
  {
    id: 'linen_shirt_chinos',
    family: 'shirts_trousers',
    name: { en: 'Linen shirt + chinos', hi: 'लिनन शर्ट + चिनो', mr: 'लिनन शर्ट + चिनो' },
    pieces: 'Long-sleeve linen shirt (sleeves can roll) + cotton chinos + loafers or clean sneakers',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['linen', 'cotton twill'],
    watchFabrics: ['heavy denim'],
    layer: 'Unstructured cotton blazer or knit polo',
  },
  {
    id: 'polo_trousers',
    family: 'shirts_trousers',
    name: { en: 'Polo + tailored trousers', hi: 'पोलो + टेलर्ड ट्राउज़र', mr: 'पोलो + टेलर्ड ट्राउझर' },
    pieces: 'Knit or piqué polo + tailored trousers + loafers',
    formality: ['smart_casual'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['cotton piqué', 'linen-cotton'],
    watchFabrics: ['polyester'],
    layer: 'Light cardigan or overshirt',
  },
  {
    id: 'oxford_trousers',
    family: 'shirts_trousers',
    name: { en: 'Formal shirt + trousers', hi: 'फ़ॉर्मल शर्ट + ट्राउज़र', mr: 'फॉर्मल शर्ट + ट्राउझर' },
    pieces: 'Crisp long-sleeve shirt + pleated or flat-front trousers + leather shoes',
    formality: ['smart_casual', 'formal'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['cotton poplin', 'tropical wool', 'linen blend'],
    watchFabrics: ['polyester-viscose suiting'],
    layer: 'Blazer, carried until indoors',
  },
  {
    id: 'light_suit',
    family: 'shirts_trousers',
    name: { en: 'Lightweight suit or trouser suit', hi: 'हल्का सूट / ट्राउज़र सूट', mr: 'हलका सूट / ट्राउझर सूट' },
    pieces: 'Unlined or half-lined jacket + matching trousers + shirt or shell top + leather shoes',
    formality: ['formal'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['tropical wool', 'linen', 'cotton-linen'],
    watchFabrics: ['heavy wool', 'fully lined polyester'],
    layer: 'The jacket itself — wear it indoors, carry it outside',
  },
  // ------------------------------------------------------------ Indian wear
  {
    id: 'kurta_pyjama',
    family: 'indian_wear',
    name: { en: 'Cotton kurta + pyjama / churidar', hi: 'सूती कुर्ता + पायजामा / चूड़ीदार', mr: 'सुती कुर्ता + पायजमा / चुडीदार' },
    pieces: 'Straight or A-line kurta + pyjama, churidar or slim trousers + kolhapuris or mojaris',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['cotton', 'khadi', 'linen'],
    watchFabrics: ['polyester'],
    layer: 'Dupatta or stole',
  },
  {
    id: 'kurta_palazzo',
    family: 'indian_wear',
    name: { en: 'Kurta + palazzo', hi: 'कुर्ता + पलाज़ो', mr: 'कुर्ता + पलाझो' },
    pieces: 'Short or knee-length kurta + wide palazzo trousers + flats',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'ankle',
    breathableFabrics: ['cotton', 'rayon', 'mulmul'],
    watchFabrics: ['georgette polyester'],
    layer: 'Light dupatta',
  },
  {
    id: 'anarkali',
    family: 'indian_wear',
    name: { en: 'Anarkali / flared kurta set', hi: 'अनारकली / फ़्लेयर्ड कुर्ता सेट', mr: 'अनारकली / फ्लेअर्ड कुर्ता सेट' },
    pieces: 'Flared long kurta + churidar + dupatta + juttis or heels',
    formality: ['smart_casual', 'formal'],
    coverage: 'full',
    hem: 'ankle',
    breathableFabrics: ['cotton', 'chanderi', 'mulmul'],
    watchFabrics: ['heavy georgette', 'velvet'],
    layer: 'The dupatta doubles as a wrap',
  },
  {
    id: 'cotton_saree',
    family: 'indian_wear',
    name: { en: 'Cotton or linen saree', hi: 'सूती या लिनन साड़ी', mr: 'सुती किंवा लिनन साडी' },
    pieces: 'Handloom cotton or linen saree + cotton blouse + flats or block heels',
    formality: ['smart_casual', 'formal'],
    coverage: 'partial',
    hem: 'floor',
    breathableFabrics: ['handloom cotton', 'linen', 'mul'],
    watchFabrics: ['synthetic chiffon'],
    layer: 'Drape the pallu over the shoulders indoors',
  },
  {
    id: 'silk_saree',
    family: 'indian_wear',
    name: { en: 'Silk or silk-blend saree', hi: 'रेशमी / सिल्क-ब्लेंड साड़ी', mr: 'रेशमी / सिल्क-ब्लेंड साडी' },
    pieces: 'Silk or silk-cotton saree + blouse + heels or juttis',
    formality: ['formal'],
    coverage: 'partial',
    hem: 'floor',
    breathableFabrics: ['silk-cotton', 'chanderi'],
    watchFabrics: ['pure silk (water marks)', 'heavy brocade'],
    layer: 'Pallu or a light shawl',
  },
  {
    id: 'kurta_nehru',
    family: 'indian_wear',
    name: { en: 'Kurta + Nehru jacket', hi: 'कुर्ता + नेहरू जैकेट', mr: 'कुर्ता + नेहरू जॅकेट' },
    pieces: 'Kurta + slim trousers or churidar + sleeveless Nehru jacket + mojaris or loafers',
    formality: ['smart_casual', 'formal'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['cotton', 'linen', 'khadi'],
    watchFabrics: ['heavy jacquard'],
    layer: 'The Nehru jacket — carry it until indoors',
  },
  {
    id: 'bandhgala',
    family: 'indian_wear',
    name: { en: 'Bandhgala / Jodhpuri suit', hi: 'बंदगला / जोधपुरी सूट', mr: 'बंदगळा / जोधपुरी सूट' },
    pieces: 'Closed-neck bandhgala jacket + trousers + formal shoes or mojaris',
    formality: ['formal'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['linen', 'cotton-linen', 'tropical wool'],
    watchFabrics: ['velvet', 'heavy wool'],
    layer: 'The jacket itself',
  },
  // ---------------------------------------------------- co-ords & jumpsuits
  {
    id: 'linen_coord',
    family: 'coords_jumpsuits',
    name: { en: 'Linen co-ord set', hi: 'लिनन को-ऑर्ड सेट', mr: 'लिनन को-ऑर्ड सेट' },
    pieces: 'Matching relaxed shirt + wide trousers or shorts + sandals or loafers',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'above',
    breathableFabrics: ['linen', 'cotton-linen'],
    watchFabrics: ['polyester'],
    layer: 'Wear the shirt open over a tee indoors',
  },
  {
    id: 'jumpsuit',
    family: 'coords_jumpsuits',
    name: { en: 'Jumpsuit', hi: 'जंपसूट', mr: 'जंपसूट' },
    pieces: 'Belted wide-leg or tapered jumpsuit + flats or heels',
    formality: ['casual', 'smart_casual', 'formal'],
    coverage: 'partial',
    hem: 'above',
    breathableFabrics: ['cotton', 'tencel', 'crepe'],
    watchFabrics: ['satin polyester'],
    layer: 'Cropped blazer or light cardigan',
  },
  {
    id: 'kaftan',
    family: 'coords_jumpsuits',
    name: { en: 'Kaftan or relaxed tunic set', hi: 'काफ़्तान / ढीला ट्यूनिक सेट', mr: 'काफ्तान / सैल ट्युनिक सेट' },
    pieces: 'Loose kaftan or long tunic + slim trousers + slides',
    formality: ['casual', 'smart_casual'],
    coverage: 'full',
    hem: 'ankle',
    breathableFabrics: ['cotton voile', 'mulmul', 'linen'],
    watchFabrics: ['polyester'],
    layer: 'Light stole',
  },
];
