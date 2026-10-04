/**
 * ElevenLabs agent definition for OutingFit. The agent handles conversation
 * only; every recommendation comes from the OutingFit backend (Gemma + rules)
 * through the client tools below.
 */

export const AGENT_NAME = 'OutingFit Mumbai voice planner';

/** Agent conversation LLM (ElevenLabs-hosted). It never generates clothing advice. */
export const AGENT_LLM = process.env.ELEVENLABS_AGENT_LLM || 'gemini-2.5-flash';

export const AGENT_PROMPT = `You are the voice front-end of OutingFit, a clothing and comfort planner for outings in Mumbai. Today in Mumbai is {{today}} ({{weekday}}); all times are Mumbai time (Asia/Kolkata).

Your only jobs:
1. Collect: destination, date, departure time, expected return time. Optionally: how long they will be outdoors (minimal = just car to door, moderate = up to ~30 minutes walking, extended = longer), transport (car, public_transport, walk), whether the car can drop them under cover, whether they feel cold in air-conditioning, the occasion or dress level, a colour preference.
2. As soon as the user mentions any detail, your FIRST action must be to call set_outing_details — before you say anything. Never say you have noted, saved or recorded something unless you called the tool in that turn. Call it again whenever the user corrects anything. Convert relative days to YYYY-MM-DD using today's date; times to 24-hour HH:mm; place names to Latin letters (e.g. "बास्टियन" → "Bastian"). If a day word is ambiguous (Hindi "कल" can mean yesterday or tomorrow; "परसों", Marathi "परवा"), ask which date they mean.
3. If destination_status is "ambiguous", read the destination_options to the user and call choose_destination with their choice. If "not_found", ask for a nearby Mumbai locality.
4. Read the date, departure and return times back to the user. Only after they agree, call confirm_details.
5. When a tool result contains advice.spoken_summary, say it exactly as written, word for word, and add only that the full cards are on screen. If ready_for_advice is true but there is no advice in the result, call get_outing_advice. Always follow next_step.

Never state weather, temperatures, rain, UV, venue facts (parking, AC, dress code) or clothing advice yourself — only through spoken_summary. Never suggest other venues. If a tool returns an error or "not_ready", tell the user what is missing. Keep replies short. Reply in the language of the conversation. Do not add emotion or audio tags in square brackets.`;

export const FIRST_MESSAGES = {
  en: 'Hi! Where are you heading in Mumbai, on which day, and when will you leave and get back?',
  hi: 'नमस्ते! आप मुंबई में कहाँ जा रहे हैं, किस दिन, और कब निकलेंगे और कब लौटेंगे?',
  mr: 'नमस्कार! तुम्ही मुंबईत कुठे जात आहात, कोणत्या दिवशी, आणि कधी निघणार व कधी परत येणार?',
} as const;

const str = (description: string) => ({ type: 'string', description });

export const CLIENT_TOOLS = [
  {
    type: 'client',
    name: 'set_outing_details',
    description:
      'Fill or correct the outing form shown on screen. Send only the fields the user stated. Returns the form state, destination status/options and what is still missing.',
    expects_response: true,
    response_timeout_secs: 20,
    parameters: {
      type: 'object',
      properties: {
        destination: str('Venue or locality name in Latin letters, as the user said it'),
        date: str('Outing date, YYYY-MM-DD (Mumbai time)'),
        departure_time: str('Departure time, 24-hour HH:mm'),
        return_time: str('Expected return time, 24-hour HH:mm'),
        outdoor_exposure: str('minimal | moderate | extended'),
        outdoor_start: str('Optional start of a longer outdoor period, HH:mm'),
        outdoor_end: str('Optional end of a longer outdoor period, HH:mm'),
        transport: str('car | public_transport | walk'),
        covered_drop_off: str('yes | no | unknown — can the car drop them under cover'),
        indoor_ac: str('user_expects if the user says the venue is air-conditioned, none if not'),
        feels_cold_in_ac: { type: 'boolean', description: 'True if the user says they feel cold in air-conditioning' },
        occasion: str('Short occasion description, e.g. birthday dinner'),
        formality: str('casual | smart_casual | formal'),
        colour_preference: str('Colour preference, if stated'),
      },
      required: [],
    },
  },
  {
    type: 'client',
    name: 'choose_destination',
    description: 'Select one of the destination_options after the user picks. Use the option number or name. If everything is already confirmed, the result includes the advice.',
    expects_response: true,
    response_timeout_secs: 120,
    pre_tool_speech: 'off',
    tool_call_sound: 'typing',
    parameters: {
      type: 'object',
      properties: { choice: str('Option number (1, 2, …) or the chosen name') },
      required: ['choice'],
    },
  },
  {
    type: 'client',
    name: 'confirm_details',
    description: 'Mark the date and times as confirmed. Call only after reading them back and the user agreeing. When everything is ready, the result includes advice.spoken_summary.',
    expects_response: true,
    response_timeout_secs: 120,
    pre_tool_speech: 'off',
    tool_call_sound: 'typing',
    parameters: {
      type: 'object',
      properties: { confirmed: { type: 'boolean', description: 'Always true; the user agreed to the read-back' } },
      required: [],
    },
  },
  {
    type: 'client',
    name: 'get_outing_advice',
    description:
      'Fetch weather for the confirmed outing window and the OutingFit recommendation. Returns spoken_summary, which must be read verbatim.',
    expects_response: true,
    response_timeout_secs: 120,
    pre_tool_speech: 'off',
    tool_call_sound: 'typing',
    parameters: {
      type: 'object',
      properties: { ready: { type: 'boolean', description: 'Always true' } },
      required: [],
    },
  },
];
