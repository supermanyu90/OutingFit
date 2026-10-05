import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOutingWindow, nowInMumbai, floorHour, ceilHour, mumbaiLocalToUtc } from '../server/lib/time.ts';
import { validateForecast, getForecast, seedForecastCache, clearForecastCache, foldName, WeatherProviderError } from '../server/weather/openMeteo.ts';
import { buildOutingWeather } from '../server/weather/outingWindow.ts';
import { buildFixtureForecast } from '../server/weather/fixtures.ts';
import { runDecisionLayer, DecisionInput } from '../server/decision/engine.ts';
import { DEFAULT_DECISION_CONFIG } from '../server/decision/config.ts';
import { OutingRequestSchema, OutingRequest } from '../server/domain.ts';
import { AllowedNumbers, ungroundedNumbers, extractNumbers, devanagariShare } from '../server/gemma/grounding.ts';
import { validatePersonalized, buildAllowedNumbers } from '../server/gemma/personalize.ts';
import { liveWaterloggingStatus } from '../server/waterlogging.ts';
import { OutingSession, normaliseTime, readiness, spokenAgreement } from '../shared/outingSession.ts';

const NOW = new Date('2026-10-04T05:00:00Z'); // 10:30 IST
const TODAY = '2026-10-04';

function req(over: Partial<OutingRequest> = {}): OutingRequest {
  return OutingRequestSchema.parse({
    destination: { kind: 'place', name: 'Juhu', forecastPoint: { label: 'Juhu', lat: 19.1, lon: 72.82 } },
    date: TODAY,
    departure: '13:00',
    return: '17:00',
    ...over,
  });
}

function fixture(name: 'sunny_afternoon' | 'humid_rainy_evening') {
  return validateForecast(buildFixtureForecast(name, TODAY, 19.1, 72.82)).raw;
}

function decide(r: OutingRequest, fx: 'sunny_afternoon' | 'humid_rainy_evening' | null) {
  const weather = fx ? buildOutingWeather(fixture(fx), r, NOW) : null;
  const input: DecisionInput = {
    request: r,
    weather,
    weatherUsable: !!weather,
    weatherProblem: weather ? undefined : 'provider down',
    venue: null,
    waterlogging: liveWaterloggingStatus(),
  };
  return runDecisionLayer(input, DEFAULT_DECISION_CONFIG);
}
const ids = (r: ReturnType<typeof decide>) => r.decisions.map((d) => d.id);
const byId = (r: ReturnType<typeof decide>, id: string) => r.decisions.find((d) => d.id === id);

// ------------------------------------------------------------------- time
test('Mumbai time is UTC+05:30', () => {
  assert.deepEqual(nowInMumbai(new Date('2026-10-04T18:45:00Z')), { date: '2026-10-05', time: '00:15', localIso: '2026-10-05T00:15' });
  assert.equal(mumbaiLocalToUtc('2026-10-04T19:30'), '2026-10-04T14:00:00.000Z');
});

test('return before departure rolls to the next day', () => {
  const w = resolveOutingWindow({ date: '2026-10-04', departure: '21:00', return: '00:30' });
  assert.equal(w.end, '2026-10-05T00:30');
  assert.equal(w.returnsNextDay, true);
  assert.equal(w.durationMinutes, 210);
  assert.equal(floorHour('2026-10-04T12:30'), '2026-10-04T12:00');
  assert.equal(ceilHour('2026-10-04T23:30'), '2026-10-05T00:00');
});

// ------------------------------------------------------- forecast validation
test('validation rejects unexpected units', () => {
  const f: any = buildFixtureForecast('sunny_afternoon', TODAY, 19, 72.8);
  f.hourly_units.temperature_2m = '°F';
  assert.throws(() => validateForecast(f), WeatherProviderError);
});

test('implausible values become null (unavailable), never clamped', () => {
  const f: any = buildFixtureForecast('sunny_afternoon', TODAY, 19, 72.8);
  f.hourly.relative_humidity_2m[13] = 140;
  const v = validateForecast(f);
  assert.equal(v.raw.hourly.relative_humidity_2m![13], null);
  assert.match(v.warnings.join(), /implausible relative_humidity_2m/);
  const ow = buildOutingWeather(v.raw, req(), NOW);
  assert.equal(ow.whole!.humidityMaxPct, null, 'a max over a window with a missing hour is unavailable');
});

