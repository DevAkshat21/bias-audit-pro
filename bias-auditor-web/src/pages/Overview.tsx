import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Brain, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Gemini config ──────────────────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const ATTRIBUTE_COLORS = ['#022448', '#27AE60', '#F39C12', '#9B59B6', '#E74C3C', '#1ABC9C'];

interface OverviewProps {
  biasData: Record<string, any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildChartData(biasData: Record<string, any>) {
  /**
   * Returns one entry per group, limited to the top-8 groups (by size)
   * per attribute.  Each entry carries the attribute label so we can
   * colour bars and display the legend properly.
   */
  return Object.entries(biasData).flatMap(([attr, data], attrIdx) => {
    const groups: any[] = data.groups ?? [];
    // Sort by group_size desc, take top 8 to prevent clutter
    const top = [...groups]
      .sort((a, b) => (b.group_size ?? 0) - (a.group_size ?? 0))
      .slice(0, 8);

    return top.map(g => ({
      label: `${attr}: ${g.group_name}`,
      groupName: String(g.group_name),
      attribute: attr,
      selectionRate: parseFloat(((g.selection_rate ?? 0) * 100).toFixed(1)),
      fill: ATTRIBUTE_COLORS[attrIdx % ATTRIBUTE_COLORS.length],
    }));
  });
}

function buildDiChartData(biasData: Record<string, any>) {
  /** One bar per protected attribute showing the DI ratio vs the 0.8 threshold. */
  return Object.entries(biasData).map(([attr, data]) => ({
    attribute: attr.charAt(0).toUpperCase() + attr.slice(1),
    diRatio: parseFloat(data.disparate_impact_ratio.toFixed(3)),
    fill: data.is_di_compliant ? '#27AE60' : '#ba1a1a',
  }));
}

// ── Gemini trend analysis ──────────────────────────────────────────────────────
async function fetchGeminiTrend(biasData: Record<string, any>): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not set. Add it to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Build a compact summary of the metrics to keep the prompt small
  const summary = Object.entries(biasData).map(([attr, d]) => {
    const groups = (d.groups ?? [])
      .map((g: any) => `    • ${g.group_name}: ${(g.selection_rate * 100).toFixed(1)}%`)
      .join('\n');
    return (
      `Attribute: ${attr}\n` +
      `  DI Ratio: ${d.disparate_impact_ratio.toFixed(3)} (threshold 0.8, ${d.is_di_compliant ? 'PASS' : 'FAIL'})\n` +
      `  Parity Difference: ${d.parity_difference.toFixed(3)}\n` +
      `  Group Selection Rates:\n${groups}`
    );
  }).join('\n\n');

