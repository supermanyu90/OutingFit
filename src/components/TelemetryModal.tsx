import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Lock,
  ArrowRight,
  Database,
} from 'lucide-react';

interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelemetryModal: React.FC<TelemetryModalProps> = ({ isOpen, onClose }) => {
  const [evidenceData, setEvidenceData] = useState<any>(null);
  const [recentTraces, setRecentTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'live_spans' | 'limitations'>('diagnosis');

  const fetchTelemetry = async () => {
    setIsLoading(true);
    try {
      const [evidenceRes, tracesRes] = await Promise.all([
        fetch('/api/telemetry/failure-evidence'),
        fetch('/api/telemetry/traces'),
      ]);
      if (evidenceRes.ok) setEvidenceData(await evidenceRes.json());
      if (tracesRes.ok) {
        const t = await tracesRes.json();
        setRecentTraces(t.traces || []);
      }
    } catch (e) {
      console.warn('Failed to load telemetry:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-900 text-white">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Sentry Agent Tracing & Pipeline Diagnostics</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display">
              End-to-End Telemetry & Failure Diagnosis
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              SDK: @sentry/node v11.4.0 · OpenTelemetry Agent Conventions · Strict Zero-Fabrication Token Policy
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50 text-xs">
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`px-3 py-2 font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'diagnosis'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Before vs. After Failure Diagnosis</span>
          </button>

          <button
            onClick={() => setActiveTab('live_spans')}
            className={`px-3 py-2 font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'live_spans'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Live Captured Traces ({recentTraces.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('limitations')}
            className={`px-3 py-2 font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'limitations'
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-slate-600" />
            <span>Privacy Guard & Remaining Limitations</span>
          </button>

          <div className="ml-auto">
            <button
              onClick={fetchTelemetry}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: BEFORE VS AFTER FAILURE DIAGNOSIS */}
          {activeTab === 'diagnosis' && evidenceData && (
            <div className="space-y-6">
              {/* Scenario Explanation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  Reproducible Failure Scenario: {evidenceData.scenarioName}
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {evidenceData.description}
                </p>
              </div>

              {/* Side-by-Side Before vs After Evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BEFORE FIX */}
                <div className="bg-rose-50/60 border-2 border-rose-300 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>{evidenceData.beforeFix.title}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
                      STATUS: {evidenceData.beforeFix.traceStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-[11px] text-rose-950 bg-rose-100/60 p-3 rounded-xl">
                    <div><strong>Failed Span:</strong> {evidenceData.beforeFix.failedSpan} ({evidenceData.beforeFix.op})</div>
                    <div><strong>Error:</strong> {evidenceData.beforeFix.errorMessage}</div>
                  </div>

                  <div className="text-slate-700 leading-relaxed text-xs">
                    <strong className="block text-slate-900 mb-1">Diagnostic Root Cause:</strong>
                    {evidenceData.beforeFix.rootCauseDiagnosed}
                  </div>
                </div>

                {/* AFTER FIX */}
                <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{evidenceData.afterFix.title}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                      STATUS: {evidenceData.afterFix.traceStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-[11px] text-emerald-950 bg-emerald-100/60 p-3 rounded-xl">
                    <div><strong>Evaluated Span:</strong> {evidenceData.afterFix.spanStatus.toUpperCase()}</div>
                    <div><strong>Adaptive Healing:</strong> eval.was_healed = true</div>
                    <div><strong>Repaired Fields:</strong> {evidenceData.afterFix.telemetryAttributes.healed_fields.join(', ')}</div>
                  </div>

                  <div className="text-slate-700 leading-relaxed text-xs">
                    <strong className="block text-slate-900 mb-1">Implemented Fix:</strong>
                    {evidenceData.afterFix.fixImplemented}
                  </div>
                </div>
              </div>

              {/* Instrumentation Summary Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Instrumented Sentry Agent Pipeline Spans
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-800">1. Destination</strong>
                    <span className="font-mono text-[10px] text-slate-500">destination.resolve</span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">op: ai.tool.call</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-800">2. Weather</strong>
                    <span className="font-mono text-[10px] text-slate-500">weather.fetch</span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">op: http.client</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-800">3. Search (SerpApi)</strong>
                    <span className="font-mono text-[10px] text-slate-500">search.serpapi</span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">op: ai.tool.call</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-800">4. Gemma Model</strong>
                    <span className="font-mono text-[10px] text-slate-500">gemma.inference</span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">op: ai.run</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-800">5. Validation</strong>
                    <span className="font-mono text-[10px] text-slate-500">output.validate</span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">op: ai.evaluation</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CAPTURED TRACES */}
          {activeTab === 'live_spans' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-500 block">
                The latest agent traces captured in memory buffer (most recent first):
              </span>

              {recentTraces.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No traces recorded yet. Generate an outing recommendation to stream live traces.
                </div>
              ) : (
                recentTraces.map((t, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <span className="font-mono font-bold text-slate-900">{t.traceId}</span>
                        <span className="text-slate-500 font-semibold">({t.pipelineName})</span>
                      </div>
                      <span className="font-mono text-slate-600 font-bold">
                        {t.totalDurationMs}ms total latency
                      </span>
                    </div>

                    {/* Spans breakdown */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                        Spans ({t.spans?.length || 0}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                        {t.spans?.map((s: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            className={`p-2 rounded-lg border flex items-center justify-between ${
                              s.status === 'ok'
                                ? 'bg-white border-slate-200 text-slate-800'
                                : 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                            }`}
                          >
                            <div>
                              <span>{s.name}</span>
                              <span className="text-[9px] text-slate-400 block font-sans">op: {s.op}</span>
                            </div>
                            <span className="tabular-nums font-semibold">{s.durationMs}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Token usage metrics note */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Token Usage: {t.tokenUsage?.metricsSupported ? `${t.tokenUsage.totalTokens} tokens` : 'Not exposed by model runtime (not fabricated)'}</span>
                      <span className="text-emerald-700 font-medium">Location coarsened to 1 decimal place</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: PRIVACY GUARD & REMAINING LIMITATIONS */}
          {activeTab === 'limitations' && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Privacy Guard & Data Redaction Enforcement</span>
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700 text-xs">
                  <li>
                    <strong>GPS Coordinates Coarsened:</strong> Exact latitude and longitude decimals are coarsened to 1 decimal place (~11km bounding box). Precise home/venue street coordinates are never streamed to telemetry.
                  </li>
                  <li>
                    <strong>Private User Data Redaction:</strong> In Sentry <code className="bg-white px-1 py-0.5 rounded text-amber-900 font-mono">beforeSend</code> and <code className="bg-white px-1 py-0.5 rounded text-amber-900 font-mono">beforeSendSpan</code>, personal email, IP addresses, and private lifestyle notes are permanently scrubbed.
                  </li>
                  <li>
                    <strong>Strict Zero-Fabrication Policy:</strong> Model token counts and inference costs are logged only when explicitly provided in the SDK response metadata. OutingFit never invents or fabricates artificial token counts or costs.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                  Documented Remaining Limitations
                </span>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs leading-relaxed">
                  {evidenceData?.remainingLimitations?.map((lim: string, idx: number) => (
                    <li key={idx}>{lim}</li>
                  )) || (
                    <>
                      <li>Gemma model serving container on standard API tier does not expose token usage counters; token and cost metrics are recorded as unsupported to avoid fabrication.</li>
                      <li>Sentry trace buffer is memory-bounded to 50 spans in dev/preview; production environments require configuring a remote SENTRY_DSN.</li>
                      <li>Location privacy coarsening to 1 decimal degree limits micro-street meteorological precision to ~11km bounding areas.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Sentry Tracing Context: <code className="font-mono text-slate-800">ai.pipeline / ai.agent</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
