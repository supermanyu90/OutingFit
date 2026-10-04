import type { Language } from '../server/domain.ts';

export type { Language };

export const LANGUAGE_OPTIONS: Array<{ code: Language; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

const strings = {
  wear: { en: 'Wear', hi: 'पहनें', mr: 'घाला' },
  carry: { en: 'Carry', hi: 'साथ रखें', mr: 'सोबत घ्या' },
  check: { en: 'Check', hi: 'जाँचें', mr: 'तपासा' },
  getAdvice: { en: 'Get weather-based advice', hi: 'मौसम के आधार पर सलाह पाएँ', mr: 'हवामानावर आधारित सल्ला मिळवा' },
  spokenSummary: { en: 'Spoken summary', hi: 'बोला गया सारांश', mr: 'बोललेला सारांश' },
  play: { en: 'Play', hi: 'सुनें', mr: 'ऐका' },
  stop: { en: 'Stop', hi: 'रोकें', mr: 'थांबवा' },
  alreadyOwn: { en: 'Already own this?', hi: 'पहले से है?', mr: 'आधीच आहे?' },
  owned: { en: 'You have this — no need to buy', hi: 'आपके पास है — खरीदने की ज़रूरत नहीं', mr: 'तुमच्याकडे आहे — विकत घेण्याची गरज नाही' },
  because: { en: 'Because', hi: 'क्योंकि', mr: 'कारण' },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Language): string {
  return strings[key][lang] ?? strings[key].en;
}
