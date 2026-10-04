/**
 * Picks wardrobe ideas from the catalogue using the decision layer's output, so
 * every outfit suggestion is tied to the same weather evidence and stated
 * preferences as the Wear / Carry / Check cards. Deterministic — no model text.
 */

import type { Decision } from '../decision/engine.ts';
import type { OutingRequest } from '../domain.ts';
import type { VenueFacts } from '../decision/engine.ts';
import { CATALOGUE, Family, FAMILY_LABELS, Formality, GarmentIdea } from './catalogue.ts';

export interface WardrobeIdea {
  id: string;
  name: string;
  nameEn: string;
  pieces: string;
  fabrics: string[];
  fit: 'good' | 'with_care';
  reasons: Array<{ text: string; decisionId?: string }>;
  cautions: Array<{ text: string; decisionId?: string }>;
  layer?: string;
}

export interface WardrobeResult {
  formality: Formality;
  formalitySource: 'user' | 'venue' | 'occasion' | 'default';
  formalityNote: string;
  inclusiveNote: string;
  families: Array<{ family: Family; label: string; ideas: WardrobeIdea[] }>;
}

function inferFormality(r: OutingRequest, venue: VenueFacts | null): { level: Formality; source: WardrobeResult['formalitySource']; note: string } {
  if (r.formality !== 'unknown') return { level: r.formality, source: 'user', note: `Dress level you chose: ${r.formality.replace('_', ' ')}.` };
  const code = venue?.dressCode?.toLowerCase() ?? '';
  if (/formal|black tie|glamorous|strict/.test(code)) return { level: 'formal', source: 'venue', note: `From the venue's listed dress code ("${venue!.dressCode}", unconfirmed).` };
  if (/smart/.test(code)) return { level: 'smart_casual', source: 'venue', note: `From the venue's listed dress code ("${venue!.dressCode}", unconfirmed).` };
  const occ = r.occasion.toLowerCase();
  if (/wedding|reception|gala|black tie|award|sangeet|engagement/.test(occ)) return { level: 'formal', source: 'occasion', note: `From the occasion ("${r.occasion}").` };
  if (/beach|walk|stroll|picnic|market|casual|movie|errand/.test(occ)) return { level: 'casual', source: 'occasion', note: `From the occasion ("${r.occasion}").` };
  if (/dinner|lunch|brunch|meeting|office|date|anniversary|birthday/.test(occ)) return { level: 'smart_casual', source: 'occasion', note: `From the occasion ("${r.occasion}").` };
  return { level: 'smart_casual', source: 'default', note: 'Dress level not specified — showing smart casual. Change "Dress level" in the form to see other options.' };
}

export function selectWardrobe(r: OutingRequest, decisions: Decision[], venue: VenueFacts | null): WardrobeResult {
  const has = (id: string) => decisions.some((d) => d.id === id);
  const heat = has('wear.breathable_fabric');
  const loose = has('wear.loose_fit');
  const sun = has('wear.sun_coverage');
  const wet = has('wear.wet_weather_footwear');
  const quickDry = has('wear.quick_dry');
  const acLayer = decisions.find((d) => d.id === 'wear.ac_layer');
  const { level, source, note } = inferFormality(r, venue);
  const lang = r.language;

  const assess = (g: GarmentIdea): WardrobeIdea => {
    const reasons: WardrobeIdea['reasons'] = [];
    const cautions: WardrobeIdea['cautions'] = [];
    let withCare = false;

    if (heat) {
      reasons.push({ text: `Pick it in ${g.breathableFabrics.join(', ')} for the heat and humidity`, decisionId: 'wear.breathable_fabric' });
      if (g.watchFabrics.length) cautions.push({ text: `Skip versions in ${g.watchFabrics.join(', ')} — they trap heat`, decisionId: 'wear.breathable_fabric' });
    }
    if (loose) reasons.push({ text: 'Choose a relaxed rather than fitted cut', decisionId: 'wear.loose_fit' });

    if (sun) {
      if (g.coverage === 'full') reasons.push({ text: 'Covers arms and legs for your time outdoors', decisionId: 'wear.sun_coverage' });
      else if (g.coverage === 'partial') cautions.push({ text: 'Add a light long-sleeve cover-up while outdoors', decisionId: 'wear.sun_coverage' });
      else {
        cautions.push({ text: 'Leaves most skin exposed — add a cover-up or pick a fuller option for long sun exposure', decisionId: 'wear.sun_coverage' });
        withCare = true;
      }
    }

    if (wet) {
      if (g.hem === 'floor') {
        cautions.push({ text: 'Floor-length hem will drag through wet ground — drape or pin it higher, or choose a shorter option', decisionId: 'wear.wet_weather_footwear' });
        withCare = true;
      } else if (g.hem === 'ankle') {
        cautions.push({ text: 'Ankle-length hem may catch splashes — keep it just above the ankle', decisionId: 'wear.wet_weather_footwear' });
      } else {
        reasons.push({ text: 'Hem stays clear of puddles and splashes', decisionId: 'wear.wet_weather_footwear' });
      }
      if (g.watchFabrics.some((f) => /silk|velvet|suede|brocade/i.test(f))) {
        cautions.push({ text: 'Rain can mark silk, velvet or brocade — choose a cotton or blended version', decisionId: 'wear.wet_weather_footwear' });
      }
    }
    if (quickDry && !wet) reasons.push({ text: 'Lighter weaves dry faster if you get caught in a shower', decisionId: 'wear.quick_dry' });

    return {
      id: g.id,
      name: g.name[lang],
      nameEn: g.name.en,
      pieces: g.pieces,
      fabrics: g.breathableFabrics,
      fit: withCare ? 'with_care' : 'good',
      reasons,
      cautions,
      layer: acLayer ? g.layer : undefined,
    };
  };

  const families = (Object.keys(FAMILY_LABELS) as Family[]).map((family) => ({
    family,
    label: FAMILY_LABELS[family][lang],
    ideas: CATALOGUE.filter((g) => g.family === family && g.formality.includes(level))
      .map(assess)
      .sort((a, b) => (a.fit === b.fit ? 0 : a.fit === 'good' ? -1 : 1)),
  })).filter((f) => f.ideas.length > 0);

  return {
    formality: level,
    formalitySource: source,
    formalityNote: note,
    inclusiveNote: 'Grouped by garment, not gender — every style here is for anyone who wants to wear it.',
    families,
  };
}
