import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ConfigModal } from './components/ConfigModal';
import { Overview } from './pages/Overview';
import { BiasDetection } from './pages/BiasDetection';
import { Mitigation } from './pages/Mitigation';
import { Explainability } from './pages/Explainability';
import { AuditReport } from './pages/AuditReport';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ id: string, columns: string[] } | null>(null);
  const [error, setError] = useState<{ message: string, details?: string } | null>(null);
  
  // State for dynamic data — always starts empty, no filler data
  const [biasData, setBiasData] = useState<any>(null);
  const [mitigationData, setMitigationData] = useState<any>(null);
  const [proxyData, setProxyData] = useState<any>(null);
  const [explainabilityData, setExplainabilityData] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const increment = prev < 40 ? 4 : prev < 70 ? 1.5 : prev < 90 ? 0.5 : 0.1;
          return Math.min(98, prev + increment);
        });
      }, 200);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    setLoadingMessage(`Uploading "${file.name}"...`);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/upload-headers`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Upload failed');
      }

      setPendingSession({ id: data.sessionId, columns: data.columns });
      setShowConfig(true);
    } catch (err: any) {
      console.error(err);
      setError({ message: 'Failed to process file', details: err.message });
    } finally {
      setIsAnalyzing(false);
      setLoadingMessage('');
    }
  };

  const runAnalysis = async (target: string, protectedAttrs: string[]) => {
    if (!pendingSession) return;
    
    setShowConfig(false);
    setIsAnalyzing(true);
    setLoadingMessage('Running bias analysis — this may take a moment...');
    setError(null);
    
    const formData = new FormData();
    formData.append('sessionId', pendingSession.id);
    formData.append('target', target);
    formData.append('protectedAttributes', JSON.stringify(protectedAttrs));

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        body: formData,
      });

      const results = await response.json();
      if (!response.ok || results.error) {
        throw new Error(results.details || results.error || 'Analysis failed');
      }
      
      // Update state with real backend results
      setBiasData(results.bias);
      setMitigationData(results.mitigation);
      setProxyData(results.proxy);
      setExplainabilityData(results.explainability);
      setWarnings(results.warnings || []);
      setSessionId(pendingSession.id);
      
      setActiveTab('overview');
    } catch (err: any) {
      console.error(err);
      setError({ message: 'Analysis failed', details: err.message });
    } finally {
      setIsAnalyzing(false);
      setLoadingMessage('');
    }
  };

  const resetError = () => setError(null);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} hasData={!!biasData} />
      
      <main className="flex-1 ml-[260px] flex flex-col min-w-0">
        <TopBar onFileUpload={handleFileUpload} isAnalyzing={isAnalyzing} />
        
        {warnings.length > 0 && !error && (
          <div className="bg-warning/10 border-b border-warning/20 p-4 text-warning font-medium text-sm">
            <h4 className="font-bold mb-1">Analysis Warnings:</h4>
            <ul className="list-disc pl-5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="p-xl max-w-[1440px] mx-auto w-full">
          {error ? (
            <div className="bg-error-container text-on-error-container p-xl rounded-xl shadow-sm border border-error/20 flex flex-col items-center justify-center min-h-[300px] text-center">
              <AlertCircle className="w-16 h-16 mb-4 text-error" />
              <h2 className="text-2xl font-bold mb-2">{error.message}</h2>
              <p className="text-on-error-container/80 mb-6 max-w-lg">{error.details}</p>
              <button 
                onClick={resetError}
                className="flex items-center gap-2 bg-error text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-error/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Dismiss Error
              </button>
            </div>
          ) : biasData ? (
            <>
              {activeTab === 'overview' && <Overview biasData={biasData} />}
              {activeTab === 'bias' && <BiasDetection biasData={biasData} proxyData={proxyData ?? {}} />}
              {activeTab === 'mitigation' && <Mitigation mitigationData={mitigationData} />}
              {activeTab === 'explainability' && <Explainability explainabilityData={explainabilityData} proxyData={proxyData ?? {}} />}
              {activeTab === 'report' && <AuditReport biasData={biasData} mitigationData={mitigationData} proxyData={proxyData} explainabilityData={explainabilityData} sessionId={sessionId} />}
            </>
          ) : (
            // No data loaded — show a clean empty state, no filler content
            <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-on-surface mb-2">No Dataset Loaded</h3>
                <p className="text-on-surface-variant max-w-sm">Upload a CSV file using the button in the top-right corner to begin your fairness audit.</p>
              </div>
              <p className="text-xs text-outline font-mono bg-surface border border-outline-variant px-4 py-2 rounded-lg">
                Supported format: <strong>.csv</strong>
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Full-screen loading overlay shown during upload and analysis */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-on-surface mb-1">Please Wait</h3>
              <p className="text-sm text-on-surface-variant">{loadingMessage || 'Processing...'}</p>
            </div>
            <div className="w-full bg-outline-variant rounded-full h-2 overflow-hidden mt-2 relative">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out" 
                style={{width: `${progress}%`}} 
              />
            </div>
            <p className="text-xs font-bold text-primary animate-pulse">
              {Math.floor(progress)}% Complete
            </p>
          </div>
        </div>
      )}

      {showConfig && pendingSession && !isAnalyzing && (
        <ConfigModal 
          columns={pendingSession.columns} 
          onClose={() => setShowConfig(false)} 
          onConfirm={runAnalysis}
        />
      )}
    </div>
  );
};

export default App;
