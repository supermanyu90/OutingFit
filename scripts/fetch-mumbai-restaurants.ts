/**
 * Rebuilds server/data/mumbaiRestaurants.json — every named eatery OpenStreetMap
 * knows in Greater Mumbai, with its own coordinates and nearest neighbourhood.
 *
 *   npx tsx scripts/fetch-mumbai-restaurants.ts
 *
 * Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 */

import { writeFileSync } from 'node:fs';

const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const BBOX = '18.85,72.75,19.35,73.15'; // south,west,north,east — Colaba to Mira Road, Vashi
const AMENITIES = 'restaurant|cafe|fast_food|bar|pub|food_court|ice_cream';
const OUT = new URL('../server/data/mumbaiRestaurants.json', import.meta.url);

const query = `[out:json][timeout:180];
(
  nwr["amenity"~"^(${AMENITIES})$"]["name"](${BBOX});
  node["place"~"^(suburb|neighbourhood|quarter)$"]["name"](${BBOX});
);
out center tags;`;

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

async function runQuery(): Promise<Response> {
  const errors: string[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'OutingFit/1.0 (restaurant snapshot)' },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return res;
      errors.push(`${url}: HTTP ${res.status}`);
    } catch (err: any) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(`Every Overpass server failed:\n${errors.join('\n')}`);
}

const res = await runQuery();
const elements = ((await res.json()) as { elements: OsmElement[] }).elements;

const point = (e: OsmElement) => (e.center ? e.center : { lat: e.lat!, lon: e.lon! });
const localities = elements.filter((e) => e.tags.place).map((e) => ({ name: e.tags.name, ...point(e) }));

function nearestLocality(lat: number, lon: number): string {
  let best = '';
  let bestD = Infinity;
  for (const l of localities) {
    const d = (l.lat - lat) ** 2 + ((l.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) [best, bestD] = [l.name, d];
  }
  return best;
}

const restaurants = elements
  .filter((e) => e.tags.amenity && !['private', 'no'].includes(e.tags.access ?? ''))
  .map((e) => {
    const { lat, lon } = point(e);
    const t = e.tags;
    const aliases = [t['name:en'], t.alt_name, t.official_name, t.brand, t.old_name]
      .flatMap((a) => (a ? a.split(';') : []))
      .map((a) => a.trim())
      .filter((a, i, all) => a && a !== t.name && all.indexOf(a) === i);
    return {
      id: `${e.type[0]}${e.id}`,
      name: t.name.trim(),
      ...(aliases.length ? { aliases } : {}),
      type: t.amenity,
      ...(t.cuisine ? { cuisine: t.cuisine.split(';').map((c) => c.trim().replace(/_/g, ' ')) } : {}),
      locality: t['addr:suburb'] || nearestLocality(lat, lon),
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  // OSM sometimes maps one place twice (a node and a building outline): same name within ~100 m.
  .filter((r, i, all) => !all.slice(0, i).some((o) => o.name.toLowerCase() === r.name.toLowerCase() && Math.abs(o.lat - r.lat) < 0.001 && Math.abs(o.lon - r.lon) < 0.001));

writeFileSync(
  OUT,
  JSON.stringify({
    source: 'OpenStreetMap via Overpass API',
    license: 'Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    fetchedAt: new Date().toISOString(),
    count: restaurants.length,
    restaurants,
  }) + '\n'
);
console.log(`Wrote ${restaurants.length} eateries (${localities.length} localities used for labels) to ${OUT.pathname}`);