test('missing provider field is reported, not invented', () => {
  const f: any = buildFixtureForecast('sunny_afternoon', TODAY, 19, 72.8);
  delete f.hourly.wind_gusts_10m;
  const v = validateForecast(f);
  assert.match(v.warnings.join(), /wind_gusts_10m missing/);
  assert.equal(buildOutingWeather(v.raw, req(), NOW).departure!.gustKmh, null);
});

// ------------------------------------------------------------ outing window
test('outing window picks the hours that overlap departure → return', () => {
  const ow = buildOutingWeather(fixture('sunny_afternoon'), req({ departure: '12:30', return: '15:30' }), NOW);
  assert.equal(ow.status, 'ok');
  assert.deepEqual(ow.hourly.map((h) => h.time.slice(11, 16)), ['12:00', '13:00', '14:00', '15:00']);
  assert.equal(ow.departure!.time, `${TODAY}T12:00`);
  assert.equal(ow.whole!.uvIndexMaxHourly, 9);
  assert.equal(ow.whole!.uvIndexMaxHourlyAt, `${TODAY}T13:00`);
  assert.equal(ow.daily!.uvIndexMaxDaily, 9, 'daily max is reported separately');
});

test('explicit outdoor period is aggregated separately from transitions', () => {
  const ow = buildOutingWeather(fixture('sunny_afternoon'), req({ outdoorStart: '16:00', outdoorEnd: '17:00' }), NOW);
  assert.equal(ow.outdoor!.period.source, 'user');
  assert.equal(ow.outdoor!.aggregate!.uvIndexMaxHourly, 4.6);
  assert.equal(ow.whole!.uvIndexMaxHourly, 9);
});

test('dates beyond the 16-day horizon are explained, not guessed', () => {
  const ow = buildOutingWeather(fixture('sunny_afternoon'), req({ date: '2026-10-25' }), NOW);
  assert.equal(ow.status, 'beyond_horizon');
  assert.match(ow.statusMessage!, /not yet available/);
  assert.equal(ow.whole, null);
});

test('past outings are flagged', () => {
  assert.equal(buildOutingWeather(fixture('sunny_afternoon'), req({ date: '2026-10-03' }), NOW).status, 'in_past');
});

// ------------------------------------------------------------ decision layer
test('sunny + extended outdoor → sun coverage, sunscreen, hat, sunglasses with UV caveat; no rain gear', () => {
  const d = decide(req({ outdoorExposure: 'extended', outdoorStart: '13:30', outdoorEnd: '16:30' }), 'sunny_afternoon');
  for (const id of ['wear.sun_coverage', 'carry.sunscreen', 'carry.hat', 'carry.sunglasses', 'wear.breathable_fabric']) assert.ok(ids(d).includes(id), id);
  assert.ok(!ids(d).includes('carry.umbrella'));
  assert.equal(byId(d, 'carry.sunscreen')!.priority, 'essential');
  assert.match(byId(d, 'carry.sunglasses')!.productNote!, /UV400|ISO 12312-1/);
  assert.match(byId(d, 'wear.sun_coverage')!.productNote!, /not UV-rated/);
  const uvEv = byId(d, 'carry.hat')!.evidence.find((e) => e.kind === 'weather');
  assert.deepEqual([uvEv?.kind === 'weather' && uvEv.field, uvEv?.kind === 'weather' && uvEv.value], ['uv_index_max_hourly', 9]);
});

test('same sun but car with covered drop-off and minimal exposure → no UV gear', () => {
  const d = decide(req({ outdoorExposure: 'minimal', transport: 'car', coveredDropOff: 'yes' }), 'sunny_afternoon');
  assert.ok(!ids(d).some((i) => ['wear.sun_coverage', 'carry.sunscreen', 'carry.hat', 'carry.sunglasses'].includes(i)));
});

test('rainy evening + uncovered car walk → umbrella essential, rain jacket for gusts, wet-weather footwear', () => {
  const d = decide(req({ departure: '19:30', return: '22:30', coveredDropOff: 'no' }), 'humid_rainy_evening');
  assert.equal(byId(d, 'carry.umbrella')!.priority, 'essential');
  assert.ok(ids(d).includes('carry.rain_jacket'));
  assert.ok(ids(d).includes('wear.wet_weather_footwear'));
  assert.ok(!ids(d).includes('carry.sunscreen'));
});

