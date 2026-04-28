import React from 'react';
import type { ProxyAnalysis, ProxyRisk, FeatureImportance } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Info } from 'lucide-react';

interface ExplainabilityProps {
  proxyData: Record<string, ProxyAnalysis>;
  explainabilityData: any;
}

export const Explainability: React.FC<ExplainabilityProps> = ({ proxyData, explainabilityData }) => {
  const allHighRiskProxies = Object.values(proxyData || {}).flatMap((p: ProxyAnalysis) => p.high_risk?.map((r: ProxyRisk) => r.feature.toLowerCase()) || []);
  
  const isSkipped = explainabilityData?.status === 'skipped';
  const importanceData = explainabilityData?.data?.feature_importance || [];
  const sortedFeatures = [...importanceData].sort((a, b) => a.importance - b.importance);

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-2xl font-semibold text-on-surface mb-xs">Model Explainability</h2>
      <p className="text-sm text-on-surface-variant mb-lg">Identify potential proxy variables and global feature importance driving model decisions.</p>

      {/* How-to-read callout */}
      <div style={{ background: '#f6faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <Info className="w-4 h-4 text-primary shrink-0" style={{ marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#022448', lineHeight: '1.7' }}>
          <strong>How to read this page:</strong> The <em>Feature Importance</em> chart (left) uses SHAP values to show which features drive the model's decisions most.
          Longer bars = more influence. <span style={{ color: '#ba1a1a', fontWeight: 700 }}>Red bars</span> are features flagged as proxy variables — they are highly correlated with a protected attribute and may be the root cause of bias.
          The <em>Proxy Risk Scanner</em> (right) lists features the system detected as potential indirect discriminators.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7 bg-white border border-outline-variant rounded-lg p-lg shadow-sm">
          <h3 className="text-lg font-semibold text-on-surface mb-lg">Global Feature Importance</h3>
          
          {isSkipped ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-center bg-[#f6faff] rounded-lg border border-outline-variant/50 p-xl">
              <Info className="w-12 h-12 text-primary/60 mb-4" />
              <h4 className="text-lg font-bold text-primary mb-2">Analysis Skipped</h4>
              <p className="text-sm text-on-surface-variant max-w-sm">
                {explainabilityData?.reason || "SHAP explanation could not be computed for this dataset."}
              </p>
            </div>
          ) : (
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedFeatures}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e6eff8" />
                  <XAxis type="number" tick={{fontSize: 12}} stroke="#74777f" />
                  <YAxis dataKey="feature" type="category" tick={{fontSize: 12}} stroke="#74777f" />
                  <Tooltip 
                    cursor={{fill: '#f6faff'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #c4c6cf' }}
                  />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={24}>
                    {sortedFeatures.map((entry: FeatureImportance, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={allHighRiskProxies.includes(entry.feature.toLowerCase()) ? '#ba1a1a' : '#022448'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-lg">
          <div className="bg-error-container/20 border border-error/20 rounded-lg p-md flex items-center gap-4">
            <div className="bg-error-container text-on-error-container w-10 h-10 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-on-error-container uppercase tracking-wider">Proxy Alert</h4>
              <p className="text-xs text-on-error-container/80">Features identified as potential proxy variables for the current dataset.</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-on-surface">Proxy Risk Scanner</h3>
          
          {Object.entries(proxyData || {}).map(([attr, info]: [string, ProxyAnalysis]) => (
            <React.Fragment key={attr}>
              {info.high_risk?.map((proxy: ProxyRisk) => (
                <div key={`${attr}-${proxy.feature}`} className="bg-white border border-outline-variant border-l-4 border-l-error rounded-lg p-lg shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-on-surface text-base">{proxy.feature}</h4>
                    <span className="text-[10px] font-bold px-2 py-1 bg-error-container text-on-error-container rounded-full uppercase">High Risk</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-md">
                    Strong correlation detected with protected attribute <strong>{attr.toUpperCase()}</strong>.
                  </p>
                </div>
              ))}
            </React.Fragment>
          ))}
          
          {allHighRiskProxies.length === 0 && (
            <div className="bg-white border border-outline-variant rounded-lg p-lg text-center text-sm text-on-surface-variant">
              No high-risk proxies detected for the current attributes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
