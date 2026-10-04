import React, { useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Code2,
  Cpu,
  FileCheck,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { ProviderDocumentation } from '../types';

interface ModelDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerInfo: ProviderDocumentation | null;
}

export const ModelDocsModal: React.FC<ModelDocsModalProps> = ({
  isOpen,
  onClose,
  providerInfo,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'adapter' | 'setup'>('model');

  if (!isOpen) return null;

  const sampleAdapterCode = `// Recommendation Provider Adapter Interface
export interface RecommendationAdapter {
  getDocumentation(): ProviderDocumentation;
  generateRecommendation(request: RecommendationRequest): Promise<RecommendationResponse>;
}

// Gemma Central Model Implementation
export class GemmaProviderAdapter implements RecommendationAdapter {
  private primaryModel = 'models/gemma-4-31b-it';
  private secondaryModel = 'gemini-3.8-flash';
  
  // Encapsulated server-side inference, zero browser key exposure
  async generateRecommendation(req: RecommendationRequest): Promise<RecommendationResponse> {
    // Grounding prompt enforcing structured Wear, Carry, and Check schema
    const response = await this.ai.models.generateContent({
      model: this.primaryModel,
      contents: userPrompt,
      config: { temperature: 0.25, responseMimeType: 'application/json' }
    });
    return this.formatResponse(response);
  }
}`;

  const copyAdapterCode = () => {
    navigator.clipboard.writeText(sampleAdapterCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
                Gemma Model Verification & Architecture
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Central Recommendation Model</span>
                <span>·</span>
                <span>Replaceable Provider Adapter Pattern</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('model')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'model'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Model Specifications & Licensing
          </button>
          <button
            onClick={() => setActiveTab('adapter')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'adapter'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Provider Adapter Code
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'setup'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Setup & Runtime Instructions
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-sm">
          {activeTab === 'model' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1">
                  Verified Central Model
                </span>
                <p className="text-base font-bold text-amber-950 font-mono">
                  models/gemma-4-31b-it
                </p>
                <p className="text-xs text-amber-800/80 mt-1">
                  Google Gemma 4 31B Instruction-Tuned Open-Weights Model.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900 w-1/3">Official Documentation</td>
                      <td className="p-3">
                        <a
                          href="https://ai.google.dev/gemma"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                        >
                          ai.google.dev/gemma
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Licensing Terms</td>
                      <td className="p-3">
                        Gemma Terms of Use / Open Weights Model License (Google LLC). Permits research and commercial use subject to Google&apos;s Prohibited Use Policy.
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">Context Window</td>
                      <td className="p-3 font-mono font-semibold">8,192 tokens</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Runtime Architecture</td>
                      <td className="p-3">
                        Text-to-text decoder-only dense transformer with Grouped-Query Attention (GQA).
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">Grounding Policy</td>
                      <td className="p-3">
                        Strict deterministic evidence grounding (Temperature 0.25). Synthesizes Wear, Carry, and Check recommendations solely from supplied weather physics, verified venue parameters, and municipal waterlogging logs.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Secondary Fallback</td>
                      <td className="p-3 font-mono text-slate-600">
                        gemini-3.8-flash (Engaged automatically if Gemma API latency exceeds SLA threshold).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'adapter' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Replaceable Provider Adapter Pattern</h4>
                  <p className="text-xs text-slate-500">
                    Located in <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">server/adapters/recommendationAdapter.ts</code>
                  </p>
                </div>
                <button
                  onClick={copyAdapterCode}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Interface'}</span>
                </button>
              </div>

              <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed max-h-80">
                <pre>{sampleAdapterCode}</pre>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-4 text-xs">
              <h4 className="text-sm font-bold text-slate-900">Local Setup & Runtime Execution</h4>
              
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <strong className="text-slate-900 font-bold block">1. Environment Variables</strong>
                  <p className="text-slate-600">
                    Ensure <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> is set in <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono">.env</code>. The server automatically routes requests to the Gemma adapter.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <strong className="text-slate-900 font-bold block">2. Development Execution</strong>
                  <p className="text-slate-600">
                    Run <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono">npm run dev</code> to launch the full-stack server on port 3000.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <strong className="text-slate-900 font-bold block">3. Verification of Vertical Slice</strong>
                  <p className="text-slate-600">
                    Use the &quot;Scenario Demo&quot; tab to immediately verify how the three cards (Wear, Carry, Check) change between a sunny outdoor lunch and a rainy indoor dinner.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Official Gemma open weights model deployment
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
