import { useCallback, useMemo, useRef, useState } from 'react';
import { OutingForm, OutingSession, readiness } from '../shared/outingSession.ts';
import type { OutingResult, ParseResult, ResolveResult } from './api.ts';
import type { Language } from './i18n.ts';

/** React binding for the shared OutingSession (also driven by the voice agent's client tools). */
export function useOutingSession(initialLanguage: Language) {
  const [form, setForm] = useState<OutingForm>(() => new OutingSession('', initialLanguage).form);
  const [result, setResult] = useState<OutingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<OutingSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new OutingSession('', initialLanguage, {
      onChange: (f) => setForm(f),
      onResult: (r) => {
        setResult(r);
        setError(null);
      },
      onError: (m) => setError(m),
    });
  }
  const session = sessionRef.current;

  const update = useCallback((patch: Partial<OutingForm>) => session.update(patch), [session]);

  const getAdvice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await session.getOutingAdvice();
      const raw = JSON.parse(text);
      if (raw.status === 'not_ready') setError(`Still needed: ${raw.missing.join(', ')}`);
      return text;
    } finally {
      setLoading(false);
    }
  }, [session]);

  /** Apply a Gemma extraction from typed text or a corrected transcript. Nothing is fetched until the user confirms. */
  const applyParse = useCallback(
    (p: ParseResult & { destination: ResolveResult | null }) => {
      const x = p.parsed;
      if (!x) return;
      const patch: Partial<OutingForm> = {
        scheduleConfirmed: false,
        scheduleNotes: p.confirmations.map((c) => c.reason),
      };
      if (x.date) patch.date = x.date;
      if (x.departure) patch.departure = x.departure;
      if (x.return) patch.return = x.return;
      if (x.outdoorExposure) patch.outdoorExposure = x.outdoorExposure;
      if (x.transport) patch.transport = x.transport;
      if (x.coveredDropOff) patch.coveredDropOff = x.coveredDropOff;
      if (x.venueSetting) patch.venueSetting = x.venueSetting;
      if (x.indoorAc) patch.indoorAc = x.indoorAc;
      if (x.feelsColdInAc !== null) patch.feelsColdInAc = x.feelsColdInAc;
      if (x.occasion) patch.occasion = x.occasion;
      if (x.formality) patch.formality = x.formality;
      if (x.colourPreference) patch.colourPreference = x.colourPreference;
      if (p.destination) {
        const d = p.destination;
        patch.destinationQuery = d.query;
        patch.candidates = d.candidates;
        patch.destinationStatus = d.status;
        patch.destinationMessage = d.message;
        patch.destination = d.status === 'resolved' ? d.candidates[0].destination : null;
      }
      session.update(patch);
    },
    [session]
  );

  const ready = useMemo(() => readiness(form), [form]);

  return {
    session,
    form,
    ready,
    result,
    setResult,
    loading,
    error,
    setError,
    update,
    resolve: (q: string) => session.resolve(q),
    choose: (id: string) => session.chooseCandidate(id),
    confirmSchedule: () => session.confirmDetails(),
    getAdvice,
    applyParse,
  };
}
