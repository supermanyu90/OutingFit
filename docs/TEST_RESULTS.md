# OutingFit — scenario test results

Run at 2026-10-04T12:19:36.733Z (Mumbai 2026-10-04 17:48) against http://localhost:3100.
Gemma: {"runtime":"gemini_api","model":"gemma-4-26b-a4b-it"} fallback {"runtime":"ollama","model":"gemma3:4b","url":"http://127.0.0.1:11434"}. ElevenLabs: configured; agent: configured.

| Scenario | Result |
|---|---|
| 4b. Marathi voice conversation with the ElevenLabs agent (ambiguous venue) | PASS (7/7) |

## 4b. Marathi voice conversation with the ElevenLabs agent (ambiguous venue)

**PASS**

- ✅ agent ASR transcribed mr speech — उद्या संध्याकाळी सात वाजता बॅस्टियनला जायचं आहे. अकरा वाजेपर्यंत परत येईन. मला AC मध्ये थंडी वाजते. || दादरचं, बॅस्टियन एट द टॉप. || हो, बरोबर आहे. || हो, बरोबर.
- ✅ agent called set_outing_details with the venue in Latin letters (spelling variants matched by the backend) — {"destination":"Bastian","date":"2026-10-05","departure_time":"19:00","return_time":"23:00","feels_cold_in_ac":true}
- ✅ backend reported the venue as ambiguous to the agent — {"destination_status":"ambiguous","destination":null,"destination_options":["1. Bastian - At The Top — Kohinoor Square, Dadar West · forecast point: Dadar West","2. Bastian (Bandra West) — Linking Roa
- ✅ agent asked and called choose_destination — [{"choice":"1"}]
- ✅ agent confirmed date/times before fetching — set_outing_details → choose_destination → confirm_details → get_outing_advice
- ✅ agent spoke the backend summary (agreement ≥ 85%) — agreement 92%<br>      summary: बाहेर 33.7°C तापमान आणि 85% आर्द्रता असल्याने सैल आणि श्वास घेण्यायोग्य कापडाचे कपडे वापरा. तुम्हाला AC मध्ये थंडी वाजते, म्हणून एक हलकी लेयर सोबत ठेवा. तसेच, वेन्यूमध्ये AC आहे का आणि कार तुम्हाला छताखाली सोडू शकते का, याची खात्री करून घ्या.<br>      agent said: बाहेर तेहतीस पूर्णांक सात अंश सेल्सिअस तापमान आणि पंच्याऐंशी टक्के आर्द्रता असल्याने सैल आणि श्वास घेण्यायोग्य कापडाचे कपडे वापरा. तुम्हाला एसी मध्ये थंडी वाजते, म्हणून एक हलकी लेयर सोबत ठेवा. तसेच, वेन्यूमध्ये एसी आहे का आणि कार तुम्हाला छताखाली सोडू शकते का, याची खात्री करून घ्या. पूर्ण कार्ड्स स्क्रीनवर आहेत.
- ✅ form ended on the Dadar branch, tomorrow — Bastian - At The Top 2026-10-05 19:00-23:00
- note: agent audio received: 1748544 bytes; formats {"in":"pcm_16000","out":"pcm_16000"}
