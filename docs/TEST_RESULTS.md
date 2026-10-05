# OutingFit — scenario test results

Run at 2026-10-05T09:42:45.830Z (Mumbai 2026-10-05 15:04) against https://outingfit-mumbai.onrender.com.
Gemma: {"runtime":"gemini_api","model":"gemma-4-26b-a4b-it"} fallback null. ElevenLabs: configured; agent: configured.

| Scenario | Result |
|---|---|
| 1. Sunny afternoon with substantial outdoor exposure (fixture weather) | PASS (8/8) |
| 2. Humid, rainy evening with a short car-to-entrance walk (fixture weather) | FAIL (6/8) |
| 3. Indoor dinner, user feels cold in AC (live weather) | PASS (6/6) |
| 4a. Hindi voice input with an ambiguous venue — Scribe dictation path | PASS (10/10) |
| 4a. Marathi voice input with an ambiguous venue — Scribe dictation path | PASS (10/10) |
| 4b. Hindi voice conversation with the ElevenLabs agent (ambiguous venue) | PASS (7/7) |
| 4b. Marathi voice conversation with the ElevenLabs agent (ambiguous venue) | PASS (7/7) |
| 5. Weather API failure | PASS (5/5) |
| Extra. Date beyond the forecast horizon | PASS (1/1) |

## 1. Sunny afternoon with substantial outdoor exposure (fixture weather)

**PASS**

- ✅ labelled as fixture, not live — FIXTURE: clear, hot afternoon (UV peaks at 9) — not live weather
- ✅ UV/heat items present — wear.breathable_fabric, wear.loose_fit, carry.water, wear.sun_coverage, carry.hat, carry.sunglasses, carry.sunscreen, wear.formality, check.waterlogging
- ✅ no rain gear
- ✅ sunglasses carry UV-label caveat — Only lenses labelled UV400 or certified to ISO 12312-1 have verified UV protection; tinted lenses without that label may not block UV.
- ✅ hourly UV (outdoor period) distinct from daily max — outdoor hourly max 9 at 2026-10-06T13:00; daily max 9
- ✅ local Asia/Kolkata hours cover the outing; °C, %, mm, km/h units validated — window 2026-10-06T13:00→2026-10-06T17:00; hours 13:00,14:00,15:00,16:00,17:00; sunset 2026-10-06T18:15
- ✅ spoken summary validated to cover essential/recommended items — covers wear.breathable_fabric, wear.loose_fit, carry.water, wear.sun_coverage, carry.hat, carry.sunglasses, carry.sunscreen
- ✅ spoken numbers appear in displayed data — numbers: 9, 30, 39

Spoken summary: "For your beach walk, wear loose and breathable casual clothes. Since you'll be outdoors with a UV index of 9, please bring a hat, sunglasses with a UV label, and apply SPF 30+ sunscreen. Also, remember to carry a water bottle to stay hydrated in the 39°C feels-like temperature."

Items: wear:wear.sun_coverage(essential), wear:wear.breathable_fabric(recommended), wear:wear.loose_fit(recommended), wear:wear.formality(info), carry:carry.sunscreen(essential), carry:carry.water(recommended), carry:carry.hat(recommended), carry:carry.sunglasses(recommended), check:check.waterlogging(info)

## 2. Humid, rainy evening with a short car-to-entrance walk (fixture weather)

**FAIL**

- ✅ umbrella essential for uncovered drop-off — essential
- ✅ gusts ≥ 39 km/h → rain jacket suggested — gust max 46 km/h
- ✅ wet-weather footwear
- ✅ waterlogging shown separately, labelled DEMO with source and age — DEMO DATA — example of how a sourced waterlogging report is displayed. Not a real report.
- ✅ confirmed covered drop-off lowers umbrella to optional — optional
- ✅ weather change → different items vs scenario 1 — sunny-only: carry.water, wear.sun_coverage, carry.hat, carry.sunglasses, carry.sunscreen; rainy-only: carry.umbrella, carry.rain_jacket, wear.wet_weather_footwear, wear.quick_dry, check.dress_code
- ❌ spoken summary validated to cover essential/recommended items — All Gemma runtimes failed
- ❌ spoken numbers match display — no spoken summary

