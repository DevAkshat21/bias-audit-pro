import React, { useState } from 'react';
import { ArrowRight, ShieldAlert, Target, TrendingUp, TrendingDown, Minus, Brain, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell, BarChart, Bar } from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';

interface MitigationProps {
  mitigationData: any;
}

function getComplianceStyle(di: number): { label: string; color: string; bg: string } {
  if (di >= 0.8) return { label: 'Compliant', color: '#005228', bg: '#7efba4' };
  if (di >= 0.5) return { label: 'Improved',  color: '#92400e', bg: '#fde68a' };
  return                 { label: 'Violation', color: '#93000a', bg: '#ffdad6' };
}

async function fetchMitigationExplanation(m: any): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY not set.');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const diDelta   = (m.postprocessing.disparate_impact_ratio - m.baseline.disparate_impact_ratio).toFixed(3);
  const accDelta  = ((m.postprocessing.accuracy - m.baseline.accuracy) * 100).toFixed(2);
  const bestDI    = Math.max(m.preprocessing.disparate_impact_ratio, m.postprocessing.disparate_impact_ratio);

  const prompt = `
You are an AI fairness engineer writing a plain-English explanation for a bias audit report.
The protected attribute analyzed is "${m.protected_attribute}".

Two bias mitigation strategies were applied:

1. Pre-processing — Correlation Remover:
   - Mechanism: Removed statistical correlations between "${m.protected_attribute}" and all other features in the training data before the model was trained.
   - Result: DI Ratio changed from ${m.baseline.disparate_impact_ratio.toFixed(3)} → ${m.preprocessing.disparate_impact_ratio.toFixed(3)}
   - Accuracy: ${(m.baseline.accuracy * 100).toFixed(1)}% → ${(m.preprocessing.accuracy * 100).toFixed(1)}%

2. Post-processing — Threshold Optimizer:
   - Mechanism: After training, optimized decision thresholds independently for each group within "${m.protected_attribute}" to satisfy demographic parity constraints.
   - Result: DI Ratio changed from ${m.baseline.disparate_impact_ratio.toFixed(3)} → ${m.postprocessing.disparate_impact_ratio.toFixed(3)}
   - Accuracy: ${(m.baseline.accuracy * 100).toFixed(1)}% → ${(m.postprocessing.accuracy * 100).toFixed(1)}%

Overall: DI improved by ${diDelta} and accuracy changed by ${accDelta}%. Best achieved DI: ${bestDI.toFixed(3)}.
The 0.8 threshold for EEOC compliance was ${bestDI >= 0.8 ? 'ACHIEVED' : 'NOT YET ACHIEVED'}.

Write a concise 3-paragraph explanation (no markdown, no bullet points, plain text):
- Paragraph 1: What was done (explain both techniques in simple, non-technical terms a business executive would understand).
- Paragraph 2: What the numbers tell us — did fairness improve? By how much? Any accuracy trade-off?
- Paragraph 3: What should be done next based on these results.
Keep it under 180 words.
`.trim();

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export const Mitigation: React.FC<MitigationProps> = ({ mitigationData }) => {
  const [geminiText, setGeminiText]       = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError]     = useState('');
  const [simStrength, setSimStrength]     = useState(50);

  if (!mitigationData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: '#43474e' }}>
        <p>No mitigation data available. Run an analysis first.</p>
      </div>
    );
  }

  const m = mitigationData;

  const simDI = m.baseline.disparate_impact_ratio + (simStrength / 100) * (m.postprocessing.disparate_impact_ratio - m.baseline.disparate_impact_ratio);
  const simAcc = m.baseline.accuracy + (simStrength / 100) * (m.postprocessing.accuracy - m.baseline.accuracy);

  const scatterData = [
    { name: 'Baseline',        fairness: m.baseline.disparate_impact_ratio,       accuracy: m.baseline.accuracy,       color: '#ba1a1a' },
    { name: 'Pre-processing',  fairness: m.preprocessing.disparate_impact_ratio,  accuracy: m.preprocessing.accuracy,  color: '#F39C12' },
    { name: 'Post-processing', fairness: m.postprocessing.disparate_impact_ratio, accuracy: m.postprocessing.accuracy, color: '#27AE60' },
  ];

  const barData = [
    { name: 'Baseline',       di: m.baseline.disparate_impact_ratio,       acc: +(m.baseline.accuracy * 100).toFixed(1) },
    { name: 'Pre-proc.',      di: m.preprocessing.disparate_impact_ratio,  acc: +(m.preprocessing.accuracy * 100).toFixed(1) },
    { name: 'Post-proc.',     di: m.postprocessing.disparate_impact_ratio, acc: +(m.postprocessing.accuracy * 100).toFixed(1) },
  ];

  const baselineS     = getComplianceStyle(m.baseline.disparate_impact_ratio);
  const preprocessS   = getComplianceStyle(m.preprocessing.disparate_impact_ratio);
  const postprocessS  = getComplianceStyle(m.postprocessing.disparate_impact_ratio);

  const diImprovement = ((m.postprocessing.disparate_impact_ratio - m.baseline.disparate_impact_ratio) / (m.baseline.disparate_impact_ratio || 1) * 100).toFixed(1);
  const accDelta      = ((m.postprocessing.accuracy - m.baseline.accuracy) * 100).toFixed(1);

  const runGemini = async () => {
    setGeminiLoading(true); setGeminiError(''); setGeminiText('');
    try { setGeminiText(await fetchMitigationExplanation(m)); }
    catch (e: any) { setGeminiError(e.message ?? 'Error'); }
    finally { setGeminiLoading(false); }
  };

  // Auto-run once
  // No auto-trigger — user clicks "Analyze" to conserve free-tier quota

  const S = {
    card: { background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as React.CSSProperties,
    section: { marginBottom: '24px' } as React.CSSProperties,
  };

  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#141d23', marginBottom: '4px' }}>Bias Mitigation Results</h2>
      <p style={{ fontSize: '13px', color: '#43474e', marginBottom: '24px' }}>
        Two remediation strategies were tested on the protected attribute <strong style={{ color: '#022448' }}>{m.protected_attribute?.toUpperCase()}</strong>.
        The goal is to raise the Disparate Impact (DI) ratio to ≥ 0.8 (EEOC threshold) while minimising accuracy loss.
      </p>

      {/* ── Strategy Scorecard ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
        {[
          { label: 'Baseline (No Mitigation)', style: baselineS,    di: m.baseline.disparate_impact_ratio,       acc: m.baseline.accuracy,       color: '#ba1a1a' },
          null,
          { label: 'Pre-processing (Correlation Remover)', style: preprocessS,   di: m.preprocessing.disparate_impact_ratio,  acc: m.preprocessing.accuracy,  color: '#F39C12' },
          null,
          { label: 'Post-processing (Threshold Optimizer)', style: postprocessS, di: m.postprocessing.disparate_impact_ratio, acc: m.postprocessing.accuracy, color: '#27AE60' },
        ].map((item, i) => item === null ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowRight size={24} color="#c4c6cf" />
          </div>
        ) : (
          <div key={i} style={{ ...S.card, borderLeft: `4px solid ${item.color}`, padding: '16px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{item.label}</p>
            <div style={{ fontSize: '30px', fontWeight: 800, color: item.color, marginBottom: '6px' }}>{item.di.toFixed(3)}</div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: item.style.color, background: item.style.bg, padding: '2px 8px', borderRadius: '999px' }}>{item.style.label}</span>
            <div style={{ fontSize: '12px', color: '#43474e', marginTop: '8px' }}>Accuracy: <strong>{(item.acc * 100).toFixed(1)}%</strong></div>
          </div>
        ))}
      </div>

      {/* ── Explanation of the scorecard ── */}
      <div style={{ background: '#f6faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 18px', marginBottom: '24px', display: 'flex', gap: '10px' }}>
        <Info size={16} color="#022448" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '13px', color: '#022448', lineHeight: '1.6', margin: 0 }}>
          The <strong>DI (Disparate Impact) ratio</strong> measures whether the least-favoured group is selected at least 80% as often as the most-favoured group.
          A ratio ≥ 0.8 is considered compliant under EEOC's 4/5 rule. Each strategy attempts to close this gap — you can see the trade-off between fairness and model accuracy in the charts below.
        </p>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {[
          {
            icon: parseFloat(diImprovement) > 0 ? <TrendingUp size={28} color="#27AE60" /> : parseFloat(diImprovement) < 0 ? <TrendingDown size={28} color="#ba1a1a" /> : <Minus size={28} color="#43474e" />,
            label: 'Fairness Improvement (DI)',
            value: `${parseFloat(diImprovement) > 0 ? '+' : ''}${diImprovement}%`,
            color: parseFloat(diImprovement) > 0 ? '#27AE60' : '#ba1a1a',
            sub: 'Post-processing vs baseline',
          },
          {
            icon: parseFloat(accDelta) >= 0 ? <TrendingUp size={28} color="#27AE60" /> : <TrendingDown size={28} color="#F39C12" />,
            label: 'Accuracy Delta',
            value: `${parseFloat(accDelta) > 0 ? '+' : ''}${accDelta}%`,
            color: parseFloat(accDelta) >= 0 ? '#27AE60' : '#F39C12',
            sub: 'Post-processing vs baseline',
          },
        ].map((item, i) => (
          <div key={i} style={{ ...S.card, display: 'flex', gap: '14px', alignItems: 'center' }}>
            {item.icon}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: '0.06em' }}>{item.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: item.color, margin: '0 0 2px' }}>{item.value}</p>
              <p style={{ fontSize: '12px', color: '#43474e', margin: 0 }}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Scatter: Fairness vs Accuracy */}
        <div style={S.card}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#141d23', margin: '0 0 6px' }}>Performance vs Fairness Trade-off</h3>
          <p style={{ fontSize: '12px', color: '#43474e', margin: '0 0 16px', lineHeight: '1.5' }}>
            Each dot is a strategy. The ideal strategy sits in the <strong>top-right corner</strong> — high fairness AND high accuracy.
            Moving right means fairer, moving up means more accurate.
          </p>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 35, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eff8" />
                <XAxis type="number" dataKey="fairness" name="DI Ratio" domain={[0, 1.1]}
                  label={{ value: 'DI Ratio (Fairness)', position: 'insideBottom', offset: -20, fontSize: 11 }}
                  tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="accuracy" name="Accuracy" domain={['auto', 'auto']}
                  label={{ value: 'Accuracy', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  tick={{ fontSize: 10 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip formatter={(v: any, name) => [name === 'accuracy' ? `${(+v*100).toFixed(1)}%` : v.toFixed(3), name]} />
                <Scatter data={scatterData}>
                  {scatterData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  <LabelList dataKey="name" position="top" style={{ fontSize: '10px', fontWeight: 700 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar: DI ratio comparison */}
        <div style={S.card}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#141d23', margin: '0 0 6px' }}>DI Ratio per Strategy</h3>
          <p style={{ fontSize: '12px', color: '#43474e', margin: '0 0 16px', lineHeight: '1.5' }}>
            The dashed line marks the <strong>0.8 compliance threshold</strong>. Bars above the line are compliant.
            This view makes it easy to compare how much each strategy lifted fairness.
          </p>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eff8" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1.1]} tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(1)} />
                <Tooltip formatter={(v: any, name) => [v.toFixed ? v.toFixed(3) : v, name === 'di' ? 'DI Ratio' : 'Accuracy %']} />
                <Bar dataKey="di" name="DI Ratio" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => (
                    <Cell key={i} fill={e.di >= 0.8 ? '#27AE60' : e.di >= 0.5 ? '#F39C12' : '#ba1a1a'} />
                  ))}
                </Bar>
                {/* 0.8 reference line */}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#43474e', marginTop: '4px' }}>
            🟢 ≥ 0.8 Compliant &nbsp;|&nbsp; 🟡 0.5–0.8 Improved &nbsp;|&nbsp; 🔴 &lt; 0.5 Violation
          </div>
        </div>
      </div>

      {/* ── Method deep-dive ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...S.card, borderLeft: '4px solid #F39C12' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(243,156,18,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={20} color="#F39C12" />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#022448', margin: '0 0 6px' }}>Strategy 1 — {m.preprocessing.method}</h4>
              <p style={{ fontSize: '12px', color: '#43474e', lineHeight: '1.6', margin: '0 0 8px' }}>
                Operated <em>before training</em>. Mathematically removes the linear correlation between the protected attribute
                and all other features in the dataset. The model then learns from a de-correlated feature space, reducing
                its ability to use proxies for the protected attribute.
              </p>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#43474e', background: '#f8f9fa', padding: '6px 10px', borderRadius: '6px' }}>
                DI: {m.baseline.disparate_impact_ratio.toFixed(3)} → <strong>{m.preprocessing.disparate_impact_ratio.toFixed(3)}</strong>&nbsp;&nbsp;
                Acc: {(m.baseline.accuracy*100).toFixed(1)}% → <strong>{(m.preprocessing.accuracy*100).toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...S.card, borderLeft: '4px solid #27AE60' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(39,174,96,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target size={20} color="#27AE60" />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#022448', margin: '0 0 6px' }}>Strategy 2 — {m.postprocessing.method}</h4>
              <p style={{ fontSize: '12px', color: '#43474e', lineHeight: '1.6', margin: '0 0 8px' }}>
                Operated <em>after training</em>. Adjusts the decision boundary (threshold) for each demographic group
                independently so that selection rates satisfy demographic parity constraints. The base model is unchanged
                — only the final decision rule shifts per group.
              </p>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#43474e', background: '#f8f9fa', padding: '6px 10px', borderRadius: '6px' }}>
                DI: {m.baseline.disparate_impact_ratio.toFixed(3)} → <strong>{m.postprocessing.disparate_impact_ratio.toFixed(3)}</strong>&nbsp;&nbsp;
                Acc: {(m.baseline.accuracy*100).toFixed(1)}% → <strong>{(m.postprocessing.accuracy*100).toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── What-If Simulator ── */}
      <div style={{ ...S.card, marginBottom: '24px', background: '#f8f9fa' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#141d23', margin: '0 0 6px' }}>"What-If" Mitigation Simulator</h3>
        <p style={{ fontSize: '12px', color: '#43474e', margin: '0 0 16px', lineHeight: '1.5' }}>
          Adjust the mitigation strength to see the projected trade-off between fairness and accuracy. 0% represents the baseline model, while 100% represents the fully post-processed model enforcing strict demographic parity.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#43474e', fontWeight: 600, marginBottom: '8px' }}>
              <span>0% (Baseline)</span>
              <span>{simStrength}% Strength</span>
              <span>100% (Strict Parity)</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={simStrength} 
              onChange={(e) => setSimStrength(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#022448' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '16px', background: '#fff', padding: '12px 20px', borderRadius: '8px', border: '1px solid #c4c6cf', minWidth: '220px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', margin: '0 0 4px' }}>Projected DI</p>
              <div style={{ fontSize: '20px', fontWeight: 800, color: getComplianceStyle(simDI).color }}>{simDI.toFixed(3)}</div>
            </div>
            <div style={{ width: '1px', background: '#e2e8f0' }}></div>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', margin: '0 0 4px' }}>Projected Acc</p>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#022448' }}>{(simAcc * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gemini Explanation ── */}
      <div style={{ ...S.card, background: '#fafbff', border: '1px solid #c4c6cf' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} color="#fff" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#141d23' }}>AI Mitigation Explanation</h4>
              <p style={{ margin: 0, fontSize: '11px', color: '#43474e' }}>Powered by Gemini — plain English summary of what was done and why</p>
            </div>
          </div>
          <button onClick={runGemini} disabled={geminiLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600,
              background: geminiLoading ? '#e2e8f0' : '#022448', color: geminiLoading ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: '6px', cursor: geminiLoading ? 'not-allowed' : 'pointer' }}>
            <RefreshCw size={13} style={{ animation: geminiLoading ? 'spin 1s linear infinite' : 'none' }} />
            {geminiLoading ? 'Analyzing...' : geminiText ? 'Re-analyze' : 'Analyze with Gemini'}
          </button>
        </div>

        {geminiLoading && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#43474e', fontSize: '14px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            Gemini is interpreting your mitigation results…
          </div>
        )}

        {geminiError && !geminiLoading && (
          <div style={{ display: 'flex', gap: '10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px' }}>
            <AlertTriangle size={15} color="#c2410c" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '12px', color: '#9a3412' }}>{geminiError}</p>
          </div>
        )}

        {geminiText && !geminiLoading && (
          <div style={{ lineHeight: '1.8', color: '#2d3748', fontSize: '13px', whiteSpace: 'pre-wrap',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px' }}>
            {geminiText}
          </div>
        )}

        {!geminiText && !geminiLoading && !geminiError && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#43474e', fontSize: '13px', background: '#f8faff', borderRadius: '8px', border: '1px dashed #c4c6cf' }}>
            <Brain size={24} color="#c4c6cf" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>AI explanation not yet generated</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#74777f' }}>Click <strong>"Analyze with Gemini"</strong> above to interpret the mitigation results. Each click uses one API call.</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
