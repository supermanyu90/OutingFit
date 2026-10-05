# OutingFit

Weather-grounded outfit and packing advice for outings in Mumbai, in **English, Hindi and Marathi**, by voice or text.

```
 speak / dictate / type ──► ElevenLabs (agent · Scribe STT) ──► outing form (visible, editable)
                                                                   │  confirm place + date/times
                                                                   ▼
             Open-Meteo forecast for the outing window ──► decision rules (config.ts) ──► Gemma
                                                                   │                     (explains,
                                                                   ▼                      localises)
              Wear / Carry / Check cards + spoken summary ◄── validation (schema, coverage, numbers, script)
                                                                   │
                                          ElevenLabs TTS / agent speaks exactly that summary
```

## How it works

1. **Input.** The user talks to an ElevenLabs agent, dictates (Scribe v2 speech-to-text, with an editable transcript) or types. Gemma extracts the fields from dictated or typed text. The agent fills them itself through client tools. Either way the form on screen shows exactly what was understood.
2. **Confirmation.** Weather is not fetched until the destination is unambiguous and the date and times are confirmed. "Bastian" matches two branches. Hindi "कल" can mean yesterday or tomorrow.
3. **Weather.** The forecast point is the restaurant's own OpenStreetMap coordinates, or for curated venues and plain localities, the GeoNames locality. The Open-Meteo hourly forecast is validated: schema, units and plausible ranges. The app then takes the hours for departure, any explicit outdoor period, and return.
4. **Decision layer** (`server/decision/engine.ts`, thresholds in `server/decision/config.ts`). Deterministic rules turn the weather values and stated preferences into Wear, Carry and Check items. Each item carries its evidence, for example "UV 9 at 13:00 (rule ≥ 6)" or "you said: covered drop-off = no".
5. **Gemma** writes a short title and explanation for each item, an outfit idea and a 60-word spoken summary, in the selected language. It cannot add, drop or re-prioritise items. The output is rejected and retried once if:
   - it misses an item,
   - a number doesn't come from the input data,
   - Hindi or Marathi text isn't in Devanagari,
   - placeholders were left in.
6. **Voice output.** `/api/v2/voice/speak` only voices summaries the backend just generated. In a voice conversation, the agent receives the summary from the `get_outing_advice` tool and is told to read it word for word. The UI shows how much of the summary the agent actually said.

## Run locally

```bash
npm install
cp .env.example .env          # add GEMINI_API_KEY and ELEVENLABS_API_KEY
ollama pull gemma3:4b          # optional local Gemma fallback
npm run setup:agent            # creates the ElevenLabs agent + tools, verifies en/hi/mr, writes IDs to .env
npm run dev                    # http://localhost:3000
```

Checks:

```bash
npm run lint                   # TypeScript
npm test                       # unit tests (decision rules, validation, time zone, cache, agent tools)
npm run test:scenarios         # end-to-end against a running server (BASE=http://localhost:3000)
```

`test:scenarios` writes the actual results to `docs/TEST_RESULTS.md`.

## Deploy

Render, via the `render.yaml` Blueprint — see [DEPLOYMENT.md](DEPLOYMENT.md).

