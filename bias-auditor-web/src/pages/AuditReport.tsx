import React, { useState } from 'react';
import { Download, ShieldCheck, Brain, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';

interface AuditReportProps {
  biasData: Record<string, any>;
  mitigationData: any;
  proxyData: any;
  explainabilityData: any;
  sessionId: string | null;
}

async function fetchExecutiveSummary(biasData: any, mitigationData: any): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY not set.');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const biasSummary = Object.entries(biasData).map(([attr, d]: any) =>
    `${attr}: DI=${d.disparate_impact_ratio.toFixed(3)}, Parity Diff=${d.parity_difference.toFixed(3)}, ${d.is_di_compliant ? 'PASS' : 'FAIL'}`
  ).join('\n');

  const mitSummary = mitigationData
    ? `Protected attribute: ${mitigationData.protected_attribute}
Baseline DI: ${mitigationData.baseline.disparate_impact_ratio.toFixed(3)}, Acc: ${(mitigationData.baseline.accuracy*100).toFixed(1)}%
After Pre-processing: DI=${mitigationData.preprocessing.disparate_impact_ratio.toFixed(3)}, Acc=${(mitigationData.preprocessing.accuracy*100).toFixed(1)}%
After Post-processing: DI=${mitigationData.postprocessing.disparate_impact_ratio.toFixed(3)}, Acc=${(mitigationData.postprocessing.accuracy*100).toFixed(1)}%`
    : 'No mitigation data.';

  const prompt = `You are a senior AI ethics auditor writing a formal executive summary for a bias audit compliance report.

Bias Detection Results:
${biasSummary}

Mitigation Results:
${mitSummary}

Write a professional executive summary (3 short paragraphs, plain text, no markdown, no bullet points):
- Para 1: Overall fairness status and key findings.
- Para 2: What mitigation was applied and its impact.
- Para 3: Regulatory risk assessment and top recommendation.
Keep under 200 words. Write as if for a C-suite audience.`.trim();

  const result = await model.generateContent(prompt);
  return result.response.text();
}