test('covered drop-off downgrades rain protection to optional', () => {
  const d = decide(req({ departure: '19:30', return: '22:30', coveredDropOff: 'yes' }), 'humid_rainy_evening');
  assert.equal(byId(d, 'carry.umbrella')!.priority, 'optional');
  assert.ok(!ids(d).includes('wear.wet_weather_footwear'));
});

test('changing the weather changes the recommendations', () => {
  const r = req({ departure: '13:00', return: '17:00', outdoorExposure: 'moderate', coveredDropOff: 'no' });
  const sunny = new Set(ids(decide(r, 'sunny_afternoon')));
  const rainy = new Set(ids(decide(r, 'humid_rainy_evening')));
  assert.ok(sunny.has('carry.sunglasses') && !rainy.has('carry.sunglasses'));
  assert.ok(rainy.has('carry.umbrella') && !sunny.has('carry.umbrella'));
});

test('AC layer only from stated preference or confirmed condition', () => {
  const cold = decide(req({ feelsColdInAc: true, indoorAc: 'user_expects' }), 'sunny_afternoon');
  assert.equal(byId(cold, 'wear.ac_layer')!.priority, 'recommended');
  const unknown = decide(req({ feelsColdInAc: true, indoorAc: 'unknown' }), 'sunny_afternoon');
  assert.equal(byId(unknown, 'wear.ac_layer')!.priority, 'optional');
  assert.ok(ids(unknown).includes('check.indoor_ac'));
  const notCold = decide(req({ feelsColdInAc: false, indoorAc: 'confirmed' }), 'sunny_afternoon');
  assert.ok(!ids(notCold).includes('wear.ac_layer'));
});

test('colour is only mentioned when the user states a preference', () => {
  assert.ok(!ids(decide(req(), 'sunny_afternoon')).includes('wear.colour'));
  assert.ok(ids(decide(req({ colourPreference: 'pastels' }), 'sunny_afternoon')).includes('wear.colour'));
});

test('weather unavailable → no weather-based items, explicit notice', () => {
  const d = decide(req({ outdoorExposure: 'extended' }), null);
  assert.ok(ids(d).includes('check.weather_unavailable'));
  assert.ok(!ids(d).some((i) => /sun|umbrella|rain|breathable/.test(i)));
});

test('waterlogging is "unknown" without a sourced report, even when rain is likely', () => {
  const d = decide(req({ departure: '19:30', return: '22:30' }), 'humid_rainy_evening');
  assert.equal(byId(d, 'check.waterlogging')!.label, 'Local waterlogging status unknown');
});

// --------------------------------------------------------------- grounding
test('numbers are extracted including Devanagari digits and times', () => {
  assert.deepEqual(extractNumbers('UV ९ at 6:42, 33.5°C'), [9, 6, 42, 33.5]);
  const a = new AllowedNumbers().add(33.46).addTime('18:42');
  assert.deepEqual(ungroundedNumbers('feels like 33.5°C until 6:42', a), []);
  assert.deepEqual(ungroundedNumbers('UV 11 and 40% rain', a), [11, 40]);
  assert.ok(devanagariShare('आज धूप है UV') > 0.6);
});