## Configuration

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMMA_MODEL` | Gemma 4 on the Gemini API (default `gemma-4-31b-it`) |
| `OLLAMA_URL`, `OLLAMA_GEMMA_MODEL` | Local Gemma fallback (`off` to disable) |
| `ELEVENLABS_API_KEY` | STT, TTS, agent. Stays on the server; the browser gets short-lived conversation tokens |
| `ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_AGENT_LANG_*` | Written by `npm run setup:agent` |
| `WEATHER_CACHE_TTL_SECONDS` / `WEATHER_STALE_MAX_SECONDS` | Forecast cache (10 min) and the oldest forecast that may be shown as **stale** (3 h) |
| `DECISION_CONFIG_JSON` | Override any decision threshold |

## What each provider supports (checked against official docs, 2026-10-04)

| | English | Hindi | Marathi |
|---|---|---|---|
| ElevenLabs Scribe v2 STT | ✓ | ✓ (WER band >5–10%) | ✓ (WER band >5–10%) |
| ElevenLabs TTS | all models | multilingual v2, flash v2.5, v3, v4 | **v3 / v4 only** |
| ElevenLabs agent | ✓ | ✓ (flash v2.5 or v3 Conversational) | **only with `eleven_v3_conversational`** (not in Flash v2.5) |
| Mixed-language speech | — | `hinglish_mode` exists for agent replies; code-switching in STT is **not documented** | not documented |

- **The agent's built-in LLM list has no Gemma.** The ElevenLabs agent uses a hosted LLM (`gemini-2.5-flash`) for dialogue only. Recommendations come from the OutingFit backend through client tools.
- **Agent language is fixed for the whole call.** Switching languages means starting a new conversation.
- **Open-Meteo:**
  - every requested field is available,
  - hourly data in India (15-minutely data is native only in Europe and North America),
  - rain probability comes from ~27 km ensemble models,
  - 16-day horizon,
  - CC BY 4.0 attribution,
  - the free tier is **non-commercial**, with fewer than 10,000 calls a day. Commercial use needs a paid plan.
- **Geocoding (GeoNames via Open-Meteo)** finds localities, not venues. Curated venues use the nearest locality, shown as "forecast point".
- **Restaurants (OpenStreetMap)**: every named eatery OSM has in Greater Mumbai (restaurants, cafés, fast food, bars, pubs, food courts, ice cream; about 2,100 places) ships as a snapshot in `server/data/mumbaiRestaurants.json`. When the snapshot has no match, the app asks Nominatim live (at most 1 request a second, results cached for 24 h). Data © OpenStreetMap contributors, ODbL; the attribution is shown next to every result. Refresh the snapshot with `npm run data:restaurants`. OSM doesn't list every Mumbai restaurant (Gajalee, for example, is missing), and it has no valet, dress-code or AC facts.

## Completed vs planned

**Completed and tested.** `docs/TEST_RESULTS.md` has the latest run.

- Open-Meteo forecast for the actual outing window:
  - validation, a 10-minute cache with visible timestamps, and stale/unavailable states,
  - "unavailable" shown for any missing field,
  - hourly UV kept separate from the daily maximum,
  - current conditions labelled as a model estimate, not an observation,
  - an explanation when the date is beyond the forecast horizon.
- Destination resolution across the curated registry, every OpenStreetMap restaurant in Mumbai and GeoNames localities, with an ambiguity prompt for branches ("Mahesh Lunch Home") and a "add the area" hint when there are many ("Starbucks"). Date and time confirmation (Asia/Kolkata, return after midnight handled).
- A configurable decision layer, plus Gemma personalisation with output validation and real-Gemma fallback (Gemini API, then local Ollama).
- **Wardrobe ideas**: concrete outfits grouped by garment family, not gender. The families are dresses & skirts, shirts & trousers, Indian wear (kurta sets, anarkali, sarees, Nehru jacket, bandhgala) and co-ords & jumpsuits. They're filtered by dress level (chosen, or taken from the venue dress code or occasion) and annotated from the same decisions: fabric for heat, coverage for UV, hem length and fabric for rain, and a matching layer for AC (`server/wardrobe/`).
- Wear / Carry / Check cards with evidence chips, product-evidence caveats (UV400/ISO 12312-1, UPF, SPF 30), and "Already own this?" toggles.
- Waterlogging kept separate from rain. With no source it shows "Local waterlogging status unknown". The demo report appears only in the labelled test scenario.
- Voice:
  - ElevenLabs agent with four client tools,
  - Scribe dictation with an editable transcript,
  - TTS spoken summary,
  - mute mic, mute agent, stop playback, and a text-only mode,
  - microphone access requested only after a click.
- Five labelled test scenarios in the UI and in `scripts/run-scenarios.ts`.

**Planned / not done**

- No live municipal waterlogging feed. No public API with documented terms was found.
- Venue facts (dress code, drop-off) exist only for the small curated registry and are marked *unconfirmed*. OpenStreetMap restaurants have none. AC is used only when the user states it.
- Mixed-language speech is supported only as far as the providers handle it. OutingFit doesn't add code-switching handling of its own.
- The agent dialogue LLM is not Gemma. An ElevenLabs custom-LLM integration pointing at Gemma's OpenAI-compatible endpoint is possible but not built or tested.
- The old Sentry telemetry modal and its fabricated "failure evidence" narrative were removed from the UI. The `/api/telemetry/*` endpoints still exist but are not wired into the new pipeline.
- Number grounding catches invented numbers, but not a correct number given the wrong label (e.g. calling feels-like "temperature"). Use Gemma 4 31B rather than the 4B fallback for best wording.