Items: wear:wear.breathable_fabric(recommended), wear:wear.loose_fit(recommended), wear:wear.wet_weather_footwear(recommended), wear:wear.quick_dry(optional), wear:wear.formality(info), carry:carry.umbrella(essential), carry:carry.rain_jacket(optional), check:check.dress_code(recommended), check:check.waterlogging(recommended)

## 3. Indoor dinner, user feels cold in AC (live weather)

**PASS**

- ✅ live forecast used — live, retrieved 2026-10-05T09:35:12.485Z
- ✅ AC layer recommended from stated preference — [{"kind":"preference","field":"feels_cold_in_ac","value":"yes"},{"kind":"preference","field":"indoor_ac","value":"user_expects"}]
- ✅ no sun gear after sunset — sunset 2026-10-05T18:23
- ✅ local Asia/Kolkata hours cover the outing; °C, %, mm, km/h units validated — window 2026-10-05T20:00→2026-10-05T23:00; hours 20:00,21:00,22:00,23:00; sunset 2026-10-05T18:23
- ✅ spoken summary validated to cover essential/recommended items — covers wear.breathable_fabric, wear.loose_fit, wear.ac_layer, check.drop_off_cover, check.dress_code
- ✅ spoken numbers appear in displayed data — numbers: 34.2, 82
- note: resolve("Bastian At The Top") → resolved (Bastian - At The Top)

Spoken summary: "For your anniversary dinner, wear breathable, loose-fitting smart casual clothes to handle the 34.2°C feels-like temperature and 82% humidity. Since you feel cold in AC, bring a light layer. Also, check if your car can drop you off under cover and confirm the venue's dress code beforehand."

Items: wear:wear.breathable_fabric(recommended), wear:wear.loose_fit(recommended), wear:wear.ac_layer(recommended), wear:wear.formality(info), check:check.drop_off_cover(recommended), check:check.dress_code(recommended), check:check.waterlogging(info)

## 4a. Hindi voice input with an ambiguous venue — Scribe dictation path

**PASS**

- ✅ Scribe transcribed hi speech — "कल शाम 7:00 बजे Bastion जाना है। 11:00 बजे तक लौटूंगी। मुझे AC में ठंड लगती है।" (lang hin, p=1)
- ✅ destination flagged ambiguous (two Bastian branches) — ambiguous: Bastian - At The Top | Bastian (Bandra West)
- ✅ "कल" date flagged for confirmation — date 2026-10-06; confirmations: "कल शाम" can refer to more than one date. Please confirm the date.
- ✅ times extracted in 24h Mumbai time — 19:00–23:00
- ✅ AC preference extracted — true
- ✅ spoken summary validated to cover essential/recommended items — covers wear.breathable_fabric, wear.loose_fit, check.indoor_ac, check.drop_off_cover
- ✅ spoken numbers appear in displayed data — numbers: 33.5, 82
- ✅ spoken summary in Devanagari (hi) — 33.5°C तापमान और 82% आर्द्रता के कारण सांस लेने योग्य और ढीले कपड़े पहनना अच्छा रहेगा। चूंकि आपको एसी में ठंड लगती है, एक हल्की लेयर साथ रखें। कृपया वेन्यू से एसी और ढके हुए ड्रॉप-ऑफ के बारे में पूछ लें।
- ✅ spoken audio matches displayed summary (TTS → STT round trip) — TTS eleven_v3, 304318 bytes; agreement 85%; heard "33.5 degree celsius तापमान और 82 प्रतिशत आर्द्रता के कारण सांस लेने योग्य और ढीले कपड़े पहनना अच्छा रहेगा। चूंकि आपको AC में ठंड लगती है, एक हल्की layer साथ रखें। कृपया venue से AC और ढके हुए drop off के बारे में पूछ लें।"
- ✅ TTS refuses text that is not a backend summary — HTTP 403

Spoken summary: "33.5°C तापमान और 82% आर्द्रता के कारण सांस लेने योग्य और ढीले कपड़े पहनना अच्छा रहेगा। चूंकि आपको एसी में ठंड लगती है, एक हल्की लेयर साथ रखें। कृपया वेन्यू से एसी और ढके हुए ड्रॉप-ऑफ के बारे में पूछ लें।"

Items: wear:wear.breathable_fabric(recommended), wear:wear.loose_fit(recommended), wear:wear.ac_layer(optional), wear:wear.formality(info), check:check.indoor_ac(recommended), check:check.drop_off_cover(recommended), check:check.waterlogging(info)

