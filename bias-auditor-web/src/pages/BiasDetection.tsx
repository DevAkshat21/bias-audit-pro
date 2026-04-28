import React, { useState, useEffect } from 'react';
import type { BiasMetric, ProxyAnalysis, GroupData } from '../types';
import { AlertCircle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface BiasDetectionProps {
  biasData: Record<string, BiasMetric>;
  proxyData: Record<string, ProxyAnalysis>;
}

export const BiasDetection: React.FC<BiasDetectionProps> = ({ biasData }) => {
  const attributes = Object.keys(biasData);
  const [selectedAttr, setSelectedAttr] = useState(attributes[0] || '');
  
  // Update selection if biasData changes (new upload)
  useEffect(() => {
    if (attributes.length > 0 && !attributes.includes(selectedAttr)) {
      setSelectedAttr(attributes[0]);
    }
  }, [biasData]);

  const data = biasData[selectedAttr];

  if (!data) return <div className="p-xl text-center">No analysis data available. Please upload a dataset.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-lg">
        <div>
          <h2 className="text-2xl font-semibold text-on-surface">Detailed Bias Analysis</h2>
          <p className="text-sm text-on-surface-variant">In-depth audit of disparate impact and proxy variables.</p>
        </div>
        <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant overflow-x-auto max-w-[50%]">
          {attributes.map((attr) => (
            <button
              key={attr}
              onClick={() => setSelectedAttr(attr)}
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                selectedAttr === attr
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {attr.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* How-to-read callout */}
      <div style={{ background: '#f6faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <Info className="w-4 h-4 text-primary shrink-0" style={{ marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#022448', lineHeight: '1.7' }}>
          <strong>How to read this page:</strong> The <em>Disparate Impact (DI) ratio</em> is the key metric — it compares the selection rate of the least-favoured group to the most-favoured group.
          A ratio ≥ <strong>0.8</strong> is EEOC-compliant (the "4/5 rule"). The <em>Statistical Parity Difference</em> shows the raw gap between selection rates; values close to 0 are ideal.
          Switch between protected attributes using the tabs above.
        </div>
      </div>

      <div className="grid grid-cols-12 gap-lg items-start">
        {/* Col 1: Metrics Panel (4/12) */}
        <div className="col-span-12 lg:col-span-4 space-y-lg">
          <div className="bg-white border border-outline-variant rounded-lg p-lg shadow-sm">
            <div className="flex justify-between items-start mb-md">
              <h3 className="text-lg font-semibold text-primary">Disparate Impact</h3>
              <span className={clsx(
                "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                data.is_di_compliant ? "bg-[#7efba4] text-[#005228]" : "bg-error-container text-on-error-container"
              )}>
                {data.is_di_compliant ? 'Compliant' : 'Violation'}
              </span>
            </div>
            <div className={clsx(
              "text-5xl font-bold mb-2",
              data.is_di_compliant ? "text-primary" : "text-error"
            )}>
              {data.disparate_impact_ratio.toFixed(2)}
            </div>
            <p className="text-sm text-on-surface-variant mb-lg">Ratio of lowest selection rate to highest.</p>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-outline mb-1 uppercase tracking-tighter">
                  <span>0.0</span>
                  <span>Threshold: 0.8</span>
                  <span>1.0</span>
                </div>
                <div className="w-full h-2 bg-[#e6eff8] rounded-full relative overflow-hidden">
                  <div 
                    className={clsx(
                      "h-full transition-all duration-1000",
                      data.is_di_compliant ? "bg-success" : "bg-error"
                    )}
                    style={{ width: `${Math.min(data.disparate_impact_ratio * 100, 100)}%` }}
                  ></div>
                  <div className="absolute top-0 left-[80%] h-full border-l border-on-surface opacity-30"></div>
                </div>
              </div>

              <div className="pt-md border-t border-outline-variant flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Statistical Parity Diff</span>
                <span className="text-sm font-semibold text-primary">{data.parity_difference.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#f6faff] border border-blue-100 rounded-lg p-md flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-xs text-primary/80 leading-relaxed">
              <strong>EEOC Guidelines:</strong> A selection rate less than 80% (4/5 rule) of the highest group is generally evidence of adverse impact.
            </p>
          </div>
        </div>

        {/* Col 2: Group Analysis (5/12) */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
          <div className="p-lg border-b border-outline-variant">
            <h3 className="text-lg font-semibold text-on-surface">Group Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f6faff] text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  <th className="px-lg py-3">Group Name</th>
                  <th className="px-lg py-3">Selection Rate</th>
                  <th className="px-lg py-3">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.groups.map((group: GroupData) => (
                  <tr key={group.group_name} className="hover:bg-[#f6faff] transition-colors">
                    <td className="px-lg py-4 text-sm font-medium text-on-surface">{group.group_name}</td>
                    <td className="px-lg py-4 text-sm text-on-surface-variant">{(group.selection_rate * 100).toFixed(1)}%</td>
                    <td className="px-lg py-4">
                      <div className="w-24 h-1.5 bg-[#e6eff8] rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${group.selection_rate * 100}%` }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3: Verdict Sidebar (3/12) */}
        <div className="col-span-12 lg:col-span-3 space-y-lg sticky top-24">
          <div className={clsx(
            "rounded-lg p-lg text-center border-2",
            data.is_di_compliant 
              ? "bg-[#7efba4]/20 border-[#2ECC71]/30" 
              : "bg-error-container/20 border-error/30"
          )}>
            {data.is_di_compliant ? (
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-md" />
            ) : (
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-md" />
            )}
            <h2 className={clsx(
              "text-2xl font-bold mb-1",
              data.is_di_compliant ? "text-[#005228]" : "text-on-error-container"
            )}>
              {data.is_di_compliant ? 'PASS' : 'FAIL'}
            </h2>
            <p className="text-sm font-medium opacity-70">
              {data.is_di_compliant ? 'Compliance Met' : 'Action Required'}
            </p>
          </div>

          <div className="bg-white border border-outline-variant rounded-lg p-lg shadow-sm">
            <h4 className="text-sm font-bold text-primary mb-md uppercase tracking-wider">Recommendations</h4>
            <ul className="space-y-4">
              {!data.is_di_compliant ? (
                <>
                  <li className="flex gap-2 text-xs text-on-surface-variant group cursor-pointer hover:text-primary">
                    <ChevronRight className="w-4 h-4 text-error shrink-0 group-hover:translate-x-1 transition-transform" />
                    <span>Investigate high-correlation proxy features (see Explainability).</span>
                  </li>
                  <li className="flex gap-2 text-xs text-on-surface-variant group cursor-pointer hover:text-primary">
                    <ChevronRight className="w-4 h-4 text-error shrink-0 group-hover:translate-x-1 transition-transform" />
                    <span>Apply re-weighing mitigation to the training dataset.</span>
                  </li>
                </>
              ) : (
                <li className="flex gap-2 text-xs text-on-surface-variant">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span>Maintain monitoring for drift during the next evaluation cycle.</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
