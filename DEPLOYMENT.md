# Deploying OutingFit to Render

OutingFit runs as **one Render Node web service**: Express serves the built React app and the `/api/v2` API, and all API keys stay on the server. The browser only ever receives short-lived ElevenLabs conversation tokens. See [README.md](README.md) for how the pipeline works.

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) that sets up the service:

| Setting | Value | Why |
|---|---|---|
| Region | `singapore` | Closest Render region to Mumbai |
| Build | `npm ci --include=dev && npm run build` | The Vite/Tailwind build needs dev dependencies; `NODE_ENV=production` would otherwise skip them |
| Start | `npm start` | `NODE_ENV=production tsx server.ts`, which serves `dist/` |
| Health check | `/healthz` | |
| Node | `22.14.0` | Install, build and run checked on this version |
| Plan | `starter` | Free instances spin down when idle; the first request after that takes a long time, which breaks voice-tool timeouts |

## 1. Before you start

You need the values from your working local `.env`:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` and `ELEVENLABS_AGENT_ID_MR`, both created by `npm run setup:agent`
- `ELEVENLABS_VOICE_ID`

The ElevenLabs agents live in your ElevenLabs account, not on Render. The deployed app uses the same two agents as your local one, so don't run `setup:agent` again for Render.

## 2. Create the service (Blueprint)

1. Push to GitHub. `render.yaml` must be on the branch Render deploys from (`main`).
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**, then pick the `supermanyu90/OutingFit` repository.
3. Render reads `render.yaml` and asks for every `sync: false` value. Paste:
   - `GEMINI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID` (the main agent: English + Hindi)
   - `ELEVENLABS_AGENT_ID_MR` (the Marathi agent)
   - `ELEVENLABS_VOICE_ID`
   - `SERPAPI_API_KEY` is optional: it turns on the Google Maps fallback for restaurants OpenStreetMap doesn't know (paid per search). `SENTRY_DSN` is optional too. Leave either blank if unused.
4. **Apply.** Render builds and deploys. Later pushes to `main` redeploy automatically (`autoDeploy: true`).

Everything else is already set in `render.yaml`:
- `OLLAMA_URL=off`, so there's no local-Gemma fallback on Render.
- `GEMMA_MODEL=gemma-4-26b-a4b-it` with `GEMMA_THINKING_LEVEL=minimal`.
- The per-language agent flags (`ELEVENLABS_AGENT_LANG_*=ok`) and timeouts.

> Never put keys in `render.yaml` or commit `.env`. Keys entered in the Dashboard are stored encrypted by Render.

## 3. Verify before calling it live

1. **Health:** `curl https://<app>.onrender.com/healthz` should return `"environment":"production"`, `inference.primary.model = gemma-4-26b-a4b-it`, `voice.agentConfigured = true`, and `restaurants.count` above 2,000, and `restaurants.googleMapsFallback = true` if you set `SERPAPI_API_KEY`.
   Then check a restaurant that only OpenStreetMap knows: `curl "https://<app>.onrender.com/api/v2/destinations/resolve?q=Cafe%20Madras"` should resolve to Cafe Madras, Matunga East.
2. **End-to-end:** run the scenarios against the deployment:
   ```bash
   BASE=https://<app>.onrender.com npm run test:scenarios
   ```
   This writes `docs/TEST_RESULTS.md`. Don't treat the deployment as live until scenarios 1–5 pass there.
3. **In a browser:** on the deployed site, use **Talk** in each language once. Your browser will ask for microphone permission, which it only allows on HTTPS; Render provides HTTPS.
4. **Optional hardening:** in the ElevenLabs dashboard, add your Render domain to each agent's allowed hosts. Both agents already require a server-issued token (`enable_auth: true`).

## 4. Operational notes

- **Gemma failures.** If the Gemini API is slow or overloaded, the app stops trying it for 2 minutes (`GEMINI_BREAKER_MS`). The cards then show the rule engine's English wording with a visible notice. Nothing is labelled as Gemma unless Gemma wrote it.
- **Caches.** The forecast cache (10 min, served as **stale** for up to 3 h if Open-Meteo fails) is held in memory. It's reset on every deploy or restart, and isn't shared if you scale to multiple instances.
- **Open-Meteo licence.** The free tier is **non-commercial only** (under 10,000 calls/day). A commercial launch needs an Open-Meteo API subscription; weather data must be credited to Open-Meteo under CC BY 4.0, as the app already does.
- **Restaurant list.** Every Mumbai eatery on OpenStreetMap ships in `server/data/mumbaiRestaurants.json`, so Render needs no extra service or key. To pick up newly mapped places, run `npm run data:restaurants` locally and push; Render redeploys. Names not in the snapshot are searched live on Nominatim, whose usage policy allows at most 1 request a second. The app enforces that limit and caches results for 24 h. Credit to OpenStreetMap (ODbL) is shown next to each result.
- **Google Maps fallback.** To turn it on for an existing service, add `SERPAPI_API_KEY` under **Environment** in the Render dashboard and save; Render restarts the service. Each search Google answers costs one SerpApi search, so watch usage on your SerpApi dashboard.
- **Changing the agents.** After editing `scripts/agentConfig.ts`, run `npm run setup:agent` locally. It updates the same agents in place, so Render needs no change.