## 4a. Marathi voice input with an ambiguous venue — Scribe dictation path

**PASS**

- ✅ Scribe transcribed mr speech — "उद्या संध्याकाळी सात वाजता बॅस्टिनला जायचं आहे. अकरा वाजेपर्यंत परत येईन. मला AC मध्ये थंडी वाजते" (lang mar, p=1)
- ✅ destination flagged ambiguous (two Bastian branches) — ambiguous: Bastian - At The Top | Bastian (Bandra West)
- ✅ Marathi "उद्या" resolved to tomorrow — date 2026-10-06; confirmations: none
- ✅ times extracted in 24h Mumbai time — 19:00–23:00
- ✅ AC preference extracted — true
- ✅ spoken summary validated to cover essential/recommended items — covers wear.breathable_fabric, wear.loose_fit, wear.ac_layer, check.drop_off_cover
- ✅ spoken numbers appear in displayed data — numbers: 33.5, 82
- ✅ spoken summary in Devanagari (mr) — Bastian - At The Top साठी हवेशीर आणि सैल कपडे निवडा कारण तापमान 33.5°C आणि आर्द्रता 82% असेल. तुम्हाला एसीमध्ये थंडी वाजते, म्हणून एक हलकी लेयर सोबत ठेवा आणि कार तुम्हाला छताखाली सोडेल का ते तपासा.
- ✅ spoken audio matches displayed summary (TTS → STT round trip) — TTS eleven_v3, 278822 bytes; agreement 91%; heard "Bastian at the top साठी हवेशीर आणि सैल कपडे निवडा. कारण तापमान तेहतीस point पाच degree celsius आणि आर्द्रता ब्यांशी टक्के असेल. तुम्हाला AC मध्ये थंडी वाजते म्हणून एक हलकी layer सोबत ठेवा आणि car तुम्हाला छताखाली सोडेल का ते तपासा."
- ✅ TTS refuses text that is not a backend summary — HTTP 403

Spoken summary: "Bastian - At The Top साठी हवेशीर आणि सैल कपडे निवडा कारण तापमान 33.5°C आणि आर्द्रता 82% असेल. तुम्हाला एसीमध्ये थंडी वाजते, म्हणून एक हलकी लेयर सोबत ठेवा आणि कार तुम्हाला छताखाली सोडेल का ते तपासा."

Items: wear:wear.breathable_fabric(recommended), wear:wear.loose_fit(recommended), wear:wear.ac_layer(recommended), wear:wear.formality(info), check:check.drop_off_cover(recommended), check:check.waterlogging(info)

## 4b. Hindi voice conversation with the ElevenLabs agent (ambiguous venue)

**PASS**