test('Gemma output validation: coverage, grounding and script', () => {
  const r = req({ outdoorExposure: 'extended', language: 'hi' });
  const weather = buildOutingWeather(fixture('sunny_afternoon'), r, NOW);
  const d = runDecisionLayer({ request: r, weather, weatherUsable: true, venue: null, waterlogging: liveWaterloggingStatus() }, DEFAULT_DECISION_CONFIG).decisions;
  const allowed = buildAllowedNumbers(r, weather, d);
  const good = {
    items: d.map((x) => ({ id: x.id, title: 'शीर्षक', explanation: 'UV 9 के कारण' })),
    outfitSummary: 'हल्के सूती कपड़े पहनें',
    spokenSummary: 'धूप तेज़ है, UV 9 तक, सनस्क्रीन और टोपी साथ रखें',
    spokenCovers: d.filter((x) => x.priority === 'essential' || x.priority === 'recommended').map((x) => x.id),
  };
  assert.equal(validatePersonalized(good, d, 'hi', allowed).ok, true);

  const invented = { ...good, spokenSummary: 'आज 42 डिग्री और 70% बारिश' };
  const r1 = validatePersonalized(invented, d, 'hi', allowed);
  assert.equal(r1.ok, false);
  assert.match((r1 as any).errors.join(), /42/);

  const missing = { ...good, items: good.items.slice(1) };
  assert.match((validatePersonalized(missing, d, 'hi', allowed) as any).errors.join(), /missing item id/);

  const placeholder = { ...good, items: good.items.map((i) => ({ ...i, title: '…' })) };
  assert.match((validatePersonalized(placeholder, d, 'hi', allowed) as any).errors.join(), /placeholder/);

  const mixedScript = { ...good, outfitSummary: 'हल्के कपड़े অনুভব' };
  assert.match((validatePersonalized(mixedScript, d, 'hi', allowed) as any).errors.join(), /another Indic script/);

  const english = { ...good, spokenSummary: 'Strong sun, UV 9, bring sunscreen' };
  assert.match((validatePersonalized(english, d, 'hi', allowed) as any).errors.join(), /Devanagari/);
});

// ------------------------------------------------------------ cache & stale
test('provider failure serves a recent cached forecast marked stale, never as live', async () => {
  clearForecastCache();
  const fx = validateForecast(buildFixtureForecast('sunny_afternoon', TODAY, 19.1, 72.82));
  const t = Date.now();
  seedForecastCache(19.1, 72.82, fx, t - 40 * 60_000);
  const failing = (async () => {
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;
  const res = await getForecast(19.1, 72.82, { timeoutMs: 100, fetchImpl: failing, nowMs: t });
  assert.equal(res.stale, true);
  assert.equal(res.cacheAgeSeconds, 2400);
  assert.match(res.staleReason!, /ECONNRESET/);
});

test('provider failure with no recent cache throws (weather unavailable)', async () => {
  clearForecastCache();
  const failing = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(getForecast(19.1, 72.82, { timeoutMs: 100, fetchImpl: failing }), /HTTP 503/);
});

test('fresh cache is reused within the TTL', async () => {
  clearForecastCache();
  const fx = validateForecast(buildFixtureForecast('sunny_afternoon', TODAY, 19.1, 72.82));
  const t = Date.now();
  seedForecastCache(19.1, 72.82, fx, t - 60_000);
  const never = (async () => assert.fail('should not fetch')) as unknown as typeof fetch;
  const res = await getForecast(19.1, 72.82, { timeoutMs: 100, fetchImpl: never, nowMs: t });
  assert.deepEqual([res.fromCache, res.stale, res.cacheAgeSeconds], [true, false, 60]);
});

test('place names fold diacritics for matching', () => {
  assert.equal(foldName('Bāndra'), 'bandra');
  assert.equal(foldName('Colāba'), 'colaba');
});

// ------------------------------------------------------ agent client tools
test('agent tools normalise times and require confirmation before advice', async () => {
  const s = new OutingSession('http://x', 'hi', {}, (async () => new Response('{}')) as any);
  assert.equal(normaliseTime('7:30 PM'), '19:30');
  assert.equal(normaliseTime('25:00'), null);
  const snap = JSON.parse(await s.setOutingDetails({ date: '2026-10-05', departure_time: '7 pm', return_time: '23:00' }));
  assert.equal(snap.departure_time, '19:00');
  assert.ok(snap.missing.includes('confirmation of date and times'));
  assert.equal(JSON.parse(await s.getOutingAdvice()).status, 'not_ready');
  s.update({ destination: { kind: 'place', name: 'Juhu', forecastPoint: { label: 'Juhu', lat: 19.1, lon: 72.82 } }, destinationStatus: 'resolved' });
  await s.confirmDetails();
  assert.equal(readiness(s.form).ready, true);
  await s.setOutingDetails({ return_time: '23:30' });
  assert.equal(s.form.scheduleConfirmed, false, 'changing a time requires re-confirmation');
});

test('choose_destination accepts option numbers and names', async () => {
  const s = new OutingSession('http://x', 'en');
  const mk = (id: string, name: string, sub: string) => ({
    id,
    destination: { kind: 'registry' as const, name, forecastPoint: { label: sub, lat: 19, lon: 72.8 } },
    subtitle: sub,
    source: 'registry' as const,
  });
  s.update({ destinationStatus: 'ambiguous', candidates: [mk('a', 'Bastian - At The Top', 'Dadar West'), mk('b', 'Bastian (Bandra West)', 'Bandra')] });
  assert.equal(JSON.parse(await s.chooseDestination({ choice: 'Dadar' })).destination, 'Bastian - At The Top');
  s.update({ destinationStatus: 'ambiguous', destination: null });
  assert.equal(JSON.parse(await s.chooseDestination({ choice: '2' })).destination, 'Bastian (Bandra West)');
  s.update({ destinationStatus: 'ambiguous', destination: null });
  assert.ok(JSON.parse(await s.chooseDestination({ choice: 'Bastian' })).error, 'ambiguous choice is refused');
});

test('confirm_details fetches the advice itself once everything is ready', async () => {
  const calls: string[] = [];
  const fakeFetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ spoken: { text: 'Bring an umbrella.' }, weather: { dataStatus: 'live' } }), { status: 200 });
  }) as unknown as typeof fetch;
  const s = new OutingSession('http://x', 'en', {}, fakeFetch);
  s.update({ destination: { kind: 'place', name: 'Juhu', forecastPoint: { label: 'Juhu', lat: 19.1, lon: 72.82 } }, destinationStatus: 'resolved', date: '2026-10-05', departure: '19:00', return: '23:00' });
  const out = JSON.parse(await s.confirmDetails());
  assert.equal(out.advice.status, 'ok');
  assert.equal(out.advice.spoken_summary, 'Bring an umbrella.');
  assert.ok(calls.some((u) => u.endsWith('/api/v2/outing')));
});

