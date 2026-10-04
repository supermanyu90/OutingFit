# OutingFit — Render Deployment Guide & Architecture

This guide details the deployment of **OutingFit** to [Render](https://render.com) using its official Web Service and Blueprint specifications.

---

## 1. Selected Architecture & Gemma Inference Location

### Architecture Overview
OutingFit uses a **Unified Full-Stack Node.js Architecture** on Render:
- **Frontend**: Mobile-first responsive React SPA bundled with Vite, served statically in production via Express.
- **Backend API**: Express server (`server.ts`) hosting REST endpoints for venue disambiguation, municipal waterlogging logs, and weather synthesis.
- **Provider Adapter**: `GemmaProviderAdapter` (`server/adapters/recommendationAdapter.ts`) implementing the `RecommendationAdapter` interface.

```
[ Browser / Client ] 
        │ (HTTPS)
        ▼
[ Render Web Service (Express + Node.js 22) ]
        ├── /healthz (Health Check)
        ├── /api/destinations (Verified Venue Registry)
        ├── /api/waterlogging (BMC Municipal Feed)
        └── /api/recommend (Recommendation Endpoint)
                 │
                 ▼
        [ GemmaProviderAdapter ] 
                 │
                 ├──► Remote Gemma 4 31B (`@google/genai` API SDK)
                 └──► Resilient Deterministic Grounding Engine (0ms fallback)
```

### Where Inference Runs
1. **Server-Side Execution**: All model inference is executed strictly on the server within the Render Node.js environment. No model endpoints, tokens, or API keys are ever sent to or executed inside the user's browser.
2. **Inference Location**:
   - The `GemmaProviderAdapter` interfaces with Google AI's hosted infrastructure for Gemma open-weights inference (`models/gemma-4-31b-it`).
   - If an external inference endpoint experiences high latency or outage, inference automatically fails over to the local deterministic evidence engine inside the Render container, ensuring sub-second response times without outing disruption.
3. **Secret Encapsulation**: The `GEMINI_API_KEY` is loaded from Render's encrypted environment secrets into `process.env.GEMINI_API_KEY` at runtime.

---

## 2. Configuration & Secret Handling

### Environment Variables Matrix

| Variable | Type | Default | Required on Render | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `production` | Yes | Runs Express in production mode, serving pre-built Vite assets |
| `NODE_VERSION` | String | `22.14.0` | Yes | Specifies Node.js LTS engine on Render |
| `PORT` | Number | `10000` | Auto-injected | Render automatically assigns the public port |
| `GEMINI_API_KEY` | Secret | None | Yes | API key for Gemma / Gemini inference via `@google/genai` |
| `WEATHER_API_TIMEOUT_MS` | Number | `5000` | Optional | AbortController timeout threshold for external Open-Meteo calls |
| `INFERENCE_TIMEOUT_MS` | Number | `8000` | Optional | SLA timeout threshold before engaging fallback engine |
| `APP_URL` | URL | Service URL | Optional | Public canonical domain of the Render deployment |

> **Security Rule**: `GEMINI_API_KEY` must **never** be committed to Git or hardcoded in `render.yaml`. In `render.yaml`, it is flagged with `sync: false`, requiring it to be populated directly in the Render Dashboard under **Environment Secrets**.

---

## 3. Render Deployment Instructions

### Method A: Deploy via Render Blueprint (Recommended)
1. Push this repository to GitHub or GitLab.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Navigate to **Blueprints** → **New Blueprint Instance**.
4. Select your OutingFit repository. Render will automatically read `render.yaml`.
5. Under Environment Variables, input your secret `GEMINI_API_KEY`.
6. Click **Apply**. Render will automatically provision:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/healthz`

### Method B: Manual Web Service Creation
1. In the Render Dashboard, click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the following fields:
   - **Name**: `outingfit-mumbai`
   - **Environment**: `Node`
   - **Region**: `Oregon` or `Singapore` (closest to Mumbai users)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Starter` (or `Free`)
4. Click **Advanced** and configure:
   - **Health Check Path**: `/healthz`
5. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `NODE_VERSION`: `22.14.0`
   - `GEMINI_API_KEY`: *(Your Google AI Studio API Key)*
   - `WEATHER_API_TIMEOUT_MS`: `5000`
   - `INFERENCE_TIMEOUT_MS`: `8000`
6. Click **Create Web Service**.

---

## 4. Verification Checklist (Post-Deployment)

*Do not describe the deployment as live until both verification tests pass on the deployed URL.*

### Check 0: Health Check Verification
Run against your deployed URL:
```bash
curl -i https://<your-app-name>.onrender.com/healthz
```
- [ ] Returns HTTP `200 OK`
- [ ] Returns JSON containing `{"status":"ok", "service":"OutingFit", "inference":{"status":"operational"}}`

### Check 1: Successful Outing Recommendation
1. Open `https://<your-app-name>.onrender.com` on a mobile or desktop browser.
2. In the search box, enter `Olive Bandra` (or click the quick tag).
3. Set Departure to `12:30 PM`, Return to `03:30 PM`, Occasion to `Casual Lunch`, and Walking to `Minimal`.
4. Click **Generate Wear, Carry & Check Advice for Her**.
- [ ] **Wear Card**: Displays solar-reflective fabrics (Mulmul, Linen), UV defense coverage, and non-slip sandals.
- [ ] **Carry Card**: Displays UV400 sunglasses, SPF 50+, and windshield sunshade.
- [ ] **Check Card**: Displays verified valet presence and open courtyard status for Olive Bar & Kitchen.
- [ ] Response latency is logged in metadata under 500ms.

### Check 2: Dependency Failure & Degraded State Verification
1. On the app home screen, look at the **Verification Checklist** ribbon above the input form.
2. Click **Test Weather Station Failure**.
- [ ] The app preserves all user inputs (Destination: Olive Bandra, Departure: 12:30 PM, Walking: Minimal).
- [ ] An amber **Dependency Degradation Notice** appears stating:
  > *"Weather Information Unavailable: Live weather station timed out after 5000ms. Recommendations are grounded in calibrated Mumbai maritime seasonal baseline data."*
- [ ] An explicit **"User Inputs Preserved"** badge is visible.
3. Click **Test Inference SLA Timeout**.
- [ ] The app preserves all inputs and clearly displays:
  > *"Inference Status: Central Gemma LLM provider took longer than 8000ms SLA. Grounded via OutingFit deterministic evidence rules."*
- [ ] Recommendations are still completely displayed using the verified evidence engine without breaking the UI.
4. Click **Reset Live** to return to live mode.

---

## 5. Sentry Agent Tracing & Telemetry Architecture

### Official SDK Integration
- **SDK**: `@sentry/node` (v11.4.0) initialized with OpenTelemetry GenAI agent tracing semantics.
- **Instrumented Spans**:
  1. `destination.resolve` (`ai.tool.call`): Disambiguating venue name and resolving registry records.
  2. `weather.fetch` (`http.client`): Open-Meteo call, latency, and fallback tracking.
  3. `search.serpapi` (`ai.tool.call`): SerpApi entity search with untrusted input sanitization.
  4. `gemma.inference` (`ai.run`): Model inference on `models/gemma-4-31b-it`.
  5. `output.validate_schema` (`ai.evaluation`): Verifying Wear, Carry, Check schema completeness and evidence grounding explanations.
  6. `end_to_end_latency`: Total root agent pipeline duration (`ai.agent`).

### Strict Token & Cost Policy (Zero Fabrication)
- Token and cost metrics are recorded **only when explicitly returned by the model runtime** in `usageMetadata`.
- If the current Gemma runtime container does not expose token counters, the telemetry attribute `gen_ai.usage.token_metrics_supported` is set to `false`. Token counts and costs are **never fabricated or guessed**.

### Location & Preference Redaction Guard
- In `beforeSend` and `beforeSendSpan`:
  - Precise GPS coordinates (latitude/longitude) are coarsened to 1 decimal place (~11km bounding box).
  - User emails, personal names, and private personal preferences are stripped to prevent telemetry data leaks.

### Reproducible Failure Scenario: Malformed Output Diagnosis & Fix
1. **The Problem**: An untrusted generative model occasionally returns cards missing mandatory physical evidence explanations (`wear.fabric.evidenceExplanation`) or missing municipal waterlogging disclaimers.
2. **Trace Diagnosis (Before Fix)**:
   - Sentry span `output.validate_schema` failed in 2ms.
   - Status: `error`
   - Logged Error: `Schema Validation Failure: Missing mandatory evidence grounding explanation in wear.fabric`.
   - Without an interceptor, this would cause an application 500 error or client crash.
3. **The Fix (Adaptive Grounding Healer)**:
   - Implemented `server/telemetry/schemaHealer.ts`.
   - The healer detects the missing grounding explanations in-flight and auto-fuses calibrated environmental context (outdoor humidity % and UV index) and municipal waterlogging disclaimers.
4. **Trace Verification (After Fix)**:
   - Sentry span `output.validate_schema` succeeds with status: `ok`.
   - Attribute: `eval.was_healed: true`.
   - Repaired fields recorded: `["cards.wear.fabric.evidenceExplanation"]`.
   - Zero user-facing crash or latency penalty.

### Documented Remaining Limitations
1. **Gemma Runtime Token Telemetry**: Gemma model serving containers on standard developer API tiers do not currently stream usage token counters in `generateContent`; token and cost metrics are recorded as unsupported to avoid fabrication.
2. **In-Memory Trace Buffer**: In local development and preview environments, traces are buffered in-memory up to 50 spans for immediate inspection. For permanent cross-region aggregation, `SENTRY_DSN` must be configured in environment secrets.
3. **Location Privacy Coarsening**: Coarsening GPS coordinates to 1 decimal degree preserves user location privacy but limits micro-climate weather analysis to ~11km bounding areas.