- ✅ agent ASR transcribed hi speech — कल शाम 07:00 बजे Bastian जाना है। 11:00 बजे तक लौटूँगी। मुझे AC में ठंड लगती है। || दादर वाला, बास्टियन एट द टॉप। || हाँ, कल यानी आने वाला दिन शाम सात से रात ग्यारह बजे तक सही है।
- ✅ agent called set_outing_details with the venue in Latin letters (spelling variants matched by the backend) — {"destination":"Bastian","date":"2026-10-06","departure_time":"19:00","return_time":"23:00","feels_cold_in_ac":true}
- ✅ backend reported the venue as ambiguous to the agent — {"destination_status":"ambiguous","destination":null,"destination_options":["1. Bastian - At The Top — Kohinoor Square, Dadar West · forecast point: Dadar West","2. Bastian (Bandra West) — Linking Roa
- ✅ agent asked and called choose_destination — [{"choice":"1"}]
- ✅ agent confirmed date/times before advice was fetched — set_outing_details → choose_destination → confirm_details
- ✅ agent spoke the backend summary (agreement ≥ 85%) — agreement 100%<br>      summary: 33.5°C तापमान और 82% ह्यूमिडिटी के कारण सांस लेने योग्य और ढीले कपड़े पहनना अच्छा रहेगा। चूंकि आपको AC में ठंड लगती है, एक हल्की लेयर साथ रखें। वेन्यू से AC और कवर्ड ड्रॉप-ऑफ के बारे में पूछ लें। साथ ही, वेन्यू के 'Smart Chic' ड्रेस कोड का ध्यान रखें।<br>      agent said: तैंतीस दशमलव पांच डिग्री सेल्सियस तापमान और बयासी प्रतिशत ह्यूमिडिटी के कारण सांस लेने योग्य और ढीले कपड़े पहनना अच्छा रहेगा। चूंकि आपको एसी में ठंड लगती है, एक हल्की लेयर साथ रखें। वेन्यू से एसी और कवर्ड ड्रॉप-ऑफ के बारे में पूछ लें। साथ ही, वेन्यू के 'स्मार्ट चिक' ड्रेस कोड का ध्यान रखें।<br><br>पूरी जानकारी स्क्रीन पर उपलब्ध है।
- ✅ form ended on the Dadar branch, tomorrow — Bastian - At The Top 2026-10-06 19:00-23:00
- note: agent audio received: 1972854 bytes; formats {"in":"pcm_16000","out":"pcm_16000"}

## 4b. Marathi voice conversation with the ElevenLabs agent (ambiguous venue)

**PASS**

- ✅ agent ASR transcribed mr speech — उद्या संध्याकाळी सात वाजता बॅस्टियनला जायचं आहे. अकरा वाजेपर्यंत परत येईन. मला AC मध्ये थंडी वाजते. || दादरचं, बॅस्टियन अट द टॉप. || हो, बरोबर आहे.
- ✅ agent called set_outing_details with the venue in Latin letters (spelling variants matched by the backend) — {"destination":"Bastian","date":"2026-10-06","departure_time":"19:00","return_time":"23:00","feels_cold_in_ac":true}
- ✅ backend reported the venue as ambiguous to the agent — {"destination_status":"ambiguous","destination":null,"destination_options":["1. Bastian - At The Top — Kohinoor Square, Dadar West · forecast point: Dadar West","2. Bastian (Bandra West) — Linking Roa
- ✅ agent asked and called choose_destination — [{"choice":"1"}]
- ✅ agent confirmed date/times before advice was fetched — set_outing_details → choose_destination → confirm_details
- ✅ agent spoke the backend summary (agreement ≥ 85%) — agreement 100%<br>      summary: Bastian - At The Top साठी ३३.५°C तापमान आणि ८२% आर्द्रतेमुळे सुती आणि सैल कपडे वापरा. तुम्हाला एसीमध्ये थंडी वाजते, म्हणून एक हलकी लेअर सोबत ठेवा आणि तिथे एसी आहे का ते तपासा. तसेच, कार तुम्हाला छताखाली सोडेल का याची खात्री करून घ्या.<br>      agent said: बॅस्टियन - ॲट द टॉप साठी तेहतीस पॉईंट पाच अंश सेल्सिअस तापमान आणि ऐंशी दोन टक्के आर्द्रतेमुळे सुती आणि सैल कपडे वापरा. तुम्हाला एसीमध्ये थंडी वाजते, म्हणून एक हलकी लेअर सोबत ठेवा आणि तिथे एसी आहे का ते तपासा. तसेच, कार तुम्हाला छताखाली सोडेल का याची खात्री करून घ्या. पूर्ण माहिती तुमच्या स्क्रीनवर दिसत आहे.
- ✅ form ended on the Dadar branch, tomorrow — Bastian - At The Top 2026-10-06 19:00-23:00
- note: agent audio received: 1873971 bytes; formats {"in":"pcm_16000","out":"pcm_16000"}

## 5. Weather API failure

**PASS**

- ✅ baseline live fetch — live @ 2026-10-05T09:41:57.349Z
- ✅ outage with recent cache → STALE label, retrieval time shown, not live — Live forecast unavailable (Simulated weather provider outage (test scenario)). Showing the forecast retrieved 0 min ago — not live.
- ✅ outage without cache → weather unavailable, no weather-based items — Weather unavailable: Simulated weather provider outage (test scenario). No cached forecast is recent enough to use, so no weather-based advice is given.; items: check.weather_unavailable, check.drop_off_cover, check.waterlogging
- ✅ inputs preserved in the response — Powai 18:00-21:00
- ✅ labelled as a test fault — TEST: simulated weather provider outage

## Extra. Date beyond the forecast horizon

**PASS**

- ✅ explains precise advice not yet available — The forecast currently reaches 2026-10-20 23:00 (Asia/Kolkata), about 16 days ahead. Precise weather-based advice for this date is not yet available — check again closer to the day.
