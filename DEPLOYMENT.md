# OutingFit — Render Deployment Guide & Architecture

This guide details the deployment of **OutingFit** to [Render](https://render.com) using its official Web Service and Blueprint specifications.

---

## 1. Architecture

See [README.md](README.md) for the current pipeline (ElevenLabs voice → confirmed outing form → Open-Meteo → decision rules → Gemma → validated cards + spoken summary). Everything runs in one Render Node web service; API keys stay server-side.

On Render, set `OLLAMA_URL=off` (no local Ollama) so Gemma runs only on the Gemini API (`gemma-4-31b-it`). If Gemma fails, the cards show the rule engine's English wording with a visible notice — no output is attributed to Gemma unless Gemma produced it.

## 2. Configuration & Secret Handling

### Environment Variables Matrix

| Variable | Type | Default | Required on Render | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `production` | Yes | Runs Express in production mode, serving pre-built Vite assets |
| `NODE_VERSION` | String | `22.14.0` | Yes | Specifies Node.js LTS engine on Render |
| `PORT` | Number | `10000` | Auto-injected | Render automatically assigns the public port |
| `GEMINI_API_KEY` | Secret | None | Yes | API key for Gemma / Gemini inference via `@google/genai` |
| `WEATHER_API_TIMEOUT_MS` | Number | `5000` | Optional | AbortController timeout threshold for external Open-Meteo calls |
| `INFERENCE_TIMEOUT_MS` | Number | `30000` | Optional | SLA timeout threshold before engaging fallback engine |
| `APP_URL` | URL | Service URL | Optional | Public canonical domain of the Render deployment |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_AGENT_LANG_*` | Secret | None | For voice | See `.env.example`; IDs come from `npm run setup:agent` |
| `OLLAMA_URL` | String | `off` on Render | Yes | Disables the local Gemma fallback |

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
   - `INFERENCE_TIMEOUT_MS`: `30000`
6. Click **Create Web Service**.

---

## 4. Verification checklist (post-deployment)

1. `curl -i https://<app>.onrender.com/healthz` → 200 with `inference.primary.model = gemma-4-31b-it` and `voice.agentConfigured = true`.
2. Run the end-to-end scenarios against the deployment and keep the output:
   ```bash
   BASE=https://<app>.onrender.com npm run test:scenarios
   ```
   Do not call the deployment live until scenarios 1–5 pass there (see `docs/TEST_RESULTS.md`).
3. In a browser, open **Test scenarios → 5 · Weather provider failure** and confirm the weather panel shows **STALE — not live** (or **Unavailable**) and the inputs are preserved.
4. Add the Render URL to the ElevenLabs agent's allowed hosts if you enable an allowlist.