test('spoken agreement measures how much of the summary was said', () => {
  const summary = 'Bring a compact umbrella; rain chance reaches 85%.';
  assert.ok(spokenAgreement(`${summary} The full cards are on screen.`, summary) > 0.95);
  assert.ok(spokenAgreement('It will be sunny, wear shorts.', summary) < 0.6);
  // Numbers spoken as words and names transliterated still count as the same summary.
  const hi = 'Bastian - At The Top के लिए 33.7°C तापमान और 84% आर्द्रता के कारण ढीले कपड़े पहनें।';
  const saidHi = 'बैस्टियन - एट द टॉप के लिए तैंतीस दशमलव सात डिग्री सेल्सियस तापमान और चौरासी प्रतिशत आर्द्रता के कारण ढीले कपड़े पहनें।';
  assert.ok(spokenAgreement(saidHi, hi) > 0.95, String(spokenAgreement(saidHi, hi)));
  assert.ok(spokenAgreement('बैस्टियन के लिए धूप तेज़ है, शॉर्ट्स पहनें।', hi) < 0.6);
});

// ---------------------------------------------------------------- wardrobe
import { selectWardrobe } from '../server/wardrobe/select.ts';

test('wardrobe: formal + rain → floor-length sarees flagged, dresses/suits/Indian wear all offered', () => {
  const r = req({ departure: '19:30', return: '22:30', coveredDropOff: 'no', formality: 'formal' });
  const d = decide(r, 'humid_rainy_evening').decisions;
  const w = selectWardrobe(r, d, null);
  assert.equal(w.formality, 'formal');
  assert.deepEqual(w.families.map((f) => f.family).sort(), ['coords_jumpsuits', 'dresses_skirts', 'indian_wear', 'shirts_trousers']);
  const saree = w.families.flatMap((f) => f.ideas).find((i) => i.id === 'silk_saree')!;
  assert.equal(saree.fit, 'with_care');
  assert.ok(saree.cautions.some((c) => /Floor-length/.test(c.text)));
  assert.ok(saree.cautions.some((c) => /silk/.test(c.text)));
  const suit = w.families.flatMap((f) => f.ideas).find((i) => i.id === 'light_suit')!;
  assert.equal(suit.fit, 'good');
  assert.ok(!w.families.flatMap((f) => f.ideas).some((i) => i.id === 'sundress'), 'casual-only items excluded at formal');
  assert.match(w.inclusiveNote, /not gender/);
});