  const prompt = `
You are an AI fairness auditor. Analyze the following bias metrics from a machine-learning model and provide a concise trend analysis. Focus on:
1. Which attributes show the most severe bias and why it matters.
2. The spread between the highest and lowest selection rates within each attribute.
3. Concrete, actionable recommendations (2-3 bullet points).
4. An overall risk assessment (Low / Medium / High).

Keep your response under 200 words. Use plain text with short paragraphs — no markdown headers or bullet symbols.

Bias Metrics:
${summary}
`.trim();

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Custom bar label ──────────────────────────────────────────────────────────
const DiBarLabel = ({ x, y, width, value }: any) => (
  <text x={x + width + 6} y={y + 10} fill="#43474e" fontSize={11} fontWeight={600}>
    {value}
  </text>
);

// ── Component ─────────────────────────────────────────────────────────────────
export const Overview: React.FC<OverviewProps> = ({ biasData }) => {
  const [geminiText, setGeminiText]     = useState<string>('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError]   = useState<string>('');

  const totalViolations = Object.values(biasData).filter((d: any) => !d.is_di_compliant).length;
  const avgDi = Object.values(biasData).reduce((sum: number, d: any) => sum + d.disparate_impact_ratio, 0)
    / Math.max(Object.keys(biasData).length, 1);
  const fairnessScore = Math.min(100, Math.round(avgDi * 100));

  // Chart data
  const groupChartData = buildChartData(biasData);
  const diChartData    = buildDiChartData(biasData);

  // Auto-fetch Gemini analysis when biasData changes
  const runGeminiAnalysis = async () => {
    setGeminiLoading(true);
    setGeminiError('');
    setGeminiText('');
    try {
      const text = await fetchGeminiTrend(biasData);
      setGeminiText(text);
    } catch (err: any) {
      setGeminiError(err.message ?? 'Unknown error');
    } finally {
      setGeminiLoading(false);
    }
  };

  // No auto-trigger — user clicks "Analyze" to conserve free-tier quota

  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#141d23', marginBottom: '20px' }}>
        System Overview
      </h2>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Fairness Score */}
        <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            Overall Fairness Score
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#141d23' }}>{fairnessScore}<span style={{ fontSize: '18px', color: '#74777f', marginLeft: '4px' }}>/ 100</span></span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: fairnessScore >= 80 ? '#005228' : '#ba1a1a', background: fairnessScore >= 80 ? '#7efba4' : '#ffdad6', padding: '2px 8px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {fairnessScore >= 80 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {fairnessScore >= 80 ? 'Good' : 'At Risk'}
            </span>
          </div>
        </div>

        {/* Attributes Monitored */}
        <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#43474e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            Attributes Monitored
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#141d23' }}>{Object.keys(biasData).length}</span>
            <span style={{ fontSize: '13px', color: '#43474e' }}>Active Audits</span>
          </div>
        </div>

        {/* Violations */}
        <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderLeft: '4px solid #ba1a1a', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#ba1a1a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            Alerts Requiring Action
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#ba1a1a' }}>{totalViolations}</span>
            {totalViolations > 0
              ? <span style={{ fontSize: '12px', fontWeight: 600, color: '#ba1a1a', background: '#ffdad6', padding: '2px 8px', borderRadius: '999px' }}>High Priority</span>
              : <span style={{ fontSize: '12px', fontWeight: 600, color: '#005228', background: '#7efba4', padding: '2px 8px', borderRadius: '999px' }}>All Clear</span>
            }
          </div>
        </div>
      </div>

      {/* ── Chart 1: DI Ratio per Attribute ── */}
      <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#141d23', margin: '0 0 4px' }}>
          Disparate Impact Ratio by Attribute
        </h4>
        <p style={{ fontSize: '13px', color: '#43474e', margin: '0 0 20px' }}>
          Green = compliant (≥ 0.8). Red = violation. The dashed line marks the 0.8 EEOC threshold.
        </p>
        <div style={{ height: `${Math.max(160, diChartData.length * 60)}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diChartData} layout="vertical" margin={{ top: 4, right: 80, left: 20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6eff8" />
              <XAxis type="number" domain={[0, 1.1]} tick={{ fontSize: 11 }} stroke="#74777f"
                tickFormatter={v => v.toFixed(1)} />
              <YAxis dataKey="attribute" type="category" tick={{ fontSize: 13, fontWeight: 600 }} stroke="#74777f" width={110} />
              <Tooltip
                formatter={(v: any) => [v, 'DI Ratio']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #c4c6cf', fontSize: '12px' }}
              />
              {/* 0.8 reference line drawn as a custom overlay */}
              <Bar dataKey="diRatio" barSize={28} radius={[0, 6, 6, 0]} label={<DiBarLabel />}>
                {diChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Chart 2: Selection Rate by Group (top 8 per attribute) ── */}
      {groupChartData.length <= 24 && (
        <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#141d23', margin: '0 0 4px' }}>
            Selection Rate by Demographic Group
          </h4>
          <p style={{ fontSize: '13px', color: '#43474e', margin: '0 0 20px' }}>
            Top groups per attribute (by sample size). Colour-coded by protected attribute.
          </p>
          <div style={{ height: `${Math.max(200, groupChartData.length * 32)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupChartData} layout="vertical" margin={{ top: 4, right: 50, left: 160, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6eff8" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#74777f"
                  tickFormatter={v => `${v}%`} />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke="#74777f" width={155} />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, 'Selection Rate']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #c4c6cf', fontSize: '12px' }}
                />
                <Bar dataKey="selectionRate" barSize={18} radius={[0, 4, 4, 0]}>
                  {groupChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Attribute legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
            {Object.keys(biasData).map((attr, i) => (
              <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#43474e' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: ATTRIBUTE_COLORS[i % ATTRIBUTE_COLORS.length] }} />
                {attr}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Plain-English Compliance Alerts ── */}
      <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#141d23', margin: '0 0 16px' }}>
          Compliance Alerts (Plain English)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(biasData).map(([attr, data]: any) => {
            const di = data.disparate_impact_ratio;
            const isCompliant = data.is_di_compliant;
            const deficit = ((1 - di) * 100).toFixed(0);
            
            if (isCompliant) {
              return (
                <div key={attr} style={{ display: 'flex', gap: '12px', background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <TrendingUp size={20} color="#15803d" style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 700, color: '#166534', marginRight: '8px' }}>PASS ({attr.toUpperCase()}):</span>
                    <span style={{ color: '#166534', fontSize: '13px' }}>The model selection rates for this attribute are within the legal 80% threshold. No significant bias detected.</span>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={attr} style={{ display: 'flex', gap: '12px', background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <AlertTriangle size={20} color="#b91c1c" style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 700, color: '#991b1b', marginRight: '8px' }}>VIOLATION ({attr.toUpperCase()}):</span>
                    <span style={{ color: '#991b1b', fontSize: '13px' }}>
                      Alert: The least favored group in this category is <strong>{deficit}% less likely</strong> to be selected than the privileged group. 
                      This violates the '80% Rule' (Four-Fifths Rule) used by the EEOC and may pose a legal or reputational risk.
                    </span>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* ── Gemini Bias Trend Analysis ── */}
      <div style={{ background: '#fff', border: '1px solid #c4c6cf', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} color="#fff" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#141d23' }}>
                Bias Trend Analysis
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#43474e' }}>Powered by Gemini AI</p>
            </div>
          </div>
          <button
            onClick={runGeminiAnalysis}
            disabled={geminiLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, background: geminiLoading ? '#e2e8f0' : '#022448', color: geminiLoading ? '#94a3b8' : '#fff', border: 'none', borderRadius: '6px', cursor: geminiLoading ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: geminiLoading ? 'spin 1s linear infinite' : 'none' }} />
            {geminiLoading ? 'Analyzing...' : geminiText ? 'Re-analyze' : 'Analyze with Gemini'}
          </button>
        </div>

        {/* States */}
        {geminiLoading && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#43474e', fontSize: '14px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Gemini is analyzing your bias metrics…
          </div>
        )}

        {geminiError && !geminiLoading && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px 16px' }}>
            <AlertTriangle size={16} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#c2410c' }}>Gemini API Status</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#9a3412' }}>
                {geminiError.includes('429') 
                  ? 'Daily Quota Exceeded. Please wait a few minutes or try again tomorrow. The free tier has strict limits on requests per day/minute.' 
                  : geminiError}
              </p>
              {geminiError.includes('VITE_GEMINI_API_KEY') && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9a3412', fontFamily: 'monospace', background: '#fed7aa', padding: '4px 8px', borderRadius: '4px' }}>
                  Create <strong>.env</strong> in bias-auditor-web/ and add:<br />
                  VITE_GEMINI_API_KEY=your_key_here
                </p>
              )}
            </div>
          </div>
        )}

        {geminiText && !geminiLoading && (
          <div style={{ lineHeight: '1.75', color: '#2d3748', fontSize: '14px', whiteSpace: 'pre-wrap', background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px' }}>
            {geminiText}
          </div>
        )}

        {!geminiText && !geminiLoading && !geminiError && (
          <div style={{ padding: '28px', textAlign: 'center', color: '#43474e', fontSize: '13px', background: '#f8faff', borderRadius: '8px', border: '1px dashed #c4c6cf' }}>
            <Brain size={28} color="#c4c6cf" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>AI analysis not yet generated</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#74777f' }}>Click <strong>"Analyze with Gemini"</strong> above to generate a trend analysis. Each click uses one API call.</p>
          </div>
        )}
      </div>

      {/* Inline keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