const S = {
  card: { background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as React.CSSProperties,
  section: { marginBottom: '28px' } as React.CSSProperties,
  heading: { fontSize: '13px', fontWeight: 700, color: '#022448', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '14px' },
  td: { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f0f0f0' } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase' as const, background: '#f6faff', letterSpacing: '0.06em' } as React.CSSProperties,
};

export const AuditReport: React.FC<AuditReportProps> = ({ biasData, mitigationData, proxyData, explainabilityData, sessionId }) => {
  const [geminiText, setGeminiText]       = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError]     = useState('');

  const totalViolations  = Object.values(biasData).filter((d: any) => !d.is_di_compliant).length;
  const avgDI            = Object.values(biasData).reduce((s: number, d: any) => s + d.disparate_impact_ratio, 0) / Math.max(Object.keys(biasData).length, 1);
  const overallPass      = totalViolations === 0;
  const auditDate        = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  const allHighRiskProxies = Object.entries(proxyData ?? {}).flatMap(([attr, p]: any) =>
    (p.high_risk ?? []).map((r: any) => ({ attr, feature: r.feature, correlation: r.correlation }))
  );

  const topFeatures: any[] = explainabilityData?.data?.feature_importance?.slice(0, 5) ?? [];

  const runGemini = async () => {
    setGeminiLoading(true); setGeminiError(''); setGeminiText('');
    try { setGeminiText(await fetchExecutiveSummary(biasData, mitigationData)); }
    catch (e: any) { setGeminiError(e.message ?? 'Error'); }
    finally { setGeminiLoading(false); }
  };

  // No auto-trigger — user clicks to generate and conserve free-tier quota

  const handleDownloadPDF = () => {
    if (!sessionId) { alert('Please perform an analysis first.'); return; }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.open(`${apiUrl}/report/${sessionId}`, '_blank');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#141d23', margin: '0 0 4px' }}>Compliance Audit Report</h2>
          <p style={{ fontSize: '13px', color: '#43474e', margin: 0 }}>
            Generated on {auditDate} &nbsp;·&nbsp; {Object.keys(biasData).length} attribute(s) audited
          </p>
        </div>
        <button onClick={handleDownloadPDF}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#022448', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          <Download size={14} /> Download PDF
        </button>
      </div>

      {/* ── Overall status banner ── */}
      <div style={{ background: overallPass ? '#f0fdf4' : '#fff5f5', border: `1px solid ${overallPass ? '#86efac' : '#fca5a5'}`, borderRadius: '10px', padding: '18px 22px', marginBottom: '28px', display: 'flex', gap: '14px', alignItems: 'center' }}>
        {overallPass ? <ShieldCheck size={32} color="#16a34a" /> : <AlertTriangle size={32} color="#dc2626" />}
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: overallPass ? '#15803d' : '#b91c1c' }}>
            {overallPass ? 'Overall Status: COMPLIANT' : `Overall Status: ${totalViolations} VIOLATION${totalViolations > 1 ? 'S' : ''} DETECTED`}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: overallPass ? '#166534' : '#991b1b' }}>
            Average DI ratio across all attributes: <strong>{avgDI.toFixed(3)}</strong> (threshold: 0.800)
          </p>
        </div>
      </div>

      {/* ── Section 1: AI Executive Summary ── */}
      <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={16} color="#fff" />
            </div>
            <div>
              <h3 style={S.heading as any}>1. Executive Summary</h3>
            </div>
          </div>
          <button onClick={runGemini} disabled={geminiLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '11px', fontWeight: 600,
              background: geminiLoading ? '#e2e8f0' : '#f1f5f9', color: '#022448', border: '1px solid #c4c6cf', borderRadius: '6px', cursor: geminiLoading ? 'not-allowed' : 'pointer' }}>
            <RefreshCw size={11} style={{ animation: geminiLoading ? 'spin 1s linear infinite' : 'none' }} />
            {geminiLoading ? 'Generating…' : geminiText ? 'Regenerate' : 'Generate with Gemini'}
          </button>
        </div>

        {geminiLoading && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#43474e', fontSize: '13px' }}>
            <div style={{ width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            Gemini is generating the executive summary…
          </div>
        )}
        {geminiError && !geminiLoading && (
          <p style={{ fontSize: '12px', color: '#9a3412', background: '#fff7ed', padding: '10px 14px', borderRadius: '6px', margin: 0 }}>{geminiError}</p>
        )}
        {geminiText && !geminiLoading && (
          <p style={{ fontSize: '13px', lineHeight: '1.8', color: '#2d3748', whiteSpace: 'pre-wrap', margin: 0 }}>{geminiText}</p>
        )}

        {!geminiText && !geminiLoading && !geminiError && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#43474e', fontSize: '13px', background: '#f8faff', borderRadius: '8px', border: '1px dashed #c4c6cf' }}>
            <Brain size={24} color="#c4c6cf" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Executive summary not yet generated</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#74777f' }}>Click <strong>"Generate with Gemini"</strong> above to summarize the audit findings. Each click uses one API call.</p>
          </div>
        )}
      </div>

      {/* ── Section 2: Bias Detection Findings ── */}
      <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
        <h3 style={S.heading as any}>2. Bias Detection Findings</h3>
        <p style={{ fontSize: '13px', color: '#43474e', marginBottom: '16px', lineHeight: '1.6' }}>
          The table below shows the Disparate Impact (DI) ratio and Statistical Parity Difference for each protected attribute.
          A DI ratio below <strong>0.8</strong> indicates that the least-favoured group is selected less than 80% as often as the most-favoured group — a violation of the EEOC 4/5 rule.
          A parity difference close to 0 means equal selection rates across groups.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Attribute', 'DI Ratio', 'Parity Difference', 'Groups', 'EEOC Status'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(biasData).map(([attr, d]: any) => (
                <tr key={attr} style={{ background: d.is_di_compliant ? '#fff' : '#fff5f5' }}>
                  <td style={{ ...S.td, fontWeight: 700, textTransform: 'capitalize' }}>{attr}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: d.is_di_compliant ? '#15803d' : '#dc2626' }}>{d.disparate_impact_ratio.toFixed(3)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{d.parity_difference.toFixed(3)}</td>
                  <td style={S.td}>{d.groups?.length ?? '—'} groups</td>
                  <td style={S.td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700,
                      color: d.is_di_compliant ? '#15803d' : '#dc2626',
                      background: d.is_di_compliant ? '#dcfce7' : '#fee2e2',
                      padding: '3px 10px', borderRadius: '999px' }}>
                      {d.is_di_compliant ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {d.is_di_compliant ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Group breakdown per attribute */}
        {Object.entries(biasData).map(([attr, d]: any) => (
          <div key={attr} style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#022448', margin: '0 0 10px', textTransform: 'capitalize' }}>
              Group Breakdown — {attr}
            </h4>
            <p style={{ fontSize: '12px', color: '#43474e', margin: '0 0 10px', lineHeight: '1.5' }}>
              Each row shows the selection rate for a subgroup within <em>{attr}</em>.
              The group with the highest selection rate sets the benchmark; all others are compared against it.
              Large gaps between groups indicate systemic disparities the model has learnt.
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Group', 'Sample Size', 'Selection Rate', 'Relative Rate'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxRate = Math.max(...(d.groups ?? []).map((g: any) => g.selection_rate));
                    return (d.groups ?? []).map((g: any) => {
                      const rel = maxRate > 0 ? g.selection_rate / maxRate : 0;
                      return (
                        <tr key={g.group_name}>
                          <td style={{ ...S.td, fontWeight: 600 }}>{g.group_name}</td>
                          <td style={S.td}>{g.group_size?.toLocaleString() ?? '—'}</td>
                          <td style={{ ...S.td, fontFamily: 'monospace' }}>{(g.selection_rate * 100).toFixed(1)}%</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${rel * 100}%`, height: '100%', background: rel >= 0.8 ? '#22c55e' : '#ef4444', borderRadius: '999px' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: rel >= 0.8 ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                                {(rel * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3: Mitigation Results ── */}
      {mitigationData && (
        <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
          <h3 style={S.heading as any}>3. Bias Mitigation Results</h3>
          <p style={{ fontSize: '13px', color: '#43474e', marginBottom: '16px', lineHeight: '1.6' }}>
            Two strategies were applied to the primary protected attribute <strong style={{ color: '#022448' }}>{mitigationData.protected_attribute}</strong>:
            <em> Correlation Remover</em> (pre-processing, adjusts training data) and
            <em> Threshold Optimizer</em> (post-processing, adjusts decision boundaries per group).
            The goal is to improve the DI ratio toward ≥ 0.8 with minimal accuracy trade-off.
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Strategy', 'Method', 'DI Ratio', 'Accuracy', 'DI Change', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[
                  { label: 'Baseline',        method: 'No Mitigation',                    d: mitigationData.baseline },
                  { label: 'Pre-processing',  method: mitigationData.preprocessing.method,  d: mitigationData.preprocessing },
                  { label: 'Post-processing', method: mitigationData.postprocessing.method, d: mitigationData.postprocessing },
                ].map((row, i) => {
                  const delta = i === 0 ? 0 : row.d.disparate_impact_ratio - mitigationData.baseline.disparate_impact_ratio;
                  const compliant = row.d.disparate_impact_ratio >= 0.8;
                  return (
                    <tr key={row.label} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{row.label}</td>
                      <td style={{ ...S.td, fontSize: '12px', color: '#43474e' }}>{row.method}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: compliant ? '#15803d' : '#dc2626' }}>{row.d.disparate_impact_ratio.toFixed(3)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{(row.d.accuracy * 100).toFixed(1)}%</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: delta > 0 ? '#15803d' : delta < 0 ? '#dc2626' : '#43474e', fontWeight: 600 }}>
                        {i === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`}
                      </td>
                      <td style={S.td}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: compliant ? '#15803d' : '#dc2626', background: compliant ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: '999px' }}>
                          {compliant ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ background: '#f6faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '10px' }}>
            <Info size={14} color="#022448" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: '#022448', lineHeight: '1.6' }}>
              <strong>How to read this:</strong> A positive DI Change means the strategy made the model fairer. The best strategy is the one with DI closest to or above 0.8
              with the smallest accuracy drop. Consult the Mitigation tab for a full AI explanation of the techniques used.
            </p>
          </div>
        </div>
      )}

      {/* ── Section 4: Proxy Variables ── */}
      {allHighRiskProxies.length > 0 && (
        <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
          <h3 style={S.heading as any}>4. High-Risk Proxy Variables</h3>
          <p style={{ fontSize: '13px', color: '#43474e', marginBottom: '14px', lineHeight: '1.6' }}>
            Proxy variables are features that are not themselves protected attributes but are strongly correlated with them.
            A model that uses these features may inadvertently discriminate — even if the protected attribute is excluded from training.
            Features with correlation &gt; 0.5 are flagged as high-risk.
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Feature', 'Correlated With', 'Correlation', 'Risk Level'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {allHighRiskProxies.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fff5f5' }}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{p.feature}</td>
                    <td style={{ ...S.td, textTransform: 'capitalize' }}>{p.attr}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{p.correlation.toFixed(3)}</td>
                    <td style={S.td}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#93000a', background: '#ffdad6', padding: '2px 8px', borderRadius: '999px' }}>
                        High Risk
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 5: Explainability ── */}
      {topFeatures.length > 0 && (
        <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
          <h3 style={S.heading as any}>5. Model Explainability — Top Feature Importance</h3>
          <p style={{ fontSize: '13px', color: '#43474e', marginBottom: '14px', lineHeight: '1.6' }}>
            SHAP (SHapley Additive exPlanations) values measure how much each feature contributes to the model's decisions on average.
            A high importance score means the model relies heavily on that feature — which is a concern if the feature is a proxy for a protected attribute.
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Rank', 'Feature', 'Mean |SHAP|', 'Relative Importance'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {topFeatures.map((f: any, i: number) => {
                  const maxImp = topFeatures[0]?.importance ?? 1;
                  const rel = maxImp > 0 ? f.importance / maxImp : 0;
                  const isProxy = allHighRiskProxies.some(p => p.feature.toLowerCase() === f.feature.toLowerCase());
                  return (
                    <tr key={i} style={{ background: isProxy ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafbff' }}>
                      <td style={{ ...S.td, fontWeight: 700, color: '#43474e' }}>#{i + 1}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>
                        {f.feature}
                        {isProxy && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#dc2626', background: '#ffdad6', padding: '1px 6px', borderRadius: '999px' }}>PROXY</span>}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{f.importance.toFixed(4)}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${rel * 100}%`, height: '100%', background: isProxy ? '#ef4444' : '#022448', borderRadius: '999px' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#43474e' }}>{(rel * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 6: Recommendations ── */}
      <div style={{ ...S.card, padding: '22px 26px', marginBottom: '22px' }}>
        <h3 style={S.heading as any}>6. Recommendations</h3>
        {Object.entries(biasData).map(([attr, d]: any) => (
          <div key={attr} style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#022448', margin: '0 0 8px', textTransform: 'capitalize' }}>
              {attr} — {d.is_di_compliant ? 'Maintain & Monitor' : 'Action Required'}
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#2d3748', lineHeight: '1.8' }}>
              {!d.is_di_compliant && <>
                <li>Apply the Threshold Optimizer post-processing strategy to bring the DI ratio above 0.8.</li>
                <li>Investigate high-correlation proxy features and consider excluding or transforming them.</li>
                <li>Collect more representative training data for under-represented groups.</li>
              </>}
              {d.is_di_compliant && <>
                <li>Continue monitoring selection rates quarterly for drift.</li>
                <li>Document the current compliance status for regulatory records.</li>
              </>}
            </ul>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