test('wardrobe: sunny + extended outdoors → full-coverage ideas preferred, minimal-coverage flagged', () => {
  const r = req({ outdoorExposure: 'extended', outdoorStart: '13:30', outdoorEnd: '16:30', formality: 'casual' });
  const w = selectWardrobe(r, decide(r, 'sunny_afternoon').decisions, null);
  const ideas = w.families.flatMap((f) => f.ideas);
  assert.equal(ideas.find((i) => i.id === 'sundress')!.fit, 'with_care');
  assert.ok(ideas.find((i) => i.id === 'kurta_pyjama')!.reasons.some((x) => /Covers arms and legs/.test(x.text)));
  assert.ok(ideas.every((i) => i.reasons.some((x) => x.decisionId === 'wear.breathable_fabric')), 'every idea carries the heat-based fabric reason');
});

test('wardrobe: AC layer only when the decision layer asked for one; dress level inferred and labelled', () => {
  const r1 = req({ departure: '20:00', return: '23:00', feelsColdInAc: true, indoorAc: 'user_expects', occasion: 'Wedding reception' });
  const w1 = selectWardrobe(r1, decide(r1, 'sunny_afternoon').decisions, null);
  assert.equal(w1.formalitySource, 'occasion');
  assert.equal(w1.formality, 'formal');
  assert.ok(w1.families.flatMap((f) => f.ideas).every((i) => i.layer));
  const r2 = req({ departure: '20:00', return: '23:00' });
  const w2 = selectWardrobe(r2, decide(r2, 'sunny_afternoon').decisions, null);
  assert.equal(w2.formalitySource, 'default');
  assert.ok(w2.families.flatMap((f) => f.ideas).every((i) => !i.layer));
});

// ---------------------------------------------------------- restaurants (OSM)
import { searchRestaurants, searchRestaurantsLive, restaurantCount } from '../server/places/restaurants.ts';

test('restaurant snapshot covers Mumbai well beyond the curated registry', () => {
  assert.ok(restaurantCount() > 1500, String(restaurantCount()));
});

test('restaurant search: exact name, branches, area narrowing, sentences and typos', () => {
  const names = (q: string) => searchRestaurants(q).restaurants.map((r) => `${r.name} @ ${r.locality}`);
  assert.deepEqual(names('Cafe Madras'), ['Cafe Madras @ Matunga East']);
  assert.ok(names('mahesh lunch home').length >= 2, 'every branch is offered');
  assert.deepEqual(names('mahesh lunch home juhu'), ['Mahesh Lunch Home @ Juhu']);
  assert.deepEqual(names('Bombay Canteen'), ['The Bombay Canteen @ Lower Parel'], 'a leading "The" is optional');
  assert.equal(searchRestaurants('dinner at cafe madras tonight').tier, 2);
  assert.ok(names('Britania').some((n) => n.startsWith('Britannia')), 'one-letter slip');
  assert.deepEqual(names('zzqx nothing'), [], 'a stray word does not match on the other word alone');
});

test('live restaurant search keeps only Mumbai eateries and reports HTTP failures', async () => {
  const fake = (async () =>
    new Response(
      JSON.stringify([
        { osm_type: 'node', osm_id: 1, lat: '19.1', lon: '72.83', category: 'amenity', type: 'restaurant', name: 'New Place', address: { suburb: 'Juhu' } },
        { osm_type: 'way', osm_id: 2, lat: '19.1', lon: '72.83', category: 'highway', type: 'residential', name: 'New Place Road' },
      ]),
      { status: 200 }
    )) as unknown as typeof fetch;
  const r = await searchRestaurantsLive('new place test', 1000, fake);
  assert.deepEqual(r, [{ id: 'n1', name: 'New Place', type: 'restaurant', locality: 'Juhu', lat: 19.1, lon: 72.83 }]);
  const down = (async () => new Response('busy', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(searchRestaurantsLive('another test', 1000, down), /HTTP 503/);
});

test('a restaurant destination validates with its own coordinates', () => {
  const r = req({ destination: { kind: 'restaurant', venueId: 'n1977933168', name: 'Cafe Madras', forecastPoint: { label: 'Cafe Madras, Matunga East (OpenStreetMap)', lat: 19.02767, lon: 72.85505 } } });
  assert.equal(r.destination.kind, 'restaurant');
});
